/** همهٔ تنظیمات از متغیرهای محیطی خوانده می‌شود؛ نمونه در .env.example ریشهٔ مخزن. */
const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`متغیر محیطی ${k} تنظیم نشده است`);
  return v;
};

export const config = {
  port: Number(env('PORT', '3000')),
  nodeEnv: env('NODE_ENV', 'development'),
  databaseUrl: env('DATABASE_URL', 'postgresql://madrese:madrese@localhost:5432/madrese'),
  jwtSecret: env('JWT_SECRET', 'dev-only-change-me'),
  otpSecret: env('OTP_SECRET', 'dev-only-otp-secret'),
  accessTtlSec: Number(env('ACCESS_TTL_SEC', String(15 * 60))),
  // نشست کنشگر ۹۰ روز تا پیامک ورود کمتر شود (مدل کسب‌وکار ۱۶)؛ کارکنان ستاد ۳۰ روز و رمز دوم هر ۱۲ ساعت
  refreshTtlDays: Number(env('REFRESH_TTL_DAYS', '90')),
  // کلاس زنده: نشانی API سرور BigBlueButton (…/bigbluebutton/api) و رمز مشترکش (bbb-conf --secret)
  bbbUrl: env('BBB_URL', '').replace(/\/$/, ''),
  bbbSecret: env('BBB_SECRET', ''),
  bbbChecksum: env('BBB_CHECKSUM', 'sha1') as 'sha1' | 'sha256',
  staffRefreshTtlDays: Number(env('STAFF_REFRESH_TTL_DAYS', '30')),
  cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
  /** console = کد در لاگ نوشته می‌شود (توسعه)؛ kavenegar = ارسال واقعی */
  smsProvider: env('SMS_PROVIDER', 'console') as 'console' | 'kavenegar',
  kavenegarApiKey: process.env.KAVENEGAR_API_KEY ?? '',
  kavenegarTemplate: process.env.KAVENEGAR_OTP_TEMPLATE ?? 'madrese-otp',
  /** شماره‌هایی که هنگام راه‌اندازی نقش مدیر ستاد می‌گیرند (با ویرگول جدا) */
  bootstrapAdmins: (process.env.BOOTSTRAP_ADMIN_MOBILES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  publicUrl: env('PUBLIC_URL', 'http://localhost:8080'),
  /** کلید ۳۲ بایتی (base64) رمزگذاری دادهٔ قرمز در پایگاه داده. گم شدنش یعنی از دست رفتن داده‌ها؛ جدا پشتیبان بگیرید */
  dataKey: env('DATA_KEY', 'ZGV2LW9ubHktZGF0YS1rZXktY2hhbmdlLW1lLTMyYiE='),
  /** رمز دوم کارکنان ستاد؛ فقط برای توسعه خاموش شود */
  staffMfa: env('STAFF_MFA', 'on') !== 'off',
  baleToken: process.env.BALE_BOT_TOKEN ?? '',
  /** توکن برنامه در پنل ایتایار و نشانی برنامه در ایتا (مثلاً https://eitaa.com/madrese_app) */
  eitaaToken: process.env.EITAA_APP_TOKEN ?? '',
  eitaaAppUrl: process.env.EITAA_APP_URL ?? '',
  /** lax (پیش‌فرض) یا none — none فقط وقتی لازم است که مدرسه در نسخهٔ وب ایتا (داخل iframe) باز شود */
  cookieSameSite: (process.env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax') as 'lax' | 'none',
  baleBotUsername: process.env.BALE_BOT_USERNAME ?? '',
  get isDev() { return this.nodeEnv !== 'production'; },
};
