import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import *
import lib as h, sys, requests, hmac, hashlib, json, time, urllib.parse
TOKEN = 'test:eitaa-token'
def sign(fields):
    data = '\n'.join(sorted(f'{k}={v}' for k, v in fields.items()))
    key = hmac.new(b'WebAppData', TOKEN.encode(), hashlib.sha256).digest()
    hsh = hmac.new(key, data.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode({**fields, 'hash': hsh})
def init(uid): return sign({'auth_date': str(int(time.time())), 'user': json.dumps({'id': uid, 'first_name': 'سمیه', 'allows_write_to_pm': True}, ensure_ascii=False, separators=(',', ':'))})
print('ایتا')
psql("delete from messenger_links where provider='EITAA'")
s = requests.Session(); s.headers['X-Forwarded-For'] = '10.9.9.9'
r = s.post(f'{B}/auth/eitaa', json={'initData': init(555001)}).json(); ok(r.get('linked') is False and r.get('firstName') == 'سمیه', 'ایتای وصل‌نشده', r)
bad = init(555001).replace('555001', '555002'); r = s.post(f'{B}/auth/eitaa', json={'initData': bad}); ok(r.status_code == 400, 'امضای دست‌کاری‌شده رد شد')
psql('delete from otp_requests')
c = s.post(f'{B}/auth/otp', json={'mobile': '09121000006'}).json()['devCode']
v = s.post(f'{B}/auth/verify', json={'mobile': '09121000006', 'code': c}).json(); ok(v.get('user'), 'ورود با کد')
ok(psql("select count(*) from messenger_links where provider='EITAA' and chat_id='555001'") == '1', 'حساب ایتا پس از ورود وصل شد')
s2 = requests.Session(); s2.headers['X-Forwarded-For'] = '10.9.9.8'
r = s2.post(f'{B}/auth/eitaa', json={'initData': init(555001)}).json(); ok(r.get('linked') and r['user']['mobile'] == '09121000006', 'دفعهٔ بعد بی‌کد وارد شد', r)
ok(s2.get(f'{B}/auth/me').ok, 'نشست برقرار است')
st = s2.get(f'{B}/me/messenger').json(); ok(st['eitaa']['linked'] and st['eitaa']['available'], 'وضعیت ایتا', st)
old = sign({'auth_date': str(int(time.time()) - 3 * 86400), 'user': json.dumps({'id': 555001})}); ok(s2.post(f'{B}/auth/eitaa', json={'initData': old}).status_code == 400, 'initData کهنه رد شد')
print('شماره از ایتا')
s3 = requests.Session(); s3.headers['X-Forwarded-For'] = '10.9.9.7'
contact = sign({'auth_date': str(int(time.time())), 'contact': json.dumps({'phone_number': '989121000003', 'user_id': 1}, separators=(',', ':'))})
r = s3.post(f'{B}/auth/eitaa/contact', json={'contact': contact}).json(); ok(r.get('user') and r['user']['mobile'] == '09121000003', 'ورود با شمارهٔ تأییدشدهٔ ایتا', r)
r = s3.post(f'{B}/auth/eitaa/contact', json={'contact': contact.replace('09121', '09129').replace('989121000003', '989121000009')}); ok(r.status_code == 400, 'شمارهٔ دست‌کاری‌شده رد شد')
new = sign({'auth_date': str(int(time.time())), 'phone_number': '+989350000777'})
r = requests.post(f'{B}/auth/eitaa/contact', json={'contact': new}, headers={'X-Forwarded-For': '10.9.9.6'}).json(); ok(r.get('needsRegistration') and r.get('regToken'), 'شمارهٔ تازه به ثبت‌نام می‌رود', r)
print('\nنتیجه:', 'همه درست' if not h.fails else f'{h.fails} خطا'); sys.exit(1 if h.fails else 0)
