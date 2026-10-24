import asyncio, sys, subprocess
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import login, BASE, out
from playwright.async_api import async_playwright
OUT = out('errors')
res=[]
def ok(c, m): res.append(('✓ ' if c else '✗ ')+m)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        a = await login(b, '09126000003', '10.8.9.1')
        await a.set_viewport_size({'width':390,'height':800})
        ctx = a.context
        # ۱) توکن دسترسی پاک شد (مثل ۱۵ دقیقه دوری) → هنوز وارد است
        await ctx.clear_cookies(name='mh_at') if hasattr(ctx,'clear_cookies') else None
        cs = await ctx.cookies(); names=[c['name'] for c in cs]; print('cookies', names)
        acc = [c for c in cs if c['path']=='/']
        await ctx.clear_cookies(); await ctx.add_cookies([c for c in cs if c['path']!='/'])
        await a.goto(BASE+'/me'); await a.wait_for_load_state('networkidle'); await a.wait_for_timeout(500)
        ok('/login' not in a.url, f'بعد از پایان توکن کوتاه هنوز وارد است ({a.url})')
        # ۲) خطای ۴۰۴ برنامه
        await a.goto(BASE+'/events/nope'); await a.wait_for_load_state('networkidle'); await a.wait_for_timeout(500)
        t = await a.locator('main').inner_text(); ok('برنامه پیدا نشد' in t, '۴۰۴ برنامه: '+t[:80].replace('\n',' | '))
        await a.screenshot(path=OUT+'404.png')
        # ۳) نوار بی‌اینترنت
        await ctx.set_offline(True); await a.wait_for_timeout(300)
        ok(await a.get_by_text('به اینترنت وصل نیستید').count() > 0, 'نوار بی‌اینترنت')
        await a.screenshot(path=OUT+'offline.png')
        await ctx.set_offline(False); await a.wait_for_timeout(300)
        ok(await a.get_by_text('به اینترنت وصل نیستید').count() == 0, 'نوار بعد از وصل شدن رفت')
        # ۴) toast پیش‌فرض برای کاری که onError ندارد: پاسخ ۵۰۰ ساختگی
        await a.goto(BASE+'/events'); await a.wait_for_load_state('networkidle')
        await a.route('**/api/notifications/read*', lambda r: r.fulfill(status=500, content_type='application/json', body='{"code":"server_error","ref":"AB12CD34","message":"خطایی در سرور پیش آمد و ثبت شد. کد: AB12CD34"}'))
        # ۵) پاسخ HTML از nginx (۵۰۲) برای یک صفحه
        await a.route('**/api/events?*', lambda r: r.fulfill(status=502, content_type='text/html', body='<html>Bad Gateway</html>'))
        await a.route('**/api/events', lambda r: r.fulfill(status=502, content_type='text/html', body='<html>Bad Gateway</html>'))
        await a.goto(BASE+'/events'); await a.wait_for_load_state('networkidle'); await a.wait_for_timeout(2500)
        t = await a.locator('main').inner_text(); ok('در دسترس نیست' in t, '۵۰۲ HTML: '+t[:120].replace('\n',' | '))
        await a.screenshot(path=OUT+'502.png')
        await a.unroute('**/api/events?*'); await a.unroute('**/api/events')
        # ۶) پایان نشست در میانهٔ کار → ورود با پیام
        await ctx.clear_cookies()
        await a.goto(BASE+'/me'); await a.wait_for_load_state('networkidle'); await a.wait_for_timeout(800)
        ok('/login' in a.url, 'بی‌نشست به ورود رفت')
        await b.close()
    print('\n'.join(res)); sys.exit(1 if any(x.startswith('✗') for x in res) else 0)
asyncio.run(main())
