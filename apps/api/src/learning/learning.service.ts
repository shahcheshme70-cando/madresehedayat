import { isUnique } from '../common/errors';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { Db, InjectDb } from '../db/db.module';
import { Business } from '../business/business';
import { FeedbackService } from '../feedback/feedback';
import { decJson, encJson } from '../common/crypto';
import {
  accessGrants, certificates, sponsors, coreMemberships, cores, courseDependencies, courses, enrollments, lessonProgress,
  lessons, modules, networkMembers, pathAttempts, paths, pathItems, quizAttempts, roleGrants, users,
} from '../db/schema';
import { gradeQuiz, publicContent, QuizContent } from './lesson-content';

const RETRY_FREE = 2; // دو تلاش اول بی‌فاصله؛ از تلاش سوم ۲۴ ساعت فاصله
const RETRY_WAIT_MS = 24 * 3600_000;
const CODE_ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

type CourseRow = typeof courses.$inferSelect;

@Injectable()
export class LearningService {
  constructor(@InjectDb() private readonly db: Db, private readonly business: Business, private readonly feedback: FeedbackService) {}

  // ───────── دسترسی ─────────

  /** شبکه‌هایی که کاربر از راه هسته یا نقش به آن‌ها وصل است (برای اشتراک سازمانی) */
  private async networksOf(userId: string) {
    const viaCores = await this.db.select({ id: cores.networkId }).from(coreMemberships)
      .innerJoin(cores, eq(cores.id, coreMemberships.coreId)).where(eq(coreMemberships.userId, userId));
    const viaRoles = await this.db.select({ id: roleGrants.networkId }).from(roleGrants).where(eq(roleGrants.userId, userId));
    const viaMembers = await this.db.select({ id: networkMembers.networkId }).from(networkMembers).where(and(eq(networkMembers.userId, userId), isNotNull(networkMembers.acceptedAt)));
    return [...new Set([...viaCores, ...viaRoles, ...viaMembers].map((r) => r.id).filter(Boolean) as string[])];
  }

