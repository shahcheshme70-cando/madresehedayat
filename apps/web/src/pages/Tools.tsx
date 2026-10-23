import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck, Check, CloudCheck, Download, Eye, Globe, Handshake, History, ImageDown, Lightbulb, Link2, LoaderCircle, MessageSquare,
  Pencil, Plus, RotateCcw, Scale, Search, SearchCheck, Share2, Sparkles, Trash2, UserPlus, Users, Wrench, X, type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Board, boardCount, type BoardData, type Tool, withExample } from '../components/Board';
import { Brand } from '../components/Shell';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { ago, fa } from '../lib/fa';
import { Composer } from './Social';

export interface Category { id: string; title: string; icon: string; color: string }
export const CAT_ICON: Record<string, LucideIcon> = { prob: SearchCheck, prio: Scale, plan: CalendarCheck, aud: Users, idea: Lightbulb, eval: RotateCcw, team: Handshake };
const TINT: Record<string, string> = { rose: 'tint-rose', amber: 'tint-amber', green: 'tint-green', sky: 'tint-sky', peri: 'tint-peri' };

export function useTools(all = false) {
  return useQuery({ queryKey: ['tools', all], queryFn: () => api<{ categories: Category[]; tools: Tool[] }>(`/tools${all ? '?all=1' : ''}`), staleTime: 10 * 60_000 });
}

interface MyBoards { own: { id: string; toolId: string; title: string; updatedAt: string; lessonId: string | null; isPublic: boolean }[]; shared: { id: string; toolId: string; title: string; updatedAt: string; role: string; owner: string }[] }

/** جعبه‌ابزار: ابزارها و «کارهای من» */
export default function Toolbox() {
  const tools = useTools();
  const mine = useQuery({ queryKey: ['boards'], queryFn: () => api<MyBoards>('/boards') });
  const [tab, setTab] = useState<'tools' | 'mine'>('tools');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  if (tools.isLoading) return <Spinner />;
  if (tools.error) return <ErrorBox error={tools.error} />;
  const { categories, tools: list } = tools.data!;
  const shown = list.filter((t) => (cat === 'all' || t.cat === cat) && (!q || (t.t + t.en + t.d).includes(q)));
  const name = (id: string) => list.find((t) => t.id === id)?.t ?? '';
  return (
    <div className="rise grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">جعبه‌ابزار</h1><p className="mt-1 max-w-2xl text-muted">ابزارهای فکر کردن و برنامه‌ریزی جمعی، با نمونهٔ پرشدهٔ مسجدی. هر بار که ابزاری را پر می‌کنید، یک «کار» تازه در «کارهای من» می‌ماند.</p></div>
        <div className="seg">{([['tools', 'ابزارها'], ['mine', `کارهای من${mine.data ? ` (${fa(mine.data.own.length + mine.data.shared.length)})` : ''}`]] as const).map(([k, t]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}</div>
      </div>
      {tab === 'tools' ? <>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs"><Search className="absolute end-3 top-3.5 size-4 text-muted" /><input className="input !pe-9" placeholder="جست‌وجوی ابزار" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="seg"><button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>همه</button>{categories.filter((c) => list.some((t) => t.cat === c.id)).map((c) => <button key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.title}</button>)}</div>
        </div>
        {shown.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => { const c = categories.find((x) => x.id === t.cat)!; const I = CAT_ICON[t.cat] ?? Wrench; return (
              <Link key={t.id} to={`/tools/t/${t.id}`} className={`card grid gap-2 p-5 no-underline hover:border-line-strong ${TINT[c?.color] ?? ''}`}>
                <div className="flex items-center gap-3"><span className="cover grid size-11 place-items-center rounded-xl"><I className="size-5" /></span><div className="min-w-0"><b className="block text-ink">{t.t}</b><span className="text-xs text-muted" dir="ltr">{t.en}</span></div></div>
                <p className="line-clamp-2 text-sm text-body">{t.d}</p>
                <span className="text-xs font-bold text-muted">{c?.title}</span>
              </Link>); })}
          </div>
        ) : <Empty icon={Wrench} title="ابزاری پیدا نشد" />}
        {list.length < 35 && <p className="hint">ابزارهای دیگر پس از بازبینی متنشان اضافه می‌شوند.</p>}
      </> : mine.isLoading ? <Spinner /> : (
        <div className="grid gap-6">
          {mine.data!.own.length ? <BoardList rows={mine.data!.own.map((b) => ({ ...b, sub: `${name(b.toolId)}${b.lessonId ? ' · از درس' : ''}${b.isPublic ? ' · پیوند عمومی' : ''}` }))} /> : <Empty icon={Wrench} title="هنوز کاری نساخته‌اید">یک ابزار را باز کنید و «کار تازه» بزنید.</Empty>}
          {mine.data!.shared.length > 0 && <section><h2 className="mb-3 font-extrabold">به اشتراک گذاشته با من</h2><BoardList rows={mine.data!.shared.map((b) => ({ ...b, sub: `${name(b.toolId)} · ${b.owner} · ${b.role === 'EDITOR' ? 'هم‌کار' : 'دیدن و نظر'}` }))} /></section>}
        </div>
      )}
    </div>
  );
}

