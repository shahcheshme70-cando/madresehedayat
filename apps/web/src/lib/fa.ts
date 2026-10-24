const FA = '۰۱۲۳۴۵۶۷۸۹';
export const fa = (v: string | number | null | undefined) => String(v ?? '').replace(/\d/g, (d) => FA[+d]);
export const toEn = (s: string) => s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const jf = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', o).format(d);
export const jDate = (v: string | Date) => jf(new Date(v), { day: 'numeric', month: 'long', year: 'numeric' });
export const jShort = (v: string | Date) => jf(new Date(v), { day: 'numeric', month: 'short' });

export function minutes(sec: number) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${fa(m)} دقیقه`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${fa(h)} ساعت و ${fa(r)} دقیقه` : `${fa(h)} ساعت`;
}

export function ago(v: string | Date) {
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return 'همین حالا';
  if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'دیروز' : `${fa(d)} روز پیش`;
}

export const maskMobile = (m: string) => fa(`${m.slice(0, 4)} ${m.slice(4, 7)} ${m.slice(7)}`);

export const LESSON_LABEL: Record<string, string> = {
  VIDEO: 'ویدیو', AUDIO: 'صوت', TEXT: 'متن', QUIZ: 'آزمون', PRACTICE: 'تمرین', WORKSHEET: 'برگهٔ کار', MISSION: 'مأموریت', TOOL: 'ابزار کار', LIVE: 'جلسهٔ زنده',
};
export const ROLE_LABEL: Record<string, string> = {
  HQ_ADMIN: 'مدیر ستاد', HQ_OPERATOR: 'اپراتور محتوا', INSTRUCTOR: 'مدرس', RAHYAR: 'راهیار', IMAM: 'امام محله', ORG_ADMIN: 'مدیر سازمان',
};
export const STATUS_LABEL: Record<string, string> = { DRAFT: 'پیش‌نویس', REVIEW: 'در انتظار بازبینی', PUBLISHED: 'منتشرشده', ARCHIVED: 'بایگانی' };

export const jDateTime = (v: string | Date) => jf(new Date(v), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
export const jTime = (v: string | Date) => jf(new Date(v), { hour: '2-digit', minute: '2-digit' });
export const REG_LABEL: Record<string, string> = { REGISTERED: 'ثبت‌نام شده', WAITLIST: 'فهرست انتظار', PENDING: 'منتظر تأیید', REJECTED: 'پذیرفته نشد', CANCELLED: 'انصراف' };
export const MISSION_LABEL: Record<string, string> = { submitted: 'فرستاده شد', pending: 'منتظر تأیید راهیار', needs_revision: 'نیاز به اصلاح', approved: 'تأیید شد' };
