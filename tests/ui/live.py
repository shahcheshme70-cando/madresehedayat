import asyncio, sys, subprocess
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import psql
from common import login, BASE, out
from playwright.async_api import async_playwright
OUT = out('live')
E = psql("select id from events where title='آزمون کلاس زنده' order by created_at desc limit 1"); LID = psql("select id from lessons where title='جلسهٔ زندهٔ آزمون' limit 1"); CID = psql("select id from courses where slug='nojavan-1'")
psql(f"update live_recordings set deleted_at=null, expires_at=now()+interval '100 days' where event_id='{E}'")
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        a = await login(b, '09126000003', '10.8.8.1'); hq = await login(b, '09120000000', '10.8.8.2', True)
        for pg in (a, hq):
            pg.on('pageerror', lambda e, pg=pg: errs.append(f'pageerror {e} @{pg.url}'))
            pg.on('console', lambda m, pg=pg: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(f'console {m.text[:160]} @{pg.url}'))
        pages = [(a, f'/events/{E}', 'event'), (a, f'/lessons/{LID}', 'lesson'), (hq, f'/admin/events/{E}', 'manage'), (hq, '/admin/events/new', 'new'), (hq, f'/admin/courses/{CID}', 'editor')]
        for W in (390, 1280):
            for pg, path, name in pages:
                await pg.set_viewport_size({'width': W, 'height': 860})
                await pg.goto(BASE + path); await pg.wait_for_load_state('networkidle'); await pg.wait_for_timeout(400)
                if name == 'new':
                    await pg.get_by_role('button', name='آنلاین', exact=True).click(); await pg.wait_for_timeout(200)
                over = await pg.evaluate('document.documentElement.scrollWidth - innerWidth')
                if over > 1: errs.append(f'{W} overflow {over} @{path}')
                await pg.screenshot(path=f'{OUT}{W}-{name}.png', full_page=True)
        t = await a.goto(f'{BASE}/events/{E}'); await a.wait_for_load_state('networkidle')
        body = await a.locator('main').inner_text()
        for k in ('کلاس زنده', 'دیدن ضبط'):
            if k not in body: errs.append('missing on event page: ' + k)
        await b.close()
    print('\n'.join(errs) or 'بدون خطا'); sys.exit(1 if errs else 0)
asyncio.run(main())
