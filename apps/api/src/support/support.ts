import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { dec, enc } from '../common/crypto';
import { Db, InjectDb } from '../db/db.module';
import { roleGrants, ticketMessages, tickets, users } from '../db/schema';
import { Notifier } from '../notifications/notifications';
import { AccessLog } from '../security/security';
import { Business } from '../business/business';

class NewDto { @IsIn(['LOGIN', 'COURSE', 'EVENT', 'TECH', 'OTHER']) category: string; @IsString() @Length(3, 120) subject: string; @IsString() @Length(5, 4000) body: string; }
class ReplyDto { @IsString() @Length(1, 4000) body: string; }
class AssignDto { @IsOptional() @IsString() userId?: string | null; }
class StatusDto { @IsIn(['OPEN', 'ANSWERED', 'CLOSED']) status: string; }

/** پشتیبانی از داخل سامانه (۶.۳): ستاد پاسخ می‌دهد و می‌تواند به راهیار یا مدرس ارجاع بدهد */
@Controller()
export class SupportController {
  constructor(@InjectDb() private readonly db: Db, private readonly notify: Notifier, private readonly access: AccessLog, private readonly business: Business) {}

  private isStaff = (u: AuthUser) => u.roles.includes('HQ_ADMIN') || u.roles.includes('HQ_OPERATOR');

  private async staffIds() {
    return (await this.db.selectDistinct({ id: roleGrants.userId }).from(roleGrants).where(inArray(roleGrants.role, ['HQ_ADMIN', 'HQ_OPERATOR']))).map((r) => r.id);
  }

  private async get(u: AuthUser, id: string) {
    const t = await this.db.query.tickets.findFirst({ where: eq(tickets.id, id) });
    if (!t) throw new NotFoundException({ code: 'no_ticket', message: 'درخواست پیدا نشد' });
    const role = t.userId === u.id ? 'owner' : this.isStaff(u) ? 'staff' : t.assigneeId === u.id ? 'assignee' : null;
    if (!role) throw new ForbiddenException({ code: 'forbidden', message: 'این درخواست برای شما نیست' });
    return { t, role };
  }

  private rows(where: any) {
    return this.db.select({ id: tickets.id, category: tickets.category, subject: tickets.subject, status: tickets.status, priority: tickets.priority, createdAt: tickets.createdAt, updatedAt: tickets.updatedAt,
      userName: sql<string>`(select first_name || ' ' || last_name from users where id = ${tickets.userId})`,
      assignee: sql<string | null>`(select first_name || ' ' || last_name from users where id = ${tickets.assigneeId})` })
      .from(tickets).where(where).orderBy(sql`case when ${tickets.status} = 'OPEN' and ${tickets.priority} then 0 else 1 end`, desc(tickets.updatedAt)).limit(300);
  }

  @Post('support') @HttpCode(200)
  async create(@CurrentUser() u: AuthUser, @Body() d: NewDto) {
    const open = await this.db.select({ n: sql<number>`count(*)::int` }).from(tickets).where(and(eq(tickets.userId, u.id), eq(tickets.status, 'OPEN')));
    if (open[0].n >= 5) throw new BadRequestException({ code: 'too_many', message: 'پنج درخواست باز دارید؛ لطفاً منتظر پاسخ بمانید' });
    // پشتیبانی تعهدی بستهٔ سازمانی ویژه: جلوی صف
    const priority = await this.business.hasPrioritySupport(u.id);
    const [t] = await this.db.insert(tickets).values({ userId: u.id, category: d.category, subject: d.subject.trim(), priority }).returning();
    await this.db.insert(ticketMessages).values({ ticketId: t.id, authorId: u.id, body: enc(d.body.trim())! });
    await this.notify.send(await this.staffIds(), { kind: 'ticket', title: `${priority ? '[تعهدی] ' : ''}درخواست پشتیبانی تازه: ${t.subject}`, link: `/admin/support/${t.id}` });
    return { id: t.id, priority };
  }

  @Get('support') mine(@CurrentUser() u: AuthUser) { return this.rows(eq(tickets.userId, u.id)); }
  @Get('support/assigned') assigned(@CurrentUser() u: AuthUser) { return this.rows(eq(tickets.assigneeId, u.id)); }

