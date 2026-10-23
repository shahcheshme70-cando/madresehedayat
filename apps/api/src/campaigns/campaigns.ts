import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { and, asc, count, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { dec, enc } from '../common/crypto';
import { Db, InjectDb } from '../db/db.module';
import { campaignCores, campaignDone, campaignMembers, campaignTasks, campaigns, coreMemberships, cores, counties, provinces, rahyarPositions, users } from '../db/schema';
import { Notifier } from '../notifications/notifications';

class TaskDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @Length(2, 140) title: string;
  @IsOptional() @IsString() @Length(0, 2000) body?: string;
}
class CampaignDto {
  @IsString() @Length(3, 120) title: string;
  @IsString() @Length(10, 400) summary: string;
  @IsOptional() @IsString() @Length(0, 6000) body?: string;
  @IsIn(['NATIONAL', 'PROVINCE']) scope: 'NATIONAL' | 'PROVINCE';
  @IsOptional() @IsString() provinceId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) goal?: number;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => TaskDto) tasks: TaskDto[];
}
class DoneDto { @IsOptional() @IsString() @Length(0, 1000) note?: string; }
class CoreDto { @IsString() coreId: string; }

const err = (code: string, message: string) => ({ code, message });

/**
 * پویش (۴.۴): حرکت جمعی زمان‌دار با چند کار کوتاه.
 * سازنده: ستاد (کشوری یا استانی) یا راهیار استانی (فقط استان خودش).
 * پیوستن فردی یا هسته‌ای؛ هیچ رتبه‌بندی فردی نیست — فقط شمار جمعی، نقشهٔ استان‌ها و نشان مشارکت.
 */
@Injectable()
export class Campaigns {
  constructor(@InjectDb() private readonly db: Db, private readonly notify: Notifier) {}

  private isHq = (u: AuthUser) => u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');

  /** استان‌هایی که این کاربر راهیار استانی آن است */
  async myProvinces(userId: string) {
    const r = await this.db.selectDistinct({ id: rahyarPositions.provinceId }).from(rahyarPositions)
      .where(and(eq(rahyarPositions.holderId, userId), eq(rahyarPositions.layer, 'PROVINCIAL')));
    return r.map((x) => x.id).filter(Boolean) as string[];
  }

  private async provinceOf(userId: string) {
    const [r] = await this.db.select({ p: counties.provinceId }).from(users).leftJoin(counties, eq(counties.id, users.countyId)).where(eq(users.id, userId));
    return r?.p ?? null;
  }

