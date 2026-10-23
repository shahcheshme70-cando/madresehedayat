# مدرسهٔ هدایت

مدرسهٔ مجازی کنشگران مسجد و هسته‌ها. این مخزن مرحله‌های ۱ و ۲ را دارد.

**مرحلهٔ ۱**

- ورود و ثبت‌نام با کد پیامکی
- دوره‌ها و مسیرها
- درس‌ها: متن، ویدیوی آپارات یا فایل، صوت، آزمون، برگهٔ کار، مأموریت
- گواهی با صفحهٔ استعلام عمومی
- پنل ستاد

**مرحلهٔ ۲**

- شبکهٔ راهیاری با دو درخت برادران و بانور، و پنل راهیار
- بازبینی گزارش مأموریت با عکس، بازخورد، اصلاح و تأیید
- یادآوری و هشدار برای گزارش‌هایی که بی‌پاسخ مانده‌اند
- هسته‌ها و پیوند دعوت
- پنل امام محله
- پنل سازمان‌های مشترک، مثل برکت
- برنامه‌ها: ثبت‌نام، فهرست انتظار، کارت ورود QR، حضور دم در حتی بدون اینترنت، و بازخورد
- اعلان‌ها و پیام مستقیم راهیار، با رضایت کنشگر

| بخش | فناوری |
|---|---|
| وب | React 19، TypeScript، Tailwind 4، Vite |
| API | NestJS 11، Drizzle ORM |
| داده | PostgreSQL 16 |
| فایل‌ها | MinIO، روی همان سرور |
| اجرا | Docker Compose |

مستندها:

- [`docs/design-review.md`](docs/design-review.md): چرخه‌های واقعی استفاده و کمبودهای طراحی
- [`docs/decisions.md`](docs/decisions.md): تصمیم‌های کارفرما
- [`docs/architecture.md`](docs/architecture.md): ساختار کد و قاعده‌های اصلی

## راه‌اندازی روی سرور

```bash
cp .env.example .env        # رمزها را عوض کنید
docker compose up -d --build
```

بعد سایت روی پورت `WEB_PORT` (پیش‌فرض ۸۰۸۰) بالا می‌آید. HTTPS را با یک nginx یا Caddy جلوی آن بگذارید و `COOKIE_SECURE=true` بماند.

### چند نکته

- **مدیر ستاد:** شماره‌هایی که در `BOOTSTRAP_ADMIN_MOBILES` نوشته‌اید، با اولین ورود نقش «مدیر ستاد» می‌گیرند. بقیهٔ نقش‌ها را از پنل ستاد بدهید.
- **پیامک:** با `SMS_PROVIDER=console` پیامکی فرستاده نمی‌شود و کد ورود در لاگ API نوشته می‌شود (`docker compose logs api`). برای ارسال واقعی `SMS_PROVIDER=kavenegar` و کلید کاوه‌نگار را بگذارید. قالب پیامک (`KAVENEGAR_OTP_TEMPLATE`) باید در پنل کاوه‌نگار با یک توکن تعریف شده باشد.
- **دادهٔ نمونه:** با `SEED_DEMO=true` سه دورهٔ نمونه، یک مسیر و چند مسجد هم ساخته می‌شود. دادهٔ پایه (استان‌ها، شهرستان‌ها و شبکه‌ها) همیشه ساخته می‌شود.
- **فونت رواق:** فایل‌های فونت به‌خاطر مجوز در مخزن نیستند. فایل‌های `RavaghFaNum-*.woff` را پیش از ساخت در `apps/web/public/fonts/` بگذارید. اگر نباشند، وزیرمتن به‌جایشان می‌نشیند.
- **دسترسی به Docker Hub و npm:** اگر سرور به Docker Hub دسترسی ندارد، در `.env` نشانی ایمیج‌ها را به آینهٔ داخلی بدهید (`NODE_IMAGE`، `NGINX_IMAGE`، `POSTGRES_IMAGE`، `MINIO_IMAGE`). برای npm هم `NPM_REGISTRY` را بدهید. ORM عمداً Drizzle است، نه Prisma: Prisma هنگام نصب موتورهای باینری‌اش را از سرور خارجی می‌گیرد که از ایران در دسترس نیست.
- **پشتیبان‌گیری:** پایگاه داده در volume با نام `db-data` و فایل‌ها در volume با نام `files` هستند. مثال پشتیبان روزانه:
  `docker compose exec -T db pg_dump -U madrese madrese | gzip > backup-$(date +%F).sql.gz`

## توسعه روی رایانهٔ خودتان

به Node 22 و یک PostgreSQL نیاز دارید. MinIO اختیاری است؛ بدون آن فقط بارگذاری فایل خاموش است.

```bash
npm install
# API
cd apps/api
export DATABASE_URL=postgresql://madrese:madrese@localhost:5432/madrese BOOTSTRAP_ADMIN_MOBILES=09120000000
npm run build && npm run db:migrate && SEED_DEMO=true npm run seed
npm run start:dev                     # پورت ۳۰۰۰
# وب (در پنجرهٔ دیگر)
cd apps/web && npm run dev            # http://localhost:5173 ؛ ‎/api‎ به پورت ۳۰۰۰ می‌رود
```

در حالت توسعه، کد ورود هم در لاگ API و هم زیر کادر کد در صفحهٔ ورود نشان داده می‌شود.

تغییر مدل داده: `src/db/schema.ts` را عوض کنید و `npx drizzle-kit generate --name <نام>` بزنید. مهاجرت تازه در `apps/api/drizzle` ساخته می‌شود و هنگام بالا آمدن کانتینر خودکار اعمال می‌شود.
