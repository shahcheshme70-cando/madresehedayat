"""آزمون API مرحلهٔ ۲: راهیاری، هسته، امام محله، سازمان، برنامه‌ها (فقط کاربران ساختگی)"""
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import json, subprocess, datetime as dt
from lib import *
COURSE = 'nojavan-1'
wipe_users("(first_name || ' ' || last_name) in ('زهرا راهیار‌استانی','فاطمه راهیار‌شهرستان','علی برادر','مریم کنشگر','سمیه کنشگر‌ری','نرگس عضو','سید محمد امام‌محله')")
psql("update users set totp_secret = null, totp_enabled_at = null")
admin = login('09120000000')
r = admin.get(f'{B}/admin/stats'); ok(r.status_code == 403 and r.json().get('code') == 'mfa_required', 'ستاد بدون رمز دوم به پنل نمی‌رسد', r.text)
sec = admin.post(f'{B}/auth/mfa/setup').json()['secret']
r = admin.post(f'{B}/auth/mfa/verify', json={'code': '000000'}); ok(r.status_code == 400, 'کد نادرست رمز دوم رد شد')
r = admin.post(f'{B}/auth/mfa/verify', json={'code': totp(sec)}); ok(r.ok, 'رمز دوم فعال شد', r.text)
r = admin.get(f'{B}/admin/stats'); ok(r.ok, 'پس از رمز دوم پنل ستاد باز است', r.text)
print('ساختار راهیاری (بانور)')
tree = j(admin.get(f'{B}/rahyar/tree', params={'gender': 'FEMALE'}))
for p in tree.get('positions', []) if isinstance(tree, dict) else []:
    pass
# پاک‌سازی درخت آزمایشی قبلی
def wipe(g):
    t = j(admin.get(f'{B}/rahyar/tree', params={'gender': g}))
    ps = t['positions'] if isinstance(t, dict) else t
    order = {'COUNTY': 0, 'PROVINCIAL': 1, 'REGIONAL': 2, 'MANAGER': 3, 'DEPUTY': 4}
    for p in sorted(ps, key=lambda p: order[p['layer']]):
        admin.delete(f'{B}/rahyar/positions/{p["id"]}')
wipe('FEMALE')

dep = j(admin.post(f'{B}/rahyar/positions', json={'gender': 'FEMALE', 'layer': 'DEPUTY'}))
ok('id' in dep, 'معاون ساخته شد', dep)
dup = admin.post(f'{B}/rahyar/positions', json={'gender': 'FEMALE', 'layer': 'DEPUTY'})
ok(dup.status_code == 400, 'معاون دوم پذیرفته نمی‌شود', dup.text)
man = j(admin.post(f'{B}/rahyar/positions', json={'gender': 'FEMALE', 'layer': 'MANAGER', 'parentId': dep['id']}))
reg = j(admin.post(f'{B}/rahyar/positions', json={'gender': 'FEMALE', 'layer': 'REGIONAL', 'parentId': man['id']}))
r = admin.put(f'{B}/rahyar/positions/{reg["id"]}/provinces', json={'provinceIds': [TEH_P]})
ok(r.ok, 'استان تهران به منطقه داده شد', r.text)
prov = j(admin.post(f'{B}/rahyar/positions', json={'gender': 'FEMALE', 'layer': 'PROVINCIAL', 'parentId': reg['id'], 'provinceId': TEH_P}))
cty = j(admin.post(f'{B}/rahyar/positions', json={'gender': 'FEMALE', 'layer': 'COUNTY', 'parentId': prov['id'], 'countyId': TEH_C}))
ok('id' in cty, 'جایگاه شهرستان تهران', cty)
bad = admin.post(f'{B}/rahyar/positions', json={'gender': 'FEMALE', 'layer': 'COUNTY', 'parentId': dep['id'], 'countyId': REY_C})
ok(bad.status_code == 400, 'شهرستان زیر معاون مستقیم پذیرفته نمی‌شود', bad.text)

provU = login('09121000001', 'زهرا', 'راهیار‌استانی')
ctyU = login('09121000002', 'فاطمه', 'راهیار‌شهرستان')
r = admin.patch(f'{B}/rahyar/positions/{prov["id"]}', json={'holderMobile': '09121000001'}); ok(r.ok, 'راهیار استانی گماشته شد', r.text)
r = admin.patch(f'{B}/rahyar/positions/{cty["id"]}', json={'holderMobile': '09121000002'}); ok(r.ok, 'راهیار شهرستان گماشته شد', r.text)
male = login('09121000005', 'علی', 'برادر', gender='MALE')
r = admin.patch(f'{B}/rahyar/positions/{cty["id"]}', json={'holderMobile': '09121000005'}); ok(r.status_code == 400, 'مرد در درخت بانور گماشته نمی‌شود', r.text)

