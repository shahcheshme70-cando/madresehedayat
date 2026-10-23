import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.decorators';
import { dec, decJson, enc, encJson, mobileKey } from '../common/crypto';
import { normalizeMobile } from '../common/mobile';
import { Db, InjectDb } from '../db/db.module';
import { boardComments, boardMembers, boards, boardVersions, coreMemberships, lessonProgress, lessons, modules, toolStatus, users } from '../db/schema';
import { LearningService } from '../learning/learning.service';
import { Notifier } from '../notifications/notifications';
import { RahyarService } from '../rahyar/rahyar.service';
import catalog from './catalog.json';

export const TOOLS: any[] = (catalog as any).tools;
export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
const VERSION_GAP_MS = 10 * 60_000;

class NewBoardDto { @IsString() toolId: string; @IsOptional() @IsString() @Length(1, 120) title?: string; }
class SaveDto { @IsOptional() @IsObject() data?: Record<string, unknown>; @IsOptional() @IsString() @Length(1, 120) title?: string; @IsOptional() @IsString() base?: string; }
class MemberDto { @IsOptional() @IsString() userId?: string; @IsOptional() @IsString() mobile?: string; @IsIn(['EDITOR', 'VIEWER']) role: 'EDITOR' | 'VIEWER'; }
class CommentDto { @IsString() @Length(1, 2000) body: string; }
class PublicDto { @IsBoolean() on: boolean; }
class PublishDto { @IsBoolean() published: boolean; }

/** آیا کار چیزی دارد؟ (برای پایان درس) */
export function boardFilled(d: any) {
  if (!d) return false;
  const notes = Object.values(d.n ?? {}).reduce((s: number, a: any) => s + (Array.isArray(a) ? a.length : 0), 0);
  const fields = Object.values(d.f ?? {}).filter((v) => String(v ?? '').trim()).length;
  return notes + fields + Object.keys(d.dm?.s ?? {}).length + Object.keys(d.raci?.m ?? {}).length > 0;
}

@Injectable()
export class ToolsService {
  constructor(@InjectDb() private readonly db: Db, private readonly notify: Notifier, private readonly learning: LearningService, private readonly rahyar: RahyarService) {}

  async published() {
    const st = await this.db.select().from(toolStatus);
    return new Set(st.filter((s) => s.published).map((s) => s.toolId));
  }

  async access(u: AuthUser, id: string) {
    const b = await this.db.query.boards.findFirst({ where: eq(boards.id, id) });
    if (!b) throw new NotFoundException({ code: 'no_board', message: 'این کار پیدا نشد' });
    if (b.ownerId === u.id) return { b, role: 'OWNER' as const };
    const m = await this.db.query.boardMembers.findFirst({ where: and(eq(boardMembers.boardId, id), eq(boardMembers.userId, u.id)) });
    if (m) return { b, role: m.role as 'EDITOR' | 'VIEWER' };
    throw new ForbiddenException({ code: 'forbidden', message: 'این کار با شما به اشتراک گذاشته نشده' });
  }

  initialData(tool: any) {
    const d: any = { n: {}, f: {} };
    if (tool.dm) d.dm = { opts: [...tool.dm.opts], crit: tool.dm.crit.map((c: any) => ({ ...c })), s: {} };
    if (tool.raci) d.raci = { tasks: [...tool.raci.tasks], roles: [...tool.raci.roles], m: {} };
    if (tool.bud) d.bud = { rows: tool.bud.rows.map((r: any) => ({ ...r })), ppl: tool.bud.ppl };
    return d;
  }

  async create(u: AuthUser, toolId: string, title?: string, lessonId?: string) {
    const t = toolById(toolId);
    if (!t) throw new BadRequestException({ code: 'no_tool', message: 'ابزار پیدا نشد' });
    const [b] = await this.db.insert(boards).values({ ownerId: u.id, toolId, title: title?.trim() || t.t, data: encJson(this.initialData(t)), lessonId: lessonId ?? null, updatedById: u.id }).returning();
    return b;
  }

