# آزمون‌ها

همهٔ آزمون‌ها فقط با **دادهٔ ساختگی** کار می‌کنند: شماره‌های `0912…` آزمایشی و نام‌های ساختگی. آزمون‌ها داده پاک می‌کنند؛ برای همین `lib.py` اگر API یا پایگاه داده روی `localhost` نباشد اجرا را متوقف می‌کند. **هرگز روی سرور واقعی اجرا نشوند.**

| پوشه | چه چیزی را می‌آزماید |
|---|---|
| `api/01_network.py` | رمز دوم ستاد، درخت راهیاری، مسئول‌یابی، مأموریت و بازبینی، هسته و دعوت، امام محله، سازمان مشترک، برنامه‌ها |
| `api/02_privacy_paths.py` | رمزگذاری دادهٔ قرمز، ثبت دسترسی، آزمون مسیر |
| `api/03_tools.py` | جعبه‌ابزار، تخته‌ها، درس ابزار |
| `api/04_eitaa.py` | ورود از ایتا و شماره از ایتا |
| `api/05_business.py` | قیمت، اشتراک، صندلی‌ها، فاکتور، حامی، گزارش فصلی، خروجی |
| `api/06_feedback.py` | بازخورد، امتیاز درس و دوره، کیفیت محتوا |
| `api/07_campaigns.py` | پویش‌ها: ساخت، دامنه، پیوستن، کارها، نقشه، نشان‌ها |
| `api/08_live.py` | کلاس زنده با سرور ساختگی BigBlueButton (`fakebbb.py`) |
| `ui/*.py` | گشت در صفحه‌ها با Playwright در ۳۹۰ و ۱۲۸۰ پیکسل: خطای صفحه، بیرون‌زدگی، متن‌های کلیدی، و پیام‌های خطا (بی‌اینترنت، ۴۰۴، ۵۰۲، پایان نشست) |

## اجرا

۱. یک PostgreSQL آزمایشی بسازید، مهاجرت و seed را با دادهٔ نمونه اجرا کنید:

```bash
cd apps/api && npm run build
export DATABASE_URL=postgresql://madrese@localhost:5432/madrese_test BOOTSTRAP_ADMIN_MOBILES=09120000000
npm run db:migrate && SEED_DEMO=true npm run seed
```

۲. API را با این تنظیمات بالا بیاورید (کد پیامک در پاسخ برمی‌گردد و ایتا و BBB به سرورهای ساختگی وصل‌اند):

```bash
PORT=3100 SMS_PROVIDER=console STAFF_MFA=on \
EITAA_APP_TOKEN=test:eitaa-token \
BBB_URL=http://127.0.0.1:9300/bigbluebutton/api BBB_SECRET=testsecret \
node dist/main.js
```

۳. آزمون‌ها (پایتون ۳ و `requests`؛ برای `--ui` هم `playwright` و وب روی `WEB_URL`):

```bash
export TEST_DB=postgresql://madrese@localhost:5432/madrese_test
python3 tests/run.py            # API
python3 tests/run.py --ui       # API و رابط کاربری (cd apps/web && npx vite --port 5180)
python3 tests/run.py 05 08      # فقط بعضی
```

آزمون‌ها به ترتیب شماره اجرا شوند؛ `01_network` کاربران و سازمان آزمایشی را می‌سازد و بقیه از آن‌ها استفاده می‌کنند. عکس‌های گشت رابط در `tests/ui/out/` می‌ماند (در git نیست).
