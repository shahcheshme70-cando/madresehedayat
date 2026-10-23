/**
 * نسخهٔ نمایشی — مرحلهٔ ۳: پیام گروهی، پشتیبانی، گزارش نمونه، آزمون مسیر، پیام‌رسان، گزارش دسترسی،
 * جعبه‌ابزار، مدل کسب‌وکار (اشتراک، حامی، خدمات، فاکتور، قیمت) و بازخورد.
 * همان شکل پاسخ‌های apps/api؛ داده در مرورگر.
 */
import catalog from '../../../api/src/tools/catalog.json';

type Any = any;
const TOOLS: Any[] = (catalog as Any).tools;
const DAY = 864e5;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const faNum = (n: number) => Math.round(n).toLocaleString('en-US').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]).replace(/,/g, '٬');

/* ───────── بسته‌ها (همان apps/api/src/business/plans.ts) ───────── */
const PLANS: Record<string, Any> = {
  ORG_BASIC: { label: 'سازمانی پایه', orgCourses: true, orgPanel: true, quarterlyReport: true, broadcast: true, events: true, certName: 'org-courses', campaignsPerYear: 2, liveHoursPerMonth: 'setting', ownRahyar: false, exportData: false, prioritySupport: false, onboardingSessions: 1, fixedFee: false },
  ORG_PREMIUM: { label: 'سازمانی ویژه', orgCourses: true, orgPanel: true, quarterlyReport: true, broadcast: true, events: true, certName: 'all', campaignsPerYear: null, liveHoursPerMonth: null, ownRahyar: true, exportData: true, prioritySupport: true, onboardingSessions: null, fixedFee: true },
};
const FEATURE_FA: Record<string, string> = { orgPanel: 'پنل سازمان', quarterlyReport: 'گزارش فصلی', broadcast: 'پیام گروهی به اعضا', events: 'برگزاری برنامه برای اعضا', exportData: 'خروجی اکسل', campaigns: 'ساخت پویش برای اعضا', prioritySupport: 'پشتیبانی تعهدی' };
const TIERS = [
  { id: 'ACTIVIST', label: 'کنشگر', who: 'هر فرد', price: 'رایگان، همیشه' },
  { id: 'MOSQUE', label: 'مسجد و هسته', who: 'امام محله، مسئول هسته', price: 'رایگان' },
  { id: 'ORG_BASIC', label: 'سازمانی پایه', who: 'سازمان‌های کنشگر محلی', price: 'اشتراک سالانه به ازای هر نفر' },
  { id: 'ORG_PREMIUM', label: 'سازمانی ویژه', who: 'نهادهای بزرگ و ملی', price: 'اشتراک + هزینهٔ ثابت پشتیبانی تعهدی' },
  { id: 'PROVINCE', label: 'استانی', who: 'ستاد یا ادارهٔ استان', price: 'رایگان' },
];
const SERVICES = [
  { group: 'یادگیری', items: [{ name: 'دوره‌های عمومی و مسیرها', v: 'yyyyy' }, { name: 'گواهی دوره و مسیر', v: 'yyyyy' }, { name: 'دوره‌های ویژهٔ سازمان', note: 'فقط برای اعضای همان سازمان', v: 'nnyyn' }, { name: 'ساخت دورهٔ اختصاصی', note: 'خدمت سفارشی: هزینهٔ واقعی + ۵۰٪', v: 'nnnyl' }, { name: 'نام سازمان روی گواهی اعضا', note: 'پایه: فقط دوره‌های ویژهٔ سازمان', v: 'nnlyn' }] },
  { group: 'ابزار و کار', items: [{ name: 'جعبه‌ابزار ۳۵ ابزار و خروجی تصویر', v: 'yyyyy' }, { name: 'کار گروهی، هم‌کار و نسخه‌ها', v: 'yyyyy' }] },
  { group: 'همراهی انسانی', items: [{ name: 'بازخورد راهیار بر مأموریت‌ها', v: 'yyyyy' }, { name: 'پیام با راهیار', v: 'yyyyy' }, { name: 'شبکهٔ راهیاری اختصاصی سازمان', note: 'پایه: از شبکهٔ عمومی', v: 'nnlyn' }] },
  { group: 'برنامه‌ها و کلاس زنده', items: [{ name: 'ثبت‌نام در برنامه‌ها و کلاس‌ها', v: 'yyyyy' }, { name: 'برگزاری برنامه', note: 'مسجد و هسته: برای اعضای خود', v: 'nlyyy' }, { name: 'کلاس زنده روی سرور مدرسه با ضبط', note: 'پایه: {live} ساعت در ماه', v: 'nllyy' }] },
  { group: 'پویش', items: [{ name: 'شرکت در پویش و نشان مشارکت', v: 'yyyyy' }, { name: 'ساخت پویش', note: 'پایه: ۲ پویش در سال، فقط برای اعضا', v: 'nnlyy' }] },
  { group: 'مدیریت و گزارش', items: [{ name: 'پنل مسجد و هسته', v: 'nyyyy' }, { name: 'پنل سازمان: پیشرفت عددی اعضا', note: 'بدون متن گزارش‌ها', v: 'nnyyn' }, { name: 'پیام گروهی به اعضا', v: 'nyyyy' }, { name: 'گزارش فصلی خودکار', v: 'nnyyy' }, { name: 'خروجی اکسل', note: 'اتصال به سامانهٔ سازمان: بعد از نسخهٔ ۱', v: 'nnnyn' }] },
  { group: 'پشتیبانی', items: [{ name: 'پشتیبانی داخل سامانه', v: 'yyyyy' }, { name: 'پشتیبانی اختصاصی با زمان پاسخ تعهدی', v: 'nnnyl' }, { name: 'جلسهٔ راه‌اندازی و آموزش مدیران', note: 'پایه: یک جلسه', v: 'nnlyy' }] },
];
const DEFAULT_COSTS: Any = { expectedUsers: 10000, srvMain: 1_000_000, srvLive: 2_000_000, storage: 1_500_000, dev: 40_000_000, ops: 60_000_000, content: 80_000_000, smsPrice: 200, smsPerUser: 1, coursesPerYear: 20, courseCost: 100_000_000, markup: 1.5, serviceMarkup: 1.5, premiumFixedFee: 0, basicLiveHours: 30 };
const priceModel = (c: Any) => {
  const monthly = c.srvMain + c.srvLive + c.storage + c.dev + c.ops + c.content + c.smsPrice * c.smsPerUser * c.expectedUsers;
  const base = monthly * 12, content = c.coursesPerYear * c.courseCost, total = base + content, perUser = c.expectedUsers ? total / c.expectedUsers : 0;
  return { monthly, base, content, total, perUser: Math.round(perUser), perSeat: Math.round((perUser * c.markup) / 1000) * 1000 };
};
const volumeDiscount = (n: number) => (n > 2000 ? 30 : n > 500 ? 15 : 0);
const has = (plan: string, f: string) => (f === 'campaigns' ? PLANS[plan].campaignsPerYear !== 0 : !!PLANS[plan][f]);

