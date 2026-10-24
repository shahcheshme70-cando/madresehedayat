import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Award, CalendarRange, CheckCircle2, Circle, Flag, Plus, Target, Trash2, Users, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { JalaliInput } from '../components/JalaliInput';
import { useFeedbackContext } from '../components/Feedback';
import { Dialog, Empty, ErrorBox, Progress, Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { fa, jDate, toEn } from '../lib/fa';

/* ═════════════ پویش: حرکت جمعی زمان‌دار، بدون رتبه‌بندی افراد ═════════════ */

type Phase = 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
const PHASE: Record<Phase, [string, string]> = { DRAFT: ['', 'پیش‌نویس'], UPCOMING: ['chip-dome', 'به‌زودی'], ACTIVE: ['chip-leaf', 'در جریان'], ENDED: ['', 'تمام‌شده'], CANCELLED: ['chip-rose', 'لغو شد'] };
const SCOPE = (c: { scope: string; province?: string | null; org?: string | null }) => (c.scope === 'NATIONAL' ? 'کشوری' : c.scope === 'ORG' ? `ویژهٔ اعضای ${c.org ?? 'سازمان'}` : `استان ${c.province ?? ''}`);
const daysTo = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);
const when = (c: { phase: Phase; startsAt: string; endsAt: string }) =>
  c.phase === 'UPCOMING' ? `${fa(daysTo(c.startsAt))} روز تا شروع` : c.phase === 'ACTIVE' ? `${fa(Math.max(0, daysTo(c.endsAt)))} روز مانده` : `${jDate(c.startsAt)} تا ${jDate(c.endsAt)}`;

interface Card { id: string; title: string; summary: string; scope: string; province: string | null; org: string | null; goal: number | null; startsAt: string; endsAt: string; phase: Phase; members: number; done: number; tasks: number; joined: boolean; myDone: number }
interface MapCell { id: string; name: string; members: number; done: number }
interface Detail {
  id: string; title: string; summary: string; body: string | null; scope: string; province: string | null; org: string | null; goal: number | null; startsAt: string; endsAt: string; status: string; phase: Phase; canManage: boolean;
  joined: boolean; viaCore: string | null; badge: boolean;
  tasks: { id: string; title: string; body: string | null; count: number; done: boolean; note: string | null; doneAt: string | null }[];
  totals: { members: number; done: number; cores: number }; map: MapCell[]; cores: { id: string; name: string; joined: boolean }[];
}

/** شمار جمعی به سوی هدف */
function GoalBar({ done, goal }: { done: number; goal: number | null }) {
  if (!goal) return null;
  return <div className="grid gap-1"><Progress value={Math.min(100, Math.round((done / goal) * 100))} label="پیشرفت به سوی هدف جمعی" /><span className="text-xs text-muted">{fa(done)} از هدف {fa(goal)} کار</span></div>;
}

export function CampaignCard({ c }: { c: Card }) {
  return (
    <Link to={`/campaigns/${c.id}`} className="card grid gap-3 p-5 no-underline hover:border-line-strong">
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`chip ${PHASE[c.phase][0]}`}>{PHASE[c.phase][1]}</span><span className="text-muted">{SCOPE(c)}</span><span className="text-muted">· {when(c)}</span></div>
      <b className="text-lg text-ink">{c.title}</b>
      <p className="line-clamp-2 text-sm text-body">{c.summary}</p>
      <GoalBar done={c.done} goal={c.goal} />
      <div className="flex flex-wrap gap-3 text-sm text-muted"><span className="flex items-center gap-1"><Users className="size-4" />{fa(c.members)} نفر</span><span className="flex items-center gap-1"><CheckCircle2 className="size-4" />{fa(c.done)} کار انجام‌شده</span>
        {c.joined && <span className="chip chip-leaf">پیوسته‌اید · {fa(c.myDone)} از {fa(c.tasks)}</span>}</div>
    </Link>
  );
}

export function useCampaigns() { return useQuery({ queryKey: ['campaigns'], queryFn: () => api<Card[]>('/campaigns') }); }

