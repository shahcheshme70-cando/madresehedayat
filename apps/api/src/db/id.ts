import { randomBytes } from 'node:crypto';

const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';

/** شناسهٔ کوتاه، مرتب‌شدنی بر اساس زمان: ۸ نویسهٔ زمان + ۱۲ نویسهٔ تصادفی */
export function createId(): string {
  let t = Date.now();
  let time = '';
  for (let i = 0; i < 8; i++) { time = ALPHA[t % 36] + time; t = Math.floor(t / 36); }
  const bytes = randomBytes(12);
  let rnd = '';
  for (const b of bytes) rnd += ALPHA[b % 36];
  return time + rnd;
}

/** آرایهٔ شناسه به‌صورت یک پارامتر text[] برای `= any(...)` در sql خام (Drizzle آرایه را به چند پارامتر باز می‌کند) */
export const pgArr = (ids: string[]) => `{${ids.map((x) => `"${String(x).replace(/["\\]/g, '')}"`).join(',')}}`;
