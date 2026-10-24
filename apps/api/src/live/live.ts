import { BadRequestException, Controller, ForbiddenException, Get, HttpCode, Injectable, Logger, NotFoundException, Param, Post } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { createHash, createHmac } from 'node:crypto';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { config } from '../config';
import { Db, InjectDb } from '../db/db.module';
import { enrollments, events, lessonProgress, lessons, liveAttendance, liveRecordings, modules, registrations, users } from '../db/schema';
import { LearningService } from '../learning/learning.service';
import { Notifier } from '../notifications/notifications';

const err = (code: string, message: string) => ({ code, message });
const MIN = 60_000;
/** حضور یعنی دست‌کم نیمی از زمان کلاس (تصمیم ۱۱.۸) */
export const ATTEND_RATIO = 0.5;
const RECORD_KEEP_DAYS = 182; // ۶ ماه (تصمیم ۱۱.۷)

export const bbbEnabled = () => !!config.bbbUrl && !!config.bbbSecret;

/**
 * کلاس زنده روی BigBlueButton خود بنیاد (تصمیم ۱۱.۳).
 * صدا و تصویر روی سرور کلاس می‌ماند؛ ما فقط کلاس را می‌سازیم، پیوند ورود امضاشده می‌دهیم،
 * هر دقیقه فهرست حاضران را می‌خوانیم تا «حضور ≥ نیمی از زمان» حساب شود، و ضبط‌ها را برای ثبت‌نامی‌ها نگه می‌داریم.
 */
@Injectable()
export class BbbClient {
  private readonly log = new Logger('BBB');

  private sign(call: string, query: string) {
    return createHash(config.bbbChecksum).update(call + query + config.bbbSecret).digest('hex');
  }
  url(call: string, params: Record<string, string | number | boolean | undefined>) {
    const q = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return `${config.bbbUrl}/${call}?${q}${q ? '&' : ''}checksum=${this.sign(call, q)}`;
  }
  /** رمزهای کلاس از شناسهٔ برنامه ساخته می‌شوند؛ جایی ذخیره نمی‌شوند */
  pw(eventId: string, role: 'a' | 'm') { return createHmac('sha256', config.bbbSecret).update(role + eventId).digest('hex').slice(0, 16); }

  async call(call: string, params: Record<string, string | number | boolean | undefined>) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10_000);
    try {
      const r = await fetch(this.url(call, params), { signal: ac.signal });
      const xml = await r.text();
      const code = /<returncode>(\w+)<\/returncode>/.exec(xml)?.[1];
      if (code !== 'SUCCESS') {
        const key = /<messageKey>([^<]*)<\/messageKey>/.exec(xml)?.[1];
        if (key === 'notFound' || key === 'noRecordings') return null;
        throw new Error(`${call}: ${key ?? r.status} ${/<message>([^<]*)<\/message>/.exec(xml)?.[1] ?? ''}`);
      }
      return xml;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error(`${call}: سرور کلاس پاسخ نداد`);
      throw e;
    } finally { clearTimeout(t); }
  }

  async create(e: typeof events.$inferSelect) {
    const minutes = Math.ceil((e.endsAt.getTime() - e.startsAt.getTime()) / MIN) + 30;
    const welcome = e.record
      ? 'خوش آمدید. این کلاس ضبط می‌شود؛ ضبط فقط برای ثبت‌نامی‌ها و تا ۶ ماه نگه داشته می‌شود.'
      : 'خوش آمدید. این کلاس ضبط نمی‌شود.';
    return this.call('create', {
      name: e.title, meetingID: e.id, attendeePW: this.pw(e.id, 'a'), moderatorPW: this.pw(e.id, 'm'),
      record: e.record, autoStartRecording: false, allowStartStopRecording: e.record, duration: minutes,
      welcome, logoutURL: `${config.publicUrl.replace(/\/$/, '')}/events/${e.id}`,
      'meta_madrese-event': e.id,
    });
  }

  joinUrl(e: typeof events.$inferSelect, u: { id: string; name: string }, moderator: boolean) {
    return this.url('join', { fullName: u.name, meetingID: e.id, password: this.pw(e.id, moderator ? 'm' : 'a'), userID: u.id, redirect: true });
  }

  /** شناسهٔ کاربرانی که الان در کلاس‌اند (userID همان شناسهٔ مدرسه است) */
  async attendees(eventId: string): Promise<string[] | null> {
    const xml = await this.call('getMeetingInfo', { meetingID: eventId });
    if (!xml) return null;
    return [...xml.matchAll(/<userID>([^<]+)<\/userID>/g)].map((m) => m[1]);
  }

  async recordings(eventId: string) {
    const xml = await this.call('getRecordings', { meetingID: eventId, state: 'published' });
    if (!xml) return [];
    return [...xml.matchAll(/<recording>([\s\S]*?)<\/recording>/g)].map((m) => {
      const r = m[1];
      const pick = (tag: string) => new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(r)?.[1];
      return { recordId: pick('recordID')!, url: (/<url>([^<]*)<\/url>/.exec(r)?.[1] ?? '').trim(), start: Number(pick('startTime') ?? 0), end: Number(pick('endTime') ?? 0) };
    }).filter((r) => r.recordId && r.url);
  }

  deleteRecording(recordId: string) { return this.call('deleteRecordings', { recordID: recordId }); }
}

