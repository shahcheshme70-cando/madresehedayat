const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/** ارقام فارسی و عربی را لاتین می‌کند */
export const toEnDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));

/** شمارهٔ موبایل را به شکل ۰۹xxxxxxxxx درمی‌آورد؛ اگر نامعتبر بود null */
export function normalizeMobile(input: string): string | null {
  const v = toEnDigits(String(input ?? '')).replace(/[\s\-()]/g, '').replace(/^\+98/, '0').replace(/^0098/, '0').replace(/^98(?=9)/, '0');
  const m = v.length === 10 && v.startsWith('9') ? '0' + v : v;
  return /^09\d{9}$/.test(m) ? m : null;
}
