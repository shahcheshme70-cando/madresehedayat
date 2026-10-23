import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { Db, InjectDb } from '../db/db.module';
import { dec, decJson, enc, encJson } from '../common/crypto';
import { counties, courses, lessonProgress, lessons, missionMessages, missionSamples, modules, privateFiles, provinces, users } from '../db/schema';
import { Notifier } from '../notifications/notifications';
import { RahyarService } from './rahyar.service';

export type MissionStatus = 'submitted' | 'pending' | 'needs_revision' | 'approved';
const REMIND_DAYS = 3;
const ESCALATE_DAYS = 7;

@Injectable()
export class MissionsService {
  constructor(@InjectDb() private readonly db: Db, private readonly rahyar: RahyarService, private readonly notify: Notifier) {}

  private async ctx(learnerId: string, lessonId: string) {
    const row = await this.db.select({ l: lessons, c: courses }).from(lessons).innerJoin(modules, eq(modules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId)).where(eq(lessons.id, lessonId)).then((r) => r[0]);
    if (!row || row.l.type !== 'MISSION') throw new NotFoundException({ code: 'no_mission', message: 'مأموریت پیدا نشد' });
    const p = await this.db.query.lessonProgress.findFirst({ where: and(eq(lessonProgress.userId, learnerId), eq(lessonProgress.lessonId, lessonId)) });
    return { ...row, p };
  }

