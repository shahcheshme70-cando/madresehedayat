/**
 * شبیه‌ساز API برای نسخهٔ نمایشی (بدون سرور).
 * همان مسیرها و همان شکل پاسخ‌های apps/api را برمی‌گرداند و داده را در مرورگر نگه می‌دارد.
 * فقط در ساخت نمایشی (VITE_DEMO=1) به کار می‌رود.
 */
import seed from './seed.json';
import full from './catalog-full.json';
import { registerPhase3, seedPhase3 } from './phase3';

type Any = any;
export class DemoError extends Error {
  constructor(public status: number, public code: string, message: string, public data: Any = {}) { super(message); }
}
const E = (status: number, code: string, message: string, data: Any = {}) => new DemoError(status, code, message, data);

const KEY = 'mh-demo-v5';
const DEMO_CODE = '12345';
export const DEMO_ADMIN = '09120000000';
const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const CODE_ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const rcode = () => 'HD-' + Array.from({ length: 4 }, () => CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)]).join('') + '-' + Array.from({ length: 4 }, () => CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)]).join('');

interface DB {
  users: Any[]; roles: { userId: string; role: string; networkId?: string | null }[]; session: string | null;
  provinces: Any[]; counties: Any[]; mosques: Any[]; networks: Any[];
  courses: Any[]; modules: Any[]; lessons: Any[]; deps: Any[]; paths: Any[]; pathItems: Any[];
  enrollments: Any[]; progress: Any[]; attempts: Any[]; certificates: Any[]; grants: Any[]; audit: Any[]; otpMobile: string | null;
  positions: Any[]; regionProv: Any[]; assigns: Any[]; mmsgs: Any[]; dms: Any[]; notifs: Any[]; cores: Any[]; coreMembers: Any[]; netMembers: Any[]; events: Any[]; regs: Any[];
  [k: string]: Any; // مرحلهٔ ۳ (phase3.ts)
}

function fresh(): DB {
  const s = JSON.parse(JSON.stringify(seed)) as Any;
  // کاتالوگ کامل نمونه (۲۴ دوره و ۶ مسیر از نمونهٔ اولیه)؛ مسیر نوجوانان با مسیر موجود یکی می‌شود
  const f = JSON.parse(JSON.stringify(full)) as Any;
  const njPath = s.paths.find((p: Any) => p.slug === 'nojavanan');
  const base = s.pathItems.filter((i: Any) => i.pathId === njPath?.id).length;
  // «مدیریت مسجد» کاتالوگ کامل، جای نمونهٔ کوتاه قدیمی را می‌گیرد
  const old = s.courses.find((c: Any) => c.slug === 'masjed-modiriat');
  if (old) { const mids = s.modules.filter((m: Any) => m.courseId === old.id).map((m: Any) => m.id); s.lessons = s.lessons.filter((l: Any) => !mids.includes(l.moduleId)); s.modules = s.modules.filter((m: Any) => m.courseId !== old.id); s.courses = s.courses.filter((c: Any) => c.id !== old.id); }
  s.courses.push(...f.courses); s.modules.push(...f.modules); s.lessons.push(...f.lessons);
  s.paths.push(...f.paths.filter((p: Any) => p.slug !== 'nojavan'));
  s.pathItems.push(...f.pathItems.map((i: Any) => (i.pathId === 'pp-nojavan' && njPath ? { ...i, pathId: njPath.id, order: base + i.order } : i)));
  const t = now();
  const courses = s.courses.map((c: Any) => ({ ...c, publishedAt: t, createdAt: t, updatedAt: t }));
  const db: DB = {
    users: [], roles: [], session: null, otpMobile: null,
    provinces: s.provinces, counties: s.counties, mosques: s.mosques.map((m: Any) => ({ ...m, createdAt: t })), networks: s.networks,
    courses, modules: s.modules, lessons: s.lessons, deps: s.deps ?? [], paths: s.paths, pathItems: s.pathItems,
    enrollments: [], progress: [], attempts: [], certificates: [], grants: [], audit: [],
    positions: [], regionProv: [], assigns: [], mmsgs: [], dms: [], notifs: [], cores: [], coreMembers: [], netMembers: [], events: [], regs: [],
  };
  // چند یادگیرندهٔ نمونه تا پیشخوان ستاد خالی نباشد
  const kashan = db.counties.find((c) => c.name === 'کاشان');
  const mosque = db.mosques[0];
  const sample = [['رضا', 'نوری', 'MALE'], ['فاطمه', 'کریمی', 'FEMALE'], ['حسین', 'رستمی', 'MALE'], ['زینب', 'موسوی', 'FEMALE']];
  const nj1 = courses.find((c: Any) => c.slug === 'nojavan-1');
  sample.forEach(([f, l, g], i) => {
    const id = 'sample' + i;
    db.users.push({ id, mobile: '0913' + String(1000000 + i * 1371).padStart(7, '0'), firstName: f, lastName: l, gender: g, countyId: kashan?.id, mosqueId: mosque?.id, nearMosque: null, nationalId: null, isActive: true, createdAt: new Date(Date.now() - (i + 2) * 86400_000).toISOString() });
    db.enrollments.push({ userId: id, courseId: nj1.id, courseVersion: 1, enrolledAt: new Date(Date.now() - (i + 1) * 86400_000).toISOString(), completedAt: i === 0 ? t : null, archivedAt: null, lastLessonId: null });
    if (i === 0) db.certificates.push({ id: rid(), code: 'HD-7K2Q-9MXA', userId: id, courseId: nj1.id, holderName: `${f} ${l}`, courseTitle: nj1.title, score: 100, issuedAt: t, revokedAt: null });
  });
  seedPhase2(db, kashan, mosque, nj1);
  seedPhase3(db);
  return db;
}

/** نقش‌های آماده برای گشتن در نسخهٔ نمایشی */
export const PERSONAS = [
  { mobile: '09124444444', label: 'کنشگر (زینب)', hint: 'مأموریت، برنامه، هسته' },
  { mobile: '09121111111', label: 'راهیار شهرستان', hint: 'گزارش‌ها، پیام، برگزاری برنامه' },
  { mobile: '09122222222', label: 'راهیار استان + مدیر سازمان', hint: 'دامنهٔ استان، پنل برکت' },
  { mobile: '09123333333', label: 'امام محله', hint: 'مسجد من، هسته‌ها' },
  { mobile: DEMO_ADMIN, label: 'ستاد', hint: 'ساختار راهیاری، دوره‌ها' },
];
const ago_ = (d: number, h = 0) => new Date(Date.now() - d * 86400_000 - h * 3600_000).toISOString();
const ahead = (d: number, h = 18) => { const x = new Date(Date.now() + d * 86400_000); x.setHours(h, 0, 0, 0); return x.toISOString(); };
function seedPhase2(db: DB, kashan: Any, mosque: Any, nj1: Any) {
  const isf = db.provinces.find((p) => p.id === kashan?.provinceId);
  const tehranC = db.counties.find((c) => c.name === 'تهران');
  const person = (id: string, mobile: string, firstName: string, lastName: string, gender: string, countyId: string) => db.users.push({ id, mobile, firstName, lastName, gender, countyId, mosqueId: null, nearMosque: null, nationalId: null, isActive: true, createdAt: ago_(30) });
  person('p-admin', DEMO_ADMIN, 'حسن', 'مرادی', 'MALE', tehranC?.id); db.roles.push({ userId: 'p-admin', role: 'HQ_ADMIN' });
  person('p-cty', '09121111111', 'فاطمه', 'حسینی', 'FEMALE', kashan?.id); db.roles.push({ userId: 'p-cty', role: 'RAHYAR' });
  person('p-prov', '09122222222', 'مریم', 'صالحی', 'FEMALE', kashan?.provinceId && db.counties.find((c) => c.provinceId === kashan.provinceId && c.id !== kashan.id)?.id); db.roles.push({ userId: 'p-prov', role: 'RAHYAR' });
  person('p-imam', '09123333333', 'سید علی', 'رضایی', 'MALE', kashan?.id); db.roles.push({ userId: 'p-imam', role: 'IMAM' });
  const zeynab = db.users.find((u) => u.id === 'sample3'); zeynab.mobile = '09124444444';
  // درخت بانور
  const P = (id: string, layer: string, title: string, parentId: string | null, holderId: string | null, extra: Any = {}) => db.positions.push({ id, gender: 'FEMALE', layer, title, parentId, holderId, provinceId: null, countyId: null, ...extra });
  P('f-dep', 'DEPUTY', 'معاون راهیاری بانور', null, null);
  P('f-man', 'MANAGER', 'مسئول راهیاری مرکز', 'f-dep', null);
  P('f-reg', 'REGIONAL', 'منطقهٔ ۳', 'f-man', null);
  P('f-prov', 'PROVINCIAL', `راهیار استانی ${isf?.name ?? ''}`, 'f-reg', 'p-prov', { provinceId: isf?.id });
  P('f-cty', 'COUNTY', `راهیار شهرستانی ${kashan?.name ?? ''}`, 'f-prov', 'p-cty', { countyId: kashan?.id });
  db.regionProv.push({ regionId: 'f-reg', provinceId: isf?.id });
  const yazd = db.provinces.find((p) => p.name === 'یزد'); if (yazd) db.regionProv.push({ regionId: 'f-reg', provinceId: yazd.id });
  db.positions.push({ id: 'm-dep', gender: 'MALE', layer: 'DEPUTY', title: 'معاون راهیاری برادران', parentId: null, holderId: null, provinceId: null, countyId: null });
  // مأموریت‌ها
  const ml = db.lessons.find((l) => l.type === 'MISSION');
  if (ml) {
    db.progress.push({ userId: 'sample3', lessonId: ml.id, positionSec: 0, completedAt: ago_(4), updatedAt: ago_(4), data: { status: 'submitted', did: 'بعد از نماز مغرب با دو نوجوان دربارهٔ برنامهٔ تابستان مسجد حرف زدم. یکی‌شان پیشنهاد داد کلاس عکاسی بگذاریم.', learned: 'وقتی نظرشان را پرسیدم، خیلی بیشتر حرف زدند.', submittedAt: ago_(4), round: 1, mainPhoto: 'demo-photo1' } });
    db.mmsgs.push({ id: rid(), learnerId: 'sample3', lessonId: ml.id, authorId: 'sample3', kind: 'REPORT', body: 'چه کردم: بعد از نماز مغرب با دو نوجوان دربارهٔ برنامهٔ تابستان مسجد حرف زدم. یکی‌شان پیشنهاد داد کلاس عکاسی بگذاریم.\nچه یاد گرفتم: وقتی نظرشان را پرسیدم، خیلی بیشتر حرف زدند.', createdAt: ago_(4) });
    db.progress.push({ userId: 'sample1', lessonId: ml.id, positionSec: 0, completedAt: ago_(6), updatedAt: ago_(2), data: { status: 'needs_revision', did: 'با یک نوجوان صحبت کردم.', submittedAt: ago_(6), reviewedAt: ago_(2), round: 1 } });
    db.mmsgs.push({ id: rid(), learnerId: 'sample1', lessonId: ml.id, authorId: 'sample1', kind: 'REPORT', body: 'چه کردم: با یک نوجوان صحبت کردم.', createdAt: ago_(6) });
    db.mmsgs.push({ id: rid(), learnerId: 'sample1', lessonId: ml.id, authorId: 'p-cty', kind: 'REVISE', body: 'شروع خوبی است. کمی بیشتر بنویسید: کجا حرف زدید، او چه گفت و شما از این گفت‌وگو چه فهمیدید؟', createdAt: ago_(2) });
  }
  db.dms.push({ id: rid(), learnerId: 'sample3', authorId: 'sample3', body: 'سلام خانم حسینی، برای کلاس عکاسی که بچه‌ها پیشنهاد دادند، از کجا شروع کنم؟', createdAt: ago_(1, 3), readByLearnerAt: ago_(1, 3), readByRahyarAt: null });
  // هسته‌ها و مسجد
  const banour = db.networks.find((n) => n.kind === 'BANOUR'); const brothers = db.networks.find((n) => n.kind === 'BROTHERS');
  db.cores.push({ id: 'core-rey', name: 'هستهٔ ریحانه', networkId: banour?.id, mosqueId: null, leaderId: 'sample3', inviteCode: 'hreyhane' });
  db.coreMembers.push({ coreId: 'core-rey', userId: 'sample3' }, { coreId: 'core-rey', userId: 'sample1' });
  if (mosque) { mosque.imamId = 'p-imam'; mosque.inviteCode = 'mjame01'; }
  db.cores.push({ id: 'core-noj', name: 'هستهٔ نوجوانان', networkId: brothers?.id, mosqueId: mosque?.id, leaderId: 'sample0', inviteCode: 'hnojavan' });
  db.coreMembers.push({ coreId: 'core-noj', userId: 'sample0' }, { coreId: 'core-noj', userId: 'sample2' });
  // سازمان برکت
  db.networks.push({ id: 'org-barakat', kind: 'ORGANIZATION', name: 'برکت', underRahyar: false });
  db.roles.push({ userId: 'p-prov', role: 'ORG_ADMIN', networkId: 'org-barakat' });
  db.netMembers.push({ networkId: 'org-barakat', userId: 'sample3' }, { networkId: 'org-barakat', userId: 'sample1' });
  db.grants.push({ id: rid(), courseId: nj1.id, networkId: 'org-barakat', userId: null, expiresAt: null, note: 'قرارداد برکت ۱۴۰۵', createdAt: ago_(20), issuedById: 'p-admin' });
  // برنامه‌ها
  const E1 = { id: 'ev-kashan', title: 'کارگاه گفت‌وگو با نوجوان', kind: 'IN_PERSON', startsAt: ahead(3, 17), endsAt: ahead(3, 19), location: `${kashan?.name ?? ''}، مسجد جامع، سالن طبقهٔ دوم`, mapUrl: null, onlineUrl: null, hostName: 'فاطمه حسینی', capacity: 12, waitlist: true, requiresApproval: false, registrationDeadline: null, audienceGender: 'FEMALE', audienceProvinceId: null, audienceCountyId: null, description: 'دو ساعت تمرین عملی گفت‌وگو با نوجوان: شنیدن، پرسیدن و ادامه دادن رابطه بعد از جلسه.', agenda: 'خوش‌آمد و آشنایی\nتمرین دونفره\nجمع‌بندی و قرار بعدی', bring: 'دفترچه و خودکار', status: 'PUBLISHED', cancelReason: null, createdById: 'p-cty' };
  const E2 = { ...E1, id: 'ev-online', title: 'نشست آنلاین راهیاران و مسئولان هسته', kind: 'ONLINE', startsAt: ahead(6, 20), endsAt: ahead(6, 21), location: null, onlineUrl: 'https://example.org/class', capacity: null, audienceGender: null, description: 'گفت‌وگوی ماهانه دربارهٔ تجربه‌های هسته‌ها.', agenda: null, bring: null, hostName: 'ستاد مدرسه' };
  const E3 = { ...E1, id: 'ev-past', title: 'دورهمی آغاز سال', startsAt: ago_(10), endsAt: ago_(10, -2), capacity: 30 };
  db.events.push(E1, E2, E3);
  const reg = (eventId: string, userId: string, code: string, extra: Any = {}) => db.regs.push({ eventId, userId, status: 'REGISTERED', code, byId: null, lateCancel: false, attendedAt: null, method: null, feedback: null, createdAt: ago_(2), ...extra });
  reg('ev-kashan', 'sample3', 'K7M2QX'); reg('ev-kashan', 'sample1', 'R4TB9N', { byId: 'sample3' });
  reg('ev-past', 'sample3', 'P2WQ7D', { attendedAt: ago_(10), method: 'QR', feedback: { rating: 5, comment: 'خیلی به کارم آمد' } }); reg('ev-past', 'sample1', 'H8NC3K', { attendedAt: ago_(10), method: 'MANUAL' });
  // اعلان‌ها
  const N = (userId: string, title: string, body: string | null, link: string, h: number, read = false) => db.notifs.push({ id: rid(), userId, kind: 'demo', title, body, link, readAt: read ? ago_(0, h - 1) : null, createdAt: ago_(0, h) });
  N('sample3', 'یادآوری: کارگاه گفت‌وگو با نوجوان', 'سه روز دیگر — کارت ورود را همراه داشته باشید', '/events/ev-kashan', 2);
  N('sample3', 'عضو تازه در هستهٔ «ریحانه»', null, '/cores/core-rey', 30, true);
  N('sample1', 'راهیارتان گزارش را برای اصلاح برگرداند', ml?.title ?? null, ml ? `/lessons/${ml.id}` : '/', 48);
  N('p-cty', 'گزارش تازهٔ زینب موسوی', ml?.title ?? null, ml ? `/rahyar/reports/sample3/${ml.id}` : '/rahyar', 96);
  N('p-cty', 'پیام تازه از یک کنشگر', null, '/rahyar/messages/sample3', 27);
}

