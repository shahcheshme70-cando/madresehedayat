"""ابزار مشترک آزمون‌ها — فقط با دادهٔ ساختگی و فقط روی پایگاه دادهٔ آزمایشی.

API_URL      نشانی API (پیش‌فرض http://localhost:3100/api)
WEB_URL      نشانی وب برای آزمون‌های رابط (پیش‌فرض http://localhost:5180)
TEST_DB      نشانی پایگاه دادهٔ آزمایشی برای psql
"""
import base64, hashlib, hmac, os, random, re as _re, struct, subprocess, sys, time, datetime as dt
from urllib.parse import urlparse
import requests

B = os.environ.get('API_URL', 'http://localhost:3100/api').rstrip('/')
WEB = os.environ.get('WEB_URL', 'http://localhost:5180').rstrip('/')
DB = os.environ.get('TEST_DB', 'postgresql://madrese@localhost:5433/madrese?host=/tmp')

# این آزمون‌ها داده پاک می‌کنند: هرگز روی سرور واقعی اجرا نشوند
_LOCAL = ('localhost', '127.0.0.1', '::1', '')
if urlparse(B).hostname not in _LOCAL or (urlparse(DB).hostname or '') not in _LOCAL:
    sys.exit('آزمون‌ها فقط روی API و پایگاه دادهٔ محلی اجرا می‌شوند (localhost). نشانی‌ها را بررسی کنید.')

fails = 0
def ok(cond, msg, extra=None):
    global fails
    print(('  ✓ ' if cond else '  ✗ ') + msg + ('' if cond or extra is None else f'  → {str(extra)[:300]}'))
    if not cond: fails += 1
def done():
    print('\nنتیجه:', 'همه درست' if not fails else f'{fails} خطا'); sys.exit(1 if fails else 0)
def j(r):
    try: return r.json()
    except Exception: return r.text
iso = lambda d=0, minutes=0: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=d, minutes=minutes)).isoformat()

def psql(q): return subprocess.run(['psql', DB, '-Atqc', q], check=True, capture_output=True, text=True).stdout.strip()
def totp(secret):
    k = base64.b32decode(secret + '=' * (-len(secret) % 8)); c = struct.pack('>Q', int(time.time()) // 30)
    h = hmac.new(k, c, hashlib.sha1).digest(); o = h[-1] & 15
    return str((struct.unpack('>I', h[o:o+4])[0] & 0x7fffffff) % 1000000).zfill(6)
def rand_ip(): return '10.%d.%d.%d' % (random.randint(10, 250), random.randint(0, 250), random.randint(1, 250))

# شناسه‌های دادهٔ پایه با نام پیدا می‌شوند تا آزمون روی هر پایگاه تازه‌ای کار کند
def _id(table, col, val):
    v = psql(f"select id from {table} where {col} = '{val}' order by id limit 1")
    if not v: sys.exit(f'دادهٔ پایه پیدا نشد: {table}.{col} = {val} — اول seed را با SEED_DEMO=true اجرا کنید')
    return v
TEH_P = _id('provinces', 'name', 'تهران')
TEH_C = psql(f"select id from counties where name='تهران' and province_id='{TEH_P}'")
REY_C = psql(f"select id from counties where name='ری' and province_id='{TEH_P}'")
MOSQUE_JAME = _id('mosques', 'name', 'مسجد جامع')
MISSION = _id('lessons', 'title', 'مأموریت: یک گفت‌وگوی واقعی')
def net_barakat():
    """سازمان آزمایشی «برکت» (آزمون api/smoke2 آن را می‌سازد)"""
    return _id('networks', 'name', 'برکت')

def login(mobile, first='کاربر', last='آزمایشی', gender='FEMALE', county=None, invite=None):
    """ورود (و در صورت نیاز ثبت‌نام) با کد پیامکی حالت توسعه؛ هر بار از IP تازه تا محدودیت تکرار نخورد"""
    psql(f"delete from otp_requests")
    s = requests.Session(); s.headers['X-Forwarded-For'] = rand_ip()
    r = s.post(f'{B}/auth/otp', json={'mobile': mobile}).json()
    if 'devCode' not in r: sys.exit(f'کد آزمایشی برنگشت ({r}). API باید با SMS_PROVIDER=console و بیرون از حالت production اجرا شود.')
    v = s.post(f'{B}/auth/verify', json={'mobile': mobile, 'code': r['devCode']}).json()
    if v.get('needsRegistration'):
        body = {'regToken': v['regToken'], 'firstName': first, 'lastName': last, 'gender': gender, 'countyId': county or TEH_C, 'nearMosque': 'مسجد نزدیک'}
        if invite: body['inviteCode'] = invite
        rr = s.post(f'{B}/auth/register', json=body); assert rr.ok, rr.text
    return s
def staff(mobile='09120000000'):
    """کاربر ستاد با رمز دوم فعال"""
    psql("update users set totp_secret=null, totp_enabled_at=null")
    s = login(mobile)
    sec = s.post(f'{B}/auth/mfa/setup').json()['secret']
    r = s.post(f'{B}/auth/mfa/verify', json={'code': totp(sec)}); assert r.ok, r.text
    return s

def wipe_users(cond):
    """کاربران آزمایشی را با همهٔ ردهایشان پاک می‌کند (هر ارجاعی که مانع شد، اول همان پاک می‌شود)"""
    ids = f"(select id from users where {cond})"
    for _ in range(40):
        r = subprocess.run(['psql', DB, '-qc', f"delete from users where {cond}"], capture_output=True, text=True)
        if r.returncode == 0: return
        m = _re.search(r'constraint "(\w+)" on table "(\w+)"', r.stderr)
        if not m: raise RuntimeError(r.stderr)
        col = psql(f"select a.attname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.conname='{m.group(1)}'")
        nullable = psql(f"select is_nullable from information_schema.columns where table_name='{m.group(2)}' and column_name='{col}'") == 'YES'
        psql(f"update {m.group(2)} set {col}=null where {col} in {ids}" if nullable else f"delete from {m.group(2)} where {col} in {ids}")
    raise RuntimeError('wipe_users: too many rounds')
