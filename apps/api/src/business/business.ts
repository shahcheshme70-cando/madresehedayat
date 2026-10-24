import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, NotFoundException, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, sql } from 'drizzle-orm';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { csvCell } from '../common/csv';
import { isUnique } from '../common/errors';
import { jalaliNow, jalaliQuarter, tehranStart } from '../common/jalali';
import { Db, InjectDb } from '../db/db.module';
import { pgArr } from '../db/id';
import {
  auditLogs, coreMemberships, cores, courses, enrollments, invoices, kv, networkMembers, networks,
  roleGrants, serviceOrders, sponsors, subscriptionCourses, subscriptions, users,
} from '../db/schema';
import { Notifier } from '../notifications/notifications';
import { AccessLog } from '../security/security';
import { Costs, DEFAULT_COSTS, FEATURE_FA, FeatureKey, has, Plan, PLAN_IDS, PLANS, priceModel, SERVICES, TIERS, volumeDiscount } from './plans';

const err = (code: string, message: string, extra: Record<string, unknown> = {}) => ({ code, message, ...extra });
const DAY = 864e5;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]).replace(/,/g, '٬');

class SubDto {
  @IsString() networkId: string;
  @IsIn(PLAN_IDS) plan: Plan;
  @IsInt() @Min(1) @Max(1_000_000) seats: number;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsOptional() @IsString() @Length(0, 60) contractNo?: string;
  @IsOptional() @IsInt() @Min(0) pricePerSeat?: number; // خالی = قیمت پیشنهادی سامانه
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPct?: number; // خالی = تخفیف حجمی
  @IsOptional() @IsInt() @Min(0) fixedFee?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) courseIds?: string[];
  @IsOptional() @IsString() @Length(0, 1000) note?: string;
}
class InvoiceDto {
  @IsOptional() @IsString() networkId?: string;
  @IsOptional() @IsString() subscriptionId?: string;
  @IsOptional() @IsString() serviceOrderId?: string;
  @IsOptional() @IsString() sponsorId?: string;
  @IsString() @Length(2, 200) title: string;
  @IsInt() @Min(1) amount: number;
}
class PayDto { @IsString() @Length(2, 80) paymentRef: string; @IsOptional() @IsDateString() paidAt?: string; }
class SponsorDto {
  @IsString() @Length(2, 120) name: string;
  @IsIn(['ORG', 'PERSON']) kind: 'ORG' | 'PERSON';
  @IsBoolean() termsAccepted: boolean;
  @IsOptional() @IsString() @Length(0, 1000) note?: string;
}
class CostLine { @IsString() @Length(1, 120) item: string; @IsInt() @Min(0) amount: number; }
class ServiceDto {
  @IsOptional() @IsString() networkId?: string | null;
  @IsOptional() @IsString() sponsorId?: string | null;
  @IsIn(['COURSE', 'WORKSHOP', 'RAHYAR_NETWORK', 'ONBOARDING', 'OTHER']) kind: string;
  @IsString() @Length(2, 200) title: string;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CostLine) costs: CostLine[];
  @IsOptional() @IsInt() @Min(0) price?: number; // خالی = هزینه + ۵۰٪
  @IsOptional() @IsIn(['PROPOSED', 'ACTIVE', 'DONE', 'CANCELLED']) status?: string;
  @IsOptional() @IsString() courseId?: string | null;
  @IsOptional() @IsString() @Length(0, 2000) note?: string;
}
class CostsDto { @IsObject() costs: Partial<Record<keyof Costs, number>>; }

export type SubStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
type SubRow = typeof subscriptions.$inferSelect;

/** مدل کسب‌وکار: اشتراک سازمان‌ها، حامیان، خدمات سفارشی، فاکتورها، قیمت‌گذاری و سنجه‌ها */
@Injectable()
export class Business {
  constructor(@InjectDb() private readonly db: Db, private readonly notify: Notifier) {}

  // ───────── هزینه و قیمت ─────────