let DBV: DB = load();
function load(): DB {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(DBV)); } catch { /* ignore */ } }
export function resetDemo() { DBV = fresh(); save(); }
/** ورود سریع با یکی از نقش‌های نمونه */
export function demoLoginAs(mobile: string) { const u = DBV.users.find((x) => x.mobile === mobile); if (u) { DBV.session = u.id; save(); } }

/* ───────── کمکی‌ها ───────── */
const me = () => { const u = DBV.users.find((x) => x.id === DBV.session); if (!u) throw E(401, 'unauthenticated', 'اول وارد شوید'); return u; };
const maybeMe = () => DBV.users.find((x) => x.id === DBV.session);
const rolesOf = (id: string) => [...new Set(DBV.roles.filter((r) => r.userId === id).map((r) => r.role))];
const staff = () => { const u = me(); const r = rolesOf(u.id); if (!r.includes('HQ_ADMIN') && !r.includes('HQ_OPERATOR')) throw E(403, 'forbidden', 'به این بخش دسترسی ندارید'); return u; };
const audit = (action: string, target?: string) => DBV.audit.unshift({ id: rid(), actorId: DBV.session, action, target: target ?? null, createdAt: now() });
const C = (key: string) => { const c = DBV.courses.find((x) => x.slug === key || x.id === key); if (!c) throw E(404, 'no_course', 'این دوره پیدا نشد'); return c; };
const modsOf = (cid: string) => DBV.modules.filter((m) => m.courseId === cid).sort((a, b) => a.order - b.order);
const lessonsOf = (mid: string) => DBV.lessons.filter((l) => l.moduleId === mid).sort((a, b) => a.order - b.order);
const allLessons = (cid: string) => modsOf(cid).flatMap((m) => lessonsOf(m.id));
const card = (c: Any) => ({ id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle, level: c.level, instructor: c.instructor, color: c.color, icon: c.icon, hasCertificate: c.hasCertificate });
const stats = (c: Any) => { const ls = allLessons(c.id); return { lessonCount: ls.length, durationSec: ls.reduce((s, l) => s + l.durationSec, 0) }; };
const enr = (uid: string, cid: string) => DBV.enrollments.find((e) => e.userId === uid && e.courseId === cid);
const prog = (uid: string, lid: string) => DBV.progress.find((p) => p.userId === uid && p.lessonId === lid);
const granted = (uid?: string) => {
  if (!uid) return new Set<string>();
  const nets = new Set([...DBV.roles.filter((r) => r.userId === uid && r.networkId).map((r) => r.networkId), ...DBV.netMembers.filter((x) => x.userId === uid && x.acceptedAt !== null).map((x) => x.networkId)]);
  return new Set([...DBV.grants.filter((g) => (g.userId === uid || (g.networkId && nets.has(g.networkId))) && (!g.expiresAt || g.expiresAt > now())).map((g) => g.courseId), ...HOOK.subscribedCourseIds(uid)]);
};
const canSee = (c: Any, g: Set<string>) => c.status === 'PUBLISHED' && (!c.isRestricted || g.has(c.id));
const percent = (uid: string, c: Any) => {
  const e = enr(uid, c.id); if (e?.completedAt) return 100;
  const req = allLessons(c.id).filter((l) => l.required);
  return req.length ? Math.round(req.filter((l) => prog(uid, l.id)?.completedAt).length / req.length * 100) : 0;
};
const state = (uid: string, c: Any) => { const e = enr(uid, c.id); return e ? { enrolledAt: e.enrolledAt, completedAt: e.completedAt, archived: !!e.archivedAt, percent: percent(uid, c), lastLessonId: e.lastLessonId } : null; };
const depState = (cid: string, uid?: string) => DBV.deps.filter((d) => d.courseId === cid).map((d) => {
  const c = DBV.courses.find((x) => x.id === d.requiresId);
  return { kind: d.kind, course: card(c), done: !!(uid && enr(uid, c.id)?.completedAt) };
});
const nextAttemptAt = (times: string[]) => { if (times.length < 2) return null; const n = new Date(new Date(times[0]).getTime() + 24 * 3600_000); return n > new Date() ? n.toISOString() : null; };
function profile(u: Any) {
  const county = DBV.counties.find((c) => c.id === u.countyId);
  const province = county && DBV.provinces.find((p) => p.id === county.provinceId);
  const mosque = DBV.mosques.find((m) => m.id === u.mosqueId);
  return { id: u.id, mobile: u.mobile, firstName: u.firstName, lastName: u.lastName, gender: u.gender, hasNationalId: !!u.nationalId,
    county: county ? { id: county.id, name: county.name, province: province?.name } : null, mosque: mosque ? { id: mosque.id, name: mosque.name } : null,
    nearMosque: u.nearMosque, roles: rolesOf(u.id), ssoLinked: false, allowRahyarMessages: u.allowRahyarMessages !== false,
    cores: DBV.cores.filter((c) => c.leaderId === u.id || DBV.coreMembers.some((x) => x.coreId === c.id && x.userId === u.id)).map((c) => ({ id: c.id, name: c.name, isLeader: c.leaderId === u.id })),
    imamOf: DBV.mosques.filter((m) => m.imamId === u.id).map((m) => ({ id: m.id, name: m.name })),
    orgs: DBV.roles.filter((r) => r.userId === u.id && r.role === 'ORG_ADMIN').map((r) => { const n = DBV.networks.find((x) => x.id === r.networkId); return { id: n?.id, name: n?.name }; }) };
}
function issueCert(uid: string, c: Any) {
  if (DBV.certificates.some((x) => x.userId === uid && x.courseId === c.id)) return DBV.certificates.find((x) => x.userId === uid && x.courseId === c.id).code;
  const u = DBV.users.find((x) => x.id === uid);
  const finals = allLessons(c.id).filter((l) => l.isFinalQuiz).map((l) => l.id);
  const best = Math.max(-1, ...DBV.attempts.filter((a) => a.userId === uid && finals.includes(a.lessonId)).map((a) => a.score));
  const code = rcode();
  DBV.certificates.push({ id: rid(), code, userId: uid, courseId: c.id, holderName: `${u.firstName} ${u.lastName}`, courseTitle: c.title, score: best >= 0 ? best : null, issuedAt: now(), revokedAt: null, orgName: HOOK.certOrgName(uid, c.id) });
  return code;
}
function checkCompletion(uid: string, cid: string) {
  const e = enr(uid, cid); if (!e) return { completed: false };
  if (e.completedAt) return { completed: true };
  const req = allLessons(cid).filter((l) => l.required);
  if (!req.length || req.some((l) => !prog(uid, l.id)?.completedAt)) return { completed: false };
  e.completedAt = now();
  const c = DBV.courses.find((x) => x.id === cid);
  const open = depState(cid, uid).filter((d) => d.kind === 'COREQUISITE' && !d.done);
  let certificate;
  if (c.hasCertificate && !open.length) certificate = { code: issueCert(uid, c) };
  return { completed: true, certificate, waitingFor: open.map((d) => d.course.title) };
}
function publicContent(type: string, content: Any) {
  if (type === 'QUIZ') return { ...content, questions: (content.questions ?? []).map(({ correct: _c, explain: _e, ...q }: Any) => q) };
  return content ?? {};
}
function validate(type: string, c: Any): string | null {
  switch (type) {
    case 'VIDEO': return c.provider === 'aparat' ? (/^[A-Za-z0-9]{3,20}$/.test(c.aparatHash ?? '') ? null : 'شناسهٔ ویدیوی آپارات درست نیست') : c.fileKey ? null : 'فایل ویدیو را بارگذاری کنید';
    case 'AUDIO': return c.fileKey || c.url ? null : 'فایل صوتی را بارگذاری کنید';
    case 'TEXT': return typeof c.body === 'string' && c.body.trim().length >= 20 ? null : 'متن درس کوتاه است';
    case 'QUIZ':
      if (!c.questions?.length) return 'دست‌کم یک پرسش لازم است';
      for (const [i, q] of c.questions.entries()) {
        if (!q.text?.trim()) return `متن پرسش ${i + 1} خالی است`;
        if (!q.correct?.length) return `پاسخ درست پرسش ${i + 1} را مشخص کنید`;
      }
      return null;
    case 'WORKSHEET': return c.prompt && c.fields?.length ? null : 'برگه دست‌کم یک خانه لازم دارد';
    case 'MISSION': return c.goal ? null : 'هدف مأموریت را بنویسید';
    case 'PRACTICE': {
      if (!Array.isArray(c.steps) || !c.steps.length) return 'تمرین دست‌کم یک موقعیت لازم دارد';
      for (const [i, s] of c.steps.entries()) {
        if (!s.situation?.trim()) return `متن موقعیت ${i + 1} خالی است`;
        if (!Array.isArray(s.choices) || s.choices.length < 2) return `موقعیت ${i + 1} دست‌کم دو انتخاب لازم دارد`;
        if (s.choices.some((x: Any) => !x.text?.trim() || !x.feedback?.trim())) return `هر انتخاب در موقعیت ${i + 1} متن و بازخورد لازم دارد`;
        if (!s.choices.some((x: Any) => x.score === 2)) return `در موقعیت ${i + 1} دست‌کم یک انتخاب را «بهترین» علامت بزنید`;
      }
      return null;
    }

    default: return null;
  }
}
function problems(c: Any) {
  const p: string[] = [];
  if (!c.about?.trim()) p.push('توضیح دوره خالی است');
  const ls = allLessons(c.id);
  if (!ls.length) p.push('دوره هنوز درسی ندارد');
  for (const l of ls) { const e = validate(l.type, l.content); if (e) p.push(`درس «${l.title}»: ${e}`); }
  if (c.hasCertificate && !ls.some((l) => l.type === 'QUIZ' && l.isFinalQuiz)) p.push('دورهٔ گواهی‌دار آزمون پایانی لازم دارد');
  return p;
}
const normMobile = (v: string) => {
  const s = String(v ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[\s\-()]/g, '').replace(/^\+98/, '0');
  const m = s.length === 10 && s.startsWith('9') ? '0' + s : s;
  return /^09\d{9}$/.test(m) ? m : null;
};

