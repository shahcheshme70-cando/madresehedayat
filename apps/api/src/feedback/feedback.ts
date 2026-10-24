import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Injectable, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { and, count, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { dec, enc } from '../common/crypto';
import { Db, InjectDb } from '../db/db.module';
import { auditLogs, courseRatings, courses, enrollments, feedback, lessonRatings, lessons, modules, privateFiles, users } from '../db/schema';
import { Notifier } from '../notifications/notifications';

const err = (code: string, message: string) => ({ code, message });
export const KINDS = ['BUG', 'IDEA', 'CONTENT', 'PRAISE', 'OTHER'] as const;
export const STATUSES = ['NEW', 'REVIEWING', 'PLANNED', 'DONE', 'DECLINED'] as const;
const STATUS_FA: Record<string, string> = { REVIEWING: 'در حال بررسی است', PLANNED: 'در برنامهٔ کار قرار گرفت', DONE: 'انجام شد', DECLINED: 'بررسی شد و فعلاً انجام نمی‌شود' };
/** دلیل‌های آماده برای امتیاز درس */
export const LESSON_REASONS = { up: ['کاربردی بود', 'روشن بود', 'مثال خوب داشت', 'کوتاه و بس'], down: ['نامفهوم بود', 'طولانی بود', 'به کارم نمی‌آید', 'مشکل فنی داشت'] };

class FeedbackDto {
  @IsIn(KINDS) kind: (typeof KINDS)[number];
  @IsOptional() @IsInt() @Min(1) @Max(5) mood?: number;
  @IsString() @Length(3, 3000) body: string;
  @IsOptional() @IsString() @Length(0, 300) @Matches(/^\//) path?: string;
  @IsOptional() @IsObject() context?: Record<string, string>;
  @IsOptional() @IsString() @Length(0, 300) device?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+\.(png|jpg|webp)$/) imageKey?: string;
  @IsOptional() @IsBoolean() anonymous?: boolean;
}
class TriageDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @Length(0, 2000) reply?: string;
}
class LessonRatingDto {
  @IsBoolean() up: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) reasons?: string[];
  @IsOptional() @IsString() @Length(0, 1000) comment?: string;
}
class CourseRatingDto { @IsInt() @Min(1) @Max(5) stars: number; @IsOptional() @IsString() @Length(0, 2000) comment?: string; }

const CTX_KEYS = ['courseId', 'lessonId', 'eventId', 'boardId', 'campaignId', 'toolId'];

@Injectable()
export class FeedbackService {
  constructor(@InjectDb() private readonly db: Db, private readonly notify: Notifier) {}

  async create(u: AuthUser, d: FeedbackDto) {
    const [n] = await this.db.select({ n: count() }).from(feedback).where(and(eq(feedback.userId, u.id), gte(feedback.createdAt, new Date(Date.now() - 86400_000))));
    if (n.n >= 10) throw new BadRequestException(err('too_many', 'امروز ۱۰ بازخورد فرستاده‌اید؛ ممنون! فردا دوباره می‌توانید بفرستید'));
    if (d.imageKey) {
      const f = await this.db.query.privateFiles.findFirst({ where: eq(privateFiles.key, d.imageKey) });
      if (!f || f.ownerId !== u.id || f.kind !== 'FEEDBACK') throw new BadRequestException(err('bad_image', 'عکس پیدا نشد؛ دوباره بارگذاری کنید'));
    }
    const context = d.context ? Object.fromEntries(Object.entries(d.context).filter(([k, v]) => CTX_KEYS.includes(k) && typeof v === 'string' && v.length < 40)) : null;
    const [f] = await this.db.insert(feedback).values({ userId: u.id, anonymous: !!d.anonymous, kind: d.kind, mood: d.mood ?? null, body: enc(d.body.trim())!, path: d.path ?? null,
      context, device: d.kind === 'BUG' ? d.device?.slice(0, 300) ?? null : null, imageKey: d.imageKey ?? null }).returning({ id: feedback.id });
    return { id: f.id };
  }

