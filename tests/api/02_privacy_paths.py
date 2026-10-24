import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import *
import lib as h, json, sys
admin = staff()
lr = login('09121000003')   # مریم (از smoke2)
cty = login('09121000002')
ML = MISSION

print('رمزگذاری')
ok(psql("select count(*) from users where mobile not like 'h:%'") == '0', 'شماره‌ها فقط به‌شکل نمایهٔ کور')
ok(psql("select count(*) from direct_messages where body not like 'enc:v1:%'") == '0', 'پیام‌ها رمزشده')
ok(psql("select count(*) from lesson_progress where data is not null and not (data ? '__enc')") == '0', 'گزارش‌ها و برگه‌ها رمزشده')
ok(lr.get(f'{B}/auth/me').json()['mobile'] == '09121000003', 'شماره در پروفایل درست رمزگشایی می‌شود')
u = admin.get(f'{B}/admin/users', params={'q': '09121000003'}).json()
ok(u['total'] == 1 and u['rows'][0]['mobile'] == '09121000003', 'جست‌وجوی ستاد با شماره کار می‌کند', u)

print('ثبت دسترسی')
cty.get(f'{B}/rahyar/learners/' + lr.get(f'{B}/auth/me').json()['id'])
a = admin.get(f'{B}/admin/security/access').json()
ok(any(x['action'] == 'rahyar.learner' for x in a), 'دیدن پروندهٔ کنشگر ثبت شد', a[:2])

print('آزمون مسیر'); psql('delete from path_attempts'); psql("delete from certificates where path_id is not null"); psql("delete from enrollments where completed_at is not null and user_id in (select user_id from enrollments where false)")
path = admin.get(f'{B}/admin/paths').json()[0]
q = {'questions': [{'id': 'q1', 'kind': 'single', 'text': 'مسئول هسته چه می‌بیند؟', 'options': [{'id': 'a', 'text': 'نمره‌ها'}, {'id': 'b', 'text': 'پیشرفت و حضور'}], 'correct': ['b'], 'explain': 'نمره خصوصی است'}]}
r = admin.patch(f'{B}/admin/paths/{path["id"]}', json={'quiz': q, 'passScore': 60}); ok(r.ok, 'ستاد آزمون مسیر را نوشت', r.text)
r = admin.patch(f'{B}/admin/paths/{path["id"]}', json={'quiz': {'questions': [{'id': 'x', 'text': 'بی‌پاسخ', 'options': [], 'correct': []}]}}); ok(r.status_code == 400, 'پرسش بی‌پاسخ درست پذیرفته نمی‌شود')
admin.patch(f'{B}/admin/paths/{path["id"]}', json={'quiz': q})
uid0 = lr.get(f'{B}/auth/me').json()['id']; psql(f"delete from enrollments where user_id='{uid0}' and course_id in (select course_id from path_items where path_id='{path['id']}')")
e = lr.get(f'{B}/paths/{path["slug"]}/exam').json()
ok(e.get('locked') is True and not e['questions'], 'پیش از تمام شدن دوره‌ها آزمون قفل است', e)
r = lr.post(f'{B}/paths/{path["slug"]}/exam', json={'answers': {'q1': ['b']}}); ok(r.status_code == 403, 'ثبت پاسخ در حالت قفل رد شد')
# همهٔ دوره‌های مسیر را برای مریم تمام‌شده علامت بزن (فقط دادهٔ آزمایشی)
uid = lr.get(f'{B}/auth/me').json()['id']
psql(f"insert into enrollments (user_id, course_id, course_version, enrolled_at, completed_at) select '{uid}', course_id, 1, now(), now() from path_items where path_id='{path['id']}' on conflict (user_id, course_id) do update set completed_at = now()")
e = lr.get(f'{B}/paths/{path["slug"]}/exam').json(); ok(not e['locked'] and len(e['questions']) == 1 and 'correct' not in e['questions'][0], 'آزمون باز شد و پاسخ درست فرستاده نمی‌شود', e)
r = lr.post(f'{B}/paths/{path["slug"]}/exam', json={'answers': {'q1': ['a']}}).json(); ok(r['passed'] is False and r['score'] == 0, 'رد شد', r)
r = lr.post(f'{B}/paths/{path["slug"]}/exam', json={'answers': {'q1': ['b']}}).json(); ok(r['passed'] and r['certificate'], 'قبولی و گواهی مسیر', r)
v = requests.get(f'{B}/verify/{r["certificate"]["code"]}').json(); ok(v['valid'] and 'مسیر' in v['courseTitle'], 'استعلام گواهی مسیر', v)
ok(any(c['code'] == r['certificate']['code'] for c in lr.get(f'{B}/me/certificates').json()), 'در گواهی‌های من')

