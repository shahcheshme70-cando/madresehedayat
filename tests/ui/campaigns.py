import asyncio, sys, subprocess
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import psql
from common import login, BASE, out
from playwright.async_api import async_playwright
OUT = out('campaigns')
C1 = psql("select id from campaigns where title='آزمون پویش ۱' order by created_at desc limit 1")
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        a = await login(b, '09126000002', '10.7.7.1'); hq = await login(b, '09120000000', '10.7.7.2', True); pr = await login(b, '09126000001', '10.7.7.3')
        for pg in (a, hq, pr):
            pg.on('pageerror', lambda e, pg=pg: errs.append(f'pageerror {e} @{pg.url}'))
            pg.on('console', lambda m, pg=pg: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(f'console {m.text[:160]} @{pg.url}'))
        pages = [(a, '/', 'home'), (a, '/campaigns', 'list'), (a, f'/campaigns/{C1}', 'detail'), (a, '/me', 'me'), (hq, '/admin/campaigns', 'admin-list'), (hq, f'/admin/campaigns/{C1}', 'admin-detail'),
                 (hq, '/admin/campaigns/new', 'admin-new'), (hq, f'/admin/campaigns/{C1}/edit', 'admin-edit'), (pr, '/manage/campaigns', 'prov-list'), (pr, '/manage/campaigns/new', 'prov-new')]
        for W in (390, 1280):
            for pg, path, name in pages:
                await pg.set_viewport_size({'width': W, 'height': 860})
                await pg.goto(BASE + path); await pg.wait_for_load_state('networkidle'); await pg.wait_for_timeout(300)
                over = await pg.evaluate('document.documentElement.scrollWidth - innerWidth')
                if over > 1: errs.append(f'{W} overflow {over} @{path}')
                t = await pg.locator('main').inner_text()
                if 'خطایی' in t: errs.append(f'{W} error text @{path}')
                await pg.screenshot(path=f'{OUT}{W}-{name}.png', full_page=True)
        # کار تازه با دیالوگ
        await a.goto(f'{BASE}/campaigns/{C1}'); await a.wait_for_load_state('networkidle')
        btn = a.get_by_role('button', name='انجام دادم').last
        await btn.click(); await a.wait_for_timeout(300); await a.locator('#cn').fill('یادداشت آزمایشی'); await a.locator('dialog[open]').get_by_role('button', name='ثبت').click(); await a.wait_for_timeout(800)
        if 'یادداشت آزمایشی' not in await a.locator('main').inner_text(): errs.append('done dialog failed')
        await b.close()
    print('\n'.join(errs) or 'بدون خطا'); sys.exit(1 if errs else 0)
asyncio.run(main())