  async save(u: AuthUser, id: string, d: SaveDto) {
    const { b, role } = await this.access(u, id);
    if (role === 'VIEWER') throw new ForbiddenException({ code: 'viewer', message: 'فقط می‌توانید ببینید و نظر بدهید' });
    // کار گروهی ناهم‌زمان: اگر کس دیگری در این فاصله ذخیره کرده، به‌جای پاک کردن کار او خبر می‌دهیم
    if (d.base && b.updatedAt.toISOString() !== d.base && b.updatedById && b.updatedById !== u.id) {
      throw new BadRequestException({ code: 'conflict', message: 'هم‌کارتان همین حالا این کار را تغییر داده؛ صفحه تازه می‌شود تا آخرین نسخه را ببینید' });
    }
    const set: Partial<typeof boards.$inferInsert> = { updatedById: u.id };
    if (d.title) set.title = d.title.trim();
    if (d.data) set.data = encJson(d.data);
    const [n] = await this.db.update(boards).set(set).where(eq(boards.id, id)).returning();
    if (d.data) {
      // هر ذخیره یک نسخه؛ ذخیره‌های پشت‌سرهم یک نفر در ۱۰ دقیقه یک نسخه حساب می‌شوند
      const [last] = await this.db.select().from(boardVersions).where(eq(boardVersions.boardId, id)).orderBy(desc(boardVersions.createdAt)).limit(1);
      if (last && last.authorId === u.id && Date.now() - last.createdAt.getTime() < VERSION_GAP_MS) await this.db.update(boardVersions).set({ data: encJson(d.data) }).where(eq(boardVersions.id, last.id));
      else await this.db.insert(boardVersions).values({ boardId: id, authorId: u.id, data: encJson(d.data) });
      if (b.lessonId && b.ownerId === u.id && boardFilled(d.data)) await this.completeLesson(u.id, b.lessonId);
      if (b.ownerId !== u.id && (!last || last.authorId !== u.id)) {
        const me = await this.db.query.users.findFirst({ where: eq(users.id, u.id), columns: { firstName: true, lastName: true } });
        await this.notify.send(b.ownerId, { kind: 'board_edit', title: `${me?.firstName} ${me?.lastName} کار «${n.title}» را ویرایش کرد`, link: `/tools/boards/${id}` });
      }
    }
    return { updatedAt: n.updatedAt };
  }