function BoardList({ rows }: { rows: { id: string; title: string; updatedAt: string; sub: string }[] }) {
  return (
    <ul className="card divide-y divide-line">{rows.map((b) => (
      <li key={b.id}><Link to={`/tools/boards/${b.id}`} className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-sunken">
        <span className="min-w-0 flex-1"><b className="block truncate text-ink">{b.title}</b><span className="text-sm text-muted">{b.sub}</span></span>
        <span className="shrink-0 text-xs text-muted">{ago(b.updatedAt)}</span>
      </Link></li>
    ))}</ul>
  );
}

/** صفحهٔ ابزار: معرفی، روش کار، پیش‌نمایش نمونه و کارهای من با این ابزار */
export function ToolPage() {
  const { toolId = '' } = useParams();
  const tools = useTools();
  const nav = useNavigate();
  const toast = useToast();
  const mine = useQuery({ queryKey: ['boards'], queryFn: () => api<MyBoards>('/boards') });
  const create = useMutation({ mutationFn: () => api<{ id: string }>('/boards', { body: { toolId } }), onSuccess: (r) => nav(`/tools/boards/${r.id}`), onError: (e) => toast((e as Error).message, 'err') });
  const [demo, setDemo] = useState(false);
  if (tools.isLoading) return <Spinner />;
  const t = tools.data?.tools.find((x) => x.id === toolId);
  if (!t) return <Empty icon={Wrench} title="این ابزار پیدا نشد یا هنوز منتشر نشده"><Link to="/tools" className="font-bold text-leaf-ink">جعبه‌ابزار</Link></Empty>;
  const c = tools.data!.categories.find((x) => x.id === t.cat);
  const I = CAT_ICON[t.cat] ?? Wrench;
  const mineHere = (mine.data?.own ?? []).filter((b) => b.toolId === t.id);
  return (
    <div className="rise grid gap-6">
      <nav className="text-sm text-muted"><Link to="/tools" className="text-leaf-ink">جعبه‌ابزار</Link> / {t.t}</nav>
      <header className={`cover ${TINT[c?.color ?? ''] ?? ''} grid gap-3 rounded-3xl p-6 md:p-8`}>
        <div className="flex items-center gap-3"><I className="size-8" /><span className="text-sm font-bold">{c?.title}</span></div>
        <h1 className="text-[clamp(24px,3vw,34px)] font-extrabold text-ink">{t.t} <span className="text-base font-semibold text-muted" dir="ltr">{t.en}</span></h1>
        <p className="max-w-2xl text-body">{t.d}</p>
        <div><button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}><Plus className="size-4" />کار تازه با این ابزار</button></div>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5"><h2 className="mb-2 font-extrabold">کی به کار می‌آید؟</h2><p className="text-body">{t.use}</p></section>
        <section className="card p-5"><h2 className="mb-2 font-extrabold">روش کار</h2><ol className="grid gap-1.5">{t.how.map((h, i) => <li key={i} className="flex gap-2 text-body"><b className="tnum text-leaf-ink">{fa(i + 1)}.</b>{h}</li>)}</ol></section>
      </div>
      {mineHere.length > 0 && <section><h2 className="mb-3 font-extrabold">کارهای من با این ابزار</h2><BoardList rows={mineHere.map((b) => ({ ...b, sub: ago(b.updatedAt) }))} /></section>}
      {t.ex && <section className="grid gap-3">
        <div className="flex items-center justify-between"><h2 className="font-extrabold">نمونهٔ پرشدهٔ مسجدی</h2><button className="btn btn-ghost btn-sm" onClick={() => setDemo((v) => !v)}><Eye className="size-4" />{demo ? 'پنهان' : 'دیدن'}</button></div>
        {demo && <div className="card p-4"><Board tool={t} data={withExample(t, { ...emptyFor(t) })} readOnly /></div>}
      </section>}
    </div>
  );
}

