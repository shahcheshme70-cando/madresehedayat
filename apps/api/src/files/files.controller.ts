import { BadRequestException, Controller, Get, Injectable, Logger, NotFoundException, OnModuleInit, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as Minio from 'minio';
import { createId } from '../db/id';
import { Roles } from '../common/auth.decorators';

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
  constructor(private readonly store: FileStore) {}

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

  /** فقط برای کاربرانی که وارد شده‌اند؛ پخش تکه‌ای (Range) برای صوت و ویدیو */
  @Get('files/:key')
  async get(@Param('key') key: string, @Res() res: Response) {
    if (!/^[a-z0-9]+\.[a-z0-9]{1,5}$/.test(key)) throw new NotFoundException();
    try {
      const stat = await this.store.client.statObject(this.store.bucket, key);
      const range = res.req.headers.range;
      res.setHeader('Content-Type', stat.metaData['content-type'] ?? 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=86400');
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