  private async completeLesson(userId: string, lessonId: string) {
    const ex = await this.db.query.lessonProgress.findFirst({ where: and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)) });
    if (ex?.completedAt) return;
    await this.db.insert(lessonProgress).values({ userId, lessonId, completedAt: new Date() })
      .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: { completedAt: new Date() } });
    const row = await this.db.select({ courseId: modules.courseId }).from(lessons).innerJoin(modules, eq(modules.id, lessons.moduleId)).where(eq(lessons.id, lessonId)).then((r) => r[0]);
    if (row) await this.learning.checkCompletion(userId, row.courseId);
  }

  /** درس «ابزار کار»: کار همین درس را برمی‌گرداند یا می‌سازد */
  async forLesson(u: AuthUser, lessonId: string) {
    const l = await this.db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
    if (!l || l.type !== 'TOOL') throw new NotFoundException({ code: 'no_lesson', message: 'درس ابزار پیدا نشد' });
    const toolId = (l.content as any)?.toolId;
    const ex = await this.db.query.boards.findFirst({ where: and(eq(boards.ownerId, u.id), eq(boards.lessonId, lessonId)) });
    return ex ?? this.create(u, toolId, `${toolById(toolId)?.t ?? 'کار'} · ${l.title}`, lessonId);
  }

  async view(u: AuthUser, id: string) {
    const { b, role } = await this.access(u, id);
    const members = await this.db.select({ userId: boardMembers.userId, role: boardMembers.role, firstName: users.firstName, lastName: users.lastName }).from(boardMembers).innerJoin(users, eq(users.id, boardMembers.userId)).where(eq(boardMembers.boardId, id));
    const owner = await this.db.query.users.findFirst({ where: eq(users.id, b.ownerId), columns: { firstName: true, lastName: true } });
    const comments = await this.db.select({ id: boardComments.id, body: boardComments.body, createdAt: boardComments.createdAt, authorId: boardComments.authorId, firstName: users.firstName, lastName: users.lastName })
      .from(boardComments).innerJoin(users, eq(users.id, boardComments.authorId)).where(eq(boardComments.boardId, id)).orderBy(boardComments.createdAt);
    return {
      id: b.id, toolId: b.toolId, title: b.title, data: decJson(b.data) ?? this.initialData(toolById(b.toolId)), lessonId: b.lessonId, updatedAt: b.updatedAt, createdAt: b.createdAt,
      role, owner: `${owner?.firstName} ${owner?.lastName}`, publicToken: role === 'OWNER' ? b.publicToken : null,
      members: members.map((m) => ({ userId: m.userId, role: m.role, name: `${m.firstName} ${m.lastName}` })),
      comments: comments.map((c) => ({ ...c, body: dec(c.body) ?? '' })),
    };
  }

  async mine(u: AuthUser) {
    const own = await this.db.select({ id: boards.id, toolId: boards.toolId, title: boards.title, updatedAt: boards.updatedAt, lessonId: boards.lessonId, publicToken: boards.publicToken }).from(boards).where(eq(boards.ownerId, u.id)).orderBy(desc(boards.updatedAt));
    const shared = await this.db.select({ id: boards.id, toolId: boards.toolId, title: boards.title, updatedAt: boards.updatedAt, role: boardMembers.role, owner: sql<string>`(select first_name || ' ' || last_name from users where id = ${boards.ownerId})` })
      .from(boardMembers).innerJoin(boards, eq(boards.id, boardMembers.boardId)).where(eq(boardMembers.userId, u.id)).orderBy(desc(boards.updatedAt));
    return { own: own.map((b) => ({ ...b, isPublic: !!b.publicToken, publicToken: undefined })), shared };
  }

  /** با چه کسانی می‌شود به اشتراک گذاشت: راهیار، هم‌هسته‌ای‌ها (بدون نمایش شماره) */
  async shareOptions(u: AuthUser) {
    const out: { userId: string; name: string; why: string }[] = [];
    const { responsible } = await this.rahyar.responsibleFor(u.id);
    if (responsible?.holderId) {
      const r = await this.db.query.users.findFirst({ where: eq(users.id, responsible.holderId), columns: { firstName: true, lastName: true } });
      out.push({ userId: responsible.holderId, name: `${r?.firstName} ${r?.lastName}`, why: 'راهیار شما' });
    }
    const myCores = await this.db.select({ coreId: coreMemberships.coreId }).from(coreMemberships).where(eq(coreMemberships.userId, u.id));
    if (myCores.length) {
      const mates = await this.db.selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(coreMemberships).innerJoin(users, eq(users.id, coreMemberships.userId))
        .where(and(inArray(coreMemberships.coreId, myCores.map((c) => c.coreId)), sql`${users.id} <> ${u.id}`));
      for (const m of mates) if (!out.some((o) => o.userId === m.id)) out.push({ userId: m.id, name: `${m.firstName} ${m.lastName}`, why: 'هم‌هسته‌ای' });
    }
    return out;
  }

  async addMember(u: AuthUser, id: string, d: MemberDto) {
    const { b, role } = await this.access(u, id);
    if (role !== 'OWNER') throw new ForbiddenException({ code: 'forbidden', message: 'فقط صاحب کار' });
    let userId = d.userId;
    if (!userId && d.mobile) {
      const n = normalizeMobile(d.mobile);
      const x = n ? await this.db.query.users.findFirst({ where: eq(users.mobile, mobileKey(n)), columns: { id: true } }) : undefined;
      if (!x) throw new BadRequestException({ code: 'no_user', message: 'کسی با این شماره در مدرسه حساب ندارد' });
      userId = x.id;
    }
    if (!userId || userId === u.id) throw new BadRequestException({ code: 'bad_member', message: 'نفر را انتخاب کنید' });
    await this.db.insert(boardMembers).values({ boardId: id, userId, role: d.role }).onConflictDoUpdate({ target: [boardMembers.boardId, boardMembers.userId], set: { role: d.role } });
    const me = await this.db.query.users.findFirst({ where: eq(users.id, u.id), columns: { firstName: true, lastName: true } });
    await this.notify.send(userId, { kind: 'board_share', title: d.role === 'EDITOR' ? `${me?.firstName} ${me?.lastName} شما را هم‌کار «${b.title}» کرد` : `${me?.firstName} ${me?.lastName} کار «${b.title}» را با شما به اشتراک گذاشت`, link: `/tools/boards/${id}` });
    return { ok: true };
  }

  async removeMember(u: AuthUser, id: string, userId: string) {
    const { role } = await this.access(u, id);
    if (role !== 'OWNER' && userId !== u.id) throw new ForbiddenException({ code: 'forbidden', message: 'فقط صاحب کار' });
    await this.db.delete(boardMembers).where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, userId)));
    return { ok: true };
  }

  async comment(u: AuthUser, id: string, body: string) {
    const { b } = await this.access(u, id);
    await this.db.insert(boardComments).values({ boardId: id, authorId: u.id, body: enc(body.trim())! });
    const others = [b.ownerId, ...(await this.db.select({ id: boardMembers.userId }).from(boardMembers).where(eq(boardMembers.boardId, id))).map((m) => m.id)].filter((x) => x !== u.id);
    await this.notify.send(others, { kind: 'board_comment', title: `نظر تازه روی «${b.title}»`, link: `/tools/boards/${id}` });
    return { ok: true };
  }

  async versions(u: AuthUser, id: string) {
    await this.access(u, id);
    return this.db.select({ id: boardVersions.id, createdAt: boardVersions.createdAt, author: sql<string>`(select first_name || ' ' || last_name from users where id = ${boardVersions.authorId})` })
      .from(boardVersions).where(eq(boardVersions.boardId, id)).orderBy(desc(boardVersions.createdAt)).limit(50);
  }

  async restore(u: AuthUser, id: string, versionId: string) {
    const { role } = await this.access(u, id);
    if (role === 'VIEWER') throw new ForbiddenException({ code: 'viewer', message: 'فقط صاحب کار یا هم‌کار' });
    const v = await this.db.query.boardVersions.findFirst({ where: and(eq(boardVersions.id, versionId), eq(boardVersions.boardId, id)) });
    if (!v) throw new NotFoundException({ code: 'no_version', message: 'نسخه پیدا نشد' });
    await this.db.update(boards).set({ data: v.data, updatedById: u.id }).where(eq(boards.id, id));
    await this.db.insert(boardVersions).values({ boardId: id, authorId: u.id, data: v.data });
    return { ok: true };
  }

  /** پیوند عمومی (۵.۴): فقط صاحب کار، با هشدار، و هر وقت بخواهد قطع می‌کند */
  async setPublic(u: AuthUser, id: string, on: boolean) {
    const { role } = await this.access(u, id);
    if (role !== 'OWNER') throw new ForbiddenException({ code: 'forbidden', message: 'فقط صاحب کار' });
    const token = on ? randomBytes(12).toString('base64url') : null;
    await this.db.update(boards).set({ publicToken: token }).where(eq(boards.id, id));
    return { publicToken: token };
  }

  async publicView(token: string) {
    const b = await this.db.query.boards.findFirst({ where: eq(boards.publicToken, token) });
    if (!b) throw new NotFoundException({ code: 'no_board', message: 'این پیوند دیگر فعال نیست' });
    return { toolId: b.toolId, title: b.title, data: decJson(b.data), updatedAt: b.updatedAt };
  }

  async remove(u: AuthUser, id: string) {
    const { role } = await this.access(u, id);
    if (role !== 'OWNER') throw new ForbiddenException({ code: 'forbidden', message: 'فقط صاحب کار' });
    await this.db.delete(boards).where(eq(boards.id, id));
    return { ok: true };
  }

  /** آمار بی‌نام برای ستاد (۵.۵): شمار کارها و درصد کارهای پرشده؛ محتوا هرگز */
  async stats() {
    const rows = await this.db.select({ toolId: boards.toolId, data: boards.data, shared: sql<number>`(select count(*)::int from board_members m where m.board_id = ${boards.id})` }).from(boards);
    const st = await this.db.select().from(toolStatus);
    return TOOLS.map((t) => {
      const mine = rows.filter((r) => r.toolId === t.id);
      return { id: t.id, title: t.t, cat: t.cat, published: !!st.find((s) => s.toolId === t.id)?.published,
        boards: mine.length, filled: mine.filter((r) => boardFilled(decJson(r.data))).length, shared: mine.filter((r) => r.shared > 0).length };
    });
  }
}

