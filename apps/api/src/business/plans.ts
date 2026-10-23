/**
 * بسته‌ها (مدل کسب‌وکار، دور چهارم — docs/decisions.md).
 * «کنشگر» و «مسجد و هسته» رایگان‌اند و با نقش کاربر معلوم می‌شوند؛ «استانی» هم رایگان است و با نقش
 * (راهیار استانی، کارشناس ستاد) کار می‌کند. فقط دو بستهٔ سازمانی «اشتراک» دارند و این‌جا تعریف می‌شوند.
 */
export type Plan = 'ORG_BASIC' | 'ORG_PREMIUM';
export const PLAN_IDS: Plan[] = ['ORG_BASIC', 'ORG_PREMIUM'];

export interface PlanFeatures {
  label: string;
  /** دوره‌های ویژهٔ سازمان */
  orgCourses: boolean;
  /** پنل سازمان: پیشرفت عددی اعضا (بدون متن گزارش‌ها) */
  orgPanel: boolean;
  /** گزارش فصلی خودکار، فقط عدد */
  quarterlyReport: boolean;
  /** پیام گروهی به اعضا */
  broadcast: boolean;
  /** برگزاری برنامه برای اعضا */
  events: boolean;
  /** نام سازمان روی گواهی: فقط دوره‌های ویژهٔ سازمان، یا همهٔ گواهی‌های دورهٔ اشتراک */
  certName: 'org-courses' | 'all';
  /** ساخت پویش برای اعضا؛ null = بی‌سقف */
  campaignsPerYear: number | null;
  /** کلاس زنده روی سرور مدرسه؛ ساعت در ماه، null = بی‌سقف (با ساخت کلاس زنده اعمال می‌شود) */
  liveHoursPerMonth: number | null;
  /** شبکهٔ راهیاری اختصاصی (به‌صورت خدمت سفارشی راه‌اندازی می‌شود) */
  ownRahyar: boolean;
  /** خروجی اکسل اعضا و پیشرفت */
  exportData: boolean;
  /** پشتیبانی تعهدی: درخواست‌های اعضا جلوی صف */
  prioritySupport: boolean;
  /** جلسهٔ راه‌اندازی و آموزش مدیران؛ null = هر وقت لازم شد */
  onboardingSessions: number | null;
  /** هزینهٔ ثابت سالانهٔ پشتیبانی تعهدی دارد */
  fixedFee: boolean;
}

export const PLANS: Record<Plan, PlanFeatures> = {
  ORG_BASIC: {
    label: 'سازمانی پایه', orgCourses: true, orgPanel: true, quarterlyReport: true, broadcast: true, events: true,
    certName: 'org-courses', campaignsPerYear: 2, liveHoursPerMonth: 4, ownRahyar: false, exportData: false,
    prioritySupport: false, onboardingSessions: 1, fixedFee: false,
  },
  ORG_PREMIUM: {
    label: 'سازمانی ویژه', orgCourses: true, orgPanel: true, quarterlyReport: true, broadcast: true, events: true,
    certName: 'all', campaignsPerYear: null, liveHoursPerMonth: null, ownRahyar: true, exportData: true,
    prioritySupport: true, onboardingSessions: null, fixedFee: true,
  },
};

export type FeatureKey = 'orgPanel' | 'quarterlyReport' | 'broadcast' | 'events' | 'exportData' | 'campaigns' | 'prioritySupport';
export const FEATURE_FA: Record<FeatureKey, string> = {
  orgPanel: 'پنل سازمان', quarterlyReport: 'گزارش فصلی', broadcast: 'پیام گروهی به اعضا', events: 'برگزاری برنامه برای اعضا',
  exportData: 'خروجی اکسل', campaigns: 'ساخت پویش برای اعضا', prioritySupport: 'پشتیبانی تعهدی',
};
export const has = (p: Plan, f: FeatureKey) => (f === 'campaigns' ? PLANS[p].campaignsPerYear !== 0 : !!PLANS[p][f]);

