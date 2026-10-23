import { Controller, Get, HttpCode, Injectable, Logger, Param, Post, Query } from '@nestjs/common';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { accessLogs, auditLogs, sessions, users } from '../db/schema';

/** ثبت دیدن دادهٔ شخصی به دست کارکنان و راهیاران (۱۳.۳) */
@Injectable()
export class AccessLog {
  private readonly log = new Logger('AccessLog');
  constructor(@InjectDb() private readonly db: Db) {}
  /** خطای ثبت هرگز جلوی کار اصلی را نمی‌گیرد */
  write(actorId: string, action: string, subjectId?: string | null) {
    this.db.insert(accessLogs).values({ actorId, action, subjectId: subjectId ?? null }).catch((e) => this.log.warn(String(e?.message ?? e)));
  }
  /** نگه‌داری ۱ سال (۷.۵) */
  async purge() {
    const yearAgo = new Date(Date.now() - 365 * 86400_000);
    await this.db.delete(accessLogs).where(lt(accessLogs.at, yearAgo));
    await this.db.delete(auditLogs).where(lt(auditLogs.createdAt, yearAgo));
  }
}

export const ACCESS_LABEL: Record<string, string> = {
  'users.list': 'فهرست کاربران', 'rahyar.learner': 'پروندهٔ کنشگر', 'rahyar.report': 'گزارش مأموریت', 'rahyar.messages': 'پیام‌های کنشگر',
  'ticket.view': 'درخواست پشتیبانی', 'org.view': 'اعضای سازمان', 'core.view': 'اعضای هسته', 'imam.view': 'اعضای مسجد', 'event.people': 'ثبت‌نامی‌های برنامه',
  'sample.review': 'گزارش نمونه',
};

@Controller('admin/security')
export class SecurityController {
  constructor(@InjectDb() private readonly db: Db) {}

  @Get('access') @Roles('HQ_ADMIN')
  async access(@Query('actor') actor?: string, @Query('subject') subject?: string) {
    const where = and(actor ? eq(accessLogs.actorId, actor) : undefined, subject ? eq(accessLogs.subjectId, subject) : undefined);
    const rows = await this.db.select({ id: accessLogs.id, action: accessLogs.action, at: accessLogs.at, actorId: accessLogs.actorId, subjectId: accessLogs.subjectId,
      actor: sql<string>`(select first_name || ' ' || last_name from users where id = ${accessLogs.actorId})`,
      subject: sql<string | null>`(select first_name || ' ' || last_name from users where id = ${accessLogs.subjectId})` })
      .from(accessLogs).where(where).orderBy(desc(accessLogs.at)).limit(300);
    return rows.map((r) => ({ ...r, label: ACCESS_LABEL[r.action] ?? r.action }));
  }

  /** وقتی گوشی کارمند گم شد: رمز دومش پاک می‌شود و دوباره راه می‌اندازد */
  @Post('users/:id/mfa-reset') @Roles('HQ_ADMIN') @HttpCode(200)
  async reset(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.db.update(users).set({ totpSecret: null, totpEnabledAt: null }).where(eq(users.id, id));
    await this.db.update(sessions).set({ mfaAt: null }).where(eq(sessions.userId, id));
    await this.db.insert(auditLogs).values({ actorId: u.id, action: 'mfa.reset', target: id });
    return { ok: true };
  }
}