/* ───────── دادهٔ نمونه ───────── */
export function seedPhase3(db: Any) {
  Object.assign(db, { broadcasts: [], tickets: [], tmsgs: [], samples: [], pathAttempts: [], mlinks: [], access: [], boards: [], bversions: [], bmembers: [], bcomments: [], toolStatus: {},
    subscriptions: [], invoices: [], sponsors: [], services: [], costs: { ...DEFAULT_COSTS }, feedback: [], lratings: [], cratings: [] });
  const t = new Date().toISOString();
  for (const id of ['fish', 'why5', 'eisen', 'impact', 'smart', 'raci', 'check', 'empathy', 'crazy8', 'aar']) db.toolStatus[id] = true;
  // آزمون جامع مسیر
  const p = db.paths[0];
  if (p) { p.passScore = 60; p.quiz = { intro: 'پنج پرسش از همهٔ دوره‌های مسیر.', questions: [
    { id: 'q1', kind: 'single', text: 'سه نیاز اصلی نوجوان در مسجد کدام است؟', options: [{ id: 'a', text: 'دیده شدن، تعلق، نقش' }, { id: 'b', text: 'پذیرایی، جایزه، اردو' }, { id: 'c', text: 'سکوت، نظم، حضور' }], correct: ['a'], explain: 'دیده شدن، تعلق و نقش.' },
    { id: 'q2', kind: 'tf', text: 'گفت‌وگوی خوب با نوجوان با شنیدن شروع می‌شود.', options: [{ id: 't', text: 'درست' }, { id: 'f', text: 'نادرست' }], correct: ['t'] },
    { id: 'q3', kind: 'single', text: 'بهترین زمان پیگیری بعد از یک برنامه کی است؟', options: [{ id: 'a', text: 'همان هفته' }, { id: 'b', text: 'سال بعد' }], correct: ['a'] },
  ] }; }
  // بسته و اشتراک برکت
  const nj1 = db.courses.find((c: Any) => c.slug === 'nojavan-1');
  db.subscriptions.push({ id: 'sub-barakat', networkId: 'org-barakat', plan: 'ORG_PREMIUM', seats: 40, startsAt: iso(-200), endsAt: iso(24), contractNo: '۱۴۰۵/۳۲', pricePerSeat: 636000, discountPct: 0, fixedFee: 5_000_000, amount: 40 * 636000 + 5_000_000, note: null, cancelledAt: null, courseIds: nj1 ? [nj1.id] : [], createdAt: iso(-200) });
  db.grants = db.grants.filter((g: Any) => g.networkId !== 'org-barakat');
  db.invoices.push({ id: 'inv1', number: 'MH-1405-0001', networkId: 'org-barakat', subscriptionId: 'sub-barakat', serviceOrderId: null, sponsorId: null, title: 'اشتراک سازمانی ویژه «برکت» — قسط اول', amount: 15_000_000, status: 'PAID', paidAt: iso(-190), paymentRef: '۸۸۲۱۴۵', createdAt: iso(-195) });
  db.invoices.push({ id: 'inv2', number: 'MH-1405-0002', networkId: 'org-barakat', subscriptionId: 'sub-barakat', serviceOrderId: null, sponsorId: null, title: 'اشتراک سازمانی ویژه «برکت» — قسط دوم', amount: 15_440_000, status: 'ISSUED', paidAt: null, paymentRef: null, createdAt: iso(-10) });
  db.sponsors.push({ id: 'sp1', name: 'خیریهٔ نور', kind: 'ORG', termsAccepted: true, note: null, createdAt: t });
  if (nj1) nj1.sponsorId = 'sp1';
  db.invoices.push({ id: 'inv3', number: 'MH-1405-0003', networkId: null, subscriptionId: null, serviceOrderId: null, sponsorId: 'sp1', title: 'حمایت از ساخت دورهٔ «همراهی نوجوانان»', amount: 100_000_000, status: 'PAID', paidAt: iso(-60), paymentRef: '۴۴۱۰۲', createdAt: iso(-62) });
  db.services.push({ id: 'svc1', kind: 'WORKSHOP', title: 'کارگاه حضوری مدیران برکت', networkId: 'org-barakat', sponsorId: null, courseId: null, costs: [{ item: 'مدرس', amount: 12_000_000 }, { item: 'جا و پذیرایی', amount: 8_000_000 }], cost: 20_000_000, price: 30_000_000, status: 'ACTIVE', note: null, createdAt: iso(-5) });
  // پشتیبانی، پیام گروهی، بازخورد
  db.tickets.push({ id: 'tk1', userId: 'sample3', category: 'COURSE', subject: 'آزمون درس دوم باز نمی‌شود', status: 'ANSWERED', priority: true, assigneeId: null, createdAt: iso(-2), updatedAt: iso(-1) });
  db.tmsgs.push({ id: 'tm1', ticketId: 'tk1', authorId: 'sample3', body: 'سلام، وقتی دکمهٔ آزمون را می‌زنم چیزی نمی‌شود.', createdAt: iso(-2) }, { id: 'tm2', ticketId: 'tk1', authorId: 'p-admin', body: 'سلام؛ اول متن درس را تا آخر بخوانید و «خواندم» را بزنید؛ آزمون بعد از آن باز می‌شود.', createdAt: iso(-1) });
  db.broadcasts.push({ id: 'bc1', senderId: 'p-admin', audience: { kind: 'ALL', ids: [], label: 'همهٔ کاربران' }, title: 'دورهٔ «همراهی نوجوانان» به‌روز شد', body: 'دو درس تازه اضافه شد.', link: '/learn', recipientCount: 12, status: 'SENT', createdAt: iso(-3), sentAt: iso(-3) });
  db.feedback.push({ id: 'fb1', userId: 'sample3', anonymous: false, kind: 'IDEA', mood: 4, body: 'کاش صوت درس‌ها را می‌شد دانلود کرد و در راه گوش داد.', path: '/learn', context: null, device: null, imageKey: null, status: 'PLANNED', tags: ['صوت'], reply: 'پیشنهاد خوبی است؛ در برنامهٔ نسخهٔ بعد قرار گرفت.', repliedAt: iso(-1), createdAt: iso(-4) });
  db.feedback.push({ id: 'fb2', userId: 'sample1', anonymous: true, kind: 'BUG', mood: 2, body: 'در گوشی، دکمهٔ «خواندم» زیر نوار پایین می‌رود.', path: '/lessons/x', context: nj1 ? { courseId: nj1.id } : null, device: 'Chrome · 390×800 · گوشی', imageKey: null, status: 'NEW', tags: [], reply: null, repliedAt: null, createdAt: iso(-0.2) });
  const ls = db.lessons.slice(0, 3);
  ls.forEach((l: Any, i: number) => db.lratings.push({ userId: 'sample' + i, lessonId: l.id, up: i !== 1, reasons: i === 1 ? ['طولانی بود'] : ['کاربردی بود'], comment: i === 1 ? 'می‌شد کوتاه‌تر گفت.' : null, updatedAt: iso(-i) }));
  if (nj1) ['sample0', 'sample1', 'sample2', 'sample3', 'p-cty'].forEach((u, i) => db.cratings.push({ userId: u, courseId: nj1.id, stars: [5, 4, 5, 4, 5][i], comment: i === 0 ? 'بسیار کاربردی؛ همان هفته امتحانش کردم.' : null, updatedAt: iso(-i) }));
  // کار نمونه در جعبه‌ابزار
  db.boards.push({ id: 'bd1', ownerId: 'sample3', toolId: 'fish', title: 'چرا نوجوان‌ها به مسجد نمی‌آیند؟', data: { n: { 0: [{ id: 'a', t: 'ساعت برنامه با مدرسه تداخل دارد' }], 1: [{ id: 'b', t: 'کسی نظرشان را نمی‌پرسد' }] }, f: { head: 'کم‌شدن حضور نوجوانان' } }, lessonId: null, publicToken: null, updatedById: 'sample3', createdAt: iso(-3), updatedAt: iso(-1) });
  db.bmembers.push({ boardId: 'bd1', userId: 'sample1', role: 'EDITOR' });
  db.bversions.push({ id: 'bv1', boardId: 'bd1', authorId: 'sample3', data: db.boards[0].data, createdAt: iso(-1) });
  db.access.push({ id: 'ac1', actorId: 'p-cty', action: 'mission.view', subjectId: 'sample3', at: iso(-1) }, { id: 'ac2', actorId: 'p-admin', action: 'user.list', subjectId: null, at: iso(-0.5) });
}