learner = login('09121000003', 'مریم', 'کنشگر')
lr = login('09121000006', 'سمیه', 'کنشگر‌ری', county=REY_C)
print('مسئول‌یابی')
me = j(learner.get(f'{B}/me/rahyar'))
ok(me.get('rahyar') and 'شهرستان' in me['rahyar']['layer'], 'راهیار مریم = راهیار شهرستان', me)
me2 = j(lr.get(f'{B}/me/rahyar'))
ok(me2.get('rahyar') and 'استان' in me2['rahyar']['layer'], 'ری بی‌راهیار → مسئولیت با استانی', me2)
ctyU.post(f'{B}/auth/refresh'); provU.post(f'{B}/auth/refresh')  # توکن تازه با نقش RAHYAR
ls = j(ctyU.get(f'{B}/rahyar/learners'))
names = [x.get('name') for x in (ls if isinstance(ls, list) else ls.get('learners', []))]
ok(any('مریم' in (n or '') for n in names), 'مریم در فهرست راهیار شهرستان', ls)
ok(not any('سمیه' in (n or '') for n in names), 'سمیهٔ ری در فهرست راهیار شهرستان تهران نیست')
ls2 = j(provU.get(f'{B}/rahyar/learners'))
names2 = [x.get('name') for x in (ls2 if isinstance(ls2, list) else ls2.get('learners', []))]
ok(any('سمیه' in (n or '') for n in names2) and any('مریم' in (n or '') for n in names2), 'استانی هر دو را می‌بیند', ls2)
r = ctyU.get(f'{B}/rahyar/learners/' + 'x'); ok(r.status_code in (403, 404), 'راهیار کنشگر بیرون از حوزه را نمی‌بیند', r.status_code)

print('مأموریت')
learner.post(f'{B}/courses/{COURSE}/enroll')
r = learner.post(f'{B}/lessons/{MISSION}/progress', json={'completed': True})
ok(r.status_code == 400, 'مسیر قدیمی پیشرفت برای مأموریت بسته است', r.text)
r = j(learner.post(f'{B}/missions/{MISSION}/submit', json={'did': 'بعد از نماز با دو نوجوان دربارهٔ برنامهٔ تابستان حرف زدم.', 'learned': 'باید بیشتر گوش بدهم'}))
ok(r.get('status') == 'submitted', 'گزارش فرستاده شد (ON_SUBMIT)', r)
q = j(ctyU.get(f'{B}/rahyar/reports', params={'filter': 'open'}))
items = q if isinstance(q, list) else q.get('items', [])
ok(len(items) >= 1, 'گزارش در صف راهیار', q)
learner_id = j(learner.get(f'{B}/auth/me'))['id']
r = j(ctyU.post(f'{B}/rahyar/reports/{learner_id}/{MISSION}', json={'kind': 'REVISE', 'body': 'لطفاً بنویسید نوجوان‌ها چه پیشنهادی داشتند.'}))
ok(isinstance(r, dict) and not r.get('code'), 'راهیار بازبینی خواست', r)
t = j(learner.get(f'{B}/missions/{MISSION}'))
ok(t.get('status') == 'needs_revision' or (t.get('data') or {}).get('status') == 'needs_revision', 'وضعیت «نیاز به بازبینی»', t)
r = j(learner.post(f'{B}/missions/{MISSION}/submit', json={'did': 'دوباره: پیشنهادشان اردوی کوه بود و کلاس قرآن عصرها.'}))
ok(r.get('status') == 'submitted', 'گزارش دوباره فرستاده شد', r)
r = ctyU.post(f'{B}/rahyar/reports/{learner_id}/{MISSION}', json={'kind': 'APPROVE', 'body': 'عالی بود'}); ok(r.ok, 'تأیید', r.text)

print('پیام')
r = learner.post(f'{B}/messages', json={'body': 'سلام، برای مأموریت بعدی سؤال دارم'}); ok(r.ok, 'کنشگر پیام داد', r.text)
r = j(ctyU.get(f'{B}/rahyar/messages')); ok(len(r) >= 1, 'راهیار پیام را دید', r)
learner.patch(f'{B}/me/prefs', json={'allowRahyarMessages': False})
r = ctyU.post(f'{B}/rahyar/messages/{learner_id}', json={'body': 'سلام'})
ok(r.status_code in (400, 403), 'با خاموش‌بودن پیام، راهیار پیام آغاز نمی‌کند', r.text)
learner.patch(f'{B}/me/prefs', json={'allowRahyarMessages': True})
r = ctyU.post(f'{B}/rahyar/messages/{learner_id}', json={'body': 'سلام، بفرمایید'}); ok(r.ok, 'پس از روشن‌کردن، پاسخ می‌رسد', r.text)
n = j(learner.get(f'{B}/notifications/unread')); ok(n.get('count', 0) >= 1, f'اعلان خوانده‌نشده: {n.get("count")}')