@Controller()
export class ToolsController {
  constructor(private readonly s: ToolsService, @InjectDb() private readonly db: Db) {}

  /** فهرست ابزارها (فقط منتشرشده‌ها برای همه؛ ستاد همه را می‌بیند) */
  @Public() @Get('tools')
  async catalog(@Query('all') all?: string) {
    const pub = await this.s.published();
    return { categories: (catalog as any).categories, tools: TOOLS.filter((t) => all === '1' || pub.has(t.id)).map((t) => ({ ...t, published: pub.has(t.id) })) };
  }

  @Get('boards') mine(@CurrentUser() u: AuthUser) { return this.s.mine(u); }
  @Post('boards') @HttpCode(200) async create(@CurrentUser() u: AuthUser, @Body() d: NewBoardDto) {
    if (!(await this.s.published()).has(d.toolId) && !u.roles.includes('HQ_ADMIN') && !u.roles.includes('HQ_OPERATOR')) throw new BadRequestException({ code: 'not_published', message: 'این ابزار هنوز منتشر نشده' });
    const b = await this.s.create(u, d.toolId, d.title); return { id: b.id };
  }
  @Get('boards/share-options') shareOptions(@CurrentUser() u: AuthUser) { return this.s.shareOptions(u); }
  @Get('boards/lesson/:lessonId') async forLesson(@CurrentUser() u: AuthUser, @Param('lessonId') l: string) { const b = await this.s.forLesson(u, l); return { id: b.id }; }
  @Get('boards/:id') view(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.s.view(u, id); }
  @Put('boards/:id') save(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: SaveDto) { return this.s.save(u, id, d); }
  @Delete('boards/:id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.s.remove(u, id); }
  @Post('boards/:id/members') @HttpCode(200) addMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: MemberDto) { return this.s.addMember(u, id, d); }
  @Delete('boards/:id/members/:userId') removeMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') uid: string) { return this.s.removeMember(u, id, uid); }
  @Post('boards/:id/comments') @HttpCode(200) comment(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CommentDto) { return this.s.comment(u, id, d.body); }
  @Get('boards/:id/versions') versions(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.s.versions(u, id); }
  @Post('boards/:id/versions/:vid/restore') @HttpCode(200) restore(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('vid') vid: string) { return this.s.restore(u, id, vid); }
  @Post('boards/:id/public') @HttpCode(200) setPublic(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PublicDto) { return this.s.setPublic(u, id, d.on); }
  @Public() @Get('public/boards/:token') publicView(@Param('token') t: string) { return this.s.publicView(t); }

  @Get('admin/tools') @Roles('HQ_ADMIN', 'HQ_OPERATOR') stats() { return this.s.stats(); }
  @Patch('admin/tools/:id') @Roles('HQ_ADMIN')
  async publish(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PublishDto) {
    if (!toolById(id)) throw new NotFoundException({ code: 'no_tool', message: 'ابزار پیدا نشد' });
    await this.db.insert(toolStatus).values({ toolId: id, published: d.published, reviewedById: u.id }).onConflictDoUpdate({ target: toolStatus.toolId, set: { published: d.published, reviewedById: u.id } });
    return { ok: true };
  }
}

