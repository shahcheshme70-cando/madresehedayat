import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** رمز یک‌بارمصرف زمانی (RFC 6238) — سازگار با Google Authenticator، Microsoft Authenticator و مانند آن‌ها */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newSecret() {
  const bytes = randomBytes(20);
  let bits = '', out = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret: string) {
  let bits = '';
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(ch); if (v >= 0) bits += v.toString(2).padStart(5, '0'); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

export function totp(secret: string, at = Date.now(), step = 30) {
  const counter = Math.floor(at / 1000 / step);
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/** یک گام قبل و بعد را هم می‌پذیرد تا اختلاف ساعت گوشی مشکل نشود */
export function verifyTotp(secret: string, code: string) {
  const c = Buffer.from(code.replace(/\s/g, ''));
  return [-1, 0, 1].some((w) => { const t = Buffer.from(totp(secret, Date.now() + w * 30_000)); return t.length === c.length && timingSafeEqual(t, c); });
}

export const otpauthUri = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent('مدرسه هدایت')}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent('Madrese Hedayat')}&digits=6&period=30`;
