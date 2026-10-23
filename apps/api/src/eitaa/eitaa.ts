import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/**
 * برنامهٔ ایتا (eitaayar.ir): مدرسه داخل ایتا باز می‌شود، کاربر با حساب ایتا وارد می‌شود و اعلان‌ها در ایتا هم می‌رسد.
 * اعتبارسنجی initData طبق مستند «احراز هویت با hash» ایتا (همان روش برنامک‌های تلگرام):
 *   کلید = HMAC_SHA256(key="WebAppData", data=token) ؛ امضا = HMAC_SHA256(key=کلید, data=جفت‌های مرتب‌شده با \n) به هگز
 */
export const eitaaEnabled = () => !!config.eitaaToken;

export function verifyEitaa(raw: string, maxAgeSec = 24 * 3600): URLSearchParams | null {
  if (!config.eitaaToken || !raw) return null;
  const p = new URLSearchParams(raw);
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const data = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const key = createHmac('sha256', 'WebAppData').update(config.eitaaToken).digest();
  const sig = createHmac('sha256', key).update(data).digest('hex');
  const a = Buffer.from(sig), b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const at = Number(p.get('auth_date') ?? 0);
  if (!at || Date.now() / 1000 - at > maxAgeSec) return null;
  return p;
}

export interface EitaaUser { id: string; firstName: string; lastName: string; allowsWrite: boolean }
export function eitaaUser(p: URLSearchParams): EitaaUser | null {
  try {
    const u = JSON.parse(p.get('user') ?? 'null');
    if (!u?.id) return null;
    return { id: String(u.id), firstName: u.first_name ?? '', lastName: u.last_name ?? '', allowsWrite: !!u.allows_write_to_pm };
  } catch { return null; }
}

/** شمارهٔ همراه از پاسخ requestContact (همان امضا)؛ شکل دقیق پاسخ را با توکن واقعی باید آزمود */
export function contactPhone(p: URLSearchParams): string | null {
  const direct = p.get('phone_number') ?? p.get('phone');
  if (direct) return direct;
  try { const c = JSON.parse(p.get('contact') ?? 'null'); return c?.phone_number ?? c?.phone ?? null; } catch { return null; }
}

/** پیام به کاربر از طریق برنامه (فقط اگر کاربر دکمهٔ شروع را زده باشد؛ اعتبار روزانه دارد) */
export async function eitaaSend(chatId: string, text: string) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15_000);
  try {
    const r = await fetch('https://eitaayar.ir/api/app/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: config.eitaaToken, chat_id: Number(chatId), text }), signal: ac.signal });
    const j = (await r.json().catch(() => ({}))) as any;
    if (!j.ok) throw new Error(j.description ?? j.result ?? `HTTP ${r.status}`);
  } finally { clearTimeout(t); }
}

/** نشانه‌های مارک‌داون ایتا در متن کاربر خنثی می‌شوند */
export const eitaaEscape = (s: string) => s.replace(/([*_`\[\]\\])/g, '\\$1');

/** اصالت‌سنجی یک‌بارمصرف hash نزد سرور ایتا (حداکثر یک دقیقه پس از ساخت) — جلوی استفادهٔ دوباره از دادهٔ ربوده‌شده را می‌گیرد */
export async function eitaaVerifyOnce(hash: string, ip: string) {
  if (config.eitaaToken.startsWith('test:')) return true;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch('https://eitaayar.ir/api/app/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: config.eitaaToken, hash, ip }), signal: ac.signal });
    return !!((await r.json().catch(() => ({}))) as any).ok;
  } catch { return false; } finally { clearTimeout(t); }
}