print('پیام گروهی')
o = cty.get(f'{B}/broadcasts/options').json(); ok(any(x['kind'] == 'SCOPE' for x in o['options']) and not o['hq'], 'راهیار فقط دامنهٔ خودش', o)
r = cty.post(f'{B}/broadcasts', json={'kind': 'ALL', 'title': 'سلام همه'}); ok(r.status_code == 403, 'راهیار به همه پیام نمی‌دهد')
p = cty.post(f'{B}/broadcasts/preview', json={'kind': 'SCOPE'}).json(); ok(p['count'] >= 1, f'پیش‌نمایش: {p.get("count")} نفر')
r = cty.post(f'{B}/broadcasts', json={'kind': 'SCOPE', 'title': 'جلسهٔ هفتگی', 'body': 'پنجشنبه ساعت ۱۸', 'link': '/events'}).json(); ok(r['status'] == 'SENT', 'فرستاده شد', r)
n = lr.get(f'{B}/notifications').json(); ok(any(x['title'] == 'جلسهٔ هفتگی' for x in n), 'به کنشگر رسید')
r = admin.post(f'{B}/broadcasts', json={'kind': 'ROLE', 'ids': ['RAHYAR'], 'title': 'به راهیاران'}).json(); ok(r['status'] == 'SENT', 'ستاد به راهیاران', r)
# تأیید بیش از ۱۰۰۰: با یک اپراتور شبیه‌سازی
psql("update broadcasts set status='PENDING' where title='به راهیاران'")
bid = psql("select id from broadcasts where title='به راهیاران' limit 1")
r = admin.post(f'{B}/admin/broadcasts/{bid}/approve'); ok(r.ok, 'تأیید پیام منتظر')
ok(len(admin.get(f'{B}/admin/broadcasts').json()) >= 2, 'فهرست پیام‌های گروهی در ستاد')

print('پشتیبانی')
t = lr.post(f'{B}/support', json={'category': 'COURSE', 'subject': 'آزمون باز نمی‌شود', 'body': 'دکمهٔ ثبت پاسخ‌ها کار نمی‌کند'}).json(); ok('id' in t, 'درخواست ثبت شد', t)
ok(psql(f"select left(body,7) from ticket_messages where ticket_id='{t['id']}'") == 'enc:v1:', 'متن درخواست رمزشده')
q = admin.get(f'{B}/admin/support').json(); ok(any(x['id'] == t['id'] for x in q), 'در صف ستاد')
asg = admin.get(f'{B}/admin/support-assignees', params={'q': 'فاطمه'}).json(); ok(len(asg) >= 1, 'فهرست ارجاع', asg)
ctyid = cty.get(f'{B}/auth/me').json()['id']
r = admin.post(f'{B}/admin/support/{t["id"]}/assign', json={'userId': ctyid}); ok(r.ok, 'ارجاع به راهیار', r.text)
ok(any(x['id'] == t['id'] for x in cty.get(f'{B}/support/assigned').json()), 'راهیار ارجاع را می‌بیند')
r = cty.post(f'{B}/support/{t["id"]}/reply', json={'body': 'صفحه را یک بار تازه کنید'}); ok(r.ok, 'راهیار پاسخ داد')
th = lr.get(f'{B}/support/{t["id"]}').json(); ok(th['status'] == 'ANSWERED' and len(th['messages']) == 2 and th['messages'][1]['body'] == 'صفحه را یک بار تازه کنید', 'کنشگر پاسخ را دید', th)
other = login('09121000006')
ok(other.get(f'{B}/support/{t["id"]}').status_code == 403, 'دیگران درخواست را نمی‌بینند')
r = lr.post(f'{B}/support/{t["id"]}/status', json={'status': 'CLOSED'}); ok(r.ok, 'بستن درخواست')

print('گزارش نمونه')
narges = login('09121000007')
nid = narges.get(f'{B}/auth/me').json()['id']
psql(f"delete from mission_samples where learner_id='{nid}'"); psql(f"delete from lesson_progress where user_id='{nid}' and lesson_id='{ML}'")
narges.post(f'{B}/courses/nojavan-1/enroll')
narges.post(f'{B}/missions/{ML}/submit', json={'did': 'با سه نوجوان دربارهٔ اردوی تابستان حرف زدیم و قرار گذاشتیم.', 'learned': 'نظرخواهی معجزه می‌کند'})
r = cty.post(f'{B}/rahyar/reports/{nid}/{ML}', json={'kind': 'APPROVE', 'body': 'عالی', 'proposeSample': True}); ok(r.ok, 'تأیید با پیشنهاد نمونه', r.text)
th = narges.get(f'{B}/missions/{ML}').json(); ok((th.get('sample') or {}).get('status') == 'PROPOSED', 'کنشگر پیشنهاد را می‌بیند', th.get('sample'))
ok(not any(x['learnerId'] == nid for x in admin.get(f'{B}/admin/samples').json()), 'پیش از اجازه، ستاد متن را نمی‌بیند')
r = narges.post(f'{B}/missions/{ML}/sample', json={'decision': 'anon'}); ok(r.ok, 'اجازه بی‌نام')
s = [x for x in admin.get(f'{B}/admin/samples').json() if x['learnerId'] == nid]; ok(s and s[0]['status'] == 'CONSENTED' and 'کنشگری از' in s[0]['authorLabel'], 'ستاد نمونهٔ مجاز را می‌بیند', s)
r = admin.post(f'{B}/admin/samples/{nid}/{ML}', json={'publish': True}); ok(r.ok, 'انتشار')
pub = lr.get(f'{B}/lessons/{ML}/samples').json(); ok(any('اردوی تابستان' in x['text'] for x in pub), 'نمونه زیر مأموریت دیده می‌شود', pub)

print('پیام‌رسان')
st = lr.get(f'{B}/me/messenger').json(); ok('bale' in st and 'eitaa' in st, 'وضعیت پیام‌رسان', st)
r = lr.post(f'{B}/me/messenger/bale/code'); ok(r.status_code == 400 if not st['bale']['available'] else r.ok, 'کد اتصال (بی‌توکن خاموش است)')

print('رمز دوم: بازنشانی')
r = admin.post(f'{B}/admin/security/users/{admin.get(f"{B}/auth/me").json()["id"]}/mfa-reset'); ok(r.ok, 'بازنشانی رمز دوم')
print('\nنتیجه:', 'همه درست' if not h.fails else f'{h.fails} خطا'); sys.exit(1 if h.fails else 0)
