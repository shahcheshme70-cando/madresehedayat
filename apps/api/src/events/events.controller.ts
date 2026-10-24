import { Body, Controller, Delete, Get, Header, HttpCode, Injectable, Logger, OnModuleDestroy, OnModuleInit, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { inArray } from 'drizzle-orm';
import { AuthUser, CurrentUser } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { AccessLog } from '../security/security';
import { privateFiles } from '../db/schema';
import { FileStore } from '../files/files.controller';
import { MissionsService } from '../rahyar/missions.service';
import { Messenger } from '../messenger/messenger';
import { Business } from '../business/business';
import { bbbEnabled, LiveService } from '../live/live';
import { EventInput, EventsService } from './events.service';

class GroupDto { @IsString() coreId: string; @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) userIds: string[]; }
class FeedbackDto { @IsInt() @Min(1) @Max(5) rating: number; @IsOptional() @IsString() @Length(0, 1000) comment?: string; }
class CancelDto { @IsString() @Length(3, 500) reason: string; }
class CheckDto { @IsString() @Length(4, 200) code: string; }
class BulkDto { @IsArray() @ArrayMaxSize(2000) items: { code: string; at?: string }[]; }
class DecideDto { @IsIn(['approve', 'reject', 'attend', 'unattend']) action: 'approve' | 'reject' | 'attend' | 'unattend'; }
class NotifyDto { @IsString() @Length(2, 120) title: string; @IsOptional() @IsString() @Length(0, 1000) body?: string; @IsOptional() @IsIn(['registered', 'all']) to?: 'registered' | 'all'; }

@Controller()
export class EventsController {
  constructor(private readonly svc: EventsService, private readonly access: AccessLog) {}