/* ───────── مسیرها ───────── */
type H = (m: RegExpMatchArray, body: Any, q: URLSearchParams) => Any;
const R: [string, RegExp, H][] = [];
const on = (method: string, re: string, h: H) => R.push([method, new RegExp('^' + re + '$'), h]);
/** مسیری که باید پیش از مسیرهای قدیمی‌تر بررسی شود */
const onFirst = (method: string, re: string, h: H) => R.unshift([method, new RegExp('^' + re + '$'), h]);
/** افزودن به پاسخ یک مسیر موجود */
const wrap = (method: string, re: string, f: (orig: H) => H) => { const src = new RegExp('^' + re + '$').source; const i = R.findIndex(([m, r]) => m === method && r.source === src); if (i < 0) throw new Error('demo wrap: ' + re); R[i][2] = f(R[i][2]); };
/** قلاب‌های مرحلهٔ ۳ (دوره‌های اشتراک، نام سازمان روی گواهی، مخاطب ویژهٔ برنامه) */
const HOOK: Any = { subscribedCourseIds: () => [], certOrgName: () => null, eventScopeBlock: () => null };

// احراز هویت
on('POST', '/auth/otp', (_m, b) => { const mob = normMobile(b.mobile); if (!mob) throw E(400, 'bad_mobile', 'شماره باید ۱۱ رقم باشد و با ۰۹ شروع شود'); DBV.otpMobile = mob; return { sent: true, resendIn: 60, isNew: !DBV.users.some((u) => u.mobile === mob), devCode: DEMO_CODE }; });
on('POST', '/auth/verify', (_m, b) => {
  const mob = normMobile(b.mobile);
  if (String(b.code) !== DEMO_CODE) throw E(400, 'otp_wrong', 'کد درست نیست؛ در نسخهٔ نمایشی کد ۱۲۳۴۵ است');
  const u = DBV.users.find((x) => x.mobile === mob);
  if (!u) return { needsRegistration: true, regToken: 'demo:' + mob };
  DBV.session = u.id; return { needsRegistration: false, user: profile(u) };
});
on('POST', '/auth/register', (_m, b) => {
  const mob = String(b.regToken).replace('demo:', '');
  const u = { id: rid(), mobile: mob, firstName: b.firstName.trim(), lastName: b.lastName.trim(), gender: b.gender, countyId: b.countyId, mosqueId: b.mosqueId || null, nearMosque: b.mosqueId ? null : b.nearMosque || null, nationalId: null, isActive: true, createdAt: now() };
  DBV.users.push(u);
  if (mob === DEMO_ADMIN) DBV.roles.push({ userId: u.id, role: 'HQ_ADMIN' });
  DBV.session = u.id; return { user: profile(u) };
});
on('POST', '/auth/refresh', () => { if (!DBV.session) throw E(401, 'session_ended', 'دوباره وارد شوید'); return { ok: true }; });
on('POST', '/auth/logout', () => { DBV.session = null; return { ok: true }; });
on('GET', '/auth/sso/core', () => { throw E(501, 'sso_not_configured', 'ورود با سامانهٔ پایه هنوز راه نیفتاده است'); });
on('GET', '/auth/me', () => profile(me()));
on('PATCH', '/auth/me', (_m, b) => {
  const u = me();
  if (b.firstName) u.firstName = b.firstName.trim(); if (b.lastName) u.lastName = b.lastName.trim(); if (b.countyId) u.countyId = b.countyId;
  if (b.mosqueId !== undefined) { u.mosqueId = b.mosqueId || null; if (b.mosqueId) u.nearMosque = null; }
  if (b.nearMosque !== undefined && !u.mosqueId) u.nearMosque = b.nearMosque || null;
  if (b.nationalId) { if (!/^\d{10}$/.test(b.nationalId)) throw E(400, 'bad_national_id', 'کد ملی ۱۰ رقم است'); u.nationalId = b.nationalId; }
  return profile(u);
});

// جغرافیا
on('GET', '/geo/provinces', () => DBV.provinces.map((p) => ({ ...p, counties: DBV.counties.filter((c) => c.provinceId === p.id).map((c) => ({ id: c.id, name: c.name })) })));
on('GET', '/geo/mosques', (_m, _b, q) => DBV.mosques.filter((m) => m.countyId === q.get('countyId')).map((m) => ({ id: m.id, name: m.name })));

// یادگیری
on('GET', '/courses', () => { const u = maybeMe(); const g = granted(u?.id); return DBV.courses.filter((c) => canSee(c, g)).map((c) => ({ ...card(c), ...stats(c), me: u ? state(u.id, c) : null })); });
on('GET', '/paths', () => {
  const u = maybeMe(); const g = granted(u?.id);
  return DBV.paths.filter((p) => p.published).map((p) => {
    const cs = DBV.pathItems.filter((i) => i.pathId === p.id).sort((a, b) => a.order - b.order).map((i) => DBV.courses.find((c) => c.id === i.courseId)).filter((c) => c && canSee(c, g));
    return { ...p, courseCount: cs.length, completedCount: cs.filter((c) => u && enr(u.id, c.id)?.completedAt).length, courses: cs.map((c) => ({ ...card(c), ...stats(c), me: u ? state(u.id, c) : null })) };
  }).filter((p) => p.courseCount);
});
on('GET', '/courses/([^/]+)', (m) => {
  const c = C(m[1]); const u = maybeMe();
  if (!canSee(c, granted(u?.id))) throw c.status === 'PUBLISHED' ? E(403, 'restricted', 'این دوره فقط برای مشترکان است') : E(404, 'no_course', 'این دوره پیدا نشد');
  const deps = depState(c.id, u?.id);
  const e = u && enr(u.id, c.id);
  const cert = u && DBV.certificates.find((x) => x.userId === u.id && x.courseId === c.id && !x.revokedAt);
  return {
    ...card(c), about: c.about, outcomes: c.outcomes, passScore: c.passScore, missionRule: c.missionRule, dependencies: deps,
    locked: deps.some((d) => d.kind === 'PREREQUISITE' && !d.done),
    modules: modsOf(c.id).map((md) => ({ id: md.id, title: md.title, lessons: lessonsOf(md.id).map((l) => ({
      id: l.id, title: l.title, type: l.type, durationSec: l.durationSec, required: l.required, isFinalQuiz: l.isFinalQuiz, order: l.order,
      done: !!(u && prog(u.id, l.id)?.completedAt),
      best: u ? (Math.max(-1, ...DBV.attempts.filter((a) => a.userId === u.id && a.lessonId === l.id).map((a) => a.score)) >= 0 ? Math.max(...DBV.attempts.filter((a) => a.userId === u.id && a.lessonId === l.id).map((a) => a.score)) : null) : null,
    })) })),
    me: e ? { ...state(u!.id, c), certificate: cert ? { code: cert.code, issuedAt: cert.issuedAt, score: cert.score } : null } : null,
  };
});
on('POST', '/courses/([^/]+)/enroll', (m) => {
  const u = me(); const c = C(m[1]);
  const missing = depState(c.id, u.id).filter((d) => d.kind === 'PREREQUISITE' && !d.done);
  if (missing.length) throw E(403, 'prerequisite', `اول دورهٔ «${missing[0].course.title}» را تمام کنید`);
  const e = enr(u.id, c.id);
  if (e) e.archivedAt = null; else DBV.enrollments.push({ userId: u.id, courseId: c.id, courseVersion: c.version, enrolledAt: now(), completedAt: null, archivedAt: null, lastLessonId: null });
  for (const d of depState(c.id, u.id).filter((x) => x.kind === 'COREQUISITE')) if (!enr(u.id, d.course.id)) DBV.enrollments.push({ userId: u.id, courseId: d.course.id, courseVersion: 1, enrolledAt: now(), completedAt: null, archivedAt: null, lastLessonId: null });
  return { ok: true };
});
on('POST', '/courses/([^/]+)/archive', (m, b) => { const u = me(); const e = enr(u.id, C(m[1]).id); if (e) e.archivedAt = b.archived ? now() : null; return { ok: true }; });
const lessonCtx = (id: string) => {
  const l = DBV.lessons.find((x) => x.id === id); if (!l) throw E(404, 'no_lesson', 'این درس پیدا نشد');
  const md = DBV.modules.find((x) => x.id === l.moduleId); const c = DBV.courses.find((x) => x.id === md.courseId);
  return { l, c };
};
on('GET', '/lessons/([^/]+)', (m) => {
  const u = me(); const { l, c } = lessonCtx(m[1]); const e = enr(u.id, c.id);
  if (!e) throw E(403, 'not_enrolled', 'اول در دوره ثبت‌نام کنید', { course: { slug: c.slug, title: c.title } });
  e.lastLessonId = l.id;
  const p = prog(u.id, l.id);
  const atts = DBV.attempts.filter((a) => a.userId === u.id && a.lessonId === l.id).sort((a, b) => b.at.localeCompare(a.at));
  return {
    id: l.id, title: l.title, type: l.type, durationSec: l.durationSec, required: l.required, isFinalQuiz: l.isFinalQuiz,
    content: publicContent(l.type, l.content), course: { id: c.id, slug: c.slug, title: c.title, passScore: c.passScore },
    progress: p ? { positionSec: p.positionSec, completedAt: p.completedAt, data: p.data } : null,
    quiz: l.type === 'QUIZ' ? { attempts: atts.map((a) => ({ score: a.score, passed: a.passed, at: a.at })), nextAllowedAt: nextAttemptAt(atts.map((a) => a.at)) } : undefined,
  };
});
on('POST', '/lessons/([^/]+)/progress', (m, b) => {
  const u = me(); const { l, c } = lessonCtx(m[1]);
  if (!enr(u.id, c.id)) throw E(403, 'not_enrolled', 'اول در دوره ثبت‌نام کنید');
  let completed = !!b.completed; let data = b.data;
  if (l.type === 'MISSION' && (completed || data !== undefined)) throw E(400, 'use_mission_submit', 'گزارش مأموریت از بخش مأموریت فرستاده می‌شود');
  let p = prog(u.id, l.id);
  if (!p) { p = { userId: u.id, lessonId: l.id, positionSec: 0, completedAt: null, data: null }; DBV.progress.push(p); }
  if (typeof b.positionSec === 'number') p.positionSec = b.positionSec;
  if (data !== undefined) p.data = data;
  p.updatedAt = now();
  if (completed && !p.completedAt) p.completedAt = now();
  return { ok: true, completion: completed ? checkCompletion(u.id, c.id) : null };
});
on('POST', '/lessons/([^/]+)/quiz', (m, b) => {
  const u = me(); const { l, c } = lessonCtx(m[1]);
  const prev = DBV.attempts.filter((a) => a.userId === u.id && a.lessonId === l.id).sort((a, b) => b.at.localeCompare(a.at)).map((a) => a.at);
  const wait = nextAttemptAt(prev);
  if (wait) throw E(429, 'retry_wait', 'برای تلاش بعدی کمی صبر کنید', { nextAllowedAt: wait });
  const qs = l.content.questions ?? [];
  const results = qs.map((q: Any) => { const g = [...new Set<string>(b.answers?.[q.id] ?? [])].sort(); const w = [...q.correct].sort(); const ok = g.length === w.length && g.every((x, i) => x === w[i]); return { id: q.id, ok, correct: q.correct, explain: q.explain ?? '' }; });
  const score = qs.length ? Math.round(results.filter((r: Any) => r.ok).length / qs.length * 100) : 0;
  const passed = score >= c.passScore;
  DBV.attempts.push({ userId: u.id, lessonId: l.id, score, passed, at: now() });
  let completion = null;
  if (passed) {
    let p = prog(u.id, l.id); if (!p) { p = { userId: u.id, lessonId: l.id, positionSec: 0, completedAt: null, data: null }; DBV.progress.push(p); }
    if (!p.completedAt) p.completedAt = now();
    completion = checkCompletion(u.id, c.id);
    if (l.isFinalQuiz) { const cert = DBV.certificates.find((x) => x.userId === u.id && x.courseId === c.id); if (cert) cert.score = Math.max(cert.score ?? 0, score); }
  }
  return { score, passed, passScore: c.passScore, results, completion, nextAllowedAt: passed ? null : nextAttemptAt([now(), ...prev]) };
});
on('GET', '/me/courses', () => { const u = me(); return DBV.enrollments.filter((e) => e.userId === u.id).map((e) => { const c = DBV.courses.find((x) => x.id === e.courseId); return { ...card(c), ...stats(c), me: state(u.id, c) }; }).sort((a, b) => b.me!.enrolledAt.localeCompare(a.me!.enrolledAt)); });
on('GET', '/me/certificates', () => { const u = me(); return DBV.certificates.filter((x) => x.userId === u.id && !x.revokedAt).map((x) => ({ code: x.code, courseTitle: x.courseTitle, issuedAt: x.issuedAt, score: x.score, courseSlug: DBV.courses.find((c) => c.id === x.courseId)?.slug })); });
on('GET', '/verify/([^/]+)', (m) => { const c = DBV.certificates.find((x) => x.code === decodeURIComponent(m[1]).trim().toUpperCase()); return c ? { valid: !c.revokedAt, revoked: !!c.revokedAt, holderName: c.holderName, courseTitle: c.courseTitle, issuedAt: c.issuedAt, score: c.score, code: c.code } : { valid: false }; });