  @Get('support/:id')
  async thread(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const { t, role } = await this.get(u, id);
    if (role !== 'owner') this.access.write(u.id, 'ticket.view', t.userId);
    const ms = await this.db.select({ id: ticketMessages.id, body: ticketMessages.body, createdAt: ticketMessages.createdAt, authorId: ticketMessages.authorId, firstName: users.firstName, lastName: users.lastName })
      .from(ticketMessages).innerJoin(users, eq(users.id, ticketMessages.authorId)).where(eq(ticketMessages.ticketId, id)).orderBy(asc(ticketMessages.createdAt));
    const [row] = await this.rows(eq(tickets.id, id));
    return { ...row, userId: t.userId, assigneeId: t.assigneeId, role, messages: ms.map((m) => ({ ...m, body: dec(m.body) ?? '', fromUser: m.authorId === t.userId })) };
  }

  @Post('support/:id/reply') @HttpCode(200)
  async reply(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: ReplyDto) {
    const { t, role } = await this.get(u, id);
    if (t.status === 'CLOSED' && role === 'owner') throw new BadRequestException({ code: 'closed', message: 'این درخواست بسته شده؛ درخواست تازه بفرستید' });
    await this.db.insert(ticketMessages).values({ ticketId: id, authorId: u.id, body: enc(d.body.trim())! });
    await this.db.update(tickets).set({ status: role === 'owner' ? 'OPEN' : 'ANSWERED' }).where(eq(tickets.id, id));
    if (role === 'owner') await this.notify.send(t.assigneeId ? [t.assigneeId] : await this.staffIds(), { kind: 'ticket', title: `پاسخ تازه در «${t.subject}»`, link: t.assigneeId ? `/support/${id}` : `/admin/support/${id}` });
    else await this.notify.send(t.userId, { kind: 'ticket_answer', title: 'به درخواست پشتیبانی شما پاسخ داده شد', body: t.subject, link: `/support/${id}` });
    return { ok: true };
  }

  @Post('support/:id/status') @HttpCode(200)
  async status(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: StatusDto) {
    const { role } = await this.get(u, id);
    if (role === 'owner' && d.status !== 'CLOSED') throw new ForbiddenException({ code: 'forbidden', message: 'فقط می‌توانید درخواست را ببندید' });
    await this.db.update(tickets).set({ status: d.status }).where(eq(tickets.id, id));
    return { ok: true };
  }

  @Get('admin/support') @Roles('HQ_ADMIN', 'HQ_OPERATOR')
  all(@Query('status') status?: string) { return this.rows(status ? eq(tickets.status, status) : or(eq(tickets.status, 'OPEN'), eq(tickets.status, 'ANSWERED'))); }

  /** ارجاع به راهیار یا مدرس (یا برداشتن ارجاع) */
  @Post('admin/support/:id/assign') @Roles('HQ_ADMIN', 'HQ_OPERATOR') @HttpCode(200)
  async assign(@Param('id') id: string, @Body() d: AssignDto) {
    if (d.userId) {
      const ok = await this.db.query.roleGrants.findFirst({ where: and(eq(roleGrants.userId, d.userId), inArray(roleGrants.role, ['RAHYAR', 'INSTRUCTOR', 'HQ_OPERATOR', 'HQ_ADMIN'])) });
      if (!ok) throw new BadRequestException({ code: 'bad_assignee', message: 'فقط به راهیار، مدرس یا کارکنان ستاد ارجاع می‌شود' });
    }
    const [t] = await this.db.update(tickets).set({ assigneeId: d.userId || null }).where(eq(tickets.id, id)).returning();
    if (d.userId) await this.notify.send(d.userId, { kind: 'ticket_assigned', title: 'یک درخواست پشتیبانی به شما ارجاع شد', body: t.subject, link: `/support/${id}` });
    return { ok: true };
  }

  /** کسانی که می‌شود به آن‌ها ارجاع داد */
  @Get('admin/support-assignees') @Roles('HQ_ADMIN', 'HQ_OPERATOR')
  async assignees(@Query('q') q = '') {
    const r = await this.db.execute<{ id: string; name: string; roles: string[] }>(sql`
      select u.id, u.first_name || ' ' || u.last_name as name, array_agg(distinct g.role::text) as roles
      from users u join role_grants g on g.user_id = u.id
      where g.role in ('RAHYAR', 'INSTRUCTOR', 'HQ_OPERATOR', 'HQ_ADMIN') and (${q} = '' or u.first_name || ' ' || u.last_name ilike ${'%' + q + '%'})
      group by u.id order by name limit 30`);
    return r.rows;
  }
}