  /** کنشگر گزارش می‌فرستد (بار اول یا بعد از درخواست اصلاح) */
  async submit(learnerId: string, lessonId: string, report: { did: string; learned?: string; checks?: Record<string, boolean>; mainPhoto?: string; evidence?: string[] }) {
    const { l, c, p } = await this.ctx(learnerId, lessonId);
    const prev = (decJson(p?.data) ?? {}) as any;
    if (prev.status && prev.status !== 'needs_revision') throw new BadRequestException({ code: 'already_sent', message: 'این گزارش فرستاده شده است' });
    if (!report.did || report.did.trim().length < 10) throw new BadRequestException({ code: 'short', message: 'کمی بیشتر بنویسید چه کردید' });
    await this.assertOwnFiles(learnerId, [report.mainPhoto, ...(report.evidence ?? [])].filter(Boolean) as string[]);
    const status: MissionStatus = c.missionRule === 'ON_SUBMIT' ? 'submitted' : 'pending';
    const data = { ...prev, ...report, status, submittedAt: new Date().toISOString(), round: (prev.round ?? 0) + 1 };
    const completedAt = c.missionRule === 'ON_SUBMIT' ? new Date() : null;
    await this.db.insert(lessonProgress).values({ userId: learnerId, lessonId, data: encJson(data), completedAt })
      .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: { data: encJson(data), ...(completedAt ? { completedAt: sql`coalesce(${lessonProgress.completedAt}, now())` } : {}) } });
    const body = `چه کردم: ${report.did.trim()}${report.learned?.trim() ? `\nچه یاد گرفتم: ${report.learned.trim()}` : ''}`;
    await this.db.insert(missionMessages).values({ learnerId, lessonId, authorId: learnerId, kind: 'REPORT', body: enc(body)! });
    const { responsible } = await this.rahyar.responsibleFor(learnerId);
    const u = await this.db.query.users.findFirst({ where: eq(users.id, learnerId), columns: { firstName: true, lastName: true } });
    if (responsible?.holderId) await this.notify.send(responsible.holderId, { kind: 'mission_report', title: `گزارش تازهٔ ${u?.firstName} ${u?.lastName}`, body: l.title, link: `/rahyar/reports/${learnerId}/${lessonId}` });
    return { status, completed: !!completedAt, courseId: c.id };
  }

  async thread(viewer: { id: string; roles: string[] }, learnerId: string, lessonId: string) {
    if (viewer.id !== learnerId && !(await this.rahyar.canSeeLearner(viewer.id, learnerId, viewer.roles))) throw new ForbiddenException({ code: 'forbidden', message: 'این گزارش برای شما نیست' });
    const { l, c, p } = await this.ctx(learnerId, lessonId);
    const msgs = await this.db.select({ id: missionMessages.id, kind: missionMessages.kind, body: missionMessages.body, createdAt: missionMessages.createdAt, authorId: missionMessages.authorId, firstName: users.firstName, lastName: users.lastName })
      .from(missionMessages).innerJoin(users, eq(users.id, missionMessages.authorId))
      .where(and(eq(missionMessages.learnerId, learnerId), eq(missionMessages.lessonId, lessonId))).orderBy(asc(missionMessages.createdAt));
    const learner = await this.db.query.users.findFirst({ where: eq(users.id, learnerId), columns: { id: true, firstName: true, lastName: true } });
    return { lesson: { id: l.id, title: l.title, goal: (l.content as any)?.goal }, course: { id: c.id, title: c.title, missionRule: c.missionRule }, learner, data: decJson(p?.data), sample: await this.db.query.missionSamples.findFirst({ where: and(eq(missionSamples.learnerId, learnerId), eq(missionSamples.lessonId, lessonId)), columns: { status: true, named: true } }) ?? null, messages: msgs.map((m) => ({ ...m, body: dec(m.body) ?? '' })) };
  }

  /** پاسخ راهیار (بازخورد، درخواست اصلاح، تأیید) یا پاسخ کنشگر */
  async reply(viewer: { id: string; roles: string[] }, learnerId: string, lessonId: string, kind: 'FEEDBACK' | 'REVISE' | 'APPROVE' | 'REPLY', body: string, onApproved: (courseId: string) => Promise<unknown>) {
    const isLearner = viewer.id === learnerId;
    if (isLearner && kind !== 'REPLY') throw new ForbiddenException({ code: 'forbidden', message: 'فقط راهیار می‌تواند بازخورد یا تأیید بدهد' });
    if (!isLearner && !(await this.rahyar.canSeeLearner(viewer.id, learnerId, viewer.roles))) throw new ForbiddenException({ code: 'forbidden', message: 'این کنشگر در دامنهٔ شما نیست' });
    if (!body?.trim() && kind !== 'APPROVE') throw new BadRequestException({ code: 'empty', message: 'متن را بنویسید' });
    const { l, c, p } = await this.ctx(learnerId, lessonId);
    const data = { ...((decJson(p?.data) ?? {}) as any) };
    if (!data.status) throw new BadRequestException({ code: 'not_sent', message: 'هنوز گزارشی فرستاده نشده' });
    if (kind === 'REVISE') data.status = 'needs_revision';
    if (kind === 'APPROVE') data.status = 'approved';
    if (kind === 'FEEDBACK' && data.status === 'pending' && c.missionRule === 'ON_SUBMIT') data.status = 'submitted';
    data.lastReplyAt = new Date().toISOString();
    if (!isLearner) data.reviewedAt = new Date().toISOString();
    await this.db.update(lessonProgress).set({ data: encJson(data), ...(kind === 'APPROVE' ? { completedAt: sql`coalesce(${lessonProgress.completedAt}, now())` } : {}) })
      .where(and(eq(lessonProgress.userId, learnerId), eq(lessonProgress.lessonId, lessonId)));
    await this.db.insert(missionMessages).values({ learnerId, lessonId, authorId: viewer.id, kind, body: enc(body?.trim() || 'گزارش تأیید شد.')! });
    if (kind === 'APPROVE') await onApproved(c.id);
    if (isLearner) {
      const { responsible } = await this.rahyar.responsibleFor(learnerId);
      if (responsible?.holderId) await this.notify.send(responsible.holderId, { kind: 'mission_reply', title: 'پاسخ کنشگر به بازخورد', body: l.title, link: `/rahyar/reports/${learnerId}/${lessonId}` });
    } else {
      const t = kind === 'REVISE' ? 'راهیارتان گزارش را برای اصلاح برگرداند' : kind === 'APPROVE' ? 'گزارش مأموریتتان تأیید شد' : 'راهیارتان به گزارش مأموریت پاسخ داد';
      await this.notify.send(learnerId, { kind: 'mission_feedback', title: t, body: l.title, link: `/lessons/${lessonId}` });
    }
    return { ok: true, status: data.status };
  }

  /** صف گزارش‌های دامنهٔ یک راهیار */
  async queue(rahyarId: string, filter: 'open' | 'all') {
    const scope = await this.rahyar.learnersInScope(rahyarId);
    if (!scope.length) return [];
    const ids = scope.map((s) => s.id);
    const rows = await this.db.select({ userId: lessonProgress.userId, lessonId: lessonProgress.lessonId, data: lessonProgress.data, lessonTitle: lessons.title, courseTitle: courses.title })
      .from(lessonProgress).innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId)).innerJoin(modules, eq(modules.id, lessons.moduleId)).innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(inArray(lessonProgress.userId, ids), eq(lessons.type, 'MISSION')));
    const now = Date.now();
    return rows.map((r) => ({ ...r, data: decJson(r.data) })).filter((r) => (r.data as any)?.status).map((r) => {
      const d = r.data as any; const s = scope.find((x) => x.id === r.userId)!;
      const waiting = ['submitted', 'pending'].includes(d.status) && !d.reviewedAt ? Math.floor((now - new Date(d.submittedAt).getTime()) / 86400_000) : 0;
      return { learnerId: r.userId, lessonId: r.lessonId, learner: `${s.firstName} ${s.lastName}`, lessonTitle: r.lessonTitle, courseTitle: r.courseTitle, status: d.status as MissionStatus,
        submittedAt: d.submittedAt, reviewed: !!d.reviewedAt, waitingDays: waiting, direct: s.direct, responsible: s.responsible?.title ?? null,
        overdue: waiting >= ESCALATE_DAYS, hasPhoto: !!d.mainPhoto };
    }).filter((r) => filter === 'all' || ((r.status === 'pending' || (r.status === 'submitted' && !r.reviewed)) && (r.direct || r.overdue)))
      .sort((a, b) => b.waitingDays - a.waitingDays);
  }

  /** هر ساعت: یادآوری بعد از ۳ روز به راهیار مسئول، هشدار بعد از ۷ روز به لایهٔ بالاتر */
  async escalate() {
    const rows = await this.db.select({ userId: lessonProgress.userId, lessonId: lessonProgress.lessonId, data: lessonProgress.data, title: lessons.title })
      .from(lessonProgress).innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId)).where(eq(lessons.type, 'MISSION'));
    for (const r of rows) {
      const d = (decJson(r.data) ?? {}) as any;
      if (!['submitted', 'pending'].includes(d.status) || d.reviewedAt) continue;
      const days = (Date.now() - new Date(d.submittedAt).getTime()) / 86400_000;
      const { responsible, above } = await this.rahyar.responsibleFor(r.userId);
      let changed = false;
      if (days >= REMIND_DAYS && !d.remindedAt && responsible?.holderId) {
        await this.notify.send(responsible.holderId, { kind: 'mission_overdue', title: 'گزارشی ۳ روز است منتظر بازخورد شماست', body: r.title, link: `/rahyar/reports/${r.userId}/${r.lessonId}` });
        d.remindedAt = new Date().toISOString(); changed = true;
      }
      if (days >= ESCALATE_DAYS && !d.escalatedAt && above?.holderId) {
        await this.notify.send(above.holderId, { kind: 'mission_escalated', title: 'گزارشی یک هفته بی‌پاسخ مانده', body: `${r.title} — ${responsible?.title ?? 'بدون راهیار'}`, link: `/rahyar/reports/${r.userId}/${r.lessonId}` });
        d.escalatedAt = new Date().toISOString(); changed = true;
      }
      if (changed) await this.db.update(lessonProgress).set({ data: encJson(d) }).where(and(eq(lessonProgress.userId, r.userId), eq(lessonProgress.lessonId, r.lessonId)));
    }
  }

  // ───────── گزارش نمونه (۳.۵) ─────────

  async proposeSample(rahyarId: string, learnerId: string, lessonId: string) {
    const ex = await this.db.query.missionSamples.findFirst({ where: and(eq(missionSamples.learnerId, learnerId), eq(missionSamples.lessonId, lessonId)) });
    if (ex) return;
    await this.db.insert(missionSamples).values({ learnerId, lessonId, proposedById: rahyarId, status: 'PROPOSED' });
    const { l } = await this.ctx(learnerId, lessonId);
    await this.notify.send(learnerId, { kind: 'sample_proposed', title: 'راهیارتان پیشنهاد داده گزارشتان «نمونه» شود', body: `اگر اجازه بدهید، متن گزارش «${l.title}» برای الهام دیگران زیر همین مأموریت نشان داده می‌شود؛ با نام یا بی‌نام، به انتخاب خودتان.`, link: `/lessons/${lessonId}` });
  }

  /** کنشگر اجازه می‌دهد (با نام یا بی‌نام) یا نمی‌دهد؛ فقط با اجازه، متن کپی می‌شود */
  async consentSample(learnerId: string, lessonId: string, decision: 'named' | 'anon' | 'no') {
    const s = await this.db.query.missionSamples.findFirst({ where: and(eq(missionSamples.learnerId, learnerId), eq(missionSamples.lessonId, lessonId)) });
    if (!s || s.status === 'PUBLISHED') throw new BadRequestException({ code: 'no_sample', message: 'پیشنهادی برای نمونه نیست' });
    if (decision === 'no') { await this.db.update(missionSamples).set({ status: 'DECLINED', text: null }).where(and(eq(missionSamples.learnerId, learnerId), eq(missionSamples.lessonId, lessonId))); return { ok: true }; }
    const { p } = await this.ctx(learnerId, lessonId);
    const d = (decJson(p?.data) ?? {}) as any;
    const u = await this.db.select({ firstName: users.firstName, lastName: users.lastName, province: provinces.name }).from(users).leftJoin(counties, eq(counties.id, users.countyId)).leftJoin(provinces, eq(provinces.id, counties.provinceId)).where(eq(users.id, learnerId)).then((r) => r[0]);
    const text = `${d.did ?? ''}${d.learned ? '\n\nآنچه یاد گرفتم: ' + d.learned : ''}`.trim();
    const label = decision === 'named' ? `${u.firstName} ${u.lastName}${u.province ? '، ' + u.province : ''}` : `کنشگری از ${u.province ?? 'ایران'}`;
    await this.db.update(missionSamples).set({ status: 'CONSENTED', named: decision === 'named', text, authorLabel: label }).where(and(eq(missionSamples.learnerId, learnerId), eq(missionSamples.lessonId, lessonId)));
    return { ok: true };
  }

  async listSamples(status?: string) {
    return this.db.select({ learnerId: missionSamples.learnerId, lessonId: missionSamples.lessonId, status: missionSamples.status, named: missionSamples.named, text: missionSamples.text, authorLabel: missionSamples.authorLabel, createdAt: missionSamples.createdAt, publishedAt: missionSamples.publishedAt, lessonTitle: lessons.title, courseTitle: courses.title })
      .from(missionSamples).innerJoin(lessons, eq(lessons.id, missionSamples.lessonId)).innerJoin(modules, eq(modules.id, lessons.moduleId)).innerJoin(courses, eq(courses.id, modules.courseId))
      .where(status ? eq(missionSamples.status, status) : inArray(missionSamples.status, ['CONSENTED', 'PUBLISHED'])).orderBy(desc(missionSamples.createdAt)).limit(200);
  }

  async reviewSample(learnerId: string, lessonId: string, publish: boolean, text?: string) {
    const s = await this.db.query.missionSamples.findFirst({ where: and(eq(missionSamples.learnerId, learnerId), eq(missionSamples.lessonId, lessonId)) });
    if (!s || !['CONSENTED', 'PUBLISHED'].includes(s.status)) throw new BadRequestException({ code: 'no_consent', message: 'کنشگر هنوز اجازه نداده است' });
    await this.db.update(missionSamples).set(publish ? { status: 'PUBLISHED', publishedAt: new Date(), ...(text?.trim() ? { text: text.trim() } : {}) } : { status: 'CONSENTED', publishedAt: null })
      .where(and(eq(missionSamples.learnerId, learnerId), eq(missionSamples.lessonId, lessonId)));
    if (publish && s.status !== 'PUBLISHED') await this.notify.send(learnerId, { kind: 'sample_published', title: 'گزارش شما به‌عنوان نمونه منتشر شد', link: `/lessons/${lessonId}` });
    return { ok: true };
  }

  publishedSamples(lessonId: string) {
    return this.db.select({ text: missionSamples.text, authorLabel: missionSamples.authorLabel, publishedAt: missionSamples.publishedAt }).from(missionSamples)
      .where(and(eq(missionSamples.lessonId, lessonId), eq(missionSamples.status, 'PUBLISHED'))).orderBy(desc(missionSamples.publishedAt)).limit(10);
  }

  private async assertOwnFiles(ownerId: string, keys: string[]) {
    if (!keys.length) return;
    const fs = await this.db.select({ key: privateFiles.key }).from(privateFiles).where(and(inArray(privateFiles.key, keys), eq(privateFiles.ownerId, ownerId)));
    if (fs.length !== keys.length) throw new BadRequestException({ code: 'bad_file', message: 'یکی از عکس‌ها پیدا نشد؛ دوباره بارگذاری کنید' });
  }

  /** عکس‌های منقضی را پاک می‌کند (اصلی ۱ سال، شاهد ۶ ماه) */
  async expiredFiles() {
    return this.db.select().from(privateFiles).where(lt(privateFiles.expiresAt, new Date())).orderBy(desc(privateFiles.expiresAt)).limit(500);
  }
}