// ستاد
on('GET', '/admin/stats', () => {
  staff(); const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const by: Any = {}; DBV.courses.forEach((c) => (by[c.status] = (by[c.status] ?? 0) + 1));
  return { users: DBV.users.length, newUsersWeek: DBV.users.filter((u) => u.createdAt > week).length, activeWeek: new Set(DBV.progress.map((p) => p.userId)).size + 3,
    enrollments: DBV.enrollments.length, completions: DBV.enrollments.filter((e) => e.completedAt).length, certificates: DBV.certificates.filter((c) => !c.revokedAt).length, courses: by,
    topCourses: DBV.courses.filter((c) => c.status === 'PUBLISHED').map((c) => ({ id: c.id, title: c.title, n: DBV.enrollments.filter((e) => e.courseId === c.id).length })).sort((a, b) => b.n - a.n).slice(0, 5),
    unverifiedMosques: DBV.mosques.filter((m) => !m.verified).length };
});
on('GET', '/admin/courses', () => { staff(); return [...DBV.courses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => ({ ...c, lessonCount: allLessons(c.id).length, learnerCount: DBV.enrollments.filter((e) => e.courseId === c.id).length, completedCount: DBV.enrollments.filter((e) => e.courseId === c.id && e.completedAt).length })); });
on('POST', '/admin/courses', (_m, b) => {
  staff(); const t = now();
  const c = { id: rid(), slug: 'course-' + rid().slice(0, 5), title: b.title.trim(), subtitle: null, about: null, level: null, instructor: null, color: 'green', icon: 'book-open', status: 'DRAFT', isRestricted: false, passScore: 60, missionRule: 'ON_SUBMIT', hasCertificate: true, outcomes: [], version: 1, publishedAt: null, createdAt: t, updatedAt: t };
  DBV.courses.push(c); DBV.modules.push({ id: rid(), courseId: c.id, title: 'بخش ۱', order: 0 }); audit('course.create', c.id); return c;
});
const fullCourse = (id: string) => { const c = C(id); return { ...c, modules: modsOf(c.id).map((m) => ({ ...m, lessons: lessonsOf(m.id) })), dependencies: DBV.deps.filter((d) => d.courseId === c.id).map((d) => ({ ...d, title: DBV.courses.find((x) => x.id === d.requiresId)?.title })) }; };
on('GET', '/admin/courses/([^/]+)', (m) => { staff(); return fullCourse(m[1]); });
on('PATCH', '/admin/courses/([^/]+)', (m, b) => {
  staff(); const c = C(m[1]); const { bumpVersion, ...rest } = b;
  if (rest.status === 'PUBLISHED') { const p = problems({ ...c, ...rest }); if (p.length) throw E(400, 'not_ready', p[0], { problems: p }); if (c.status !== 'PUBLISHED') c.publishedAt = now(); }
  Object.assign(c, rest); if (bumpVersion) c.version += 1; c.updatedAt = now(); audit('course.update', c.id); return c;
});
on('DELETE', '/admin/courses/([^/]+)', (m) => {
  staff(); const c = C(m[1]);
  if (DBV.enrollments.some((e) => e.courseId === c.id)) throw E(400, 'has_learners', 'این دوره یادگیرنده دارد؛ به‌جای حذف بایگانی‌اش کنید');
  const mids = modsOf(c.id).map((x) => x.id);
  DBV.lessons = DBV.lessons.filter((l) => !mids.includes(l.moduleId)); DBV.modules = DBV.modules.filter((x) => x.courseId !== c.id); DBV.courses = DBV.courses.filter((x) => x.id !== c.id);
  audit('course.delete', c.id); return { ok: true };
});
on('PUT', '/admin/courses/([^/]+)/dependencies', (m, b) => { staff(); const c = C(m[1]); if (b.deps.some((d: Any) => d.requiresId === c.id)) throw E(400, 'self_dep', 'دوره نمی‌تواند پیش‌نیاز خودش باشد'); DBV.deps = DBV.deps.filter((d) => d.courseId !== c.id).concat(b.deps.map((d: Any) => ({ courseId: c.id, ...d }))); return { ok: true }; });
on('POST', '/admin/courses/([^/]+)/modules', (m, b) => { staff(); const c = C(m[1]); const md = { id: rid(), courseId: c.id, title: b.title, order: modsOf(c.id).length }; DBV.modules.push(md); return md; });
on('PUT', '/admin/courses/([^/]+)/order', (_m, b) => { staff(); b.modules.forEach((md: Any, i: number) => { const x = DBV.modules.find((y) => y.id === md.id); if (x) x.order = i; md.lessons.forEach((lid: string, j: number) => { const l = DBV.lessons.find((y) => y.id === lid); if (l) { l.order = j; l.moduleId = md.id; } }); }); return { ok: true }; });
on('PATCH', '/admin/modules/([^/]+)', (m, b) => { staff(); const x = DBV.modules.find((y) => y.id === m[1]); x.title = b.title; return x; });
on('DELETE', '/admin/modules/([^/]+)', (m) => { staff(); if (lessonsOf(m[1]).length) throw E(400, 'module_not_empty', 'اول درس‌های این بخش را جابه‌جا یا حذف کنید'); DBV.modules = DBV.modules.filter((y) => y.id !== m[1]); return { ok: true }; });
on('POST', '/admin/modules/([^/]+)/lessons', (m, b) => {
  staff(); const starter: Any = { VIDEO: { provider: 'aparat', aparatHash: '' }, AUDIO: {}, TEXT: { body: '' }, QUIZ: { questions: [] }, WORKSHEET: { prompt: '', fields: [] }, MISSION: { goal: '', steps: [] }, PRACTICE: { intro: '', steps: [] }, TOOL: {}, LIVE: {} };
  const l = { id: rid(), moduleId: m[1], title: b.title, type: b.type, order: lessonsOf(m[1]).length, durationSec: 0, required: true, isFinalQuiz: false, content: starter[b.type] ?? {} };
  DBV.lessons.push(l); return l;
});
on('PATCH', '/admin/lessons/([^/]+)', (m, b) => { staff(); const l = DBV.lessons.find((y) => y.id === m[1]); if (!l) throw E(404, 'no_lesson', 'درس پیدا نشد'); Object.assign(l, b); audit('lesson.update', l.id); return { ...l, problem: validate(l.type, l.content) }; });
on('DELETE', '/admin/lessons/([^/]+)', (m) => { staff(); DBV.lessons = DBV.lessons.filter((y) => y.id !== m[1]); audit('lesson.delete', m[1]); return { ok: true }; });
on('POST', '/admin/uploads', () => { throw E(400, 'demo', 'در نسخهٔ نمایشی بارگذاری فایل خاموش است'); });
on('GET', '/admin/paths', () => { staff(); return DBV.paths.map((p) => ({ ...p, courses: DBV.pathItems.filter((i) => i.pathId === p.id).sort((a, b) => a.order - b.order).map((i) => { const c = DBV.courses.find((x) => x.id === i.courseId); return { ...i, title: c?.title, status: c?.status }; }) })); });
on('POST', '/admin/paths', (_m, b) => { staff(); const p = { id: rid(), slug: 'path-' + rid().slice(0, 5), title: b.title, description: b.description ?? null, icon: 'route', color: 'green', published: false }; DBV.paths.push(p); audit('path.create', p.id); return p; });
on('PATCH', '/admin/paths/([^/]+)', (m, b) => { staff(); const p = DBV.paths.find((x) => x.id === m[1]); Object.assign(p, b); return p; });
on('PUT', '/admin/paths/([^/]+)/courses', (m, b) => { staff(); DBV.pathItems = DBV.pathItems.filter((i) => i.pathId !== m[1]).concat(b.courseIds.map((c: string, i: number) => ({ pathId: m[1], courseId: c, order: i }))); return { ok: true }; });
on('DELETE', '/admin/paths/([^/]+)', (m) => { staff(); DBV.paths = DBV.paths.filter((p) => p.id !== m[1]); DBV.pathItems = DBV.pathItems.filter((i) => i.pathId !== m[1]); return { ok: true }; });
on('GET', '/admin/users', (_m, _b, q) => {
  staff(); const t = (q.get('q') ?? '').trim();
  const rows = DBV.users.filter((u) => !t || (u.firstName + u.lastName + u.mobile).includes(t)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((u) => {
    const ct = DBV.counties.find((c) => c.id === u.countyId); const pr = ct && DBV.provinces.find((p) => p.id === ct.provinceId);
    return { id: u.id, mobile: u.mobile, firstName: u.firstName, lastName: u.lastName, gender: u.gender, isActive: u.isActive, createdAt: u.createdAt, county: ct?.name ?? null, province: pr?.name ?? null, mosque: DBV.mosques.find((m) => m.id === u.mosqueId)?.name ?? null, nearMosque: u.nearMosque, roles: rolesOf(u.id), courses: DBV.enrollments.filter((e) => e.userId === u.id).length };
  });
  return { total: rows.length, page: 1, rows };
});
on('PATCH', '/admin/users/([^/]+)', (m, b) => { staff(); const u = DBV.users.find((x) => x.id === m[1]); u.isActive = b.isActive; audit(b.isActive ? 'user.activate' : 'user.deactivate', u.id); return { ok: true }; });
on('POST', '/admin/users/([^/]+)/roles', (m, b) => { staff(); if (!DBV.roles.some((r) => r.userId === m[1] && r.role === b.role)) DBV.roles.push({ userId: m[1], role: b.role, networkId: b.networkId ?? null }); audit('role.grant', m[1]); return { ok: true }; });
on('DELETE', '/admin/users/([^/]+)/roles/([^/]+)', (m) => { staff(); DBV.roles = DBV.roles.filter((r) => !(r.userId === m[1] && r.role === m[2])); audit('role.revoke', m[1]); return { ok: true }; });
on('GET', '/admin/grants', () => { staff(); return DBV.grants.map((g) => ({ ...g, courseTitle: DBV.courses.find((c) => c.id === g.courseId)?.title, user: (() => { const u = DBV.users.find((x) => x.id === g.userId); return u ? `${u.firstName} ${u.lastName}` : null; })(), network: DBV.networks.find((n) => n.id === g.networkId)?.name ?? null })); });
on('POST', '/admin/grants', (_m, b) => {
  const actor = staff(); const missing: string[] = []; let created = 0;
  for (const cid of b.courseIds) {
    if (b.networkId) { DBV.grants.push({ id: rid(), courseId: cid, networkId: b.networkId, userId: null, expiresAt: b.expiresAt ?? null, note: b.note ?? null, createdAt: now(), issuedById: actor.id }); created++; }
    for (const mob of b.mobiles ?? []) { const n = normMobile(mob); const u = n && DBV.users.find((x) => x.mobile === n); if (!u) { if (!missing.includes(mob)) missing.push(mob); continue; } DBV.grants.push({ id: rid(), courseId: cid, userId: u.id, networkId: null, expiresAt: b.expiresAt ?? null, note: b.note ?? null, createdAt: now(), issuedById: actor.id }); created++; }
  }
  return { created, missing };
});
on('DELETE', '/admin/grants/([^/]+)', (m) => { staff(); DBV.grants = DBV.grants.filter((g) => g.id !== m[1]); return { ok: true }; });
on('GET', '/admin/networks', () => { staff(); return DBV.networks; });
on('POST', '/admin/networks', (_m, b) => { staff(); const n = { id: rid(), ...b }; DBV.networks.push(n); return n; });
on('GET', '/admin/certificates', (_m, _b, q) => { staff(); const t = (q.get('q') ?? '').trim(); return DBV.certificates.filter((c) => !t || (c.code + c.holderName + c.courseTitle).includes(t)); });
on('POST', '/admin/certificates/([^/]+)/revoke', (m, b) => { staff(); const c = DBV.certificates.find((x) => x.code === m[1]); if (c) c.revokedAt = b.revoke ? now() : null; return { ok: true }; });
on('GET', '/admin/mosques', (_m, _b, q) => { staff(); return DBV.mosques.filter((m) => q.get('unverified') !== '1' || !m.verified).map((m) => { const ct = DBV.counties.find((c) => c.id === m.countyId); return { ...m, county: ct?.name, province: DBV.provinces.find((p) => p.id === ct?.provinceId)?.name, imam: m.imamId ? (() => { const u = DBV.users.find((x) => x.id === m.imamId); return u ? `${u.firstName} ${u.lastName}` : null; })() : null }; }); });
on('POST', '/admin/mosques', (_m, b) => { staff(); const m = { id: rid(), name: b.name, countyId: b.countyId, verified: true, createdAt: now() }; DBV.mosques.unshift(m); return m; });
on('POST', '/admin/mosques/([^/]+)/verify', (m) => { staff(); const x = DBV.mosques.find((y) => y.id === m[1]); if (x) x.verified = true; return { ok: true }; });
on('GET', '/admin/audit', () => { staff(); return DBV.audit.slice(0, 100).map((a) => { const u = DBV.users.find((x) => x.id === a.actorId); return { ...a, actor: u ? `${u.firstName} ${u.lastName}` : '—' }; }); });

/* ═════════════ مرحلهٔ دوم: راهیاری، مأموریت، هسته، برنامه، اعلان ═════════════ */
const LAYER_FA: Record<string, string> = { DEPUTY: 'معاون راهیاری', MANAGER: 'مسئول راهیاری', REGIONAL: 'راهیار منطقه‌ای', PROVINCIAL: 'راهیار استانی', COUNTY: 'راهیار شهرستانی' };
const PARENT: Record<string, string | null> = { DEPUTY: null, MANAGER: 'DEPUTY', REGIONAL: 'MANAGER', PROVINCIAL: 'REGIONAL', COUNTY: 'PROVINCIAL' };
const U = (id: string) => DBV.users.find((x) => x.id === id);
const nm = (id: string) => { const u = U(id); return u ? `${u.firstName} ${u.lastName}` : '—'; };
const provOf = (countyId: string | null) => DBV.counties.find((c) => c.id === countyId)?.provinceId ?? null;
const pos = (id: string | null) => DBV.positions.find((p: Any) => p.id === id);
const notify = (ids: string[] | string, n: { kind: string; title: string; body?: string; link?: string }) => {
  for (const userId of [...new Set(Array.isArray(ids) ? ids : [ids])].filter(Boolean)) DBV.notifs.unshift({ id: rid(), userId, ...n, body: n.body ?? null, link: n.link ?? null, readAt: null, createdAt: now() });
};
const grantRole = (userId: string, role: string, networkId: string | null = null) => { if (!DBV.roles.some((r) => r.userId === userId && r.role === role && (r.networkId ?? null) === networkId)) DBV.roles.push({ userId, role, networkId }); };

/** زنجیرهٔ مسئولیت: سپرده‌شده ← تنها راهیار شهرستان ← استانی ← منطقه‌ای ← ... بالا تا اولین جایگاه پر */
function resolve(u: Any) {
  const ps = DBV.positions.filter((p: Any) => p.gender === u.gender);
  let start: Any;
  const a = DBV.assigns.find((x: Any) => x.userId === u.id);
  if (a) start = pos(a.positionId);
  if (!start) { const cs = ps.filter((p: Any) => p.layer === 'COUNTY' && p.countyId === u.countyId); if (cs.length === 1) start = cs[0]; }
  if (!start) start = ps.find((p: Any) => p.layer === 'PROVINCIAL' && p.provinceId === provOf(u.countyId));
  if (!start) { const rp = DBV.regionProv.find((r: Any) => r.provinceId === provOf(u.countyId) && pos(r.regionId)?.gender === u.gender); if (rp) start = pos(rp.regionId); }
  if (!start) start = ps.find((p: Any) => p.layer === 'DEPUTY');
  const chain: Any[] = [];
  for (let p = start; p; p = pos(p.parentId)) chain.push(p);
  const responsible = chain.find((p) => p.holderId) ?? null;
  const above = responsible ? chain.slice(chain.indexOf(responsible) + 1).find((p) => p.holderId) ?? null : null;
  return { chain, responsible, above };
}
const held = (uid: string) => DBV.positions.filter((p: Any) => p.holderId === uid);
function scope(uid: string) {
  const mine = new Set(held(uid).map((p: Any) => p.id));
  if (!mine.size) return [];
  return DBV.users.filter((u) => u.id !== uid && u.gender).map((u) => ({ u, r: resolve(u) })).filter(({ r }) => r.chain.some((p) => mine.has(p.id)))
    .map(({ u, r }) => ({ ...u, responsible: r.responsible, direct: !!r.responsible && mine.has(r.responsible.id) }));
}
const canSeeL = (viewer: string, learner: string) => { const r = rolesOf(viewer); if (r.includes('HQ_ADMIN') || r.includes('HQ_OPERATOR')) return true; const mine = new Set(held(viewer).map((p: Any) => p.id)); const u = U(learner); return !!u && resolve(u).chain.some((p) => mine.has(p.id)); };
const needRahyar = () => { const u = me(); if (!held(u.id).length && !rolesOf(u.id).includes('HQ_ADMIN')) throw E(403, 'not_rahyar', 'جایگاه راهیاری ندارید'); return u; };
const manager = (g: string) => { const u = me(); if (rolesOf(u.id).includes('HQ_ADMIN')) return u; if (!DBV.positions.some((p: Any) => p.layer === 'DEPUTY' && p.gender === g && p.holderId === u.id)) throw E(403, 'forbidden', 'فقط معاون راهیاری همین درخت یا مدیر ستاد'); return u; };

on('GET', '/rahyar/tree', (_m, _b, q) => {
  const u = me(); if (!rolesOf(u.id).some((r) => r.startsWith('HQ'))) needRahyar();
  const g = q.get('gender') === 'FEMALE' ? 'FEMALE' : 'MALE';
  const load = new Map<string, number>();
  DBV.users.filter((x) => x.gender === g).forEach((x) => { const r = resolve(x).responsible; if (r) load.set(r.id, (load.get(r.id) ?? 0) + 1); });
  const admin = rolesOf(u.id).includes('HQ_ADMIN');
  return DBV.positions.filter((p: Any) => p.gender === g).map((p: Any) => { const h = U(p.holderId);
    return { ...p, holder: h ? { id: h.id, firstName: h.firstName, lastName: h.lastName, mobile: admin ? h.mobile : null } : null, province: DBV.provinces.find((x) => x.id === p.provinceId)?.name ?? null, county: DBV.counties.find((x) => x.id === p.countyId)?.name ?? null,
      regionProvinces: DBV.regionProv.filter((r: Any) => r.regionId === p.id).map((r: Any) => ({ id: r.provinceId, name: DBV.provinces.find((x) => x.id === r.provinceId)?.name })), learnerCount: load.get(p.id) ?? 0 }; });
});
on('POST', '/rahyar/positions', (_m, b) => {
  manager(b.gender);
  const need = PARENT[b.layer]; const parent = pos(b.parentId);
  if (need && (!parent || parent.layer !== need || parent.gender !== b.gender)) throw E(400, 'bad_parent', `جایگاه بالادست باید «${LAYER_FA[need]}» باشد`);
  if (!need && DBV.positions.some((p: Any) => p.layer === 'DEPUTY' && p.gender === b.gender)) throw E(400, 'deputy_exists', 'هر درخت فقط یک معاون دارد');
  if (b.layer === 'PROVINCIAL' && !b.provinceId) throw E(400, 'need_province', 'استان را انتخاب کنید');
  if (b.layer === 'COUNTY' && !b.countyId) throw E(400, 'need_county', 'شهرستان را انتخاب کنید');
  const place = b.layer === 'PROVINCIAL' ? DBV.provinces.find((x) => x.id === b.provinceId)?.name : b.layer === 'COUNTY' ? DBV.counties.find((x) => x.id === b.countyId)?.name : '';
  const p = { id: rid(), gender: b.gender, layer: b.layer, title: b.title?.trim() || `${LAYER_FA[b.layer]}${place ? ' ' + place : ''}`, parentId: parent?.id ?? null, provinceId: b.layer === 'PROVINCIAL' ? b.provinceId : null, countyId: b.layer === 'COUNTY' ? b.countyId : null, holderId: null };
  DBV.positions.push(p); return p;
});
on('PATCH', '/rahyar/positions/([^/]+)', (m, b) => {
  const p = pos(m[1]); if (!p) throw E(404, 'no_position', 'جایگاه پیدا نشد'); manager(p.gender);
  if (b.title) p.title = b.title.trim();
  if (b.holderMobile !== undefined) {
    if (!b.holderMobile) p.holderId = null;
    else { const n = normMobile(b.holderMobile); const u = n && DBV.users.find((x) => x.mobile === n); if (!u) throw E(400, 'no_user', 'کسی با این شماره ثبت‌نام نکرده'); if (u.gender && u.gender !== p.gender) throw E(400, 'gender', p.gender === 'MALE' ? 'این جایگاه در درخت برادران است' : 'این جایگاه در درخت بانور است'); p.holderId = u.id; grantRole(u.id, 'RAHYAR'); }
  }
  return p;
});
on('DELETE', '/rahyar/positions/([^/]+)', (m) => { const p = pos(m[1]); if (!p) return { ok: true }; manager(p.gender); if (DBV.positions.some((x: Any) => x.parentId === p.id)) throw E(400, 'has_children', 'اول جایگاه‌های زیرمجموعه را حذف کنید'); DBV.positions = DBV.positions.filter((x: Any) => x.id !== p.id); return { ok: true }; });
on('PUT', '/rahyar/positions/([^/]+)/provinces', (m, b) => {
  const p = pos(m[1]); if (p?.layer !== 'REGIONAL') throw E(400, 'not_region', 'استان‌ها فقط به منطقه داده می‌شوند'); manager(p.gender);
  if (DBV.regionProv.some((r: Any) => r.regionId !== p.id && pos(r.regionId)?.gender === p.gender && b.provinceIds.includes(r.provinceId))) throw E(400, 'province_taken', 'بعضی استان‌ها در منطقهٔ دیگری‌اند');
  DBV.regionProv = DBV.regionProv.filter((r: Any) => r.regionId !== p.id).concat(b.provinceIds.map((provinceId: string) => ({ regionId: p.id, provinceId })));
  DBV.positions.filter((x: Any) => x.layer === 'PROVINCIAL' && x.gender === p.gender && b.provinceIds.includes(x.provinceId)).forEach((x: Any) => (x.parentId = p.id));
  return { ok: true };
});
on('GET', '/rahyar/unassigned', () => {
  const u = me(); const out: Any[] = [];
  for (const pp of held(u.id).filter((p: Any) => p.layer === 'PROVINCIAL')) {
    const cp = DBV.positions.filter((p: Any) => p.layer === 'COUNTY' && p.parentId === pp.id);
    const multi = [...new Set(cp.map((p: Any) => p.countyId))].filter((c) => cp.filter((p: Any) => p.countyId === c).length > 1);
    DBV.users.filter((x) => x.gender === pp.gender && multi.includes(x.countyId) && !DBV.assigns.some((a: Any) => a.userId === x.id))
      .forEach((x) => out.push({ id: x.id, firstName: x.firstName, lastName: x.lastName, options: cp.filter((p: Any) => p.countyId === x.countyId).map((p: Any) => ({ id: p.id, title: p.title })) }));
  }
  return out;
});
on('PUT', '/rahyar/assignments', (_m, b) => { const u = me(); for (const id of b.userIds) { DBV.assigns = DBV.assigns.filter((a: Any) => a.userId !== id); DBV.assigns.push({ userId: id, positionId: b.positionId, assignedById: u.id }); } return { ok: true }; });

const activity = (id: string) => ({ last: DBV.progress.filter((p) => p.userId === id).map((p) => p.updatedAt ?? p.completedAt).filter(Boolean).sort().pop() ?? null,
  active: DBV.enrollments.filter((e) => e.userId === id && !e.completedAt && !e.archivedAt).length, done: DBV.enrollments.filter((e) => e.userId === id && e.completedAt).length,
  attended: DBV.regs.filter((r: Any) => r.userId === id && r.attendedAt).length });

on('GET', '/rahyar/me', () => { const u = needRahyar(); const s = scope(u.id); const q = queue(u.id, 'open');
  return { positions: held(u.id).map((p: Any) => ({ id: p.id, title: p.title, layer: p.layer, layerName: LAYER_FA[p.layer], gender: p.gender })), learnerCount: s.length, directCount: s.filter((x) => x.direct).length, openReports: q.length, overdue: q.filter((x) => x.overdue).length }; });
on('GET', '/rahyar/learners', (_m, _b, q) => { const u = needRahyar(); const t = (q.get('q') ?? '').trim();
  return scope(u.id).filter((l) => !t || (l.firstName + ' ' + l.lastName).includes(t)).map((l) => { const a = activity(l.id);
    return { id: l.id, name: `${l.firstName} ${l.lastName}`, county: DBV.counties.find((c) => c.id === l.countyId)?.name ?? null, mosque: DBV.mosques.find((m) => m.id === l.mosqueId)?.name ?? l.nearMosque, responsible: l.responsible?.title ?? null, direct: l.direct, lastActivity: a.last, activeCourses: a.active, completedCourses: a.done, allowMessages: l.allowRahyarMessages !== false }; }); });
on('GET', '/rahyar/learners-recent', () => { const u = me(); return scope(u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, createdAt: l.createdAt })); });
on('GET', '/rahyar/learners/([^/]+)', (m) => { const u = me(); if (!canSeeL(u.id, m[1])) throw E(403, 'forbidden', 'این کنشگر در دامنهٔ شما نیست'); const l = U(m[1]);
  const courses = DBV.enrollments.filter((e) => e.userId === l.id).map((e) => { const c = DBV.courses.find((x) => x.id === e.courseId); return { ...card(c), ...stats(c), me: state(l.id, c) }; });
  return { id: l.id, firstName: l.firstName, lastName: l.lastName, nearMosque: l.nearMosque, createdAt: l.createdAt, allowRahyarMessages: l.allowRahyarMessages !== false, courses, missions: queue(u.id, 'all').filter((x) => x.learnerId === l.id), attended: activity(l.id).attended }; });

