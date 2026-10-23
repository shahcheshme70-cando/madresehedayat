import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { Public } from './common/auth.decorators';
import { AuthGuard } from './common/auth.guard';
import { config } from './config';
import { Db, DbModule, InjectDb } from './db/db.module';
import { FilesController, FileStore } from './files/files.controller';
import { GeoController } from './geo/geo.controller';
import { LearningController } from './learning/learning.controller';
import { LearningService } from './learning/learning.service';
import { CoresController } from './cores/cores.controller';
import { EventsController, Scheduler } from './events/events.controller';
import { EventsService } from './events/events.service';
import { Notifier, NotificationsController } from './notifications/notifications';
import { MissionsService } from './rahyar/missions.service';
import { RahyarController } from './rahyar/rahyar.controller';
import { RahyarService } from './rahyar/rahyar.service';
import { Broadcasts, BroadcastsController } from './broadcasts/broadcasts';
import { Campaigns, CampaignsController } from './campaigns/campaigns';
import { Business, BusinessController } from './business/business';
import { Messenger, MessengerController } from './messenger/messenger';
import { AccessLog, SecurityController } from './security/security';
import { SupportController } from './support/support';
import { ToolsController, ToolsService } from './tools/tools';
import { ConsoleSms, KavenegarSms, SmsSender } from './sms/sms';

@Controller('health')
class HealthController {
  constructor(@InjectDb() private readonly db: Db) {}
  @Public() @Get()
  async health() {
    await this.db.execute(sql`select 1`);
    return { ok: true };
  }
}

@Module({
  imports: [
    DbModule,
    JwtModule.register({ global: true, secret: config.jwtSecret }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
  ],
  controllers: [HealthController, AuthController, GeoController, LearningController, AdminController, FilesController,
    NotificationsController, RahyarController, CoresController, EventsController,
    MessengerController, SecurityController, BroadcastsController, SupportController, ToolsController, CampaignsController, BusinessController],
  providers: [
    AuthService, LearningService, AdminService, FileStore,
    Notifier, RahyarService, MissionsService, EventsService, Scheduler, Messenger, AccessLog, Broadcasts, ToolsService, Campaigns, Business,
    { provide: SmsSender, useClass: config.smsProvider === 'kavenegar' ? KavenegarSms : ConsoleSms },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