  async mine(userId: string) {
    const rows = await this.db.select().from(feedback).where(eq(feedback.userId, userId)).orderBy(desc(feedback.createdAt)).limit(100);
    return rows.map((r) => ({ id: r.id, kind: r.kind, mood: r.mood, body: dec(r.body), path: r.path, status: r.status, reply: r.reply, repliedAt: r.repliedAt, anonymous: r.anonymous, createdAt: r.createdAt }));
  }

  // ───────── ستاد ─────────

  async list(q: { status?: string; kind?: string }) {
    const rows = await this.db.select({ f: feedback, first: users.firstName, last: users.lastName }).from(feedback).innerJoin(users, eq(users.id, feedback.userId))
      .where(and(q.status ? eq(feedback.status, q.status) : undefined, q.kind ? eq(feedback.kind, q.kind) : undefined)).orderBy(desc(feedback.createdAt)).limit(300);
    const ctxIds = rows.flatMap((r) => [(r.f.context as any)?.courseId, (r.f.context as any)?.lessonId]).filter(Boolean);
    const cs = ctxIds.length ? await this.db.select({ id: courses.id, title: courses.title }).from(courses).where(inArray(courses.id, ctxIds)) : [];
    const ls = ctxIds.length ? await this.db.select({ id: lessons.id, title: lessons.title }).from(lessons).where(inArray(lessons.id, ctxIds)) : [];
    return rows.map(({ f, first, last }) => ({
      id: f.id, kind: f.kind, mood: f.mood, body: dec(f.body), path: f.path, device: f.device, imageKey: f.imageKey, status: f.status, tags: f.tags, reply: f.reply, repliedAt: f.repliedAt, createdAt: f.createdAt,
      // بی‌نام: نام به کارکنان نشان داده نمی‌شود
      from: f.anonymous ? null : `${first} ${last}`,
      course: cs.find((c) => c.id === (f.context as any)?.courseId)?.title ?? null, lesson: ls.find((l) => l.id === (f.context as any)?.lessonId)?.title ?? null,
    }));
  }

