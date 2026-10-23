import { BadRequestException, Body, Controller, Get, HttpCode, NotImplementedException, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { and, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { config } from '../config';
import { dec, enc } from '../common/crypto';
import { newSecret, otpauthUri, verifyTotp } from '../common/totp';
import { AuthUser, CurrentUser, MaybeUser, Public } from '../common/auth.decorators';
import { ACCESS_COOKIE } from '../common/auth.guard';
import { normalizeMobile, toEnDigits } from '../common/mobile';
import { Db, InjectDb } from '../db/db.module';
import { coreMemberships, cores, counties, messengerLinks, mosques, networks, provinces, roleGrants, users } from '../db/schema';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { contactPhone, eitaaEnabled, eitaaUser, eitaaVerifyOnce, verifyEitaa } from '../eitaa/eitaa';

const REFRESH_COOKIE = 'mh_rt';
const EITAA_COOKIE = 'mh_eitaa';

class OtpDto { @IsString() mobile: string; }
class VerifyDto { @IsString() mobile: string; @IsString() @Length(4, 8) code: string; }
class RegisterDto {
  @IsString() regToken: string;
  @IsString() @Length(2, 40) firstName: string;
  @IsString() @Length(2, 60) lastName: string;
  @IsIn(['MALE', 'FEMALE']) gender: 'MALE' | 'FEMALE';
  @IsString() countyId: string;
  @IsOptional() @IsString() mosqueId?: string;
  @IsOptional() @IsString() @MaxLength(120) nearMosque?: string;
  @IsOptional() @IsString() @MaxLength(40) inviteCode?: string;
}
class ProfileDto {
  @IsOptional() @IsString() @Length(2, 40) firstName?: string;
  @IsOptional() @IsString() @Length(2, 60) lastName?: string;
  @IsOptional() @IsString() countyId?: string;
  @IsOptional() @IsString() mosqueId?: string;
  @IsOptional() @IsString() @MaxLength(120) nearMosque?: string;
  @IsOptional() @IsString() @Length(10, 10) nationalId?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, @InjectDb() private readonly db: Db, private readonly jwt: JwtService) {}

  private setCookies(res: Response, t: { access: string; refresh: string }) {
    const base = { httpOnly: true, sameSite: config.cookieSameSite, secure: config.cookieSecure || config.cookieSameSite === 'none' };
    res.cookie(ACCESS_COOKIE, t.access, { ...base, path: '/', maxAge: config.accessTtlSec * 1000 });
    res.cookie(REFRESH_COOKIE, t.refresh, { ...base, path: '/api/auth', maxAge: config.refreshTtlDays * 86400_000 });
  }

  private mobileOrThrow(m: string) {
    const v = normalizeMobile(m);
    if (!v) throw new BadRequestException({ code: 'bad_mobile', message: 'شماره باید ۱۱ رقم باشد و با ۰۹ شروع شود' });
    return v;
  }

  @Public() @Post('otp') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  requestOtp(@Body() dto: OtpDto) {
    return this.auth.requestOtp(this.mobileOrThrow(dto.mobile));
  }

  @Public() @Post('verify') @HttpCode(200) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verify(@Body() dto: VerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.verifyOtp(this.mobileOrThrow(dto.mobile), toEnDigits(dto.code).trim());
    if (r.needsRegistration) return r;
    await this.linkEitaa(req, res, r.userId);
    this.setCookies(res, await this.auth.issueTokens(r.userId, req.headers['user-agent']));
    return { needsRegistration: false, user: await this.profile(r.userId) };
  }

  @Public() @Post('register') @HttpCode(200)
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { regToken, ...input } = dto;
    const userId = await this.auth.register(regToken, input);
    await this.linkEitaa(req, res, userId);
    this.setCookies(res, await this.auth.issueTokens(userId, req.headers['user-agent']));
    return { user: await this.profile(userId) };
  }

  @Public() @Post('refresh') @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE] ?? '', req.headers['user-agent']);
    this.setCookies(res, t);
    return { ok: true };
  }

  @Public() @Post('logout') @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { ok: true };
  }

  // ───────── ایتا: ورود از داخل برنامهٔ ایتا ─────────

  /** حساب ایتایی که در همین مرورگر تأیید شده، پس از ورود به حساب مدرسه وصل می‌شود */
  private async linkEitaa(req: Request, res: Response, userId: string) {
    const raw = req.cookies?.[EITAA_COOKIE];
    if (!raw) return;
    try {
      const p = this.jwt.verify<{ eid: string; purpose: string }>(raw);
      if (p.purpose === 'eitaa') {
        await this.db.delete(messengerLinks).where(and(eq(messengerLinks.provider, 'EITAA'), eq(messengerLinks.chatId, p.eid)));
        await this.db.insert(messengerLinks).values({ userId, provider: 'EITAA', chatId: p.eid })
          .onConflictDoUpdate({ target: [messengerLinks.userId, messengerLinks.provider], set: { chatId: p.eid, linkedAt: new Date() } });
      }
    } catch { /* منقضی */ }
    res.clearCookie(EITAA_COOKIE, { path: '/api/auth' });
  }

  /** initData برنامهٔ ایتا: اگر این حساب ایتا به حسابی وصل است، بی‌کد وارد می‌شود */
  @Public() @Post('eitaa') @HttpCode(200) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async eitaa(@MaybeUser() me: AuthUser | undefined, @Body() d: { initData?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!eitaaEnabled()) throw new BadRequestException({ code: 'eitaa_off', message: 'برنامهٔ ایتا هنوز راه نیفتاده است' });
    const p = verifyEitaa(String(d.initData ?? ''));
    const eu = p && eitaaUser(p);
    if (!eu) throw new BadRequestException({ code: 'eitaa_bad', message: 'اطلاعات ایتا معتبر نیست؛ برنامه را از داخل ایتا دوباره باز کنید' });
    if (me) {
      // کسی که در همین‌جا وارد شده: حساب ایتایش را وصل می‌کنیم
      await this.db.delete(messengerLinks).where(and(eq(messengerLinks.provider, 'EITAA'), eq(messengerLinks.chatId, eu.id)));
      await this.db.insert(messengerLinks).values({ userId: me.id, provider: 'EITAA', chatId: eu.id })
        .onConflictDoUpdate({ target: [messengerLinks.userId, messengerLinks.provider], set: { chatId: eu.id, linkedAt: new Date() } });
      return { linked: true, user: await this.profile(me.id) };
    }
    const link = await this.db.query.messengerLinks.findFirst({ where: and(eq(messengerLinks.provider, 'EITAA'), eq(messengerLinks.chatId, eu.id)) });
    const u = link ? await this.db.query.users.findFirst({ where: eq(users.id, link.userId) }) : undefined;
    if (u?.isActive) {
      this.setCookies(res, await this.auth.issueTokens(u.id, req.headers['user-agent']));
      return { linked: true, user: await this.profile(u.id) };
    }
    const base = { httpOnly: true, sameSite: config.cookieSameSite, secure: config.cookieSecure || config.cookieSameSite === 'none', path: '/api/auth', maxAge: 30 * 60_000 };
    res.cookie(EITAA_COOKIE, this.jwt.sign({ eid: eu.id, purpose: 'eitaa' }, { expiresIn: '30m' }), base);
    return { linked: false, firstName: eu.firstName, lastName: eu.lastName };
  }

  /** شمارهٔ تأییدشده از ایتا (requestContact) به‌جای کد پیامکی */
  @Public() @Post('eitaa/contact') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async eitaaContact(@Body() d: { contact?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const p = verifyEitaa(String(d.contact ?? ''), 10 * 60);
    const phone = p && contactPhone(p);
    const mobile = phone ? normalizeMobile(phone) : null;
    if (!mobile) throw new BadRequestException({ code: 'eitaa_contact', message: 'شماره از ایتا دریافت نشد؛ با کد پیامکی وارد شوید' });
    // ورود بی‌کد فقط اگر سرور ایتا هم این امضا را یک‌بار تأیید کند
    if (!(await eitaaVerifyOnce(new URLSearchParams(String(d.contact)).get('hash') ?? '', req.ip ?? ''))) throw new BadRequestException({ code: 'eitaa_contact', message: 'تأیید ایتا انجام نشد؛ با کد پیامکی وارد شوید' });
    const r = await this.auth.loginByVerifiedMobile(mobile);
    if (r.needsRegistration) return r;
    await this.linkEitaa(req, res, r.userId);
    this.setCookies(res, await this.auth.issueTokens(r.userId, req.headers['user-agent']));
    return { needsRegistration: false, user: await this.profile(r.userId) };
  }

  /** «ورود با سامانهٔ پایه» (OAuth2/OIDC) — منتظر اطلاعات اتصال از تیم سامانهٔ پایه */
  @Public() @Get('sso/core')
  sso() {
    throw new NotImplementedException({ code: 'sso_not_configured', message: 'ورود با سامانهٔ پایه هنوز راه نیفتاده است' });
  }

  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    return { ...(await this.profile(u.id)), mfaPending: !!u.mfaPending };
  }

  // ───────── رمز دوم کارکنان ستاد (۱۳.۴) ─────────

  private async staffUser(u: AuthUser) {
    const roles = await this.auth.rolesOf(u.id);
    if (!roles.some((r) => r === 'HQ_ADMIN' || r === 'HQ_OPERATOR')) throw new BadRequestException({ code: 'not_staff', message: 'رمز دوم فقط برای کارکنان ستاد است' });
    const me = await this.db.query.users.findFirst({ where: eq(users.id, u.id) });
    return me!;
  }

  /** ساختن کلید تازه (فقط اگر هنوز فعال نشده) */
  @Post('mfa/setup') @HttpCode(200)
  async mfaSetup(@CurrentUser() u: AuthUser) {
    const me = await this.staffUser(u);
    if (me.totpEnabledAt) throw new BadRequestException({ code: 'mfa_enabled', message: 'رمز دوم پیش‌تر فعال شده است' });
    const secret = newSecret();
    await this.db.update(users).set({ totpSecret: enc(secret) }).where(eq(users.id, u.id));
    return { secret, uri: otpauthUri(secret, `${me.firstName} ${me.lastName}`) };
  }

  /** فعال‌سازی یا تأیید رمز دوم؛ نشست را با اختیار ستادی دوباره صادر می‌کند */
  @Post('mfa/verify') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async mfaVerify(@CurrentUser() u: AuthUser, @Body() d: { code?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const me = await this.staffUser(u);
    const secret = dec(me.totpSecret);
    if (!secret) throw new BadRequestException({ code: 'mfa_not_setup', message: 'اول رمز دوم را راه بیندازید' });
    if (!verifyTotp(secret, toEnDigits(String(d.code ?? '')))) throw new BadRequestException({ code: 'mfa_wrong', message: 'کد درست نیست؛ کد تازهٔ برنامه را وارد کنید' });
    if (!me.totpEnabledAt) await this.db.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, u.id));
    this.setCookies(res, await this.auth.upgradeMfa(req.cookies?.[REFRESH_COOKIE] ?? '', req.headers['user-agent']));
    return { ok: true };
  }

  @Patch('me')
  async update(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (dto.firstName) patch.firstName = dto.firstName.trim();
    if (dto.lastName) patch.lastName = dto.lastName.trim();
    if (dto.countyId) patch.countyId = dto.countyId;
    if (dto.mosqueId !== undefined) { patch.mosqueId = dto.mosqueId || null; if (dto.mosqueId) patch.nearMosque = null; }
    if (dto.nearMosque !== undefined) patch.nearMosque = dto.nearMosque || null;
    if (dto.nationalId !== undefined) {
      const n = toEnDigits(dto.nationalId);
      if (!/^\d{10}$/.test(n)) throw new BadRequestException({ code: 'bad_national_id', message: 'کد ملی ۱۰ رقم است' });
      patch.nationalId = enc(n);
    }
    if (Object.keys(patch).length) await this.db.update(users).set(patch).where(eq(users.id, u.id));
    return this.profile(u.id);
  }

  private async profile(userId: string) {
    const u = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!u) throw new BadRequestException({ code: 'no_user', message: 'کاربر پیدا نشد' });
    const roles = await this.auth.rolesOf(userId);
    const county = u.countyId ? await this.db.select({ id: counties.id, name: counties.name, province: provinces.name })
      .from(counties).innerJoin(provinces, eq(provinces.id, counties.provinceId)).where(eq(counties.id, u.countyId)).then((r) => r[0]) : null;
    const mosque = u.mosqueId ? await this.db.query.mosques.findFirst({ where: eq(mosques.id, u.mosqueId), columns: { id: true, name: true } }) : null;
    const coreRows = await this.db.select({ id: cores.id, name: cores.name, leaderId: cores.leaderId })
      .from(coreMemberships).innerJoin(cores, eq(cores.id, coreMemberships.coreId)).where(eq(coreMemberships.userId, userId));
    const imamOf = await this.db.select({ id: mosques.id, name: mosques.name }).from(mosques).where(eq(mosques.imamId, userId));
    const orgs = await this.db.select({ id: networks.id, name: networks.name }).from(roleGrants).innerJoin(networks, eq(networks.id, roleGrants.networkId))
      .where(and(eq(roleGrants.userId, userId), eq(roleGrants.role, 'ORG_ADMIN')));
    return {
      imamOf, orgs, allowRahyarMessages: u.allowRahyarMessages, notifyMessenger: u.notifyMessenger, mfaEnrolled: !!u.totpEnabledAt,
      id: u.id, mobile: dec(u.mobileEnc) ?? '', firstName: u.firstName, lastName: u.lastName, gender: u.gender,
      hasNationalId: !!u.nationalId, county, mosque, nearMosque: u.nearMosque, roles,
      cores: coreRows.map((c) => ({ id: c.id, name: c.name, isLeader: c.leaderId === userId })),
      ssoLinked: !!u.coreSsoId,
    };
  }
}