  private async get(id: string) {
    const c = await this.db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!c) throw new NotFoundException(err('no_campaign', 'این پویش پیدا نشد؛ شاید حذف شده باشد'));
    return c;
  }

  private async assertCanManage(u: AuthUser, c: { scope: string; provinceId: string | null; createdById: string }) {
    if (this.isHq(u)) return;
    if (c.scope === 'PROVINCE' && c.provinceId && (await this.myProvinces(u.id)).includes(c.provinceId)) return;
    throw new ForbiddenException(err('forbidden', 'مدیریت این پویش با شما نیست؛ پویش استانی را فقط راهیار همان استان یا ستاد ویرایش می‌کند'));
  }

  /** آیا کاربر این پویش را می‌بیند؟ (کشوری: همه؛ استانی: ساکنان استان) */
  private visible(c: typeof campaigns.$inferSelect, prov: string | null) {
    return c.status !== 'DRAFT' && (c.scope === 'NATIONAL' || c.provinceId === prov);
  }

  private phase(c: { startsAt: Date; endsAt: Date; status: string }) {
    const now = Date.now();
    if (c.status === 'CANCELLED') return 'CANCELLED';
    if (c.status === 'DRAFT') return 'DRAFT';
    return now < c.startsAt.getTime() ? 'UPCOMING' : now > c.endsAt.getTime() ? 'ENDED' : 'ACTIVE';
  }

  // ───────── کنشگر ─────────

  async list(u: AuthUser) {
    const prov = await this.provinceOf(u.id);
    const recent = new Date(Date.now() - 60 * 864e5);
    const rows = await this.db.select().from(campaigns)
      .where(and(eq(campaigns.status, 'PUBLISHED'), gte(campaigns.endsAt, recent), or(eq(campaigns.scope, 'NATIONAL'), prov ? eq(campaigns.provinceId, prov) : sql`false`)))
      .orderBy(asc(campaigns.endsAt));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const members = await this.db.select({ c: campaignMembers.campaignId, n: count() }).from(campaignMembers).where(inArray(campaignMembers.campaignId, ids)).groupBy(campaignMembers.campaignId);
    const done = await this.db.select({ c: campaignDone.campaignId, n: count() }).from(campaignDone).where(inArray(campaignDone.campaignId, ids)).groupBy(campaignDone.campaignId);
    const mine = await this.db.select({ c: campaignMembers.campaignId }).from(campaignMembers).where(and(inArray(campaignMembers.campaignId, ids), eq(campaignMembers.userId, u.id)));
    const myDone = await this.db.select({ c: campaignDone.campaignId, n: count() }).from(campaignDone).where(and(inArray(campaignDone.campaignId, ids), eq(campaignDone.userId, u.id))).groupBy(campaignDone.campaignId);
    const tasks = await this.db.select({ c: campaignTasks.campaignId, n: count() }).from(campaignTasks).where(inArray(campaignTasks.campaignId, ids)).groupBy(campaignTasks.campaignId);
    const m = (a: { c: string; n: number }[], id: string) => a.find((x) => x.c === id)?.n ?? 0;
    const pn = await this.provinceNames();
    return rows.map((c) => ({
      id: c.id, title: c.title, summary: c.summary, scope: c.scope, province: c.provinceId ? pn[c.provinceId] : null, goal: c.goal,
      startsAt: c.startsAt, endsAt: c.endsAt, phase: this.phase(c),
      members: m(members, c.id), done: m(done, c.id), tasks: m(tasks, c.id), joined: mine.some((x) => x.c === c.id), myDone: m(myDone, c.id),
    }));
  }

  private async provinceNames() {
    const r = await this.db.select().from(provinces);
    return Object.fromEntries(r.map((p) => [p.id, p.name])) as Record<string, string>;
  }

  /** شمار جمعی و نقشه؛ هیچ نام فردی بیرون نمی‌رود */
  async totals(c: typeof campaigns.$inferSelect) {
    const [mem] = await this.db.select({ n: count() }).from(campaignMembers).where(eq(campaignMembers.campaignId, c.id));
    const [dn] = await this.db.select({ n: count() }).from(campaignDone).where(eq(campaignDone.campaignId, c.id));
    const [cr] = await this.db.select({ n: count() }).from(campaignCores).where(eq(campaignCores.campaignId, c.id));
    const perTask = await this.db.select({ t: campaignDone.taskId, n: count() }).from(campaignDone).where(eq(campaignDone.campaignId, c.id)).groupBy(campaignDone.taskId);
    const perProvMembers = await this.db.select({ p: campaignMembers.provinceId, n: count() }).from(campaignMembers).where(eq(campaignMembers.campaignId, c.id)).groupBy(campaignMembers.provinceId);
    const perProvDone = await this.db.select({ p: campaignDone.provinceId, n: count() }).from(campaignDone).where(eq(campaignDone.campaignId, c.id)).groupBy(campaignDone.provinceId);
    const pn = await this.provinceNames();
    const map = Object.entries(pn).map(([id, name]) => ({ id, name, members: perProvMembers.find((x) => x.p === id)?.n ?? 0, done: perProvDone.find((x) => x.p === id)?.n ?? 0 }));
    return { members: mem.n, done: dn.n, cores: cr.n, perTask: Object.fromEntries(perTask.map((x) => [x.t, x.n])), map };
  }

  async detail(u: AuthUser, id: string) {
    const c = await this.get(id);
    const prov = await this.provinceOf(u.id);
    const manage = await this.assertCanManage(u, c).then(() => true, () => false);
    if (!this.visible(c, prov) && !manage) throw new NotFoundException(err('no_campaign', 'این پویش پیدا نشد یا برای استان شما نیست'));
    const tasks = await this.db.select().from(campaignTasks).where(eq(campaignTasks.campaignId, id)).orderBy(asc(campaignTasks.order));
    const me = await this.db.query.campaignMembers.findFirst({ where: and(eq(campaignMembers.campaignId, id), eq(campaignMembers.userId, u.id)) });
    const mine = await this.db.select().from(campaignDone).where(and(eq(campaignDone.campaignId, id), eq(campaignDone.userId, u.id)));
    const t = await this.totals(c);
    // هسته‌هایی که این کاربر مسئول آن است، برای پیوستن هسته‌ای
    const led = await this.db.select({ id: cores.id, name: cores.name, joined: sql<boolean>`exists(select 1 from campaign_cores cc where cc.campaign_id = ${id} and cc.core_id = ${cores.id})` })
      .from(cores).where(eq(cores.leaderId, u.id));
    const viaCore = me?.coreId ? (await this.db.query.cores.findFirst({ where: eq(cores.id, me.coreId) }))?.name ?? null : null;
    const pn = await this.provinceNames();
    return {
      id: c.id, title: c.title, summary: c.summary, body: c.body, scope: c.scope, provinceId: c.provinceId, province: c.provinceId ? pn[c.provinceId] : null,
      goal: c.goal, startsAt: c.startsAt, endsAt: c.endsAt, status: c.status, phase: this.phase(c), canManage: manage,
      joined: !!me, viaCore, badge: mine.length > 0,
      tasks: tasks.map((x) => { const d = mine.find((m) => m.taskId === x.id); return { id: x.id, title: x.title, body: x.body, count: t.perTask[x.id] ?? 0, done: !!d, note: d ? dec(d.note) : null, doneAt: d?.doneAt ?? null }; }),
      totals: { members: t.members, done: t.done, cores: t.cores }, map: c.scope === 'NATIONAL' ? t.map : t.map.filter((p) => p.id === c.provinceId),
      cores: led,
    };
  }

  private assertOpen(c: typeof campaigns.$inferSelect, joining = false) {
    const p = this.phase(c);
    if (p === 'ENDED') throw new BadRequestException(err('campaign_ended', 'زمان این پویش تمام شده است و دیگر نمی‌شود کاری ثبت کرد'));
    if (p === 'CANCELLED') throw new BadRequestException(err('campaign_cancelled', 'این پویش لغو شده است'));
    if (p === 'DRAFT') throw new BadRequestException(err('campaign_draft', 'این پویش هنوز منتشر نشده است'));
    if (p === 'UPCOMING' && !joining) throw new BadRequestException(err('campaign_not_started', 'پویش هنوز شروع نشده؛ می‌توانید از حالا بپیوندید و از روز شروع کارها را ثبت کنید'));
  }

  private async addMembers(c: typeof campaigns.$inferSelect, userIds: string[], coreId: string | null) {
    if (!userIds.length) return [];
    const rows = await this.db.select({ id: users.id, p: counties.provinceId }).from(users).leftJoin(counties, eq(counties.id, users.countyId)).where(inArray(users.id, userIds));
    // پویش استانی فقط برای ساکنان همان استان
    const ok = rows.filter((r) => c.scope === 'NATIONAL' || r.p === c.provinceId);
    if (!ok.length) return [];
    const ins = await this.db.insert(campaignMembers).values(ok.map((r) => ({ campaignId: c.id, userId: r.id, coreId, provinceId: r.p }))).onConflictDoNothing().returning({ id: campaignMembers.userId });
    return ins.map((x) => x.id);
  }

  async join(u: AuthUser, id: string) {
    const c = await this.get(id);
    if (!this.visible(c, await this.provinceOf(u.id))) throw new ForbiddenException(err('other_province', 'این پویش استانی است و فقط ساکنان همان استان می‌توانند بپیوندند'));
    this.assertOpen(c, true);
    await this.addMembers(c, [u.id], null);
    return { ok: true };
  }

  async leave(u: AuthUser, id: string) {
    await this.db.delete(campaignMembers).where(and(eq(campaignMembers.campaignId, id), eq(campaignMembers.userId, u.id)));
    return { ok: true };
  }

  /** مسئول هسته همهٔ اعضای هسته را می‌پیوندد (دوباره زدن، اعضای تازه را هم می‌آورد) */
  async joinCore(u: AuthUser, id: string, coreId: string) {
    const c = await this.get(id);
    this.assertOpen(c, true);
    const core = await this.db.query.cores.findFirst({ where: eq(cores.id, coreId) });
    if (!core) throw new NotFoundException(err('no_core', 'هسته پیدا نشد'));
    if (core.leaderId !== u.id && !this.isHq(u)) throw new ForbiddenException(err('not_leader', 'فقط مسئول هسته می‌تواند هسته را به پویش بپیوندد'));
    const ms = await this.db.select({ id: coreMemberships.userId }).from(coreMemberships).where(eq(coreMemberships.coreId, coreId));
    const all = [...new Set([u.id, ...ms.map((m) => m.id)])];
    await this.db.insert(campaignCores).values({ campaignId: id, coreId, joinedById: u.id }).onConflictDoNothing();
    const added = await this.addMembers(c, all, coreId);
    const others = added.filter((x) => x !== u.id);
    if (others.length) await this.notify.send(others, { kind: 'campaign_core', title: `هستهٔ «${core.name}» به پویش «${c.title}» پیوست`, body: 'کارهای کوتاه پویش را ببینید و هر کدام را انجام دادید علامت بزنید.', link: `/campaigns/${id}` });
    const skipped = all.length - (await this.db.select({ n: count() }).from(campaignMembers).where(and(eq(campaignMembers.campaignId, id), inArray(campaignMembers.userId, all))))[0].n;
    return { ok: true, added: added.length, skipped };
  }

  async done(u: AuthUser, id: string, taskId: string, note?: string) {
    const c = await this.get(id);
    this.assertOpen(c);
    const t = await this.db.query.campaignTasks.findFirst({ where: and(eq(campaignTasks.id, taskId), eq(campaignTasks.campaignId, id)) });
    if (!t) throw new NotFoundException(err('no_task', 'این کار در پویش پیدا نشد'));
    const me = await this.db.query.campaignMembers.findFirst({ where: and(eq(campaignMembers.campaignId, id), eq(campaignMembers.userId, u.id)) });
    if (!me) throw new BadRequestException(err('not_joined', 'اول به پویش بپیوندید، بعد کارها را علامت بزنید'));
    const n = note?.trim() ? enc(note.trim()) : null;
    await this.db.insert(campaignDone).values({ taskId, userId: u.id, campaignId: id, provinceId: me.provinceId, note: n })
      .onConflictDoUpdate({ target: [campaignDone.taskId, campaignDone.userId], set: { note: n } });
    return { ok: true };
  }

  async undone(u: AuthUser, id: string, taskId: string) {
    const c = await this.get(id);
    if (this.phase(c) === 'ENDED') throw new BadRequestException(err('campaign_ended', 'زمان پویش تمام شده و کارهای ثبت‌شده دیگر عوض نمی‌شوند'));
    await this.db.delete(campaignDone).where(and(eq(campaignDone.taskId, taskId), eq(campaignDone.userId, u.id)));
    return { ok: true };
  }

  /** نشان‌های مشارکت: پویش‌هایی که دست‌کم یک کارش را انجام داده‌ام */
  async badges(userId: string) {
    return this.db.select({ id: campaigns.id, title: campaigns.title, endsAt: campaigns.endsAt, done: count() }).from(campaignDone)
      .innerJoin(campaigns, eq(campaigns.id, campaignDone.campaignId)).where(eq(campaignDone.userId, userId))
      .groupBy(campaigns.id, campaigns.title, campaigns.endsAt).orderBy(desc(campaigns.endsAt));
  }

  // ───────── سازنده ─────────

  async manageOptions(u: AuthUser) {
    const hq = this.isHq(u);
    const pn = await this.provinceNames();
    const mine = hq ? Object.keys(pn) : await this.myProvinces(u.id);
    return { national: hq, provinces: mine.map((id) => ({ id, name: pn[id] })).sort((a, b) => a.name.localeCompare(b.name, 'fa')) };
  }

  async managed(u: AuthUser) {
    const hq = this.isHq(u);
    const mine = hq ? [] : await this.myProvinces(u.id);
    if (!hq && !mine.length) throw new ForbiddenException(err('forbidden', 'ساختن پویش برای ستاد و راهیاران استانی است'));
    const rows = await this.db.select().from(campaigns).where(hq ? undefined : and(eq(campaigns.scope, 'PROVINCE'), inArray(campaigns.provinceId, mine))).orderBy(desc(campaigns.createdAt));
    const pn = await this.provinceNames();
    const out = [];
    for (const c of rows) { const t = await this.totals(c); out.push({ id: c.id, title: c.title, scope: c.scope, province: c.provinceId ? pn[c.provinceId] : null, status: c.status, phase: this.phase(c), startsAt: c.startsAt, endsAt: c.endsAt, goal: c.goal, members: t.members, done: t.done }); }
    return out;
  }

  private async validate(u: AuthUser, d: CampaignDto) {
    const s = new Date(d.startsAt), e = new Date(d.endsAt);
    if (e <= s) throw new BadRequestException(err('bad_dates', 'تاریخ پایان باید بعد از تاریخ شروع باشد'));
    if (e.getTime() - s.getTime() > 120 * 864e5) throw new BadRequestException(err('too_long', 'پویش حداکثر ۱۲۰ روز است؛ برای حرکت بلندتر چند پویش پشت‌سرهم بسازید'));
    if (d.scope === 'NATIONAL' && !this.isHq(u)) throw new ForbiddenException(err('forbidden', 'پویش کشوری را فقط ستاد می‌سازد؛ شما می‌توانید پویش استانی بسازید'));
    if (d.scope === 'PROVINCE') {
      if (!d.provinceId) throw new BadRequestException(err('no_province', 'استان پویش را انتخاب کنید'));
      if (!this.isHq(u) && !(await this.myProvinces(u.id)).includes(d.provinceId)) throw new ForbiddenException(err('forbidden', 'فقط برای استانی که راهیار آن هستید می‌توانید پویش بسازید'));
    }
  }

  async create(u: AuthUser, d: CampaignDto) {
    await this.validate(u, d);
    return this.db.transaction(async (tx) => {
      const [c] = await tx.insert(campaigns).values({ title: d.title.trim(), summary: d.summary.trim(), body: d.body?.trim() || null, scope: d.scope, provinceId: d.scope === 'PROVINCE' ? d.provinceId! : null,
        goal: d.goal ?? null, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), createdById: u.id }).returning();
      await tx.insert(campaignTasks).values(d.tasks.map((t, i) => ({ campaignId: c.id, order: i, title: t.title.trim(), body: t.body?.trim() || null })));
      return { id: c.id };
    });
  }

  async update(u: AuthUser, id: string, d: CampaignDto) {
    const c = await this.get(id);
    await this.assertCanManage(u, c);
    await this.validate(u, d);
    if (c.status === 'PUBLISHED' && (d.scope !== c.scope || (d.provinceId ?? null) !== c.provinceId)) throw new BadRequestException(err('scope_locked', 'دامنهٔ پویش منتشرشده عوض نمی‌شود؛ چون کسانی پیوسته‌اند'));
    await this.db.transaction(async (tx) => {
      await tx.update(campaigns).set({ title: d.title.trim(), summary: d.summary.trim(), body: d.body?.trim() || null, scope: d.scope, provinceId: d.scope === 'PROVINCE' ? d.provinceId! : null,
        goal: d.goal ?? null, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt) }).where(eq(campaigns.id, id));
      const old = await tx.select().from(campaignTasks).where(eq(campaignTasks.campaignId, id));
      const keep = new Set(d.tasks.map((t) => t.id).filter(Boolean));
      const drop = old.filter((o) => !keep.has(o.id));
      if (drop.length && c.status === 'PUBLISHED') {
        const [used] = await tx.select({ n: count() }).from(campaignDone).where(inArray(campaignDone.taskId, drop.map((x) => x.id)));
        if (used.n) throw new BadRequestException(err('task_in_use', 'کاری که کسی انجامش داده را نمی‌شود حذف کرد؛ متنش را ویرایش کنید'));
      }
      if (drop.length) await tx.delete(campaignTasks).where(inArray(campaignTasks.id, drop.map((x) => x.id)));
      for (const [i, t] of d.tasks.entries()) {
        if (t.id && old.some((o) => o.id === t.id)) await tx.update(campaignTasks).set({ order: i, title: t.title.trim(), body: t.body?.trim() || null }).where(eq(campaignTasks.id, t.id));
        else await tx.insert(campaignTasks).values({ campaignId: id, order: i, title: t.title.trim(), body: t.body?.trim() || null });
      }
    });
    return { ok: true };
  }

  async manageDetail(u: AuthUser, id: string) {
    const c = await this.get(id);
    await this.assertCanManage(u, c);
    const tasks = await this.db.select().from(campaignTasks).where(eq(campaignTasks.campaignId, id)).orderBy(asc(campaignTasks.order));
    const t = await this.totals(c);
    const perDay = await this.db.execute<{ day: string; n: number }>(sql`select to_char(done_at at time zone 'Asia/Tehran', 'YYYY-MM-DD') as day, count(*)::int as n from campaign_done where campaign_id = ${id} group by 1 order by 1`);
    return { ...c, phase: this.phase(c), tasks: tasks.map((x) => ({ id: x.id, title: x.title, body: x.body, count: t.perTask[x.id] ?? 0 })),
      totals: { members: t.members, done: t.done, cores: t.cores }, map: c.scope === 'NATIONAL' ? t.map : t.map.filter((p) => p.id === c.provinceId), perDay: perDay.rows };
  }

  /** انتشار + اعلان به مخاطبان (کشوری: همه، استانی: ساکنان استان) */
  async publish(u: AuthUser, id: string) {
    const c = await this.get(id);
    await this.assertCanManage(u, c);
    if (c.status !== 'DRAFT') throw new BadRequestException(err('not_draft', 'این پویش پیش‌تر منتشر یا لغو شده است'));
    if (c.endsAt.getTime() < Date.now()) throw new BadRequestException(err('campaign_ended', 'تاریخ پایان گذشته است؛ اول تاریخ‌ها را درست کنید'));
    await this.db.update(campaigns).set({ status: 'PUBLISHED' }).where(eq(campaigns.id, id));
    const where = c.scope === 'NATIONAL' ? eq(users.isActive, true)
      : and(eq(users.isActive, true), inArray(users.countyId, this.db.select({ id: counties.id }).from(counties).where(eq(counties.provinceId, c.provinceId!))));
    const ids = (await this.db.select({ id: users.id }).from(users).where(where)).map((r) => r.id);
    await this.notify.send(ids, { kind: 'campaign', title: `پویش تازه: ${c.title}`, body: c.summary, link: `/campaigns/${id}` });
    return { ok: true, notified: ids.length };
  }

  async cancel(u: AuthUser, id: string) {
    const c = await this.get(id);
    await this.assertCanManage(u, c);
    if (c.status === 'DRAFT') { await this.db.delete(campaigns).where(eq(campaigns.id, id)); return { ok: true, deleted: true }; }
    await this.db.update(campaigns).set({ status: 'CANCELLED' }).where(eq(campaigns.id, id));
    const ms = await this.db.select({ id: campaignMembers.userId }).from(campaignMembers).where(eq(campaignMembers.campaignId, id));
    await this.notify.send(ms.map((m) => m.id), { kind: 'campaign', title: `پویش «${c.title}» لغو شد`, link: `/campaigns/${id}` });
    return { ok: true };
  }
}

