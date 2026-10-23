/**
 * شبیه‌ساز API برای نسخهٔ نمایشی (بدون سرور).
 * همان مسیرها و همان شکل پاسخ‌های apps/api را برمی‌گرداند و داده را در مرورگر نگه می‌دارد.
 * فقط در ساخت نمایشی (VITE_DEMO=1) به کار می‌رود.
 */
import seed from './seed.json';

type Any = any;
export class DemoError extends Error {
  constructor(public status: number, public code: string, message: string, public data: Any = {}) { super(message); }
}
const E = (status: number, code: string, message: string, data: Any = {}) => new DemoError(status, code, message, data);

const KEY = 'mh-demo-v1';
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
}

function fresh(): DB {
  const s = JSON.parse(JSON.stringify(seed)) as Any;
  const t = now();
  const courses = s.courses.map((c: Any) => ({ ...c, publishedAt: t, createdAt: t, updatedAt: t }));
  const db: DB = {
    users: [], roles: [], session: null, otpMobile: null,
    provinces: s.provinces, counties: s.counties, mosques: s.mosques.map((m: Any) => ({ ...m, createdAt: t })), networks: s.networks,
    courses, modules: s.modules, lessons: s.lessons, deps: s.deps ?? [], paths: s.paths, pathItems: s.pathItems,
    enrollments: [], progress: [], attempts: [], certificates: [], grants: [], audit: [],
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
  return db;
}

let DBV: DB = load();
function load(): DB {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(DBV)); } catch { /* ignore */ } }
export function resetDemo() { DBV = fresh(); save(); }

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
  const nets = new Set(DBV.roles.filter((r) => r.userId === uid && r.networkId).map((r) => r.networkId));
  return new Set(DBV.grants.filter((g) => (g.userId === uid || (g.networkId && nets.has(g.networkId))) && (!g.expiresAt || g.expiresAt > now())).map((g) => g.courseId));
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
    nearMosque: u.nearMosque, roles: rolesOf(u.id), cores: [], ssoLinked: false };
}
function issueCert(uid: string, c: Any) {
  if (DBV.certificates.some((x) => x.userId === uid && x.courseId === c.id)) return DBV.certificates.find((x) => x.userId === uid && x.courseId === c.id).code;
  const u = DBV.users.find((x) => x.id === uid);
  const finals = allLessons(c.id).filter((l) => l.isFinalQuiz).map((l) => l.id);
  const best = Math.max(-1, ...DBV.attempts.filter((a) => a.userId === uid && finals.includes(a.lessonId)).map((a) => a.score));
  const code = rcode();
  DBV.certificates.push({ id: rid(), code, userId: uid, courseId: c.id, holderName: `${u.firstName} ${u.lastName}`, courseTitle: c.title, score: best >= 0 ? best : null, issuedAt: now(), revokedAt: null });
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
  if (!e) throw E(403, 'not_enrolled', 'اول در دوره ثبت‌نام کنید');
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
  if (l.type === 'MISSION' && completed) { data = { ...(data ?? {}), status: c.missionRule === 'ON_SUBMIT' ? 'submitted' : 'pending', submittedAt: now() }; if (c.missionRule === 'ON_APPROVAL') completed = false; }
  let p = prog(u.id, l.id);
  if (!p) { p = { userId: u.id, lessonId: l.id, positionSec: 0, completedAt: null, data: null }; DBV.progress.push(p); }
  if (typeof b.positionSec === 'number') p.positionSec = b.positionSec;
  if (data !== undefined) p.data = data;
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
  staff(); const starter: Any = { VIDEO: { provider: 'aparat', aparatHash: '' }, AUDIO: {}, TEXT: { body: '' }, QUIZ: { questions: [] }, WORKSHEET: { prompt: '', fields: [] }, MISSION: { goal: '', steps: [] } };
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
on('GET', '/admin/mosques', (_m, _b, q) => { staff(); return DBV.mosques.filter((m) => q.get('unverified') !== '1' || !m.verified).map((m) => { const ct = DBV.counties.find((c) => c.id === m.countyId); return { ...m, county: ct?.name, province: DBV.provinces.find((p) => p.id === ct?.provinceId)?.name }; }); });
on('POST', '/admin/mosques', (_m, b) => { staff(); const m = { id: rid(), name: b.name, countyId: b.countyId, verified: true, createdAt: now() }; DBV.mosques.unshift(m); return m; });
on('POST', '/admin/mosques/([^/]+)/verify', (m) => { staff(); const x = DBV.mosques.find((y) => y.id === m[1]); if (x) x.verified = true; return { ok: true }; });
on('GET', '/admin/audit', () => { staff(); return DBV.audit.slice(0, 100).map((a) => { const u = DBV.users.find((x) => x.id === a.actorId); return { ...a, actor: u ? `${u.firstName} ${u.lastName}` : '—' }; }); });

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