  async costs(): Promise<Costs> {
    const r = await this.db.query.kv.findFirst({ where: eq(kv.key, 'biz.costs') });
    return { ...DEFAULT_COSTS, ...(r ? JSON.parse(r.value) : {}) };
  }
  async setCosts(actor: string, patch: Partial<Record<keyof Costs, number>>) {
    const cur = await this.costs();
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in DEFAULT_COSTS)) throw new BadRequestException(err('bad_cost', `«${k}» جزو هزینه‌ها نیست`));
      if (typeof v !== 'number' || !isFinite(v) || v < 0) throw new BadRequestException(err('bad_cost', 'هزینه‌ها باید عدد مثبت باشند'));
      (cur as any)[k] = v;
    }
    if (cur.expectedUsers < 1) throw new BadRequestException(err('bad_cost', 'شمار کاربران فعال دست‌کم ۱ است'));
    await this.db.insert(kv).values({ key: 'biz.costs', value: JSON.stringify(cur) }).onConflictDoUpdate({ target: kv.key, set: { value: JSON.stringify(cur) } });
    await this.db.insert(auditLogs).values({ actorId: actor, action: 'biz.costs', meta: patch });
    return this.pricing();
  }
  async pricing() {
    const c = await this.costs();
    return { costs: c, model: priceModel(c), discounts: [{ over: 500, pct: 15 }, { over: 2000, pct: 30 }], plans: PLANS, tiers: TIERS, services: await this.services() };
  }
  /** جدول خدمات با عددهای تنظیم‌شدهٔ ستاد */
  async services() {
    const live = (await this.costs()).basicLiveHours.toLocaleString('en-US').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
    return SERVICES.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, note: i.note?.replace('{live}', live) })) }));
  }
  /** مبلغ قرارداد اشتراک */
  async quote(plan: Plan, seats: number, pricePerSeat?: number, discountPct?: number, fixedFee?: number) {
    const c = await this.costs();
    const per = pricePerSeat ?? priceModel(c).perSeat;
    const disc = discountPct ?? volumeDiscount(seats);
    const fee = PLANS[plan].fixedFee ? (fixedFee ?? c.premiumFixedFee) : 0;
    return { pricePerSeat: per, discountPct: disc, fixedFee: fee, amount: Math.round(seats * per * (1 - disc / 100)) + fee };
  }

  // ───────── اشتراک ─────────

  status(s: Pick<SubRow, 'startsAt' | 'endsAt' | 'cancelledAt'>, now = Date.now()): SubStatus {
    if (s.cancelledAt) return 'CANCELLED';
    if (now < s.startsAt.getTime()) return 'UPCOMING';
    return now >= s.endsAt.getTime() ? 'ENDED' : 'ACTIVE';
  }

  async activeSub(networkId: string) {
    const now = new Date();
    return this.db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.networkId, networkId), isNull(subscriptions.cancelledAt), lte(subscriptions.startsAt, now), gt(subscriptions.endsAt, now)),
      orderBy: desc(subscriptions.endsAt),
    });
  }

  /** همهٔ اعضای یک سازمان: عضو مستقیم + اعضای هسته‌های آن */
  async memberIds(networkId: string) {
    const direct = await this.db.select({ id: networkMembers.userId }).from(networkMembers).where(and(eq(networkMembers.networkId, networkId), isNotNull(networkMembers.acceptedAt)));
    const viaCores = await this.db.select({ id: coreMemberships.userId }).from(coreMemberships).innerJoin(cores, eq(cores.id, coreMemberships.coreId)).where(eq(cores.networkId, networkId));
    return [...new Set([...direct, ...viaCores].map((r) => r.id))];
  }

  /** سازمان‌هایی که کاربر عضو آن است (برای دسترسی دوره‌ها، گواهی و پشتیبانی) */
  async orgsOfUser(userId: string) {
    const r = await this.db.execute<{ id: string }>(sql`
      select n.id from networks n where n.kind = 'ORGANIZATION' and (
        exists(select 1 from network_members m where m.network_id = n.id and m.user_id = ${userId} and m.accepted_at is not null)
        or exists(select 1 from core_memberships cm join cores c on c.id = cm.core_id where c.network_id = n.id and cm.user_id = ${userId}))`);
    return r.rows.map((x) => x.id);
  }

  /** اشتراک‌های فعال سازمان‌های کاربر */
  async activeSubsOfUser(userId: string) {
    const ids = await this.orgsOfUser(userId);
    if (!ids.length) return [];
    const now = new Date();
    return this.db.select({ sub: subscriptions, name: networks.name }).from(subscriptions).innerJoin(networks, eq(networks.id, subscriptions.networkId))
      .where(and(inArray(subscriptions.networkId, ids), isNull(subscriptions.cancelledAt), lte(subscriptions.startsAt, now), gt(subscriptions.endsAt, now)));
  }

  /** دوره‌هایی که اشتراک فعال سازمان‌های کاربر باز کرده */
  async subscribedCourseIds(userId: string) {
    const subs = await this.activeSubsOfUser(userId);
    if (!subs.length) return [];
    const r = await this.db.select({ id: subscriptionCourses.courseId }).from(subscriptionCourses).where(inArray(subscriptionCourses.subscriptionId, subs.map((s) => s.sub.id)));
    return r.map((x) => x.id);
  }

  /** نام سازمان روی گواهی: بستهٔ ویژه همهٔ گواهی‌ها، بستهٔ پایه فقط دوره‌های ویژهٔ سازمان */
  async certOrgName(userId: string, courseId: string | null) {
    const subs = await this.activeSubsOfUser(userId);
    for (const s of subs.sort((a, b) => (a.sub.plan === 'ORG_PREMIUM' ? -1 : 1) - (b.sub.plan === 'ORG_PREMIUM' ? -1 : 1))) {
      const p = PLANS[s.sub.plan as Plan];
      if (p.certName === 'all') return s.name;
      if (courseId && (await this.db.query.subscriptionCourses.findFirst({ where: and(eq(subscriptionCourses.subscriptionId, s.sub.id), eq(subscriptionCourses.courseId, courseId)) }))) return s.name;
    }
    return null;
  }

  /** پشتیبانی تعهدی: عضو یا مدیر سازمانی با بستهٔ ویژه */
  async hasPrioritySupport(userId: string) {
    const subs = await this.activeSubsOfUser(userId);
    if (subs.some((s) => PLANS[s.sub.plan as Plan].prioritySupport)) return true;
    const admins = await this.db.select({ n: roleGrants.networkId }).from(roleGrants).where(and(eq(roleGrants.userId, userId), eq(roleGrants.role, 'ORG_ADMIN')));
    for (const a of admins) { const s = a.n ? await this.activeSub(a.n) : null; if (s && PLANS[s.plan as Plan].prioritySupport) return true; }
    return false;
  }

  /**
   * دروازهٔ امکانات سازمانی: مدیر همین سازمان (یا ستاد) + اشتراک فعال + امکان در بسته.
   * پیام خطا روشن می‌گوید چه کم است و چه باید کرد.
   */
  async orgGate(u: AuthUser, networkId: string, feature: FeatureKey = 'orgPanel') {
    const net = await this.db.query.networks.findFirst({ where: eq(networks.id, networkId) });
    if (!net || net.kind !== 'ORGANIZATION') throw new NotFoundException(err('no_org', 'این سازمان پیدا نشد'));
    const hq = u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');
    if (!hq) {
      const g = await this.db.query.roleGrants.findFirst({ where: and(eq(roleGrants.userId, u.id), eq(roleGrants.role, 'ORG_ADMIN'), eq(roleGrants.networkId, networkId)) });
      if (!g) throw new ForbiddenException(err('not_org_admin', 'شما مدیر این سازمان نیستید'));
    }
    const sub = await this.activeSub(networkId);
    if (!sub) throw new ForbiddenException(err('no_subscription', `اشتراک «${net.name}» فعال نیست؛ برای تمدید با ستاد مدرسه هماهنگ کنید`));
    if (!has(sub.plan as Plan, feature)) throw new ForbiddenException(err('plan_feature', `«${FEATURE_FA[feature]}» در بستهٔ ${PLANS[sub.plan as Plan].label} نیست؛ برای بستهٔ سازمانی ویژه با ستاد هماهنگ کنید`, { feature }));
    return { net, sub, plan: sub.plan as Plan, features: PLANS[sub.plan as Plan] };
  }

  /** سقف نفرات؛ پیش از افزودن عضو تازه به سازمان یا هسته‌های آن */
  async assertSeats(networkId: string, adding: string[]) {
    const sub = await this.activeSub(networkId);
    if (!sub) return;
    const cur = await this.memberIds(networkId);
    const fresh = adding.filter((x) => !cur.includes(x));
    if (cur.length + fresh.length > sub.seats) {
      const free = Math.max(0, sub.seats - cur.length);
      throw new BadRequestException(err('seats_full', `سقف اشتراک پر است: ${fmt(cur.length)} نفر از ${fmt(sub.seats)} نفر. ${free ? `فقط ${fmt(free)} نفر دیگر جا دارد. ` : ''}برای افزایش سقف با ستاد هماهنگ کنید`, { used: cur.length, seats: sub.seats }));
    }
  }

  async summary(networkId: string) {
    const sub = await this.activeSub(networkId);
    const next = sub ? null : await this.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.networkId, networkId), isNull(subscriptions.cancelledAt), gt(subscriptions.startsAt, new Date())), orderBy: asc(subscriptions.startsAt) });
    const last = sub ? null : await this.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.networkId, networkId), isNull(subscriptions.cancelledAt), lte(subscriptions.endsAt, new Date())), orderBy: desc(subscriptions.endsAt) });
    const used = (await this.memberIds(networkId)).length;
    const s = sub ?? next;
    return {
      active: !!sub, used,
      subscription: s ? { id: s.id, plan: s.plan, planLabel: PLANS[s.plan as Plan].label, seats: s.seats, startsAt: s.startsAt, endsAt: s.endsAt, status: this.status(s), daysLeft: Math.ceil((s.endsAt.getTime() - Date.now()) / DAY) } : null,
      endedAt: last?.endsAt ?? null,
      features: sub ? PLANS[sub.plan as Plan] : null,
    };
  }

  async listSubs() {
    const rows = await this.db.select({ s: subscriptions, org: networks.name }).from(subscriptions).innerJoin(networks, eq(networks.id, subscriptions.networkId)).orderBy(desc(subscriptions.endsAt));
    const out = [];
    for (const r of rows) {
      const cs = await this.db.select({ id: courses.id, title: courses.title }).from(subscriptionCourses).innerJoin(courses, eq(courses.id, subscriptionCourses.courseId)).where(eq(subscriptionCourses.subscriptionId, r.s.id));
      const inv = await this.db.select({ status: invoices.status, amount: invoices.amount }).from(invoices).where(eq(invoices.subscriptionId, r.s.id));
      out.push({ ...r.s, org: r.org, status: this.status(r.s), used: (await this.memberIds(r.s.networkId)).length, courses: cs,
        invoiced: inv.filter((i) => i.status !== 'VOID').reduce((a, i) => a + i.amount, 0), paid: inv.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.amount, 0) });
    }
    return out;
  }

  private async checkSub(d: SubDto, exceptId?: string) {
    const s = new Date(d.startsAt), e = new Date(d.endsAt);
    if (e <= s) throw new BadRequestException(err('bad_dates', 'تاریخ پایان باید بعد از تاریخ شروع باشد'));
    if (e.getTime() - s.getTime() > 3 * 366 * DAY) throw new BadRequestException(err('too_long', 'اشتراک حداکثر سه ساله است'));
    const net = await this.db.query.networks.findFirst({ where: eq(networks.id, d.networkId) });
    if (!net || net.kind !== 'ORGANIZATION') throw new BadRequestException(err('no_org', 'اشتراک فقط برای سازمان‌ها است؛ سازمان را از فهرست انتخاب کنید'));
    // هم‌پوشانی با اشتراک دیگر همین سازمان
    const overlap = await this.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.networkId, d.networkId), isNull(subscriptions.cancelledAt), lt(subscriptions.startsAt, e), gt(subscriptions.endsAt, s), exceptId ? ne(subscriptions.id, exceptId) : undefined) });
    if (overlap) throw new BadRequestException(err('overlap', `«${net.name}» در این بازه اشتراک دیگری دارد؛ برای تمدید، اشتراک تازه را از روز پایان قبلی شروع کنید`));
    if (d.courseIds?.length) {
      const cs = await this.db.select({ id: courses.id }).from(courses).where(inArray(courses.id, d.courseIds));
      if (cs.length !== d.courseIds.length) throw new BadRequestException(err('bad_course', 'یکی از دوره‌ها پیدا نشد'));
    }
    const used = (await this.memberIds(d.networkId)).length;
    const warns: string[] = [];
    if (used > d.seats) warns.push(`این سازمان الان ${fmt(used)} عضو دارد ولی سقف ${fmt(d.seats)} است؛ تا وقتی اعضا کم نشوند، عضو تازه پذیرفته نمی‌شود`);
    if (d.courseIds?.length) {
      const open = await this.db.select({ title: courses.title }).from(courses).where(and(inArray(courses.id, d.courseIds), eq(courses.isRestricted, false)));
      if (open.length) warns.push(`این دوره‌ها محدود نیستند و برای همه باز‌اند، پس جزو امکانات اشتراک حساب نمی‌شوند: ${open.map((c) => `«${c.title}»`).join('، ')}`);
    }
    return { net, used, warn: warns.join(' — ') || null };
  }

  async createSub(u: AuthUser, d: SubDto) {
    const { net, warn } = await this.checkSub(d);
    const q = await this.quote(d.plan, d.seats, d.pricePerSeat, d.discountPct, d.fixedFee);
    const sub = await this.db.transaction(async (tx) => {
      const [s] = await tx.insert(subscriptions).values({ networkId: d.networkId, plan: d.plan, seats: d.seats, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt),
        contractNo: d.contractNo?.trim() || null, note: d.note?.trim() || null, ...q, createdById: u.id }).returning();
      if (d.courseIds?.length) await tx.insert(subscriptionCourses).values(d.courseIds.map((courseId) => ({ subscriptionId: s.id, courseId })));
      await tx.insert(auditLogs).values({ actorId: u.id, action: 'sub.create', target: s.id, meta: { org: net.name, plan: d.plan, seats: d.seats, amount: q.amount } });
      return s;
    });
    await this.notifyAdmins(d.networkId, { kind: 'subscription', title: `اشتراک ${PLANS[d.plan].label} «${net.name}» ثبت شد`, body: `${fmt(d.seats)} نفر، تا ${new Date(d.endsAt).toLocaleDateString('fa-IR')}`, link: '/org' });
    return { id: sub.id, amount: q.amount, warn };
  }

  async updateSub(u: AuthUser, id: string, d: SubDto) {
    const old = await this.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) });
    if (!old) throw new NotFoundException(err('no_subscription', 'این اشتراک پیدا نشد'));
    if (old.cancelledAt) throw new BadRequestException(err('cancelled', 'اشتراک لغوشده ویرایش نمی‌شود؛ اشتراک تازه بسازید'));
    if (d.networkId !== old.networkId) throw new BadRequestException(err('org_locked', 'سازمان اشتراک عوض نمی‌شود؛ اشتراک تازه بسازید'));
    const { warn } = await this.checkSub(d, id);
    const q = await this.quote(d.plan, d.seats, d.pricePerSeat, d.discountPct, d.fixedFee);
    await this.db.transaction(async (tx) => {
      await tx.update(subscriptions).set({ plan: d.plan, seats: d.seats, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), contractNo: d.contractNo?.trim() || null, note: d.note?.trim() || null, ...q,
        remindedAt: new Date(d.endsAt).getTime() !== old.endsAt.getTime() ? null : old.remindedAt }).where(eq(subscriptions.id, id));
      await tx.delete(subscriptionCourses).where(eq(subscriptionCourses.subscriptionId, id));
      if (d.courseIds?.length) await tx.insert(subscriptionCourses).values(d.courseIds.map((courseId) => ({ subscriptionId: id, courseId })));
      await tx.insert(auditLogs).values({ actorId: u.id, action: 'sub.update', target: id, meta: { plan: d.plan, seats: d.seats, amount: q.amount } });
    });
    return { ok: true, amount: q.amount, warn };
  }

  async cancelSub(u: AuthUser, id: string) {
    const s = await this.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) });
    if (!s) throw new NotFoundException(err('no_subscription', 'این اشتراک پیدا نشد'));
    if (s.cancelledAt) return { ok: true };
    await this.db.update(subscriptions).set({ cancelledAt: new Date() }).where(eq(subscriptions.id, id));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'sub.cancel', target: id });
    await this.notifyAdmins(s.networkId, { kind: 'subscription', title: 'اشتراک سازمان لغو شد', body: 'دوره‌های ویژه و پنل سازمان بسته شد؛ پرونده و گواهی اعضا سر جایش است.', link: '/org' });
    return { ok: true };
  }

  private async notifyAdmins(networkId: string, n: { kind: string; title: string; body?: string; link?: string }) {
    const a = await this.db.select({ id: roleGrants.userId }).from(roleGrants).where(and(eq(roleGrants.role, 'ORG_ADMIN'), eq(roleGrants.networkId, networkId)));
    await this.notify.send(a.map((x) => x.id), n);
  }

  /** روزانه: یادآوری ۳۰ و ۷ روز پیش از پایان و خبر پایان، به مدیر سازمان و مدیران ستاد */
  async remindExpiry() {
    const now = Date.now();
    const rows = await this.db.select({ s: subscriptions, org: networks.name }).from(subscriptions).innerJoin(networks, eq(networks.id, subscriptions.networkId))
      .where(and(isNull(subscriptions.cancelledAt), gt(subscriptions.endsAt, new Date(now - 2 * DAY)), lt(subscriptions.endsAt, new Date(now + 31 * DAY))));
    const hq = (await this.db.selectDistinct({ id: roleGrants.userId }).from(roleGrants).where(eq(roleGrants.role, 'HQ_ADMIN'))).map((r) => r.id);
    for (const { s, org } of rows) {
      // اگر اشتراک بعدی پشت‌سرش هست، یادآوری لازم نیست
      const renewed = await this.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.networkId, s.networkId), isNull(subscriptions.cancelledAt), gte(subscriptions.endsAt, new Date(s.endsAt.getTime() + DAY)), ne(subscriptions.id, s.id)) });
      if (renewed) continue;
      const left = (s.endsAt.getTime() - now) / DAY;
      const r = { ...((s.remindedAt as any) ?? {}) };
      let key: string | null = null, title = '';
      if (left <= 0 && !r.ended) { key = 'ended'; title = `اشتراک «${org}» تمام شد`; }
      else if (left > 0 && left <= 7 && !r.d7) { key = 'd7'; title = `۷ روز تا پایان اشتراک «${org}»`; }
      else if (left > 7 && left <= 30 && !r.d30) { key = 'd30'; title = `۳۰ روز تا پایان اشتراک «${org}»`; }
      if (!key) continue;
      r[key] = new Date().toISOString();
      if (key === 'd7') r.d30 = r.d30 ?? r.d7;
      await this.db.update(subscriptions).set({ remindedAt: r }).where(eq(subscriptions.id, s.id));
      const body = key === 'ended' ? 'دوره‌های ویژه و پنل سازمان بسته شد. پرونده، پیشرفت و گواهی اعضا پاک نمی‌شود و با تمدید برمی‌گردد.' : 'برای تمدید با ستاد مدرسه هماهنگ کنید؛ پس از پایان، دوره‌های ویژه و پنل سازمان بسته می‌شود.';
      await this.notifyAdmins(s.networkId, { kind: 'subscription', title, body, link: '/org' });
      await this.notify.send(hq, { kind: 'subscription', title, body: `${fmt(s.seats)} نفر، ${PLANS[s.plan as Plan].label}`, link: '/admin/business/subscriptions' });
    }
  }

  // ───────── فاکتور ─────────

  private async nextInvoiceNo() {
    const { jy } = jalaliNow();
    const [r] = await this.db.select({ n: count() }).from(invoices).where(sql`${invoices.number} like ${`MH-${jy}-%`}`);
    return `MH-${jy}-${String(r.n + 1).padStart(4, '0')}`;
  }
  async listInvoices(where?: any) {
    return this.db.select({ inv: invoices, org: networks.name, sponsor: sponsors.name }).from(invoices).leftJoin(networks, eq(networks.id, invoices.networkId)).leftJoin(sponsors, eq(sponsors.id, invoices.sponsorId))
      .where(where).orderBy(desc(invoices.createdAt)).limit(500).then((rows) => rows.map((r) => ({ ...r.inv, org: r.org, sponsor: r.sponsor })));
  }
  async createInvoice(u: AuthUser, d: InvoiceDto) {
    if (!d.networkId && !d.sponsorId && !d.subscriptionId && !d.serviceOrderId) throw new BadRequestException(err('no_payer', 'فاکتور باید به یک سازمان، حامی، اشتراک یا خدمت وصل باشد'));
    let networkId = d.networkId ?? null;
    if (d.subscriptionId) { const s = await this.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, d.subscriptionId) }); if (!s) throw new NotFoundException(err('no_subscription', 'اشتراک پیدا نشد')); networkId = s.networkId; }
    if (d.serviceOrderId) { const s = await this.db.query.serviceOrders.findFirst({ where: eq(serviceOrders.id, d.serviceOrderId) }); if (!s) throw new NotFoundException(err('no_service', 'خدمت پیدا نشد')); networkId = networkId ?? s.networkId; }
    for (let i = 0; i < 3; i++) {
      try {
        const [inv] = await this.db.insert(invoices).values({ number: await this.nextInvoiceNo(), networkId, subscriptionId: d.subscriptionId ?? null, serviceOrderId: d.serviceOrderId ?? null, sponsorId: d.sponsorId ?? null,
          title: d.title.trim(), amount: d.amount, createdById: u.id }).returning();
        await this.db.insert(auditLogs).values({ actorId: u.id, action: 'invoice.create', target: inv.id, meta: { number: inv.number, amount: inv.amount } });
        return inv;
      } catch (e) { if (!isUnique(e)) throw e; }
    }
    throw new BadRequestException(err('retry', 'شمارهٔ فاکتور تکراری شد؛ دوباره بزنید'));
  }
  async payInvoice(u: AuthUser, id: string, d: PayDto) {
    const inv = await this.db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (!inv) throw new NotFoundException(err('no_invoice', 'فاکتور پیدا نشد'));
    if (inv.status !== 'ISSUED') throw new BadRequestException(err('not_open', inv.status === 'PAID' ? 'این فاکتور پیش‌تر پرداخت شده' : 'این فاکتور باطل شده است'));
    // شرط وضعیت در خود UPDATE: پرداخت و ابطال هم‌زمان هم‌دیگر را پاک نمی‌کنند
    const done = await this.db.update(invoices).set({ status: 'PAID', paymentRef: d.paymentRef.trim(), paidAt: d.paidAt ? new Date(d.paidAt) : new Date(), method: 'TRANSFER' }).where(and(eq(invoices.id, id), eq(invoices.status, 'ISSUED'))).returning({ id: invoices.id });
    if (!done.length) throw new BadRequestException(err('not_open', 'وضع این فاکتور همین حالا عوض شد؛ صفحه را تازه کنید'));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'invoice.pay', target: id, meta: { ref: d.paymentRef } });
    return { ok: true };
  }
  async voidInvoice(u: AuthUser, id: string) {
    const inv = await this.db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (!inv) throw new NotFoundException(err('no_invoice', 'فاکتور پیدا نشد'));
    if (inv.status === 'PAID') throw new BadRequestException(err('paid', 'فاکتور پرداخت‌شده باطل نمی‌شود؛ برای برگشت پول، فاکتور برگشتی بیرون از سامانه ثبت کنید'));
    const done = await this.db.update(invoices).set({ status: 'VOID' }).where(and(eq(invoices.id, id), eq(invoices.status, 'ISSUED'))).returning({ id: invoices.id });
    if (!done.length) throw new BadRequestException(err('not_open', 'وضع این فاکتور همین حالا عوض شد؛ صفحه را تازه کنید'));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'invoice.void', target: id });
    return { ok: true };
  }

  // ───────── حامیان ─────────

  async listSponsors() {
    const ss = await this.db.select().from(sponsors).orderBy(asc(sponsors.name));
    const cs = await this.db.select({ id: courses.id, title: courses.title, sponsorId: courses.sponsorId }).from(courses).where(sql`${courses.sponsorId} is not null`);
    const inv = await this.db.select({ s: invoices.sponsorId, status: invoices.status, amount: invoices.amount }).from(invoices).where(sql`${invoices.sponsorId} is not null`);
    return ss.map((s) => ({ ...s, courses: cs.filter((c) => c.sponsorId === s.id).map((c) => ({ id: c.id, title: c.title })),
      paid: inv.filter((i) => i.s === s.id && i.status === 'PAID').reduce((a, i) => a + i.amount, 0) }));
  }
  async saveSponsor(u: AuthUser, d: SponsorDto, id?: string) {
    if (!d.termsAccepted) throw new BadRequestException(err('terms', 'حامی باید سه شرط را پذیرفته باشد: محتوا با تأیید ستاد، فقط یک خط نام بی لوگو و تبلیغ، مالکیت دوره با مدرسه'));
    const v = { name: d.name.trim(), kind: d.kind, termsAccepted: true, note: d.note?.trim() || null };
    if (id) { const [r] = await this.db.update(sponsors).set(v).where(eq(sponsors.id, id)).returning(); if (!r) throw new NotFoundException(err('no_sponsor', 'حامی پیدا نشد')); }
    else { const [r] = await this.db.insert(sponsors).values(v).returning(); id = r.id; }
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'sponsor.save', target: id });
    return { id };
  }
  async deleteSponsor(u: AuthUser, id: string) {
    const [c] = await this.db.select({ n: count() }).from(courses).where(eq(courses.sponsorId, id));
    if (c.n) throw new BadRequestException(err('in_use', `این حامی روی ${fmt(c.n)} دوره ثبت است؛ اول از دوره‌ها برداریدش`));
    await this.db.delete(sponsors).where(eq(sponsors.id, id));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'sponsor.delete', target: id });
    return { ok: true };
  }
  async setCourseSponsor(u: AuthUser, courseId: string, sponsorId: string | null) {
    if (sponsorId) { const s = await this.db.query.sponsors.findFirst({ where: eq(sponsors.id, sponsorId) }); if (!s) throw new NotFoundException(err('no_sponsor', 'حامی پیدا نشد')); }
    const [r] = await this.db.update(courses).set({ sponsorId }).where(eq(courses.id, courseId)).returning({ id: courses.id });
    if (!r) throw new NotFoundException(err('no_course', 'دوره پیدا نشد'));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'course.sponsor', target: courseId, meta: { sponsorId } });
    return { ok: true };
  }

  // ───────── خدمات سفارشی ─────────

  async listServices() {
    return this.db.select({ s: serviceOrders, org: networks.name, sponsor: sponsors.name, course: courses.title }).from(serviceOrders)
      .leftJoin(networks, eq(networks.id, serviceOrders.networkId)).leftJoin(sponsors, eq(sponsors.id, serviceOrders.sponsorId)).leftJoin(courses, eq(courses.id, serviceOrders.courseId))
      .orderBy(desc(serviceOrders.createdAt)).then((rows) => rows.map((r) => ({ ...r.s, org: r.org, sponsor: r.sponsor, course: r.course })));
  }
  async saveService(u: AuthUser, d: ServiceDto, id?: string) {
    if (!d.networkId && !d.sponsorId) throw new BadRequestException(err('no_payer', 'سفارش‌دهنده را انتخاب کنید: یک سازمان یا یک حامی'));
    const cost = d.costs.reduce((a, c) => a + c.amount, 0);
    if (!cost) throw new BadRequestException(err('no_cost', 'برگهٔ بودجه خالی است؛ دست‌کم یک ردیف هزینه بنویسید'));
    const c = await this.costs();
    const price = d.price ?? Math.round((cost * c.serviceMarkup) / 1000) * 1000;
    const v = { networkId: d.networkId || null, sponsorId: d.sponsorId || null, kind: d.kind, title: d.title.trim(), costs: d.costs, cost, price, status: d.status ?? 'PROPOSED', courseId: d.courseId || null, note: d.note?.trim() || null };
    if (id) { const [r] = await this.db.update(serviceOrders).set(v).where(eq(serviceOrders.id, id)).returning(); if (!r) throw new NotFoundException(err('no_service', 'خدمت پیدا نشد')); }
    else { const [r] = await this.db.insert(serviceOrders).values({ ...v, createdById: u.id }).returning(); id = r.id; }
    // دورهٔ ساخته‌شده با پول حامی، نام حامی را می‌گیرد
    if (d.courseId && d.sponsorId && d.kind === 'COURSE') await this.db.update(courses).set({ sponsorId: d.sponsorId }).where(eq(courses.id, d.courseId));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'service.save', target: id, meta: { cost, price } });
    return { id, cost, price };
  }

  // ───────── سنجه‌ها ─────────

  /** کنشگر فعال میدانی: مأموریت انجام‌شده (با قاعدهٔ همان دوره) یا کار پویش در بازه */
  async fieldActiveIds(from: Date, to: Date, among?: string[]) {
    if (among && !among.length) return [];
    const filt = among ? sql`and x.uid = any(${pgArr(among)}::text[])` : sql``;
    const r = await this.db.execute<{ uid: string }>(sql`select distinct uid from (
      select lp.user_id as uid from lesson_progress lp join lessons l on l.id = lp.lesson_id where l.type = 'MISSION' and lp.completed_at >= ${from} and lp.completed_at < ${to}
      union select user_id from campaign_done where done_at >= ${from} and done_at < ${to}) x where true ${filt}`);
    return r.rows.map((x) => x.uid);
  }
  async activeLearnerIds(from: Date, to: Date, among?: string[]) {
    if (among && !among.length) return [];
    const r = await this.db.execute<{ uid: string }>(sql`select distinct user_id as uid from lesson_progress where completed_at >= ${from} and completed_at < ${to} ${among ? sql`and user_id = any(${pgArr(among)}::text[])` : sql``}`);
    return r.rows.map((x) => x.uid);
  }

  async kpi() {
    const to = new Date(), from = new Date(to.getTime() - 365 * DAY);
    const [field, active, c] = [await this.fieldActiveIds(from, to), await this.activeLearnerIds(from, to), await this.costs()];
    const m = priceModel(c);
    const now = new Date();
    const subs = await this.db.select().from(subscriptions).where(and(isNull(subscriptions.cancelledAt), lte(subscriptions.startsAt, now), gt(subscriptions.endsAt, now)));
    const { jy } = jalaliNow();
    const y0 = tehranStart(jy, 1, 1), y1 = tehranStart(jy + 1, 1, 1);
    const paid = await this.db.select({ amount: invoices.amount, sub: invoices.subscriptionId, svc: invoices.serviceOrderId, sponsor: invoices.sponsorId }).from(invoices)
      .where(and(eq(invoices.status, 'PAID'), gte(invoices.paidAt, y0), lt(invoices.paidAt, y1)));
    const sum = (f: (x: (typeof paid)[number]) => boolean) => paid.filter(f).reduce((a, x) => a + x.amount, 0);
    // فاکتوری که فقط به سازمان وصل است (بی‌اشتراک و بی‌خدمت) هم درآمد سازمان‌ها حساب می‌شود؛ هیچ پرداختی بیرون نمی‌ماند
    const income = { subscriptions: sum((x) => !!x.sub || (!x.svc && !x.sponsor)), services: sum((x) => !x.sub && !!x.svc), sponsors: sum((x) => !x.sub && !x.svc && !!x.sponsor) };
    const incomeTotal = income.subscriptions + income.services + income.sponsors;
    return {
      period: 'last365', activeUsers: active.length, fieldActive: field.length,
      costYear: m.total, costPerFieldActive: field.length ? Math.round(m.total / field.length) : null, costPerActive: active.length ? Math.round(m.total / active.length) : null,
      perSeat: m.perSeat, orgs: subs.length, seatsSold: subs.reduce((a, s) => a + s.seats, 0),
      year: jy, income, incomeTotal, hqShare: Math.max(0, m.total - incomeTotal),
    };
  }

  /** گزارش فصلی سازمان: فقط عدد، بدون نام و متن */
  async orgReport(networkId: string, jy: number, q: number) {
    if (q < 1 || q > 4 || jy < 1400 || jy > 1500) throw new BadRequestException(err('bad_quarter', 'فصل درست نیست'));
    const { from, to, label } = jalaliQuarter(jy, q);
    const ids = await this.memberIds(networkId);
    const arr = pgArr(ids);
    const one = async (q: any) => (ids.length ? Number((await this.db.execute<{ n: number }>(q)).rows[0]?.n ?? 0) : 0);
    const sub = await this.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.networkId, networkId), isNull(subscriptions.cancelledAt), lt(subscriptions.startsAt, to), gt(subscriptions.endsAt, from)), orderBy: desc(subscriptions.endsAt) });
    const courseIds = sub ? (await this.db.select({ id: subscriptionCourses.courseId }).from(subscriptionCourses).where(eq(subscriptionCourses.subscriptionId, sub.id))).map((r) => r.id) : [];
    const perCourse = courseIds.length && ids.length ? (await this.db.execute<{ id: string; title: string; enrolled: number; completed: number }>(sql`
      select c.id, c.title, count(e.user_id)::int as enrolled, count(e.completed_at)::int as completed from courses c
      left join enrollments e on e.course_id = c.id and e.user_id = any(${arr}::text[]) where c.id = any(${pgArr(courseIds)}::text[]) group by c.id, c.title order by c.title`)).rows : [];
    return {
      label, from, to, members: ids.length,
      activeLearners: (await this.activeLearnerIds(from, to, ids)).length,
      fieldActive: (await this.fieldActiveIds(from, to, ids)).length,
      lessonsCompleted: await one(sql`select count(*)::int as n from lesson_progress where completed_at >= ${from} and completed_at < ${to} and user_id = any(${arr}::text[])`),
      coursesCompleted: await one(sql`select count(*)::int as n from enrollments where completed_at >= ${from} and completed_at < ${to} and user_id = any(${arr}::text[])`),
      missionsDone: await one(sql`select count(*)::int as n from lesson_progress lp join lessons l on l.id = lp.lesson_id where l.type = 'MISSION' and lp.completed_at >= ${from} and lp.completed_at < ${to} and lp.user_id = any(${arr}::text[])`),
      certificates: await one(sql`select count(*)::int as n from certificates where issued_at >= ${from} and issued_at < ${to} and revoked_at is null and user_id = any(${arr}::text[])`),
      campaignParticipants: await one(sql`select count(distinct user_id)::int as n from campaign_done where done_at >= ${from} and done_at < ${to} and user_id = any(${arr}::text[])`),
      eventsAttended: await one(sql`select count(*)::int as n from registrations where attended_at >= ${from} and attended_at < ${to} and user_id = any(${arr}::text[])`),
      courses: perCourse,
    };
  }

  /** فصل‌هایی که برای گزارش قابل انتخاب‌اند: از آغاز نخستین اشتراک تا فصل جاری */
  async quarters(networkId: string) {
    const first = await this.db.query.subscriptions.findFirst({ where: eq(subscriptions.networkId, networkId), orderBy: asc(subscriptions.startsAt) });
    const now = jalaliNow();
    const out: { jy: number; q: number; label: string }[] = [];
    let jy = now.jy, q = Math.ceil(now.jm / 3);
    for (let i = 0; i < 12; i++) {
      const r = jalaliQuarter(jy, q);
      if (first && r.to <= first.startsAt) break;
      out.push({ jy, q, label: r.label + (i === 0 ? ' (تا امروز)' : '') });
      if (--q === 0) { q = 4; jy--; }
    }
    return out;
  }

  /** خروجی اکسل (CSV) اعضا و پیشرفتشان در دوره‌های ویژه؛ بدون متن گزارش و بدون شماره همراه */
  async orgCsv(networkId: string) {
    const ids = await this.memberIds(networkId);
    const sub = await this.activeSub(networkId);
    const cs = sub ? await this.db.select({ id: courses.id, title: courses.title }).from(subscriptionCourses).innerJoin(courses, eq(courses.id, subscriptionCourses.courseId)).where(eq(subscriptionCourses.subscriptionId, sub.id)) : [];
    const people = ids.length ? await this.db.select({ id: users.id, f: users.firstName, l: users.lastName }).from(users).where(inArray(users.id, ids)) : [];
    const en = ids.length && cs.length ? await this.db.select().from(enrollments).where(and(inArray(enrollments.userId, ids), inArray(enrollments.courseId, cs.map((c) => c.id)))) : [];
    const yearAgo = new Date(Date.now() - 365 * DAY);
    const field = new Set(await this.fieldActiveIds(yearAgo, new Date(), ids));
    const lessonsDone = ids.length ? (await this.db.execute<{ uid: string; n: number }>(sql`select user_id as uid, count(*)::int as n from lesson_progress where completed_at is not null and user_id = any(${pgArr(ids)}::text[]) group by user_id`)).rows : [];
    const q = csvCell;
    const head = ['نام', 'نام خانوادگی', 'درس‌های تمام‌شده', 'فعال میدانی در ۱۲ ماه', ...cs.map((c) => c.title)];
    const lines = people.sort((a, b) => a.l.localeCompare(b.l, 'fa')).map((p) => [p.f, p.l, String(lessonsDone.find((x) => x.uid === p.id)?.n ?? 0), field.has(p.id) ? 'بله' : 'نه',
      ...cs.map((c) => { const e = en.find((x) => x.userId === p.id && x.courseId === c.id); return !e ? 'شروع نکرده' : e.completedAt ? 'تمام‌شده' : 'در حال یادگیری'; })]);
    return '﻿' + [head, ...lines].map((r) => r.map(q).join(',')).join('\r\n');
  }

  /** سقف پویش سازمانی در سال شمسی جاری */
  async assertCampaignQuota(networkId: string, plan: Plan) {
    const cap = PLANS[plan].campaignsPerYear;
    if (cap == null) return;
    const { jy } = jalaliNow();
    const r = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from campaigns where network_id = ${networkId} and status <> 'CANCELLED' and created_at >= ${tehranStart(jy, 1, 1)}`);
    if (Number(r.rows[0].n) >= cap) throw new ForbiddenException(err('campaign_quota', `بستهٔ ${PLANS[plan].label} سالی ${fmt(cap)} پویش دارد و امسال پر شده است؛ برای پویش بیشتر، بستهٔ ویژه لازم است`));
  }
}

@Controller()
export class BusinessController {
  constructor(private readonly b: Business, private readonly access: AccessLog) {}

  // همه: جدول بسته‌ها (برای صفحهٔ «بسته‌ها» و پنل سازمان)
  @Get('plans') async plans() { return { tiers: TIERS, services: await this.b.services(), plans: PLANS, basicLiveHours: (await this.b.costs()).basicLiveHours }; }

  // ───────── ستاد ─────────
  @Get('admin/business/pricing') @Roles('HQ_ADMIN', 'HQ_OPERATOR') pricing() { return this.b.pricing(); }
  @Patch('admin/business/costs') @Roles('HQ_ADMIN') costs(@CurrentUser() u: AuthUser, @Body() d: CostsDto) { return this.b.setCosts(u.id, d.costs); }
  @Get('admin/business/kpi') @Roles('HQ_ADMIN', 'HQ_OPERATOR') kpi() { return this.b.kpi(); }
  @Get('admin/business/quote') @Roles('HQ_ADMIN', 'HQ_OPERATOR')
  quote(@Query('plan') plan: Plan, @Query('seats') seats: string, @Query('price') price?: string, @Query('discount') disc?: string, @Query('fee') fee?: string) {
    if (!PLAN_IDS.includes(plan)) throw new BadRequestException(err('bad_plan', 'بسته را انتخاب کنید'));
    const n = Number(seats); if (!(n >= 1)) throw new BadRequestException(err('bad_seats', 'شمار نفرات را بنویسید'));
    return this.b.quote(plan, n, price ? Number(price) : undefined, disc ? Number(disc) : undefined, fee ? Number(fee) : undefined);
  }

  @Get('admin/subscriptions') @Roles('HQ_ADMIN', 'HQ_OPERATOR') subs() { return this.b.listSubs(); }
  @Post('admin/subscriptions') @Roles('HQ_ADMIN') createSub(@CurrentUser() u: AuthUser, @Body() d: SubDto) { return this.b.createSub(u, d); }
  @Patch('admin/subscriptions/:id') @Roles('HQ_ADMIN') updateSub(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: SubDto) { return this.b.updateSub(u, id, d); }
  @Post('admin/subscriptions/:id/cancel') @Roles('HQ_ADMIN') @HttpCode(200) cancelSub(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.b.cancelSub(u, id); }

  @Get('admin/invoices') @Roles('HQ_ADMIN', 'HQ_OPERATOR') invoices() { return this.b.listInvoices(); }
  @Post('admin/invoices') @Roles('HQ_ADMIN') createInvoice(@CurrentUser() u: AuthUser, @Body() d: InvoiceDto) { return this.b.createInvoice(u, d); }
  @Post('admin/invoices/:id/pay') @Roles('HQ_ADMIN') @HttpCode(200) pay(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PayDto) { return this.b.payInvoice(u, id, d); }
  @Post('admin/invoices/:id/void') @Roles('HQ_ADMIN') @HttpCode(200) void(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.b.voidInvoice(u, id); }

  @Get('admin/sponsors') @Roles('HQ_ADMIN', 'HQ_OPERATOR') sponsors() { return this.b.listSponsors(); }
  @Post('admin/sponsors') @Roles('HQ_ADMIN') addSponsor(@CurrentUser() u: AuthUser, @Body() d: SponsorDto) { return this.b.saveSponsor(u, d); }
  @Patch('admin/sponsors/:id') @Roles('HQ_ADMIN') editSponsor(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: SponsorDto) { return this.b.saveSponsor(u, d, id); }
  @Delete('admin/sponsors/:id') @Roles('HQ_ADMIN') delSponsor(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.b.deleteSponsor(u, id); }
  @Post('admin/courses/:id/sponsor') @Roles('HQ_ADMIN') @HttpCode(200) courseSponsor(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: { sponsorId?: string | null }) { return this.b.setCourseSponsor(u, id, d.sponsorId || null); }

  @Get('admin/services') @Roles('HQ_ADMIN', 'HQ_OPERATOR') services() { return this.b.listServices(); }
  @Post('admin/services') @Roles('HQ_ADMIN') addService(@CurrentUser() u: AuthUser, @Body() d: ServiceDto) { return this.b.saveService(u, d); }
  @Patch('admin/services/:id') @Roles('HQ_ADMIN') editService(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: ServiceDto) { return this.b.saveService(u, d, id); }

  // ───────── مدیر سازمان ─────────
  @Get('org/:id/subscription') async orgSub(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.b.orgGate(u, id).catch((e) => { if (e?.response?.code !== 'no_subscription') throw e; });
    return this.b.summary(id);
  }
  @Get('org/:id/report') async report(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('jy') jy?: string, @Query('q') q?: string) {
    await this.b.orgGate(u, id, 'quarterlyReport');
    const qs = await this.b.quarters(id);
    const pick = jy && q ? { jy: Number(jy), q: Number(q) } : qs[0];
    return { quarters: qs, report: await this.b.orgReport(id, pick.jy, pick.q) };
  }
  @Get('org/:id/export') async exportCsv(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const g = await this.b.orgGate(u, id, 'exportData');
    this.access.write(u.id, 'org.export', id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`اعضای ${g.net.name}.csv`)}`);
    res.send(await this.b.orgCsv(id));
  }
}
