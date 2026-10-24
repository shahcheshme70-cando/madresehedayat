"""ورود در مرورگر آزمون (Playwright) و پوشهٔ عکس‌ها"""
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import WEB as BASE, psql, rand_ip, totp

def out(name):
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', name) + '/'
    os.makedirs(d, exist_ok=True); return d

async def login(b, mobile, ip=None, hq=False):
    """صفحهٔ مرورگرِ واردشده؛ hq=True رمز دوم ستاد را هم فعال می‌کند"""
    ctx = await b.new_context(viewport={'width': 1280, 'height': 900}, extra_http_headers={'X-Forwarded-For': ip or rand_ip()})
    page = await ctx.new_page()
    psql('delete from otp_requests')
    r = await page.request.post(f'{BASE}/api/auth/otp', data={'mobile': mobile}); c = (await r.json())['devCode']
    await page.request.post(f'{BASE}/api/auth/verify', data={'mobile': mobile, 'code': c})
    if hq:
        psql("update users set totp_secret=null, totp_enabled_at=null")
        sec = (await (await page.request.post(f'{BASE}/api/auth/mfa/setup')).json())['secret']
        await page.request.post(f'{BASE}/api/auth/mfa/verify', data={'code': totp(sec)})
    return page