const emptyFor = (t: Tool): BoardData => ({ n: {}, f: {}, ...(t.dm ? { dm: { ...t.dm, s: {} } } : {}), ...(t.raci ? { raci: { ...t.raci, m: {} } } : {}), ...(t.bud ? { bud: t.bud } : {}) });

interface BoardView {
  id: string; toolId: string; title: string; data: BoardData; lessonId: string | null; updatedAt: string; createdAt: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER'; owner: string; publicToken: string | null;
  members: { userId: string; role: string; name: string }[];
  comments: { id: string; body: string; createdAt: string; authorId: string; firstName: string; lastName: string }[];
}

export function BoardPage() {
  const { id = '' } = useParams();
  return <BoardEditor id={id} />;
}

/** ویرایشگر کار: ذخیرهٔ خودکار، هم‌کار، نسخه‌ها، نظر، خروجی و پیوند عمومی */
export function BoardEditor({ id, embedded }: { id: string; embedded?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const tools = useTools(true);
  const q = useQuery({ queryKey: ['board', id], queryFn: () => api<BoardView>(`/boards/${id}`), refetchOnWindowFocus: true });
  const [data, setData] = useState<BoardData | null>(null);
  const [title, setTitle] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dlg, setDlg] = useState<'share' | 'versions' | 'export' | null>(null);
  const base = useRef<string>('');
  const timer = useRef<number>(0);
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => { if (q.data) { setData(q.data.data); setTitle(q.data.title); base.current = q.data.updatedAt; } }, [q.data?.id, q.data?.updatedAt]); // eslint-disable-line
  const save = useCallback(async (d: BoardData | null, ttl?: string) => {
    setState('saving');
    try {
      const r = await api<{ updatedAt: string }>(`/boards/${id}`, { method: 'PUT', body: { ...(d ? { data: d } : {}), ...(ttl ? { title: ttl } : {}), base: base.current } });
      base.current = r.updatedAt; setState('saved');
      if (embedded) qc.invalidateQueries({ queryKey: ['lesson'] });
    } catch (e) {
      setState('error');
      if (e instanceof ApiError && e.code === 'conflict') { toast(e.message, 'err'); qc.invalidateQueries({ queryKey: ['board', id] }); }
    }
  }, [id, embedded, qc, toast]);
  const change = (d: BoardData) => { setData(d); setState('saving'); clearTimeout(timer.current); timer.current = window.setTimeout(() => save(d), 900); };
  useEffect(() => () => clearTimeout(timer.current), []);
  if (q.isLoading || tools.isLoading || !data) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const b = q.data!;
  const t = tools.data!.tools.find((x) => x.id === b.toolId)!;
  const ro = b.role === 'VIEWER';
  return (
    <div className={`rise grid gap-5 ${embedded ? '' : ''}`}>
      {!embedded && <nav className="text-sm text-muted"><Link to="/tools" className="text-leaf-ink">جعبه‌ابزار</Link> / <Link to={`/tools/t/${t.id}`} className="text-leaf-ink">{t.t}</Link></nav>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {ro ? <h1 className="text-xl font-extrabold">{b.title}</h1>
            : <input className="w-full border-0 bg-transparent text-[clamp(20px,2.6vw,26px)] font-extrabold text-ink outline-none focus:border-b focus:border-leaf" value={title} aria-label="عنوان کار"
              onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== b.title && save(null, title.trim())} />}
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {b.role !== 'OWNER' && <span>کار {b.owner} · {b.role === 'EDITOR' ? 'شما هم‌کارید' : 'فقط دیدن و نظر'}</span>}
            {!ro && <span className="flex items-center gap-1">{state === 'saving' ? <><LoaderCircle className="size-3.5 animate-spin" />در حال ذخیره…</> : state === 'error' ? <span className="text-rose">ذخیره نشد؛ دوباره تلاش می‌کنیم</span> : <><CloudCheck className="size-3.5" />خودکار ذخیره می‌شود{state === 'saved' ? ' · ذخیره شد' : ''}</>}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!ro && t.ex && <button className="btn btn-ghost btn-sm" onClick={() => change(withExample(t, data))}><Sparkles className="size-4" />نمونهٔ پرشده</button>}
          {b.role === 'OWNER' && <button className="btn btn-secondary btn-sm" onClick={() => setDlg('share')}><Share2 className="size-4" />اشتراک</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => setDlg('export')}><Download className="size-4" />خروجی</button>
          {!ro && <button className="btn btn-ghost btn-sm" onClick={() => setDlg('versions')}><History className="size-4" />نسخه‌ها</button>}
        </div>
      </div>
      {!embedded && <details className="card p-4"><summary className="cursor-pointer font-bold text-ink">روش کار با {t.t}</summary><p className="mt-2 text-body">{t.d}</p><ol className="mt-2 grid gap-1">{t.how.map((h, i) => <li key={i} className="text-sm text-body"><b className="tnum text-leaf-ink">{fa(i + 1)}.</b> {h}</li>)}</ol></details>}
      <div ref={node} className="bg-bg"><Board tool={t} data={data} onChange={change} readOnly={ro} /></div>
      {boardCount(data) === 0 && !ro && <p className="hint">از هر خانه شروع کنید؛ هر تغییر خودکار ذخیره می‌شود.</p>}
      {(b.members.length > 0 || b.comments.length > 0 || b.role !== 'OWNER') && <Comments b={b} onDone={() => qc.invalidateQueries({ queryKey: ['board', id] })} />}
      {b.role === 'OWNER' && !embedded && <button className="btn btn-ghost btn-sm w-fit text-rose" onClick={async () => { if (window.confirm('این کار پاک شود؟')) { await api(`/boards/${id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['boards'] }); nav('/tools'); } }}><Trash2 className="size-4" />پاک کردن کار</button>}
      {dlg === 'share' && <ShareDialog b={b} onClose={() => { setDlg(null); qc.invalidateQueries({ queryKey: ['board', id] }); }} />}
      {dlg === 'versions' && <VersionsDialog id={id} onClose={() => { setDlg(null); qc.invalidateQueries({ queryKey: ['board', id] }); }} />}
      {dlg === 'export' && <ExportDialog title={title || b.title} tool={t} node={node} onClose={() => setDlg(null)} />}
    </div>
  );
}

function Comments({ b, onDone }: { b: BoardView; onDone: () => void }) {
  return (
    <section className="card grid gap-3 p-5">
      <h2 className="flex items-center gap-2 font-extrabold"><MessageSquare className="size-5 text-leaf" />نظرها</h2>
      {b.comments.length ? <ul className="grid gap-2">{b.comments.map((c) => <li key={c.id} className="rounded-xl bg-sunken p-3"><b className="text-sm text-ink">{c.firstName} {c.lastName}</b> <span className="text-xs text-muted">{ago(c.createdAt)}</span><p className="whitespace-pre-line text-body">{c.body}</p></li>)}</ul> : <p className="text-sm text-muted">هنوز نظری نیست.</p>}
      <Composer placeholder="نظر یا پیشنهاد…" onSend={async (t) => { await api(`/boards/${b.id}/comments`, { body: { body: t } }); onDone(); }} />
    </section>
  );
}

function ShareDialog({ b, onClose }: { b: BoardView; onClose: () => void }) {
  const toast = useToast();
  const opts = useQuery({ queryKey: ['share-options'], queryFn: () => api<{ userId: string; name: string; why: string }[]>('/boards/share-options') });
  const [members, setMembers] = useState(b.members);
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [pub, setPub] = useState(b.publicToken);
  const [warn, setWarn] = useState(false);
  const add = async (body: { userId?: string; mobile?: string }, name?: string) => {
    try { await api(`/boards/${b.id}/members`, { body: { ...body, role } }); toast('به اشتراک گذاشته شد'); if (body.userId && name) setMembers((m) => [...m.filter((x) => x.userId !== body.userId), { userId: body.userId!, role, name }]); setMobile(''); }
    catch (e) { toast((e as Error).message, 'err'); }
  };
  const remove = async (uid: string) => { await api(`/boards/${b.id}/members/${uid}`, { method: 'DELETE' }); setMembers((m) => m.filter((x) => x.userId !== uid)); };
  const togglePublic = async (on: boolean) => { const r = await api<{ publicToken: string | null }>(`/boards/${b.id}/public`, { body: { on } }); setPub(r.publicToken); setWarn(false); toast(on ? 'پیوند عمومی ساخته شد' : 'پیوند عمومی قطع شد'); };
  const url = pub ? `${location.origin}${import.meta.env.VITE_DEMO ? location.pathname + '#' : ''}/b/${pub}` : '';
  return (
    <Dialog open onClose={onClose} title="اشتراک کار" wide>
      <div className="grid gap-5">
        <div className="seg w-fit"><button aria-pressed={role === 'VIEWER'} onClick={() => setRole('VIEWER')}>دیدن و نظر</button><button aria-pressed={role === 'EDITOR'} onClick={() => setRole('EDITOR')}>هم‌کار (ویرایش)</button></div>
        {opts.data?.length ? <div className="grid gap-2"><b className="text-sm text-ink">پیشنهادها</b><div className="flex flex-wrap gap-2">{opts.data.map((o) => (
          <button key={o.userId} className="chip h-9 cursor-pointer px-3" onClick={() => add({ userId: o.userId }, o.name)}><UserPlus className="size-4" />{o.name} <span className="text-xs text-muted">({o.why})</span></button>
        ))}</div></div> : null}
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); add({ mobile }); }}>
          <div className="field min-w-0 flex-1"><label htmlFor="sm">یا با شمارهٔ همراه کسی که در مدرسه حساب دارد</label><input id="sm" className="input ltr tnum" dir="ltr" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09…" /></div>
          <button className="btn btn-secondary h-[46px]" disabled={mobile.length < 10}>افزودن</button>
        </form>
        {members.length > 0 && <ul className="grid gap-1">{members.map((m) => <li key={m.userId} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2"><span className="flex-1 text-ink">{m.name}</span><span className="chip">{m.role === 'EDITOR' ? 'هم‌کار' : 'دیدن و نظر'}</span><button className="btn btn-ghost btn-icon btn-sm" aria-label="برداشتن" onClick={() => remove(m.userId)}><X className="size-4" /></button></li>)}</ul>}
        <div className="grid gap-2 border-t border-line pt-4">
          <b className="flex items-center gap-2 text-ink"><Globe className="size-4" />پیوند عمومی</b>
          {pub ? <>
            <div className="flex flex-wrap items-center gap-2"><code dir="ltr" className="max-w-full truncate rounded-lg bg-sunken px-3 py-2 text-sm">{url}</code>
              <button className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('کپی شد'); } catch { toast('کپی نشد', 'err'); } }}><Link2 className="size-4" />کپی</button>
              <button className="btn btn-ghost btn-sm text-rose" onClick={() => togglePublic(false)}>قطع پیوند</button></div>
            <p className="hint">هر کس این پیوند را داشته باشد، بدون ورود متن کار را می‌بیند (نه نام شما و نه نظرها).</p>
          </> : warn ? (
            <div className="grid gap-2 rounded-xl bg-flame-soft p-3 text-sm"><b className="text-flame-ink">مطمئنید؟</b><p className="text-ink">با پیوند عمومی، هر کس پیوند را داشته باشد متن این کار را می‌بیند. اگر نام افراد یا نکتهٔ خصوصی در آن است، اول پاکش کنید. هر وقت بخواهید پیوند را قطع می‌کنید.</p>
              <div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => togglePublic(true)}>بله، پیوند بساز</button><button className="btn btn-ghost btn-sm" onClick={() => setWarn(false)}>نه</button></div></div>
          ) : <button className="btn btn-ghost btn-sm w-fit" onClick={() => setWarn(true)}>ساختن پیوند عمومی</button>}
        </div>
      </div>
    </Dialog>
  );
}

function VersionsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const q = useQuery({ queryKey: ['versions', id], queryFn: () => api<{ id: string; createdAt: string; author: string }[]>(`/boards/${id}/versions`) });
  const restore = async (vid: string) => { await api(`/boards/${id}/versions/${vid}/restore`, { method: 'POST' }); toast('به این نسخه برگشت'); onClose(); };
  return (
    <Dialog open onClose={onClose} title="نسخه‌ها">
      {q.isLoading ? <Spinner /> : <ul className="grid gap-1">{q.data?.map((v, i) => (
        <li key={v.id} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-sunken"><span className="flex-1"><b className="text-ink">{v.author}</b> <span className="text-sm text-muted">{ago(v.createdAt)}</span></span>{i === 0 ? <span className="chip chip-leaf"><Check className="size-3.5" />فعلی</span> : <button className="btn btn-ghost btn-sm" onClick={() => restore(v.id)}><RotateCcw className="size-4" />برگرداندن</button>}</li>
      ))}</ul>}
      <p className="hint mt-3">هر ذخیره یک نسخه است؛ تغییرهای پشت‌سرهم یک نفر در ده دقیقه یک نسخه حساب می‌شوند.</p>
    </Dialog>
  );
}

/** خروجی تصویر (PNG) و صفحهٔ HTML؛ فارسی و چیدمان سالم می‌ماند چون از خود صفحه گرفته می‌شود */
function ExportDialog({ title, tool, node, onClose }: { title: string; tool: Tool; node: React.RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const fname = useMemo(() => title.replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 60) || tool.t, [title, tool]);
  const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const png = async () => {
    if (!node.current) return; setBusy(true);
    try {
      const { toBlob } = await import('html-to-image');
      const wrap = buildExport(node.current, title, tool);
      document.body.appendChild(wrap);
      const blob = await toBlob(wrap, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor, width: 1100, height: wrap.scrollHeight, style: { position: 'static', left: '0', top: '0' } });
      wrap.remove();
      if (blob) save(blob, `${fname}.png`);
    } catch { toast('ساخت تصویر نشد؛ خروجی HTML را امتحان کنید', 'err'); } finally { setBusy(false); }
  };
  const html = () => {
    if (!node.current) return;
    const wrap = buildExport(node.current, title, tool);
    const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    const doc = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}\nbody{padding:24px;background:var(--bg)}</style></head><body>${wrap.outerHTML}</body></html>`;
    save(new Blob([doc], { type: 'text/html;charset=utf-8' }), `${fname}.html`);
  };
  return (
    <Dialog open onClose={onClose} title="خروجی">
      <div className="grid gap-3">
        <button className="btn btn-primary" disabled={busy} onClick={png}><ImageDown className="size-4" />{busy ? 'در حال ساخت…' : 'تصویر (PNG) برای پیام‌رسان'}</button>
        <button className="btn btn-secondary" onClick={html}><Pencil className="size-4" />صفحهٔ HTML برای چاپ از مرورگر</button>
        <p className="hint">خروجی فقط متن کار را دارد، نه نظرها و نام هم‌کاران.</p>
      </div>
    </Dialog>
  );
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** نسخهٔ فقط‌خواندنی و تمیز بوم برای خروجی: ورودی‌ها به متن تبدیل و دکمه‌ها حذف می‌شوند */
function buildExport(src: HTMLElement, title: string, tool: Tool) {
  const wrap = document.createElement('div');
  wrap.setAttribute('dir', 'rtl');
  wrap.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;pointer-events:none;width:1100px;padding:32px;background:var(--bg);color:var(--body);font-family:inherit';
  wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px"><h1 style="font-size:26px;font-weight:800;color:var(--ink)">${escapeHtml(title)}</h1><span style="font-size:13px;color:var(--muted)">${escapeHtml(tool.t)} · مدرسهٔ هدایت</span></div>`;
  const c = src.cloneNode(true) as HTMLElement;
  const sel = 'textarea, input:not([type=checkbox]), select';
  const live = [...src.querySelectorAll(sel)] as (HTMLInputElement | HTMLSelectElement)[];
  ([...c.querySelectorAll(sel)] as HTMLElement[]).forEach((el, i) => {
    const s = live[i];
    const v = s instanceof HTMLSelectElement ? s.selectedOptions[0]?.textContent ?? '' : s?.value ?? '';
    const d = document.createElement(s instanceof HTMLSelectElement ? 'b' : 'div');
    d.textContent = v || (s instanceof HTMLSelectElement ? '' : '—');
    d.style.cssText = 'white-space:pre-line;color:var(--ink);min-height:1.6em';
    el.replaceWith(d);
  });
  c.querySelectorAll('.addn, .nx, button').forEach((el) => el.remove());
  wrap.appendChild(c);
  return wrap;
}

/** نمایش عمومی کار با پیوند (بدون ورود، بدون نام و نظر) */
export function PublicBoard() {
  const { token = '' } = useParams();
  const tools = useTools(true);
  const q = useQuery({ queryKey: ['public-board', token], queryFn: () => api<{ toolId: string; title: string; data: BoardData; updatedAt: string }>(`/public/boards/${token}`), retry: false });
  const t = tools.data?.tools.find((x) => x.id === q.data?.toolId);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line"><div className="wrap flex h-16 items-center justify-between"><Brand /><Link to="/tools" className="btn btn-ghost btn-sm">جعبه‌ابزار مدرسه</Link></div></header>
      <main className="wrap py-8">
        {q.isLoading || tools.isLoading ? <Spinner /> : q.error || !t ? <Empty icon={Globe} title={(q.error as Error)?.message ?? 'پیدا نشد'} /> : (
          <div className="grid gap-4"><div><h1 className="text-2xl font-extrabold">{q.data!.title}</h1><p className="text-sm text-muted">{t.t} · به‌روز شده {ago(q.data!.updatedAt)}</p></div><Board tool={t} data={q.data!.data} readOnly /></div>
        )}
      </main>
    </div>
  );
}

/** درس «ابزار کار» */
export function ToolLesson({ lessonId }: { lessonId: string }) {
  const q = useQuery({ queryKey: ['lesson-board', lessonId], queryFn: () => api<{ id: string }>(`/boards/lesson/${lessonId}`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <div className="grid gap-3">
      <p className="hint">کار شما خودکار ذخیره می‌شود و در «جعبه‌ابزار ← کارهای من» هم می‌ماند. با پر کردن ابزار، این درس تمام می‌شود.</p>
      <BoardEditor id={q.data!.id} embedded />
    </div>
  );
}