// ── مأموریت
const missionCtx = (uid: string, lid: string) => { const { l, c } = lessonCtx(lid); if (l.type !== 'MISSION') throw E(404, 'no_mission', 'مأموریت پیدا نشد'); return { l, c, p: prog(uid, lid) }; };
function queue(rid_: string, filter: string) {
  const s = scope(rid_); const t = Date.now();
  return DBV.progress.filter((p) => p.data?.status && s.some((x) => x.id === p.userId)).map((p) => {
    const { l, c } = lessonCtx(p.lessonId); const x = s.find((y) => y.id === p.userId)!; const d = p.data;
    const waiting = ['submitted', 'pending'].includes(d.status) && !d.reviewedAt ? Math.floor((t - new Date(d.submittedAt).getTime()) / 86400_000) : 0;
    return { learnerId: p.userId, lessonId: p.lessonId, learner: `${x.firstName} ${x.lastName}`, lessonTitle: l.title, courseTitle: c.title, status: d.status, submittedAt: d.submittedAt, reviewed: !!d.reviewedAt, waitingDays: waiting, direct: x.direct, responsible: x.responsible?.title ?? null, overdue: waiting >= 7, hasPhoto: !!d.mainPhoto };
  }).filter((r) => filter === 'all' || ((r.status === 'pending' || (r.status === 'submitted' && !r.reviewed)) && (r.direct || r.overdue))).sort((a, b) => b.waitingDays - a.waitingDays);
}
const thread = (viewer: string, uid: string, lid: string) => {
  if (viewer !== uid && !canSeeL(viewer, uid)) throw E(403, 'forbidden', 'این گزارش برای شما نیست');
  const { l, c, p } = missionCtx(uid, lid); const lu = U(uid);
  return { lesson: { id: l.id, title: l.title, goal: l.content?.goal }, course: { id: c.id, title: c.title, missionRule: c.missionRule }, learner: { id: lu.id, firstName: lu.firstName, lastName: lu.lastName }, data: p?.data ?? null,
    messages: DBV.mmsgs.filter((x: Any) => x.learnerId === uid && x.lessonId === lid).map((x: Any) => { const a = U(x.authorId); return { ...x, firstName: a?.firstName, lastName: a?.lastName }; }) };
};
on('GET', '/missions/([^/]+)', (m) => thread(me().id, me().id, m[1]));
on('POST', '/missions/([^/]+)/submit', (m, b) => {
  const u = me(); const { l, c, p: p0 } = missionCtx(u.id, m[1]);
  if (!enr(u.id, c.id)) throw E(403, 'not_enrolled', 'اول در دوره ثبت‌نام کنید');
  const prev = p0?.data ?? {};
  if (prev.status && prev.status !== 'needs_revision') throw E(400, 'already_sent', 'این گزارش فرستاده شده است');
  if (!b.did || b.did.trim().length < 10) throw E(400, 'short', 'کمی بیشتر بنویسید چه کردید');
  const status = c.missionRule === 'ON_SUBMIT' ? 'submitted' : 'pending';
  let p = p0; if (!p) { p = { userId: u.id, lessonId: l.id, positionSec: 0, completedAt: null, data: null }; DBV.progress.push(p); }
  p.data = { ...prev, ...b, status, submittedAt: now(), round: (prev.round ?? 0) + 1, reviewedAt: null }; p.updatedAt = now();
  if (status === 'submitted' && !p.completedAt) p.completedAt = now();
  DBV.mmsgs.push({ id: rid(), learnerId: u.id, lessonId: l.id, authorId: u.id, kind: 'REPORT', body: `چه کردم: ${b.did.trim()}${b.learned?.trim() ? `\nچه یاد گرفتم: ${b.learned.trim()}` : ''}`, createdAt: now() });
  const r = resolve(u).responsible; if (r?.holderId) notify(r.holderId, { kind: 'mission_report', title: `گزارش تازهٔ ${u.firstName} ${u.lastName}`, body: l.title, link: `/rahyar/reports/${u.id}/${l.id}` });
  return { status, completed: status === 'submitted', courseId: c.id, completion: status === 'submitted' ? checkCompletion(u.id, c.id) : null };
});
const reply = (viewerId: string, uid: string, lid: string, kind: string, body: string) => {
  const learner = viewerId === uid;
  if (!learner && !canSeeL(viewerId, uid)) throw E(403, 'forbidden', 'این کنشگر در دامنهٔ شما نیست');
  if (!body?.trim() && kind !== 'APPROVE') throw E(400, 'empty', 'متن را بنویسید');
  const { l, c, p } = missionCtx(uid, lid); if (!p?.data?.status) throw E(400, 'not_sent', 'هنوز گزارشی فرستاده نشده');
  if (kind === 'REVISE') p.data.status = 'needs_revision';
  if (kind === 'APPROVE') { p.data.status = 'approved'; if (!p.completedAt) p.completedAt = now(); checkCompletion(uid, c.id); }
  if (!learner) p.data.reviewedAt = now();
  DBV.mmsgs.push({ id: rid(), learnerId: uid, lessonId: lid, authorId: viewerId, kind, body: body?.trim() || 'گزارش تأیید شد.', createdAt: now() });
  if (learner) { const r = resolve(U(uid)).responsible; if (r?.holderId) notify(r.holderId, { kind: 'mission_reply', title: 'پاسخ کنشگر به بازخورد', body: l.title, link: `/rahyar/reports/${uid}/${lid}` }); }
  else notify(uid, { kind: 'mission_feedback', title: kind === 'REVISE' ? 'راهیارتان گزارش را برای اصلاح برگرداند' : kind === 'APPROVE' ? 'گزارش مأموریتتان تأیید شد' : 'راهیارتان به گزارش مأموریت پاسخ داد', body: l.title, link: `/lessons/${lid}` });
  return { ok: true, status: p.data.status };
};
on('POST', '/missions/([^/]+)/reply', (m, b) => reply(me().id, me().id, m[1], 'REPLY', b.body));
on('GET', '/rahyar/reports', (_m, _b, q) => queue(needRahyar().id, q.get('filter') === 'all' ? 'all' : 'open'));
on('GET', '/rahyar/reports/([^/]+)/([^/]+)', (m) => thread(me().id, m[1], m[2]));
on('POST', '/rahyar/reports/([^/]+)/([^/]+)', (m, b) => reply(me().id, m[1], m[2], b.kind, b.body));
on('POST', '/uploads/mission', () => ({ key: 'demo-' + rid() }));