@Injectable()
export class LiveService {
  private readonly log = new Logger('Live');
  private lastPoll = new Map<string, number>();
  constructor(@InjectDb() private readonly db: Db, private readonly bbb: BbbClient, private readonly learning: LearningService, private readonly notify: Notifier) {}

  private isHost(u: AuthUser, e: typeof events.$inferSelect) {
    return e.createdById === u.id || u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');
  }

  /** ورود به کلاس: میزبان همیشه، ثبت‌نامی از ۱۵ دقیقه پیش از شروع تا پایان */
  async join(u: AuthUser, e: typeof events.$inferSelect) {
    if (!bbbEnabled()) throw new BadRequestException(err('bbb_off', 'سرور کلاس زنده هنوز راه نیفتاده است؛ برگزارکننده پیوند بیرونی بگذارد'));
    const host = this.isHost(u, e);
    if (!host) {
      const r = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, e.id), eq(registrations.userId, u.id)) });
      if (r?.status !== 'REGISTERED') throw new ForbiddenException(err('not_registered', 'اول در این برنامه ثبت‌نام کنید'));
      if (Date.now() < e.startsAt.getTime() - 15 * MIN) throw new BadRequestException(err('early', 'کلاس از ۱۵ دقیقه پیش از شروع باز می‌شود'));
    }
    if (Date.now() > e.endsAt.getTime() + 30 * MIN) throw new BadRequestException(err('ended', 'زمان این کلاس تمام شده است؛ اگر ضبط شده باشد، از صفحهٔ برنامه ببینید'));
    try { await this.bbb.create(e); } catch (x: any) { this.log.error(x?.message); throw new BadRequestException(err('bbb_error', 'سرور کلاس زنده الان در دسترس نیست؛ چند دقیقهٔ دیگر دوباره امتحان کنید')); }
    const me = await this.db.query.users.findFirst({ where: eq(users.id, u.id), columns: { firstName: true, lastName: true } });
    return { url: this.bbb.joinUrl(e, { id: u.id, name: [me?.firstName, me?.lastName].filter(Boolean).join(' ') || 'کاربر مدرسه' }, host), live: true };
  }

  /** هر دقیقه: حاضران کلاس‌های در جریان (با فاصلهٔ واقعی میان دو خواندن، نه فرض یک دقیقه) */
  async poll() {
    if (!bbbEnabled()) return;
    const now = new Date();
    const rows = await this.db.select().from(events).where(and(eq(events.useBbb, true), eq(events.status, 'PUBLISHED'),
      lte(events.startsAt, new Date(now.getTime() + 15 * MIN)), gt(events.endsAt, new Date(now.getTime() - 30 * MIN))));
    for (const e of rows) {
      let ids: string[] | null;
      try { ids = await this.bbb.attendees(e.id); } catch (x: any) { this.log.warn(x?.message); continue; }
      const prev = this.lastPoll.get(e.id); this.lastPoll.set(e.id, now.getTime());
      if (!ids?.length) continue;
      // فقط زمان داخل بازهٔ رسمی کلاس حساب می‌شود
      const from = Math.max(prev ?? now.getTime() - MIN, e.startsAt.getTime()), to = Math.min(now.getTime(), e.endsAt.getTime());
      const secs = Math.max(0, Math.min(Math.round((to - from) / 1000), 120));
      const known = await this.db.select({ id: users.id }).from(users).where(inArray(users.id, [...new Set(ids)]));
      for (const { id } of known) {
        await this.db.insert(liveAttendance).values({ eventId: e.id, userId: id, seconds: secs, lastSeenAt: now })
          .onConflictDoUpdate({ target: [liveAttendance.eventId, liveAttendance.userId], set: { seconds: sql`${liveAttendance.seconds} + ${secs}`, lastSeenAt: now } });
      }
    }
  }

  /** پس از پایان کلاس: حضور ≥۵۰٪، تمام شدن درس «جلسهٔ زنده»، و برداشتن ضبط‌ها */
  async finalize() {
    if (!bbbEnabled()) return;
    const now = Date.now();
    const done = await this.db.select().from(events).where(and(eq(events.useBbb, true), isNull(events.liveFinalizedAt), lt(events.endsAt, new Date(now - 30 * MIN)), eq(events.status, 'PUBLISHED')));
    for (const e of done) {
      const need = (e.endsAt.getTime() - e.startsAt.getTime()) / 1000 * ATTEND_RATIO;
      const att = await this.db.select().from(liveAttendance).where(eq(liveAttendance.eventId, e.id));
      const present = att.filter((a) => a.seconds >= need).map((a) => a.userId);
      if (present.length) {
        await this.db.update(registrations).set({ attendedAt: sql`coalesce(${registrations.attendedAt}, now())`, attendanceMethod: 'ONLINE' })
          .where(and(eq(registrations.eventId, e.id), inArray(registrations.userId, present), eq(registrations.status, 'REGISTERED')));
        for (const uid of present) await this.completeLiveLessons(uid, e.id);
      }
      await this.db.update(events).set({ liveFinalizedAt: new Date() }).where(eq(events.id, e.id));
      this.log.log(`حضور «${e.title}»: ${present.length} از ${att.length} نفر`);
    }
    // ضبط‌ها: تا دو روز پس از کلاس دنبالشان می‌گردیم (پردازش ضبط در سرور کلاس زمان می‌برد)
    const recent = await this.db.select().from(events).where(and(eq(events.useBbb, true), eq(events.record, true), lt(events.endsAt, new Date(now)), gt(events.endsAt, new Date(now - 2 * 86400_000))));
    for (const e of recent) {
      try {
        const rs = await this.bbb.recordings(e.id);
        for (const r of rs) {
          const ins = await this.db.insert(liveRecordings).values({ recordId: r.recordId, eventId: e.id, url: r.url, durationSec: r.end > r.start ? Math.round((r.end - r.start) / 1000) : null,
            startedAt: r.start ? new Date(r.start) : null, expiresAt: new Date(e.endsAt.getTime() + RECORD_KEEP_DAYS * 86400_000) }).onConflictDoNothing().returning({ id: liveRecordings.recordId });
          if (ins.length) {
            const regs = await this.db.select({ id: registrations.userId }).from(registrations).where(and(eq(registrations.eventId, e.id), eq(registrations.status, 'REGISTERED')));
            await this.notify.send(regs.map((x) => x.id), { kind: 'live_recording', title: `ضبط «${e.title}» آماده است`, body: 'تا ۶ ماه از صفحهٔ برنامه می‌توانید ببینید.', link: `/events/${e.id}` });
          }
        }
      } catch (x: any) { this.log.warn(x?.message); }
    }
    // پاک کردن ضبط‌های بیش از ۶ ماه
    const old = await this.db.select().from(liveRecordings).where(and(isNull(liveRecordings.deletedAt), lt(liveRecordings.expiresAt, new Date())));
    for (const r of old) {
      try { await this.bbb.deleteRecording(r.recordId); await this.db.update(liveRecordings).set({ deletedAt: new Date() }).where(eq(liveRecordings.recordId, r.recordId)); }
      catch (x: any) { this.log.warn(x?.message); }
    }
  }

  /** درس‌های «جلسهٔ زنده» که به این برنامه وصل‌اند، برای کسی که در دوره‌شان ثبت‌نام کرده تمام می‌شوند */
  async completeLiveLessons(userId: string, eventId: string) {
    const ls = await this.db.select({ id: lessons.id, courseId: modules.courseId }).from(lessons).innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(eq(lessons.type, 'LIVE'), sql`${lessons.content}->>'eventId' = ${eventId}`));
    for (const l of ls) {
      const enr = await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, l.courseId)) });
      if (!enr) continue;
      await this.db.insert(lessonProgress).values({ userId, lessonId: l.id, completedAt: new Date() })
        .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: { completedAt: sql`coalesce(${lessonProgress.completedAt}, now())` } });
      await this.learning.checkCompletion(userId, l.courseId);
    }
  }

  /** چه کسی ضبط را می‌بیند: ثبت‌نامی‌ها، برگزارکننده و ستاد، و کسانی که درس «جلسهٔ زنده»ِ این برنامه را دارند */
  private async canSeeRecording(u: AuthUser, e: typeof events.$inferSelect) {
    if (this.isHost(u, e)) return true;
    const r = await this.db.query.registrations.findFirst({ where: and(eq(registrations.eventId, e.id), eq(registrations.userId, u.id)) });
    if (r && ['REGISTERED'].includes(r.status)) return true;
    const viaLesson = await this.db.execute(sql`select 1 from lessons l join modules m on m.id = l.module_id join enrollments en on en.course_id = m.course_id
      where l.type = 'LIVE' and l.content->>'eventId' = ${e.id} and en.user_id = ${u.id} limit 1`);
    return viaLesson.rows.length > 0;
  }

  async liveInfo(u: AuthUser, eventId: string) {
    const e = await this.db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!e) throw new NotFoundException(err('no_event', 'برنامه پیدا نشد'));
    const mine = await this.db.query.liveAttendance.findFirst({ where: and(eq(liveAttendance.eventId, eventId), eq(liveAttendance.userId, u.id)) });
    const total = (e.endsAt.getTime() - e.startsAt.getTime()) / 1000;
    const canSee = await this.canSeeRecording(u, e);
    const recs = canSee ? await this.db.select().from(liveRecordings).where(and(eq(liveRecordings.eventId, eventId), isNull(liveRecordings.deletedAt))) : [];
    return {
      useBbb: e.useBbb, record: e.record, available: bbbEnabled(), finalized: !!e.liveFinalizedAt,
      attendance: mine ? { minutes: Math.round(mine.seconds / 60), needed: Math.ceil((total * ATTEND_RATIO) / 60), total: Math.round(total / 60) } : null,
      recordings: recs.map((r) => ({ id: r.recordId, durationSec: r.durationSec, startedAt: r.startedAt, expiresAt: r.expiresAt })),
      canSeeRecordings: canSee,
    };
  }

  async openRecording(u: AuthUser, eventId: string, recordId: string) {
    const e = await this.db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!e) throw new NotFoundException(err('no_event', 'برنامه پیدا نشد'));
    if (!(await this.canSeeRecording(u, e))) throw new ForbiddenException(err('forbidden', 'ضبط این کلاس فقط برای ثبت‌نامی‌هاست'));
    const r = await this.db.query.liveRecordings.findFirst({ where: and(eq(liveRecordings.recordId, recordId), eq(liveRecordings.eventId, eventId)) });
    if (!r || r.deletedAt) throw new NotFoundException(err('no_recording', 'این ضبط دیگر نگه داشته نمی‌شود (بیش از ۶ ماه)'));
    // دیدن ضبط = تمام شدن درس «جلسهٔ زنده» برای کسی که به کلاس نرسید (تصمیم ۱۱.۹)
    await this.completeLiveLessons(u.id, eventId);
    return { url: r.url };
  }

  /** دقیقه‌های حضور برای فهرست برگزارکننده */
  async attendanceMap(eventId: string) {
    const rows = await this.db.select().from(liveAttendance).where(eq(liveAttendance.eventId, eventId));
    return new Map(rows.map((r) => [r.userId, Math.round(r.seconds / 60)]));
  }
}

@Controller()
export class LiveController {
  constructor(private readonly live: LiveService) {}
  @Get('events/:id/live') info(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.live.liveInfo(u, id); }
  /** ستاد: همگام‌سازی همین حالا (بی‌منتظر زمان‌بند)، مثلاً پس از پایان یک کلاس مهم */
  @Post('admin/live/sync') @Roles('HQ_ADMIN') @HttpCode(200) async sync() { await this.live.poll(); await this.live.finalize(); return { ok: true, available: bbbEnabled() }; }
  @Post('events/:id/recordings/:rid') @HttpCode(200) open(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('rid') rid: string) { return this.live.openRecording(u, id, rid); }
}
