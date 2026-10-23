import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { AccessLog } from '../security/security';
import { dec, enc } from '../common/crypto';
import { pgArr } from '../db/id';
import { counties, directMessages, mosques, registrations, users } from '../db/schema';
import { LearningService } from '../learning/learning.service';
import { Notifier } from '../notifications/notifications';
import { MissionsService } from './missions.service';
import { LAYER_FA, RahyarService } from './rahyar.service';

class ReplyDto { @IsIn(['FEEDBACK', 'REVISE', 'APPROVE', 'REPLY']) kind: 'FEEDBACK' | 'REVISE' | 'APPROVE' | 'REPLY'; @IsOptional() @IsString() @MaxLength(4000) body?: string; @IsOptional() @IsBoolean() proposeSample?: boolean; }
class SubmitDto {
  @IsString() @Length(10, 4000) did: string;
  @IsOptional() @IsString() @MaxLength(4000) learned?: string;
  @IsOptional() @IsObject() checks?: Record<string, boolean>;
  @IsOptional() @IsString() mainPhoto?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) evidence?: string[];
}
class PositionDto {
  @IsIn(['MALE', 'FEMALE']) gender: 'MALE' | 'FEMALE';
  @IsIn(['DEPUTY', 'MANAGER', 'REGIONAL', 'PROVINCIAL', 'COUNTY']) layer: 'DEPUTY' | 'MANAGER' | 'REGIONAL' | 'PROVINCIAL' | 'COUNTY';
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() provinceId?: string;
  @IsOptional() @IsString() countyId?: string;
}
class UpdatePositionDto { @IsOptional() @IsString() @MaxLength(80) title?: string; @IsOptional() @IsString() holderMobile?: string | null; @IsOptional() @IsString() parentId?: string; }
class ProvincesDto { @IsArray() @IsString({ each: true }) provinceIds: string[]; }
class AssignDto { @IsArray() @IsString({ each: true }) userIds: string[]; @IsString() positionId: string; }
class SampleDto { @IsIn(['named', 'anon', 'no']) decision: 'named' | 'anon' | 'no'; }
class SampleReviewDto { @IsBoolean() publish: boolean; @IsOptional() @IsString() @MaxLength(6000) text?: string; }
class MsgDto { @IsString() @Length(1, 2000) body: string; }
class PrefDto { @IsBoolean() allowRahyarMessages: boolean; }

@Controller()
export class RahyarController {
  constructor(
    @InjectDb() private readonly db: Db, private readonly rahyar: RahyarService, private readonly missions: MissionsService,
    private readonly learning: LearningService, private readonly notify: Notifier, private readonly access: AccessLog,
  ) {}

  // ───────── کنشگر ─────────

  /** راهیار من (برای نمایش در صفحهٔ «من» و پیام‌ها) */
  @Get('me/rahyar')
  async myRahyar(@CurrentUser() u: AuthUser) {
    const { responsible } = await this.rahyar.responsibleFor(u.id);
    if (!responsible?.holderId) return { rahyar: null };
    const h = await this.db.query.users.findFirst({ where: eq(users.id, responsible.holderId), columns: { firstName: true, lastName: true } });
    const me = await this.db.query.users.findFirst({ where: eq(users.id, u.id), columns: { allowRahyarMessages: true } });
    return { rahyar: { name: `${h?.firstName} ${h?.lastName}`, title: responsible.title, layer: LAYER_FA[responsible.layer] }, allowRahyarMessages: me?.allowRahyarMessages ?? true };
  }

  @Patch('me/prefs')
  async prefs(@CurrentUser() u: AuthUser, @Body() d: PrefDto) {
    await this.db.update(users).set({ allowRahyarMessages: d.allowRahyarMessages }).where(eq(users.id, u.id));
    return { ok: true };
  }

  @Get('missions/:lessonId')
  myThread(@CurrentUser() u: AuthUser, @Param('lessonId') lessonId: string) { return this.missions.thread(u, u.id, lessonId); }

  @Post('missions/:lessonId/submit') @HttpCode(200)
  async submit(@CurrentUser() u: AuthUser, @Param('lessonId') lessonId: string, @Body() d: SubmitDto) {
    const r = await this.missions.submit(u.id, lessonId, d);
    const completion = r.completed ? await this.learning.checkCompletion(u.id, r.courseId) : null;
    return { ...r, completion };
  }

  @Post('missions/:lessonId/reply') @HttpCode(200)
  learnerReply(@CurrentUser() u: AuthUser, @Param('lessonId') lessonId: string, @Body() d: MsgDto) {
    return this.missions.reply(u, u.id, lessonId, 'REPLY', d.body, async () => {});
  }

