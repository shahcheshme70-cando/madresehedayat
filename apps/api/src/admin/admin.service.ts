import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { normalizeMobile } from '../common/mobile';
import { Db, InjectDb } from '../db/db.module';
import {
  accessGrants, auditLogs, certificates, counties, courseDependencies, courses, enrollments, lessonProgress, lessons,
  modules, mosques, networks, pathItems, paths, provinces, roleGrants, users,
} from '../db/schema';

type LessonTypeName = typeof lessons.$inferSelect['type'];

/** بررسی کمینهٔ محتوای هر نوع درس پیش از ذخیره */
export function validateContent(type: LessonTypeName, c: any): string | null {
  if (!c || typeof c !== 'object') return 'محتوای درس خالی است';
  switch (type) {
    case 'VIDEO':
      if (c.provider === 'aparat' && !/^[A-Za-z0-9]{3,20}$/.test(c.aparatHash ?? '')) return 'شناسهٔ ویدیوی آپارات درست نیست';
      if (c.provider === 'file' && !c.fileKey) return 'فایل ویدیو را بارگذاری کنید';
      if (!['aparat', 'file'].includes(c.provider)) return 'منبع ویدیو را انتخاب کنید';
      return null;
    case 'AUDIO': return c.fileKey || c.url ? null : 'فایل صوتی را بارگذاری کنید';
    case 'TEXT': return typeof c.body === 'string' && c.body.trim().length >= 20 ? null : 'متن درس کوتاه است';
    case 'QUIZ': {
      if (!Array.isArray(c.questions) || !c.questions.length) return 'دست‌کم یک پرسش لازم است';
      for (const [i, q] of c.questions.entries()) {
        if (!q.text?.trim()) return `متن پرسش ${i + 1} خالی است`;
        if (!Array.isArray(q.options) || q.options.length < 2) return `پرسش ${i + 1} دست‌کم دو گزینه لازم دارد`;
        if (!Array.isArray(q.correct) || !q.correct.length) return `پاسخ درست پرسش ${i + 1} را مشخص کنید`;
        if (q.correct.some((id: string) => !q.options.some((o: any) => o.id === id))) return `پاسخ درست پرسش ${i + 1} در گزینه‌ها نیست`;
      }
      return null;
    }
    case 'WORKSHEET': return c.prompt && Array.isArray(c.fields) && c.fields.length ? null : 'برگه دست‌کم یک خانه لازم دارد';
    case 'MISSION': return c.goal && Array.isArray(c.steps) ? null : 'هدف مأموریت را بنویسید';
    default: return null;
  }
}

@Injectable()
export class AdminService {
  constructor(@InjectDb() private readonly db: Db) {}

  audit(actorId: string, action: string, target?: string, meta?: unknown) {
    return this.db.insert(auditLogs).values({ actorId, action, target, meta: meta as any });
  }

