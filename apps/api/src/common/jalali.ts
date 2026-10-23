/** تبدیل تاریخ شمسی و میلادی (الگوریتم jalaali-js، بدون وابستگی) */
const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;
const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy: number) {
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1;
  return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd };
}
export function toJalali(gy: number, gm: number, gd: number) {
  const jdn = g2d(gy, gm, gd);
  const gy2 = d2g(jdn).gy;
  let jy = gy2 - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(gy2, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}
export function toGregorian(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1);
}
export const monthLength = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jalCal(jy).leap === 0 ? 30 : 29);
export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** آغاز یک روز شمسی به وقت تهران (ایران از ۱۴۰۱ ساعت تابستانی ندارد) */
export function tehranStart(jy: number, jm: number, jd: number) {
  const g = toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd) - 3.5 * 3600_000);
}
/** تاریخ شمسی امروز به وقت تهران */
export function jalaliNow(d = new Date()) {
  const t = new Date(d.getTime() + 3.5 * 3600_000);
  return toJalali(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
/** بازهٔ یک فصل شمسی: q از ۱ تا ۴ */
export function jalaliQuarter(jy: number, q: number) {
  const from = tehranStart(jy, (q - 1) * 3 + 1, 1);
  const to = q === 4 ? tehranStart(jy + 1, 1, 1) : tehranStart(jy, q * 3 + 1, 1);
  return { from, to, label: `${['بهار', 'تابستان', 'پاییز', 'زمستان'][q - 1]} ${jy}` };
}