  @Post('missions/:lessonId/sample') @HttpCode(200)
  consentSample(@CurrentUser() u: AuthUser, @Param('lessonId') lessonId: string, @Body() d: SampleDto) { return this.missions.consentSample(u.id, lessonId, d.decision); }

  @Get('lessons/:lessonId/samples')
  samples(@Param('lessonId') lessonId: string) { return this.missions.publishedSamples(lessonId); }

  /** ستاد فقط گزارش‌هایی را می‌بیند که کنشگر اجازهٔ انتشارشان را داده (۲.۳) */
  @Get('admin/samples') @Roles('HQ_ADMIN', 'HQ_OPERATOR')
  allSamples(@Query('status') status?: string) { return this.missions.listSamples(status); }

  @Post('admin/samples/:learnerId/:lessonId') @Roles('HQ_ADMIN', 'HQ_OPERATOR') @HttpCode(200)
  reviewSample(@Param('learnerId') l: string, @Param('lessonId') ls: string, @Body() d: SampleReviewDto) { return this.missions.reviewSample(l, ls, d.publish, d.text); }

  @Get('messages')
  async myMessages(@CurrentUser() u: AuthUser) {
    await this.db.update(directMessages).set({ readByLearnerAt: new Date() }).where(and(eq(directMessages.learnerId, u.id), isNull(directMessages.readByLearnerAt)));
    return this.dmList(u.id);
  }

  @Post('messages') @HttpCode(200)
  async sendMine(@CurrentUser() u: AuthUser, @Body() d: MsgDto) {
    const { responsible } = await this.rahyar.responsibleFor(u.id);
    if (!responsible?.holderId) throw new BadRequestException({ code: 'no_rahyar', message: 'هنوز راهیاری برایتان تعیین نشده' });
    await this.db.insert(directMessages).values({ learnerId: u.id, authorId: u.id, body: enc(d.body.trim())!, readByLearnerAt: new Date() });
    await this.notify.send(responsible.holderId, { kind: 'dm', title: 'پیام تازه از یک کنشگر', link: `/rahyar/messages/${u.id}` });
    return { ok: true };
  }

  private async dmList(learnerId: string) {
    const rows = await this.db.select({ id: directMessages.id, body: directMessages.body, createdAt: directMessages.createdAt, authorId: directMessages.authorId, firstName: users.firstName, lastName: users.lastName })
      .from(directMessages).innerJoin(users, eq(users.id, directMessages.authorId)).where(eq(directMessages.learnerId, learnerId)).orderBy(asc(directMessages.createdAt)).limit(300);
    return rows.map((m) => ({ ...m, body: dec(m.body) ?? '' }));
  }

  // ───────── راهیار ─────────

  private async requireRahyar(u: AuthUser) {
    const s = await this.rahyar.snapshot();
    const held = this.rahyar.held(s, u.id);
    if (!held.length && !u.roles.includes('HQ_ADMIN')) throw new ForbiddenException({ code: 'not_rahyar', message: 'جایگاه راهیاری ندارید' });
    return { s, held };
  }

  @Get('rahyar/me')
  async me(@CurrentUser() u: AuthUser) {
    const { held } = await this.requireRahyar(u);
    const learners = await this.rahyar.learnersInScope(u.id);
    const queue = await this.missions.queue(u.id, 'open');
    return {
      positions: held.map((p) => ({ id: p.id, title: p.title, layer: p.layer, layerName: LAYER_FA[p.layer], gender: p.gender })),
      learnerCount: learners.length, directCount: learners.filter((l) => l.direct).length, openReports: queue.length, overdue: queue.filter((q) => q.overdue).length,
    };
  }

  @Get('rahyar/learners')
  async learners(@CurrentUser() u: AuthUser, @Query('q') q = '') {
    await this.requireRahyar(u);
    const list = await this.rahyar.learnersInScope(u.id);
    const ids = list.map((l) => l.id);
    if (!ids.length) return [];
    const cs = await this.db.select().from(counties);
    const ms = await this.db.select({ id: mosques.id, name: mosques.name }).from(mosques);
    const activity = await this.db.execute<{ user_id: string; last: string; active: number; done: number }>(sql`
      select u.id as user_id,
        (select max(p.updated_at) from lesson_progress p where p.user_id = u.id) as last,
        (select count(*)::int from enrollments e where e.user_id = u.id and e.completed_at is null and e.archived_at is null) as active,
        (select count(*)::int from enrollments e where e.user_id = u.id and e.completed_at is not null) as done
      from users u where u.id = any(${pgArr(ids)}::text[])`);
    const act = new Map(activity.rows.map((r) => [r.user_id, r]));
    const term = q.trim();
    return list.filter((l) => !term || (l.firstName + ' ' + l.lastName).includes(term)).map((l) => {
      const a = act.get(l.id);
      return { id: l.id, name: `${l.firstName} ${l.lastName}`, county: cs.find((c) => c.id === l.countyId)?.name ?? null, mosque: ms.find((m) => m.id === l.mosqueId)?.name ?? l.nearMosque,
        responsible: l.responsible?.title ?? null, direct: l.direct, lastActivity: a?.last ?? null, activeCourses: a?.active ?? 0, completedCourses: a?.done ?? 0, allowMessages: l.allowRahyarMessages };
    }).sort((a, b) => (a.lastActivity ?? '').localeCompare(b.lastActivity ?? ''));
  }

