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
  controllers: [HealthController, AuthController, GeoController, LearningController, AdminController, FilesController],
  providers: [
    AuthService, LearningService, AdminService, FileStore,
    { provide: SmsSender, useClass: config.smsProvider === 'kavenegar' ? KavenegarSms : ConsoleSms },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
