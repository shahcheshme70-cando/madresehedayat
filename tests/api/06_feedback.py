import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import *
import lib as h, sys
psql("delete from feedback; delete from lesson_ratings; delete from course_ratings")
hq = staff(); a = login('09126000002'); c = login('09126000004')
print('بازخورد')
r = a.post(f'{B}/feedback', json={'kind': 'BUG', 'mood': 2, 'body': 'دکمهٔ آزمون در گوشی کار نمی‌کند', 'path': '/lessons/x', 'context': {'courseId': 'smk6course', 'evil': 'x'}, 'device': 'Chrome 390x800'}); ok(r.ok, 'گزارش مشکل', r.text); F1 = r.json()['id']
r = a.post(f'{B}/feedback', json={'kind': 'IDEA', 'body': 'کاش صوت درس‌ها دانلودی باشد', 'anonymous': True}); ok(r.ok, 'پیشنهاد بی‌نام'); F2 = r.json()['id']
ok(a.post(f'{B}/feedback', json={'kind': 'XX', 'body': 'سلام'}).status_code == 400, 'نوع نادرست رد شد')
ok(psql(f"select body like 'enc:v1:%' from feedback where id='{F1}'") == 't', 'متن رمزگذاری شده')
ok(psql(f"select context::text from feedback where id='{F1}'") == '{"courseId": "smk6course"}', 'زمینهٔ ناشناخته دور ریخته شد')
lst = hq.get(f'{B}/admin/feedback').json(); m = {x['id']: x for x in lst}
ok(m[F1]['from'] and m[F1]['course'] == 'دورهٔ ویژهٔ آزمون' and m[F1]['device'], 'ستاد: نام، دوره و دستگاه', m.get(F1))
ok(m[F2]['from'] is None, 'بی‌نام: نام پنهان')
ok(c.get(f'{B}/admin/feedback').status_code == 403, 'کنشگر به صندوق دسترسی ندارد')
ok(hq.patch(f'{B}/admin/feedback/{F1}', json={'status': 'PLANNED', 'tags': ['گوشی', 'آزمون', 'گوشی'], 'reply': 'ممنون؛ در به‌روزرسانی بعدی درست می‌شود.'}).ok, 'پاسخ و برچسب')
mine = a.get(f'{B}/feedback/mine').json(); x = [y for y in mine if y['id'] == F1][0]; ok(x['status'] == 'PLANNED' and x['reply'].startswith('ممنون'), 'فرستنده پاسخ را می‌بیند')
ok(psql("select count(*) from notifications n join users u on u.id=n.user_id where n.kind='feedback' and u.first_name='عضو' and u.last_name='یکم'") >= '1', 'اعلان پاسخ به فرستنده')
ok(psql(f"select array_length(tags,1) from feedback where id='{F1}'") == '2', 'برچسب تکراری حذف شد')
s = hq.get(f'{B}/admin/feedback/stats').json(); ok(s['byKind'].get('BUG') == 1 and s['mood']['n'] == 1, 'آمار', s)
print('امتیاز درس و دوره')
L = psql("select l.id from lessons l join modules m on m.id=l.module_id join courses c on c.id=m.course_id where c.slug='nojavan-1' limit 1")
psql(f"delete from lesson_progress where user_id=(select id from users where first_name='عضو' and last_name='یکم') and lesson_id in (select l.id from lessons l join modules m on m.id=l.module_id join courses c on c.id=m.course_id where c.slug='nojavan-1')"); psql("delete from enrollments where user_id=(select id from users where first_name='عضو' and last_name='یکم') and course_id=(select id from courses where slug='nojavan-1')")
ok(a.post(f'{B}/lessons/{L}/rating', json={'up': False, 'reasons': ['طولانی بود', 'دروغ']}).status_code == 403, 'بی‌ثبت‌نام نمی‌شود امتیاز داد')
a.post(f'{B}/courses/nojavan-1/enroll')
ok(a.post(f'{B}/lessons/{L}/rating', json={'up': False, 'reasons': ['طولانی بود', 'دروغ'], 'comment': 'خیلی طول کشید'}).ok, 'امتیاز درس')
r = a.get(f'{B}/lessons/{L}/rating').json(); ok(r['rating']['reasons'] == ['طولانی بود'] and r['rating']['comment'] == 'خیلی طول کشید', 'فقط دلیل‌های مجاز', r)
r = a.post(f'{B}/courses/nojavan-1/rating', json={'stars': 5}); ok(r.status_code == 400 and r.json()['code'] == 'too_early', 'امتیاز دوره زود است: ' + r.json().get('message', ''))
d = a.get(f'{B}/courses/nojavan-1').json(); ok('rating' in d and d['rating']['avg'] is None, 'امتیاز عمومی کمتر از ۵ نفر پنهان', d.get('rating'))
q = hq.get(f'{B}/admin/content-quality').json(); ok(any(l['id'] == L and l['down'] == 1 and l['reasons'][0]['reason'] == 'طولانی بود' for l in q['lessons']) and q['comments'], 'کیفیت محتوا برای ستاد', q.get('lessons', [])[:1])
import re
ok(not re.search(r'09\d{9}', str(q)) and 'یکم' not in str(q), 'کیفیت محتوا بی‌نام')
print('\nنتیجه:', 'همه درست' if not h.fails else f'{h.fails} خطا'); sys.exit(1 if h.fails else 0)
