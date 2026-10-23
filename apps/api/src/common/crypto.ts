import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { config } from '../config';

/**
 * رمزگذاری دادهٔ قرمز در پایگاه داده (۱۳.۲): AES-256-GCM با کلید DATA_KEY.
 * مقدار رمزشده با «enc:v1:» شروع می‌شود؛ متن ساده (دادهٔ قدیمی) همان‌طور برگردانده می‌شود.
 * برای شمارهٔ همراه «نمایهٔ کور» (HMAC) نگه می‌داریم تا بدون رمزگشایی جست‌وجو شود.
 */
const key = Buffer.from(config.dataKey, 'base64');
if (key.length !== 32) throw new Error('DATA_KEY باید ۳۲ بایت base64 باشد (openssl rand -base64 32)');
const indexKey = createHmac('sha256', key).update('blind-index-v1').digest();
const PREFIX = 'enc:v1:';

export function enc(text: string | null | undefined): string | null {
  if (text == null) return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function dec(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!value.startsWith(PREFIX)) return value;
  const b = Buffer.from(value.slice(PREFIX.length), 'base64');
  const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

export const isEnc = (v: unknown) => typeof v === 'string' && v.startsWith(PREFIX);

/** jsonb رمزشده: { __enc: "enc:v1:..." } */
export const encJson = (v: unknown) => (v == null ? null : { __enc: enc(JSON.stringify(v)) });
export function decJson<T = any>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === 'object' && v && '__enc' in (v as any)) return JSON.parse(dec((v as any).__enc) ?? 'null');
  return v as T;
}

/** نمایهٔ کور شمارهٔ همراه (همان شماره همیشه همان نمایه) */
export const mobileKey = (normalizedMobile: string) => 'h:' + createHmac('sha256', indexKey).update(normalizedMobile).digest('base64url').slice(0, 32);
export const isMobileKey = (v: string) => v.startsWith('h:');