  @Get('events')
  list(@CurrentUser() u: AuthUser, @Query('scope') scope?: string) {
    return this.svc.list(u, scope === 'mine' ? 'mine' : scope === 'past' ? 'past' : 'upcoming');
  }
  @Get('events/:id') detail(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.detail(u, id); }
  @Post('events/:id/register') @HttpCode(200) register(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.register(u, id); }
  @Post('events/:id/register-group') @HttpCode(200) group(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: GroupDto) { return this.svc.registerGroup(u, id, d.coreId, d.userIds); }
  @Post('events/:id/cancel') @HttpCode(200) cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.cancel(u, id); }
  @Post('events/:id/feedback') @HttpCode(200) feedback(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: FeedbackDto) { return this.svc.feedback(u, id, d); }
  @Post('events/:id/join') @HttpCode(200) join(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.join(u, id); }

  @Get('events/:id/ics') @Header('Content-Type', 'text/calendar; charset=utf-8')
  async ics(@Param('id') id: string, @Res() res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="event-${id}.ics"`);
    res.send(await this.svc.ics(id));
  }

  // ───────── برگزارکننده ─────────
  @Get('manage/events/options')
  async options(@CurrentUser() u: AuthUser) { return { open: this.svc.canCreate(u, 'IN_PERSON') ? 'ALL' : this.svc.canCreate(u, 'ONLINE') ? 'ONLINE' : null, scoped: await this.svc.scopedOptions(u), bbb: bbbEnabled() }; }
  @Get('manage/events')
  managed(@CurrentUser() u: AuthUser) { return this.svc.managed(u); }
  @Post('manage/events')
  create(@CurrentUser() u: AuthUser, @Body() d: EventInput) { return this.svc.create(u, d); }
  @Get('manage/events/:id') async registrants(@CurrentUser() u: AuthUser, @Param('id') id: string) { const r = await this.svc.registrants(u, id); this.access.write(u.id, 'event.people', null); return r; }
  @Patch('manage/events/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: EventInput & { notify?: boolean }) { return this.svc.update(u, id, d); }
  @Delete('manage/events/:id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.remove(u, id); }
  @Post('manage/events/:id/publish') @HttpCode(200) publish(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.publish(u, id); }
  @Post('manage/events/:id/cancel') @HttpCode(200) cancelEvent(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CancelDto) { return this.svc.cancelEvent(u, id, d.reason); }
  @Post('manage/events/:id/people/:userId') @HttpCode(200) decide(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') uid: string, @Body() d: DecideDto) { return this.svc.decide(u, id, uid, d.action); }
  @Post('manage/events/:id/checkin') @HttpCode(200) checkIn(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: CheckDto) { return this.svc.checkIn(u, id, d.code); }
  @Post('manage/events/:id/checkin-bulk') @HttpCode(200) bulk(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: BulkDto) { return this.svc.checkInBulk(u, id, d.items); }
  @Post('manage/events/:id/notify') @HttpCode(200) notify(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: NotifyDto) { return this.svc.notifyRegistrants(u, id, d); }

  @Get('manage/events/:id/csv')
  async csv(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const f = await this.svc.csv(u, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.send(f.body);
  }
}

/** کارهای زمان‌دار: یادآوری برنامه‌ها (هر دقیقه)، پیگیری گزارش‌های بی‌پاسخ و پاک‌کردن عکس‌های تاریخ‌گذشته (هر ساعت) */
@Injectable()
export class Scheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Scheduler');
  private timers: NodeJS.Timeout[] = [];
  constructor(private readonly events: EventsService, private readonly missions: MissionsService, private readonly store: FileStore, @InjectDb() private readonly db: Db,
    private readonly messenger: Messenger, private readonly access: AccessLog, private readonly business: Business, private readonly live: LiveService) {}

  onModuleInit() {
    if (process.env.SCHEDULER === 'off') return;
    const safe = (name: string, fn: () => Promise<unknown>) => () => fn().catch((e) => this.log.error(`${name}: ${e?.message ?? e}`));
    this.timers.push(setInterval(safe('reminders', () => this.events.sendReminders()), 60_000));
    // کلاس زنده: حاضران هر دقیقه، حضور نهایی و ضبط‌ها هر ۵ دقیقه
    this.timers.push(setInterval(safe('live-poll', () => this.live.poll()), 60_000));
    this.timers.push(setInterval(safe('live-final', () => this.live.finalize()), 5 * 60_000));
    this.timers.push(setInterval(safe('escalate', () => this.missions.escalate()), 3600_000));
    this.timers.push(setInterval(safe('expire', () => this.expire()), 3600_000));
    this.timers.push(setInterval(safe('purge', () => this.access.purge()), 24 * 3600_000));
    this.timers.push(setInterval(safe('subscriptions', () => this.business.remindExpiry()), 6 * 3600_000));
    // کد اتصال بله؛ اگر بات تنظیم نشده باشد کاری نمی‌کند
    let polling = false;
    this.timers.push(setInterval(() => { if (polling || !this.messenger.baleEnabled) return; polling = true; this.messenger.poll().catch((e) => this.log.warn(`بله: ${e?.message ?? e}`)).finally(() => (polling = false)); }, 4000));
    setTimeout(safe('first', async () => { await this.events.sendReminders(); await this.missions.escalate(); await this.expire(); await this.business.remindExpiry(); }), 5_000);
  }
  onModuleDestroy() { this.timers.forEach(clearInterval); }

  /** عکس اصلی مأموریت پس از ۱ سال و عکس شاهد پس از ۶ ماه پاک می‌شود */
  async expire() {
    const rows = await this.missions.expiredFiles();
    if (!rows.length) return;
    for (const r of rows) {
      try { if (this.store.ready) await this.store.client.removeObject(this.store.bucket, r.key); } catch { /* ممکن است پیش‌تر پاک شده باشد */ }
    }
    await this.db.delete(privateFiles).where(inArray(privateFiles.key, rows.map((r) => r.key)));
    this.log.log(`پاک شد: ${rows.length} عکس تاریخ‌گذشته`);
  }
}