  async stats() {
    const weekAgo = new Date(Date.now() - 7 * 86400_000);
    const [u] = await this.db.select({ n: count() }).from(users);
    const [active] = await this.db.select({ n: sql<number>`count(distinct ${lessonProgress.userId})::int` }).from(lessonProgress).where(gt(lessonProgress.updatedAt, weekAgo));
    const [en] = await this.db.select({ n: count() }).from(enrollments);
    const [done] = await this.db.select({ n: count() }).from(enrollments).where(sql`${enrollments.completedAt} is not null`);
    const [certs] = await this.db.select({ n: count() }).from(certificates).where(isNull(certificates.revokedAt));
    const byStatus = await this.db.select({ status: courses.status, n: count() }).from(courses).groupBy(courses.status);
    const [newUsers] = await this.db.select({ n: count() }).from(users).where(gt(users.createdAt, weekAgo));
    const top = await this.db.select({ id: courses.id, title: courses.title, n: count(enrollments.userId) })
      .from(courses).leftJoin(enrollments, eq(enrollments.courseId, courses.id)).where(eq(courses.status, 'PUBLISHED'))
      .groupBy(courses.id).orderBy(desc(count(enrollments.userId))).limit(5);
    const unverifiedMosques = await this.db.select({ n: count() }).from(mosques).where(eq(mosques.verified, false)).then((r) => r[0].n);
    return {
      users: u.n, newUsersWeek: newUsers.n, activeWeek: active.n, enrollments: en.n, completions: done.n, certificates: certs.n,
      courses: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), topCourses: top, unverifiedMosques,
    };
  }

  // ───────── دوره‌ها ─────────

  async listCourses() {
    const rows = await this.db.select({
      c: courses,
      lessons: sql<number>`(select count(*)::int from ${lessons} l join ${modules} m on m.id = l.module_id where m.course_id = "courses"."id")`,
      learners: sql<number>`(select count(*)::int from ${enrollments} e where e.course_id = "courses"."id")`,
      completed: sql<number>`(select count(*)::int from ${enrollments} e where e.course_id = "courses"."id" and e.completed_at is not null)`,
    }).from(courses).orderBy(desc(courses.updatedAt));
    return rows.map((r) => ({ ...r.c, lessonCount: r.lessons, learnerCount: r.learners, completedCount: r.completed }));
  }

  async getCourse(id: string) {
    const c = await this.db.query.courses.findFirst({
      where: eq(courses.id, id),
      with: { modules: { orderBy: asc(modules.order), with: { lessons: { orderBy: asc(lessons.order) } } } },
    });
    if (!c) throw new NotFoundException({ code: 'no_course', message: 'دوره پیدا نشد' });
    const deps = await this.db.select({ requiresId: courseDependencies.requiresId, kind: courseDependencies.kind, title: courses.title })
      .from(courseDependencies).innerJoin(courses, eq(courses.id, courseDependencies.requiresId)).where(eq(courseDependencies.courseId, id));
    return { ...c, dependencies: deps };
  }

  async createCourse(actor: string, data: { title: string; slug?: string }) {
    const slug = (data.slug || this.slugify(data.title)) + '-' + Math.random().toString(36).slice(2, 6);
    const [c] = await this.db.insert(courses).values({ title: data.title.trim(), slug }).returning();
    await this.db.insert(modules).values({ courseId: c.id, title: 'بخش ۱', order: 0 });
    await this.audit(actor, 'course.create', c.id);
    return c;
  }

  private slugify(s: string) {
    const latin = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return latin || 'course';
  }

  async updateCourse(actor: string, id: string, patch: Partial<typeof courses.$inferInsert> & { bumpVersion?: boolean }) {
    const c = await this.db.query.courses.findFirst({ where: eq(courses.id, id) });
    if (!c) throw new NotFoundException({ code: 'no_course', message: 'دوره پیدا نشد' });
    const { bumpVersion, ...rest } = patch;
    const set: Partial<typeof courses.$inferInsert> = { ...rest };
    if (rest.status === 'PUBLISHED') {
      const problems = await this.publishProblems(id);
      if (problems.length) throw new BadRequestException({ code: 'not_ready', message: problems[0], problems });
      if (c.status !== 'PUBLISHED') set.publishedAt = new Date();
    }
    if (bumpVersion) set.version = c.version + 1;
    const [u] = await this.db.update(courses).set(set).where(eq(courses.id, id)).returning();
    await this.audit(actor, 'course.update', id, Object.keys(set));
    return u;
  }

  /** فهرست چیزهایی که پیش از انتشار باید درست شود */
  async publishProblems(id: string) {
    const c = await this.getCourse(id);
    const p: string[] = [];
    if (!c.about?.trim()) p.push('توضیح دوره خالی است');
    const all = c.modules.flatMap((m) => m.lessons);
    if (!all.length) p.push('دوره هنوز درسی ندارد');
    for (const l of all) { const e = validateContent(l.type, l.content); if (e) p.push(`درس «${l.title}»: ${e}`); }
    if (c.hasCertificate && !all.some((l) => l.type === 'QUIZ' && l.isFinalQuiz)) p.push('دورهٔ گواهی‌دار آزمون پایانی لازم دارد');
    return p;
  }

  async deleteCourse(actor: string, id: string) {
    const [en] = await this.db.select({ n: count() }).from(enrollments).where(eq(enrollments.courseId, id));
    if (en.n) throw new BadRequestException({ code: 'has_learners', message: 'این دوره یادگیرنده دارد؛ به‌جای حذف بایگانی‌اش کنید' });
    await this.db.delete(courses).where(eq(courses.id, id));
    await this.audit(actor, 'course.delete', id);
    return { ok: true };
  }

  async setDependencies(actor: string, id: string, deps: { requiresId: string; kind: 'PREREQUISITE' | 'COREQUISITE' }[]) {
    if (deps.some((d) => d.requiresId === id)) throw new BadRequestException({ code: 'self_dep', message: 'دوره نمی‌تواند پیش‌نیاز خودش باشد' });
    // جلوگیری از دور: اگر دورهٔ مقصد (مستقیم یا غیرمستقیم) به این دوره وابسته باشد
    const all = await this.db.select().from(courseDependencies);
    const reaches = (from: string, target: string, seen = new Set<string>()): boolean => {
      if (from === target) return true; if (seen.has(from)) return false; seen.add(from);
      return all.filter((d) => d.courseId === from && d.kind === 'PREREQUISITE').some((d) => reaches(d.requiresId, target, seen));
    };
    for (const d of deps) if (d.kind === 'PREREQUISITE' && reaches(d.requiresId, id)) throw new BadRequestException({ code: 'cycle', message: 'این پیش‌نیاز یک دور می‌سازد' });
    await this.db.transaction(async (tx) => {
      await tx.delete(courseDependencies).where(eq(courseDependencies.courseId, id));
      if (deps.length) await tx.insert(courseDependencies).values(deps.map((d) => ({ courseId: id, requiresId: d.requiresId, kind: d.kind })));
    });
    await this.audit(actor, 'course.dependencies', id, deps);
    return { ok: true };
  }

  // ───────── بخش‌ها و درس‌ها ─────────

  async addModule(courseId: string, title: string) {
    const [{ n }] = await this.db.select({ n: count() }).from(modules).where(eq(modules.courseId, courseId));
    const [m] = await this.db.insert(modules).values({ courseId, title, order: n }).returning();
    return m;
  }
  async updateModule(id: string, title: string) { const [m] = await this.db.update(modules).set({ title }).where(eq(modules.id, id)).returning(); return m; }
  async deleteModule(id: string) {
    const [{ n }] = await this.db.select({ n: count() }).from(lessons).where(eq(lessons.moduleId, id));
    if (n) throw new BadRequestException({ code: 'module_not_empty', message: 'اول درس‌های این بخش را جابه‌جا یا حذف کنید' });
    await this.db.delete(modules).where(eq(modules.id, id)); return { ok: true };
  }

  async reorder(courseId: string, order: { id: string; lessons: string[] }[]) {
    await this.db.transaction(async (tx) => {
      for (const [mi, m] of order.entries()) {
        await tx.update(modules).set({ order: mi }).where(and(eq(modules.id, m.id), eq(modules.courseId, courseId)));
        for (const [li, lid] of m.lessons.entries()) await tx.update(lessons).set({ order: li, moduleId: m.id }).where(eq(lessons.id, lid));
      }
    });
    return { ok: true };
  }

  async addLesson(moduleId: string, data: { title: string; type: LessonTypeName }) {
    const [{ n }] = await this.db.select({ n: count() }).from(lessons).where(eq(lessons.moduleId, moduleId));
    const starter: Record<string, unknown> = {
      VIDEO: { provider: 'aparat', aparatHash: '' }, AUDIO: {}, TEXT: { body: '' },
      QUIZ: { questions: [] }, WORKSHEET: { prompt: '', fields: [] }, MISSION: { goal: '', steps: [] }, PRACTICE: {}, TOOL: {},
    };
    const [l] = await this.db.insert(lessons).values({ moduleId, title: data.title, type: data.type, order: n, content: starter[data.type] ?? {} }).returning();
    return l;
  }

  async updateLesson(actor: string, id: string, patch: Partial<typeof lessons.$inferInsert>) {
    const l = await this.db.query.lessons.findFirst({ where: eq(lessons.id, id) });
    if (!l) throw new NotFoundException({ code: 'no_lesson', message: 'درس پیدا نشد' });
    if (patch.isFinalQuiz && (patch.type ?? l.type) !== 'QUIZ') throw new BadRequestException({ code: 'final_not_quiz', message: 'فقط آزمون می‌تواند آزمون پایانی باشد' });
    const [u] = await this.db.update(lessons).set(patch).where(eq(lessons.id, id)).returning();
    await this.audit(actor, 'lesson.update', id);
    return { ...u, problem: validateContent(u.type, u.content) };
  }

  async deleteLesson(actor: string, id: string) {
    await this.db.delete(lessons).where(eq(lessons.id, id));
    await this.audit(actor, 'lesson.delete', id);
    return { ok: true };
  }

  // ───────── مسیرها ─────────

  async listPaths() {
    const ps = await this.db.select().from(paths).orderBy(asc(paths.title));
    const items = await this.db.select({ pathId: pathItems.pathId, courseId: pathItems.courseId, order: pathItems.order, title: courses.title, status: courses.status })
      .from(pathItems).innerJoin(courses, eq(courses.id, pathItems.courseId)).orderBy(asc(pathItems.order));
    return ps.map((p) => ({ ...p, courses: items.filter((i) => i.pathId === p.id) }));
  }
  async createPath(actor: string, d: { title: string; description?: string }) {
    const slug = this.slugify(d.title) + '-' + Math.random().toString(36).slice(2, 6);
    const [p] = await this.db.insert(paths).values({ title: d.title, description: d.description, slug }).returning();
    await this.audit(actor, 'path.create', p.id); return p;
  }
  async updatePath(actor: string, id: string, patch: Partial<typeof paths.$inferInsert>) {
    const [p] = await this.db.update(paths).set(patch).where(eq(paths.id, id)).returning();
    await this.audit(actor, 'path.update', id); return p;
  }
  async setPathCourses(id: string, courseIds: string[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(pathItems).where(eq(pathItems.pathId, id));
      if (courseIds.length) await tx.insert(pathItems).values(courseIds.map((c, i) => ({ pathId: id, courseId: c, order: i })));
    });
    return { ok: true };
  }
  async deletePath(id: string) { await this.db.delete(paths).where(eq(paths.id, id)); return { ok: true }; }

  // ───────── کاربران و نقش‌ها ─────────

  async listUsers(q: string, page: number) {
    const term = q?.trim();
    const where = term ? or(ilike(users.firstName, `%${term}%`), ilike(users.lastName, `%${term}%`), ilike(users.mobile, `%${term}%`)) : undefined;
    const rows = await this.db.select({
      id: users.id, mobile: users.mobile, firstName: users.firstName, lastName: users.lastName, gender: users.gender, isActive: users.isActive,
      createdAt: users.createdAt, county: counties.name, province: provinces.name, mosque: mosques.name, nearMosque: users.nearMosque,
      roles: sql<string[]>`coalesce((select array_agg(r.role) from ${roleGrants} r where r.user_id = ${users.id}), '{}')`,
      courses: sql<number>`(select count(*)::int from ${enrollments} e where e.user_id = ${users.id})`,
    }).from(users).leftJoin(counties, eq(counties.id, users.countyId)).leftJoin(provinces, eq(provinces.id, counties.provinceId))
      .leftJoin(mosques, eq(mosques.id, users.mosqueId)).where(where).orderBy(desc(users.createdAt)).limit(50).offset(Math.max(0, page - 1) * 50);
    const [{ n }] = await this.db.select({ n: count() }).from(users).where(where);
    return { total: n, page, rows };
  }

  async setActive(actor: string, id: string, isActive: boolean) {
    await this.db.update(users).set({ isActive }).where(eq(users.id, id));
    await this.audit(actor, isActive ? 'user.activate' : 'user.deactivate', id); return { ok: true };
  }

  async grantRole(actor: string, userId: string, role: typeof roleGrants.$inferInsert['role'], networkId?: string) {
    await this.db.insert(roleGrants).values({ userId, role, networkId: networkId || null }).onConflictDoNothing();
    await this.audit(actor, 'role.grant', userId, { role, networkId }); return { ok: true };
  }
  async revokeRole(actor: string, userId: string, role: typeof roleGrants.$inferInsert['role']) {
    await this.db.delete(roleGrants).where(and(eq(roleGrants.userId, userId), eq(roleGrants.role, role)));
    await this.audit(actor, 'role.revoke', userId, { role }); return { ok: true };
  }

  // ───────── دسترسی ویژه ─────────

  async listGrants() {
    return this.db.select({
      id: accessGrants.id, courseTitle: courses.title, courseId: accessGrants.courseId, note: accessGrants.note, expiresAt: accessGrants.expiresAt, createdAt: accessGrants.createdAt,
      user: sql<string | null>`(select u.first_name || ' ' || u.last_name from ${users} u where u.id = ${accessGrants.userId})`,
      network: sql<string | null>`(select n.name from ${networks} n where n.id = ${accessGrants.networkId})`,
    }).from(accessGrants).innerJoin(courses, eq(courses.id, accessGrants.courseId)).orderBy(desc(accessGrants.createdAt)).limit(200);
  }

  /** به چند شماره یا یک شبکه دسترسی می‌دهد. شماره‌هایی که حساب ندارند برگردانده می‌شوند. */
  async createGrants(actor: string, d: { courseIds: string[]; mobiles?: string[]; networkId?: string; expiresAt?: string; note?: string }) {
    const expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
    const missing: string[] = [];
    const values: (typeof accessGrants.$inferInsert)[] = [];
    if (d.networkId) for (const c of d.courseIds) values.push({ courseId: c, networkId: d.networkId, issuedById: actor, expiresAt, note: d.note });
    if (d.mobiles?.length) {
      const norm = d.mobiles.map((m) => normalizeMobile(m)).filter(Boolean) as string[];
      const found = norm.length ? await this.db.select({ id: users.id, mobile: users.mobile }).from(users).where(inArray(users.mobile, norm)) : [];
      for (const m of d.mobiles) { const n = normalizeMobile(m); if (!n || !found.some((f) => f.mobile === n)) missing.push(m); }
      for (const u of found) for (const c of d.courseIds) values.push({ courseId: c, userId: u.id, issuedById: actor, expiresAt, note: d.note });
    }
    if (values.length) await this.db.insert(accessGrants).values(values);
    await this.audit(actor, 'grant.create', undefined, { count: values.length });
    return { created: values.length, missing };
  }
  async deleteGrant(actor: string, id: string) { await this.db.delete(accessGrants).where(eq(accessGrants.id, id)); await this.audit(actor, 'grant.delete', id); return { ok: true }; }

  // ───────── شبکه‌ها ─────────
  listNetworks() { return this.db.select().from(networks).orderBy(asc(networks.name)); }
  async createNetwork(actor: string, d: { kind: 'BROTHERS' | 'BANOUR' | 'ORGANIZATION'; name: string; underRahyar?: boolean }) {
    const [n] = await this.db.insert(networks).values(d).returning(); await this.audit(actor, 'network.create', n.id); return n;
  }

  // ───────── گواهی‌ها ─────────
  async listCertificates(q?: string) {
    const term = q?.trim();
    return this.db.select().from(certificates)
      .where(term ? or(ilike(certificates.code, `%${term}%`), ilike(certificates.holderName, `%${term}%`), ilike(certificates.courseTitle, `%${term}%`)) : undefined)
      .orderBy(desc(certificates.issuedAt)).limit(100);
  }
  async revokeCertificate(actor: string, code: string, revoke: boolean) {
    await this.db.update(certificates).set({ revokedAt: revoke ? new Date() : null }).where(eq(certificates.code, code));
    await this.audit(actor, revoke ? 'cert.revoke' : 'cert.restore', code); return { ok: true };
  }

  // ───────── مساجد ─────────
  async listMosques(onlyUnverified: boolean) {
    return this.db.select({ id: mosques.id, name: mosques.name, verified: mosques.verified, county: counties.name, province: provinces.name, createdAt: mosques.createdAt })
      .from(mosques).innerJoin(counties, eq(counties.id, mosques.countyId)).innerJoin(provinces, eq(provinces.id, counties.provinceId))
      .where(onlyUnverified ? eq(mosques.verified, false) : undefined).orderBy(desc(mosques.createdAt)).limit(300);
  }
  async addMosque(actor: string, d: { name: string; countyId: string }) {
    const [m] = await this.db.insert(mosques).values({ ...d, verified: true }).returning(); await this.audit(actor, 'mosque.create', m.id); return m;
  }
  async verifyMosque(actor: string, id: string) { await this.db.update(mosques).set({ verified: true }).where(eq(mosques.id, id)); await this.audit(actor, 'mosque.verify', id); return { ok: true }; }

  audits() {
    return this.db.select({ id: auditLogs.id, action: auditLogs.action, target: auditLogs.target, createdAt: auditLogs.createdAt, actor: sql<string>`(select u.first_name || ' ' || u.last_name from ${users} u where u.id = ${auditLogs.actorId})` })
      .from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  }
}
