import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Injectable, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { pgArr } from '../db/id';
import { broadcasts, coreMemberships, cores, counties, enrollments, mosques, networkMembers, networks, roleGrants, users } from '../db/schema';
import { Notifier } from '../notifications/notifications';
import { RahyarService } from '../rahyar/rahyar.service';
import { Business } from '../business/business';

export type AudienceKind = 'ALL' | 'PROVINCE' | 'COUNTY' | 'NETWORK' | 'ROLE' | 'COURSE' | 'SCOPE' | 'MOSQUE' | 'CORE' | 'ORG';
class AudienceDto {
  @IsIn(['ALL', 'PROVINCE', 'COUNTY', 'NETWORK', 'ROLE', 'COURSE', 'SCOPE', 'MOSQUE', 'CORE', 'ORG']) kind: AudienceKind;
  @IsOptional() @IsArray() @IsString({ each: true }) ids?: string[];
}
class SendDto extends AudienceDto {
  @IsString() @Length(2, 120) title: string;
  @IsOptional() @IsString() @Length(0, 2000) body?: string;
  @IsOptional() @IsString() @Matches(/^\/[\w\-/]*$/) link?: string;
}

const APPROVAL_OVER = 1000;
const ROLE_FA: Record<string, string> = { RAHYAR: 'راهیاران', IMAM: 'امامان محله', INSTRUCTOR: 'مدرسان', ORG_ADMIN: 'مدیران سازمان' };

/** پیام گروهی (۶.۴): هر نقش فقط به دامنهٔ خودش؛ بیش از ۱۰۰۰ گیرنده با تأیید مدیر ستاد */
@Injectable()
export class Broadcasts {
  constructor(@InjectDb() private readonly db: Db, private readonly rahyar: RahyarService, private readonly notify: Notifier, private readonly business: Business) {}

