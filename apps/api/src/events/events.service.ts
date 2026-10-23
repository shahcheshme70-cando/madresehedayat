import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { AuthUser } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { pgArr } from '../db/id';
import { coreMemberships, cores, eventReminders, events, registrations, users } from '../db/schema';
import { Notifier } from '../notifications/notifications';

const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const checkCode = () => Array.from({ length: 6 }, () => ALPHA[randomInt(ALPHA.length)]).join('');
const HQ = (u: AuthUser) => u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');
const ACTIVE = ['REGISTERED', 'WAITLIST', 'PENDING'] as const;
const faDate = (d: Date) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(d);

export type EventInput = Partial<typeof events.$inferInsert>;
type Ev = typeof events.$inferSelect;

@Injectable()
export class EventsService {
  private readonly log = new Logger('Events');
  constructor(@InjectDb() private readonly db: Db, private readonly notify: Notifier) {}

  // ───────── دسترسی ─────────
  canCreate(u: AuthUser, kind?: string) {
    if (HQ(u) || u.roles.includes('RAHYAR')) return true;
    if (u.roles.includes('INSTRUCTOR')) return kind === 'ONLINE';
    return false;
  }
  private canManage(u: AuthUser, e: Ev) { return HQ(u) || e.createdById === u.id; }
  private async get(id: string) {
    const e = await this.db.query.events.findFirst({ where: eq(events.id, id) });
    if (!e) throw new NotFoundException({ code: 'no_event', message: 'برنامه پیدا نشد' });
    return e;
  }
  async manageable(u: AuthUser, id: string) {
    const e = await this.get(id);
    if (!this.canManage(u, e)) throw new ForbiddenException({ code: 'forbidden', message: 'فقط برگزارکنندهٔ این برنامه یا ستاد' });
    return e;
  }

  private async who(userId: string) {
    const r = await this.db.execute<{ gender: string | null; countyId: string | null; provinceId: string | null }>(sql`
      select u.gender, u.county_id as "countyId", c.province_id as "provinceId" from users u left join counties c on c.id = u.county_id where u.id = ${userId}`);
    return r.rows[0] ?? { gender: null, countyId: null, provinceId: null };
  }

  private audienceOk(e: Ev, me: { gender: string | null; provinceId: string | null; countyId: string | null }) {
    if (e.audienceGender && me.gender !== e.audienceGender) return 'این برنامه برای ' + (e.audienceGender === 'FEMALE' ? 'خواهران' : 'برادران') + ' است';
    if (e.audienceCountyId && me.countyId !== e.audienceCountyId) return 'این برنامه برای شهرستان دیگری است';
    if (e.audienceProvinceId && me.provinceId !== e.audienceProvinceId) return 'این برنامه برای استان دیگری است';
    return null;
  }

  private async counts(ids: string[]) {
    if (!ids.length) return new Map<string, { registered: number; waitlist: number; pending: number; attended: number }>();
    const r = await this.db.execute<{ event_id: string; registered: number; waitlist: number; pending: number; attended: number }>(sql`
      select event_id,
        count(*) filter (where status = 'REGISTERED')::int as registered,
        count(*) filter (where status = 'WAITLIST')::int as waitlist,
        count(*) filter (where status = 'PENDING')::int as pending,
        count(*) filter (where attended_at is not null)::int as attended
      from registrations where event_id = any(${pgArr(ids)}::text[]) group by event_id`);
    return new Map(r.rows.map((x) => [x.event_id, x]));
  }

  private pub(e: Ev, c?: { registered: number; waitlist: number }, mine?: typeof registrations.$inferSelect | null, full = false) {
    const seatsLeft = e.capacity == null ? null : Math.max(0, e.capacity - (c?.registered ?? 0));
    const out: Record<string, unknown> = {
      id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location, hostName: e.hostName,
      capacity: e.capacity, seatsLeft, waitlist: e.waitlist, requiresApproval: e.requiresApproval, registrationDeadline: e.registrationDeadline,
      audienceGender: e.audienceGender, status: e.status, cancelReason: e.cancelReason, courseId: e.courseId,
      registered: c?.registered ?? 0,
      my: mine && mine.status !== 'CANCELLED' && mine.status !== 'REJECTED' ? { status: mine.status, checkInCode: mine.status === 'REGISTERED' ? mine.checkInCode : null, attendedAt: mine.attendedAt, feedback: mine.feedback } : mine ? { status: mine.status } : null,
    };
    if (full) Object.assign(out, {
      description: e.description, agenda: e.agenda, bring: e.bring, mapUrl: e.mapUrl,
      // پیوند کلاس فقط برای ثبت‌نام‌شده‌ها و از یک ساعت پیش از شروع
      onlineUrl: mine?.status === 'REGISTERED' && e.onlineUrl && Date.now() > e.startsAt.getTime() - 3600_000 ? e.onlineUrl : null,
      onlineSoon: e.kind === 'ONLINE' && !!e.onlineUrl,
    });
    return out;
  }

