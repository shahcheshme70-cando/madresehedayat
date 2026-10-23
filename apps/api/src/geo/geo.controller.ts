import { Controller, Get, Query } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { Public } from '../common/auth.decorators';
import { Db, InjectDb } from '../db/db.module';
import { counties, mosques, provinces } from '../db/schema';

@Controller('geo')
export class GeoController {
  constructor(@InjectDb() private readonly db: Db) {}

  /** استان‌ها با شهرستان‌هایشان */
  @Public() @Get('provinces')
  async provinces() {
    const ps = await this.db.select().from(provinces).orderBy(asc(provinces.name));
    const cs = await this.db.select().from(counties).orderBy(asc(counties.name));
    return ps.map((p) => ({ id: p.id, name: p.name, counties: cs.filter((c) => c.provinceId === p.id).map((c) => ({ id: c.id, name: c.name })) }));
  }

  /** مساجد تأییدشدهٔ یک شهرستان */
  @Public() @Get('mosques')
  async mosques(@Query('countyId') countyId: string) {
    if (!countyId) return [];
    return this.db.select({ id: mosques.id, name: mosques.name }).from(mosques)
      .where(eq(mosques.countyId, countyId)).orderBy(asc(mosques.name));
  }
}