@Controller()
export class CampaignsController {
  constructor(private readonly c: Campaigns) {}
  @Get('campaigns') list(@CurrentUser() u: AuthUser) { return this.c.list(u); }
  @Get('campaigns/badges') badges(@CurrentUser() u: AuthUser) { return this.c.badges(u.id); }
  @Get('campaigns/:id') detail(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.c.detail(u, id); }
  @Post('campaigns/:id/join') @HttpCode(200) join(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.c.join(u, id); }
  @Post('campaigns/:id/leave') @HttpCode(200) leave(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.c.leave(u, id); }
  @Post('campaigns/:id/join-core') @HttpCode(200) joinCore(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CoreDto) { return this.c.joinCore(u, id, d.coreId); }
  @Post('campaigns/:id/tasks/:taskId') @HttpCode(200) done(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('taskId') t: string, @Body() d: DoneDto) { return this.c.done(u, id, t, d.note); }
  @Delete('campaigns/:id/tasks/:taskId') undone(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('taskId') t: string) { return this.c.undone(u, id, t); }

  @Get('manage/campaigns/options') options(@CurrentUser() u: AuthUser) { return this.c.manageOptions(u); }
  @Get('manage/campaigns') managed(@CurrentUser() u: AuthUser) { return this.c.managed(u); }
  @Post('manage/campaigns') @Roles('HQ_ADMIN', 'HQ_OPERATOR', 'RAHYAR') create(@CurrentUser() u: AuthUser, @Body() d: CampaignDto) { return this.c.create(u, d); }
  @Get('manage/campaigns/:id') mdetail(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.c.manageDetail(u, id); }
  @Patch('manage/campaigns/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CampaignDto) { return this.c.update(u, id, d); }
  @Post('manage/campaigns/:id/publish') @HttpCode(200) publish(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.c.publish(u, id); }
  @Post('manage/campaigns/:id/cancel') @HttpCode(200) cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.c.cancel(u, id); }
}
