import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { enc, encJson, isEnc, mobileKey } from '../common/crypto';

/** یک‌بار پس از مهاجرت: دادهٔ قرمز قدیمی را رمزگذاری می‌کند (تکرارش بی‌خطر است). */
export async function encryptExisting(db: NodePgDatabase) {
  const us = await db.execute<{ id: string; mobile: string; national_id: string | null }>(sql`select id, mobile, national_id from users where mobile not like 'h:%'`);
  for (const u of us.rows) {
    await db.execute(sql`update users set mobile = ${mobileKey(u.mobile)}, mobile_enc = ${enc(u.mobile)},
      national_id = ${u.national_id && !isEnc(u.national_id) ? enc(u.national_id) : u.national_id} where id = ${u.id}`);
  }
  await db.execute(sql`delete from otp_requests where mobile not like 'h:%'`);
  for (const t of ['direct_messages', 'mission_messages']) {
    const rows = await db.execute<{ id: string; body: string }>(sql.raw(`select id, body from ${t} where body not like 'enc:v1:%'`));
    for (const r of rows.rows) await db.execute(sql`update ${sql.raw(t)} set body = ${enc(r.body)} where id = ${r.id}`);
  }
  const ps = await db.execute<{ user_id: string; lesson_id: string; data: unknown }>(sql`select user_id, lesson_id, data from lesson_progress where data is not null and not (data ? '__enc')`);
  for (const p of ps.rows) await db.execute(sql`update lesson_progress set data = ${JSON.stringify(encJson(p.data))}::jsonb where user_id = ${p.user_id} and lesson_id = ${p.lesson_id}`);
  if (us.rows.length || ps.rows.length) console.log(`رمزگذاری دادهٔ قبلی: ${us.rows.length} کاربر، ${ps.rows.length} پیشرفت`);
}
