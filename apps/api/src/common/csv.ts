/**
 * یک خانهٔ CSV امن: نقل‌قول، و خنثی کردن فرمول (نامی مثل «=HYPERLINK(...)» در اکسل اجرا نشود).
 */
export const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
