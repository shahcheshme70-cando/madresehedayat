import asyncio, subprocess, sys, datetime as dt
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import psql
from common import login, BASE, out
from playwright.async_api import async_playwright
from lib import net_barakat
OUT = out('business'); NET = net_barakat()
iso = lambda d: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=d)).isoformat()
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        hq = await login(b, '09120000000', '10.4.4.1', True)
        r = await hq.request.post(f'{BASE}/api/admin/subscriptions', data={'networkId': NET, 'plan': 'ORG_PREMIUM', 'seats': 40, 'startsAt': iso(-30), 'endsAt': iso(20), 'contractNo': '۱۴۰۵/۳۲', 'courseIds': ['smk6course']})
        print('sub', r.status)
        org = await login(b, '09126000001', '10.4.4.2'); lr = await login(b, '09126000002', '10.4.4.3')
        await org.request.post(f'{BASE}/api/org/{NET}/members', data={'mobiles': ['09126000002', '09126000003']})
        await lr.request.post(f'{BASE}/api/me/orgs/{NET}/accept')
        for pg in (hq, org, lr):
            pg.on('pageerror', lambda e, pg=pg: errs.append(f'pageerror {e} @{pg.url}'))
            pg.on('console', lambda m, pg=pg: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(f'console {m.text[:160]} @{pg.url}'))
        pages = [(hq, '/admin', 'dash'), (hq, '/admin/business/subscriptions', 'subs'), (hq, '/admin/business/invoices', 'inv'), (hq, '/admin/business/sponsors', 'sp'),
                 (hq, '/admin/business/services', 'svc'), (hq, '/admin/business/pricing', 'pricing'), (org, '/org', 'orglist'), (org, f'/org/{NET}', 'org'),
                 (org, '/manage/events/new', 'evnew'), (lr, '/courses/smk6', 'course'), (lr, '/me', 'me')]
        for W in (1280, 390):
            for pg, path, name in pages:
                await pg.set_viewport_size({'width': W, 'height': 900})
                await pg.goto(BASE + path); await pg.wait_for_load_state('networkidle'); await pg.wait_for_timeout(300)
                over = await pg.evaluate('document.documentElement.scrollWidth - innerWidth')
                if over > 1: errs.append(f'{W} overflow {over} @{path}')
                await pg.screenshot(path=f'{OUT}{W}-{name}.png', full_page=True)
            await org.goto(f'{BASE}/org/{NET}'); await org.wait_for_load_state('networkidle')
            await org.get_by_role('button', name='گزارش فصلی').click(); await org.wait_for_timeout(500); await org.screenshot(path=f'{OUT}{W}-orgreport.png', full_page=True)
            await org.get_by_role('button', name='بسته‌ها').click(); await org.wait_for_timeout(400); await org.screenshot(path=f'{OUT}{W}-orgplans.png', full_page=True)
            await hq.goto(f'{BASE}/admin/business/subscriptions'); await hq.wait_for_load_state('networkidle')
            await hq.get_by_role('button', name='اشتراک تازه').click(); await hq.wait_for_timeout(700); await hq.screenshot(path=f'{OUT}{W}-subnew.png')
            await hq.keyboard.press('Escape')
            await hq.goto(f'{BASE}/admin/business/services'); await hq.wait_for_load_state('networkidle')
            await hq.get_by_role('button', name='خدمت تازه').click(); await hq.wait_for_timeout(700); await hq.screenshot(path=f'{OUT}{W}-svcnew.png')
            await hq.keyboard.press('Escape')
        # پیام کد ورود و صفحهٔ ورود
        lp = await (await b.new_context(viewport={'width': 390, 'height': 800})).new_page()
        await lp.goto(BASE + '/login'); await lp.screenshot(path=f'{OUT}login.png')
        await b.close()
    print('\n'.join(errs) or 'بدون خطا'); sys.exit(1 if errs else 0)
if __name__ == "__main__": asyncio.run(main())
