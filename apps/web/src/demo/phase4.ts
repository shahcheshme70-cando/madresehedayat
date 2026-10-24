/**
 * نسخهٔ نمایشی — پویش‌ها و کلاس زنده (BigBlueButton).
 * همان شکل پاسخ‌های apps/api/src/campaigns و apps/api/src/live؛ داده در مرورگر.
 */
type Any = any;
const DAY = 864e5;
const iso = (d: number, h?: number) => { const x = new Date(Date.now() + d * DAY); if (h !== undefined) x.setHours(h, 0, 0, 0); return x.toISOString(); };

/* ───────── دادهٔ نمونه ───────── */
export function seedPhase4(db: Any) {
  Object.assign(db, { campaigns: [], ctasks: [], cmembers: [], cdone: [], ccores: [], liveAtt: [], liveRecs: [] });
  const user = (id: string) => db.users.find((u: Any) => u.id === id);
  const provOf = (uid: string) => db.counties.find((c: Any) => c.id === user(uid)?.countyId)?.provinceId ?? null;
  const isf = provOf('p-prov');
  const C = (id: string, extra: Any, tasks: [string, string | null][]) => {
    db.campaigns.push({ id, body: null, provinceId: null, networkId: null, goal: null, status: 'PUBLISHED', createdById: 'p-admin', createdAt: iso(-12), ...extra });
    tasks.forEach(([title, body], i) => db.ctasks.push({ id: `${id}-t${i + 1}`, campaignId: id, order: i, title, body }));
  };
  C('cmp-noj', { title: 'مسجد، خانهٔ نوجوان', summary: 'یک ماه، سه کار کوتاه برای اینکه نوجوان‌های محله مسجد را جای خودشان بدانند.', scope: 'NATIONAL', goal: 5000,
    body: 'هر کنشگر در این یک ماه سه کار کوچک انجام می‌دهد. لازم نیست برنامهٔ بزرگ بگذارید؛ همین که یک نوجوان را به اسم صدا بزنید شروع خوبی است.\nکارهایی که انجام دادید را علامت بزنید تا نقشهٔ کشور پر شود.',
    startsAt: iso(-10), endsAt: iso(20) }, [
    ['با یک نوجوان محله گفت‌وگوی کوتاه داشته باشید', 'بعد از نماز، اسمش را بپرسید و از علاقه‌اش بپرسید.'],
    ['یک نوجوان را برای یک کار کوچک در مسجد دعوت کنید', 'مثلاً پخش چای، اذان، یا کمک در برنامهٔ هفتگی.'],
    ['از یک نوجوان دربارهٔ برنامهٔ مسجد نظر بخواهید', null],
  ]);
  if (isf) C('cmp-isf', { title: 'نماز جماعت صبح، با نوجوان‌ها', summary: 'پویش استانی: دعوت نوجوان‌ها به نماز صبح جماعت در هفتهٔ اول ماه.', scope: 'PROVINCE', provinceId: isf, goal: 400, createdById: 'p-prov', startsAt: iso(-3), endsAt: iso(11) }, [
    ['دست‌کم یک نوجوان را به نماز صبح دعوت کنید', null],
    ['بعد از نماز صبحانهٔ ساده‌ای با هم بخورید', 'اگر مسجد امکانش را ندارد، یک خرما و چای هم کافی است.'],
  ]);
  C('cmp-barakat', { title: 'برکت: یک کار خیر در هفته', summary: 'ویژهٔ اعضای برکت — هر هفته یک کار کوچک برای همسایه‌ها، با هستهٔ خودتان.', scope: 'ORG', networkId: 'org-barakat', createdById: 'p-prov', startsAt: iso(2), endsAt: iso(30) }, [
    ['یک کار خیر کوچک برای همسایه انجام دهید', null],
    ['تجربه‌تان را در جلسهٔ هسته بگویید', null],
  ]);
  C('cmp-past', { title: 'دههٔ کرامت: یک دیدار', summary: 'پویش پایان‌یافته: دیدار با یک خانوادهٔ محله.', scope: 'NATIONAL', startsAt: iso(-50), endsAt: iso(-40) }, [['با یک خانوادهٔ محله دیدار کنید', null]]);
  C('cmp-draft', { title: 'پیش‌نویس: هفتهٔ کتاب در مسجد', summary: 'معرفی یک کتاب کوتاه به نوجوان‌ها.', scope: 'NATIONAL', status: 'DRAFT', startsAt: iso(14), endsAt: iso(28) }, [['یک کتاب کوتاه را به یک نوجوان معرفی کنید', null]]);

  // مشارکت جمعی ساختگی در استان‌ها (فقط عدد؛ نامی در کار نیست)
  const provs = db.provinces.map((p: Any) => p.id);
  let k = 0;
  provs.forEach((p: string, i: number) => {
    const n = [14, 9, 31, 6, 4, 11, 22, 3, 8, 5, 17, 2, 7, 12, 4, 9, 6, 3, 10, 5, 8, 2, 13, 4, 6, 3, 7, 5, 2, 4, 9][i % 31];
    for (let j = 0; j < n; j++) {
      const uid = `crowd-${k++}`;
      db.cmembers.push({ campaignId: 'cmp-noj', userId: uid, coreId: null, provinceId: p, joinedAt: iso(-9 + (j % 9)) });
      for (let t = 1; t <= 3; t++) if ((j + t) % 3 !== 0) db.cdone.push({ taskId: `cmp-noj-t${t}`, userId: uid, campaignId: 'cmp-noj', provinceId: p, note: null, doneAt: iso(-8 + ((j + t) % 8)) });
    }
  });
  if (isf) for (let j = 0; j < 18; j++) { db.cmembers.push({ campaignId: 'cmp-isf', userId: `crowd-i${j}`, coreId: null, provinceId: isf, joinedAt: iso(-2) }); if (j % 2) db.cdone.push({ taskId: 'cmp-isf-t1', userId: `crowd-i${j}`, campaignId: 'cmp-isf', provinceId: isf, note: null, doneAt: iso(-1) }); }
  // زینب: عضو پویش ملی با هسته‌اش، یک کار انجام‌شده با یادداشت خصوصی؛ و نشان پویش گذشته
  const z = provOf('sample3');
  db.ccores.push({ campaignId: 'cmp-noj', coreId: 'core-rey', joinedById: 'sample3' });
  db.cmembers.push({ campaignId: 'cmp-noj', userId: 'sample3', coreId: 'core-rey', provinceId: z, joinedAt: iso(-8) }, { campaignId: 'cmp-noj', userId: 'sample1', coreId: 'core-rey', provinceId: provOf('sample1'), joinedAt: iso(-8) });
  db.cdone.push({ taskId: 'cmp-noj-t1', userId: 'sample3', campaignId: 'cmp-noj', provinceId: z, note: 'با علی، پسر همسایه، دربارهٔ تیم فوتبال مسجد حرف زدیم.', doneAt: iso(-6) });
  db.cmembers.push({ campaignId: 'cmp-past', userId: 'sample3', coreId: null, provinceId: z, joinedAt: iso(-48) });
  db.cdone.push({ taskId: 'cmp-past-t1', userId: 'sample3', campaignId: 'cmp-past', provinceId: z, note: null, doneAt: iso(-45) });

  // کلاس زنده: یکی پیش رو (با ثبت‌نام زینب)، یکی برگزارشده با حضور و ضبط
  const base = db.events.find((e: Any) => e.id === 'ev-online') ?? {};
  db.events.push({ ...base, id: 'ev-live', title: 'کلاس زنده: گفت‌وگو با نوجوان، پرسش و پاسخ', kind: 'ONLINE', startsAt: iso(2, 19), endsAt: iso(2, 20), onlineUrl: null, useBbb: true, record: true,
    hostName: 'فاطمه حسینی', capacity: 60, audienceGender: null, description: 'یک ساعت پرسش و پاسخ زنده دربارهٔ درس‌های دورهٔ «همراهی نوجوانان». سؤال‌هایتان را از پیش در یادداشت نگه دارید.', agenda: 'مرور کوتاه درس‌ها\nپرسش و پاسخ\nجمع‌بندی', bring: null, createdById: 'p-cty', status: 'PUBLISHED' });
  db.events.push({ ...base, id: 'ev-live-past', title: 'کلاس زنده: شروع گفت‌وگو', kind: 'ONLINE', startsAt: iso(-5, 19), endsAt: iso(-5, 20), onlineUrl: null, useBbb: true, record: true, liveFinalizedAt: iso(-5, 21),
    hostName: 'فاطمه حسینی', capacity: 60, audienceGender: null, description: 'جلسهٔ اول کلاس‌های زندهٔ دوره.', agenda: null, bring: null, createdById: 'p-cty', status: 'PUBLISHED' });
  const reg = (eventId: string, userId: string, code: string, extra: Any = {}) => db.regs.push({ eventId, userId, status: 'REGISTERED', code, byId: null, lateCancel: false, attendedAt: null, method: null, feedback: null, createdAt: iso(-6), ...extra });
  reg('ev-live', 'sample3', 'L5KD2W');
  reg('ev-live-past', 'sample3', 'L2PX8C', { attendedAt: iso(-5, 19), method: 'ONLINE' }); reg('ev-live-past', 'sample1', 'L9QR4M');
  db.liveAtt.push({ eventId: 'ev-live-past', userId: 'sample3', seconds: 52 * 60 }, { eventId: 'ev-live-past', userId: 'sample1', seconds: 11 * 60 });
  db.liveRecs.push({ eventId: 'ev-live-past', recordId: 'rec-demo-1', durationSec: 58 * 60, startedAt: iso(-5, 19), expiresAt: iso(177), deletedAt: null });
  // درس «جلسهٔ زنده» در دورهٔ همراهی نوجوانان
  const nj1 = db.courses.find((c: Any) => c.slug === 'nojavan-1');
  const mod = nj1 && db.modules.filter((m: Any) => m.courseId === nj1.id).sort((a: Any, b: Any) => b.order - a.order)[0];
  if (mod) {
    const order = Math.max(-1, ...db.lessons.filter((l: Any) => l.moduleId === mod.id).map((l: Any) => l.order)) + 1;
    db.lessons.push({ id: 'ls-live', moduleId: mod.id, order, title: 'جلسهٔ زنده: پرسش و پاسخ با مربی', type: 'LIVE', durationSec: 3600, required: false, isFinalQuiz: false, content: { eventId: 'ev-live' } });
  }
}

