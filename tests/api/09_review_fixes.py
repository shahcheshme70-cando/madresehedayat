"""آزمون‌های برگشت برای یافته‌های بازبینی مستقل (۲ آبان ۱۴۰۵) — فقط کاربران ساختگی"""
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import *
import lib as h

NET = net_barakat()
hq = staff()
admin = login('09126000001'); a = login('09126000002'); c = login('09126000004')
A = psql("select id from users where first_name='عضو' and last_name='یکم'")
psql(f"delete from events where title like 'آزمون بازبینی%'")
# اشتراک ویژهٔ فعال برای آزمون‌ها (آزمون ۰۵ آن را ساخته؛ این‌جا مطمئن می‌شویم)
psql(f"update subscriptions set plan='ORG_PREMIUM', seats=10, cancelled_at=null, starts_at=now()-interval '1 day', ends_at=now()+interval '300 days' where network_id='{NET}'")

print('۱. برگزارکنندهٔ محدود برنامه را عمومی نمی‌کند')
r = admin.post(f'{B}/manage/events', json={'title': 'آزمون بازبینی سازمانی', 'kind': 'ONLINE', 'onlineUrl': 'https://example.org/x', 'audienceNetworkId': NET, 'startsAt': iso(3), 'endsAt': iso(3, 60)})
ok(r.ok, 'برنامهٔ ویژهٔ اعضای سازمان ساخته شد', r.text); E1 = r.json().get('id')
r = admin.patch(f'{B}/manage/events/{E1}', json={'audienceNetworkId': ''})
ok(r.status_code == 403, 'پاک کردن مخاطب ویژه رد شد: ' + r.json().get('message', ''))
ok(psql(f"select audience_network_id from events where id='{E1}'") == NET, 'مخاطب در پایگاه داده دست نخورد')

print('۲. زمان نادرست پیش از ذخیره رد می‌شود')
before = psql(f"select ends_at from events where id='{E1}'")
r = admin.patch(f'{B}/manage/events/{E1}', json={'endsAt': iso(2)})
ok(r.status_code == 400 and r.json()['code'] == 'bad_time', 'پایان پیش از شروع رد شد')
ok(psql(f"select ends_at from events where id='{E1}'") == before, 'ردیف ذخیره نشد')

print('۳. نظر متنی برنامه رمزگذاری می‌شود و بی‌نام به برگزارکننده می‌رسد')
r = hq.post(f'{B}/manage/events', json={'title': 'آزمون بازبینی عمومی', 'kind': 'IN_PERSON', 'location': 'تهران، مسجد آزمون', 'startsAt': iso(-1), 'endsAt': iso(-1, 60)}); E2 = r.json()['id']
psql(f"update events set status='PUBLISHED', starts_at=now()+interval '1 day', ends_at=now()+interval '1 day 1 hour' where id='{E2}'")
ok(a.post(f'{B}/events/{E2}/register').ok, 'ثبت‌نام')
psql(f"update events set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour' where id='{E2}'")
ok(hq.post(f'{B}/manage/events/{E2}/people/{A}', json={'action': 'attend'}).ok, 'حضور زده شد')
r = a.post(f'{B}/events/{E2}/feedback', json={'rating': 4, 'comment': 'سالن کمی سرد بود'}); ok(r.ok, 'نظر ثبت شد', r.text)
ok(psql(f"select feedback->>'comment' like 'enc:v1:%' from registrations where event_id='{E2}' and user_id='{A}'") == 't', 'نظر در پایگاه داده رمزگذاری شده')
m = hq.get(f'{B}/manage/events/{E2}').json()
ok(all('comment' not in (p.get('feedback') or {}) for p in m['people']), 'کنار نام‌ها نظری نیست')
ok(m.get('comments') == ['سالن کمی سرد بود'], 'نظر جدا و بی‌نام', m.get('comments'))
ok(a.get(f'{B}/events/{E2}').json()['my']['feedback']['comment'] == 'سالن کمی سرد بود', 'نویسنده نظر خودش را می‌بیند')

print('۴. سقف اشتراک هنگام ثبت‌نام با پیوند هسته')
wipe_users("mobile in (select mobile from users where first_name='تازه' and last_name='ثبت‌نام')")
psql(f"delete from cores where invite_code='smkrevinv'")
psql(f"insert into cores (id, name, network_id, invite_code) values ('smkrevcore', 'هستهٔ آزمون سقف', '{NET}', 'smkrevinv')")
used = int(psql(f"select count(*) from network_members where network_id='{NET}' and accepted_at is not null"))
psql(f"update subscriptions set seats={used} where network_id='{NET}' and cancelled_at is null")
psql('delete from otp_requests')
s = requests.Session(); s.headers['X-Forwarded-For'] = rand_ip()
code = s.post(f'{B}/auth/otp', json={'mobile': '09126000099'}).json()['devCode']
v = s.post(f'{B}/auth/verify', json={'mobile': '09126000099', 'code': code}).json()
r = s.post(f'{B}/auth/register', json={'regToken': v['regToken'], 'firstName': 'تازه', 'lastName': 'ثبت‌نام', 'gender': 'FEMALE', 'countyId': TEH_C, 'nearMosque': 'x', 'inviteCode': 'smkrevinv'}).json()
ok(r.get('user') and r.get('notice') and 'ظرفیت' in r['notice'], 'حساب ساخته شد با توضیح ظرفیت', r.get('notice'))
ok(psql("select count(*) from core_memberships where core_id='smkrevcore'") == '0', 'به هستهٔ سازمانِ پر اضافه نشد')
psql(f"update subscriptions set seats=10 where network_id='{NET}' and cancelled_at is null")

