import { BadRequestException, Controller, ForbiddenException, Get, Injectable, Logger, NotFoundException, OnModuleInit, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as Minio from 'minio';
import { createId } from '../db/id';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { privateFiles } from '../db/schema';
import { RahyarService } from '../rahyar/rahyar.service';

/** فایل‌ها (صوت، PDF، ویدیوی درس‌های تعاملی) روی MinIO داخل همان سرور نگه‌داری می‌شوند. */
@Injectable()
export class FileStore implements OnModuleInit {
  private readonly log = new Logger('Files');
  readonly bucket = process.env.MINIO_BUCKET ?? 'madrese';
  readonly client = new Minio.Client({
    endPoint: process.env.MINIO_HOST ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'madrese',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'madrese-secret',
  });
  ready = false;

  async onModuleInit() {
    try {
      if (!(await this.client.bucketExists(this.bucket))) await this.client.makeBucket(this.bucket);
      this.ready = true;
    } catch (e) {
      this.log.warn('MinIO در دسترس نیست؛ بارگذاری فایل خاموش است');
    }
  }
}

const ALLOWED = /^(audio\/(mpeg|mp4|ogg|webm|x-m4a|aac)|video\/(mp4|webm)|application\/pdf|image\/(png|jpeg|webp))$/;

@Controller()
export class FilesController {
  constructor(private readonly store: FileStore, @InjectDb() private readonly db: Db, private readonly rahyar: RahyarService) {}

  @Post('admin/uploads') @Roles('HQ_ADMIN', 'HQ_OPERATOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    if (!this.store.ready) throw new BadRequestException({ code: 'storage_off', message: 'ذخیره‌ساز فایل در دسترس نیست' });
    if (!file) throw new BadRequestException({ code: 'no_file', message: 'فایلی فرستاده نشد' });
    if (!ALLOWED.test(file.mimetype)) throw new BadRequestException({ code: 'bad_type', message: 'فقط صوت، ویدیو، PDF یا تصویر' });
    const ext = (file.originalname.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const key = `${createId()}.${ext}`;
    await this.store.client.putObject(this.store.bucket, key, file.buffer, file.size, { 'Content-Type': file.mimetype });
    return { key, size: file.size, type: file.mimetype, name: file.originalname };
  }

  /**
   * عکس مأموریت (دادهٔ قرمز): فقط خود کنشگر، راهیاران بالادستش و ستاد می‌بینند.
   * عکس اصلی ۱ سال و عکس شاهد ۶ ماه نگه داشته می‌شود و بعد خودکار پاک می‌شود.
   */
  @Post('uploads/mission')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadMission(@CurrentUser() u: AuthUser, @Query('kind') kind: string, @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    if (!this.store.ready) throw new BadRequestException({ code: 'storage_off', message: 'ذخیره‌ساز فایل در دسترس نیست' });
    if (!file) throw new BadRequestException({ code: 'no_file', message: 'فایلی فرستاده نشد' });
    if (!/^image\/(png|jpeg|webp)$/.test(file.mimetype)) throw new BadRequestException({ code: 'bad_type', message: 'فقط عکس (jpg، png یا webp)' });
    const fb = kind === 'feedback'; // عکس صفحه برای بازخورد؛ ۶ ماه
    const main = kind !== 'evidence' && !fb;
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `${createId()}.${ext}`;
    await this.store.client.putObject(this.store.bucket, key, file.buffer, file.size, { 'Content-Type': file.mimetype });
    const expiresAt = new Date(Date.now() + (main ? 365 : 182) * 86400_000);
    await this.db.insert(privateFiles).values({ key, ownerId: u.id, kind: fb ? 'FEEDBACK' : main ? 'MISSION_MAIN' : 'MISSION_EVIDENCE', expiresAt });
    return { key, expiresAt };
  }

  /** فقط برای کاربرانی که وارد شده‌اند؛ پخش تکه‌ای (Range) برای صوت و ویدیو */
  @Get('files/:key')
  async get(@CurrentUser() u: AuthUser, @Param('key') key: string, @Res() res: Response) {
    if (!/^[a-z0-9]+\.[a-z0-9]{1,5}$/.test(key)) throw new NotFoundException();
    const priv = await this.db.query.privateFiles.findFirst({ where: eq(privateFiles.key, key) });
    if (priv) {
      const ok = priv.ownerId === u.id || u.roles.includes('HQ_ADMIN') || (priv.kind === 'FEEDBACK' ? u.roles.includes('HQ_OPERATOR') : await this.rahyar.canSeeLearner(u.id, priv.ownerId, u.roles));
      if (!ok) throw new ForbiddenException({ code: 'forbidden', message: 'این عکس خصوصی است' });
      if (priv.expiresAt < new Date()) throw new NotFoundException({ code: 'expired', message: 'مهلت نگه‌داری این عکس تمام شده' });
    }
    try {
      const stat = await this.store.client.statObject(this.store.bucket, key);
      const range = res.req.headers.range;
      res.setHeader('Content-Type', stat.metaData['content-type'] ?? 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', priv ? 'private, no-store' : 'private, max-age=86400');
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m?.[1] ? Number(m[1]) : 0;
        const end = m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
        res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Content-Length', String(end - start + 1));
        (await this.store.client.getPartialObject(this.store.bucket, key, start, end - start + 1)).pipe(res);
      } else {
        res.setHeader('Content-Length', String(stat.size));
        (await this.store.client.getObject(this.store.bucket, key)).pipe(res);
      }
    } catch {
      throw new NotFoundException({ code: 'no_file', message: 'فایل پیدا نشد' });
    }
  }
}
