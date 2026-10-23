import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length } from 'class-validator';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { AuthUser, CurrentUser } from '../common/auth.decorators';
import { normalizeMobile } from '../common/mobile';
import { Db, InjectDb } from '../db/db.module';
import { AccessLog } from '../security/security';
import { dec, mobileKey } from '../common/crypto';
import { pgArr } from '../db/id';
import { coreMemberships, cores, mosques, networkMembers, networks, roleGrants, users } from '../db/schema';
import { Notifier } from '../notifications/notifications';
import { RahyarService } from '../rahyar/rahyar.service';
import { Business } from '../business/business';

const ALPHA = '23456789abcdefghjkmnpqrstuvwxyz';
const code = (p: string) => p + Array.from({ length: 7 }, () => ALPHA[randomInt(ALPHA.length)]).join('');

class CoreDto { @IsString() @Length(2, 60) name: string; @IsOptional() @IsString() mosqueId?: string; }
class CorePatchDto { @IsOptional() @IsString() @Length(2, 60) name?: string; @IsOptional() @IsString() leaderId?: string; }
class JoinDto { @IsString() @Length(4, 20) code: string; }
class MobilesDto { @IsArray() @ArrayMaxSize(2000) @IsString({ each: true }) mobiles: string[]; }

/**
 * هسته‌ها، امام محله و سازمان‌های مشترک.
 * - برادران: امام محله هسته می‌سازد یا عضو آزاد می‌آورد؛ مسئول هسته خودش یا کسی که تعیین می‌کند.
 * - بانور: خود عضو یا راهیار هسته می‌سازد و مسئول تعیین می‌کند.
 * - سازمان: مدیر سازمان اعضا را با شماره اضافه می‌کند و پیشرفتشان را می‌بیند.
 * مسئول هسته فقط پیشرفت دوره‌ها و حضور را می‌بیند؛ نه نمره و نه یادداشت‌ها.
 */
@Controller()
export class CoresController {
  constructor(@InjectDb() private readonly db: Db, private readonly rahyar: RahyarService, private readonly notify: Notifier, private readonly access: AccessLog, private readonly business: Business) {}

  private async summary(ids: string[]) {
    if (!ids.length) return new Map<string, { active: number; done: number; attended: number; last: string | null }>();
    const r = await this.db.execute<{ id: string; active: number; done: number; attended: number; last: string | null }>(sql`
      select u.id,
        (select count(*)::int from enrollments e where e.user_id = u.id and e.completed_at is null and e.archived_at is null) as active,
        (select count(*)::int from enrollments e where e.user_id = u.id and e.completed_at is not null) as done,
        (select count(*)::int from registrations r where r.user_id = u.id and r.attended_at is not null) as attended,
        (select max(p.updated_at) from lesson_progress p where p.user_id = u.id) as last
      from users u where u.id = any(${pgArr(ids)}::text[])`);
    return new Map(r.rows.map((x) => [x.id, x]));
  }