  @Get('rahyar/learners/:id')
  async learner(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    if (!(await this.rahyar.canSeeLearner(u.id, id, u.roles))) throw new ForbiddenException({ code: 'forbidden', message: 'این کنشگر در دامنهٔ شما نیست' });
    this.access.write(u.id, 'rahyar.learner', id);
    const p = await this.db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, firstName: true, lastName: true, countyId: true, mosqueId: true, nearMosque: true, createdAt: true, allowRahyarMessages: true } });
    const courses = await this.learning.myCourses(id);
    const missions = (await this.missions.queue(u.id, 'all')).filter((m) => m.learnerId === id);
    const att = await this.db.select({ n: sql<number>`count(*)::int` }).from(registrations).where(and(eq(registrations.userId, id), sql`${registrations.attendedAt} is not null`));
    return { ...p, courses, missions, attended: att[0].n };
  }

  @Get('rahyar/reports')
  async reports(@CurrentUser() u: AuthUser, @Query('filter') filter = 'open') {
    await this.requireRahyar(u);
    return this.missions.queue(u.id, filter === 'all' ? 'all' : 'open');
  }

  @Get('rahyar/reports/:learnerId/:lessonId')
  async thread(@CurrentUser() u: AuthUser, @Param('learnerId') l: string, @Param('lessonId') ls: string) { const t = await this.missions.thread(u, l, ls); if (u.id !== l) this.access.write(u.id, 'rahyar.report', l); return t; }

  @Post('rahyar/reports/:learnerId/:lessonId') @HttpCode(200)
  async reply(@CurrentUser() u: AuthUser, @Param('learnerId') l: string, @Param('lessonId') ls: string, @Body() d: ReplyDto) {
    if (d.kind === 'REPLY') throw new BadRequestException({ code: 'bad_kind', message: 'نوع پاسخ درست نیست' });
    const r = await this.missions.reply(u, l, ls, d.kind, d.body ?? '', (courseId) => this.learning.checkCompletion(l, courseId));
    if (d.kind === 'APPROVE' && d.proposeSample) await this.missions.proposeSample(u.id, l, ls);
    return r;
  }

  @Get('rahyar/messages')
  async conversations(@CurrentUser() u: AuthUser) {
    await this.requireRahyar(u);
    const scope = await this.rahyar.learnersInScope(u.id);
    const ids = scope.map((s) => s.id);
    if (!ids.length) return [];
    const last = await this.db.execute<{ learner_id: string; body: string; created_at: string; unread: number }>(sql`
      select distinct on (learner_id) learner_id, body, created_at,
        (select count(*)::int from direct_messages d2 where d2.learner_id = d.learner_id and d2.read_by_rahyar_at is null and d2.author_id = d2.learner_id) as unread
      from direct_messages d where learner_id = any(${pgArr(ids)}::text[]) order by learner_id, created_at desc`);
    return last.rows.map((r) => { const s = scope.find((x) => x.id === r.learner_id)!; return { learnerId: r.learner_id, name: `${s.firstName} ${s.lastName}`, last: dec(r.body) ?? '', at: r.created_at, unread: r.unread }; })
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  @Get('rahyar/messages/:learnerId')
  async conversation(@CurrentUser() u: AuthUser, @Param('learnerId') lid: string) {
    if (!(await this.rahyar.canSeeLearner(u.id, lid, u.roles))) throw new ForbiddenException({ code: 'forbidden', message: 'این کنشگر در دامنهٔ شما نیست' });
    this.access.write(u.id, 'rahyar.messages', lid);
    await this.db.update(directMessages).set({ readByRahyarAt: new Date() }).where(and(eq(directMessages.learnerId, lid), isNull(directMessages.readByRahyarAt)));
    const l = await this.db.query.users.findFirst({ where: eq(users.id, lid), columns: { firstName: true, lastName: true, allowRahyarMessages: true } });
    return { learner: { id: lid, name: `${l?.firstName} ${l?.lastName}`, allowMessages: l?.allowRahyarMessages }, messages: await this.dmList(lid) };
  }

  @Post('rahyar/messages/:learnerId') @HttpCode(200)
  async sendTo(@CurrentUser() u: AuthUser, @Param('learnerId') lid: string, @Body() d: MsgDto) {
    if (!(await this.rahyar.canSeeLearner(u.id, lid, u.roles))) throw new ForbiddenException({ code: 'forbidden', message: 'این کنشگر در دامنهٔ شما نیست' });
    const l = await this.db.query.users.findFirst({ where: eq(users.id, lid), columns: { allowRahyarMessages: true } });
    if (!l?.allowRahyarMessages) throw new ForbiddenException({ code: 'dm_off', message: 'این کنشگر پیام مستقیم راهیار را خاموش کرده است' });
    await this.db.insert(directMessages).values({ learnerId: lid, authorId: u.id, body: enc(d.body.trim())!, readByRahyarAt: new Date() });
    await this.notify.send(lid, { kind: 'dm', title: 'پیام تازه از راهیارتان', link: '/messages' });
    return { ok: true };
  }

  // ───────── ساختار راهیاری ─────────

  @Get('rahyar/tree')
  async tree(@CurrentUser() u: AuthUser, @Query('gender') g: 'MALE' | 'FEMALE' = 'MALE') {
    if (!u.roles.includes('HQ_ADMIN') && !u.roles.includes('HQ_OPERATOR')) await this.requireRahyar(u);
    const t = await this.rahyar.tree(g === 'FEMALE' ? 'FEMALE' : 'MALE');
    // شمارهٔ همراه فقط برای مدیر ستاد (برای گماشتن)؛ دیگران فقط نام می‌بینند
    return u.roles.includes('HQ_ADMIN') ? t : t.map((p) => ({ ...p, holder: p.holder ? { ...p.holder, mobile: null } : null }));
  }

  @Post('rahyar/positions')
  async create(@CurrentUser() u: AuthUser, @Body() d: PositionDto) {
    await this.rahyar.assertManager(u.id, u.roles, d.gender);
    return this.rahyar.createPosition(d);
  }

  @Patch('rahyar/positions/:id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdatePositionDto) {
    const s = await this.rahyar.snapshot(); const p = s.byId.get(id);
    if (!p) throw new BadRequestException({ code: 'no_position', message: 'جایگاه پیدا نشد' });
    await this.rahyar.assertManager(u.id, u.roles, p.gender);
    return this.rahyar.updatePosition(id, d);
  }

  @Delete('rahyar/positions/:id')
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const s = await this.rahyar.snapshot(); const p = s.byId.get(id);
    if (!p) return { ok: true };
    await this.rahyar.assertManager(u.id, u.roles, p.gender);
    return this.rahyar.deletePosition(id);
  }

  @Put('rahyar/positions/:id/provinces')
  async provinces(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: ProvincesDto) {
    const s = await this.rahyar.snapshot(); const p = s.byId.get(id);
    if (!p) throw new BadRequestException({ code: 'no_position', message: 'جایگاه پیدا نشد' });
    await this.rahyar.assertManager(u.id, u.roles, p.gender);
    return this.rahyar.setRegionProvinces(id, d.provinceIds);
  }

  @Get('rahyar/unassigned')
  unassigned(@CurrentUser() u: AuthUser) { return this.rahyar.unassigned(u.id); }

  @Put('rahyar/assignments')
  assign(@CurrentUser() u: AuthUser, @Body() d: AssignDto) { return this.rahyar.assign(u.id, u.roles, d.userIds, d.positionId); }

  /** نمای ستاد: چه کسی مسئول کیست (برای جست‌وجوی یک کنشگر) */
  @Get('admin/rahyar/resolve') @Roles('HQ_ADMIN', 'HQ_OPERATOR')
  async resolveFor(@Query('userIds') idsCsv = '') {
    const ids = idsCsv.split(',').filter(Boolean).slice(0, 100);
    if (!ids.length) return [];
    const s = await this.rahyar.snapshot();
    const us = await this.db.select({ id: users.id, gender: users.gender, countyId: users.countyId }).from(users).where(inArray(users.id, ids));
    return us.map((u) => { const r = this.rahyar.resolve(s, u); return { userId: u.id, responsible: r.responsible?.title ?? null, chain: r.chain.map((p) => p.title) }; });
  }

  @Get('rahyar/learners-recent')
  async recent(@CurrentUser() u: AuthUser) {
    const list = await this.rahyar.learnersInScope(u.id);
    return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 10).map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, createdAt: l.createdAt }));
  }
}

