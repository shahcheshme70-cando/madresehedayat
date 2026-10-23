import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, CheckCircle2, ChevronLeft, ClipboardCheck, Compass, Image, Inbox, MessageCircle, Search, Shuffle, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router';
import { Empty, ErrorBox, Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, fa, jDate, MISSION_LABEL } from '../lib/fa';
import { MissionMessages, PrivatePhoto } from './Lesson';
import { Composer, type Dm, Thread } from './Social';

interface RMe { positions: { id: string; title: string; layer: string; layerName: string; gender: string }[]; learnerCount: number; directCount: number; openReports: number; overdue: number }
interface LRow { id: string; name: string; county: string | null; mosque: string | null; responsible: string | null; direct: boolean; lastActivity: string | null; activeCourses: number; completedCourses: number; allowMessages: boolean }
interface QRow { learnerId: string; lessonId: string; learner: string; lessonTitle: string; courseTitle: string; status: string; submittedAt: string; reviewed: boolean; waitingDays: number; direct: boolean; responsible: string | null; overdue: boolean; hasPhoto: boolean }

const TABS = [
  { to: '/rahyar', label: 'پیشخوان', end: true },
  { to: '/rahyar/reports', label: 'گزارش‌ها' },
  { to: '/rahyar/learners', label: 'کنشگران' },
  { to: '/rahyar/messages', label: 'پیام‌ها' },
];