print('هسته و امام')
core = j(learner.post(f'{B}/cores', json={'name': 'هستهٔ نور'}))
ok('inviteCode' in core, 'خواهر هسته ساخت و مسئولش شد', core)
other = login('09121000007', 'نرگس', 'عضو', invite=core['inviteCode'])
c = j(learner.get(f'{B}/cores/{core["id"]}'))
ok(len(c['members']) == 2 and 'active' in c['members'][0], 'مسئول اعضا و پیشرفت را می‌بیند', c)
c2 = j(other.get(f'{B}/cores/{core["id"]}'))
ok('active' not in c2['members'][0] and c2['inviteCode'] is None, 'عضو عادی فقط نام‌ها را می‌بیند', c2)
r = male.post(f'{B}/cores', json={'name': 'هستهٔ برادران'}); ok(r.status_code == 403, 'برادر بی‌امام هسته نمی‌سازد', r.text)
imam = login('09121000004', 'سید محمد', 'امام‌محله', gender='MALE')
mosque = MOSQUE_JAME
r = admin.post(f'{B}/admin/mosques/{mosque}/imam', json={'mobile': '09121000004'}); ok(r.ok, 'ستاد امام محله را تعیین کرد', r.text)
imam.post(f'{B}/auth/refresh')
im = j(imam.get(f'{B}/imam')); ok(isinstance(im, list) and im[0]['inviteCode'].startswith('m'), 'پنل امام و کد دعوت مسجد', im)
r = j(male.post(f'{B}/join', json={'code': im[0]['inviteCode']})); ok(r.get('joined') == 'mosque', 'برادر با کد به مسجد پیوست', r)
mc = j(imam.post(f'{B}/cores', json={'name': 'هستهٔ نوجوانان', 'mosqueId': mosque})); ok('id' in mc, 'امام هسته ساخت', mc)
im = j(imam.get(f'{B}/imam')); ok(any('علی' in f['name'] for f in im[0]['free']), 'عضو آزاد در پنل امام', im[0]['free'])