  /** دوره‌های محدودی که این کاربر دسترسی ویژه به آن‌ها دارد */
  async grantedCourseIds(userId?: string) {
    if (!userId) return new Set<string>();
    const nets = await this.networksOf(userId);
    const now = new Date();
    const rows = await this.db.select({ courseId: accessGrants.courseId }).from(accessGrants).where(and(
      or(eq(accessGrants.userId, userId), nets.length ? inArray(accessGrants.networkId, nets) : sql`false`),
      or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now)),
    ));
    // دوره‌های ویژه‌ای که اشتراک فعال سازمان‌های کاربر باز کرده (مدل کسب‌وکار)
    return new Set([...rows.map((r) => r.courseId), ...(await this.business.subscribedCourseIds(userId))]);
  }

  canSee(c: CourseRow, granted: Set<string>) {
    return c.status === 'PUBLISHED' && (!c.isRestricted || granted.has(c.id));
  }

  // ───────── فهرست‌ها ─────────

  async catalog(userId?: string) {
    const granted = await this.grantedCourseIds(userId);
    const all = await this.db.select().from(courses).where(eq(courses.status, 'PUBLISHED')).orderBy(asc(courses.title));
    const visible = all.filter((c) => this.canSee(c, granted));
    const stats = await this.courseStats(visible.map((c) => c.id));
    const mine = userId ? await this.myStates(userId) : new Map();
    return visible.map((c) => ({ ...this.courseCard(c), ...stats.get(c.id), me: mine.get(c.id) ?? null }));
  }

  async paths(userId?: string) {
    const granted = await this.grantedCourseIds(userId);
    const ps = await this.db.select().from(paths).where(eq(paths.published, true)).orderBy(asc(paths.title));
    const items = await this.db.select({ pathId: pathItems.pathId, order: pathItems.order, course: courses })
      .from(pathItems).innerJoin(courses, eq(courses.id, pathItems.courseId)).orderBy(asc(pathItems.order));
    const mine = userId ? await this.myStates(userId) : new Map();
    return ps.map((p) => {
      const cs = items.filter((i) => i.pathId === p.id && this.canSee(i.course, granted)).map((i) => i.course);
      const done = cs.filter((c) => mine.get(c.id)?.completedAt).length;
      return { id: p.id, slug: p.slug, title: p.title, description: p.description, icon: p.icon, color: p.color,
        courseCount: cs.length, completedCount: done, hasExam: !!(p.quiz as any)?.questions?.length, courses: cs.map((c) => ({ ...this.courseCard(c), me: mine.get(c.id) ?? null })) };
    }).filter((p) => p.courseCount > 0);
  }

  private courseCard(c: CourseRow) {
    return { id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle, level: c.level, instructor: c.instructor, color: c.color, icon: c.icon, hasCertificate: c.hasCertificate };
  }

  private async courseStats(ids: string[]) {
    const m = new Map<string, { lessonCount: number; durationSec: number }>();
    if (!ids.length) return m;
    const rows = await this.db.select({ courseId: modules.courseId, n: sql<number>`count(${lessons.id})::int`, d: sql<number>`coalesce(sum(${lessons.durationSec}),0)::int` })
      .from(lessons).innerJoin(modules, eq(modules.id, lessons.moduleId)).where(inArray(modules.courseId, ids)).groupBy(modules.courseId);
    for (const r of rows) m.set(r.courseId, { lessonCount: r.n, durationSec: r.d });
    return m;
  }

  /** وضعیت من در هر دوره: درصد، تکمیل، آخرین درس */
  private async myStates(userId: string) {
    const ens = await this.db.select().from(enrollments).where(eq(enrollments.userId, userId));
    const m = new Map<string, { enrolledAt: Date; completedAt: Date | null; archived: boolean; percent: number; lastLessonId: string | null }>();
    if (!ens.length) return m;
    const ids = ens.map((e) => e.courseId);
    const req = await this.db.select({ courseId: modules.courseId, lessonId: lessons.id }).from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId)).where(and(inArray(modules.courseId, ids), eq(lessons.required, true)));
    const done = await this.db.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), sql`${lessonProgress.completedAt} is not null`));
    const doneSet = new Set(done.map((d) => d.lessonId));
    for (const e of ens) {
      const ls = req.filter((r) => r.courseId === e.courseId);
      const pct = ls.length ? Math.round((ls.filter((l) => doneSet.has(l.lessonId)).length / ls.length) * 100) : 0;
      m.set(e.courseId, { enrolledAt: e.enrolledAt, completedAt: e.completedAt, archived: !!e.archivedAt, percent: e.completedAt ? 100 : pct, lastLessonId: e.lastLessonId });
    }
    return m;
  }

  // ───────── یک دوره ─────────

  private async courseBySlugOrId(key: string) {
    const c = await this.db.query.courses.findFirst({ where: or(eq(courses.slug, key), eq(courses.id, key)) });
    if (!c) throw new NotFoundException({ code: 'no_course', message: 'این دوره پیدا نشد' });
    return c;
  }

  /** پیش‌نیازهای کامل‌نشده و هم‌نیازها */
  private async dependencyState(courseId: string, userId?: string) {
    const deps = await this.db.select({ kind: courseDependencies.kind, c: courses }).from(courseDependencies)
      .innerJoin(courses, eq(courses.id, courseDependencies.requiresId)).where(eq(courseDependencies.courseId, courseId));
    const doneIds = userId ? new Set((await this.db.select({ id: enrollments.courseId }).from(enrollments)
      .where(and(eq(enrollments.userId, userId), sql`${enrollments.completedAt} is not null`))).map((r) => r.id)) : new Set<string>();
    return deps.map((d) => ({ kind: d.kind, course: this.courseCard(d.c), done: doneIds.has(d.c.id) }));
  }

  async courseDetail(key: string, userId?: string) {
    const c = await this.courseBySlugOrId(key);
    const granted = await this.grantedCourseIds(userId);
    if (!this.canSee(c, granted)) {
      if (c.status === 'PUBLISHED' && c.isRestricted) {
        const enr = userId ? await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, c.id)) }) : undefined;
        if (enr) throw new ForbiddenException({ code: 'subscription_ended', message: 'دسترسی سازمان شما به این دوره تمام شده است. پیشرفت و گواهی‌تان محفوظ است و با تمدید اشتراک برمی‌گردد' });
        throw new ForbiddenException({ code: 'restricted', message: 'این دوره ویژهٔ اعضای سازمان‌های مشترک است' });
      }
      throw new NotFoundException({ code: 'no_course', message: 'این دوره پیدا نشد' });
    }
    const mods = await this.db.query.modules.findMany({
      where: eq(modules.courseId, c.id), orderBy: asc(modules.order),
      with: { lessons: { orderBy: asc(lessons.order), columns: { id: true, title: true, type: true, durationSec: true, required: true, isFinalQuiz: true, order: true } } },
    });
    const lessonIds = mods.flatMap((m) => m.lessons.map((l) => l.id));
    const prog = userId && lessonIds.length ? await this.db.select().from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds))) : [];
    const best = userId && lessonIds.length ? await this.db.select({ lessonId: quizAttempts.lessonId, best: sql<number>`max(${quizAttempts.score})::int` })
      .from(quizAttempts).where(and(eq(quizAttempts.userId, userId), inArray(quizAttempts.lessonId, lessonIds))).groupBy(quizAttempts.lessonId) : [];
    const deps = await this.dependencyState(c.id, userId);
    const enr = userId ? await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, c.id)) }) : undefined;
    const cert = userId ? await this.db.query.certificates.findFirst({ where: and(eq(certificates.userId, userId), eq(certificates.courseId, c.id), isNull(certificates.revokedAt)) }) : undefined;
    const reqLessons = mods.flatMap((m) => m.lessons).filter((l) => l.required);
    const doneSet = new Set(prog.filter((p) => p.completedAt).map((p) => p.lessonId));
    return {
      ...this.courseCard(c), about: c.about, outcomes: c.outcomes, passScore: c.passScore, missionRule: c.missionRule,
      rating: await this.feedback.courseScore(c.id, userId),
      sponsor: c.sponsorId ? (await this.db.query.sponsors.findFirst({ where: eq(sponsors.id, c.sponsorId), columns: { name: true } }))?.name ?? null : null,
      dependencies: deps,
      locked: deps.some((d) => d.kind === 'PREREQUISITE' && !d.done),
      modules: mods.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({
        ...l, done: doneSet.has(l.id), best: best.find((b) => b.lessonId === l.id)?.best ?? null,
      })) })),
      me: enr ? {
        enrolledAt: enr.enrolledAt, completedAt: enr.completedAt, archived: !!enr.archivedAt, lastLessonId: enr.lastLessonId,
        percent: enr.completedAt ? 100 : reqLessons.length ? Math.round(reqLessons.filter((l) => doneSet.has(l.id)).length / reqLessons.length * 100) : 0,
        certificate: cert ? { code: cert.code, issuedAt: cert.issuedAt, score: cert.score } : null,
      } : null,
    };
  }

  async enroll(userId: string, key: string) {
    const c = await this.courseBySlugOrId(key);
    if (!this.canSee(c, await this.grantedCourseIds(userId))) throw new ForbiddenException({ code: 'restricted', message: 'به این دوره دسترسی ندارید' });
    const deps = await this.dependencyState(c.id, userId);
    const missing = deps.filter((d) => d.kind === 'PREREQUISITE' && !d.done);
    if (missing.length) throw new ForbiddenException({ code: 'prerequisite', message: `اول دورهٔ «${missing[0].course.title}» را تمام کنید`, missing: missing.map((m) => m.course) });
    await this.db.insert(enrollments).values({ userId, courseId: c.id, courseVersion: c.version })
      .onConflictDoUpdate({ target: [enrollments.userId, enrollments.courseId], set: { archivedAt: null } });
    // هم‌نیازها هم‌زمان ثبت‌نام می‌شوند
    for (const d of deps.filter((x) => x.kind === 'COREQUISITE')) {
      await this.db.insert(enrollments).values({ userId, courseId: d.course.id }).onConflictDoNothing();
    }
    return { ok: true };
  }

  async archive(userId: string, key: string, archived: boolean) {
    const c = await this.courseBySlugOrId(key);
    await this.db.update(enrollments).set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, c.id)));
    return { ok: true };
  }

  // ───────── درس ─────────

  private async lessonWithCourse(lessonId: string) {
    const row = await this.db.select({ l: lessons, m: modules, c: courses }).from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId)).innerJoin(courses, eq(courses.id, modules.courseId))
      .where(eq(lessons.id, lessonId)).then((r) => r[0]);
    if (!row) throw new NotFoundException({ code: 'no_lesson', message: 'این درس پیدا نشد' });
    return row;
  }

  private async requireEnrolled(userId: string, courseId: string, course?: { slug: string; title: string }) {
    const e = await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)) });
    // نشانی دوره همراه خطا می‌آید تا صفحهٔ درس بتواند کاربر را به ثبت‌نام ببرد
    if (!e) throw new ForbiddenException({ code: 'not_enrolled', message: 'اول در دوره ثبت‌نام کنید', course: course ? { slug: course.slug, title: course.title } : undefined });
    return e;
  }

  async lesson(userId: string, lessonId: string) {
    const { l, c } = await this.lessonWithCourse(lessonId);
    if (!this.canSee(c, await this.grantedCourseIds(userId))) throw new ForbiddenException({ code: 'restricted', message: 'به این دوره دسترسی ندارید' });
    await this.requireEnrolled(userId, c.id, c);
    await this.db.update(enrollments).set({ lastLessonId: l.id }).where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, c.id)));
    const p = await this.db.query.lessonProgress.findFirst({ where: and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, l.id)) });
    const attempts = l.type === 'QUIZ' ? await this.db.select({ score: quizAttempts.score, passed: quizAttempts.passed, at: quizAttempts.createdAt })
      .from(quizAttempts).where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.lessonId, l.id))).orderBy(desc(quizAttempts.createdAt)) : [];
    return {
      id: l.id, title: l.title, type: l.type, durationSec: l.durationSec, required: l.required, isFinalQuiz: l.isFinalQuiz,
      content: publicContent(l.type, l.content),
      course: { id: c.id, slug: c.slug, title: c.title, passScore: c.passScore },
      progress: p ? { positionSec: p.positionSec, completedAt: p.completedAt, data: decJson(p.data) } : null,
      quiz: l.type === 'QUIZ' ? { attempts, nextAllowedAt: this.nextAttemptAt(attempts.map((a) => a.at)) } : undefined,
    };
  }

  private nextAttemptAt(times: Date[]) {
    if (times.length < RETRY_FREE) return null;
    const next = new Date(times[0].getTime() + RETRY_WAIT_MS);
    return next > new Date() ? next : null;
  }

  async saveProgress(userId: string, lessonId: string, body: { positionSec?: number; completed?: boolean; data?: unknown }) {
    const { l, c } = await this.lessonWithCourse(lessonId);
    await this.requireEnrolled(userId, c.id, c);
    if (l.type === 'QUIZ' && body.completed) throw new BadRequestException({ code: 'quiz_needs_attempt', message: 'آزمون با ثبت پاسخ‌ها تکمیل می‌شود' });
    const completed = !!body.completed;
    const data = body.data as any;
    if (l.type === 'LIVE' && completed) throw new BadRequestException({ code: 'live_attend', message: 'این درس با حضور در جلسهٔ زنده (دست‌کم نیمی از زمان) یا دیدن ضبط آن تمام می‌شود' });
    if (l.type === 'MISSION' && (completed || data !== undefined)) throw new BadRequestException({ code: 'use_mission_submit', message: 'گزارش مأموریت از بخش مأموریت فرستاده می‌شود' });
    const set: Partial<typeof lessonProgress.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.positionSec === 'number') set.positionSec = Math.max(0, Math.floor(body.positionSec));
    if (data !== undefined) set.data = encJson(data);
    if (completed) set.completedAt = new Date();
    await this.db.insert(lessonProgress).values({ userId, lessonId, positionSec: set.positionSec ?? 0, data: set.data ?? null, completedAt: set.completedAt ?? null })
      .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set });
    const completion = completed ? await this.checkCompletion(userId, c.id) : null;
    return { ok: true, completion };
  }

  async submitQuiz(userId: string, lessonId: string, answers: Record<string, string[]>) {
    const { l, c } = await this.lessonWithCourse(lessonId);
    if (l.type !== 'QUIZ') throw new BadRequestException({ code: 'not_quiz', message: 'این درس آزمون نیست' });
    await this.requireEnrolled(userId, c.id, c);
    const prev = await this.db.select({ at: quizAttempts.createdAt }).from(quizAttempts)
      .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.lessonId, l.id))).orderBy(desc(quizAttempts.createdAt));
    const next = this.nextAttemptAt(prev.map((p) => p.at));
    if (next) throw new HttpException({ code: 'retry_wait', message: 'برای تلاش بعدی کمی صبر کنید', nextAllowedAt: next }, HttpStatus.TOO_MANY_REQUESTS);
    const content = l.content as QuizContent;
    const { score, results } = gradeQuiz(content, answers ?? {});
    const passed = score >= c.passScore;
    await this.db.insert(quizAttempts).values({ userId, lessonId: l.id, answers, score, passed });
    if (passed) {
      await this.db.insert(lessonProgress).values({ userId, lessonId: l.id, completedAt: new Date() })
        .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: { completedAt: sql`coalesce(${lessonProgress.completedAt}, now())` } });
    }
    const completion = passed ? await this.checkCompletion(userId, c.id) : null;
    if (passed && l.isFinalQuiz) {
      // نمرهٔ گواهی همیشه بهترین نمرهٔ آزمون پایانی است
      await this.db.update(certificates).set({ score: sql`greatest(coalesce(${certificates.score}, 0), ${score})` })
        .where(and(eq(certificates.userId, userId), eq(certificates.courseId, c.id)));
    }
    const after = [new Date(), ...prev.map((p) => p.at)];
    return { score, passed, passScore: c.passScore, results, completion, nextAllowedAt: passed ? null : this.nextAttemptAt(after) };
  }

  // ───────── تکمیل و گواهی ─────────

  /** اگر همهٔ درس‌های لازم تمام شده، دوره را تکمیل و گواهی صادر می‌کند */
  async checkCompletion(userId: string, courseId: string): Promise<{ completed: boolean; certificate?: { code: string } ; waitingFor?: string[] }> {
    const enr = await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)) });
    if (!enr) return { completed: false };
    if (enr.completedAt) return { completed: true };
    const req = await this.db.select({ id: lessons.id }).from(lessons).innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(eq(modules.courseId, courseId), eq(lessons.required, true)));
    if (!req.length) return { completed: false };
    const done = await this.db.select({ id: lessonProgress.lessonId }).from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, req.map((r) => r.id)), sql`${lessonProgress.completedAt} is not null`));
    if (done.length < req.length) return { completed: false };
    // هم‌نیازها باید تمام شده باشند تا گواهی صادر شود
    const deps = await this.dependencyState(courseId, userId);
    const coreqOpen = deps.filter((d) => d.kind === 'COREQUISITE' && !d.done);
    await this.db.update(enrollments).set({ completedAt: new Date() }).where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
    const c = (await this.db.query.courses.findFirst({ where: eq(courses.id, courseId) }))!;
    let cert: { code: string } | undefined;
    if (c.hasCertificate && !coreqOpen.length) cert = await this.issueCertificate(userId, c);
    // اگر این دوره هم‌نیاز دورهٔ دیگری بوده، آن دوره هم ممکن است حالا گواهی بگیرد
    const dependents = await this.db.select({ id: courseDependencies.courseId }).from(courseDependencies)
      .where(and(eq(courseDependencies.requiresId, courseId), eq(courseDependencies.kind, 'COREQUISITE')));
    for (const d of dependents) {
      const e = await this.db.query.enrollments.findFirst({ where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, d.id)) });
      if (e?.completedAt) {
        const dc = (await this.db.query.courses.findFirst({ where: eq(courses.id, d.id) }))!;
        if (dc.hasCertificate) await this.issueCertificate(userId, dc);
      }
    }
    return { completed: true, certificate: cert, waitingFor: coreqOpen.map((d) => d.course.title) };
  }

  private async issueCertificate(userId: string, c: CourseRow) {
    const existing = await this.db.query.certificates.findFirst({ where: and(eq(certificates.userId, userId), eq(certificates.courseId, c.id)) });
    if (existing) return { code: existing.code };
    const u = (await this.db.query.users.findFirst({ where: eq(users.id, userId) }))!;
    const final = await this.db.select({ best: sql<number>`max(${quizAttempts.score})::int` }).from(quizAttempts)
      .innerJoin(lessons, eq(lessons.id, quizAttempts.lessonId)).innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(eq(quizAttempts.userId, userId), eq(modules.courseId, c.id), eq(lessons.isFinalQuiz, true))).then((r) => r[0]?.best ?? null);
    for (let i = 0; i < 5; i++) {
      const code = 'HD-' + this.rand(4) + '-' + this.rand(4);
      try {
        await this.db.insert(certificates).values({ code, userId, courseId: c.id, holderName: `${u.firstName} ${u.lastName}`, courseTitle: c.title, score: final, orgName: await this.business.certOrgName(userId, c.id) });
        return { code };
      } catch (e: any) { if (!isUnique(e)) throw e; }
    }
    throw new Error('certificate_code_collision');
  }

  // ───────── آزمون جامع مسیر (۲.۵) ─────────

  private async pathFor(slug: string, userId: string) {
    const p = await this.db.query.paths.findFirst({ where: and(eq(paths.slug, slug), eq(paths.published, true)) });
    if (!p) throw new NotFoundException({ code: 'no_path', message: 'مسیر پیدا نشد' });
    const items = await this.db.select({ courseId: pathItems.courseId, title: courses.title }).from(pathItems).innerJoin(courses, eq(courses.id, pathItems.courseId)).where(eq(pathItems.pathId, p.id));
    const mine = await this.myStates(userId);
    const open = items.filter((i) => !mine.get(i.courseId)?.completedAt);
    return { p, open };
  }

  async pathExam(userId: string, slug: string) {
    const { p, open } = await this.pathFor(slug, userId);
    const quiz = p.quiz as QuizContent | null;
    if (!quiz?.questions?.length) throw new NotFoundException({ code: 'no_exam', message: 'این مسیر آزمون جامع ندارد' });
    const attempts = await this.db.select({ score: pathAttempts.score, passed: pathAttempts.passed, at: pathAttempts.at }).from(pathAttempts)
      .where(and(eq(pathAttempts.userId, userId), eq(pathAttempts.pathId, p.id))).orderBy(desc(pathAttempts.at));
    const cert = await this.db.query.certificates.findFirst({ where: and(eq(certificates.userId, userId), eq(certificates.pathId, p.id)) });
    return {
      path: { slug: p.slug, title: p.title }, passScore: p.passScore, locked: open.length > 0, waitingFor: open.map((o) => o.title),
      intro: quiz.intro ?? null, questions: open.length ? [] : publicContent('QUIZ', quiz).questions,
      attempts, nextAllowedAt: this.nextAttemptAt(attempts.map((a) => a.at)), certificate: cert && !cert.revokedAt ? { code: cert.code, score: cert.score } : null,
    };
  }

  async submitPathExam(userId: string, slug: string, answers: Record<string, string[]>) {
    const { p, open } = await this.pathFor(slug, userId);
    const quiz = p.quiz as QuizContent | null;
    if (!quiz?.questions?.length) throw new NotFoundException({ code: 'no_exam', message: 'این مسیر آزمون جامع ندارد' });
    if (open.length) throw new ForbiddenException({ code: 'path_open', message: 'اول همهٔ دوره‌های مسیر را تمام کنید' });
    const prev = await this.db.select({ at: pathAttempts.at }).from(pathAttempts).where(and(eq(pathAttempts.userId, userId), eq(pathAttempts.pathId, p.id))).orderBy(desc(pathAttempts.at));
    const next = this.nextAttemptAt(prev.map((x) => x.at));
    if (next) throw new HttpException({ code: 'retry_wait', message: 'برای تلاش بعدی کمی صبر کنید', nextAllowedAt: next }, HttpStatus.TOO_MANY_REQUESTS);
    const { score, results } = gradeQuiz(quiz, answers ?? {});
    const passed = score >= p.passScore;
    await this.db.insert(pathAttempts).values({ userId, pathId: p.id, score, passed });
    let certificate: { code: string } | undefined;
    if (passed) {
      const existing = await this.db.query.certificates.findFirst({ where: and(eq(certificates.userId, userId), eq(certificates.pathId, p.id)) });
      if (existing) {
        await this.db.update(certificates).set({ score: sql`greatest(coalesce(${certificates.score}, 0), ${score})` }).where(eq(certificates.id, existing.id));
        certificate = { code: existing.code };
      } else {
        const u = (await this.db.query.users.findFirst({ where: eq(users.id, userId) }))!;
        for (let i = 0; i < 5 && !certificate; i++) {
          const code = 'HD-' + this.rand(4) + '-' + this.rand(4);
          try { await this.db.insert(certificates).values({ code, userId, pathId: p.id, holderName: `${u.firstName} ${u.lastName}`, courseTitle: `مسیر «${p.title}»`, score, orgName: await this.business.certOrgName(userId, null) }); certificate = { code }; }
          catch (e: any) { if (!isUnique(e)) throw e; }
        }
      }
    }
    return { score, passed, passScore: p.passScore, results, certificate: certificate ?? null, nextAllowedAt: passed ? null : this.nextAttemptAt([new Date(), ...prev.map((x) => x.at)]) };
  }

  private rand(n: number) { let s = ''; for (let i = 0; i < n; i++) s += CODE_ALPHA[randomInt(CODE_ALPHA.length)]; return s; }

  async myCourses(userId: string) {
    const states = await this.myStates(userId);
    if (!states.size) return [];
    const cs = await this.db.select().from(courses).where(inArray(courses.id, [...states.keys()]));
    const stats = await this.courseStats(cs.map((c) => c.id));
    return cs.map((c) => ({ ...this.courseCard(c), ...stats.get(c.id), me: states.get(c.id) }))
      .sort((a, b) => +new Date(b.me!.enrolledAt) - +new Date(a.me!.enrolledAt));
  }

  async myCertificates(userId: string) {
    return this.db.select({ code: certificates.code, courseTitle: certificates.courseTitle, issuedAt: certificates.issuedAt, score: certificates.score, orgName: certificates.orgName, courseSlug: courses.slug, pathSlug: paths.slug })
      .from(certificates).leftJoin(courses, eq(courses.id, certificates.courseId)).leftJoin(paths, eq(paths.id, certificates.pathId))
      .where(and(eq(certificates.userId, userId), isNull(certificates.revokedAt))).orderBy(desc(certificates.issuedAt));
  }

  /** استعلام عمومی گواهی — فقط نام، دوره و تاریخ؛ بدون شماره یا اطلاعات دیگر */
  async verify(code: string) {
    const c = await this.db.query.certificates.findFirst({ where: eq(certificates.code, code.trim().toUpperCase()) });
    if (!c) return { valid: false as const };
    return { valid: !c.revokedAt, revoked: !!c.revokedAt, holderName: c.holderName, courseTitle: c.courseTitle, issuedAt: c.issuedAt, score: c.score, code: c.code, orgName: c.orgName };
  }
}