/* ───────── مسیرها ───────── */
export function registerPhase4(X: Any, H: { orgGate: (nid: string, f?: string) => Any; memberIds: (nid: string) => string[]; orgsOfUser: (uid: string) => string[] }) {
  const { on, wrap, E, me, isHQ, provOf, notify, rid, now } = X;
  const DB = () => X.db;
  const U = (id: string) => DB().users.find((u: Any) => u.id === id);
  const provName = (id: string | null) => DB().provinces.find((p: Any) => p.id === id)?.name ?? null;
  const orgName = (id: string | null) => DB().networks.find((n: Any) => n.id === id)?.name ?? null;
  const myProv = (uid: string) => provOf(U(uid)?.countyId ?? null);
  const myProvinces = (uid: string) => [...new Set(DB().positions.filter((p: Any) => p.holderId === uid && p.layer === 'PROVINCIAL' && p.provinceId).map((p: Any) => p.provinceId))] as string[];
  const myOrgs = (uid: string) => DB().networks.filter((n: Any) => n.kind === 'ORGANIZATION' && DB().roles.some((r: Any) => r.userId === uid && r.role === 'ORG_ADMIN' && r.networkId === n.id)).map((n: Any) => n.id);
  const camp = (id: string) => { const c = DB().campaigns.find((x: Any) => x.id === id); if (!c) throw E(404, 'no_campaign', 'این پویش پیدا نشد؛ شاید حذف شده باشد'); return c; };
  const phase = (c: Any) => c.status === 'CANCELLED' ? 'CANCELLED' : c.status === 'DRAFT' ? 'DRAFT' : Date.now() < +new Date(c.startsAt) ? 'UPCOMING' : Date.now() > +new Date(c.endsAt) ? 'ENDED' : 'ACTIVE';
  const visible = (c: Any, uid: string) => c.status !== 'DRAFT' && (c.scope === 'NATIONAL' || (c.scope === 'PROVINCE' && c.provinceId === myProv(uid)) || (c.scope === 'ORG' && H.orgsOfUser(uid).includes(c.networkId)));
  const canManage = (c: Any, uid: string) => {
    if (isHQ(uid)) return true;
    if (c.scope === 'PROVINCE' && myProvinces(uid).includes(c.provinceId)) return true;
    if (c.scope === 'ORG' && myOrgs(uid).includes(c.networkId)) { try { H.orgGate(c.networkId, 'campaigns'); return true; } catch { return false; } }
    return false;
  };
  const assertManage = (c: Any) => { if (!canManage(c, me().id)) throw E(403, 'forbidden', 'مدیریت این پویش با شما نیست؛ پویش استانی را فقط راهیار همان استان یا ستاد ویرایش می‌کند'); };
  const tasksOf = (id: string) => DB().ctasks.filter((t: Any) => t.campaignId === id).sort((a: Any, b: Any) => a.order - b.order);
  const totals = (c: Any) => {
    const mem = DB().cmembers.filter((m: Any) => m.campaignId === c.id), dn = DB().cdone.filter((d: Any) => d.campaignId === c.id);
    const perTask: Record<string, number> = {}; dn.forEach((d: Any) => (perTask[d.taskId] = (perTask[d.taskId] ?? 0) + 1));
    const map = DB().provinces.map((p: Any) => ({ id: p.id, name: p.name, members: mem.filter((m: Any) => m.provinceId === p.id).length, done: dn.filter((d: Any) => d.provinceId === p.id).length }));
    return { members: mem.length, done: dn.length, cores: DB().ccores.filter((x: Any) => x.campaignId === c.id).length, perTask, map };
  };
  const mapFor = (c: Any, t: Any) => c.scope === 'NATIONAL' ? t.map : c.scope === 'ORG' ? t.map.filter((p: Any) => p.members > 0) : t.map.filter((p: Any) => p.id === c.provinceId);
  const assertOpen = (c: Any, joining = false) => {
    const p = phase(c);
    if (p === 'ENDED') throw E(400, 'campaign_ended', 'زمان این پویش تمام شده است و دیگر نمی‌شود کاری ثبت کرد');
    if (p === 'CANCELLED') throw E(400, 'campaign_cancelled', 'این پویش لغو شده است');
    if (p === 'DRAFT') throw E(400, 'campaign_draft', 'این پویش هنوز منتشر نشده است');
    if (p === 'UPCOMING' && !joining) throw E(400, 'campaign_not_started', 'پویش هنوز شروع نشده؛ می‌توانید از حالا بپیوندید و از روز شروع کارها را ثبت کنید');
  };
  const addMembers = (c: Any, ids: string[], coreId: string | null) => {
    const org = c.scope === 'ORG' ? new Set(H.memberIds(c.networkId)) : null;
    const added: string[] = [];
    for (const uid of ids) {
      const p = myProv(uid);
      if (!(c.scope === 'NATIONAL' || (c.scope === 'PROVINCE' && p === c.provinceId) || org?.has(uid))) continue;
      if (DB().cmembers.some((m: Any) => m.campaignId === c.id && m.userId === uid)) continue;
      DB().cmembers.push({ campaignId: c.id, userId: uid, coreId, provinceId: p, joinedAt: now() }); added.push(uid);
    }
    return added;
  };

  // ───── کنشگر ─────
  on('GET', '/campaigns', () => {
    const u = me(); const recent = Date.now() - 60 * DAY;
    return DB().campaigns.filter((c: Any) => c.status === 'PUBLISHED' && +new Date(c.endsAt) >= recent && visible(c, u.id)).sort((a: Any, b: Any) => a.endsAt.localeCompare(b.endsAt)).map((c: Any) => {
      const t = totals(c);
      return { id: c.id, title: c.title, summary: c.summary, scope: c.scope, province: provName(c.provinceId), org: orgName(c.networkId), goal: c.goal, startsAt: c.startsAt, endsAt: c.endsAt, phase: phase(c),
        members: t.members, done: t.done, tasks: tasksOf(c.id).length, joined: DB().cmembers.some((m: Any) => m.campaignId === c.id && m.userId === u.id), myDone: DB().cdone.filter((d: Any) => d.campaignId === c.id && d.userId === u.id).length };
    });
  });
  on('GET', '/campaigns/badges', () => {
    const u = me();
    return DB().campaigns.filter((c: Any) => DB().cdone.some((d: Any) => d.campaignId === c.id && d.userId === u.id)).sort((a: Any, b: Any) => b.endsAt.localeCompare(a.endsAt))
      .map((c: Any) => ({ id: c.id, title: c.title, endsAt: c.endsAt, done: DB().cdone.filter((d: Any) => d.campaignId === c.id && d.userId === u.id).length }));
  });
  on('GET', '/campaigns/([^/]+)', (m: Any) => {
    const u = me(); const c = camp(m[1]); const manage = canManage(c, u.id);
    if (!visible(c, u.id) && !manage) throw E(404, 'no_campaign', 'این پویش پیدا نشد یا برای استان شما نیست');
    const mine = DB().cdone.filter((d: Any) => d.campaignId === c.id && d.userId === u.id);
    const mem = DB().cmembers.find((x: Any) => x.campaignId === c.id && x.userId === u.id);
    const t = totals(c);
    return { id: c.id, title: c.title, summary: c.summary, body: c.body, scope: c.scope, provinceId: c.provinceId, province: provName(c.provinceId), networkId: c.networkId, org: orgName(c.networkId),
      goal: c.goal, startsAt: c.startsAt, endsAt: c.endsAt, status: c.status, phase: phase(c), canManage: manage, joined: !!mem, viaCore: mem?.coreId ? DB().cores.find((x: Any) => x.id === mem.coreId)?.name ?? null : null, badge: mine.length > 0,
      tasks: tasksOf(c.id).map((x: Any) => { const d = mine.find((y: Any) => y.taskId === x.id); return { id: x.id, title: x.title, body: x.body, count: t.perTask[x.id] ?? 0, done: !!d, note: d?.note ?? null, doneAt: d?.doneAt ?? null }; }),
      totals: { members: t.members, done: t.done, cores: t.cores }, map: mapFor(c, t),
      cores: DB().cores.filter((x: Any) => x.leaderId === u.id).map((x: Any) => ({ id: x.id, name: x.name, joined: DB().ccores.some((y: Any) => y.campaignId === c.id && y.coreId === x.id) })) };
  });
  on('POST', '/campaigns/([^/]+)/join', (m: Any) => {
    const u = me(); const c = camp(m[1]);
    if (!visible(c, u.id)) throw E(403, c.scope === 'ORG' ? 'other_org' : 'other_province', c.scope === 'ORG' ? 'این پویش ویژهٔ اعضای یک سازمان است' : 'این پویش استانی است و فقط ساکنان همان استان می‌توانند بپیوندند');
    assertOpen(c, true); addMembers(c, [u.id], null); return { ok: true };
  });
  on('POST', '/campaigns/([^/]+)/leave', (m: Any) => { const u = me(); DB().cmembers = DB().cmembers.filter((x: Any) => !(x.campaignId === m[1] && x.userId === u.id)); return { ok: true }; });
  on('POST', '/campaigns/([^/]+)/join-core', (m: Any, b: Any) => {
    const u = me(); const c = camp(m[1]); assertOpen(c, true);
    const core = DB().cores.find((x: Any) => x.id === b.coreId); if (!core) throw E(404, 'no_core', 'هسته پیدا نشد');
    if (core.leaderId !== u.id && !isHQ(u.id)) throw E(403, 'not_leader', 'فقط مسئول هسته می‌تواند هسته را به پویش بپیوندد');
    const all = [...new Set([u.id, ...DB().coreMembers.filter((x: Any) => x.coreId === core.id).map((x: Any) => x.userId)])] as string[];
    if (!DB().ccores.some((x: Any) => x.campaignId === c.id && x.coreId === core.id)) DB().ccores.push({ campaignId: c.id, coreId: core.id, joinedById: u.id });
    const added = addMembers(c, all, core.id);
    const others = added.filter((x) => x !== u.id);
    if (others.length) notify(others, { kind: 'campaign_core', title: `هستهٔ «${core.name}» به پویش «${c.title}» پیوست`, body: 'کارهای کوتاه پویش را ببینید و هر کدام را انجام دادید علامت بزنید.', link: `/campaigns/${c.id}` });
    const inNow = DB().cmembers.filter((x: Any) => x.campaignId === c.id && all.includes(x.userId)).length;
    return { ok: true, added: added.length, skipped: all.length - inNow };
  });
  on('POST', '/campaigns/([^/]+)/tasks/([^/]+)', (m: Any, b: Any) => {
    const u = me(); const c = camp(m[1]); assertOpen(c);
    if (!tasksOf(c.id).some((t: Any) => t.id === m[2])) throw E(404, 'no_task', 'این کار در پویش پیدا نشد');
    const mem = DB().cmembers.find((x: Any) => x.campaignId === c.id && x.userId === u.id);
    if (!mem) throw E(400, 'not_joined', 'اول به پویش بپیوندید، بعد کارها را علامت بزنید');
    const note = b.note?.trim() || null;
    const d = DB().cdone.find((x: Any) => x.taskId === m[2] && x.userId === u.id);
    if (d) d.note = note; else DB().cdone.push({ taskId: m[2], userId: u.id, campaignId: c.id, provinceId: mem.provinceId, note, doneAt: now() });
    return { ok: true };
  });
  on('DELETE', '/campaigns/([^/]+)/tasks/([^/]+)', (m: Any) => {
    const u = me(); const c = camp(m[1]);
    if (phase(c) === 'ENDED') throw E(400, 'campaign_ended', 'زمان پویش تمام شده و کارهای ثبت‌شده دیگر عوض نمی‌شوند');
    DB().cdone = DB().cdone.filter((x: Any) => !(x.taskId === m[2] && x.userId === u.id)); return { ok: true };
  });

  // ───── سازنده ─────
  const options = (uid: string) => {
    const hq = isHQ(uid);
    const provs = hq ? DB().provinces.map((p: Any) => p.id) : myProvinces(uid);
    const orgs = myOrgs(uid).filter((id: string) => { try { H.orgGate(id, 'campaigns'); return true; } catch { return false; } }).map((id: string) => ({ id, name: orgName(id) }));
    return { national: hq, provinces: provs.map((id: string) => ({ id, name: provName(id) })).sort((a: Any, b: Any) => a.name.localeCompare(b.name, 'fa')), orgs };
  };
  on('GET', '/manage/campaigns/options', () => options(me().id));
  on('GET', '/manage/campaigns', () => {
    const u = me(); const hq = isHQ(u.id); const o = options(u.id); const orgIds = o.orgs.map((x: Any) => x.id); const provs = hq ? [] : myProvinces(u.id);
    if (!hq && !provs.length && !orgIds.length) throw E(403, 'forbidden', 'ساختن پویش برای ستاد، راهیاران استانی و مدیران سازمان‌های مشترک است');
    return DB().campaigns.filter((c: Any) => hq || (c.scope === 'PROVINCE' && provs.includes(c.provinceId)) || (c.scope === 'ORG' && orgIds.includes(c.networkId)))
      .sort((a: Any, b: Any) => b.createdAt.localeCompare(a.createdAt))
      .map((c: Any) => { const t = totals(c); return { id: c.id, title: c.title, scope: c.scope, province: provName(c.provinceId), status: c.status, phase: phase(c), startsAt: c.startsAt, endsAt: c.endsAt, goal: c.goal, members: t.members, done: t.done }; });
  });
  const validate = (b: Any) => {
    const u = me();
    if (!b.title?.trim() || b.title.trim().length < 3) throw E(400, 'invalid', '«عنوان» دست‌کم ۳ نویسه لازم دارد');
    if (!b.summary?.trim()) throw E(400, 'invalid', '«خلاصه» لازم است');
    if (!b.tasks?.length) throw E(400, 'invalid', '«کارهای پویش» لازم است');
    if (new Date(b.endsAt) <= new Date(b.startsAt)) throw E(400, 'bad_dates', 'تاریخ پایان باید بعد از تاریخ شروع باشد');
    if (+new Date(b.endsAt) - +new Date(b.startsAt) > 120 * DAY) throw E(400, 'too_long', 'پویش حداکثر ۱۲۰ روز است؛ برای حرکت بلندتر چند پویش پشت‌سرهم بسازید');
    const o = options(u.id);
    if (b.scope === 'NATIONAL' && !isHQ(u.id)) throw E(403, 'forbidden', o.provinces.length || o.orgs.length ? 'پویش کشوری را فقط ستاد می‌سازد؛ شما پویش استانی یا ویژهٔ اعضای سازمانتان را می‌سازید' : 'ساختن پویش برای ستاد، راهیاران استانی و مدیران سازمان‌های مشترک است');
    if (b.scope === 'PROVINCE') { if (!b.provinceId) throw E(400, 'no_province', 'استان پویش را انتخاب کنید'); if (!isHQ(u.id) && !myProvinces(u.id).includes(b.provinceId)) throw E(403, 'forbidden', 'فقط برای استانی که راهیار آن هستید می‌توانید پویش بسازید'); }
    if (b.scope === 'ORG') { if (!b.networkId) throw E(400, 'no_org', 'سازمان پویش را انتخاب کنید'); H.orgGate(b.networkId, 'campaigns'); }
  };
  const saveTasks = (id: string, tasks: Any[]) => {
    const keep = new Set(tasks.map((t) => t.id).filter(Boolean));
    DB().ctasks = DB().ctasks.filter((t: Any) => t.campaignId !== id || keep.has(t.id));
    tasks.forEach((t: Any, i: number) => {
      const old = t.id && DB().ctasks.find((x: Any) => x.id === t.id);
      if (old) Object.assign(old, { order: i, title: t.title.trim(), body: t.body?.trim() || null });
      else DB().ctasks.push({ id: rid(), campaignId: id, order: i, title: t.title.trim(), body: t.body?.trim() || null });
    });
  };
  const fields = (b: Any) => ({ title: b.title.trim(), summary: b.summary.trim(), body: b.body?.trim() || null, scope: b.scope, provinceId: b.scope === 'PROVINCE' ? b.provinceId : null, networkId: b.scope === 'ORG' ? b.networkId : null, goal: b.goal ?? null, startsAt: b.startsAt, endsAt: b.endsAt });
  on('POST', '/manage/campaigns', (_m: Any, b: Any) => {
    validate(b);
    if (b.scope === 'ORG') { const g = H.orgGate(b.networkId, 'campaigns'); const cap = g?.sub?.plan === 'ORG_BASIC' ? 2 : null; if (cap && DB().campaigns.filter((c: Any) => c.networkId === b.networkId && c.status !== 'CANCELLED').length >= cap) throw E(400, 'campaign_quota', 'بستهٔ پایه سالی ۲ پویش دارد؛ برای پویش بیشتر بستهٔ ویژه لازم است'); }
    const c = { id: rid(), status: 'DRAFT', createdById: me().id, createdAt: now(), ...fields(b) };
    DB().campaigns.push(c); saveTasks(c.id, b.tasks); return { id: c.id };
  });
  on('GET', '/manage/campaigns/([^/]+)', (m: Any) => {
    const c = camp(m[1]); assertManage(c); const t = totals(c);
    const days: Record<string, number> = {}; DB().cdone.filter((d: Any) => d.campaignId === c.id).forEach((d: Any) => { const k = d.doneAt.slice(0, 10); days[k] = (days[k] ?? 0) + 1; });
    return { ...c, phase: phase(c), tasks: tasksOf(c.id).map((x: Any) => ({ id: x.id, title: x.title, body: x.body, count: t.perTask[x.id] ?? 0 })), totals: { members: t.members, done: t.done, cores: t.cores }, map: mapFor(c, t),
      perDay: Object.entries(days).sort().map(([day, n]) => ({ day, n })) };
  });
  on('PATCH', '/manage/campaigns/([^/]+)', (m: Any, b: Any) => {
    const c = camp(m[1]); assertManage(c);
    if (c.status === 'PUBLISHED' && (b.scope !== c.scope || (b.scope === 'PROVINCE' && (b.provinceId ?? null) !== c.provinceId) || (b.scope === 'ORG' && (b.networkId ?? null) !== c.networkId))) throw E(400, 'scope_locked', 'دامنهٔ پویش منتشرشده عوض نمی‌شود؛ چون کسانی پیوسته‌اند');
    validate(b);
    const drop = tasksOf(c.id).filter((t: Any) => !b.tasks.some((x: Any) => x.id === t.id));
    if (c.status === 'PUBLISHED' && drop.some((t: Any) => DB().cdone.some((d: Any) => d.taskId === t.id))) throw E(400, 'task_in_use', 'کاری که کسی انجامش داده را نمی‌شود حذف کرد؛ متنش را ویرایش کنید');
    Object.assign(c, fields(b)); saveTasks(c.id, b.tasks); return { ok: true };
  });
  on('POST', '/manage/campaigns/([^/]+)/publish', (m: Any) => {
    const c = camp(m[1]); assertManage(c);
    if (c.status !== 'DRAFT') throw E(400, 'not_draft', 'این پویش پیش‌تر منتشر یا لغو شده است');
    if (+new Date(c.endsAt) < Date.now()) throw E(400, 'campaign_ended', 'تاریخ پایان گذشته است؛ اول تاریخ‌ها را درست کنید');
    c.status = 'PUBLISHED';
    const ids = c.scope === 'ORG' ? H.memberIds(c.networkId) : DB().users.filter((u: Any) => u.isActive !== false && (c.scope === 'NATIONAL' || myProv(u.id) === c.provinceId)).map((u: Any) => u.id);
    notify(ids, { kind: 'campaign', title: `پویش تازه: ${c.title}`, body: c.summary, link: `/campaigns/${c.id}` });
    return { ok: true, notified: ids.length };
  });
  on('POST', '/manage/campaigns/([^/]+)/cancel', (m: Any) => {
    const c = camp(m[1]); assertManage(c);
    if (c.status === 'DRAFT') { DB().campaigns = DB().campaigns.filter((x: Any) => x.id !== c.id); return { ok: true, deleted: true }; }
    c.status = 'CANCELLED';
    notify(DB().cmembers.filter((x: Any) => x.campaignId === c.id).map((x: Any) => x.userId), { kind: 'campaign', title: `پویش «${c.title}» لغو شد`, link: `/campaigns/${c.id}` });
    return { ok: true };
  });

  // ───── کلاس زنده ─────
  const ev = (id: string) => { const e = DB().events.find((x: Any) => x.id === id); if (!e) throw E(404, 'no_event', 'برنامه پیدا نشد'); return e; };
  const regOf = (eid: string, uid: string) => DB().regs.find((r: Any) => r.eventId === eid && r.userId === uid);
  const liveLessons = (eid: string) => DB().lessons.filter((l: Any) => l.type === 'LIVE' && l.content?.eventId === eid);
  const completeLive = (uid: string, eid: string) => {
    for (const l of liveLessons(eid)) {
      let p = DB().progress.find((x: Any) => x.userId === uid && x.lessonId === l.id);
      if (!p) { p = { userId: uid, lessonId: l.id, positionSec: 0, completedAt: null, data: null, updatedAt: now() }; DB().progress.push(p); }
      p.completedAt ??= now();
    }
  };
  const canSee = (uid: string, e: Any) => isHQ(uid) || e.createdById === uid || regOf(e.id, uid)?.status === 'REGISTERED';
  const extra = (e: Any) => ({ useBbb: !!e.useBbb, record: !!(e.useBbb && e.record) });
  wrap('GET', '/events/([^/]+)', (orig: Any) => (m: Any, b: Any, q: Any) => { const r = orig(m, b, q); const e = ev(m[1]); return { ...r, ...extra(e), onlineSoon: r.onlineSoon || (e.kind === 'ONLINE' && !!e.useBbb) }; });
  wrap('GET', '/events', (orig: Any) => (m: Any, b: Any, q: Any) => orig(m, b, q).map((r: Any) => { const e = DB().events.find((x: Any) => x.id === r.id); return e ? { ...r, ...extra(e) } : r; }));
  wrap('POST', '/events/([^/]+)/join', (orig: Any) => (m: Any, b: Any, q: Any) => {
    const u = me(); const e = ev(m[1]);
    if (!e.useBbb) return orig(m, b, q);
    const host = isHQ(u.id) || e.createdById === u.id; const r = regOf(e.id, u.id);
    if (!host && r?.status !== 'REGISTERED') throw E(403, 'not_registered', 'اول در کلاس ثبت‌نام کنید');
    if (!host && Date.now() < +new Date(e.startsAt) - 15 * 60_000) throw E(400, 'early', 'کلاس از ۱۵ دقیقه پیش از شروع باز می‌شود');
    if (Date.now() > +new Date(e.endsAt)) throw E(400, 'ended', 'این کلاس تمام شده است؛ اگر ضبط شده باشد، ضبطش همین‌جا می‌آید');
    // در نسخهٔ نمایشی کلاس واقعی نداریم: حضور کامل ثبت می‌شود و پیوند نمونه باز می‌شود
    const a = DB().liveAtt.find((x: Any) => x.eventId === e.id && x.userId === u.id);
    if (a) a.seconds = Math.max(a.seconds, 40 * 60); else DB().liveAtt.push({ eventId: e.id, userId: u.id, seconds: 40 * 60 });
    if (r) { r.attendedAt ??= now(); r.method ??= 'ONLINE'; }
    completeLive(u.id, e.id);
    return { url: 'https://example.org/live-class', live: true };
  });
  on('GET', '/events/([^/]+)/live', (m: Any) => {
    const u = me(); const e = ev(m[1]);
    const mine = DB().liveAtt.find((x: Any) => x.eventId === e.id && x.userId === u.id);
    const total = (+new Date(e.endsAt) - +new Date(e.startsAt)) / 1000; const see = canSee(u.id, e);
    return { useBbb: !!e.useBbb, record: !!e.record, available: true, finalized: !!e.liveFinalizedAt,
      attendance: mine ? { minutes: Math.round(mine.seconds / 60), needed: Math.ceil(total * 0.5 / 60), total: Math.round(total / 60) } : null,
      recordings: see ? DB().liveRecs.filter((r: Any) => r.eventId === e.id && !r.deletedAt).map((r: Any) => ({ id: r.recordId, durationSec: r.durationSec, startedAt: r.startedAt, expiresAt: r.expiresAt })) : [],
      canSeeRecordings: see };
  });
  on('POST', '/events/([^/]+)/recordings/([^/]+)', (m: Any) => {
    const u = me(); const e = ev(m[1]);
    if (!canSee(u.id, e)) throw E(403, 'forbidden', 'ضبط این کلاس فقط برای ثبت‌نامی‌هاست');
    const r = DB().liveRecs.find((x: Any) => x.eventId === e.id && x.recordId === m[2]);
    if (!r || r.deletedAt) throw E(404, 'no_recording', 'این ضبط دیگر نگه داشته نمی‌شود (بیش از ۶ ماه)');
    completeLive(u.id, e.id);
    return { url: 'https://example.org/recording' };
  });
  wrap('GET', '/manage/events/([^/]+)', (orig: Any) => (m: Any, b: Any, q: Any) => {
    const r = orig(m, b, q); const e = ev(m[1]);
    return { ...r, ...extra(e), people: e.useBbb ? r.people.map((p: Any) => ({ ...p, liveMinutes: Math.round((DB().liveAtt.find((x: Any) => x.eventId === e.id && x.userId === p.userId)?.seconds ?? 0) / 60) })) : r.people };
  });
  wrap('GET', '/manage/events/options', (orig: Any) => (m: Any, b: Any, q: Any) => ({ ...orig(m, b, q), bbb: true }));
  for (const mt of ['POST', 'PATCH'] as const) {
    const re = mt === 'POST' ? '/manage/events' : '/manage/events/([^/]+)';
    wrap(mt, re, (orig: Any) => (m: Any, b: Any, q: Any) => {
      const r = orig(m, b, q); const id = r?.id ?? m[1]; const e = DB().events.find((x: Any) => x.id === id);
      if (e && b.useBbb !== undefined) { e.useBbb = !!b.useBbb && e.kind === 'ONLINE'; e.record = e.useBbb && !!b.record; if (e.useBbb) e.onlineUrl = null; }
      return r;
    });
  }
  // انتشار برنامهٔ آنلاین: یا پیوند بیرونی یا کلاس روی سرور مدرسه
  wrap('POST', '/manage/events/([^/]+)/publish', (orig: Any) => (m: Any, b: Any, q: Any) => {
    const e = ev(m[1]);
    if (e.kind === 'ONLINE' && !e.onlineUrl && !e.useBbb) throw E(400, 'not_ready', 'پیش از انتشار کامل کنید: پیوند کلاس آنلاین یا «کلاس روی سرور مدرسه»');
    return orig(m, b, q);
  });
}