  // ───────── کنشگر ─────────
  async list(u: AuthUser, scope: 'upcoming' | 'mine' | 'past') {
    const me = await this.who(u.id);
    const now = new Date();
    let rows: Ev[];
    if (scope === 'mine') {
      const regs = await this.db.select({ id: registrations.eventId }).from(registrations).where(and(eq(registrations.userId, u.id), inArray(registrations.status, [...ACTIVE])));
      rows = regs.length ? await this.db.select().from(events).where(inArray(events.id, regs.map((r) => r.id))).orderBy(asc(events.startsAt)) : [];
    } else {
      rows = await this.db.select().from(events).where(and(ne(events.status, 'DRAFT'), scope === 'past' ? lte(events.endsAt, now) : gte(events.endsAt, now)))
        .orderBy(scope === 'past' ? desc(events.startsAt) : asc(events.startsAt)).limit(100);
      rows = rows.filter((e) => !this.audienceOk(e, me));
    }
    const ids = rows.map((r) => r.id);
    const cs = await this.counts(ids);
    const mine = ids.length ? await this.db.select().from(registrations).where(and(eq(registrations.userId, u.id), inArray(registrations.eventId, ids))) : [];
    return rows.map((e) => this.pub(e, cs.get(e.id), mine.find((m) => m.eventId === e.id) ?? null));
  }

