#!/usr/bin/env python3
"""همهٔ آزمون‌ها را به ترتیب اجرا می‌کند.

    python3 tests/run.py          آزمون‌های API
    python3 tests/run.py --ui     به‌علاوهٔ گشت در رابط کاربری (Playwright و وب روی WEB_URL)
    python3 tests/run.py 05 08    فقط آزمون‌هایی که نامشان این‌ها را دارد

پیش از اجرا: API با تنظیمات tests/README.md روی پایگاه دادهٔ آزمایشی بالا باشد.
"""
import glob, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
ui = '--ui' in sys.argv
files = sorted(glob.glob(os.path.join(HERE, 'api', '*.py')))
if ui: files += [os.path.join(HERE, 'ui', f) for f in ('business.py', 'feedback.py', 'campaigns.py', 'live.py', 'errors.py')]
if args: files = [f for f in files if any(a in os.path.basename(f) for a in args)]

# سرور ساختگی BigBlueButton برای آزمون کلاس زنده
bbb = subprocess.Popen([sys.executable, '-I', os.path.join(HERE, 'fakebbb.py')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.5)
results = []
try:
    for f in files:
        name = os.path.relpath(f, HERE)
        print(f'\n━━━ {name} ━━━', flush=True)
        t = time.time(); r = subprocess.run([sys.executable, f]); results.append((name, r.returncode == 0, time.time() - t))
finally:
    bbb.terminate()
print('\n━━━ خلاصه ━━━')
for name, good, sec in results: print(f"  {'✓' if good else '✗'} {name}  ({sec:.0f} ثانیه)")
bad = [n for n, g, _ in results if not g]
print('\nهمه درست' if not bad else f'\n{len(bad)} آزمون خطا داشت'); sys.exit(1 if bad else 0)