  /** گیرندگان و برچسب مخاطب؛ اجازهٔ فرستنده همین‌جا بررسی می‌شود */
  async resolve(u: AuthUser, a: { kind: AudienceKind; ids?: string[] }): Promise<{ ids: string[]; label: string }> {
    const hq = u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');
    const ids = a.ids ?? [];
    const active = eq(users.isActive, true);
    const pick = async (where: any) => (await this.db.select({ id: users.id }).from(users).where(and(active, where))).map((r) => r.id);
    const need = (ok: boolean) => { if (!ok) throw new ForbiddenException({ code: 'forbidden', message: 'به این گروه نمی‌توانید پیام بدهید' }); };
    switch (a.kind) {
      case 'ALL': need(hq); return { ids: await pick(undefined), label: 'همهٔ کاربران' };
      case 'PROVINCE': {
        need(hq && ids.length > 0);
        const cs = await this.db.select({ id: counties.id }).from(counties).where(inArray(counties.provinceId, ids));
        const names = await this.db.execute<{ name: string }>(sql`select name from provinces where id = any(${pgArr(ids)}::text[])`);
        return { ids: cs.length ? await pick(inArray(users.countyId, cs.map((c) => c.id))) : [], label: 'استان ' + names.rows.map((r) => r.name).join('، ') };
      }
      case 'COUNTY': {
        need(hq && ids.length > 0);
        const names = await this.db.select({ name: counties.name }).from(counties).where(inArray(counties.id, ids));
        return { ids: await pick(inArray(users.countyId, ids)), label: 'شهرستان ' + names.map((r) => r.name).join('، ') };
      }
      case 'NETWORK': {
        need(hq && ids.length === 1);
        const n = await this.db.query.networks.findFirst({ where: eq(networks.id, ids[0]) });
        if (!n) throw new NotFoundException({ code: 'no_network', message: 'شبکه پیدا نشد' });
        let r: string[];
        if (n.kind === 'BROTHERS' || n.kind === 'BANOUR') r = await pick(eq(users.gender, n.kind === 'BROTHERS' ? 'MALE' : 'FEMALE'));
        else {
          const direct = await this.db.select({ id: networkMembers.userId }).from(networkMembers).where(and(eq(networkMembers.networkId, n.id), isNotNull(networkMembers.acceptedAt)));
          const viaCore = await this.db.select({ id: coreMemberships.userId }).from(coreMemberships).innerJoin(cores, eq(cores.id, coreMemberships.coreId)).where(eq(cores.networkId, n.id));
          r = [...new Set([...direct, ...viaCore].map((x) => x.id))];
        }
        return { ids: r, label: n.name };
      }
      case 'ROLE': {
        need(hq && ids.length === 1 && !!ROLE_FA[ids[0]]);
        const r = await this.db.selectDistinct({ id: roleGrants.userId }).from(roleGrants).where(eq(roleGrants.role, ids[0] as any));
        return { ids: r.map((x) => x.id), label: ROLE_FA[ids[0]] };
      }
      case 'COURSE': {
        need(hq && ids.length === 1);
        const r = await this.db.select({ id: enrollments.userId }).from(enrollments).where(eq(enrollments.courseId, ids[0]));
        const c = await this.db.execute<{ title: string }>(sql`select title from courses where id = ${ids[0]}`);
        return { ids: r.map((x) => x.id), label: `یادگیرندگان «${c.rows[0]?.title ?? ''}»` };
      }
      case 'SCOPE': {
        const s = await this.rahyar.learnersInScope(u.id);
        need(s.length > 0 || hq);
        const only = ids.length ? s.filter((l) => ids.includes(l.countyId ?? '')) : s;
        return { ids: only.map((l) => l.id), label: 'کنشگران دامنهٔ راهیاری من' };
      }
      case 'MOSQUE': {
        need(ids.length === 1);
        const m = await this.db.query.mosques.findFirst({ where: eq(mosques.id, ids[0]) });
        need(!!m && (m.imamId === u.id || hq));
        const cs = await this.db.select({ id: cores.id }).from(cores).where(eq(cores.mosqueId, m!.id));
        const inCores = cs.length ? await this.db.select({ id: coreMemberships.userId }).from(coreMemberships).where(inArray(coreMemberships.coreId, cs.map((c) => c.id))) : [];
        const free = await pick(eq(users.mosqueId, m!.id));
        return { ids: [...new Set([...free, ...inCores.map((x) => x.id)])].filter((x) => x !== u.id), label: `اعضای ${m!.name}` };
      }
      case 'ORG': {
        // مدیر سازمان با بسته‌ای که «پیام گروهی به اعضا» دارد
        need(ids.length === 1);
        const g = await this.business.orgGate(u, ids[0], 'broadcast');
        return { ids: (await this.business.memberIds(ids[0])).filter((x) => x !== u.id), label: `اعضای ${g.net.name}` };
      }
      case 'CORE': {
        need(ids.length === 1);
        const c = await this.db.query.cores.findFirst({ where: eq(cores.id, ids[0]) });
        const imam = c?.mosqueId ? await this.db.query.mosques.findFirst({ where: eq(mosques.id, c.mosqueId) }) : undefined;
        need(!!c && (c.leaderId === u.id || imam?.imamId === u.id || hq));
        const r = await this.db.select({ id: coreMemberships.userId }).from(coreMemberships).where(eq(coreMemberships.coreId, c!.id));
        return { ids: r.map((x) => x.id).filter((x) => x !== u.id), label: `هستهٔ «${c!.name}»` };
      }
    }
  }

  /** گروه‌هایی که این کاربر می‌تواند پیام بدهد (برای فرم) */
  async options(u: AuthUser) {
    const hq = u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');
    const out: { kind: AudienceKind; ids?: string[]; label: string }[] = [];
    if (hq) out.push({ kind: 'ALL', label: 'همهٔ کاربران' });
    if ((await this.rahyar.learnersInScope(u.id)).length) out.push({ kind: 'SCOPE', label: 'کنشگران دامنهٔ راهیاری من' });
    for (const m of await this.db.select().from(mosques).where(eq(mosques.imamId, u.id))) out.push({ kind: 'MOSQUE', ids: [m.id], label: `اعضای ${m.name}` });
    for (const c of await this.db.select().from(cores).where(eq(cores.leaderId, u.id))) out.push({ kind: 'CORE', ids: [c.id], label: `هستهٔ «${c.name}»` });
    for (const g of await this.db.select({ id: roleGrants.networkId }).from(roleGrants).where(and(eq(roleGrants.userId, u.id), eq(roleGrants.role, 'ORG_ADMIN')))) {
      if (!g.id) continue;
      const ok = await this.business.orgGate(u, g.id, 'broadcast').catch(() => null);
      if (ok) out.push({ kind: 'ORG', ids: [g.id], label: `اعضای ${ok.net.name}` });
    }
    return { hq, options: out, approvalOver: APPROVAL_OVER, roles: Object.entries(ROLE_FA).map(([id, label]) => ({ id, label })) };
  }