  private async memberRows(ids: string[]) {
    if (!ids.length) return [];
    const us = await this.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, ids));
    const sm = await this.summary(ids);
    return us.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, ...(sm.get(u.id) ?? { active: 0, done: 0, attended: 0, last: null }) }));
  }

  private async coreAccess(u: AuthUser, coreId: string) {
    const c = await this.db.query.cores.findFirst({ where: eq(cores.id, coreId) });
    if (!c) throw new NotFoundException({ code: 'no_core', message: 'هسته پیدا نشد' });
    const net = await this.db.query.networks.findFirst({ where: eq(networks.id, c.networkId) });
    const mosque = c.mosqueId ? await this.db.query.mosques.findFirst({ where: eq(mosques.id, c.mosqueId) }) : undefined;
    const isLeader = c.leaderId === u.id;
    const isImam = !!mosque && mosque.imamId === u.id;
    const isHq = u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');
    let isRahyar = false;
    if (!isLeader && !isImam && !isHq && c.leaderId) isRahyar = await this.rahyar.canSeeLearner(u.id, c.leaderId, u.roles);
    const member = !!(await this.db.query.coreMemberships.findFirst({ where: and(eq(coreMemberships.coreId, c.id), eq(coreMemberships.userId, u.id)) }));
    return { c, net, mosque, isLeader, isImam, isHq, isRahyar, member, canManage: isLeader || isImam || isHq || isRahyar };
  }

  /** هسته‌هایی که عضو یا مسئولشان هستم، و مساجدی که امامشان هستم */
  @Get('cores/mine')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.db.select({ id: cores.id, name: cores.name, leaderId: cores.leaderId, networkKind: networks.kind, networkName: networks.name, mosqueId: cores.mosqueId })
      .from(coreMemberships).innerJoin(cores, eq(cores.id, coreMemberships.coreId)).innerJoin(networks, eq(networks.id, cores.networkId)).where(eq(coreMemberships.userId, u.id));
    const led = await this.db.select({ id: cores.id, name: cores.name, leaderId: cores.leaderId, networkKind: networks.kind, networkName: networks.name, mosqueId: cores.mosqueId })
      .from(cores).innerJoin(networks, eq(networks.id, cores.networkId)).where(eq(cores.leaderId, u.id));
    const all = [...new Map([...rows, ...led].map((r) => [r.id, r])).values()];
    const counts = all.length ? await this.db.select({ coreId: coreMemberships.coreId, n: sql<number>`count(*)::int` }).from(coreMemberships).where(inArray(coreMemberships.coreId, all.map((c) => c.id))).groupBy(coreMemberships.coreId) : [];
    const ms = await this.db.select({ id: mosques.id, name: mosques.name }).from(mosques).where(eq(mosques.imamId, u.id));
    return {
      cores: all.map((c) => ({ ...c, isLeader: c.leaderId === u.id, memberCount: counts.find((x) => x.coreId === c.id)?.n ?? 0 })),
      imamOf: ms,
    };
  }

  @Post('cores')
  async create(@CurrentUser() u: AuthUser, @Body() d: CoreDto) {
    const me = await this.db.query.users.findFirst({ where: eq(users.id, u.id) });
    let networkKind: 'BROTHERS' | 'BANOUR';
    let mosqueId: string | null = null;
    if (d.mosqueId) {
      const m = await this.db.query.mosques.findFirst({ where: eq(mosques.id, d.mosqueId) });
      if (!m || (m.imamId !== u.id && !u.roles.includes('HQ_ADMIN'))) throw new ForbiddenException({ code: 'not_imam', message: 'فقط امام همین مسجد می‌تواند برایش هسته بسازد' });
      networkKind = 'BROTHERS'; mosqueId = m.id;
    } else {
      // بانور: خود عضو یا راهیار
      if (me?.gender !== 'FEMALE' && !u.roles.includes('HQ_ADMIN')) throw new ForbiddenException({ code: 'not_allowed', message: 'در شبکهٔ برادران هسته را امام محله می‌سازد' });
      networkKind = 'BANOUR';
    }
    const net = await this.db.query.networks.findFirst({ where: eq(networks.kind, networkKind) });
    if (!net) throw new BadRequestException({ code: 'no_network', message: 'شبکه تعریف نشده است' });
    const isImam = !!mosqueId;
    const [c] = await this.db.insert(cores).values({ name: d.name.trim(), networkId: net.id, mosqueId, leaderId: isImam ? null : u.id, inviteCode: code('h') }).returning();
    if (!isImam) await this.db.insert(coreMemberships).values({ coreId: c.id, userId: u.id }).onConflictDoNothing();
    return c;
  }

  @Get('cores/:id')
  async get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const a = await this.coreAccess(u, id);
    if (!a.member && !a.canManage) throw new ForbiddenException({ code: 'forbidden', message: 'عضو این هسته نیستید' });
    if (a.canManage && !a.isLeader) this.access.write(u.id, 'core.view', a.c.leaderId);
    const ms = await this.db.select({ userId: coreMemberships.userId }).from(coreMemberships).where(eq(coreMemberships.coreId, id));
    const members = await this.memberRows(ms.map((m) => m.userId));
    const leader = a.c.leaderId ? await this.db.query.users.findFirst({ where: eq(users.id, a.c.leaderId), columns: { id: true, firstName: true, lastName: true } }) : null;
    return {
      id: a.c.id, name: a.c.name, network: a.net?.name, networkKind: a.net?.kind, mosque: a.mosque?.name ?? null,
      leader: leader ? { id: leader.id, name: `${leader.firstName} ${leader.lastName}` } : null,
      canManage: a.canManage, inviteCode: a.canManage ? a.c.inviteCode : null,
      // اعضای عادی فقط نام هم‌هسته‌ای‌ها را می‌بینند
      members: a.canManage ? members : members.map((m) => ({ id: m.id, name: m.name })),
    };
  }

  @Patch('cores/:id')
  async patch(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CorePatchDto) {
    const a = await this.coreAccess(u, id);
    if (!a.canManage) throw new ForbiddenException({ code: 'forbidden', message: 'فقط مسئول هسته، امام محله یا راهیار' });
    const set: Partial<typeof cores.$inferInsert> = {};
    if (d.name) set.name = d.name.trim();
    if (d.leaderId !== undefined) {
      if (d.leaderId) {
        const isMember = await this.db.query.coreMemberships.findFirst({ where: and(eq(coreMemberships.coreId, id), eq(coreMemberships.userId, d.leaderId)) });
        if (!isMember && !(a.isImam && d.leaderId === u.id)) throw new BadRequestException({ code: 'not_member', message: 'مسئول هسته باید عضو همین هسته باشد' });
        if (a.isImam && d.leaderId === u.id) await this.db.insert(coreMemberships).values({ coreId: id, userId: u.id }).onConflictDoNothing();
        await this.notify.send(d.leaderId, { kind: 'core_leader', title: `مسئول هستهٔ «${a.c.name}» شدید`, link: `/cores/${id}` });
      }
      set.leaderId = d.leaderId || null;
    }
    const [c] = await this.db.update(cores).set(set).where(eq(cores.id, id)).returning();
    return c;
  }

  @Post('cores/:id/invite') @HttpCode(200)
  async regen(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const a = await this.coreAccess(u, id);
    if (!a.canManage) throw new ForbiddenException({ code: 'forbidden', message: 'فقط مسئول هسته' });
    const [c] = await this.db.update(cores).set({ inviteCode: code('h') }).where(eq(cores.id, id)).returning();
    return { inviteCode: c.inviteCode };
  }

  @Delete('cores/:id/members/:userId')
  async removeMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') uid: string) {
    const a = await this.coreAccess(u, id);
    if (!a.canManage && uid !== u.id) throw new ForbiddenException({ code: 'forbidden', message: 'فقط مسئول هسته' });
    await this.db.delete(coreMemberships).where(and(eq(coreMemberships.coreId, id), eq(coreMemberships.userId, uid)));
    if (a.c.leaderId === uid) await this.db.update(cores).set({ leaderId: null }).where(eq(cores.id, id));
    return { ok: true };
  }

  /** پیوستن با کد دعوت: کد هسته (h…) یا کد مسجد امام محله (m…) */
  @Post('join') @HttpCode(200)
  async join(@CurrentUser() u: AuthUser, @Body() d: JoinDto) {
    const c = d.code.trim().toLowerCase();
    const core = await this.db.query.cores.findFirst({ where: eq(cores.inviteCode, c) });
    if (core) {
      // هستهٔ یک سازمان مشترک: سقف نفرات اشتراک
      const net = await this.db.query.networks.findFirst({ where: eq(networks.id, core.networkId) });
      if (net?.kind === 'ORGANIZATION') await this.business.assertSeats(net.id, [u.id]);
      await this.db.insert(coreMemberships).values({ coreId: core.id, userId: u.id }).onConflictDoNothing();
      if (core.leaderId) await this.notify.send(core.leaderId, { kind: 'core_join', title: `عضو تازه در هستهٔ «${core.name}»`, link: `/cores/${core.id}` });
      return { joined: 'core', id: core.id, name: core.name };
    }
    const m = await this.db.query.mosques.findFirst({ where: eq(mosques.inviteCode, c) });
    if (m) {
      await this.db.update(users).set({ mosqueId: m.id, nearMosque: null }).where(eq(users.id, u.id));
      if (m.imamId) await this.notify.send(m.imamId, { kind: 'mosque_join', title: `عضو تازه در ${m.name}`, link: '/imam' });
      return { joined: 'mosque', id: m.id, name: m.name };
    }
    throw new NotFoundException({ code: 'bad_code', message: 'این کد دعوت پیدا نشد یا عوض شده است' });
  }

  // ───────── امام محله ─────────

  @Get('imam')
  async imam(@CurrentUser() u: AuthUser) {
    const ms = await this.db.select().from(mosques).where(eq(mosques.imamId, u.id));
    if (!ms.length) throw new ForbiddenException({ code: 'not_imam', message: 'به‌عنوان امام محله برای مسجدی ثبت نشده‌اید' });
    const out = [];
    for (const m of ms) {
      let inviteCode = m.inviteCode;
      if (!inviteCode) { inviteCode = code('m'); await this.db.update(mosques).set({ inviteCode }).where(eq(mosques.id, m.id)); }
      const cs = await this.db.select().from(cores).where(eq(cores.mosqueId, m.id));
      const coreMembers = cs.length ? await this.db.select().from(coreMemberships).where(inArray(coreMemberships.coreId, cs.map((c) => c.id))) : [];
      const inCore = new Set(coreMembers.map((x) => x.userId));
      const people = await this.db.select({ id: users.id }).from(users).where(eq(users.mosqueId, m.id));
      const free = people.map((p) => p.id).filter((id) => !inCore.has(id) && id !== u.id);
      const allIds = [...new Set([...free, ...inCore])];
      const rows = await this.memberRows(allIds);
      const leaders = cs.map((c) => c.leaderId).filter(Boolean) as string[];
      const leaderNames = leaders.length ? await this.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, leaders)) : [];
      out.push({
        id: m.id, name: m.name, inviteCode,
        cores: cs.map((c) => ({ id: c.id, name: c.name, inviteCode: c.inviteCode, leader: (() => { const l = leaderNames.find((x) => x.id === c.leaderId); return l ? `${l.firstName} ${l.lastName}` : null; })(),
          members: rows.filter((r) => coreMembers.some((x) => x.coreId === c.id && x.userId === r.id)) })),
        free: rows.filter((r) => free.includes(r.id)),
        totals: { members: allIds.length, active: rows.filter((r) => r.active > 0).length, completed: rows.reduce((s, r) => s + r.done, 0) },
      });
    }
    return out;
  }

  @Post('imam/mosques/:id/invite') @HttpCode(200)
  async mosqueInvite(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const m = await this.db.query.mosques.findFirst({ where: eq(mosques.id, id) });
    if (!m || m.imamId !== u.id) throw new ForbiddenException({ code: 'not_imam', message: 'امام این مسجد نیستید' });
    const inviteCode = code('m');
    await this.db.update(mosques).set({ inviteCode }).where(eq(mosques.id, id));
    return { inviteCode };
  }

  /** ستاد امام محله را تعیین می‌کند */
  @Post('admin/mosques/:id/imam') @HttpCode(200)
  async setImam(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: { mobile?: string }) {
    if (!u.roles.includes('HQ_ADMIN')) throw new ForbiddenException({ code: 'forbidden', message: 'فقط مدیر ستاد' });
    if (!d.mobile) { await this.db.update(mosques).set({ imamId: null }).where(eq(mosques.id, id)); return { ok: true }; }
    const mob = normalizeMobile(d.mobile);
    const user = mob ? await this.db.query.users.findFirst({ where: eq(users.mobile, mobileKey(mob)) }) : undefined;
    if (!user) throw new BadRequestException({ code: 'no_user', message: 'کسی با این شماره ثبت‌نام نکرده' });
    await this.db.update(mosques).set({ imamId: user.id }).where(eq(mosques.id, id));
    const brothers = await this.db.query.networks.findFirst({ where: eq(networks.kind, 'BROTHERS') });
    await this.db.insert(roleGrants).values({ userId: user.id, role: 'IMAM', networkId: brothers?.id ?? null }).onConflictDoNothing();
    await this.notify.send(user.id, { kind: 'imam', title: 'به‌عنوان امام محله ثبت شدید', body: 'از «مسجد من» هسته‌ها و اعضا را ببینید و پیوند دعوت بفرستید.', link: '/imam' });
    return { ok: true };
  }

  // ───────── سازمان مشترک ─────────

  /** پنل سازمان فقط با اشتراک فعال باز است (مدل کسب‌وکار) */
  private orgAccess(u: AuthUser, networkId: string) { return this.business.orgGate(u, networkId, 'orgPanel'); }

  @Get('org')
  async orgs(@CurrentUser() u: AuthUser) {
    const gs = await this.db.select({ networkId: roleGrants.networkId }).from(roleGrants).where(and(eq(roleGrants.userId, u.id), eq(roleGrants.role, 'ORG_ADMIN')));
    const ids = gs.map((g) => g.networkId).filter(Boolean) as string[];
    if (!ids.length) return [];
    const nets = await this.db.select().from(networks).where(inArray(networks.id, ids));
    return Promise.all(nets.map(async (n) => ({ ...n, subscription: await this.business.summary(n.id) })));
  }

  @Get('org/:id')
  async org(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const g = await this.orgAccess(u, id);
    this.access.write(u.id, 'org.view', null);
    const net = await this.db.query.networks.findFirst({ where: eq(networks.id, id) });
    if (!net) throw new NotFoundException({ code: 'no_org', message: 'سازمان پیدا نشد' });
    const direct = await this.db.select({ userId: networkMembers.userId }).from(networkMembers).where(eq(networkMembers.networkId, id));
    const viaCores = await this.db.select({ userId: coreMemberships.userId }).from(coreMemberships).innerJoin(cores, eq(cores.id, coreMemberships.coreId)).where(eq(cores.networkId, id));
    const ids = [...new Set([...direct, ...viaCores].map((x) => x.userId))];
    const courseRows = await this.db.execute<{ id: string; title: string }>(sql`select distinct c.id, c.title from courses c where c.id in (
      select course_id from access_grants where network_id = ${id} and (expires_at is null or expires_at > now())
      union select course_id from subscription_courses where subscription_id = ${g.sub.id}) order by c.title`);
    const courseIds = courseRows.rows.map((c) => c.id);
    const prog = ids.length && courseIds.length ? await this.db.execute<{ user_id: string; course_id: string; completed_at: string | null }>(sql`
      select user_id, course_id, completed_at from enrollments where user_id = any(${pgArr(ids)}::text[]) and course_id = any(${pgArr(courseIds)}::text[])`) : { rows: [] as any[] };
    const people = ids.length ? await this.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, ids)) : [];
    return {
      id: net.id, name: net.name, underRahyar: net.underRahyar, courses: courseRows.rows, subscription: await this.business.summary(id),
      members: people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`,
        courses: courseIds.map((cid) => { const e = prog.rows.find((r: any) => r.user_id === p.id && r.course_id === cid); return { courseId: cid, state: e ? (e.completed_at ? 'done' : 'active') : 'none' }; }) })),
    };
  }

  @Post('org/:id/members') @HttpCode(200)
  async addMembers(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: MobilesDto) {
    await this.orgAccess(u, id);
    const norm = d.mobiles.map((m) => normalizeMobile(m)).filter(Boolean) as string[];
    const found = norm.length ? await this.db.select({ id: users.id, mobile: users.mobile }).from(users).where(inArray(users.mobile, norm.map(mobileKey))) : [];
    await this.business.assertSeats(id, found.map((f) => f.id));
    for (const f of found) await this.db.insert(networkMembers).values({ networkId: id, userId: f.id }).onConflictDoNothing();
    const net = await this.db.query.networks.findFirst({ where: eq(networks.id, id) });
    await this.notify.send(found.map((f) => f.id), { kind: 'org_join', title: `به اشتراک «${net?.name}» اضافه شدید`, body: 'دوره‌های این اشتراک حالا برایتان باز است.', link: '/learn' });
    return { added: found.length, missing: d.mobiles.filter((m) => { const n = normalizeMobile(m); return !n || !found.some((f) => f.mobile === mobileKey(n)); }) };
  }

  @Delete('org/:id/members/:userId')
  async removeOrgMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') uid: string) {
    await this.orgAccess(u, id);
    await this.db.delete(networkMembers).where(and(eq(networkMembers.networkId, id), eq(networkMembers.userId, uid)));
    return { ok: true };
  }

  @Post('admin/networks/:id/admin') @HttpCode(200)
  async setOrgAdmin(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: { mobile: string }) {
    if (!u.roles.includes('HQ_ADMIN')) throw new ForbiddenException({ code: 'forbidden', message: 'فقط مدیر ستاد' });
    const mob = normalizeMobile(d.mobile ?? '');
    const user = mob ? await this.db.query.users.findFirst({ where: eq(users.mobile, mobileKey(mob)) }) : undefined;
    if (!user) throw new BadRequestException({ code: 'no_user', message: 'کسی با این شماره ثبت‌نام نکرده' });
    await this.db.insert(roleGrants).values({ userId: user.id, role: 'ORG_ADMIN', networkId: id }).onConflictDoNothing();
    return { ok: true };
  }
}