  async triage(u: AuthUser, id: string, d: TriageDto) {
    const f = await this.db.query.feedback.findFirst({ where: eq(feedback.id, id) });
    if (!f) throw new NotFoundException(err('no_feedback', 'این بازخورد پیدا نشد'));
    const set: Partial<typeof feedback.$inferInsert> = {};
    if (d.status) set.status = d.status;
    if (d.tags) set.tags = [...new Set(d.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 8);
    const replying = d.reply !== undefined && d.reply.trim() && d.reply.trim() !== f.reply;
    if (replying) { set.reply = d.reply!.trim(); set.repliedById = u.id; set.repliedAt = new Date(); if (!d.status && f.status === 'NEW') set.status = 'REVIEWING'; }
    if (!Object.keys(set).length) return { ok: true };
    await this.db.update(feedback).set(set).where(eq(feedback.id, id));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'feedback.triage', target: id, meta: { status: set.status, replied: !!replying } });
    // حلقه را می‌بندیم: فرستنده می‌فهمد بازخوردش چه شد
    const statusChanged = set.status && set.status !== f.status && set.status !== 'NEW';
    if (replying || statusChanged) {
      await this.notify.send(f.userId, { kind: 'feedback', title: replying ? 'به بازخوردتان پاسخ داده شد' : `بازخوردتان ${STATUS_FA[set.status!]}`,
        body: replying ? set.reply!.slice(0, 140) : undefined, link: '/help#feedback' });
    }
    return { ok: true };
  }

  async stats() {
    const since = new Date(Date.now() - 30 * 86400_000);
    const byKind = await this.db.select({ k: feedback.kind, n: count() }).from(feedback).where(gte(feedback.createdAt, since)).groupBy(feedback.kind);
    const byStatus = await this.db.select({ s: feedback.status, n: count() }).from(feedback).groupBy(feedback.status);
    const mood = await this.db.execute<{ avg: number | null; n: number }>(sql`select round(avg(mood)::numeric, 1)::float as avg, count(mood)::int as n from feedback where created_at >= ${since}`);
    const pages = await this.db.execute<{ path: string; n: number; bugs: number }>(sql`
      select path, count(*)::int as n, count(*) filter (where kind = 'BUG')::int as bugs from feedback where created_at >= ${since} and path is not null group by path order by n desc limit 8`);
    return { byKind: Object.fromEntries(byKind.map((x) => [x.k, x.n])), byStatus: Object.fromEntries(byStatus.map((x) => [x.s, x.n])), mood: mood.rows[0], pages: pages.rows };
  }

  // ───────── امتیاز درس و دوره ─────────

  async rateLesson(u: AuthUser, lessonId: string, d: LessonRatingDto) {
    const l = await this.db.query.lessons.findFirst({ where: eq(lessons.id, lessonId), columns: { id: true, moduleId: true } });
    if (!l) throw new NotFoundException(err('no_lesson', 'این درس پیدا نشد'));
    const m = await this.db.query.modules.findFirst({ where: eq(modules.id, l.moduleId), columns: { courseId: true } });
    const e = m ? await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, u.id), eq(enrollments.courseId, m.courseId)) }) : null;
    if (!e) throw new ForbiddenException(err('not_enrolled', 'برای امتیاز دادن اول در دوره ثبت‌نام کنید'));
    const allowed = d.up ? LESSON_REASONS.up : LESSON_REASONS.down;
    const reasons = (d.reasons ?? []).filter((r) => allowed.includes(r));
    const v = { up: d.up, reasons, comment: d.comment?.trim() ? enc(d.comment.trim()) : null };
    await this.db.insert(lessonRatings).values({ userId: u.id, lessonId, ...v }).onConflictDoUpdate({ target: [lessonRatings.userId, lessonRatings.lessonId], set: v });
    return { ok: true };
  }
  async myLessonRating(userId: string, lessonId: string) {
    const r = await this.db.query.lessonRatings.findFirst({ where: and(eq(lessonRatings.userId, userId), eq(lessonRatings.lessonId, lessonId)) });
    return { rating: r ? { up: r.up, reasons: r.reasons, comment: dec(r.comment) } : null, reasons: LESSON_REASONS };
  }

  async rateCourse(u: AuthUser, key: string, d: CourseRatingDto) {
    const c = await this.db.query.courses.findFirst({ where: or(eq(courses.slug, key), eq(courses.id, key)), columns: { id: true } });
    if (!c) throw new NotFoundException(err('no_course', 'این دوره پیدا نشد'));
    const e = await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, u.id), eq(enrollments.courseId, c.id)) });
    if (!e) throw new ForbiddenException(err('not_enrolled', 'برای امتیاز دادن اول در دوره ثبت‌نام کنید'));
    const [done] = await this.db.select({ n: count() }).from(sql`lesson_progress lp join lessons l on l.id = lp.lesson_id join modules m on m.id = l.module_id`)
      .where(sql`lp.user_id = ${u.id} and m.course_id = ${c.id} and lp.completed_at is not null`);
    if (!e.completedAt && done.n < 3) throw new BadRequestException(err('too_early', 'بعد از گذراندن دست‌کم سه درس می‌توانید به دوره امتیاز بدهید'));
    const v = { stars: d.stars, comment: d.comment?.trim() ? enc(d.comment.trim()) : null };
    await this.db.insert(courseRatings).values({ userId: u.id, courseId: c.id, ...v }).onConflictDoUpdate({ target: [courseRatings.userId, courseRatings.courseId], set: v });
    return { ok: true };
  }

  /** امتیاز عمومی دوره: فقط وقتی دست‌کم ۵ نفر امتیاز داده‌اند (تا امتیاز یکی‌دو نفر گمراه نکند) */
  async courseScore(courseId: string, userId?: string) {
    const r = await this.db.execute<{ avg: number | null; n: number }>(sql`select round(avg(stars)::numeric, 1)::float as avg, count(*)::int as n from course_ratings where course_id = ${courseId}`);
    const mine = userId ? await this.db.query.courseRatings.findFirst({ where: and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId)) }) : null;
    const { avg, n } = r.rows[0];
    return { avg: n >= 5 ? avg : null, count: n, mine: mine ? { stars: mine.stars, comment: dec(mine.comment) } : null };
  }

  /** کیفیت محتوا برای ستاد: بی‌نام */
  async contentQuality() {
    const cs = await this.db.execute<{ id: string; title: string; avg: number | null; n: number; learners: number }>(sql`
      select c.id, c.title, round(avg(r.stars)::numeric, 1)::float as avg, count(r.stars)::int as n,
        (select count(*)::int from enrollments e where e.course_id = c.id) as learners
      from courses c left join course_ratings r on r.course_id = c.id where c.status = 'PUBLISHED' group by c.id, c.title order by avg nulls last, c.title`);
    const ls = await this.db.execute<{ id: string; title: string; course: string; up: number; down: number }>(sql`
      select l.id, l.title, c.title as course, count(*) filter (where r.up)::int as up, count(*) filter (where not r.up)::int as down
      from lesson_ratings r join lessons l on l.id = r.lesson_id join modules m on m.id = l.module_id join courses c on c.id = m.course_id
      group by l.id, l.title, c.title order by (count(*) filter (where not r.up))::float / count(*) desc, count(*) desc limit 30`);
    const reasons = await this.db.execute<{ lesson_id: string; reason: string; n: number }>(sql`
      select lesson_id, unnest(reasons) as reason, count(*)::int as n from lesson_ratings group by 1, 2`);
    const comments = await this.db.execute<{ kind: string; title: string; comment: string; score: number; at: string }>(sql`
      (select 'course' as kind, c.title, r.comment, r.stars as score, r.updated_at as at from course_ratings r join courses c on c.id = r.course_id where r.comment is not null)
      union all (select 'lesson', l.title, r.comment, case when r.up then 1 else 0 end, r.updated_at from lesson_ratings r join lessons l on l.id = r.lesson_id where r.comment is not null)
      order by at desc limit 40`);
    return {
      courses: cs.rows,
      lessons: ls.rows.map((l) => ({ ...l, reasons: reasons.rows.filter((r) => r.lesson_id === l.id).sort((a, b) => b.n - a.n).map((r) => ({ reason: r.reason, n: r.n })) })),
      comments: comments.rows.map((c) => ({ ...c, comment: dec(c.comment) })),
    };
  }

  async newCount() {
    const [r] = await this.db.select({ n: count() }).from(feedback).where(eq(feedback.status, 'NEW'));
    return r.n;
  }
}