print('۵. پویش: کار پویشِ تمام‌شده از راه پویش دیگر برداشته نمی‌شود')
mk = lambda t: hq.post(f'{B}/manage/campaigns', json={'title': t, 'summary': 'پویش آزمایشی برای بازبینی', 'scope': 'NATIONAL', 'startsAt': iso(-1), 'endsAt': iso(5), 'tasks': [{'title': 'کار یک'}]}).json()['id']
psql("delete from campaigns where title like 'آزمون بازبینی پویش%'")
C1, C2 = mk('آزمون بازبینی پویش تمام'), mk('آزمون بازبینی پویش فعال')
for x in (C1, C2): hq.post(f'{B}/manage/campaigns/{x}/publish')
a.post(f'{B}/campaigns/{C1}/join'); a.post(f'{B}/campaigns/{C2}/join')
T1 = psql(f"select id from campaign_tasks where campaign_id='{C1}'")
ok(a.post(f'{B}/campaigns/{C1}/tasks/{T1}').ok, 'کار ثبت شد')
psql(f"update campaigns set starts_at=now()-interval '10 days', ends_at=now()-interval '1 day' where id='{C1}'")
a.delete(f'{B}/campaigns/{C2}/tasks/{T1}')
ok(psql(f"select count(*) from campaign_done where task_id='{T1}'") == '1', 'شمار پویش تمام‌شده دست نخورد')

print('۶. پویش استانی: هستهٔ استان دیگر پیوسته نمی‌شود')
other = psql(f"select id from provinces where id <> '{TEH_P}' order by name limit 1")
r = hq.post(f'{B}/manage/campaigns', json={'title': 'آزمون بازبینی پویش استانی', 'summary': 'پویش آزمایشی برای بازبینی', 'scope': 'PROVINCE', 'provinceId': other, 'startsAt': iso(-1), 'endsAt': iso(5), 'tasks': [{'title': 'کار'}]}).json(); C3 = r['id']
hq.post(f'{B}/manage/campaigns/{C3}/publish')
psql(f"update cores set leader_id='{A}' where id='smkrevcore'")
r = a.post(f'{B}/campaigns/{C3}/join-core', json={'coreId': 'smkrevcore'}); ok(r.status_code == 403, 'رد شد: ' + r.json().get('message', ''))
ok(psql(f"select count(*) from campaign_cores where campaign_id='{C3}'") == '0', 'هسته شمرده نشد')

print('۷. خروجی CSV فرمول اجرا نمی‌کند')
psql(f"update users set first_name='=HYPERLINK(\"x\")' where id='{A}'")
r = admin.get(f'{B}/org/{NET}/export'); ok(r.ok and '"\'=HYPERLINK' in r.text, 'نام فرمول‌مانند خنثی شد', r.text[:200])
psql(f"update users set first_name='عضو' where id='{A}'")

print('۸. کلاس زندهٔ لغوشده باز نمی‌شود')
r = admin.post(f'{B}/manage/events', json={'title': 'آزمون بازبینی کلاس', 'kind': 'ONLINE', 'useBbb': True, 'audienceNetworkId': NET, 'startsAt': iso(0, 5), 'endsAt': iso(0, 65)}); E3 = r.json().get('id')
ok(r.ok, 'کلاس زنده ساخته شد', r.text)
admin.post(f'{B}/manage/events/{E3}/publish'); a.post(f'{B}/events/{E3}/register')
admin.post(f'{B}/manage/events/{E3}/cancel', json={'reason': 'آزمون لغو'})
r = a.post(f'{B}/events/{E3}/join'); ok(r.status_code in (400, 403), 'ورود به کلاس لغوشده رد شد: ' + r.json().get('message', ''))

print('۹. فاکتور باطل‌شده پرداخت نمی‌شود')
r = hq.post(f'{B}/admin/invoices', json={'networkId': NET, 'title': 'آزمون بازبینی فاکتور', 'amount': 1000}).json(); I = r['id']
ok(hq.post(f'{B}/admin/invoices/{I}/void').ok, 'باطل شد')
r = hq.post(f'{B}/admin/invoices/{I}/pay', json={'paymentRef': '123'}); ok(r.status_code == 400, 'پرداخت فاکتور باطل رد شد')

print('۱۰. پیام‌های خطا')
r = requests.get(f'{B}/no-such-route'); ok(r.status_code == 404 and r.json()['code'] == 'not_found' and 'نشانی' in r.json()['message'], 'نشانی ناموجود: پیام فارسی')
r = requests.post(f'{B}/auth/otp', data='{bad', headers={'content-type': 'application/json', 'X-Forwarded-For': rand_ip()}); ok(r.status_code == 400 and r.json()['code'] == 'bad_json', 'JSON خراب: پیام فارسی')
r = a.post(f'{B}/feedback', json={'kind': 'XX', 'body': ''}); ok(r.status_code == 400 and '«نوع»' in r.json()['message'] and isinstance(r.json()['fields'], dict), 'خانه‌های نادرست با نام فارسی', r.json())

psql("delete from cores where id='smkrevcore'")
print('\nنتیجه:', 'همه درست' if not h.fails else f'{h.fails} خطا'); sys.exit(1 if h.fails else 0)