export default function CampaignList() {
  const q = useCampaigns();
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const live = q.data!.filter((c) => c.phase === 'ACTIVE' || c.phase === 'UPCOMING');
  const past = q.data!.filter((c) => c.phase === 'ENDED' || c.phase === 'CANCELLED');
  return (
    <div className="rise grid gap-8">
      <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">پویش‌ها</h1><p className="mt-1 max-w-2xl text-muted">حرکت‌های جمعی چندروزه با کارهای کوتاه. هر کاری که انجام دهید به شمار جمعی اضافه می‌شود؛ رتبه‌بندی فردی نداریم.</p></div>
      {live.length ? <div className="grid gap-3 md:grid-cols-2">{live.map((c) => <CampaignCard key={c.id} c={c} />)}</div> : <Empty icon={Flag} title="الان پویشی در جریان نیست">پویش تازه که اعلام شود، با اعلان خبر می‌دهیم.</Empty>}
      {past.length > 0 && <section className="grid gap-3"><h2 className="text-lg font-extrabold">پویش‌های اخیر</h2><div className="grid gap-3 md:grid-cols-2">{past.map((c) => <CampaignCard key={c.id} c={c} />)}</div></section>}
    </div>
  );
}

/* ───────── نقشهٔ مشارکت استان‌ها (کاشی‌های تقریباً هم‌جای جغرافیایی) ───────── */
const TILE: Record<string, [number, number]> = {
  'آذربایجان شرقی': [1, 0], 'اردبیل': [2, 0],
  'آذربایجان غربی': [0, 1], 'زنجان': [1, 1], 'گیلان': [2, 1], 'مازندران': [3, 1], 'گلستان': [4, 1], 'خراسان شمالی': [5, 1],
  'کردستان': [0, 2], 'قزوین': [1, 2], 'البرز': [2, 2], 'تهران': [3, 2], 'سمنان': [4, 2], 'خراسان رضوی': [5, 2],
  'کرمانشاه': [0, 3], 'همدان': [1, 3], 'مرکزی': [2, 3], 'قم': [3, 3],
  'ایلام': [0, 4], 'لرستان': [1, 4], 'چهارمحال و بختیاری': [2, 4], 'اصفهان': [3, 4], 'یزد': [4, 4], 'خراسان جنوبی': [5, 4],
  'خوزستان': [1, 5], 'کهگیلویه و بویراحمد': [2, 5], 'فارس': [3, 5], 'کرمان': [4, 5], 'سیستان و بلوچستان': [5, 5],
  'بوشهر': [2, 6], 'هرمزگان': [4, 6],
};
const SHORT: Record<string, string> = { 'آذربایجان شرقی': 'آذر. شرقی', 'آذربایجان غربی': 'آذر. غربی', 'چهارمحال و بختیاری': 'چهارمحال', 'کهگیلویه و بویراحمد': 'کهگیلویه', 'سیستان و بلوچستان': 'سیستان', 'خراسان شمالی': 'خراسان ش.', 'خراسان جنوبی': 'خراسان ج.', 'خراسان رضوی': 'خراسان ر.' };
export function ProvinceMap({ cells }: { cells: MapCell[] }) {
  const max = Math.max(1, ...cells.map((c) => c.members));
  const placed = cells.filter((c) => TILE[c.name]);
  if (placed.length <= 1) return (
    <ul className="grid gap-2 sm:grid-cols-2">{cells.map((c) => <li key={c.id} className="flex justify-between rounded-xl bg-sunken px-3 py-2 text-sm"><b className="text-ink">{c.name}</b><span>{fa(c.members)} نفر · {fa(c.done)} کار</span></li>)}</ul>
  );
  return (
    <div>
      <div dir="ltr" className="mx-auto grid max-w-xl grid-cols-6 gap-1 sm:gap-1.5" role="img" aria-label="نقشهٔ مشارکت استان‌ها">
        {Array.from({ length: 7 }).flatMap((_, r) => Array.from({ length: 6 }).map((__, col) => {
          const c = placed.find((x) => TILE[x.name][0] === col && TILE[x.name][1] === r);
          if (!c) return <span key={`${r}-${col}`} />;
          const pct = c.members ? 18 + Math.round((c.members / max) * 72) : 0;
          return (
            <span key={c.id} dir="rtl" title={`${c.name}: ${fa(c.members)} نفر، ${fa(c.done)} کار`}
              className={`grid aspect-[4/3] min-w-0 place-content-center rounded-lg px-0.5 text-center text-[10px] leading-tight sm:text-xs ${pct > 55 ? 'text-white' : 'text-ink'}`}
              style={{ background: pct ? `color-mix(in srgb, var(--leaf) ${pct}%, var(--sunken))` : 'var(--sunken)' }}>
              <span className="truncate font-semibold">{SHORT[c.name] ?? c.name}</span>{c.members > 0 && <span className="tnum opacity-90">{fa(c.members)}</span>}
            </span>
          );
        }))}
      </div>
      <p className="hint mt-2">رنگ پررنگ‌تر = نفرات بیشتر. عدد هر خانه شمار شرکت‌کنندگان آن استان است.</p>
    </div>
  );
}

