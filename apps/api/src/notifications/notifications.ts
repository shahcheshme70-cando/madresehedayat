import { Body, Controller, Get, HttpCode, Injectable, Logger, Post } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { AuthUser, CurrentUser } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { notifications } from '../db/schema';
import { Messenger } from '../messenger/messenger';

export interface NotifyInput { kind: string; title: string; body?: string; link?: string }

@Injectable()
export class Notifier {
  private readonly log = new Logger('Notify');
  constructor(@InjectDb() private readonly db: Db, private readonly messenger: Messenger) {}

  /** اعلان درون‌برنامه برای یک یا چند نفر. پیامک یادآوری‌ها از همین‌جا به سرویس پیامک وصل می‌شود. */
  async send(userIds: string[] | string, n: NotifyInput) {
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
    if (!ids.length) return;
    for (let i = 0; i < ids.length; i += 500) {
      await this.db.insert(notifications).values(ids.slice(i, i + 500).map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body, link: n.link })));
    }
    this.log.log(`${n.kind} → ${ids.length} نفر`);
    // پیام‌رسان (بله) پشت صحنه؛ کندی یا خطایش جلوی کار را نمی‌گیرد
    this.messenger.push(ids, n).catch((e) => this.log.warn(`پیام‌رسان: ${e?.message ?? e}`));
  }
}

class ReadDto { @IsOptional() @IsArray() @IsString({ each: true }) ids?: string[]; }

@Controller('notifications')
export class NotificationsController {
  constructor(@InjectDb() private readonly db: Db) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(100);
  }

  @Get('unread')
  async unread(@CurrentUser() u: AuthUser) {
    const [r] = await this.db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, u.id), isNull(notifications.readAt)));
    return { count: r.n };
  }

  /** بدون ids = همه خوانده شد */
  @Post('read') @HttpCode(200)
  async read(@CurrentUser() u: AuthUser, @Body() d: ReadDto) {
    await this.db.update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.userId, u.id), isNull(notifications.readAt), d.ids?.length ? inArray(notifications.id, d.ids) : undefined));
    return { ok: true };
  }
}