function RNav({ extra }: { extra?: boolean }) {
  return (
    <nav className="seg mb-6" aria-label="بخش‌های راهیاری">
      {[...TABS, ...(extra ? [{ to: '/rahyar/assign', label: 'تقسیم کنشگران' }] : []), { to: '/rahyar/tree', label: 'ساختار' }].map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex h-[34px] flex-none items-center rounded-[9px] px-3.5 text-sm font-semibold no-underline ${isActive ? 'bg-card text-ink shadow-sm' : 'text-body'}`}>{t.label}</NavLink>
      ))}
    </nav>
  );
}

const useRMe = () => useQuery({ queryKey: ['rahyar-me'], queryFn: () => api<RMe>('/rahyar/me') });
const isProvincialUp = (m?: RMe) => !!m?.positions.some((p) => p.layer !== 'COUNTY');

export function RahyarHome() {
  const me = useRMe();
  const q = useQuery({ queryKey: ['rahyar-reports', 'open'], queryFn: () => api<QRow[]>('/rahyar/reports?filter=open') });
  const recent = useQuery({ queryKey: ['rahyar-recent'], queryFn: () => api<{ id: string; name: string; createdAt: string }[]>('/rahyar/learners-recent') });
  if (me.isLoading) return <Spinner />;
  if (me.error) return <ErrorBox error={me.error} />;
  const m = me.data!;
  return (
    <div className="rise">
      <div className="mb-4"><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">راهیاری</h1><p className="mt-1 text-muted">{m.positions.map((p) => p.title).join('، ')}</p></div>
      <RNav extra={isProvincialUp(m)} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([[UsersRound, 'کنشگر در دامنه', m.learnerCount, ''], [Compass, 'مسئولیت مستقیم', m.directCount, ''], [Inbox, 'گزارش منتظر', m.openReports, m.openReports ? 'text-dome-ink' : ''], [AlarmClock, 'بیش از یک هفته', m.overdue, m.overdue ? 'text-rose' : '']] as const).map(([I, t, v, c]) => (
          <div key={t} className="card p-4"><I className={`size-5 ${c || 'text-leaf'}`} /><b className={`tnum mt-2 block text-2xl ${c || 'text-ink'}`}>{fa(v)}</b><span className="text-sm text-muted">{t}</span></div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">گزارش‌های منتظر بازخورد</h2><Link to="/rahyar/reports" className="text-sm font-bold text-leaf-ink">همه</Link></div>
          {q.isLoading ? <Spinner /> : q.data?.length ? <ReportList rows={q.data.slice(0, 6)} /> : <Empty icon={CheckCircle2} title="گزارش بی‌پاسخی ندارید">گزارش تازهٔ کنشگران اینجا و در اعلان‌ها می‌آید.</Empty>}
        </section>
        <section>
          <h2 className="mb-3 font-extrabold">تازه‌واردها</h2>
          <ul className="card divide-y divide-line">{(recent.data ?? []).map((r) => <li key={r.id}><Link to={`/rahyar/learners/${r.id}`} className="flex items-center justify-between px-4 py-3 text-sm no-underline hover:bg-sunken"><b className="text-ink">{r.name}</b><span className="text-muted">{ago(r.createdAt)}</span></Link></li>)}
            {!recent.data?.length && <li className="p-4 text-sm text-muted">هنوز کسی نیست.</li>}</ul>
        </section>
      </div>
    </div>
  );
}

function ReportList({ rows }: { rows: QRow[] }) {
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.learnerId + r.lessonId}>
          <Link to={`/rahyar/reports/${r.learnerId}/${r.lessonId}`} className="card flex items-center gap-3 p-4 no-underline hover:border-line-strong">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-dome-soft font-extrabold text-dome-ink">{r.learner[0]}</span>
            <div className="min-w-0 flex-1"><b className="block truncate text-ink">{r.learner}</b><span className="block truncate text-sm text-muted">{r.lessonTitle} · {r.courseTitle}</span>
              {!r.direct && r.responsible && <span className="text-xs text-flame-ink">مسئول مستقیم: {r.responsible}</span>}</div>
            <div className="grid justify-items-end gap-1">
              <span className={`chip ${r.status === 'approved' ? 'chip-leaf' : r.status === 'needs_revision' ? 'chip-flame' : r.overdue ? 'chip-rose' : 'chip-dome'}`}>{r.reviewed || !['submitted', 'pending'].includes(r.status) ? MISSION_LABEL[r.status] : r.waitingDays ? `${fa(r.waitingDays)} روز منتظر` : 'امروز'}</span>
              {r.hasPhoto && <Image className="size-4 text-muted" aria-label="عکس دارد" />}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RahyarReports() {
  const me = useRMe();
  const [f, setF] = useState<'open' | 'all'>('open');
  const q = useQuery({ queryKey: ['rahyar-reports', f], queryFn: () => api<QRow[]>(`/rahyar/reports?filter=${f}`) });
  return (
    <div className="rise">
      <h1 className="mb-4 text-[clamp(22px,3vw,30px)] font-extrabold">گزارش مأموریت‌ها</h1>
      <RNav extra={isProvincialUp(me.data)} />
      <div className="seg mb-4">{([['open', 'منتظر بازخورد'], ['all', 'همه']] as const).map(([k, t]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{t}</button>)}</div>
      {f === 'open' && <p className="hint mb-3">گزارش‌های کنشگرانی که مستقیم مسئولشان هستید، به‌علاوهٔ گزارش‌هایی از زیرمجموعه که بیش از یک هفته بی‌پاسخ مانده‌اند.</p>}
      {q.isLoading ? <Spinner /> : q.data?.length ? <ReportList rows={q.data} /> : <Empty icon={ClipboardCheck} title="گزارشی نیست" />}
    </div>
  );
}

interface RThread { lesson: { id: string; title: string; goal?: string }; course: { title: string; missionRule: string }; learner: { id: string; firstName: string; lastName: string }; data: any; messages: any[] }

export function RahyarReport() {
  const { learnerId = '', lessonId = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['rthread', learnerId, lessonId], queryFn: () => api<RThread>(`/rahyar/reports/${learnerId}/${lessonId}`) });
  const [body, setBody] = useState('');
  const [sample, setSample] = useState(false);
  const m = useMutation({
    mutationFn: (kind: 'FEEDBACK' | 'REVISE' | 'APPROVE') => api<{ status: string }>(`/rahyar/reports/${learnerId}/${lessonId}`, { body: { kind, body, proposeSample: kind === 'APPROVE' && sample } }),
    onSuccess: (_r, kind) => { setBody(''); qc.invalidateQueries({ queryKey: ['rthread', learnerId, lessonId] }); qc.invalidateQueries({ queryKey: ['rahyar-reports'] }); qc.invalidateQueries({ queryKey: ['rahyar-me'] }); toast(kind === 'APPROVE' ? 'تأیید شد' : kind === 'REVISE' ? 'برای اصلاح برگشت' : 'بازخورد فرستاده شد'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const t = q.data!;
  const d = t.data ?? {};
  const photos = [d.mainPhoto, ...(d.evidence ?? [])].filter(Boolean) as string[];
  const open = d.status && d.status !== 'approved';
  return (
    <div className="rise mx-auto grid max-w-3xl gap-5">
      <Link to="/rahyar/reports" className="text-sm font-bold text-leaf-ink">→ گزارش‌ها</Link>
      <header>
        <h1 className="text-[clamp(20px,2.6vw,26px)] font-extrabold">{t.lesson.title}</h1>
        <p className="mt-1 text-muted"><Link to={`/rahyar/learners/${t.learner.id}`} className="font-bold text-leaf-ink">{t.learner.firstName} {t.learner.lastName}</Link> · {t.course.title}</p>
        <div className="mt-2 flex flex-wrap gap-2">{d.status && <span className="chip chip-dome">{MISSION_LABEL[d.status]}</span>}{t.course.missionRule === 'ON_APPROVAL' && <span className="chip">تکمیل با تأیید راهیار</span>}{d.round > 1 && <span className="chip">نوبت {fa(d.round)}</span>}</div>
      </header>
      {t.lesson.goal && <p className="rounded-2xl bg-flame-soft p-4 text-ink"><b className="text-flame-ink">مأموریت: </b>{t.lesson.goal}</p>}
      {photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map((k) => <div key={k} className="w-40"><PrivatePhoto k={k} alt="عکس گزارش" /></div>)}</div>}
      <MissionMessages messages={t.messages} learnerId={t.learner.id} />
      {open && (
        <div className="card grid gap-3 p-5">
          <label htmlFor="fb" className="font-bold text-ink">پاسخ شما</label>
          <textarea id="fb" className="input min-h-28" placeholder="چه چیزی خوب بود؟ قدم بعدی چیست؟" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate('APPROVE')}><CheckCircle2 className="size-4" />تأیید{body.trim() ? ' با این پیام' : ''}</button>
            <button className="btn btn-secondary" disabled={!body.trim() || m.isPending} onClick={() => m.mutate('FEEDBACK')}>فقط بازخورد</button>
            <button className="btn btn-ghost text-flame-ink" disabled={!body.trim() || m.isPending} onClick={() => m.mutate('REVISE')}>برگرداندن برای اصلاح</button>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-[var(--leaf)]" checked={sample} onChange={(e) => setSample(e.target.checked)} /><span>با تأیید، پیشنهاد بده این گزارش «نمونه» شود <span className="text-muted">(فقط با اجازهٔ خود کنشگر و تأیید ستاد منتشر می‌شود)</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-[var(--leaf)]" checked={sample} onChange={(e) => setSample(e.target.checked)} /><span>با تأیید، پیشنهاد بده این گزارش «نمونه» شود <span className="text-muted">(فقط با اجازهٔ خود کنشگر و تأیید ستاد منتشر می‌شود)</span></span></label>
          <p className="hint">بازخورد کوتاه و مشخص بهتر از تأیید خالی است. «برگرداندن» یعنی کنشگر گزارش را کامل می‌کند و دوباره می‌فرستد.</p>
        </div>
      )}
    </div>
  );
}

export function RahyarLearners() {
  const me = useRMe();
  const [term, setTerm] = useState('');
  const q = useQuery({ queryKey: ['rahyar-learners'], queryFn: () => api<LRow[]>('/rahyar/learners') });
  const [only, setOnly] = useState<'all' | 'direct' | 'idle'>('all');
  const rows = (q.data ?? []).filter((r) => (!term || r.name.includes(term)) && (only === 'all' || (only === 'direct' ? r.direct : !r.lastActivity || Date.now() - +new Date(r.lastActivity) > 14 * 86400_000)));
  return (
    <div className="rise">
      <h1 className="mb-4 text-[clamp(22px,3vw,30px)] font-extrabold">کنشگران</h1>
      <RNav extra={isProvincialUp(me.data)} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs"><Search className="absolute end-3 top-3.5 size-4 text-muted" /><input className="input !pe-9" placeholder="جست‌وجوی نام" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
        <div className="seg">{([['all', 'همه'], ['direct', 'مسئولیت مستقیم'], ['idle', 'دو هفته بی‌فعالیت']] as const).map(([k, t]) => <button key={k} aria-pressed={only === k} onClick={() => setOnly(k)}>{t}</button>)}</div>
      </div>
      {q.isLoading ? <Spinner /> : rows.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-muted"><th className="px-4 py-3 text-start font-semibold">نام</th><th className="text-start font-semibold">شهرستان / مسجد</th><th className="font-semibold">در حال گذراندن</th><th className="font-semibold">تمام‌شده</th><th className="font-semibold">آخرین فعالیت</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sunken">
                <td className="px-4 py-3"><Link to={`/rahyar/learners/${r.id}`} className="font-bold text-ink no-underline">{r.name}</Link>{!r.direct && <span className="block text-xs text-muted">{r.responsible}</span>}</td>
                <td className="text-muted">{[r.county, r.mosque].filter(Boolean).join(' · ')}</td>
                <td className="tnum text-center">{fa(r.activeCourses)}</td><td className="tnum text-center">{fa(r.completedCourses)}</td>
                <td className="text-center text-muted">{r.lastActivity ? ago(r.lastActivity) : 'هنوز شروع نکرده'}</td>
                <td className="px-2 text-end"><Link to={`/rahyar/learners/${r.id}`} className="btn btn-ghost btn-icon btn-sm" aria-label="جزئیات"><ChevronLeft className="size-4" /></Link></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty icon={UsersRound} title="کسی پیدا نشد" />}
    </div>
  );
}

export function RahyarLearner() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['rahyar-learner', id], queryFn: () => api<any>(`/rahyar/learners/${id}`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const p = q.data;
  return (
    <div className="rise mx-auto grid max-w-4xl gap-6">
      <Link to="/rahyar/learners" className="text-sm font-bold text-leaf-ink">→ کنشگران</Link>
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-leaf-soft text-xl font-extrabold text-leaf-ink">{p.firstName[0]}</span>
        <div className="flex-1"><h1 className="text-2xl font-extrabold">{p.firstName} {p.lastName}</h1><p className="text-muted">عضو از {jDate(p.createdAt)}{p.nearMosque ? ` · ${p.nearMosque}` : ''}</p></div>
        {p.allowRahyarMessages ? <Link to={`/rahyar/messages/${p.id}`} className="btn btn-secondary"><MessageCircle className="size-4" />پیام</Link> : <span className="hint">پیام راهیار را خاموش کرده</span>}
      </header>
      <div className="grid grid-cols-3 gap-3">
        {[['دوره در جریان', p.courses.filter((c: any) => !c.me?.completedAt).length], ['دورهٔ تمام‌شده', p.courses.filter((c: any) => c.me?.completedAt).length], ['حضور در برنامه', p.attended]].map(([t, v]) => (
          <div key={t} className="card p-4 text-center"><b className="tnum block text-2xl text-ink">{fa(v)}</b><span className="text-sm text-muted">{t}</span></div>
        ))}
      </div>
      <section><h2 className="mb-3 font-extrabold">دوره‌ها</h2>
        <ul className="grid gap-2">{p.courses.map((c: any) => (
          <li key={c.id} className="card flex items-center gap-3 p-4"><b className="flex-1 text-ink">{c.title}</b>
            {c.me?.completedAt ? <span className="chip chip-leaf">تمام شد</span> : <><div className="bar w-28"><span style={{ width: `${c.me?.percent ?? 0}%` }} /></div><span className="tnum text-sm">٪{fa(c.me?.percent ?? 0)}</span></>}</li>
        ))}{!p.courses.length && <li className="text-sm text-muted">هنوز در دوره‌ای ثبت‌نام نکرده.</li>}</ul>
      </section>
      <section><h2 className="mb-3 font-extrabold">مأموریت‌ها</h2>{p.missions.length ? <ReportList rows={p.missions} /> : <p className="text-sm text-muted">گزارشی نفرستاده.</p>}</section>
      <p className="hint">نمرهٔ آزمون‌ها و برگه‌های کار به راهیار نشان داده نمی‌شود.</p>
    </div>
  );
}

export function RahyarMessages() {
  const me = useRMe();
  const q = useQuery({ queryKey: ['rahyar-dms'], queryFn: () => api<{ learnerId: string; name: string; last: string; at: string; unread: number }[]>('/rahyar/messages'), refetchInterval: 30_000 });
  return (
    <div className="rise">
      <h1 className="mb-4 text-[clamp(22px,3vw,30px)] font-extrabold">پیام‌ها</h1>
      <RNav extra={isProvincialUp(me.data)} />
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <ul className="card divide-y divide-line">{q.data.map((c) => (
          <li key={c.learnerId}><Link to={`/rahyar/messages/${c.learnerId}`} className="flex items-center gap-3 px-4 py-3.5 no-underline hover:bg-sunken">
            <span className="grid size-10 place-items-center rounded-full bg-leaf-soft font-extrabold text-leaf-ink">{c.name[0]}</span>
            <span className="min-w-0 flex-1"><b className="block text-ink">{c.name}</b><span className="block truncate text-sm text-muted">{c.last}</span></span>
            <span className="grid justify-items-end gap-1 text-xs text-muted">{ago(c.at)}{c.unread > 0 && <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-leaf px-1.5 font-bold text-white">{fa(c.unread)}</span>}</span>
          </Link></li>
        ))}</ul>
      ) : <Empty icon={MessageCircle} title="پیامی نیست">کنشگران از صفحهٔ «پیام با راهیار» به شما پیام می‌دهند. شمارهٔ همراه هیچ‌کدام به دیگری نشان داده نمی‌شود.</Empty>}
    </div>
  );
}

export function RahyarConversation() {
  const { learnerId = '' } = useParams();
  const { me } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['rahyar-dm', learnerId], queryFn: () => api<{ learner: { id: string; name: string; allowMessages: boolean }; messages: Dm[] }>(`/rahyar/messages/${learnerId}`), refetchInterval: 30_000 });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  return (
    <div className="rise mx-auto grid max-w-2xl gap-4">
      <Link to="/rahyar/messages" className="text-sm font-bold text-leaf-ink">→ پیام‌ها</Link>
      <h1 className="text-xl font-extrabold">{d.learner.name}</h1>
      <div className="card grid gap-4 p-4">
        <Thread messages={d.messages} meId={me!.id} empty="هنوز پیامی رد و بدل نشده." />
        {d.learner.allowMessages ? <Composer onSend={async (t) => { await api(`/rahyar/messages/${learnerId}`, { body: { body: t } }); qc.invalidateQueries({ queryKey: ['rahyar-dm', learnerId] }); }} />
          : <p className="hint">این کنشگر پیام‌دادن راهیار را خاموش کرده است؛ اگر خودش پیام بدهد، در همین‌جا می‌بینید.</p>}
      </div>
    </div>
  );
}

export function RahyarAssign() {
  const me = useRMe();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['unassigned'], queryFn: () => api<{ id: string; firstName: string; lastName: string; options: { id: string; title: string }[] }[]>('/rahyar/unassigned') });
  const m = useMutation({ mutationFn: (v: { userId: string; positionId: string }) => api('/rahyar/assignments', { method: 'PUT', body: { userIds: [v.userId], positionId: v.positionId } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['unassigned'] }); toast('سپرده شد'); } });
  return (
    <div className="rise">
      <h1 className="mb-4 text-[clamp(22px,3vw,30px)] font-extrabold">تقسیم کنشگران</h1>
      <RNav extra={isProvincialUp(me.data)} />
      <p className="mb-4 max-w-2xl text-muted">شهرستان‌هایی که بیش از یک راهیار دارند. هر کنشگر را به یکی بسپارید؛ تا سپرده نشده، مسئولش راهیار استان است.</p>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <ul className="grid gap-2">{q.data.map((u) => (
          <li key={u.id} className="card flex flex-wrap items-center gap-3 p-4"><b className="flex-1 text-ink">{u.firstName} {u.lastName}</b>
            <select className="input w-auto min-w-48" defaultValue="" onChange={(e) => e.target.value && m.mutate({ userId: u.id, positionId: e.target.value })}>
              <option value="" disabled>سپردن به…</option>{u.options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></li>
        ))}</ul>
      ) : <Empty icon={Shuffle} title="کسی منتظر تقسیم نیست" />}
    </div>
  );
}