export function CampaignPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['campaign', id], queryFn: () => api<Detail>(`/campaigns/${id}`) });
  useFeedbackContext({ campaignId: id });
  const [note, setNote] = useState<{ taskId: string; text: string } | null>(null);
  const [coreDlg, setCoreDlg] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['campaign', id] }); qc.invalidateQueries({ queryKey: ['campaigns'] }); qc.invalidateQueries({ queryKey: ['badges'] }); };
  const err = (e: unknown) => toast((e as Error).message, 'err');
  const join = useMutation({ mutationFn: () => api(`/campaigns/${id}/join`, { method: 'POST' }), onSuccess: () => { refresh(); toast('به پویش پیوستید'); }, onError: err });
  const leave = useMutation({ mutationFn: () => api(`/campaigns/${id}/leave`, { method: 'POST' }), onSuccess: () => { refresh(); toast('از پویش بیرون آمدید'); }, onError: err });
  const joinCore = useMutation({ mutationFn: (coreId: string) => api<{ added: number; skipped: number }>(`/campaigns/${id}/join-core`, { body: { coreId } }),
    onSuccess: (r) => { refresh(); setCoreDlg(false); toast(r.skipped ? `${fa(r.added)} نفر پیوستند؛ ${fa(r.skipped)} نفر از استان دیگرند و نمی‌توانند` : `هسته پیوست؛ ${fa(r.added)} نفر تازه`); }, onError: err });
  const done = useMutation({ mutationFn: (v: { taskId: string; note?: string }) => api(`/campaigns/${id}/tasks/${v.taskId}`, { body: { note: v.note } }), onSuccess: () => { refresh(); setNote(null); }, onError: err });
  const undo = useMutation({ mutationFn: (taskId: string) => api(`/campaigns/${id}/tasks/${taskId}`, { method: 'DELETE' }), onSuccess: refresh, onError: err });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data!;
  const open = c.phase === 'ACTIVE';
  const mineDone = c.tasks.filter((t) => t.done).length;
  return (
    <div className="rise grid gap-8">
      <nav className="text-sm text-muted"><Link to="/campaigns" className="text-leaf-ink">پویش‌ها</Link> / {c.title}</nav>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className={`chip ${PHASE[c.phase][0]}`}>{PHASE[c.phase][1]}</span><span className="text-muted">{SCOPE(c)}</span>
            <span className="flex items-center gap-1 text-muted"><CalendarRange className="size-4" />{jDate(c.startsAt)} تا {jDate(c.endsAt)}</span></div>
          <h1 className="text-[clamp(24px,3.4vw,36px)] font-extrabold">{c.title}</h1>
          <p className="text-lg text-body">{c.summary}</p>
          {c.body && <p className="prose-fa whitespace-pre-line">{c.body}</p>}
          {c.canManage && <Link to={`/manage/campaigns/${c.id}`} className="btn btn-secondary btn-sm w-fit">مدیریت و آمار این پویش</Link>}
        </div>
        <aside className="card grid content-start gap-4 p-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['شرکت‌کننده', c.totals.members], ['کار انجام‌شده', c.totals.done], ['هستهٔ همراه', c.totals.cores]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-sunken p-2"><b className="tnum block text-xl text-ink">{fa(v as number)}</b><span className="text-xs text-muted">{l}</span></div>)}
          </div>
          <GoalBar done={c.totals.done} goal={c.goal} />
          {c.badge && <div className="flex items-center gap-2 rounded-xl bg-flame-soft p-3 text-sm text-flame-ink"><Award className="size-5" />نشان مشارکت این پویش را گرفته‌اید</div>}
          {c.joined ? (
            <div className="grid gap-2 text-sm"><span className="chip chip-leaf w-fit">پیوسته‌اید{c.viaCore ? ` با «${c.viaCore}»` : ''} · {fa(mineDone)} از {fa(c.tasks.length)} کار</span>
              {c.phase !== 'ENDED' && !mineDone && <button className="btn btn-ghost btn-sm w-fit" onClick={() => leave.mutate()}>بیرون آمدن از پویش</button>}</div>
          ) : (c.phase === 'ACTIVE' || c.phase === 'UPCOMING') && <button className="btn btn-primary" disabled={join.isPending} onClick={() => join.mutate()}><Flag className="size-4" />می‌پیوندم</button>}
          {c.cores.length > 0 && (c.phase === 'ACTIVE' || c.phase === 'UPCOMING') && <button className="btn btn-secondary" onClick={() => setCoreDlg(true)}><UsersRound className="size-4" />پیوستن با هسته</button>}
          {c.phase === 'UPCOMING' && <p className="hint">از حالا بپیوندید؛ کارها از روز شروع ثبت می‌شوند.</p>}
        </aside>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-extrabold">کارهای پویش</h2>
        <ol className="grid gap-2">{c.tasks.map((t, i) => (
          <li key={t.id} className={`card flex items-start gap-3 p-4 ${t.done ? 'border-leaf' : ''}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken font-extrabold tnum text-ink">{fa(i + 1)}</span>
            <div className="min-w-0 flex-1"><b className="block text-ink">{t.title}</b>{t.body && <p className="mt-1 whitespace-pre-line text-sm text-body">{t.body}</p>}
              <span className="mt-1 block text-xs text-muted">{fa(t.count)} نفر انجامش داده‌اند</span>
              {t.done && t.note && <p className="mt-2 rounded-xl bg-sunken p-2 text-sm">یادداشت شما (فقط برای خودتان): {t.note}</p>}</div>
            {c.joined && (t.done
              ? <button className="btn btn-ghost btn-sm text-leaf-ink" disabled={!open || undo.isPending} onClick={() => undo.mutate(t.id)} aria-label={`برداشتن علامت «${t.title}»`}><CheckCircle2 className="size-5" />انجام دادم</button>
              : <button className="btn btn-secondary btn-sm" disabled={!open} onClick={() => setNote({ taskId: t.id, text: '' })}><Circle className="size-4" />انجام دادم</button>)}
          </li>))}</ol>
        {!c.joined && (c.phase === 'ACTIVE' || c.phase === 'UPCOMING') && <p className="hint">برای علامت زدن کارها اول به پویش بپیوندید.</p>}
      </section>

      {c.map.length > 0 && <section className="grid gap-3"><h2 className="text-lg font-extrabold">{c.scope === 'NATIONAL' ? 'مشارکت استان‌ها' : 'مشارکت'}</h2><div className="card p-4"><ProvinceMap cells={c.map} /></div></section>}

      <Dialog open={!!note} onClose={() => setNote(null)} title="ثبت انجام کار">
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); done.mutate({ taskId: note!.taskId, note: note!.text.trim() || undefined }); }}>
          <p className="text-body">{c.tasks.find((t) => t.id === note?.taskId)?.title}</p>
          <div className="field"><label htmlFor="cn">یادداشت برای خودتان <span className="font-normal text-muted">(اختیاری؛ کسی جز شما نمی‌بیند)</span></label>
            <textarea id="cn" className="input" maxLength={1000} value={note?.text ?? ''} onChange={(e) => setNote({ ...note!, text: e.target.value })} placeholder="مثلاً با کی حرف زدم، چه شد" /></div>
          <button className="btn btn-primary" disabled={done.isPending}>ثبت</button>
        </form>
      </Dialog>
      <Dialog open={coreDlg} onClose={() => setCoreDlg(false)} title="پیوستن با هسته">
        <div className="grid gap-3">
          <p className="text-body">همهٔ اعضای هسته یک‌جا به پویش می‌پیوندند و خبردار می‌شوند. اگر بعداً عضو تازه آمد، دوباره بزنید.</p>
          {c.cores.map((k) => <button key={k.id} className="btn btn-secondary justify-between" disabled={joinCore.isPending} onClick={() => joinCore.mutate(k.id)}>{k.name}<span className="text-xs text-muted">{k.joined ? 'پیوسته؛ افزودن اعضای تازه' : 'پیوستن'}</span></button>)}
        </div>
      </Dialog>
    </div>
  );
}

/** نشان‌های مشارکت در «من» */
export function Badges() {
  const q = useQuery({ queryKey: ['badges'], queryFn: () => api<{ id: string; title: string; endsAt: string; done: number }[]>('/campaigns/badges') });
  if (!q.data?.length) return null;
  return (
    <section>
      <h2 className="mb-4 text-lg font-extrabold">نشان‌های مشارکت</h2>
      <div className="flex flex-wrap gap-3">{q.data.map((b) => (
        <Link key={b.id} to={`/campaigns/${b.id}`} className="card flex items-center gap-3 p-3 no-underline"><Award className="size-9 rounded-xl bg-flame-soft p-2 text-flame-ink" /><span><b className="block text-sm text-ink">{b.title}</b><span className="text-xs text-muted">{fa(b.done)} کار · {jDate(b.endsAt)}</span></span></Link>))}</div>
    </section>
  );
}

/* ───────── سازنده: ستاد، راهیار استانی، مدیر سازمان ───────── */
const useMBase = () => (useLocation().pathname.startsWith('/admin') ? '/admin/campaigns' : '/manage/campaigns');
interface MRow { id: string; title: string; scope: string; province: string | null; status: string; phase: Phase; startsAt: string; endsAt: string; goal: number | null; members: number; done: number }
interface Opts { national: boolean; provinces: { id: string; name: string }[]; orgs: { id: string; name: string }[] }

export function ManageCampaigns() {
  const base = useMBase();
  const q = useQuery({ queryKey: ['manage-campaigns'], queryFn: () => api<MRow[]>('/manage/campaigns'), retry: false });
  return (
    <div className="rise grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">پویش‌ها</h1><p className="mt-1 max-w-2xl text-muted">پویش بسازید، کارهای کوتاهش را بنویسید و منتشر کنید. مخاطبان با اعلان خبردار می‌شوند. آمار فقط جمعی است.</p></div>
        {!q.error && <Link to={`${base}/new`} className="btn btn-primary"><Plus className="size-4" />پویش تازه</Link>}
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data?.length ? (
        <ul className="grid gap-2">{q.data.map((c) => (
          <li key={c.id}><Link to={`${base}/${c.id}`} className="card flex flex-wrap items-center gap-3 p-4 no-underline hover:border-line-strong">
            <div className="min-w-0 flex-1"><b className="block text-ink">{c.title}</b><span className="text-sm text-muted">{SCOPE(c)} · {jDate(c.startsAt)} تا {jDate(c.endsAt)}</span></div>
            <span className={`chip ${PHASE[c.phase][0]}`}>{PHASE[c.phase][1]}</span><span className="chip">{fa(c.members)} نفر</span><span className="chip chip-leaf">{fa(c.done)} کار{c.goal ? ` از ${fa(c.goal)}` : ''}</span>
          </Link></li>))}</ul>
      ) : <Empty icon={Flag} title="هنوز پویشی نساخته‌اید" />}
    </div>
  );
}

export function CampaignEditor() {
  const { id } = useParams();
  const base = useMBase(); const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const opts = useQuery({ queryKey: ['campaign-options'], queryFn: () => api<Opts>('/manage/campaigns/options') });
  const ex = useQuery({ queryKey: ['manage-campaign', id], queryFn: () => api<any>(`/manage/campaigns/${id}`), enabled: !!id });
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (id && ex.data) { const c = ex.data; setF({ title: c.title, summary: c.summary, body: c.body ?? '', scope: c.scope, provinceId: c.provinceId ?? '', networkId: c.networkId ?? '', goal: c.goal ? String(c.goal) : '', startsAt: c.startsAt, endsAt: c.endsAt, tasks: c.tasks.map((t: any) => ({ id: t.id, title: t.title, body: t.body ?? '' })) }); }
    else if (!id && opts.data) {
      const o = opts.data; const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() + 1);
      setF({ title: '', summary: '', body: '', scope: o.national ? 'NATIONAL' : o.provinces.length ? 'PROVINCE' : 'ORG', provinceId: o.national ? '' : o.provinces[0]?.id ?? '', networkId: !o.national && !o.provinces.length ? o.orgs[0]?.id ?? '' : '',
        goal: '', startsAt: s.toISOString(), endsAt: new Date(s.getTime() + 10 * 864e5).toISOString(), tasks: [{ title: '', body: '' }] });
    }
  }, [id, ex.data, opts.data]);
  const save = useMutation({
    mutationFn: () => { const body = { ...f, goal: f.goal ? Number(toEn(f.goal)) : undefined, provinceId: f.scope === 'PROVINCE' ? f.provinceId : undefined, networkId: f.scope === 'ORG' ? f.networkId : undefined, body: f.body || undefined,
      tasks: f.tasks.filter((t: any) => t.title.trim()).map((t: any) => ({ ...(t.id ? { id: t.id } : {}), title: t.title.trim(), body: t.body?.trim() || undefined })) };
      return id ? api(`/manage/campaigns/${id}`, { method: 'PATCH', body }) : api<{ id: string }>('/manage/campaigns', { body }); },
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['manage-campaigns'] }); qc.invalidateQueries({ queryKey: ['manage-campaign', id] }); toast('ذخیره شد'); nav(`${base}/${id ?? r.id}`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (opts.error) return <ErrorBox error={opts.error} />;
  if (!f) return <Spinner />;
  const o = opts.data!;
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const mvTask = (i: number, d: number) => { const ts = [...f.tasks]; const j = i + d; if (j < 0 || j >= ts.length) return; [ts[i], ts[j]] = [ts[j], ts[i]]; setF({ ...f, tasks: ts }); };
  const scopes = [...(o.national ? [['NATIONAL', 'کشوری']] : []), ...(o.provinces.length ? [['PROVINCE', 'استانی']] : []), ...(o.orgs.length ? [['ORG', 'ویژهٔ اعضای سازمان']] : [])];
  return (
    <div className="rise mx-auto grid max-w-3xl gap-6">
      <Link to={id ? `${base}/${id}` : base} className="text-sm font-bold text-leaf-ink">→ بازگشت</Link>
      <h1 className="text-[clamp(22px,3vw,28px)] font-extrabold">{id ? 'ویرایش پویش' : 'پویش تازه'}</h1>
      <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <section className="card grid gap-4 p-5">
          <div className="field"><label htmlFor="ct">عنوان</label><input id="ct" className="input" required minLength={3} maxLength={120} value={f.title} onChange={set('title')} placeholder="مثلاً ده روز با نوجوانان محله" /></div>
          <div className="field"><label htmlFor="cs">خلاصه</label><textarea id="cs" className="input min-h-20" required minLength={10} maxLength={400} value={f.summary} onChange={set('summary')} placeholder="یکی‌دو جمله: این پویش چه می‌خواهد و چرا" /></div>
          <div className="field"><label htmlFor="cb">توضیح بیشتر <span className="font-normal text-muted">(اختیاری)</span></label><textarea id="cb" className="input" maxLength={6000} value={f.body} onChange={set('body')} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="c1">شروع</label><JalaliInput id="c1" withTime={false} label="شروع" value={f.startsAt} onChange={(v) => setF({ ...f, startsAt: v })} /></div>
            <div className="field"><label htmlFor="c2">پایان</label><JalaliInput id="c2" withTime={false} label="پایان" value={f.endsAt} onChange={(v) => setF({ ...f, endsAt: v })} /></div>
          </div>
          <div className="field"><label htmlFor="cg">هدف جمعی <span className="font-normal text-muted">(اختیاری؛ شمار کل کارهای انجام‌شده)</span></label><input id="cg" className="input ltr tnum" inputMode="numeric" value={fa(f.goal)} onChange={(e) => setF({ ...f, goal: toEn(e.target.value).replace(/\D/g, '') })} placeholder="مثلاً ۱۰۰۰" /></div>
        </section>
        <section className="card grid gap-4 p-5">
          <h2 className="font-extrabold">مخاطب</h2>
          {scopes.length > 1 && <div className="seg w-fit">{scopes.map(([k, t]) => <button type="button" key={k} aria-pressed={f.scope === k} disabled={!!id && ex.data?.status === 'PUBLISHED'} onClick={() => setF({ ...f, scope: k })}>{t}</button>)}</div>}
          {f.scope === 'PROVINCE' && <div className="field"><label htmlFor="cp">استان</label><select id="cp" className="input" required value={f.provinceId} disabled={!!id && ex.data?.status === 'PUBLISHED'} onChange={set('provinceId')}><option value="">انتخاب کنید</option>{o.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
          {f.scope === 'ORG' && <div className="field"><label htmlFor="co">سازمان</label><select id="co" className="input" required value={f.networkId} disabled={!!id && ex.data?.status === 'PUBLISHED'} onChange={set('networkId')}>{o.orgs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>}
          <p className="hint">{f.scope === 'NATIONAL' ? 'همهٔ کاربران می‌بینند و با انتشار خبردار می‌شوند.' : f.scope === 'PROVINCE' ? 'فقط ساکنان همین استان می‌بینند و می‌پیوندند.' : 'فقط اعضای همین سازمان می‌بینند؛ بستهٔ پایه سالی ۲ پویش دارد.'} پس از انتشار، مخاطب عوض نمی‌شود.</p>
        </section>
        <section className="card grid gap-3 p-5">
          <h2 className="font-extrabold">کارهای کوتاه <span className="text-sm font-normal text-muted">(۱ تا ۱۲ کار)</span></h2>
          {f.tasks.map((t: any, i: number) => (
            <div key={i} className="grid gap-2 rounded-2xl bg-sunken p-3">
              <div className="flex gap-2"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-card font-bold tnum">{fa(i + 1)}</span>
                <input className="input h-10" aria-label={`عنوان کار ${fa(i + 1)}`} maxLength={140} value={t.title} placeholder="مثلاً با یک نوجوان دربارهٔ علاقه‌اش حرف بزنید" onChange={(e) => setF({ ...f, tasks: f.tasks.map((x: any, j: number) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="بالا" disabled={i === 0} onClick={() => mvTask(i, -1)}><ArrowUp className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="پایین" disabled={i === f.tasks.length - 1} onClick={() => mvTask(i, 1)}><ArrowDown className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="حذف کار" disabled={f.tasks.length === 1} onClick={() => setF({ ...f, tasks: f.tasks.filter((_: any, j: number) => j !== i) })}><Trash2 className="size-4" /></button></div>
              <textarea className="input min-h-16" aria-label={`توضیح کار ${fa(i + 1)}`} maxLength={2000} value={t.body} placeholder="توضیح کوتاه یا راهنما (اختیاری)" onChange={(e) => setF({ ...f, tasks: f.tasks.map((x: any, j: number) => (j === i ? { ...x, body: e.target.value } : x)) })} />
            </div>))}
          {f.tasks.length < 12 && <button type="button" className="btn btn-ghost btn-sm w-fit" onClick={() => setF({ ...f, tasks: [...f.tasks, { title: '', body: '' }] })}><Plus className="size-4" />کار دیگر</button>}
        </section>
        <button className="btn btn-primary btn-lg w-fit" disabled={save.isPending}>{id ? 'ذخیرهٔ تغییرات' : 'ساختن پیش‌نویس'}</button>
      </form>
    </div>
  );
}

export function ManageCampaign() {
  const { id = '' } = useParams();
  const base = useMBase(); const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['manage-campaign', id], queryFn: () => api<any>(`/manage/campaigns/${id}`) });
  const [confirm, setConfirm] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['manage-campaign', id] }); qc.invalidateQueries({ queryKey: ['manage-campaigns'] }); qc.invalidateQueries({ queryKey: ['campaigns'] }); };
  const publish = useMutation({ mutationFn: () => api<{ notified: number }>(`/manage/campaigns/${id}/publish`, { method: 'POST' }), onSuccess: (r) => { refresh(); toast(`منتشر شد؛ ${fa(r.notified)} نفر خبردار شدند`); }, onError: (e) => toast((e as Error).message, 'err') });
  const cancel = useMutation({ mutationFn: () => api<{ deleted?: boolean }>(`/manage/campaigns/${id}/cancel`, { method: 'POST' }), onSuccess: (r) => { refresh(); setConfirm(false); toast(r.deleted ? 'پیش‌نویس حذف شد' : 'لغو شد و به شرکت‌کنندگان خبر داده شد'); if (r.deleted) nav(base); }, onError: (e) => toast((e as Error).message, 'err') });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data;
  const maxDay = Math.max(1, ...c.perDay.map((d: any) => d.n));
  return (
    <div className="rise grid gap-6">
      <Link to={base} className="text-sm font-bold text-leaf-ink">→ همهٔ پویش‌ها</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex flex-wrap items-center gap-2 text-sm"><span className={`chip ${PHASE[c.phase as Phase][0]}`}>{PHASE[c.phase as Phase][1]}</span><span className="text-muted">{jDate(c.startsAt)} تا {jDate(c.endsAt)}</span></div>
          <h1 className="mt-1 text-[clamp(22px,3vw,30px)] font-extrabold">{c.title}</h1></div>
        <div className="flex flex-wrap gap-2">
          {c.status === 'DRAFT' && <button className="btn btn-primary" disabled={publish.isPending} onClick={() => publish.mutate()}>انتشار و اعلان</button>}
          {c.status !== 'CANCELLED' && <Link to={`${base}/${id}/edit`} className="btn btn-secondary">ویرایش</Link>}
          {c.status === 'PUBLISHED' && <Link to={`/campaigns/${id}`} className="btn btn-secondary">صفحهٔ پویش</Link>}
          {c.status !== 'CANCELLED' && <button className="btn btn-ghost text-rose" onClick={() => setConfirm(true)}>{c.status === 'DRAFT' ? 'حذف' : 'لغو پویش'}</button>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">{[['شرکت‌کننده', c.totals.members, Users], ['کار انجام‌شده', c.totals.done, CheckCircle2], ['هستهٔ همراه', c.totals.cores, UsersRound]].map(([l, v, I]: any) => (
        <div key={l} className="card p-4"><span className="flex items-center gap-2 text-sm text-muted"><I className="size-4" />{l}</span><b className="tnum block text-2xl text-ink">{fa(v)}</b></div>))}</div>
      {c.goal && <div className="card p-4"><span className="mb-2 flex items-center gap-2 text-sm text-muted"><Target className="size-4" />هدف جمعی</span><GoalBar done={c.totals.done} goal={c.goal} /></div>}
      <section className="card grid gap-3 p-5"><h2 className="font-extrabold">هر کار چند بار انجام شده</h2>
        <ul className="grid gap-2">{c.tasks.map((t: any, i: number) => <li key={t.id} className="grid gap-1"><div className="flex justify-between gap-3 text-sm"><span className="text-ink">{fa(i + 1)}. {t.title}</span><span className="tnum text-muted">{fa(t.count)}</span></div>
          <div className="bar"><span style={{ width: `${c.totals.members ? (t.count / c.totals.members) * 100 : 0}%` }} /></div></li>)}</ul>
        <p className="hint">نوار = سهم شرکت‌کنندگانی که این کار را انجام داده‌اند.</p></section>
      {c.perDay.length > 0 && <section className="card grid gap-3 p-5"><h2 className="font-extrabold">کارهای ثبت‌شده در هر روز</h2>
        <div className="flex h-32 items-end gap-1" role="img" aria-label="نمودار روزانه">{c.perDay.map((d: any) => <span key={d.day} title={`${jDate(d.day)}: ${fa(d.n)}`} className="max-w-12 flex-1 rounded-t bg-leaf" style={{ height: `${Math.max(4, (d.n / maxDay) * 100)}%` }} />)}</div></section>}
      {c.map.length > 0 && <section className="card grid gap-3 p-5"><h2 className="font-extrabold">مشارکت استان‌ها</h2><ProvinceMap cells={c.map} /></section>}
      <p className="hint">نام شرکت‌کنندگان و یادداشت‌هایشان نشان داده نمی‌شود؛ پویش رتبه‌بندی فردی ندارد.</p>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={c.status === 'DRAFT' ? 'حذف پیش‌نویس' : 'لغو پویش'}>
        <p>{c.status === 'DRAFT' ? 'این پیش‌نویس حذف شود؟' : 'پویش لغو شود؟ به همهٔ شرکت‌کنندگان خبر داده می‌شود و دیگر کاری ثبت نمی‌شود. این کار برگشت ندارد.'}</p>
        <div className="mt-4 flex gap-2"><button className="btn btn-danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{c.status === 'DRAFT' ? 'حذف' : 'لغو پویش'}</button><button className="btn btn-ghost" onClick={() => setConfirm(false)}>انصراف</button></div>
      </Dialog>
    </div>
  );
}