  async detail(u: AuthUser, id: string) {
    const e = await this.get(id);
    if (e.status === 'DRAFT' && !this.canManage(u, e)) throw new NotFoundException({ code: 'no_event', message: 'برنامه پیدا نشد' });
    const mine = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, id), eq(registrations.userId, u.id)) });
    const c = (await this.counts([id])).get(id);
    const block = this.audienceOk(e, await this.who(u.id));
    // مسئول هسته می‌تواند گروهی ثبت‌نام کند
    const led = await this.db.select({ id: cores.id, name: cores.name }).from(cores).where(eq(cores.leaderId, u.id));
    return { ...this.pub(e, c, mine ?? null, true), blockedReason: block, canManage: this.canManage(u, e), ledCores: led };
  }

  /** قلب ثبت‌نام: ظرفیت، فهرست انتظار، تأیید برگزارکننده */
  private async registerOne(e: Ev, userId: string, by: string | null) {
    const prev = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, e.id), eq(registrations.userId, userId)) });
    if (prev && (ACTIVE as readonly string[]).includes(prev.status)) return prev;
    if (prev?.status === 'REJECTED') throw new BadRequestException({ code: 'rejected', message: 'برگزارکننده درخواست را نپذیرفته است' });
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select id from events where id = ${e.id} for update`);
      const [{ n }] = (await tx.execute<{ n: number }>(sql`select count(*)::int as n from registrations where event_id = ${e.id} and status = 'REGISTERED'`)).rows;
      const full = e.capacity != null && n >= e.capacity;
      if (full && !e.waitlist) throw new BadRequestException({ code: 'full', message: 'ظرفیت این برنامه پر شده است' });
      const status = e.requiresApproval ? 'PENDING' : full ? 'WAITLIST' : 'REGISTERED';
      const values = { eventId: e.id, userId, status: status as 'PENDING' | 'WAITLIST' | 'REGISTERED', checkInCode: checkCode(), registeredById: by, lateCancel: false, attendedAt: null, attendanceMethod: null };
      const [r] = await tx.insert(registrations).values(values).onConflictDoUpdate({ target: [registrations.eventId, registrations.userId], set: { ...values, updatedAt: new Date() } }).returning();
      return r;
    });
  }

  private assertOpen(e: Ev) {
    if (e.status !== 'PUBLISHED') throw new BadRequestException({ code: 'closed', message: e.status === 'CANCELLED' ? 'این برنامه لغو شده است' : 'ثبت‌نام باز نیست' });
    if (e.registrationDeadline && e.registrationDeadline < new Date()) throw new BadRequestException({ code: 'deadline', message: 'مهلت ثبت‌نام تمام شده است' });
    if (e.startsAt < new Date()) throw new BadRequestException({ code: 'started', message: 'برنامه شروع شده است' });
  }

  async register(u: AuthUser, id: string) {
    const e = await this.get(id);
    this.assertOpen(e);
    const block = this.audienceOk(e, await this.who(u.id));
    if (block) throw new BadRequestException({ code: 'audience', message: block });
    const r = await this.registerOne(e, u.id, null);
    if (r.status === 'PENDING' && e.createdById) await this.notify.send(e.createdById, { kind: 'event_request', title: `درخواست تازه برای «${e.title}»`, link: `/manage/events/${e.id}` });
    return { status: r.status, checkInCode: r.status === 'REGISTERED' ? r.checkInCode : null };
  }

  /** ثبت‌نام گروهی اعضای هسته به دست مسئول هسته */
  async registerGroup(u: AuthUser, id: string, coreId: string, userIds: string[]) {
    const e = await this.get(id);
    this.assertOpen(e);
    const core = await this.db.query.cores.findFirst({ where: eq(cores.id, coreId) });
    if (!core || core.leaderId !== u.id) throw new ForbiddenException({ code: 'not_leader', message: 'فقط مسئول همین هسته' });
    const ms = await this.db.select({ userId: coreMemberships.userId }).from(coreMemberships).where(eq(coreMemberships.coreId, coreId));
    const allowed = new Set(ms.map((m) => m.userId));
    const people = await this.db.select().from(users).where(inArray(users.id, userIds.filter((x) => allowed.has(x))));
    const out: { userId: string; name: string; status: string; reason?: string }[] = [];
    for (const p of people) {
      const block = this.audienceOk(e, await this.who(p.id));
      if (block) { out.push({ userId: p.id, name: `${p.firstName} ${p.lastName}`, status: 'SKIPPED', reason: block }); continue; }
      try {
        const r = await this.registerOne(e, p.id, u.id);
        out.push({ userId: p.id, name: `${p.firstName} ${p.lastName}`, status: r.status });
        if (p.id !== u.id) await this.notify.send(p.id, { kind: 'event_group', title: `برای «${e.title}» ثبت‌نام شدید`, body: `مسئول هستهٔ «${core.name}» شما را ثبت‌نام کرد. اگر نمی‌توانید بیایید، انصراف بدهید.`, link: `/events/${e.id}` });
      } catch (err: any) {
        out.push({ userId: p.id, name: `${p.firstName} ${p.lastName}`, status: 'FAILED', reason: err?.response?.message ?? 'خطا' });
      }
    }
    return out;
  }

  /** انصراف: تا ۲۴ ساعت پیش آزاد؛ بعد از آن ثبت می‌شود و جای خالی به فهرست انتظار می‌رسد */
  async cancel(u: AuthUser, id: string) {
    const e = await this.get(id);
    const r = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, id), eq(registrations.userId, u.id)) });
    if (!r || !(ACTIVE as readonly string[]).includes(r.status)) throw new BadRequestException({ code: 'not_registered', message: 'ثبت‌نامی ندارید' });
    if (e.startsAt < new Date()) throw new BadRequestException({ code: 'started', message: 'برنامه شروع شده است' });
    const late = e.startsAt.getTime() - Date.now() < 24 * 3600_000;
    await this.db.update(registrations).set({ status: 'CANCELLED', lateCancel: late && r.status === 'REGISTERED', updatedAt: new Date() }).where(and(eq(registrations.eventId, id), eq(registrations.userId, u.id)));
    if (r.status === 'REGISTERED') await this.promote(e);
    return { ok: true, late };
  }

  /** نفر اول فهرست انتظار جای خالی را می‌گیرد */
  private async promote(e: Ev) {
    if (e.capacity == null) return;
    const [{ n }] = (await this.db.execute<{ n: number }>(sql`select count(*)::int as n from registrations where event_id = ${e.id} and status = 'REGISTERED'`)).rows;
    const free = e.capacity - n;
    if (free <= 0) return;
    const next = await this.db.select().from(registrations).where(and(eq(registrations.eventId, e.id), eq(registrations.status, 'WAITLIST'))).orderBy(asc(registrations.createdAt)).limit(free);
    for (const w of next) {
      await this.db.update(registrations).set({ status: 'REGISTERED', updatedAt: new Date() }).where(and(eq(registrations.eventId, e.id), eq(registrations.userId, w.userId)));
      await this.notify.send(w.userId, { kind: 'event_promoted', title: `جا باز شد: «${e.title}»`, body: `از فهرست انتظار به ثبت‌نام قطعی رسیدید. ${faDate(e.startsAt)}`, link: `/events/${e.id}` });
    }
  }

  async ics(id: string) {
    const e = await this.get(id);
    const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//madrese-hedayat//fa', 'BEGIN:VEVENT', `UID:${e.id}@madrese`, `DTSTAMP:${f(new Date())}`,
      `DTSTART:${f(e.startsAt)}`, `DTEND:${f(e.endsAt)}`, `SUMMARY:${esc(e.title)}`, e.location ? `LOCATION:${esc(e.location)}` : '',
      e.description ? `DESCRIPTION:${esc(e.description.slice(0, 500))}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  }

  async feedback(u: AuthUser, id: string, fb: { rating: number; comment?: string }) {
    const r = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, id), eq(registrations.userId, u.id)) });
    if (!r?.attendedAt) throw new BadRequestException({ code: 'not_attended', message: 'نظر را شرکت‌کنندگان می‌دهند' });
    const rating = Math.max(1, Math.min(5, Math.round(fb.rating)));
    await this.db.update(registrations).set({ feedback: { rating, comment: (fb.comment ?? '').slice(0, 1000) } }).where(and(eq(registrations.eventId, id), eq(registrations.userId, u.id)));
    return { ok: true };
  }

  /** ورود به کلاس آنلاین = حضور خودکار */
  async join(u: AuthUser, id: string) {
    const e = await this.get(id);
    const r = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, id), eq(registrations.userId, u.id)) });
    if (e.kind !== 'ONLINE' || !e.onlineUrl) throw new BadRequestException({ code: 'not_online', message: 'این برنامه آنلاین نیست' });
    if (r?.status !== 'REGISTERED') throw new ForbiddenException({ code: 'not_registered', message: 'اول ثبت‌نام کنید' });
    if (Date.now() < e.startsAt.getTime() - 3600_000) throw new BadRequestException({ code: 'early', message: 'پیوند از یک ساعت پیش از شروع باز می‌شود' });
    if (!r.attendedAt) await this.db.update(registrations).set({ attendedAt: new Date(), attendanceMethod: 'ONLINE' }).where(and(eq(registrations.eventId, id), eq(registrations.userId, u.id)));
    return { url: e.onlineUrl };
  }

  // ───────── برگزارکننده ─────────
  async managed(u: AuthUser) {
    const rows = await this.db.select().from(events).where(HQ(u) ? undefined : eq(events.createdById, u.id)).orderBy(desc(events.startsAt)).limit(200);
    const cs = await this.counts(rows.map((r) => r.id));
    return rows.map((e) => ({ ...this.pub(e, cs.get(e.id)), ...(cs.get(e.id) ?? { registered: 0, waitlist: 0, pending: 0, attended: 0 }) }));
  }

  private clean(u: AuthUser, d: EventInput, creating: boolean) {
    const kind = d.kind;
    if (creating && !this.canCreate(u, kind)) throw new ForbiddenException({ code: 'forbidden', message: u.roles.includes('INSTRUCTOR') ? 'مدرس فقط برنامهٔ آنلاین خودش را می‌سازد' : 'اجازهٔ ساخت برنامه ندارید' });
    if (!creating && kind && !HQ(u) && !u.roles.includes('RAHYAR') && kind !== 'ONLINE') throw new ForbiddenException({ code: 'forbidden', message: 'مدرس فقط برنامهٔ آنلاین' });
    const v: EventInput = {};
    const keys = ['title', 'description', 'agenda', 'kind', 'location', 'mapUrl', 'onlineUrl', 'bring', 'hostName', 'capacity', 'waitlist', 'requiresApproval', 'audienceGender', 'audienceProvinceId', 'audienceCountyId', 'courseId'] as const;
    for (const k of keys) if (d[k] !== undefined) (v as any)[k] = d[k] === '' ? null : d[k];
    for (const k of ['startsAt', 'endsAt', 'registrationDeadline'] as const) if (d[k] !== undefined) (v as any)[k] = d[k] ? new Date(d[k] as any) : null;
    if (v.capacity != null && (!Number.isInteger(v.capacity) || v.capacity < 1)) throw new BadRequestException({ code: 'bad_capacity', message: 'ظرفیت باید عدد مثبت باشد' });
    if (v.onlineUrl && !/^https:\/\//.test(v.onlineUrl)) throw new BadRequestException({ code: 'bad_url', message: 'پیوند کلاس باید با https شروع شود' });
    if (v.mapUrl && !/^https:\/\//.test(v.mapUrl)) throw new BadRequestException({ code: 'bad_url', message: 'پیوند نقشه باید با https شروع شود' });
    return v;
  }

  async create(u: AuthUser, d: EventInput) {
    const v = this.clean(u, d, true);
    if (!v.title || !v.kind || !v.startsAt || !v.endsAt) throw new BadRequestException({ code: 'missing', message: 'عنوان، نوع، زمان شروع و پایان لازم است' });
    if (v.endsAt <= v.startsAt) throw new BadRequestException({ code: 'bad_time', message: 'پایان باید بعد از شروع باشد' });
    const [e] = await this.db.insert(events).values({ ...(v as any), createdById: u.id, status: 'DRAFT' }).returning();
    return e;
  }

  async update(u: AuthUser, id: string, d: EventInput & { notify?: boolean }) {
    const e = await this.manageable(u, id);
    const v = this.clean(u, d, false);
    const [n] = await this.db.update(events).set({ ...v, updatedAt: new Date() }).where(eq(events.id, id)).returning();
    if (n.endsAt <= n.startsAt) throw new BadRequestException({ code: 'bad_time', message: 'پایان باید بعد از شروع باشد' });
    const timeChanged = (v.startsAt && v.startsAt.getTime() !== e.startsAt.getTime()) || (v.location !== undefined && v.location !== e.location);
    if (e.status === 'PUBLISHED' && (timeChanged || d.notify)) {
      await this.notify.send(await this.attendees(id), { kind: 'event_changed', title: `تغییر در «${n.title}»`, body: `${faDate(n.startsAt)}${n.location ? ' — ' + n.location : ''}`, link: `/events/${id}` });
      await this.db.delete(eventReminders).where(eq(eventReminders.eventId, id));
    }
    if (n.capacity != null) await this.promote(n);
    return n;
  }

  async publish(u: AuthUser, id: string) {
    const e = await this.manageable(u, id);
    const problems: string[] = [];
    if (e.kind === 'IN_PERSON' && !e.location) problems.push('نشانی برنامهٔ حضوری');
    if (e.startsAt < new Date()) problems.push('زمان شروع گذشته است');
    if (problems.length) throw new BadRequestException({ code: 'not_ready', message: 'پیش از انتشار کامل کنید: ' + problems.join('، ') });
    const [n] = await this.db.update(events).set({ status: 'PUBLISHED' }).where(eq(events.id, id)).returning();
    return n;
  }

  async cancelEvent(u: AuthUser, id: string, reason: string) {
    const e = await this.manageable(u, id);
    if (!reason?.trim()) throw new BadRequestException({ code: 'reason', message: 'دلیل لغو را بنویسید؛ برای ثبت‌نام‌شده‌ها فرستاده می‌شود' });
    await this.db.update(events).set({ status: 'CANCELLED', cancelReason: reason.trim() }).where(eq(events.id, id));
    if (e.status === 'PUBLISHED') await this.notify.send(await this.attendees(id), { kind: 'event_cancelled', title: `لغو شد: «${e.title}»`, body: reason.trim(), link: `/events/${id}` });
    return { ok: true };
  }

  async remove(u: AuthUser, id: string) {
    const e = await this.manageable(u, id);
    if (e.status !== 'DRAFT') throw new BadRequestException({ code: 'not_draft', message: 'برنامهٔ منتشرشده حذف نمی‌شود؛ لغوش کنید' });
    await this.db.delete(events).where(eq(events.id, id));
    return { ok: true };
  }

  private async attendees(id: string) {
    const r = await this.db.select({ userId: registrations.userId }).from(registrations).where(and(eq(registrations.eventId, id), inArray(registrations.status, [...ACTIVE])));
    return r.map((x) => x.userId);
  }

  async registrants(u: AuthUser, id: string) {
    const e = await this.manageable(u, id);
    // شمارهٔ همراه به برگزارکننده نشان داده نمی‌شود (۷.۱)؛ فقط نام، شهرستان، مسجد
    const rows = await this.db.execute<any>(sql`
      select r.user_id as "userId", r.status, r.check_in_code as "code", r.attended_at as "attendedAt", r.attendance_method as "method",
        r.late_cancel as "lateCancel", r.feedback, r.created_at as "createdAt", r.registered_by_id is not null as "byGroup",
        u.first_name || ' ' || u.last_name as name, c.name as county, m.name as mosque
      from registrations r join users u on u.id = r.user_id
      left join counties c on c.id = u.county_id left join mosques m on m.id = u.mosque_id
      where r.event_id = ${id} order by r.created_at`);
    const cs = (await this.counts([id])).get(id) ?? { registered: 0, waitlist: 0, pending: 0, attended: 0 };
    const fb = rows.rows.map((r: any) => r.feedback?.rating).filter(Boolean);
    return { event: { ...this.pub(e, cs), onlineUrl: e.onlineUrl, description: e.description, agenda: e.agenda, bring: e.bring, mapUrl: e.mapUrl, audienceProvinceId: e.audienceProvinceId, audienceCountyId: e.audienceCountyId },
      counts: cs, rating: fb.length ? +(fb.reduce((a: number, b: number) => a + b, 0) / fb.length).toFixed(1) : null, people: rows.rows };
  }

  async decide(u: AuthUser, id: string, userId: string, action: 'approve' | 'reject' | 'attend' | 'unattend') {
    const e = await this.manageable(u, id);
    const r = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, id), eq(registrations.userId, userId)) });
    if (!r) throw new NotFoundException({ code: 'no_reg', message: 'ثبت‌نام پیدا نشد' });
    if (action === 'approve') {
      const [{ n }] = (await this.db.execute<{ n: number }>(sql`select count(*)::int as n from registrations where event_id = ${id} and status = 'REGISTERED'`)).rows;
      const status = e.capacity != null && n >= e.capacity ? 'WAITLIST' : 'REGISTERED';
      await this.db.update(registrations).set({ status }).where(and(eq(registrations.eventId, id), eq(registrations.userId, userId)));
      await this.notify.send(userId, { kind: 'event_approved', title: status === 'REGISTERED' ? `ثبت‌نامتان در «${e.title}» تأیید شد` : `در فهرست انتظار «${e.title}» هستید`, link: `/events/${id}` });
    } else if (action === 'reject') {
      await this.db.update(registrations).set({ status: 'REJECTED' }).where(and(eq(registrations.eventId, id), eq(registrations.userId, userId)));
      await this.notify.send(userId, { kind: 'event_rejected', title: `درخواستتان برای «${e.title}» پذیرفته نشد`, link: `/events/${id}` });
      if (r.status === 'REGISTERED') await this.promote(e);
    } else if (action === 'attend') {
      await this.db.update(registrations).set({ attendedAt: r.attendedAt ?? new Date(), attendanceMethod: r.attendanceMethod ?? 'MANUAL' }).where(and(eq(registrations.eventId, id), eq(registrations.userId, userId)));
    } else {
      await this.db.update(registrations).set({ attendedAt: null, attendanceMethod: null }).where(and(eq(registrations.eventId, id), eq(registrations.userId, userId)));
    }
    return { ok: true };
  }

  /** ورود با کد کارت (QR یا تایپ دستی). قبول می‌کند «MH1:<eventId>:<code>» یا خود کد. */
  async checkIn(u: AuthUser, id: string, raw: string, at?: string) {
    await this.manageable(u, id);
    let code = raw.trim().toUpperCase();
    const m = /^MH1:([^:]+):([A-Z0-9]+)$/i.exec(raw.trim());
    if (m) {
      if (m[1] !== id) return { ok: false, reason: 'other_event', message: 'این کارت برای برنامهٔ دیگری است' };
      code = m[2].toUpperCase();
    }
    const r = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, id), eq(registrations.checkInCode, code)) });
    if (!r) return { ok: false, reason: 'unknown', message: 'کد پیدا نشد' };
    const p = await this.db.query.users.findFirst({ where: eq(users.id, r.userId), columns: { firstName: true, lastName: true } });
    const name = `${p?.firstName} ${p?.lastName}`;
    if (r.status !== 'REGISTERED') return { ok: false, reason: 'status', name, message: r.status === 'WAITLIST' ? 'در فهرست انتظار است' : r.status === 'PENDING' ? 'هنوز تأیید نشده' : 'ثبت‌نامش لغو شده' };
    if (r.attendedAt) return { ok: true, already: true, name, message: 'پیش‌تر وارد شده' };
    await this.db.update(registrations).set({ attendedAt: at ? new Date(at) : new Date(), attendanceMethod: 'QR' }).where(and(eq(registrations.eventId, id), eq(registrations.userId, r.userId)));
    return { ok: true, name, message: 'خوش آمدید' };
  }

  /** همگام‌سازی ورودهایی که بی‌اینترنت ثبت شده‌اند */
  async checkInBulk(u: AuthUser, id: string, items: { code: string; at?: string }[]) {
    const out = [];
    for (const it of items.slice(0, 2000)) out.push({ code: it.code, ...(await this.checkIn(u, id, it.code, it.at)) });
    return out;
  }

  async notifyRegistrants(u: AuthUser, id: string, d: { title: string; body?: string; to?: 'registered' | 'all' }) {
    const e = await this.manageable(u, id);
    const r = await this.db.select({ userId: registrations.userId }).from(registrations)
      .where(and(eq(registrations.eventId, id), inArray(registrations.status, d.to === 'all' ? [...ACTIVE] : ['REGISTERED'])));
    await this.notify.send(r.map((x) => x.userId), { kind: 'event_message', title: `${e.title}: ${d.title}`, body: d.body, link: `/events/${id}` });
    return { sent: r.length };
  }

  async csv(u: AuthUser, id: string) {
    const { people, event } = await this.registrants(u, id);
    const st: Record<string, string> = { REGISTERED: 'ثبت‌نام', WAITLIST: 'انتظار', PENDING: 'منتظر تأیید', REJECTED: 'رد شده', CANCELLED: 'انصراف' };
    const q = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['نام', 'شهرستان', 'مسجد', 'وضعیت', 'حضور', 'روش', 'انصراف دیرهنگام', 'امتیاز'].map(q).join(',')];
    for (const p of people) lines.push([p.name, p.county, p.mosque, st[p.status], p.attendedAt ? 'بله' : 'خیر', p.method, p.lateCancel ? 'بله' : '', p.feedback?.rating].map(q).join(','));
    return { name: `${String((event as any).title).slice(0, 40)}.csv`, body: '﻿' + lines.join('\r\n') };
  }

  // ───────── یادآوری‌ها (زمان‌بند) ─────────
  async sendReminders() {
    const now = Date.now();
    const soon = await this.db.select().from(events).where(and(eq(events.status, 'PUBLISHED'), gte(events.startsAt, new Date(now)), lte(events.startsAt, new Date(now + 26 * 3600_000))));
    let sent = 0;
    for (const e of soon) {
      const left = e.startsAt.getTime() - now;
      const kinds: string[] = [];
      if (left <= 24 * 3600_000 && left > 2 * 3600_000) kinds.push('DAY');
      if (e.kind === 'ONLINE' && left <= 15 * 60_000) kinds.push('SOON');
      for (const k of kinds) {
        const [ins] = await this.db.insert(eventReminders).values({ eventId: e.id, kind: k }).onConflictDoNothing().returning();
        if (!ins) continue;
        const ids = (await this.db.select({ userId: registrations.userId }).from(registrations).where(and(eq(registrations.eventId, e.id), eq(registrations.status, 'REGISTERED')))).map((r) => r.userId);
        await this.notify.send(ids, k === 'DAY'
          ? { kind: 'event_reminder', title: `فردا: «${e.title}»`, body: `${faDate(e.startsAt)}${e.location ? ' — ' + e.location : ''}${e.kind === 'IN_PERSON' ? ' — کارت ورود را همراه داشته باشید' : ''}`, link: `/events/${e.id}` }
          : { kind: 'event_reminder', title: `«${e.title}» تا ربع ساعت دیگر شروع می‌شود`, body: 'از صفحهٔ برنامه وارد کلاس شوید', link: `/events/${e.id}` });
        sent += ids.length;
      }
    }
    if (sent) this.log.log(`یادآوری برنامه → ${sent}`);
  }
}

