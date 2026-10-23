import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { Db, InjectDb } from '../db/db.module';
import { coreMemberships, cores, otpRequests, roleGrants, sessions, users } from '../db/schema';
import { RoleName } from '../common/auth.decorators';
import { SmsSender } from '../sms/sms';

const OTP_TTL_MS = 2 * 60_000;
const RESEND_MS = 60_000;
const MAX_PER_HOUR = 5;
const MAX_WRONG = 5;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export interface RegisterInput {
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  countyId: string;
  mosqueId?: string;
  nearMosque?: string;
  inviteCode?: string;
}

@Injectable()
export class AuthService {
  constructor(@InjectDb() private readonly db: Db, private readonly jwt: JwtService, private readonly sms: SmsSender) {}

  private otpHash(mobile: string, code: string) {
    return createHmac('sha256', config.otpSecret).update(`${mobile}:${code}`).digest('hex');
  }

  async requestOtp(mobile: string) {
    const hourAgo = new Date(Date.now() - 3600_000);
    const recent = await this.db.select().from(otpRequests)
      .where(and(eq(otpRequests.mobile, mobile), gt(otpRequests.createdAt, hourAgo)))
      .orderBy(desc(otpRequests.createdAt));
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_MS) {
      const wait = Math.ceil((RESEND_MS - (Date.now() - recent[0].createdAt.getTime())) / 1000);
      throw new HttpException({ code: 'otp_wait', message: `${wait} ثانیهٔ دیگر دوباره امتحان کنید`, wait }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= MAX_PER_HOUR) {
      throw new HttpException({ code: 'otp_limit', message: 'تعداد درخواست کد زیاد شد؛ یک ساعت دیگر امتحان کنید' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = String(randomInt(10000, 100000));
    await this.db.insert(otpRequests).values({ mobile, codeHash: this.otpHash(mobile, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
    await this.sms.sendOtp(mobile, code);
    const exists = !!(await this.db.query.users.findFirst({ where: eq(users.mobile, mobile), columns: { id: true } }));
    return { sent: true, resendIn: RESEND_MS / 1000, isNew: !exists, ...(config.isDev && config.smsProvider === 'console' ? { devCode: code } : {}) };
  }

  async verifyOtp(mobile: string, code: string) {
    const [otp] = await this.db.select().from(otpRequests)
      .where(and(eq(otpRequests.mobile, mobile), isNull(otpRequests.usedAt), gt(otpRequests.expiresAt, new Date())))
      .orderBy(desc(otpRequests.createdAt)).limit(1);
    if (!otp) throw new BadRequestException({ code: 'otp_expired', message: 'کد منقضی شده؛ کد تازه بگیرید' });
    if (otp.attempts >= MAX_WRONG) throw new BadRequestException({ code: 'otp_locked', message: 'چند بار اشتباه وارد شد؛ کد تازه بگیرید' });
    const a = Buffer.from(otp.codeHash, 'hex'), b = Buffer.from(this.otpHash(mobile, code), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await this.db.update(otpRequests).set({ attempts: otp.attempts + 1 }).where(eq(otpRequests.id, otp.id));
      throw new BadRequestException({ code: 'otp_wrong', message: 'کد درست نیست', left: MAX_WRONG - otp.attempts - 1 });
    }
    await this.db.update(otpRequests).set({ usedAt: new Date() }).where(eq(otpRequests.id, otp.id));
    const user = await this.db.query.users.findFirst({ where: eq(users.mobile, mobile) });
    if (!user) {
      const regToken = this.jwt.sign({ mobile, purpose: 'register' }, { expiresIn: '20m' });
      return { needsRegistration: true as const, regToken };
    }
    if (!user.isActive) throw new UnauthorizedException({ code: 'inactive', message: 'این حساب غیرفعال است' });
    return { needsRegistration: false as const, userId: user.id };
  }

  async register(regToken: string, input: RegisterInput) {
    let mobile: string;
    try {
      const p = this.jwt.verify<{ mobile: string; purpose: string }>(regToken);
      if (p.purpose !== 'register') throw new Error();
      mobile = p.mobile;
    } catch {
      throw new BadRequestException({ code: 'reg_expired', message: 'زمان ثبت‌نام تمام شد؛ دوباره شماره را وارد کنید' });
    }
    const existing = await this.db.query.users.findFirst({ where: eq(users.mobile, mobile) });
    if (existing) return existing.id;
    const [u] = await this.db.insert(users).values({
      mobile,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      gender: input.gender,
      countyId: input.countyId,
      mosqueId: input.mosqueId || null,
      nearMosque: input.mosqueId ? null : input.nearMosque?.trim() || null,
    }).returning();
    if (input.inviteCode) {
      const core = await this.db.query.cores.findFirst({ where: eq(cores.inviteCode, input.inviteCode.trim()) });
      if (core) await this.db.insert(coreMemberships).values({ coreId: core.id, userId: u.id }).onConflictDoNothing();
    }
    return u.id;
  }

  async rolesOf(userId: string): Promise<RoleName[]> {
    const u = await this.db.query.users.findFirst({ where: eq(users.id, userId), columns: { mobile: true } });
    if (u && config.bootstrapAdmins.includes(u.mobile)) {
      await this.db.insert(roleGrants).values({ userId, role: 'HQ_ADMIN' }).onConflictDoNothing();
    }
    const rows = await this.db.select({ role: roleGrants.role }).from(roleGrants).where(eq(roleGrants.userId, userId));
    return [...new Set(rows.map((r) => r.role as RoleName))];
  }

  async issueTokens(userId: string, userAgent?: string) {
    const roles = await this.rolesOf(userId);
    const refresh = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({
      userId, tokenHash: sha(refresh), userAgent: userAgent?.slice(0, 200),
      expiresAt: new Date(Date.now() + config.refreshTtlDays * 86400_000),
    });
    const access = this.jwt.sign({ sub: userId, roles }, { expiresIn: config.accessTtlSec });
    return { access, refresh };
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const s = await this.db.query.sessions.findFirst({ where: eq(sessions.tokenHash, sha(refreshToken)) });
    if (!s || s.revokedAt || s.expiresAt < new Date()) throw new UnauthorizedException({ code: 'session_ended', message: 'دوباره وارد شوید' });
    const u = await this.db.query.users.findFirst({ where: eq(users.id, s.userId), columns: { isActive: true } });
    if (!u?.isActive) throw new UnauthorizedException({ code: 'inactive', message: 'این حساب غیرفعال است' });
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, s.id));
    return this.issueTokens(s.userId, userAgent);
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha(refreshToken)));
  }
}