// ── پیام مستقیم
const dmList = (lid: string) => DBV.dms.filter((d: Any) => d.learnerId === lid).map((d: Any) => { const a = U(d.authorId); return { id: d.id, body: d.body, createdAt: d.createdAt, authorId: d.authorId, firstName: a?.firstName, lastName: a?.lastName }; });
on('GET', '/me/rahyar', () => { const u = me(); const r = resolve(u).responsible; return r?.holderId ? { rahyar: { name: nm(r.holderId), title: r.title, layer: LAYER_FA[r.layer] }, allowRahyarMessages: u.allowRahyarMessages !== false } : { rahyar: null }; });
on('PATCH', '/me/prefs', (_m, b) => { me().allowRahyarMessages = !!b.allowRahyarMessages; return { ok: true }; });
on('GET', '/messages', () => { const u = me(); DBV.dms.filter((d: Any) => d.learnerId === u.id).forEach((d: Any) => (d.readByLearnerAt ??= now())); return dmList(u.id); });
on('POST', '/messages', (_m, b) => { const u = me(); const r = resolve(u).responsible; if (!r?.holderId) throw E(400, 'no_rahyar', 'هنوز راهیاری برایتان تعیین نشده'); DBV.dms.push({ id: rid(), learnerId: u.id, authorId: u.id, body: b.body.trim(), createdAt: now(), readByLearnerAt: now(), readByRahyarAt: null }); notify(r.holderId, { kind: 'dm', title: 'پیام تازه از یک کنشگر', link: `/rahyar/messages/${u.id}` }); return { ok: true }; });
on('GET', '/rahyar/messages', () => { const u = needRahyar(); const s = scope(u.id);
  return s.map((l) => { const ms = DBV.dms.filter((d: Any) => d.learnerId === l.id); const last = ms[ms.length - 1]; return last && { learnerId: l.id, name: `${l.firstName} ${l.lastName}`, last: last.body, at: last.createdAt, unread: ms.filter((d: Any) => d.authorId === l.id && !d.readByRahyarAt).length }; }).filter(Boolean).sort((a: Any, b: Any) => b.at.localeCompare(a.at)); });
on('GET', '/rahyar/messages/([^/]+)', (m) => { const u = me(); if (!canSeeL(u.id, m[1])) throw E(403, 'forbidden', 'این کنشگر در دامنهٔ شما نیست'); DBV.dms.filter((d: Any) => d.learnerId === m[1]).forEach((d: Any) => (d.readByRahyarAt ??= now())); const l = U(m[1]); return { learner: { id: l.id, name: nm(l.id), allowMessages: l.allowRahyarMessages !== false }, messages: dmList(l.id) }; });
on('POST', '/rahyar/messages/([^/]+)', (m, b) => { const u = me(); if (!canSeeL(u.id, m[1])) throw E(403, 'forbidden', 'این کنشگر در دامنهٔ شما نیست'); if (U(m[1]).allowRahyarMessages === false) throw E(403, 'dm_off', 'این کنشگر پیام راهیار را خاموش کرده'); DBV.dms.push({ id: rid(), learnerId: m[1], authorId: u.id, body: b.body.trim(), createdAt: now(), readByRahyarAt: now(), readByLearnerAt: null }); notify(m[1], { kind: 'dm', title: 'پیام تازه از راهیارتان', link: '/messages' }); return { ok: true }; });

// ── اعلان
on('GET', '/notifications', () => DBV.notifs.filter((n: Any) => n.userId === me().id).slice(0, 100));
on('GET', '/notifications/unread', () => ({ count: DBV.notifs.filter((n: Any) => n.userId === maybeMe()?.id && !n.readAt).length }));
on('POST', '/notifications/read', (_m, b) => { const u = me(); DBV.notifs.filter((n: Any) => n.userId === u.id && (!b.ids || b.ids.includes(n.id))).forEach((n: Any) => (n.readAt ??= now())); return { ok: true }; });

// ── هسته، امام، سازمان
const coreMembersOf = (cid: string) => DBV.coreMembers.filter((x: Any) => x.coreId === cid).map((x: Any) => x.userId);
const memberRow = (id: string) => { const a = activity(id); return { id, name: nm(id), active: a.active, done: a.done, attended: a.attended, last: a.last }; };
const icode = (p: string) => p + Math.random().toString(36).slice(2, 9);
const coreAccess = (u: Any, c: Any) => { const r = rolesOf(u.id); const mq = DBV.mosques.find((m) => m.id === c.mosqueId);
  const canManage = c.leaderId === u.id || mq?.imamId === u.id || r.includes('HQ_ADMIN') || (!!c.leaderId && held(u.id).length > 0 && canSeeL(u.id, c.leaderId));
  return { canManage, member: coreMembersOf(c.id).includes(u.id), mq }; };
