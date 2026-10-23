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
  redisUrl: env('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret: env('JWT_SECRET', 'dev-only-change-me'),
  otpSecret: env('OTP_SECRET', 'dev-only-otp-secret'),
  accessTtlSec: Number(env('ACCESS_TTL_SEC', String(15 * 60))),
  refreshTtlDays: Number(env('REFRESH_TTL_DAYS', '30')),
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
  baleBotUsername: process.env.BALE_BOT_USERNAME ?? '',
  get isDev() { return this.nodeEnv !== 'production'; },
};
