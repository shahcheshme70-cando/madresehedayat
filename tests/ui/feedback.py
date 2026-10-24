import asyncio, sys
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import psql
from common import login, BASE, out
from playwright.async_api import async_playwright
OUT = out('feedback')
import subprocess; os.makedirs(OUT, exist_ok=True)
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        lr = await login(b, '09126000002', '10.6.6.1'); hq = await login(b, '09120000000', '10.6.6.2', True)
        for pg in (lr, hq):
            pg.on('pageerror', lambda e, pg=pg: errs.append(f'pageerror {e} @{pg.url}'))
            pg.on('console', lambda m, pg=pg: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(f'console {m.text[:160]} @{pg.url}'))
        L = psql("select l.id from lessons l join modules m on m.id=l.module_id join courses c on c.id=m.course_id where c.slug='nojavan-1' order by m.order, l.order limit 1")
        for W in (390, 1280):
            await lr.set_viewport_size({'width': W, 'height': 860})
            await lr.goto(f'{BASE}/lessons/{L}'); await lr.wait_for_load_state('networkidle')
            await lr.get_by_role('button', name='نظر یا مشکلی دربارهٔ این صفحه دارید؟').click()
            dlg = lr.locator('dialog[open]'); await dlg.get_by_role('button', name='مشکل', exact=True).click()
            await lr.get_by_label('حس کلی').get_by_role('radio').nth(3).click()
            await lr.locator('#fb-body').fill(f'متن آزمایشی بازخورد از صفحهٔ درس در عرض {W}')
            await lr.screenshot(path=f'{OUT}{W}-dialog.png')
            await dlg.get_by_role('button', name='فرستادن').click(); await lr.wait_for_timeout(800)
            await lr.screenshot(path=f'{OUT}{W}-lesson.png', full_page=True)
            await lr.goto(f'{BASE}/help'); await lr.wait_for_load_state('networkidle'); await lr.screenshot(path=f'{OUT}{W}-help.png', full_page=True)
            await lr.goto(f'{BASE}/courses/nojavan-1'); await lr.wait_for_load_state('networkidle'); await lr.screenshot(path=f'{OUT}{W}-course.png', full_page=True)
            await hq.set_viewport_size({'width': W, 'height': 860})
            await hq.goto(f'{BASE}/admin/feedback'); await hq.wait_for_load_state('networkidle'); await hq.screenshot(path=f'{OUT}{W}-inbox.png', full_page=True)
            await hq.locator('li button.card').first.click(); await hq.wait_for_timeout(400); await hq.screenshot(path=f'{OUT}{W}-triage.png')
            await hq.keyboard.press('Escape')
            await hq.get_by_role('button', name='کیفیت محتوا').click(); await hq.wait_for_timeout(600); await hq.screenshot(path=f'{OUT}{W}-quality.png', full_page=True)
            for pg in (lr, hq):
                over = await pg.evaluate('document.documentElement.scrollWidth - innerWidth')
                if over > 1: errs.append(f'{W} overflow {over} @{pg.url}')
        n = psql("select count(*) from feedback where body like 'enc:%'")
        print('feedback rows', n)
        await b.close()
    print('\n'.join(errs) or 'بدون خطا'); sys.exit(1 if errs else 0)
asyncio.run(main())