on('GET', '/cores/mine', () => { const u = me(); const ids = new Set([...DBV.coreMembers.filter((x: Any) => x.userId === u.id).map((x: Any) => x.coreId), ...DBV.cores.filter((c: Any) => c.leaderId === u.id).map((c: Any) => c.id)]);
  return { cores: DBV.cores.filter((c: Any) => ids.has(c.id)).map((c: Any) => { const n = DBV.networks.find((x) => x.id === c.networkId); return { id: c.id, name: c.name, leaderId: c.leaderId, networkKind: n?.kind, networkName: n?.name, mosqueId: c.mosqueId, isLeader: c.leaderId === u.id, memberCount: coreMembersOf(c.id).length }; }),
    imamOf: DBV.mosques.filter((m) => m.imamId === u.id).map((m) => ({ id: m.id, name: m.name })) }; });
on('POST', '/cores', (_m, b) => { const u = me(); let kind = 'BANOUR', mosqueId = null;
  if (b.mosqueId) { const mq = DBV.mosques.find((m) => m.id === b.mosqueId); if (!mq || mq.imamId !== u.id) throw E(403, 'not_imam', 'فقط امام همین مسجد'); kind = 'BROTHERS'; mosqueId = mq.id; }
  else if (u.gender !== 'FEMALE') throw E(403, 'not_allowed', 'در شبکهٔ برادران هسته را امام محله می‌سازد');
  const c = { id: rid(), name: b.name.trim(), networkId: DBV.networks.find((n) => n.kind === kind)?.id, mosqueId, leaderId: mosqueId ? null : u.id, inviteCode: icode('h') };
  DBV.cores.push(c); if (!mosqueId) DBV.coreMembers.push({ coreId: c.id, userId: u.id }); return c; });
on('GET', '/cores/([^/]+)', (m) => { const u = me(); const c = DBV.cores.find((x: Any) => x.id === m[1]); if (!c) throw E(404, 'no_core', 'هسته پیدا نشد'); const a = coreAccess(u, c);
  if (!a.member && !a.canManage) throw E(403, 'forbidden', 'عضو این هسته نیستید'); const n = DBV.networks.find((x) => x.id === c.networkId); const rows = coreMembersOf(c.id).map(memberRow);
  return { id: c.id, name: c.name, network: n?.name, networkKind: n?.kind, mosque: a.mq?.name ?? null, leader: c.leaderId ? { id: c.leaderId, name: nm(c.leaderId) } : null, canManage: a.canManage, inviteCode: a.canManage ? c.inviteCode : null, members: a.canManage ? rows : rows.map((r: Any) => ({ id: r.id, name: r.name })) }; });
on('PATCH', '/cores/([^/]+)', (m, b) => { const u = me(); const c = DBV.cores.find((x: Any) => x.id === m[1]); if (!coreAccess(u, c).canManage) throw E(403, 'forbidden', 'فقط مسئول هسته'); if (b.name) c.name = b.name; if (b.leaderId !== undefined) { c.leaderId = b.leaderId || null; if (b.leaderId) notify(b.leaderId, { kind: 'core_leader', title: `مسئول هستهٔ «${c.name}» شدید`, link: `/cores/${c.id}` }); } return c; });
on('POST', '/cores/([^/]+)/invite', (m) => { const c = DBV.cores.find((x: Any) => x.id === m[1]); c.inviteCode = icode('h'); return { inviteCode: c.inviteCode }; });
on('DELETE', '/cores/([^/]+)/members/([^/]+)', (m) => { DBV.coreMembers = DBV.coreMembers.filter((x: Any) => !(x.coreId === m[1] && x.userId === m[2])); const c = DBV.cores.find((x: Any) => x.id === m[1]); if (c?.leaderId === m[2]) c.leaderId = null; return { ok: true }; });
on('POST', '/join', (_m, b) => { const u = me(); const code = String(b.code).trim().toLowerCase();
  const c = DBV.cores.find((x: Any) => x.inviteCode === code); if (c) { if (!coreMembersOf(c.id).includes(u.id)) DBV.coreMembers.push({ coreId: c.id, userId: u.id }); if (c.leaderId) notify(c.leaderId, { kind: 'core_join', title: `عضو تازه در هستهٔ «${c.name}»`, link: `/cores/${c.id}` }); return { joined: 'core', id: c.id, name: c.name }; }
  const mq = DBV.mosques.find((x) => x.inviteCode === code); if (mq) { u.mosqueId = mq.id; u.nearMosque = null; return { joined: 'mosque', id: mq.id, name: mq.name }; }
  throw E(404, 'bad_code', 'این کد دعوت پیدا نشد یا عوض شده است'); });
on('GET', '/imam', () => { const u = me(); const ms = DBV.mosques.filter((m) => m.imamId === u.id); if (!ms.length) throw E(403, 'not_imam', 'به‌عنوان امام محله برای مسجدی ثبت نشده‌اید');
  return ms.map((mq) => { mq.inviteCode ??= icode('m'); const cs = DBV.cores.filter((c: Any) => c.mosqueId === mq.id); const inCore = new Set(cs.flatMap((c: Any) => coreMembersOf(c.id)));
    const free = DBV.users.filter((x) => x.mosqueId === mq.id && !inCore.has(x.id) && x.id !== u.id).map((x) => memberRow(x.id)); const all = [...free, ...[...inCore].map(memberRow)];
    return { id: mq.id, name: mq.name, inviteCode: mq.inviteCode, cores: cs.map((c: Any) => ({ id: c.id, name: c.name, inviteCode: c.inviteCode, leader: c.leaderId ? nm(c.leaderId) : null, members: coreMembersOf(c.id).map(memberRow) })), free,
      totals: { members: all.length, active: all.filter((r) => r.active > 0).length, completed: all.reduce((s, r) => s + r.done, 0) } }; }); });
on('POST', '/admin/mosques/([^/]+)/imam', (m, b) => { staff(); const mq = DBV.mosques.find((x) => x.id === m[1]); if (!b.mobile) { mq.imamId = null; return { ok: true }; } const n = normMobile(b.mobile); const u = n && DBV.users.find((x) => x.mobile === n); if (!u) throw E(400, 'no_user', 'کسی با این شماره ثبت‌نام نکرده'); mq.imamId = u.id; grantRole(u.id, 'IMAM'); notify(u.id, { kind: 'imam', title: 'به‌عنوان امام محله ثبت شدید', link: '/imam' }); return { ok: true }; });
on('GET', '/org', () => { const u = me(); const ids = DBV.roles.filter((r) => r.userId === u.id && r.role === 'ORG_ADMIN').map((r) => r.networkId); return DBV.networks.filter((n) => ids.includes(n.id)); });
const orgGuard = (id: string) => { const u = me(); if (!rolesOf(u.id).includes('HQ_ADMIN') && !DBV.roles.some((r) => r.userId === u.id && r.role === 'ORG_ADMIN' && r.networkId === id)) throw E(403, 'forbidden', 'مدیر این سازمان نیستید'); };
on('GET', '/org/([^/]+)', (m) => { orgGuard(m[1]); const n = DBV.networks.find((x) => x.id === m[1]); const cids = [...new Set(DBV.grants.filter((g) => g.networkId === n.id).map((g) => g.courseId))];
  return { id: n.id, name: n.name, underRahyar: n.underRahyar, courses: cids.map((id) => ({ id, title: DBV.courses.find((c) => c.id === id)?.title })),
    members: DBV.netMembers.filter((x: Any) => x.networkId === n.id && x.acceptedAt !== null).map((x: Any) => ({ id: x.userId, name: nm(x.userId), courses: cids.map((cid) => { const e = enr(x.userId, cid); return { courseId: cid, state: e ? (e.completedAt ? 'done' : 'active') : 'none' }; }) })) }; });
on('POST', '/org/([^/]+)/members', (m, b) => { orgGuard(m[1]); const missing: string[] = []; let added = 0;
  for (const mob of b.mobiles) { const n = normMobile(mob); const u = n && DBV.users.find((x) => x.mobile === n); if (!u) { missing.push(mob); continue; } if (!DBV.netMembers.some((x: Any) => x.networkId === m[1] && x.userId === u.id)) { DBV.netMembers.push({ networkId: m[1], userId: u.id }); } added++; }
  return { added, missing }; });
on('DELETE', '/org/([^/]+)/members/([^/]+)', (m) => { orgGuard(m[1]); DBV.netMembers = DBV.netMembers.filter((x: Any) => !(x.networkId === m[1] && x.userId === m[2])); return { ok: true }; });
on('POST', '/admin/networks/([^/]+)/admin', (m, b) => { staff(); const n = normMobile(b.mobile); const u = n && DBV.users.find((x) => x.mobile === n); if (!u) throw E(400, 'no_user', 'کسی با این شماره ثبت‌نام نکرده'); grantRole(u.id, 'ORG_ADMIN', m[1]); return { ok: true }; });

// ── برنامه‌ها
const ACTIVE = ['REGISTERED', 'WAITLIST', 'PENDING'];
const ev = (id: string) => { const e = DBV.events.find((x: Any) => x.id === id); if (!e) throw E(404, 'no_event', 'برنامه پیدا نشد'); return e; };
const regOf = (eid: string, uid: string) => DBV.regs.find((r: Any) => r.eventId === eid && r.userId === uid);
const cnt = (eid: string) => { const rs = DBV.regs.filter((r: Any) => r.eventId === eid); return { registered: rs.filter((r: Any) => r.status === 'REGISTERED').length, waitlist: rs.filter((r: Any) => r.status === 'WAITLIST').length, pending: rs.filter((r: Any) => r.status === 'PENDING').length, attended: rs.filter((r: Any) => r.attendedAt).length }; };
const isHQ = (uid: string) => rolesOf(uid).some((r) => r === 'HQ_ADMIN' || r === 'HQ_OPERATOR');
const audienceBlock = (e: Any, u: Any) => HOOK.eventScopeBlock(e, u) ?? (e.audienceGender && u.gender !== e.audienceGender ? 'این برنامه برای ' + (e.audienceGender === 'FEMALE' ? 'خواهران' : 'برادران') + ' است'
  : e.audienceCountyId && u.countyId !== e.audienceCountyId ? 'این برنامه برای شهرستان دیگری است' : e.audienceProvinceId && provOf(u.countyId) !== e.audienceProvinceId ? 'این برنامه برای استان دیگری است' : null);
const pubEv = (e: Any, mine: Any, full = false) => { const c = cnt(e.id); const out: Any = { id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location, hostName: e.hostName, capacity: e.capacity, seatsLeft: e.capacity == null ? null : Math.max(0, e.capacity - c.registered), waitlist: e.waitlist, requiresApproval: e.requiresApproval, registrationDeadline: e.registrationDeadline, audienceGender: e.audienceGender, status: e.status, cancelReason: e.cancelReason, courseId: null, registered: c.registered, feeNote: e.feeNote ?? null, scoped: e.audienceNetworkId ? 'ORG' : e.audienceMosqueId ? 'MOSQUE' : e.audienceCoreId ? 'CORE' : null,
  my: mine ? (['CANCELLED', 'REJECTED'].includes(mine.status) ? { status: mine.status } : { status: mine.status, checkInCode: mine.status === 'REGISTERED' ? mine.code : null, attendedAt: mine.attendedAt, feedback: mine.feedback }) : null };
  if (full) Object.assign(out, { description: e.description, agenda: e.agenda, bring: e.bring, mapUrl: e.mapUrl, onlineUrl: mine?.status === 'REGISTERED' && Date.now() > new Date(e.startsAt).getTime() - 3600_000 ? e.onlineUrl : null, onlineSoon: e.kind === 'ONLINE' && !!e.onlineUrl });
  return out; };
const tcode = () => Array.from({ length: 6 }, () => CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)]).join('');
const promote = (e: Any) => { if (e.capacity == null) return; let free = e.capacity - cnt(e.id).registered;
  for (const w of DBV.regs.filter((r: Any) => r.eventId === e.id && r.status === 'WAITLIST')) { if (free-- <= 0) break; w.status = 'REGISTERED'; notify(w.userId, { kind: 'event_promoted', title: `جا باز شد: «${e.title}»`, body: 'از فهرست انتظار به ثبت‌نام قطعی رسیدید.', link: `/events/${e.id}` }); } };
const registerOne = (e: Any, uid: string, by: string | null) => { const prev = regOf(e.id, uid); if (prev && ACTIVE.includes(prev.status)) return prev; if (prev?.status === 'REJECTED') throw E(400, 'rejected', 'برگزارکننده درخواست را نپذیرفته است');
  const full = e.capacity != null && cnt(e.id).registered >= e.capacity; if (full && !e.waitlist) throw E(400, 'full', 'ظرفیت پر شده است');
  const r = { eventId: e.id, userId: uid, status: e.requiresApproval ? 'PENDING' : full ? 'WAITLIST' : 'REGISTERED', code: tcode(), byId: by, lateCancel: false, attendedAt: null, method: null, feedback: null, createdAt: now() };
  DBV.regs = DBV.regs.filter((x: Any) => !(x.eventId === e.id && x.userId === uid)); DBV.regs.push(r); return r; };