  async send(u: AuthUser, d: SendDto) {
    const { ids, label } = await this.resolve(u, d);
    if (!ids.length) throw new BadRequestException({ code: 'empty', message: 'این گروه گیرنده‌ای ندارد' });
    const needsApproval = ids.length > APPROVAL_OVER && !u.roles.includes('HQ_ADMIN');
    const [b] = await this.db.insert(broadcasts).values({ senderId: u.id, audience: { kind: d.kind, ids: d.ids ?? [], label }, title: d.title.trim(), body: d.body?.trim() || null, link: d.link || null,
      recipientCount: ids.length, status: needsApproval ? 'PENDING' : 'SENT', sentAt: needsApproval ? null : new Date() }).returning();
    if (needsApproval) {
      const admins = await this.db.selectDistinct({ id: roleGrants.userId }).from(roleGrants).where(eq(roleGrants.role, 'HQ_ADMIN'));
      await this.notify.send(admins.map((a) => a.id), { kind: 'broadcast_approval', title: `پیام گروهی منتظر تأیید (${ids.length} نفر)`, body: b.title, link: '/admin/broadcasts' });
    } else await this.deliver(b, ids);
    return { id: b.id, status: b.status, recipients: ids.length };
  }

  private async deliver(b: typeof broadcasts.$inferSelect, ids: string[]) {
    await this.notify.send(ids, { kind: 'broadcast', title: b.title, body: b.body ?? undefined, link: b.link ?? undefined });
  }

  async review(u: AuthUser, id: string, approve: boolean) {
    const b = await this.db.query.broadcasts.findFirst({ where: eq(broadcasts.id, id) });
    if (!b || b.status !== 'PENDING') throw new BadRequestException({ code: 'not_pending', message: 'این پیام منتظر تأیید نیست' });
    if (approve) {
      const sender = await this.db.select({ role: roleGrants.role }).from(roleGrants).where(eq(roleGrants.userId, b.senderId));
      const a = b.audience as any;
      const { ids } = await this.resolve({ id: b.senderId, roles: sender.map((r) => r.role) as any }, a);
      await this.db.update(broadcasts).set({ status: 'SENT', reviewedById: u.id, sentAt: new Date(), recipientCount: ids.length }).where(eq(broadcasts.id, id));
      await this.deliver(b, ids);
    } else await this.db.update(broadcasts).set({ status: 'REJECTED', reviewedById: u.id }).where(eq(broadcasts.id, id));
    await this.notify.send(b.senderId, { kind: 'broadcast_review', title: approve ? 'پیام گروهی شما فرستاده شد' : 'پیام گروهی شما تأیید نشد', body: b.title, link: '/broadcast' });
    return { ok: true };
  }

  list(where?: any) {
    return this.db.select({ id: broadcasts.id, title: broadcasts.title, body: broadcasts.body, audience: broadcasts.audience, recipientCount: broadcasts.recipientCount, status: broadcasts.status, createdAt: broadcasts.createdAt, sentAt: broadcasts.sentAt,
      sender: sql<string>`(select first_name || ' ' || last_name from users where id = ${broadcasts.senderId})` }).from(broadcasts).where(where).orderBy(desc(broadcasts.createdAt)).limit(200);
  }
}

@Controller()
export class BroadcastsController {
  constructor(private readonly b: Broadcasts) {}
  @Get('broadcasts/options') options(@CurrentUser() u: AuthUser) { return this.b.options(u); }
  @Post('broadcasts/preview') @HttpCode(200) async preview(@CurrentUser() u: AuthUser, @Body() d: AudienceDto) { const r = await this.b.resolve(u, d); return { count: r.ids.length, label: r.label }; }
  @Post('broadcasts') @HttpCode(200) send(@CurrentUser() u: AuthUser, @Body() d: SendDto) { return this.b.send(u, d); }
  @Get('broadcasts/mine') mine(@CurrentUser() u: AuthUser) { return this.b.list(eq(broadcasts.senderId, u.id)); }
  @Get('admin/broadcasts') @Roles('HQ_ADMIN', 'HQ_OPERATOR') all(@Query('status') status?: string) { return this.b.list(status ? eq(broadcasts.status, status) : undefined); }
  @Post('admin/broadcasts/:id/approve') @Roles('HQ_ADMIN') @HttpCode(200) approve(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.b.review(u, id, true); }
  @Post('admin/broadcasts/:id/reject') @Roles('HQ_ADMIN') @HttpCode(200) reject(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.b.review(u, id, false); }
}