print('برنامه‌ها')
start = (dt.datetime.utcnow() + dt.timedelta(days=3)).isoformat() + 'Z'
end = (dt.datetime.utcnow() + dt.timedelta(days=3, hours=2)).isoformat() + 'Z'
ev = j(ctyU.post(f'{B}/manage/events', json={'title': 'دورهمی راهیاران محله', 'kind': 'IN_PERSON', 'startsAt': start, 'endsAt': end, 'capacity': 1, 'waitlist': True, 'audienceGender': 'FEMALE'}))
ok('id' in ev, 'راهیار برنامه ساخت (پیش‌نویس)', ev)
r = ctyU.post(f'{B}/manage/events/{ev["id"]}/publish'); ok(r.status_code == 400, 'بی‌نشانی منتشر نمی‌شود', r.text)
ctyU.patch(f'{B}/manage/events/{ev["id"]}', json={'location': 'تهران، مسجد جامع، سالن طبقهٔ دوم'})
r = ctyU.post(f'{B}/manage/events/{ev["id"]}/publish'); ok(r.ok, 'منتشر شد', r.text)
r = j(male.post(f'{B}/events/{ev["id"]}/register')); ok(r.get('code') == 'audience', 'برادر در برنامهٔ خواهران ثبت‌نام نمی‌کند', r)
r1 = j(learner.post(f'{B}/events/{ev["id"]}/register')); ok(r1.get('status') == 'REGISTERED' and r1.get('checkInCode'), 'مریم ثبت‌نام شد با کد ورود', r1)
r2 = j(lr.post(f'{B}/events/{ev["id"]}/register')); ok(r2.get('status') == 'WAITLIST', 'نفر دوم به فهرست انتظار رفت', r2)
r = j(learner.post(f'{B}/events/{ev["id"]}/cancel')); ok(r.get('ok') and not r.get('late'), 'مریم انصراف داد', r)
d = j(lr.get(f'{B}/events/{ev["id"]}')); ok(d['my']['status'] == 'REGISTERED', 'نفر انتظار جایش را گرفت', d['my'])
r = j(learner.post(f'{B}/events/{ev["id"]}/register')); ok(r.get('status') == 'WAITLIST', 'مریم دوباره → انتظار', r)
code = d['my']['checkInCode']
r = j(ctyU.post(f'{B}/manage/events/{ev["id"]}/checkin', json={'code': f'MH1:{ev["id"]}:{code}'})); ok(r.get('ok') and 'سمیه' in r.get('name', ''), 'ورود با QR', r)
r = j(ctyU.post(f'{B}/manage/events/{ev["id"]}/checkin', json={'code': code})); ok(r.get('already'), 'ورود تکراری شناخته شد', r)
r = j(ctyU.post(f'{B}/manage/events/{ev["id"]}/checkin', json={'code': 'ZZZZZZ'})); ok(not r.get('ok'), 'کد نادرست رد شد', r)
r = j(ctyU.post(f'{B}/manage/events/{ev["id"]}/checkin-bulk', json={'items': [{'code': code}]})); ok(len(r) == 1, 'همگام‌سازی آفلاین', r)
reg = j(ctyU.get(f'{B}/manage/events/{ev["id"]}')); ok(reg['counts']['attended'] == 1 and 'mobile' not in json.dumps(reg), 'فهرست ثبت‌نامی بی‌شمارهٔ همراه', reg['counts'])
r = ctyU.get(f'{B}/manage/events/{ev["id"]}/csv'); ok(r.ok and 'سمیه' in r.text, 'خروجی CSV')
r = learner.get(f'{B}/manage/events/{ev["id"]}'); ok(r.status_code == 403, 'کنشگر به مدیریت برنامه دسترسی ندارد', r.status_code)
r = lr.post(f'{B}/events/{ev["id"]}/feedback', json={'rating': 5, 'comment': 'خوب بود'}); ok(r.ok, 'بازخورد شرکت‌کننده', r.text)
r = lr.get(f'{B}/events/{ev["id"]}/ics'); ok('BEGIN:VCALENDAR' in r.text, 'فایل تقویم')
# ثبت‌نام گروهی
r = j(learner.post(f'{B}/events/{ev["id"]}/register-group', json={'coreId': core['id'], 'userIds': [c['members'][0]['id'], c['members'][1]['id']]}))
ok(isinstance(r, list) and len(r) == 2, 'ثبت‌نام گروهی مسئول هسته', r)
r = j(ctyU.post(f'{B}/manage/events/{ev["id"]}/cancel', json={'reason': 'تعطیلی رسمی'})); ok(r.get('ok'), 'لغو برنامه', r)
n = j(lr.get(f'{B}/notifications')); ok(any('لغو' in x['title'] for x in n), 'اعلان لغو رسید')
inst = learner.post(f'{B}/manage/events', json={'title': 'x', 'kind': 'ONLINE', 'startsAt': start, 'endsAt': end})
ok(inst.status_code == 403, 'کنشگر برنامه نمی‌سازد', inst.status_code)

print('سازمان')
nets = j(admin.get(f'{B}/admin/networks'))
org = next((x for x in nets if x['kind'] == 'ORGANIZATION'), None)
if not org:
    org = j(admin.post(f'{B}/admin/networks', json={'name': 'برکت', 'kind': 'ORGANIZATION', 'underRahyar': False}))
ok(org and 'id' in org, 'سازمان آزمایشی', org)
r = admin.post(f'{B}/admin/networks/{org["id"]}/admin', json={'mobile': '09121000001'}); ok(r.ok, 'مدیر سازمان', r.text)
import datetime as _dt
psql(f"delete from subscriptions where network_id='{org['id']}'")
_n = _dt.datetime.now(_dt.timezone.utc)
r = admin.post(f'{B}/admin/subscriptions', json={'networkId': org['id'], 'plan': 'ORG_BASIC', 'seats': 50, 'startsAt': (_n - _dt.timedelta(days=1)).isoformat(), 'endsAt': (_n + _dt.timedelta(days=300)).isoformat()})
ok(r.ok, 'اشتراک سازمان (مدل کسب‌وکار)', r.text)
provU.post(f'{B}/auth/refresh')
r = j(provU.post(f'{B}/org/{org["id"]}/members', json={'mobiles': ['09121000003', '09129999999']})); ok(r == {'sent': 2, 'invalid': 0}, 'دعوت عضو با شماره', r)
ok(learner.post(f'{B}/me/orgs/{org["id"]}/accept').ok, 'عضو دعوت را پذیرفت')
r = j(provU.get(f'{B}/org/{org["id"]}')); ok(len(r['members']) >= 1, 'پنل سازمان', r)
r = learner.get(f'{B}/org/{org["id"]}'); ok(r.status_code == 403, 'غیرمدیر به سازمان دسترسی ندارد')
prof = j(provU.get(f'{B}/auth/me')); ok(prof.get('orgs') and 'RAHYAR' in prof['roles'], 'پروفایل نقش راهیار و سازمان دارد', prof.get('roles'))

done()