const openCheck = (e: Any) => { if (e.status !== 'PUBLISHED') throw E(400, 'closed', e.status === 'CANCELLED' ? 'این برنامه لغو شده است' : 'ثبت‌نام باز نیست'); if (e.registrationDeadline && e.registrationDeadline < now()) throw E(400, 'deadline', 'مهلت ثبت‌نام تمام شده است'); if (e.startsAt < now()) throw E(400, 'started', 'برنامه شروع شده است'); };
const manageEv = (id: string) => { const u = me(); const e = ev(id); if (!isHQ(u.id) && e.createdById !== u.id) throw E(403, 'forbidden', 'فقط برگزارکنندهٔ این برنامه یا ستاد'); return e; };

on('GET', '/events', (_m, _b, q) => { const u = me(); const s = q.get('scope') ?? 'upcoming'; let rows: Any[];
  if (s === 'mine') rows = DBV.events.filter((e: Any) => ACTIVE.includes(regOf(e.id, u.id)?.status));
  else rows = DBV.events.filter((e: Any) => e.status !== 'DRAFT' && (s === 'past' ? e.endsAt <= now() : e.endsAt >= now()) && !audienceBlock(e, u));
  rows.sort((a, b) => (s === 'past' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
  return rows.map((e) => pubEv(e, regOf(e.id, u.id) ?? null)); });
on('GET', '/events/([^/]+)', (m) => { const u = me(); const e = ev(m[1]); return { ...pubEv(e, regOf(e.id, u.id) ?? null, true), blockedReason: audienceBlock(e, u), canManage: isHQ(u.id) || e.createdById === u.id, ledCores: DBV.cores.filter((c: Any) => c.leaderId === u.id).map((c: Any) => ({ id: c.id, name: c.name })) }; });
on('POST', '/events/([^/]+)/register', (m) => { const u = me(); const e = ev(m[1]); openCheck(e); const b = audienceBlock(e, u); if (b) throw E(400, 'audience', b); const r = registerOne(e, u.id, null);
  if (r.status === 'PENDING') notify(e.createdById, { kind: 'event_request', title: `درخواست تازه برای «${e.title}»`, link: `/manage/events/${e.id}` }); return { status: r.status, checkInCode: r.status === 'REGISTERED' ? r.code : null }; });
on('POST', '/events/([^/]+)/register-group', (m, b) => { const u = me(); const e = ev(m[1]); openCheck(e); const c = DBV.cores.find((x: Any) => x.id === b.coreId); if (!c || c.leaderId !== u.id) throw E(403, 'not_leader', 'فقط مسئول همین هسته');
  return b.userIds.filter((id: string) => coreMembersOf(c.id).includes(id)).map((id: string) => { const p = U(id); const bl = audienceBlock(e, p); if (bl) return { userId: id, name: nm(id), status: 'SKIPPED', reason: bl }; const r = registerOne(e, id, u.id); if (id !== u.id) notify(id, { kind: 'event_group', title: `برای «${e.title}» ثبت‌نام شدید`, link: `/events/${e.id}` }); return { userId: id, name: nm(id), status: r.status }; }); });
on('POST', '/events/([^/]+)/cancel', (m) => { const u = me(); const e = ev(m[1]); const r = regOf(e.id, u.id); if (!r || !ACTIVE.includes(r.status)) throw E(400, 'not_registered', 'ثبت‌نامی ندارید');
  const late = new Date(e.startsAt).getTime() - Date.now() < 24 * 3600_000; const was = r.status; r.status = 'CANCELLED'; r.lateCancel = late && was === 'REGISTERED'; if (was === 'REGISTERED') promote(e); return { ok: true, late }; });
on('POST', '/events/([^/]+)/feedback', (m, b) => { const r = regOf(m[1], me().id); if (!r?.attendedAt) throw E(400, 'not_attended', 'نظر را شرکت‌کنندگان می‌دهند'); r.feedback = { rating: b.rating, comment: b.comment ?? '' }; return { ok: true }; });
on('POST', '/events/([^/]+)/join', (m) => { const u = me(); const e = ev(m[1]); const r = regOf(e.id, u.id); if (r?.status !== 'REGISTERED') throw E(403, 'not_registered', 'اول ثبت‌نام کنید'); if (Date.now() < new Date(e.startsAt).getTime() - 3600_000) throw E(400, 'early', 'پیوند از یک ساعت پیش از شروع باز می‌شود'); r.attendedAt ??= now(); r.method ??= 'ONLINE'; return { url: e.onlineUrl }; });
on('GET', '/manage/events', () => { const u = me(); return DBV.events.filter((e: Any) => isHQ(u.id) || e.createdById === u.id).sort((a: Any, b: Any) => b.startsAt.localeCompare(a.startsAt)).map((e: Any) => ({ ...pubEv(e, null), ...cnt(e.id) })); });
const evFields = ['title', 'description', 'agenda', 'kind', 'location', 'mapUrl', 'onlineUrl', 'bring', 'hostName', 'capacity', 'waitlist', 'requiresApproval', 'audienceGender', 'audienceProvinceId', 'audienceCountyId', 'startsAt', 'endsAt', 'registrationDeadline', 'audienceNetworkId', 'audienceMosqueId', 'audienceCoreId', 'feeNote'];
on('POST', '/manage/events', (_m, b) => { const u = me(); const r = rolesOf(u.id); if (!isHQ(u.id) && !r.includes('RAHYAR') && !(r.includes('INSTRUCTOR') && b.kind === 'ONLINE')) throw E(403, 'forbidden', 'اجازهٔ ساخت برنامه ندارید');
  if (!b.title || !b.kind || !b.startsAt || !b.endsAt) throw E(400, 'missing', 'عنوان، نوع، زمان شروع و پایان لازم است'); if (b.endsAt <= b.startsAt) throw E(400, 'bad_time', 'پایان باید بعد از شروع باشد');
  const e: Any = { id: rid(), status: 'DRAFT', cancelReason: null, createdById: u.id, waitlist: true, requiresApproval: false }; evFields.forEach((k) => b[k] !== undefined && (e[k] = b[k] === '' ? null : b[k])); DBV.events.push(e); return e; });
on('GET', '/manage/events/([^/]+)', (m) => { const e = manageEv(m[1]); const people = DBV.regs.filter((r: Any) => r.eventId === e.id).map((r: Any) => { const p = U(r.userId); return { userId: r.userId, name: nm(r.userId), status: r.status, code: r.code, attendedAt: r.attendedAt, method: r.method, lateCancel: r.lateCancel, feedback: r.feedback ? { rating: r.feedback.rating } : null, county: DBV.counties.find((c) => c.id === p?.countyId)?.name ?? null, mosque: DBV.mosques.find((x) => x.id === p?.mosqueId)?.name ?? null, byGroup: !!r.byId }; });
  const fb = people.map((p: Any) => p.feedback?.rating).filter(Boolean); return { event: { ...pubEv(e, null), onlineUrl: e.onlineUrl, description: e.description, agenda: e.agenda, bring: e.bring, mapUrl: e.mapUrl, audienceProvinceId: e.audienceProvinceId, audienceCountyId: e.audienceCountyId, audienceNetworkId: e.audienceNetworkId ?? null, audienceMosqueId: e.audienceMosqueId ?? null, audienceCoreId: e.audienceCoreId ?? null, feeNote: e.feeNote ?? null }, counts: cnt(e.id), rating: fb.length ? +(fb.reduce((a: number, b: number) => a + b, 0) / fb.length).toFixed(1) : null, comments: DBV.regs.filter((r: Any) => r.eventId === e.id && r.feedback?.comment).map((r: Any) => r.feedback.comment), people }; });
on('PATCH', '/manage/events/([^/]+)', (m, b) => { const e = manageEv(m[1]); const old = e.startsAt + e.location; evFields.forEach((k) => b[k] !== undefined && (e[k] = b[k] === '' ? null : b[k]));
  if (e.status === 'PUBLISHED' && old !== e.startsAt + e.location) notify(DBV.regs.filter((r: Any) => r.eventId === e.id && ACTIVE.includes(r.status)).map((r: Any) => r.userId), { kind: 'event_changed', title: `تغییر در «${e.title}»`, link: `/events/${e.id}` }); promote(e); return e; });
on('DELETE', '/manage/events/([^/]+)', (m) => { const e = manageEv(m[1]); if (e.status !== 'DRAFT') throw E(400, 'not_draft', 'برنامهٔ منتشرشده حذف نمی‌شود؛ لغوش کنید'); DBV.events = DBV.events.filter((x: Any) => x.id !== e.id); return { ok: true }; });
on('POST', '/manage/events/([^/]+)/publish', (m) => { const e = manageEv(m[1]); if (e.kind === 'IN_PERSON' && !e.location) throw E(400, 'not_ready', 'پیش از انتشار کامل کنید: نشانی برنامهٔ حضوری'); e.status = 'PUBLISHED'; return e; });
on('POST', '/manage/events/([^/]+)/cancel', (m, b) => { const e = manageEv(m[1]); e.status = 'CANCELLED'; e.cancelReason = b.reason; notify(DBV.regs.filter((r: Any) => r.eventId === e.id && ACTIVE.includes(r.status)).map((r: Any) => r.userId), { kind: 'event_cancelled', title: `لغو شد: «${e.title}»`, body: b.reason, link: `/events/${e.id}` }); return { ok: true }; });
on('POST', '/manage/events/([^/]+)/people/([^/]+)', (m, b) => { const e = manageEv(m[1]); const r = regOf(e.id, m[2]); if (!r) throw E(404, 'no_reg', 'ثبت‌نام پیدا نشد');
  if (b.action === 'approve') { r.status = e.capacity != null && cnt(e.id).registered >= e.capacity ? 'WAITLIST' : 'REGISTERED'; notify(r.userId, { kind: 'event_approved', title: `ثبت‌نامتان در «${e.title}» تأیید شد`, link: `/events/${e.id}` }); }
  if (b.action === 'reject') { const was = r.status; r.status = 'REJECTED'; if (was === 'REGISTERED') promote(e); }
  if (b.action === 'attend') { r.attendedAt ??= now(); r.method ??= 'MANUAL'; } if (b.action === 'unattend') { r.attendedAt = null; r.method = null; } return { ok: true }; });
const checkIn = (eid: string, raw: string) => { manageEv(eid); let code = raw.trim().toUpperCase(); const mm = /^MH1:([^:]+):([A-Z0-9]+)$/i.exec(raw.trim()); if (mm) { if (mm[1] !== eid) return { ok: false, message: 'این کارت برای برنامهٔ دیگری است' }; code = mm[2].toUpperCase(); }
  const r = DBV.regs.find((x: Any) => x.eventId === eid && x.code === code); if (!r) return { ok: false, message: 'کد پیدا نشد' }; const name = nm(r.userId);
  if (r.status !== 'REGISTERED') return { ok: false, name, message: r.status === 'WAITLIST' ? 'در فهرست انتظار است' : 'ثبت‌نامش قطعی نیست' }; if (r.attendedAt) return { ok: true, already: true, name, message: 'پیش‌تر وارد شده' };
  r.attendedAt = now(); r.method = 'QR'; return { ok: true, name, message: 'خوش آمدید' }; };
on('POST', '/manage/events/([^/]+)/checkin', (m, b) => checkIn(m[1], b.code));
on('POST', '/manage/events/([^/]+)/checkin-bulk', (m, b) => b.items.map((it: Any) => ({ code: it.code, ...checkIn(m[1], it.code) })));
on('POST', '/manage/events/([^/]+)/notify', (m, b) => { const e = manageEv(m[1]); const ids = DBV.regs.filter((r: Any) => r.eventId === e.id && r.status === 'REGISTERED').map((r: Any) => r.userId); notify(ids, { kind: 'event_message', title: `${e.title}: ${b.title}`, body: b.body, link: `/events/${e.id}` }); return { sent: ids.length }; });

/* ───────── مرحلهٔ ۳ ───────── */
registerPhase3(Object.assign(HOOK, {
  get db() { return DBV; }, on, onFirst, wrap, E, me, maybeMe, rolesOf, staff, rid, now, notify, nm, U, C, enr, prog, isHQ, provOf, normMobile, card, allLessons, resolve,
}));

export async function demoApi(path: string, method: string, body: Any): Promise<Any> {
  await new Promise((r) => setTimeout(r, 120)); // حس شبکه
  const [p, qs] = path.split('?');
  for (const [mt, re, h] of R) {
    if (mt !== method) continue;
    const m = p.match(re);
    if (m) {
      const out = h(m, body ?? {}, new URLSearchParams(qs ?? ''));
      save();
      return JSON.parse(JSON.stringify(out ?? null));
    }
  }
  throw E(404, 'not_found', 'این بخش در نسخهٔ نمایشی نیست');
}