/* ───────── مسیرها ───────── */
export function registerPhase3(X: Any) {
  const { on, onFirst, wrap, E, me, maybeMe, rolesOf, staff, rid, now, notify, nm, U, C, enr, prog, isHQ, provOf, normMobile, card, allLessons } = X;
  const DB = () => X.db;
  const hq = (uid: string) => isHQ(uid);
  const dec = (s: string) => s; // در نسخهٔ نمایشی رمزگذاری نداریم
  const audit = (action: string, target?: string) => DB().audit.unshift({ id: rid(), actorId: DB().session, action, target: target ?? null, createdAt: now() });

  // ── عضویت سازمان
  const memberIds = (nid: string) => [...new Set([...DB().netMembers.filter((x: Any) => x.networkId === nid).map((x: Any) => x.userId),
    ...DB().coreMembers.filter((x: Any) => DB().cores.find((c: Any) => c.id === x.coreId)?.networkId === nid).map((x: Any) => x.userId)])];
  const orgsOfUser = (uid: string) => DB().networks.filter((n: Any) => n.kind === 'ORGANIZATION' && memberIds(n.id).includes(uid)).map((n: Any) => n.id);
  const status = (s: Any) => (s.cancelledAt ? 'CANCELLED' : Date.now() < +new Date(s.startsAt) ? 'UPCOMING' : Date.now() >= +new Date(s.endsAt) ? 'ENDED' : 'ACTIVE');
  const activeSub = (nid: string) => DB().subscriptions.filter((s: Any) => s.networkId === nid && status(s) === 'ACTIVE').sort((a: Any, b: Any) => b.endsAt.localeCompare(a.endsAt))[0] ?? null;
  const activeSubsOf = (uid: string) => orgsOfUser(uid).map((n: string) => activeSub(n)).filter(Boolean);
  X.subscribedCourseIds = (uid: string) => activeSubsOf(uid).flatMap((s: Any) => s.courseIds);
  const summary = (nid: string) => {
    const sub = activeSub(nid);
    const next = sub ? null : DB().subscriptions.filter((s: Any) => s.networkId === nid && status(s) === 'UPCOMING')[0];
    const last = sub ? null : DB().subscriptions.filter((s: Any) => s.networkId === nid && status(s) === 'ENDED').sort((a: Any, b: Any) => b.endsAt.localeCompare(a.endsAt))[0];
    const s = sub ?? next;
    return { active: !!sub, used: memberIds(nid).length, endedAt: last?.endsAt ?? null, features: sub ? PLANS[sub.plan] : null,
      subscription: s ? { id: s.id, plan: s.plan, planLabel: PLANS[s.plan].label, seats: s.seats, startsAt: s.startsAt, endsAt: s.endsAt, status: status(s), daysLeft: Math.ceil((+new Date(s.endsAt) - Date.now()) / DAY) } : null };
  };
  const orgGate = (nid: string, feature = 'orgPanel') => {
    const u = me(); const net = DB().networks.find((n: Any) => n.id === nid);
    if (!net || net.kind !== 'ORGANIZATION') throw E(404, 'no_org', 'این سازمان پیدا نشد');
    if (!hq(u.id) && !DB().roles.some((r: Any) => r.userId === u.id && r.role === 'ORG_ADMIN' && r.networkId === nid)) throw E(403, 'not_org_admin', 'شما مدیر این سازمان نیستید');
    const sub = activeSub(nid);
    if (!sub) throw E(403, 'no_subscription', `اشتراک «${net.name}» فعال نیست؛ برای تمدید با ستاد مدرسه هماهنگ کنید`);
    if (!has(sub.plan, feature)) throw E(403, 'plan_feature', `«${FEATURE_FA[feature]}» در بستهٔ ${PLANS[sub.plan].label} نیست؛ برای بستهٔ سازمانی ویژه با ستاد هماهنگ کنید`);
    return { net, sub };
  };
  const adminOrgs = (uid: string) => DB().roles.filter((r: Any) => r.userId === uid && r.role === 'ORG_ADMIN').map((r: Any) => r.networkId);
  const certOrgName = (uid: string, courseId: string | null) => {
    for (const s of activeSubsOf(uid)) { if (PLANS[s.plan].certName === 'all' || (courseId && s.courseIds.includes(courseId))) return DB().networks.find((n: Any) => n.id === s.networkId)?.name; }
    return null;
  };
  X.certOrgName = certOrgName;

  // ── سازمان (جای مسیرهای مرحلهٔ ۲)
  onFirst('GET', '/org', () => { const u = me(); return DB().networks.filter((n: Any) => adminOrgs(u.id).includes(n.id)).map((n: Any) => ({ ...n, subscription: summary(n.id) })); });
  onFirst('GET', '/org/([^/]+)/subscription', (m: Any) => { const u = me(); if (!hq(u.id) && !adminOrgs(u.id).includes(m[1])) throw E(403, 'not_org_admin', 'شما مدیر این سازمان نیستید'); return summary(m[1]); });
  onFirst('GET', '/org/([^/]+)/report', (m: Any) => {
    orgGate(m[1], 'quarterlyReport'); const ids = memberIds(m[1]);
    const done = DB().progress.filter((p: Any) => ids.includes(p.userId) && p.completedAt);
    const sub = activeSub(m[1]);
    return { quarters: [{ jy: 1405, q: 3, label: 'پاییز ۱۴۰۵ (تا امروز)' }, { jy: 1405, q: 2, label: 'تابستان ۱۴۰۵' }],
      report: { label: 'پاییز ۱۴۰۵', members: ids.length, activeLearners: new Set(done.map((p: Any) => p.userId)).size, fieldActive: new Set(done.filter((p: Any) => DB().lessons.find((l: Any) => l.id === p.lessonId)?.type === 'MISSION').map((p: Any) => p.userId)).size,
        lessonsCompleted: done.length, coursesCompleted: DB().enrollments.filter((e: Any) => ids.includes(e.userId) && e.completedAt).length, missionsDone: done.filter((p: Any) => DB().lessons.find((l: Any) => l.id === p.lessonId)?.type === 'MISSION').length,
        certificates: DB().certificates.filter((c: Any) => ids.includes(c.userId)).length, campaignParticipants: 0, eventsAttended: DB().regs.filter((r: Any) => ids.includes(r.userId) && r.attendedAt).length,
        courses: (sub?.courseIds ?? []).map((cid: string) => ({ id: cid, title: DB().courses.find((c: Any) => c.id === cid)?.title, enrolled: DB().enrollments.filter((e: Any) => e.courseId === cid && ids.includes(e.userId)).length, completed: DB().enrollments.filter((e: Any) => e.courseId === cid && ids.includes(e.userId) && e.completedAt).length })) } };
  });
  onFirst('GET', '/org/([^/]+)', (m: Any) => {
    const { net, sub } = orgGate(m[1]); const cids = sub.courseIds;
    return { id: net.id, name: net.name, underRahyar: net.underRahyar, subscription: summary(net.id), courses: cids.map((id: string) => ({ id, title: DB().courses.find((c: Any) => c.id === id)?.title })),
      members: memberIds(net.id).map((uid: string) => ({ id: uid, name: nm(uid), courses: cids.map((cid: string) => { const e = enr(uid, cid); return { courseId: cid, state: e ? (e.completedAt ? 'done' : 'active') : 'none' }; }) })) };
  });
  onFirst('POST', '/org/([^/]+)/members', (m: Any, b: Any) => {
    const { sub } = orgGate(m[1]); const missing: string[] = []; const found: string[] = [];
    for (const mob of b.mobiles) { const n = normMobile(mob); const u = n && DB().users.find((x: Any) => x.mobile === n); if (!u) missing.push(mob); else found.push(u.id); }
    const cur = memberIds(m[1]); const fresh = found.filter((x) => !cur.includes(x));
    if (cur.length + fresh.length > sub.seats) throw E(400, 'seats_full', `سقف اشتراک پر است: ${faNum(cur.length)} نفر از ${faNum(sub.seats)} نفر. برای افزایش سقف با ستاد هماهنگ کنید`);
    fresh.forEach((uid) => DB().netMembers.push({ networkId: m[1], userId: uid }));
    return { added: found.length, missing };
  });

  // ── برنامه‌ها: برگزارکنندهٔ محدود
  const scopedOptions = (uid: string) => [
    ...adminOrgs(uid).filter((n: string) => { const s = activeSub(n); return s && has(s.plan, 'events'); }).map((n: string) => ({ kind: 'ORG', id: n, label: `اعضای ${DB().networks.find((x: Any) => x.id === n)?.name}` })),
    ...DB().mosques.filter((x: Any) => x.imamId === uid).map((x: Any) => ({ kind: 'MOSQUE', id: x.id, label: `اعضای ${x.name}` })),
    ...DB().cores.filter((c: Any) => c.leaderId === uid).map((c: Any) => ({ kind: 'CORE', id: c.id, label: `هستهٔ «${c.name}»` })),
  ];
  const canOpen = (uid: string) => { const r = rolesOf(uid); return hq(uid) || r.includes('RAHYAR') ? 'ALL' : r.includes('INSTRUCTOR') ? 'ONLINE' : null; };
  onFirst('GET', '/manage/events/options', () => { const u = me(); return { open: canOpen(u.id), scoped: scopedOptions(u.id) }; });
  onFirst('POST', '/manage/events', (_m: Any, b: Any) => {
    const u = me(); const scoped = [b.audienceNetworkId, b.audienceMosqueId, b.audienceCoreId].filter(Boolean);
    if (!scoped.length && !canOpen(u.id)) throw E(403, 'forbidden', scopedOptions(u.id).length ? 'مخاطب برنامه را انتخاب کنید: اعضای سازمان، مسجد یا هستهٔ خودتان' : 'اجازهٔ ساخت برنامه ندارید');
    if (b.audienceNetworkId) orgGate(b.audienceNetworkId, 'events');
    if (!b.title || !b.kind || !b.startsAt || !b.endsAt) throw E(400, 'missing', 'عنوان، نوع، زمان شروع و پایان لازم است');
    const e = { id: rid(), status: 'DRAFT', cancelReason: null, createdById: u.id, ...b };
    DB().events.push(e); return e;
  });
  X.eventScopeBlock = (e: Any, u: Any) => {
    if (e.audienceNetworkId && !orgsOfUser(u.id).includes(e.audienceNetworkId)) return 'این برنامه ویژهٔ اعضای یک سازمان است';
    if (e.audienceMosqueId && u.mosqueId !== e.audienceMosqueId && !DB().cores.some((c: Any) => c.mosqueId === e.audienceMosqueId && DB().coreMembers.some((x: Any) => x.coreId === c.id && x.userId === u.id)) && !DB().mosques.some((x: Any) => x.id === e.audienceMosqueId && x.imamId === u.id)) return 'این برنامه ویژهٔ اعضای یک مسجد است';
    if (e.audienceCoreId && !DB().coreMembers.some((x: Any) => x.coreId === e.audienceCoreId && x.userId === u.id)) return 'این برنامه ویژهٔ اعضای یک هسته است';
    return null;
  };

  // ── ورود: کد در پیام‌رسان اگر وصل باشد
  wrap('POST', '/auth/otp', (orig: Any) => (m: Any, b: Any, q: Any) => {
    const r = orig(m, b, q); const n = normMobile(b.mobile); const u = n && DB().users.find((x: Any) => x.mobile === n);
    const link = u && b.via !== 'sms' && DB().mlinks.find((l: Any) => l.userId === u.id);
    return { ...r, channel: link ? link.provider : 'SMS' };
  });

  // ── دوره: حامی و امتیاز
  const courseScore = (cid: string, uid?: string) => { const rs = DB().cratings.filter((r: Any) => r.courseId === cid); const mine = uid && rs.find((r: Any) => r.userId === uid);
    return { avg: rs.length >= 5 ? Math.round((rs.reduce((a: number, r: Any) => a + r.stars, 0) / rs.length) * 10) / 10 : null, count: rs.length, mine: mine ? { stars: mine.stars, comment: mine.comment } : null }; };
  wrap('GET', '/courses/([^/]+)', (orig: Any) => (m: Any, b: Any, q: Any) => {
    const u = maybeMe(); let r;
    try { r = orig(m, b, q); } catch (e: Any) {
      if (e.code === 'restricted' && u && enr(u.id, C(m[1]).id)) throw E(403, 'subscription_ended', 'دسترسی سازمان شما به این دوره تمام شده است. پیشرفت و گواهی‌تان محفوظ است و با تمدید اشتراک برمی‌گردد');
      if (e.code === 'restricted') throw E(403, 'restricted', 'این دوره ویژهٔ اعضای سازمان‌های مشترک است');
      throw e;
    }
    const c = C(m[1]); return { ...r, sponsor: c.sponsorId ? DB().sponsors.find((s: Any) => s.id === c.sponsorId)?.name ?? null : null, rating: courseScore(c.id, u?.id) };
  });
  wrap('GET', '/me/certificates', (orig: Any) => (m: Any, b: Any, q: Any) => orig(m, b, q).map((c: Any) => ({ ...c, orgName: DB().certificates.find((x: Any) => x.code === c.code)?.orgName ?? null })));
  wrap('GET', '/verify/([^/]+)', (orig: Any) => (m: Any, b: Any, q: Any) => { const r = orig(m, b, q); return r.code ? { ...r, orgName: DB().certificates.find((x: Any) => x.code === r.code)?.orgName ?? null } : r; });

  // ── پیام گروهی
  const bOptions = (uid: string) => {
    const out: Any[] = [];
    if (hq(uid)) out.push({ kind: 'ALL', label: 'همهٔ کاربران' });
    if (rolesOf(uid).includes('RAHYAR')) out.push({ kind: 'SCOPE', label: 'کنشگران دامنهٔ راهیاری من' });
    DB().mosques.filter((x: Any) => x.imamId === uid).forEach((x: Any) => out.push({ kind: 'MOSQUE', ids: [x.id], label: `اعضای ${x.name}` }));
    DB().cores.filter((c: Any) => c.leaderId === uid).forEach((c: Any) => out.push({ kind: 'CORE', ids: [c.id], label: `هستهٔ «${c.name}»` }));
    adminOrgs(uid).forEach((n: string) => { const s = activeSub(n); if (s && has(s.plan, 'broadcast')) out.push({ kind: 'ORG', ids: [n], label: `اعضای ${DB().networks.find((x: Any) => x.id === n)?.name}` }); });
    return out;
  };
  const bResolve = (uid: string, a: Any) => {
    const ok = bOptions(uid).some((o) => o.kind === a.kind && (!o.ids || o.ids[0] === a.ids?.[0])) || (hq(uid) && ['PROVINCE', 'COUNTY', 'ROLE', 'COURSE', 'NETWORK'].includes(a.kind));
    if (!ok) throw E(403, 'forbidden', 'به این گروه نمی‌توانید پیام بدهید');
    const all = DB().users.filter((x: Any) => x.isActive !== false && x.id !== uid);
    switch (a.kind) {
      case 'MOSQUE': return { ids: all.filter((x: Any) => x.mosqueId === a.ids[0]).map((x: Any) => x.id), label: `اعضای ${DB().mosques.find((x: Any) => x.id === a.ids[0])?.name}` };
      case 'CORE': return { ids: DB().coreMembers.filter((x: Any) => x.coreId === a.ids[0] && x.userId !== uid).map((x: Any) => x.userId), label: `هستهٔ «${DB().cores.find((c: Any) => c.id === a.ids[0])?.name}»` };
      case 'ORG': return { ids: memberIds(a.ids[0]).filter((x) => x !== uid), label: `اعضای ${DB().networks.find((x: Any) => x.id === a.ids[0])?.name}` };
      case 'SCOPE': return { ids: all.filter((x: Any) => provOf(x.countyId) === provOf(U(uid).countyId)).map((x: Any) => x.id), label: 'کنشگران دامنهٔ راهیاری من' };
      case 'PROVINCE': return { ids: all.filter((x: Any) => a.ids?.includes(provOf(x.countyId))).map((x: Any) => x.id), label: 'استان ' + DB().provinces.filter((p: Any) => a.ids?.includes(p.id)).map((p: Any) => p.name).join('، ') };
      case 'COUNTY': return { ids: all.filter((x: Any) => a.ids?.includes(x.countyId)).map((x: Any) => x.id), label: 'شهرستان ' + DB().counties.filter((c: Any) => a.ids?.includes(c.id)).map((c: Any) => c.name).join('، ') };
      case 'ROLE': return { ids: DB().roles.filter((r: Any) => r.role === a.ids?.[0]).map((r: Any) => r.userId), label: { RAHYAR: 'راهیاران', IMAM: 'امامان محله', INSTRUCTOR: 'مدرسان', ORG_ADMIN: 'مدیران سازمان' }[a.ids?.[0] as string] ?? '' };
      case 'COURSE': return { ids: DB().enrollments.filter((e: Any) => e.courseId === a.ids?.[0]).map((e: Any) => e.userId), label: `یادگیرندگان «${DB().courses.find((c: Any) => c.id === a.ids?.[0])?.title}»` };
      default: return { ids: all.map((x: Any) => x.id), label: 'همهٔ کاربران' };
    }
  };
  const bList = (f: (b: Any) => boolean) => DB().broadcasts.filter(f).map((b: Any) => ({ ...b, sender: nm(b.senderId) }));
  on('GET', '/broadcasts/options', () => { const u = me(); return { hq: hq(u.id), options: bOptions(u.id), approvalOver: 1000, roles: [{ id: 'RAHYAR', label: 'راهیاران' }, { id: 'IMAM', label: 'امامان محله' }, { id: 'INSTRUCTOR', label: 'مدرسان' }, { id: 'ORG_ADMIN', label: 'مدیران سازمان' }] }; });
  on('POST', '/broadcasts/preview', (_m: Any, b: Any) => { const r = bResolve(me().id, b); return { count: r.ids.length, label: r.label }; });
  on('POST', '/broadcasts', (_m: Any, b: Any) => {
    const u = me(); const r = bResolve(u.id, b); if (!r.ids.length) throw E(400, 'empty', 'این گروه گیرنده‌ای ندارد');
    const bc = { id: rid(), senderId: u.id, audience: { kind: b.kind, ids: b.ids ?? [], label: r.label }, title: b.title, body: b.body ?? null, link: b.link ?? null, recipientCount: r.ids.length, status: 'SENT', createdAt: now(), sentAt: now() };
    DB().broadcasts.unshift(bc); notify(r.ids, { kind: 'broadcast', title: b.title, body: b.body, link: b.link }); return { id: bc.id, status: 'SENT', recipients: r.ids.length };
  });
  on('GET', '/broadcasts/mine', () => { const u = me(); return bList((b: Any) => b.senderId === u.id); });
  on('GET', '/admin/broadcasts', (_m: Any, _b: Any, q: Any) => { staff(); return bList((b: Any) => !q.get('status') || b.status === q.get('status')); });
  on('POST', '/admin/broadcasts/([^/]+)/(approve|reject)', (m: Any) => { staff(); const b = DB().broadcasts.find((x: Any) => x.id === m[1]); if (!b || b.status !== 'PENDING') throw E(400, 'not_pending', 'این پیام منتظر تأیید نیست'); b.status = m[2] === 'approve' ? 'SENT' : 'REJECTED'; return { ok: true }; });

  // ── پشتیبانی
  const tRow = (t: Any) => ({ id: t.id, category: t.category, subject: t.subject, status: t.status, priority: t.priority, createdAt: t.createdAt, updatedAt: t.updatedAt, userName: nm(t.userId), assignee: t.assigneeId ? nm(t.assigneeId) : null });
  const tGet = (id: string) => { const u = me(); const t = DB().tickets.find((x: Any) => x.id === id); if (!t) throw E(404, 'no_ticket', 'درخواست پیدا نشد');
    const role = t.userId === u.id ? 'owner' : hq(u.id) ? 'staff' : t.assigneeId === u.id ? 'assignee' : null; if (!role) throw E(403, 'forbidden', 'این درخواست برای شما نیست'); return { t, role, u }; };
  const sortT = (a: Any, b: Any) => (b.status === 'OPEN' && b.priority ? 1 : 0) - (a.status === 'OPEN' && a.priority ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt);
  on('GET', '/support', () => { const u = me(); return DB().tickets.filter((t: Any) => t.userId === u.id).sort(sortT).map(tRow); });
  on('GET', '/support/assigned', () => { const u = me(); return DB().tickets.filter((t: Any) => t.assigneeId === u.id).map(tRow); });
  on('POST', '/support', (_m: Any, b: Any) => {
    const u = me(); if (!b.subject || b.subject.trim().length < 3) throw E(400, 'invalid', 'عنوان را بنویسید (دست‌کم ۳ حرف)'); if (!b.body || b.body.trim().length < 5) throw E(400, 'invalid', 'توضیح را کامل‌تر بنویسید (دست‌کم ۵ حرف)');
    const priority = activeSubsOf(u.id).some((s: Any) => PLANS[s.plan].prioritySupport);
    const t = { id: rid(), userId: u.id, category: b.category, subject: b.subject.trim(), status: 'OPEN', priority, assigneeId: null, createdAt: now(), updatedAt: now() };
    DB().tickets.unshift(t); DB().tmsgs.push({ id: rid(), ticketId: t.id, authorId: u.id, body: b.body.trim(), createdAt: now() }); return { id: t.id, priority };
  });
  on('GET', '/support/([^/]+)', (m: Any) => { const { t, role } = tGet(m[1]);
    return { ...tRow(t), userId: t.userId, assigneeId: t.assigneeId, role, messages: DB().tmsgs.filter((x: Any) => x.ticketId === t.id).map((x: Any) => ({ ...x, firstName: U(x.authorId)?.firstName, lastName: U(x.authorId)?.lastName, fromUser: x.authorId === t.userId })) }; });
  on('POST', '/support/([^/]+)/reply', (m: Any, b: Any) => { const { t, role, u } = tGet(m[1]); if (t.status === 'CLOSED' && role === 'owner') throw E(400, 'closed', 'این درخواست بسته شده؛ درخواست تازه بفرستید');
    DB().tmsgs.push({ id: rid(), ticketId: t.id, authorId: u.id, body: b.body.trim(), createdAt: now() }); t.status = role === 'owner' ? 'OPEN' : 'ANSWERED'; t.updatedAt = now();
    if (role !== 'owner') notify(t.userId, { kind: 'ticket_answer', title: 'به درخواست پشتیبانی شما پاسخ داده شد', body: t.subject, link: `/support/${t.id}` }); return { ok: true }; });
  on('POST', '/support/([^/]+)/status', (m: Any, b: Any) => { const { t, role } = tGet(m[1]); if (role === 'owner' && b.status !== 'CLOSED') throw E(403, 'forbidden', 'فقط می‌توانید درخواست را ببندید'); t.status = b.status; return { ok: true }; });
  on('GET', '/admin/support', (_m: Any, _b: Any, q: Any) => { staff(); const st = q.get('status'); return DB().tickets.filter((t: Any) => (st ? t.status === st : t.status !== 'CLOSED')).sort(sortT).map(tRow); });
  on('POST', '/admin/support/([^/]+)/assign', (m: Any, b: Any) => { staff(); const t = DB().tickets.find((x: Any) => x.id === m[1]); t.assigneeId = b.userId || null; if (b.userId) notify(b.userId, { kind: 'ticket_assigned', title: 'یک درخواست پشتیبانی به شما ارجاع شد', body: t.subject, link: `/support/${t.id}` }); return { ok: true }; });
  on('GET', '/admin/support-assignees', (_m: Any, _b: Any, q: Any) => { staff(); const s = q.get('q') ?? '';
    return [...new Set(DB().roles.filter((r: Any) => ['RAHYAR', 'INSTRUCTOR', 'HQ_OPERATOR', 'HQ_ADMIN'].includes(r.role)).map((r: Any) => r.userId))].map((id) => ({ id, name: nm(id as string), roles: rolesOf(id) })).filter((x: Any) => !s || x.name.includes(s)); });

  // ── گزارش نمونه
  const sample = (uid: string, lid: string) => DB().samples.find((s: Any) => s.learnerId === uid && s.lessonId === lid);
  wrap('GET', '/missions/([^/]+)', (orig: Any) => (m: Any, b: Any, q: Any) => { const s = sample(me().id, m[1]); return { ...orig(m, b, q), sample: s ? { status: s.status, named: s.named } : null }; });
  wrap('GET', '/rahyar/reports/([^/]+)/([^/]+)', (orig: Any) => (m: Any, b: Any, q: Any) => { const s = sample(m[1], m[2]); return { ...orig(m, b, q), sample: s ? { status: s.status, named: s.named } : null }; });
  wrap('POST', '/rahyar/reports/([^/]+)/([^/]+)', (orig: Any) => (m: Any, b: Any, q: Any) => {
    const r = orig(m, b, q);
    if (b.kind === 'APPROVE' && b.proposeSample && !sample(m[1], m[2])) { DB().samples.push({ learnerId: m[1], lessonId: m[2], proposedById: me().id, status: 'PROPOSED', named: null, text: null, authorLabel: null, createdAt: now(), publishedAt: null });
      notify(m[1], { kind: 'sample_proposed', title: 'راهیارتان پیشنهاد داده گزارشتان «نمونه» شود', link: `/lessons/${m[2]}` }); }
    return r;
  });
  on('POST', '/missions/([^/]+)/sample', (m: Any, b: Any) => { const u = me(); const s = sample(u.id, m[1]); if (!s || s.status === 'PUBLISHED') throw E(400, 'no_sample', 'پیشنهادی برای نمونه نیست');
    if (b.decision === 'no') { s.status = 'DECLINED'; return { ok: true }; }
    const d = prog(u.id, m[1])?.data ?? {}; const prov = DB().provinces.find((p: Any) => p.id === provOf(u.countyId))?.name;
    Object.assign(s, { status: 'CONSENTED', named: b.decision === 'named', text: `${d.did ?? ''}${d.learned ? '\n\nآنچه یاد گرفتم: ' + d.learned : ''}`.trim(), authorLabel: b.decision === 'named' ? `${u.firstName} ${u.lastName}${prov ? '، ' + prov : ''}` : `کنشگری از ${prov ?? 'ایران'}` });
    return { ok: true }; });
  on('GET', '/lessons/([^/]+)/samples', (m: Any) => DB().samples.filter((s: Any) => s.lessonId === m[1] && s.status === 'PUBLISHED').map((s: Any) => ({ text: s.text, authorLabel: s.authorLabel, publishedAt: s.publishedAt })));
  on('GET', '/admin/samples', (_m: Any, _b: Any, q: Any) => { staff(); const st = q.get('status'); return DB().samples.filter((s: Any) => (st ? s.status === st : ['CONSENTED', 'PUBLISHED'].includes(s.status))).map((s: Any) => { const l = DB().lessons.find((x: Any) => x.id === s.lessonId); const md = DB().modules.find((x: Any) => x.id === l?.moduleId); return { ...s, lessonTitle: l?.title, courseTitle: DB().courses.find((c: Any) => c.id === md?.courseId)?.title }; }); });
  on('POST', '/admin/samples/([^/]+)/([^/]+)', (m: Any, b: Any) => { staff(); const s = sample(m[1], m[2]); if (!s || !['CONSENTED', 'PUBLISHED'].includes(s.status)) throw E(400, 'no_consent', 'کنشگر هنوز اجازه نداده است');
    if (b.publish) { s.status = 'PUBLISHED'; s.publishedAt ??= now(); if (b.text?.trim()) s.text = b.text.trim(); } else { s.status = 'CONSENTED'; s.publishedAt = null; } return { ok: true }; });

  // ── آزمون مسیر
  wrap('GET', '/paths', (orig: Any) => (m: Any, b: Any, q: Any) => orig(m, b, q).map((p: Any) => ({ ...p, hasExam: !!DB().paths.find((x: Any) => x.id === p.id)?.quiz?.questions?.length })));
  const pathOpen = (p: Any, uid: string) => DB().pathItems.filter((i: Any) => i.pathId === p.id).map((i: Any) => DB().courses.find((c: Any) => c.id === i.courseId)).filter((c: Any) => c && c.status === 'PUBLISHED' && !enr(uid, c.id)?.completedAt);
  const pathBy = (slug: string) => { const p = DB().paths.find((x: Any) => x.slug === slug); if (!p) throw E(404, 'no_path', 'مسیر پیدا نشد'); if (!p.quiz?.questions?.length) throw E(404, 'no_exam', 'این مسیر آزمون جامع ندارد'); return p; };
  on('GET', '/paths/([^/]+)/exam', (m: Any) => { const u = me(); const p = pathBy(m[1]); const open = pathOpen(p, u.id); const at = DB().pathAttempts.filter((a: Any) => a.userId === u.id && a.pathId === p.id); const cert = DB().certificates.find((c: Any) => c.userId === u.id && c.pathId === p.id);
    return { path: { slug: p.slug, title: p.title }, passScore: p.passScore, locked: open.length > 0, waitingFor: open.map((c: Any) => c.title), intro: p.quiz.intro, questions: open.length ? [] : p.quiz.questions.map(({ correct: _c, explain: _e, ...x }: Any) => x), attempts: at, nextAllowedAt: null, certificate: cert ? { code: cert.code, score: cert.score } : null }; });
  on('POST', '/paths/([^/]+)/exam', (m: Any, b: Any) => { const u = me(); const p = pathBy(m[1]); if (pathOpen(p, u.id).length) throw E(403, 'path_open', 'اول همهٔ دوره‌های مسیر را تمام کنید');
    const results = p.quiz.questions.map((x: Any) => { const a = [...(b.answers?.[x.id] ?? [])].sort().join(); const ok = a === [...x.correct].sort().join(); return { id: x.id, correct: ok, correctIds: x.correct, explain: x.explain ?? null }; });
    const score = Math.round((results.filter((r: Any) => r.correct).length / results.length) * 100); const passed = score >= p.passScore;
    DB().pathAttempts.unshift({ userId: u.id, pathId: p.id, score, passed, at: now() });
    let certificate = null; if (passed) { let c = DB().certificates.find((x: Any) => x.userId === u.id && x.pathId === p.id);
      if (!c) { c = { id: rid(), code: 'HD-' + rid().slice(0, 4).toUpperCase() + '-' + rid().slice(0, 4).toUpperCase(), userId: u.id, courseId: null, pathId: p.id, holderName: `${u.firstName} ${u.lastName}`, courseTitle: `مسیر «${p.title}»`, score, issuedAt: now(), revokedAt: null, orgName: certOrgName(u.id, null) }; DB().certificates.push(c); }
      certificate = { code: c.code }; }
    return { score, passed, passScore: p.passScore, results, certificate, nextAllowedAt: null }; });

  // ── پیام‌رسان
  on('GET', '/me/messenger', () => { const u = me(); const l = DB().mlinks.filter((x: Any) => x.userId === u.id);
    return { bale: { available: true, linked: l.some((x: Any) => x.provider === 'BALE'), botUrl: 'https://ble.ir/madrese_bot', botName: 'madrese_bot' }, eitaa: { available: true, linked: l.some((x: Any) => x.provider === 'EITAA'), appUrl: null }, notifyMessenger: u.notifyMessenger !== false }; });
  on('POST', '/me/messenger/bale/code', () => {
    const u = me(); setTimeout(() => { if (!DB().mlinks.some((x: Any) => x.userId === u.id && x.provider === 'BALE')) { DB().mlinks.push({ userId: u.id, provider: 'BALE', chatId: 'demo' }); notify(u.id, { kind: 'messenger', title: 'بله وصل شد (نمایشی)', body: 'در نسخهٔ واقعی، این پیام وقتی می‌آید که کد را برای بات بفرستید.', link: '/settings' }); try { localStorage.setItem('mh-demo-v3', JSON.stringify(DB())); } catch { /* */ } } }, 4000);
    return { code: 'D7K2QX', expiresIn: 600, botUrl: 'https://ble.ir/madrese_bot' }; });
  on('DELETE', '/me/messenger/bale', () => { const u = me(); DB().mlinks = DB().mlinks.filter((x: Any) => !(x.userId === u.id && x.provider === 'BALE')); return { ok: true }; });
  on('DELETE', '/me/messenger/eitaa', () => { const u = me(); DB().mlinks = DB().mlinks.filter((x: Any) => !(x.userId === u.id && x.provider === 'EITAA')); return { ok: true }; });
  on('POST', '/me/messenger/prefs', (_m: Any, b: Any) => { me().notifyMessenger = !!b.notifyMessenger; return { ok: true }; });

  // ── گزارش دسترسی
  const ACCESS_FA: Record<string, string> = { 'mission.view': 'دیدن گزارش مأموریت', 'user.list': 'دیدن فهرست کاربران', 'org.view': 'دیدن پنل سازمان', 'ticket.view': 'دیدن درخواست پشتیبانی' };
  on('GET', '/admin/security/access', () => { staff(); return DB().access.map((a: Any) => ({ id: a.id, action: a.action, label: ACCESS_FA[a.action] ?? a.action, at: a.at, actor: nm(a.actorId), subject: a.subjectId ? nm(a.subjectId) : null })); });
  on('POST', '/admin/security/users/([^/]+)/mfa-reset', () => { staff(); return { ok: true }; });

  // ── جعبه‌ابزار
  const toolById = (id: string) => TOOLS.find((t) => t.id === id);
  const initialData = (t: Any) => { const d: Any = { n: {}, f: {} }; if (t.dm) d.dm = { opts: [...t.dm.opts], crit: t.dm.crit.map((c: Any) => ({ ...c })), s: {} }; if (t.raci) d.raci = { tasks: [...t.raci.tasks], roles: [...t.raci.roles], m: {} }; if (t.bud) d.bud = { rows: t.bud.rows.map((r: Any) => ({ ...r })), ppl: t.bud.ppl }; return d; };
  const bAccess = (id: string) => { const u = me(); const b = DB().boards.find((x: Any) => x.id === id); if (!b) throw E(404, 'no_board', 'این کار پیدا نشد'); if (b.ownerId === u.id) return { b, role: 'OWNER', u }; const mm = DB().bmembers.find((x: Any) => x.boardId === id && x.userId === u.id); if (mm) return { b, role: mm.role, u }; throw E(403, 'forbidden', 'این کار با شما به اشتراک گذاشته نشده'); };
  const newBoard = (uid: string, toolId: string, title?: string, lessonId: string | null = null) => { const t = toolById(toolId); if (!t) throw E(400, 'no_tool', 'ابزار پیدا نشد'); const b = { id: rid(), ownerId: uid, toolId, title: title?.trim() || t.t, data: initialData(t), lessonId, publicToken: null, updatedById: uid, createdAt: now(), updatedAt: now() }; DB().boards.unshift(b); return b; };
  on('GET', '/tools', (_m: Any, _b: Any, q: Any) => ({ categories: (catalog as Any).categories, tools: TOOLS.filter((t) => q.get('all') === '1' || DB().toolStatus[t.id]).map((t) => ({ ...t, published: !!DB().toolStatus[t.id] })) }));
  on('GET', '/boards', () => { const u = me(); return { own: DB().boards.filter((b: Any) => b.ownerId === u.id).map((b: Any) => ({ id: b.id, toolId: b.toolId, title: b.title, updatedAt: b.updatedAt, lessonId: b.lessonId, isPublic: !!b.publicToken })),
    shared: DB().bmembers.filter((x: Any) => x.userId === u.id).map((x: Any) => { const b = DB().boards.find((y: Any) => y.id === x.boardId); return b && { id: b.id, toolId: b.toolId, title: b.title, updatedAt: b.updatedAt, role: x.role, owner: nm(b.ownerId) }; }).filter(Boolean) }; });
  on('POST', '/boards', (_m: Any, b: Any) => { const u = me(); if (!DB().toolStatus[b.toolId] && !hq(u.id)) throw E(400, 'not_published', 'این ابزار هنوز منتشر نشده'); return { id: newBoard(u.id, b.toolId, b.title).id }; });
  on('GET', '/boards/share-options', () => { const u = me(); const out: Any[] = []; const r = X.resolve(u).responsible; if (r?.holderId) out.push({ userId: r.holderId, name: nm(r.holderId), why: 'راهیار شما' });
    const mine = DB().coreMembers.filter((x: Any) => x.userId === u.id).map((x: Any) => x.coreId);
    DB().coreMembers.filter((x: Any) => mine.includes(x.coreId) && x.userId !== u.id).forEach((x: Any) => { if (!out.some((o) => o.userId === x.userId)) out.push({ userId: x.userId, name: nm(x.userId), why: 'هم‌هسته‌ای' }); }); return out; });
  on('GET', '/boards/lesson/([^/]+)', (m: Any) => { const u = me(); const l = DB().lessons.find((x: Any) => x.id === m[1]); if (!l || l.type !== 'TOOL') throw E(404, 'no_lesson', 'درس ابزار پیدا نشد'); const ex = DB().boards.find((b: Any) => b.ownerId === u.id && b.lessonId === l.id); return { id: (ex ?? newBoard(u.id, l.content.toolId, `${toolById(l.content.toolId)?.t ?? 'کار'} · ${l.title}`, l.id)).id }; });
  on('GET', '/boards/([^/]+)', (m: Any) => { const { b, role } = bAccess(m[1]);
    return { id: b.id, toolId: b.toolId, title: b.title, data: b.data ?? initialData(toolById(b.toolId)), lessonId: b.lessonId, updatedAt: b.updatedAt, createdAt: b.createdAt, role, owner: nm(b.ownerId), publicToken: role === 'OWNER' ? b.publicToken : null,
      members: DB().bmembers.filter((x: Any) => x.boardId === b.id).map((x: Any) => ({ userId: x.userId, role: x.role, name: nm(x.userId) })),
      comments: DB().bcomments.filter((c: Any) => c.boardId === b.id).map((c: Any) => ({ ...c, firstName: U(c.authorId)?.firstName, lastName: U(c.authorId)?.lastName })) }; });
  on('PUT', '/boards/([^/]+)', (m: Any, d: Any) => { const { b, role, u } = bAccess(m[1]); if (role === 'VIEWER') throw E(403, 'viewer', 'فقط می‌توانید ببینید و نظر بدهید');
    if (d.title) b.title = d.title.trim();
    if (d.data) { b.data = d.data; const last = DB().bversions.filter((v: Any) => v.boardId === b.id).sort((a: Any, c: Any) => c.createdAt.localeCompare(a.createdAt))[0];
      if (last && last.authorId === u.id && Date.now() - +new Date(last.createdAt) < 600_000) last.data = d.data; else DB().bversions.push({ id: rid(), boardId: b.id, authorId: u.id, data: d.data, createdAt: now() });
      if (b.lessonId && b.ownerId === u.id) { let p = prog(u.id, b.lessonId); if (!p) { p = { userId: u.id, lessonId: b.lessonId, positionSec: 0, completedAt: null, data: null }; DB().progress.push(p); } p.completedAt ??= now(); } }
    b.updatedById = u.id; b.updatedAt = now(); return { updatedAt: b.updatedAt }; });
  on('DELETE', '/boards/([^/]+)', (m: Any) => { const { role } = bAccess(m[1]); if (role !== 'OWNER') throw E(403, 'forbidden', 'فقط صاحب کار'); DB().boards = DB().boards.filter((b: Any) => b.id !== m[1]); return { ok: true }; });
  on('POST', '/boards/([^/]+)/members', (m: Any, d: Any) => { const { b, role, u } = bAccess(m[1]); if (role !== 'OWNER') throw E(403, 'forbidden', 'فقط صاحب کار');
    let uid = d.userId; if (!uid && d.mobile) { const n = normMobile(d.mobile); uid = n && DB().users.find((x: Any) => x.mobile === n)?.id; if (!uid) throw E(400, 'no_user', 'کسی با این شماره در مدرسه حساب ندارد'); }
    if (!uid || uid === u.id) throw E(400, 'bad_member', 'نفر را انتخاب کنید');
    DB().bmembers = DB().bmembers.filter((x: Any) => !(x.boardId === b.id && x.userId === uid)); DB().bmembers.push({ boardId: b.id, userId: uid, role: d.role });
    notify(uid, { kind: 'board_share', title: `${u.firstName} ${u.lastName} کار «${b.title}» را با شما به اشتراک گذاشت`, link: `/tools/boards/${b.id}` }); return { ok: true }; });
  on('DELETE', '/boards/([^/]+)/members/([^/]+)', (m: Any) => { const { role, u } = bAccess(m[1]); if (role !== 'OWNER' && m[2] !== u.id) throw E(403, 'forbidden', 'فقط صاحب کار'); DB().bmembers = DB().bmembers.filter((x: Any) => !(x.boardId === m[1] && x.userId === m[2])); return { ok: true }; });
  on('POST', '/boards/([^/]+)/comments', (m: Any, d: Any) => { const { u } = bAccess(m[1]); DB().bcomments.push({ id: rid(), boardId: m[1], authorId: u.id, body: d.body.trim(), createdAt: now() }); return { ok: true }; });
  on('GET', '/boards/([^/]+)/versions', (m: Any) => { bAccess(m[1]); return DB().bversions.filter((v: Any) => v.boardId === m[1]).sort((a: Any, b: Any) => b.createdAt.localeCompare(a.createdAt)).map((v: Any) => ({ id: v.id, createdAt: v.createdAt, author: nm(v.authorId) })); });
  on('POST', '/boards/([^/]+)/versions/([^/]+)/restore', (m: Any) => { const { b, role, u } = bAccess(m[1]); if (role === 'VIEWER') throw E(403, 'viewer', 'فقط صاحب کار یا هم‌کار'); const v = DB().bversions.find((x: Any) => x.id === m[2]); if (!v) throw E(404, 'no_version', 'نسخه پیدا نشد'); b.data = v.data; b.updatedAt = now(); DB().bversions.push({ id: rid(), boardId: b.id, authorId: u.id, data: v.data, createdAt: now() }); return { ok: true }; });
  on('POST', '/boards/([^/]+)/public', (m: Any, d: Any) => { const { b, role } = bAccess(m[1]); if (role !== 'OWNER') throw E(403, 'forbidden', 'فقط صاحب کار'); b.publicToken = d.on ? rid() + rid() : null; return { publicToken: b.publicToken }; });
  on('GET', '/public/boards/([^/]+)', (m: Any) => { const b = DB().boards.find((x: Any) => x.publicToken === m[1]); if (!b) throw E(404, 'no_board', 'این پیوند دیگر فعال نیست'); return { toolId: b.toolId, title: b.title, data: b.data, updatedAt: b.updatedAt }; });
  const filled = (d: Any) => !!d && (Object.values(d.n ?? {}).reduce((s: number, a: Any) => s + (Array.isArray(a) ? a.length : 0), 0) + Object.values(d.f ?? {}).filter((v) => String(v ?? '').trim()).length) > 0;
  on('GET', '/admin/tools', () => { staff(); return TOOLS.map((t) => { const bs = DB().boards.filter((b: Any) => b.toolId === t.id); return { id: t.id, title: t.t, cat: t.cat, published: !!DB().toolStatus[t.id], boards: bs.length, filled: bs.filter((b: Any) => filled(b.data)).length, shared: bs.filter((b: Any) => DB().bmembers.some((x: Any) => x.boardId === b.id)).length }; }); });
  on('PATCH', '/admin/tools/([^/]+)', (m: Any, d: Any) => { staff(); DB().toolStatus[m[1]] = !!d.published; return { ok: true }; });

  // ── مدل کسب‌وکار (ستاد)
  const services = () => SERVICES.map((g) => ({ ...g, items: g.items.map((i: Any) => ({ ...i, note: i.note?.replace('{live}', faNum(DB().costs.basicLiveHours)) })) }));
  on('GET', '/plans', () => ({ tiers: TIERS, services: services(), plans: PLANS, basicLiveHours: DB().costs.basicLiveHours }));
  const pricing = () => ({ costs: DB().costs, model: priceModel(DB().costs), discounts: [{ over: 500, pct: 15 }, { over: 2000, pct: 30 }], plans: PLANS, tiers: TIERS, services: services() });
  on('GET', '/admin/business/pricing', () => { staff(); return pricing(); });
  on('PATCH', '/admin/business/costs', (_m: Any, b: Any) => { staff(); for (const [k, v] of Object.entries(b.costs ?? {})) { if (!(k in DEFAULT_COSTS)) continue; if (typeof v !== 'number' || !isFinite(v) || v < 0) throw E(400, 'bad_cost', 'هزینه‌ها باید عدد مثبت باشند'); DB().costs[k] = v; } if (DB().costs.expectedUsers < 1) throw E(400, 'bad_cost', 'شمار کاربران فعال دست‌کم ۱ است'); audit('biz.costs'); return pricing(); });
  const quote = (plan: string, seats: number, price?: number, disc?: number, fee?: number) => { const per = price ?? priceModel(DB().costs).perSeat; const d = disc ?? volumeDiscount(seats); const f = PLANS[plan].fixedFee ? (fee ?? DB().costs.premiumFixedFee) : 0; return { pricePerSeat: per, discountPct: d, fixedFee: f, amount: Math.round(seats * per * (1 - d / 100)) + f }; };
  on('GET', '/admin/business/quote', (_m: Any, _b: Any, q: Any) => { staff(); const n = Number(q.get('seats')); if (!PLANS[q.get('plan')]) throw E(400, 'bad_plan', 'بسته را انتخاب کنید'); if (!(n >= 1)) throw E(400, 'bad_seats', 'شمار نفرات را بنویسید'); const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined); return quote(q.get('plan'), n, num('price'), num('discount'), num('fee')); });
  on('GET', '/admin/business/kpi', () => { staff(); const m = priceModel(DB().costs); const field = new Set(DB().progress.filter((p: Any) => p.completedAt && DB().lessons.find((l: Any) => l.id === p.lessonId)?.type === 'MISSION').map((p: Any) => p.userId)).size; const active = new Set(DB().progress.filter((p: Any) => p.completedAt).map((p: Any) => p.userId)).size;
    const subs = DB().subscriptions.filter((s: Any) => status(s) === 'ACTIVE'); const paid = DB().invoices.filter((i: Any) => i.status === 'PAID');
    const income = { subscriptions: paid.filter((i: Any) => i.subscriptionId).reduce((a: number, i: Any) => a + i.amount, 0), services: paid.filter((i: Any) => !i.subscriptionId && i.serviceOrderId).reduce((a: number, i: Any) => a + i.amount, 0), sponsors: paid.filter((i: Any) => !i.subscriptionId && !i.serviceOrderId && i.sponsorId).reduce((a: number, i: Any) => a + i.amount, 0) };
    const incomeTotal = income.subscriptions + income.services + income.sponsors;
    return { period: 'last365', activeUsers: active, fieldActive: field, costYear: m.total, costPerFieldActive: field ? Math.round(m.total / field) : null, costPerActive: active ? Math.round(m.total / active) : null, perSeat: m.perSeat, orgs: subs.length, seatsSold: subs.reduce((a: number, s: Any) => a + s.seats, 0), year: 1405, income, incomeTotal, hqShare: Math.max(0, m.total - incomeTotal) }; });
  const subRow = (s: Any) => { const inv = DB().invoices.filter((i: Any) => i.subscriptionId === s.id); return { ...s, org: DB().networks.find((n: Any) => n.id === s.networkId)?.name, status: status(s), used: memberIds(s.networkId).length, courses: s.courseIds.map((id: string) => ({ id, title: DB().courses.find((c: Any) => c.id === id)?.title })), invoiced: inv.filter((i: Any) => i.status !== 'VOID').reduce((a: number, i: Any) => a + i.amount, 0), paid: inv.filter((i: Any) => i.status === 'PAID').reduce((a: number, i: Any) => a + i.amount, 0) }; };
  on('GET', '/admin/subscriptions', () => { staff(); return [...DB().subscriptions].sort((a: Any, b: Any) => b.endsAt.localeCompare(a.endsAt)).map(subRow); });
  const checkSub = (d: Any, except?: string) => {
    if (new Date(d.endsAt) <= new Date(d.startsAt)) throw E(400, 'bad_dates', 'تاریخ پایان باید بعد از تاریخ شروع باشد');
    const net = DB().networks.find((n: Any) => n.id === d.networkId); if (!net || net.kind !== 'ORGANIZATION') throw E(400, 'no_org', 'اشتراک فقط برای سازمان‌ها است؛ سازمان را از فهرست انتخاب کنید');
    if (DB().subscriptions.some((s: Any) => s.id !== except && s.networkId === d.networkId && !s.cancelledAt && s.startsAt < d.endsAt && s.endsAt > d.startsAt)) throw E(400, 'overlap', `«${net.name}» در این بازه اشتراک دیگری دارد؛ برای تمدید، اشتراک تازه را از روز پایان قبلی شروع کنید`);
    const used = memberIds(d.networkId).length; return { net, warn: used > d.seats ? `این سازمان الان ${faNum(used)} عضو دارد ولی سقف ${faNum(d.seats)} است` : null };
  };
  on('POST', '/admin/subscriptions', (_m: Any, d: Any) => { staff(); const { net, warn } = checkSub(d); const q = quote(d.plan, d.seats, d.pricePerSeat, d.discountPct, d.fixedFee);
    const s = { id: rid(), networkId: d.networkId, plan: d.plan, seats: d.seats, startsAt: d.startsAt, endsAt: d.endsAt, contractNo: d.contractNo ?? null, note: d.note ?? null, cancelledAt: null, courseIds: d.courseIds ?? [], createdAt: now(), ...q };
    DB().subscriptions.push(s); audit('sub.create', s.id); DB().roles.filter((r: Any) => r.role === 'ORG_ADMIN' && r.networkId === d.networkId).forEach((r: Any) => notify(r.userId, { kind: 'subscription', title: `اشتراک ${PLANS[d.plan].label} «${net.name}» ثبت شد`, link: '/org' }));
    return { id: s.id, amount: q.amount, warn }; });
  on('PATCH', '/admin/subscriptions/([^/]+)', (m: Any, d: Any) => { staff(); const s = DB().subscriptions.find((x: Any) => x.id === m[1]); if (!s) throw E(404, 'no_subscription', 'این اشتراک پیدا نشد'); if (s.cancelledAt) throw E(400, 'cancelled', 'اشتراک لغوشده ویرایش نمی‌شود؛ اشتراک تازه بسازید');
    const { warn } = checkSub({ ...d, networkId: s.networkId }, s.id); const q = quote(d.plan, d.seats, d.pricePerSeat, d.discountPct, d.fixedFee);
    Object.assign(s, { plan: d.plan, seats: d.seats, startsAt: d.startsAt, endsAt: d.endsAt, contractNo: d.contractNo ?? null, note: d.note ?? null, courseIds: d.courseIds ?? [], ...q }); audit('sub.update', s.id); return { ok: true, amount: q.amount, warn }; });
  on('POST', '/admin/subscriptions/([^/]+)/cancel', (m: Any) => { staff(); const s = DB().subscriptions.find((x: Any) => x.id === m[1]); s.cancelledAt ??= now(); audit('sub.cancel', s.id); return { ok: true }; });
  const invRow = (i: Any) => ({ ...i, org: DB().networks.find((n: Any) => n.id === i.networkId)?.name ?? null, sponsor: DB().sponsors.find((s: Any) => s.id === i.sponsorId)?.name ?? null });
  on('GET', '/admin/invoices', () => { staff(); return [...DB().invoices].sort((a: Any, b: Any) => b.createdAt.localeCompare(a.createdAt)).map(invRow); });
  on('POST', '/admin/invoices', (_m: Any, d: Any) => { staff(); if (!d.networkId && !d.sponsorId && !d.subscriptionId && !d.serviceOrderId) throw E(400, 'no_payer', 'فاکتور باید به یک سازمان، حامی، اشتراک یا خدمت وصل باشد');
    const nid = d.subscriptionId ? DB().subscriptions.find((s: Any) => s.id === d.subscriptionId)?.networkId : d.serviceOrderId ? DB().services.find((s: Any) => s.id === d.serviceOrderId)?.networkId : d.networkId;
    const i = { id: rid(), number: `MH-1405-${String(DB().invoices.length + 1).padStart(4, '0')}`, networkId: nid ?? null, subscriptionId: d.subscriptionId ?? null, serviceOrderId: d.serviceOrderId ?? null, sponsorId: d.sponsorId ?? null, title: d.title, amount: d.amount, status: 'ISSUED', paidAt: null, paymentRef: null, createdAt: now() };
    DB().invoices.push(i); audit('invoice.create', i.id); return i; });
  on('POST', '/admin/invoices/([^/]+)/pay', (m: Any, d: Any) => { staff(); const i = DB().invoices.find((x: Any) => x.id === m[1]); if (i.status !== 'ISSUED') throw E(400, 'not_open', i.status === 'PAID' ? 'این فاکتور پیش‌تر پرداخت شده' : 'این فاکتور باطل شده است'); Object.assign(i, { status: 'PAID', paymentRef: d.paymentRef, paidAt: d.paidAt ?? now() }); return { ok: true }; });
  on('POST', '/admin/invoices/([^/]+)/void', (m: Any) => { staff(); const i = DB().invoices.find((x: Any) => x.id === m[1]); if (i.status === 'PAID') throw E(400, 'paid', 'فاکتور پرداخت‌شده باطل نمی‌شود؛ برای برگشت پول، فاکتور برگشتی بیرون از سامانه ثبت کنید'); i.status = 'VOID'; return { ok: true }; });
  on('GET', '/admin/sponsors', () => { staff(); return DB().sponsors.map((s: Any) => ({ ...s, courses: DB().courses.filter((c: Any) => c.sponsorId === s.id).map((c: Any) => ({ id: c.id, title: c.title })), paid: DB().invoices.filter((i: Any) => i.sponsorId === s.id && i.status === 'PAID').reduce((a: number, i: Any) => a + i.amount, 0) })); });
  const saveSponsor = (d: Any, id?: string) => { staff(); if (!d.termsAccepted) throw E(400, 'terms', 'حامی باید سه شرط را پذیرفته باشد: محتوا با تأیید ستاد، فقط یک خط نام بی لوگو و تبلیغ، مالکیت دوره با مدرسه');
    if (id) Object.assign(DB().sponsors.find((s: Any) => s.id === id), { name: d.name, kind: d.kind, note: d.note ?? null, termsAccepted: true }); else { id = rid(); DB().sponsors.push({ id, name: d.name, kind: d.kind, note: d.note ?? null, termsAccepted: true, createdAt: now() }); } return { id }; };
  on('POST', '/admin/sponsors', (_m: Any, d: Any) => saveSponsor(d));
  on('PATCH', '/admin/sponsors/([^/]+)', (m: Any, d: Any) => saveSponsor(d, m[1]));
  on('DELETE', '/admin/sponsors/([^/]+)', (m: Any) => { staff(); if (DB().courses.some((c: Any) => c.sponsorId === m[1])) throw E(400, 'in_use', 'این حامی روی دوره ثبت است؛ اول از دوره‌ها برداریدش'); DB().sponsors = DB().sponsors.filter((s: Any) => s.id !== m[1]); return { ok: true }; });
  on('POST', '/admin/courses/([^/]+)/sponsor', (m: Any, d: Any) => { staff(); C(m[1]).sponsorId = d.sponsorId || null; return { ok: true }; });
  on('GET', '/admin/services', () => { staff(); return DB().services.map((s: Any) => ({ ...s, org: DB().networks.find((n: Any) => n.id === s.networkId)?.name ?? null, sponsor: DB().sponsors.find((x: Any) => x.id === s.sponsorId)?.name ?? null, course: DB().courses.find((c: Any) => c.id === s.courseId)?.title ?? null })); });
  const saveService = (d: Any, id?: string) => { staff(); if (!d.networkId && !d.sponsorId) throw E(400, 'no_payer', 'سفارش‌دهنده را انتخاب کنید: یک سازمان یا یک حامی');
    const cost = d.costs.reduce((a: number, c: Any) => a + c.amount, 0); if (!cost) throw E(400, 'no_cost', 'برگهٔ بودجه خالی است؛ دست‌کم یک ردیف هزینه بنویسید');
    const v = { ...d, cost, price: d.price ?? Math.round((cost * DB().costs.serviceMarkup) / 1000) * 1000, status: d.status ?? 'PROPOSED' };
    if (id) Object.assign(DB().services.find((s: Any) => s.id === id), v); else { id = rid(); DB().services.unshift({ id, createdAt: now(), ...v }); } return { id, cost, price: v.price }; };
  on('POST', '/admin/services', (_m: Any, d: Any) => saveService(d));
  on('PATCH', '/admin/services/([^/]+)', (m: Any, d: Any) => saveService(d, m[1]));

  // ── بازخورد
  on('POST', '/feedback', (_m: Any, d: Any) => { const u = me(); if (!d.body || d.body.trim().length < 3) throw E(400, 'invalid', 'متن بازخورد را بنویسید');
    const f = { id: rid(), userId: u.id, anonymous: !!d.anonymous, kind: d.kind, mood: d.mood ?? null, body: d.body.trim(), path: d.path ?? null, context: d.context ?? null, device: d.kind === 'BUG' ? d.device ?? null : null, imageKey: d.imageKey ?? null, status: 'NEW', tags: [], reply: null, repliedAt: null, createdAt: now() };
    DB().feedback.unshift(f); return { id: f.id }; });
  on('GET', '/feedback/mine', () => { const u = me(); return DB().feedback.filter((f: Any) => f.userId === u.id); });
  on('GET', '/admin/feedback/stats', () => { staff(); const f = DB().feedback; const by = (k: string) => f.reduce((a: Any, x: Any) => ({ ...a, [x[k]]: (a[x[k]] ?? 0) + 1 }), {}); const moods = f.filter((x: Any) => x.mood);
    const pages: Any = {}; f.filter((x: Any) => x.path).forEach((x: Any) => { pages[x.path] ??= { path: x.path, n: 0, bugs: 0 }; pages[x.path].n++; if (x.kind === 'BUG') pages[x.path].bugs++; });
    return { byKind: by('kind'), byStatus: by('status'), mood: { avg: moods.length ? Math.round((moods.reduce((a: number, x: Any) => a + x.mood, 0) / moods.length) * 10) / 10 : null, n: moods.length }, pages: Object.values(pages) }; });
  on('GET', '/admin/feedback', (_m: Any, _b: Any, q: Any) => { staff(); return DB().feedback.filter((f: Any) => (!q.get('status') || f.status === q.get('status')) && (!q.get('kind') || f.kind === q.get('kind'))).map((f: Any) => ({ ...f, body: dec(f.body), from: f.anonymous ? null : nm(f.userId),
    course: DB().courses.find((c: Any) => c.id === f.context?.courseId)?.title ?? null, lesson: DB().lessons.find((l: Any) => l.id === f.context?.lessonId)?.title ?? null })); });
  const ST_FA: Record<string, string> = { REVIEWING: 'در حال بررسی است', PLANNED: 'در برنامهٔ کار قرار گرفت', DONE: 'انجام شد', DECLINED: 'بررسی شد و فعلاً انجام نمی‌شود' };
  on('PATCH', '/admin/feedback/([^/]+)', (m: Any, d: Any) => { staff(); const f = DB().feedback.find((x: Any) => x.id === m[1]); if (!f) throw E(404, 'no_feedback', 'این بازخورد پیدا نشد');
    const replying = d.reply?.trim() && d.reply.trim() !== f.reply; const old = f.status;
    if (d.status) f.status = d.status; if (d.tags) f.tags = [...new Set(d.tags as string[])]; if (replying) { f.reply = d.reply.trim(); f.repliedAt = now(); if (!d.status && f.status === 'NEW') f.status = 'REVIEWING'; }
    if (replying || (f.status !== old && f.status !== 'NEW')) notify(f.userId, { kind: 'feedback', title: replying ? 'به بازخوردتان پاسخ داده شد' : `بازخوردتان ${ST_FA[f.status]}`, body: replying ? f.reply.slice(0, 140) : undefined, link: '/help#feedback' });
    return { ok: true }; });
  const REASONS = { up: ['کاربردی بود', 'روشن بود', 'مثال خوب داشت', 'کوتاه و بس'], down: ['نامفهوم بود', 'طولانی بود', 'به کارم نمی‌آید', 'مشکل فنی داشت'] };
  const lessonCourse = (lid: string) => { const l = DB().lessons.find((x: Any) => x.id === lid); return DB().modules.find((x: Any) => x.id === l?.moduleId)?.courseId; };
  on('GET', '/lessons/([^/]+)/rating', (m: Any) => { const u = me(); const r = DB().lratings.find((x: Any) => x.userId === u.id && x.lessonId === m[1]); return { rating: r ? { up: r.up, reasons: r.reasons, comment: r.comment } : null, reasons: REASONS }; });
  on('POST', '/lessons/([^/]+)/rating', (m: Any, d: Any) => { const u = me(); if (!enr(u.id, lessonCourse(m[1]))) throw E(403, 'not_enrolled', 'برای امتیاز دادن اول در دوره ثبت‌نام کنید');
    const v = { up: d.up, reasons: (d.reasons ?? []).filter((x: string) => (d.up ? REASONS.up : REASONS.down).includes(x)), comment: d.comment?.trim() || null, updatedAt: now() };
    const ex = DB().lratings.find((x: Any) => x.userId === u.id && x.lessonId === m[1]); if (ex) Object.assign(ex, v); else DB().lratings.push({ userId: u.id, lessonId: m[1], ...v }); return { ok: true }; });
  on('POST', '/courses/([^/]+)/rating', (m: Any, d: Any) => { const u = me(); const c = C(m[1]); const e = enr(u.id, c.id); if (!e) throw E(403, 'not_enrolled', 'برای امتیاز دادن اول در دوره ثبت‌نام کنید');
    if (!e.completedAt && allLessons(c.id).filter((l: Any) => prog(u.id, l.id)?.completedAt).length < 3) throw E(400, 'too_early', 'بعد از گذراندن دست‌کم سه درس می‌توانید به دوره امتیاز بدهید');
    const ex = DB().cratings.find((x: Any) => x.userId === u.id && x.courseId === c.id); const v = { stars: d.stars, comment: d.comment?.trim() || null, updatedAt: now() };
    if (ex) Object.assign(ex, v); else DB().cratings.push({ userId: u.id, courseId: c.id, ...v }); return { ok: true }; });
  on('GET', '/admin/content-quality', () => { staff();
    const courses = DB().courses.filter((c: Any) => c.status === 'PUBLISHED').map((c: Any) => { const rs = DB().cratings.filter((r: Any) => r.courseId === c.id); return { id: c.id, title: c.title, avg: rs.length ? Math.round((rs.reduce((a: number, r: Any) => a + r.stars, 0) / rs.length) * 10) / 10 : null, n: rs.length, learners: DB().enrollments.filter((e: Any) => e.courseId === c.id).length }; });
    const byL: Any = {}; DB().lratings.forEach((r: Any) => { byL[r.lessonId] ??= { up: 0, down: 0, reasons: {} }; byL[r.lessonId][r.up ? 'up' : 'down']++; r.reasons.forEach((x: string) => (byL[r.lessonId].reasons[x] = (byL[r.lessonId].reasons[x] ?? 0) + 1)); });
    const lessons = Object.entries(byL).map(([id, v]: Any) => { const l = DB().lessons.find((x: Any) => x.id === id); return { id, title: l?.title, course: DB().courses.find((c: Any) => c.id === lessonCourse(id))?.title, up: v.up, down: v.down, reasons: Object.entries(v.reasons).map(([reason, n]) => ({ reason, n })) }; }).sort((a: Any, b: Any) => b.down / (a.up + a.down || 1) - a.down / (b.up + b.down || 1));
    const comments = [...DB().cratings.filter((r: Any) => r.comment).map((r: Any) => ({ kind: 'course', title: DB().courses.find((c: Any) => c.id === r.courseId)?.title, comment: r.comment, score: r.stars, at: r.updatedAt })),
      ...DB().lratings.filter((r: Any) => r.comment).map((r: Any) => ({ kind: 'lesson', title: DB().lessons.find((l: Any) => l.id === r.lessonId)?.title, comment: r.comment, score: r.up ? 1 : 0, at: r.updatedAt }))].sort((a, b) => b.at.localeCompare(a.at));
    return { courses, lessons, comments }; });
  onFirst('POST', '/uploads/mission', (_m: Any, _b: Any, q: Any) => { if (q.get('kind') === 'feedback') throw E(400, 'demo', 'در نسخهٔ نمایشی بارگذاری عکس خاموش است'); return { key: 'demo-' + rid() }; });
  void card;
}