@Controller()
export class FeedbackController {
  constructor(private readonly f: FeedbackService) {}
  @Post('feedback') @HttpCode(200) create(@CurrentUser() u: AuthUser, @Body() d: FeedbackDto) { return this.f.create(u, d); }
  @Get('feedback/mine') mine(@CurrentUser() u: AuthUser) { return this.f.mine(u.id); }
  @Get('lessons/:id/rating') lessonRating(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.f.myLessonRating(u.id, id); }
  @Post('lessons/:id/rating') @HttpCode(200) rateLesson(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: LessonRatingDto) { return this.f.rateLesson(u, id, d); }
  @Post('courses/:key/rating') @HttpCode(200) rateCourse(@CurrentUser() u: AuthUser, @Param('key') key: string, @Body() d: CourseRatingDto) { return this.f.rateCourse(u, key, d); }

  @Get('admin/feedback') @Roles('HQ_ADMIN', 'HQ_OPERATOR') list(@Query('status') status?: string, @Query('kind') kind?: string) { return this.f.list({ status, kind }); }
  @Get('admin/feedback/stats') @Roles('HQ_ADMIN', 'HQ_OPERATOR') stats() { return this.f.stats(); }
  @Patch('admin/feedback/:id') @Roles('HQ_ADMIN', 'HQ_OPERATOR') triage(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: TriageDto) { return this.f.triage(u, id, d); }
  @Get('admin/content-quality') @Roles('HQ_ADMIN', 'HQ_OPERATOR') quality() { return this.f.contentQuality(); }
}