/** جدول کامل ۵ بسته × ۲۳ خدمت، همان که در دور چهارم تأیید شد (برای نمایش به مدیران) */
export const TIERS = [
  { id: 'ACTIVIST', label: 'کنشگر', who: 'هر فرد', price: 'رایگان، همیشه' },
  { id: 'MOSQUE', label: 'مسجد و هسته', who: 'امام محله، مسئول هسته', price: 'رایگان' },
  { id: 'ORG_BASIC', label: 'سازمانی پایه', who: 'سازمان‌های کنشگر محلی', price: 'اشتراک سالانه به ازای هر نفر' },
  { id: 'ORG_PREMIUM', label: 'سازمانی ویژه', who: 'نهادهای بزرگ و ملی', price: 'اشتراک + هزینهٔ ثابت پشتیبانی تعهدی' },
  { id: 'PROVINCE', label: 'استانی', who: 'ستاد یا ادارهٔ استان', price: 'رایگان' },
];
// y = دارد، l = محدود، n = ندارد (به ترتیب ستون‌های TIERS)
export const SERVICES: { group: string; items: { name: string; note?: string; v: string }[] }[] = [
  { group: 'یادگیری', items: [
    { name: 'دوره‌های عمومی و مسیرها', v: 'yyyyy' },
    { name: 'گواهی دوره و مسیر', v: 'yyyyy' },
    { name: 'دوره‌های ویژهٔ سازمان', note: 'فقط برای اعضای همان سازمان', v: 'nnyyn' },
    { name: 'ساخت دورهٔ اختصاصی', note: 'خدمت سفارشی: هزینهٔ واقعی + ۵۰٪', v: 'nnnyl' },
    { name: 'نام سازمان روی گواهی اعضا', note: 'پایه: فقط دوره‌های ویژهٔ سازمان', v: 'nnlyn' } ] },
  { group: 'ابزار و کار', items: [
    { name: 'جعبه‌ابزار ۳۵ ابزار و خروجی تصویر', v: 'yyyyy' },
    { name: 'کار گروهی، هم‌کار و نسخه‌ها', v: 'yyyyy' } ] },
  { group: 'همراهی انسانی', items: [
    { name: 'بازخورد راهیار بر مأموریت‌ها', v: 'yyyyy' },
    { name: 'پیام با راهیار', v: 'yyyyy' },
    { name: 'شبکهٔ راهیاری اختصاصی سازمان', note: 'پایه: از شبکهٔ عمومی', v: 'nnlyn' } ] },
  { group: 'برنامه‌ها و کلاس زنده', items: [
    { name: 'ثبت‌نام در برنامه‌ها و کلاس‌ها', v: 'yyyyy' },
    { name: 'برگزاری برنامه', note: 'مسجد و هسته: برای اعضای خود', v: 'nlyyy' },
    { name: 'کلاس زنده روی سرور مدرسه با ضبط', note: 'پایه: ۴ ساعت در ماه', v: 'nllyy' } ] },
  { group: 'پویش', items: [
    { name: 'شرکت در پویش و نشان مشارکت', v: 'yyyyy' },
    { name: 'ساخت پویش', note: 'پایه: ۲ پویش در سال، فقط برای اعضا', v: 'nnlyy' } ] },
  { group: 'مدیریت و گزارش', items: [
    { name: 'پنل مسجد و هسته', v: 'nyyyy' },
    { name: 'پنل سازمان: پیشرفت عددی اعضا', note: 'بدون متن گزارش‌ها', v: 'nnyyn' },
    { name: 'پیام گروهی به اعضا', v: 'nyyyy' },
    { name: 'گزارش فصلی خودکار', v: 'nnyyy' },
    { name: 'خروجی اکسل', note: 'اتصال به سامانهٔ سازمان: بعد از نسخهٔ ۱', v: 'nnnyn' } ] },
  { group: 'پشتیبانی', items: [
    { name: 'پشتیبانی داخل سامانه', v: 'yyyyy' },
    { name: 'پشتیبانی اختصاصی با زمان پاسخ تعهدی', v: 'nnnyl' },
    { name: 'جلسهٔ راه‌اندازی و آموزش مدیران', note: 'پایه: یک جلسه', v: 'nnlyy' } ] },
];

/** هزینه‌های پیش‌فرض (عددهای کارفرما در دور چهارم؛ ستاد در تنظیمات عوض می‌کند) — تومان */
export const DEFAULT_COSTS = {
  expectedUsers: 10000, // کاربران فعال در سال (تصمیم ۱.۱)
  srvMain: 1_000_000, srvLive: 2_000_000, storage: 1_500_000, // ماهانه
  dev: 40_000_000, ops: 60_000_000, content: 80_000_000, // ماهانه (پرسش ۱۳)
  smsPrice: 200, smsPerUser: 1, // پیامک ورود هر کاربر در ماه
  coursesPerYear: 20, courseCost: 100_000_000,
  markup: 1.5, // قیمت هر نفر = هزینهٔ هر کاربر × ۱٫۵
  serviceMarkup: 1.5, // خدمات سفارشی = هزینهٔ واقعی + ۵۰٪
  premiumFixedFee: 0, // هزینهٔ ثابت سالانهٔ پشتیبانی تعهدی بستهٔ ویژه
};
export type Costs = typeof DEFAULT_COSTS;

/** تخفیف حجمی: بیش از ۵۰۰ نفر ۱۵٪، بیش از ۲۰۰۰ نفر ۳۰٪ */
export const volumeDiscount = (seats: number) => (seats > 2000 ? 30 : seats > 500 ? 15 : 0);

export function priceModel(c: Costs) {
  const monthly = c.srvMain + c.srvLive + c.storage + c.dev + c.ops + c.content + c.smsPrice * c.smsPerUser * c.expectedUsers;
  const base = monthly * 12;
  const contentYear = c.coursesPerYear * c.courseCost;
  const total = base + contentYear;
  const perUser = c.expectedUsers ? total / c.expectedUsers : 0;
  const perSeat = Math.round((perUser * c.markup) / 1000) * 1000;
  return { monthly, base, content: contentYear, total, perUser: Math.round(perUser), perSeat };
}
