import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CircleHelp, LifeBuoy, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, jDate } from '../lib/fa';
import { Composer } from './Social';

export const CATEGORY: Record<string, string> = { LOGIN: 'ورود و حساب', COURSE: 'دوره و آزمون', EVENT: 'برنامه‌ها', TECH: 'مشکل فنی', OTHER: 'دیگر' };
export const TSTATUS: Record<string, [string, string]> = { OPEN: ['chip-flame', 'منتظر پاسخ'], ANSWERED: ['chip-leaf', 'پاسخ داده شد'], CLOSED: ['', 'بسته'] };
export interface TRow { id: string; category: string; subject: string; status: string; priority?: boolean; createdAt: string; updatedAt: string; userName: string; assignee: string | null }

const FAQ: [string, string][] = [
  ['کد ورود نمی‌رسد', 'شماره را با ۰۹ و ۱۱ رقم وارد کنید. اگر پیامک نرسید، یک دقیقه بعد «ارسال دوباره» را بزنید. پیامک‌های تبلیغاتی گوشی را هم نگاه کنید.'],
  ['گواهی دوره کی صادر می‌شود؟', 'وقتی همهٔ درس‌های لازم را تمام کنید و در آزمون پایانی دست‌کم نمرهٔ قبولی دوره را بگیرید. گواهی در «گواهی‌ها و پیشرفت» می‌آید و شناسهٔ استعلام دارد.'],
  ['در آزمون رد شدم؛ دوباره می‌شود؟', 'بله. دو بار اول بی‌فاصله، از بار سوم هر ۲۴ ساعت یک بار. بهترین نمره‌تان می‌ماند.'],
  ['راهیار من کیست؟', 'از روی شهرستان و جنسیتتان تعیین می‌شود. در «پیام با راهیار» نامش را می‌بینید. اگر شهرستانتان را اشتباه زده‌اید، از تنظیمات درستش کنید.'],
  ['شماره‌ام را چه کسی می‌بیند؟', 'هیچ‌کس جز خودتان و مدیر ستاد. راهیار، مسئول هسته، امام محله و برگزارکنندهٔ برنامه شماره را نمی‌بینند.'],
  ['اعلان‌ها را در بله بگیرم', 'از «تنظیمات ← پیام‌رسان» کد اتصال بگیرید و برای بات مدرسه در بله بفرستید.'],
];

export function Help() {
  const { me } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const loc = useLocation();
  const mine = useQuery({ queryKey: ['tickets'], queryFn: () => api<TRow[]>('/support') });
  const assigned = useQuery({ queryKey: ['tickets-assigned'], queryFn: () => api<TRow[]>('/support/assigned') });
  const [open, setOpen] = useState(new URLSearchParams(loc.search).has('new'));
  const [f, setF] = useState({ category: 'COURSE', subject: '', body: '' });
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/support', { body: f }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['tickets'] }); toast('درخواست فرستاده شد؛ پاسخ را با اعلان خبر می‌دهیم'); nav(`/support/${r.id}`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  return (
    <div className="rise mx-auto grid max-w-3xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">کمک و پشتیبانی</h1><p className="mt-1 text-muted">اول پرسش‌های پرتکرار را ببینید؛ اگر جوابتان نبود، درخواست بفرستید.</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="size-4" />درخواست پشتیبانی</button>
      </div>
      <section className="grid gap-2">
        <h2 className="mb-1 font-extrabold">پرسش‌های پرتکرار</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="card group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-ink"><span className="flex items-center gap-2"><CircleHelp className="size-4 text-leaf" />{q}</span><ChevronDown className="size-4 transition group-open:rotate-180" /></summary>
            <p className="mt-2 leading-8 text-body">{a}</p>
          </details>
        ))}
      </section>
      {!!assigned.data?.length && <TicketList title="ارجاع‌شده به من" rows={assigned.data} showUser />}
      <section>
        <h2 className="mb-3 font-extrabold">درخواست‌های من</h2>
        {mine.isLoading ? <Spinner /> : mine.data?.length ? <TicketList rows={mine.data} /> : <Empty icon={LifeBuoy} title="درخواستی نفرستاده‌اید" />}
      </section>
      <Dialog open={open} onClose={() => setOpen(false)} title="درخواست پشتیبانی">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="field"><label htmlFor="cat">موضوع کلی</label><select id="cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label htmlFor="sub">عنوان</label><input id="sub" className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="مثلاً دکمهٔ آزمون کار نمی‌کند" /></div>
          <div className="field"><label htmlFor="bd">توضیح</label><textarea id="bd" className="input min-h-32" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="چه کردید، چه دیدید، کدام دوره یا صفحه" /></div>
          <p className="hint">{me?.firstName} عزیز، شمارهٔ همراهتان را اینجا ننویسید؛ پاسخ داخل همین سامانه می‌آید.</p>
          <button className="btn btn-primary w-fit" disabled={f.subject.trim().length < 3 || f.body.trim().length < 5 || create.isPending}>فرستادن</button>
        </form>
      </Dialog>
    </div>
  );
}

export function TicketList({ rows, title, showUser, base = '/support' }: { rows: TRow[]; title?: string; showUser?: boolean; base?: string }) {
  return (
    <section>
      {title && <h2 className="mb-3 font-extrabold">{title}</h2>}
      <ul className="card divide-y divide-line">{rows.map((t) => (
        <li key={t.id}><Link to={`${base}/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 no-underline hover:bg-sunken">
          <span className="min-w-0 flex-1"><b className="block truncate text-ink">{t.priority && showUser && <span className="chip chip-flame me-2 align-middle">تعهدی</span>}{t.subject}</b><span className="text-sm text-muted">{CATEGORY[t.category]}{showUser ? ` · ${t.userName}` : ''}{t.assignee ? ` · ارجاع: ${t.assignee}` : ''} · {ago(t.updatedAt)}</span></span>
          <span className={`chip ${TSTATUS[t.status][0]}`}>{TSTATUS[t.status][1]}</span>
        </Link></li>
      ))}</ul>
    </section>
  );
}

interface Thread extends TRow { userId: string; assigneeId: string | null; role: 'owner' | 'staff' | 'assignee'; messages: { id: string; body: string; createdAt: string; authorId: string; firstName: string; lastName: string; fromUser: boolean }[] }

export function TicketPage({ admin }: { admin?: boolean }) {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => api<Thread>(`/support/${id}`) });
  const [assign, setAssign] = useState(false);
  const status = useMutation({ mutationFn: (s: string) => api(`/support/${id}/status`, { body: { status: s } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast('ذخیره شد'); } });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const t = q.data!;
  return (
    <div className="rise mx-auto grid max-w-3xl gap-5">
      <Link to={admin ? '/admin/support' : '/help'} className="text-sm font-bold text-leaf-ink">→ {admin ? 'صف پشتیبانی' : 'کمک و پشتیبانی'}</Link>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1"><h1 className="text-xl font-extrabold">{t.subject}</h1><p className="text-sm text-muted">{CATEGORY[t.category]} · {jDate(t.createdAt)}{t.role !== 'owner' ? ` · ${t.userName}` : ''}{t.assignee ? ` · ارجاع به ${t.assignee}` : ''}</p></div>
        <span className={`chip ${TSTATUS[t.status][0]}`}>{TSTATUS[t.status][1]}</span>
      </header>
      <ol className="grid gap-3">{t.messages.map((m) => (
        <li key={m.id} className={`rounded-2xl p-4 ${m.fromUser ? 'bg-card border border-line' : 'bg-leaf-soft'}`}>
          <div className="mb-1 flex gap-2 text-xs"><b className="text-ink">{m.fromUser ? `${m.firstName} ${m.lastName}` : `${m.firstName} ${m.lastName} (پشتیبانی)`}</b><span className="text-muted">{ago(m.createdAt)}</span></div>
          <p className="whitespace-pre-line leading-8 text-body">{m.body}</p>
        </li>
      ))}</ol>
      {t.status !== 'CLOSED' || t.role !== 'owner' ? <Composer placeholder="پاسخ…" onSend={async (b) => { await api(`/support/${id}/reply`, { body: { body: b } }); qc.invalidateQueries({ queryKey: ['ticket', id] }); }} />
        : <p className="hint">این درخواست بسته شده است؛ اگر مشکل باقی است، درخواست تازه بفرستید.</p>}
      <div className="flex flex-wrap gap-2">
        {t.status !== 'CLOSED' && <button className="btn btn-ghost btn-sm" onClick={() => status.mutate('CLOSED')}>{t.role === 'owner' ? 'مشکلم حل شد؛ ببند' : 'بستن درخواست'}</button>}
        {t.role === 'staff' && t.status === 'CLOSED' && <button className="btn btn-ghost btn-sm" onClick={() => status.mutate('OPEN')}>باز کردن دوباره</button>}
        {t.role === 'staff' && <button className="btn btn-secondary btn-sm" onClick={() => setAssign(true)}>{t.assignee ? 'تغییر ارجاع' : 'ارجاع به راهیار یا مدرس'}</button>}
      </div>
      {assign && <AssignDialog id={id} onClose={() => { setAssign(false); qc.invalidateQueries({ queryKey: ['ticket', id] }); }} />}
    </div>
  );
}

function AssignDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const toast = useToast();
  const list = useQuery({ queryKey: ['assignees', q], queryFn: () => api<{ id: string; name: string; roles: string[] }[]>(`/admin/support-assignees?q=${encodeURIComponent(q)}`) });
  const pick = async (userId: string | null) => { try { await api(`/admin/support/${id}/assign`, { body: { userId } }); toast(userId ? 'ارجاع شد' : 'ارجاع برداشته شد'); onClose(); } catch (e) { toast((e as Error).message, 'err'); } };
  const R: Record<string, string> = { RAHYAR: 'راهیار', INSTRUCTOR: 'مدرس', HQ_OPERATOR: 'اپراتور', HQ_ADMIN: 'مدیر ستاد' };
  return (
    <Dialog open onClose={onClose} title="ارجاع درخواست">
      <div className="grid gap-3">
        <input className="input" placeholder="جست‌وجوی نام" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <ul className="grid max-h-72 gap-1 overflow-y-auto">{list.data?.map((p) => (
          <li key={p.id}><button className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-start hover:bg-sunken" onClick={() => pick(p.id)}><b className="text-ink">{p.name}</b><span className="text-xs text-muted">{p.roles.map((r) => R[r]).join('، ')}</span></button></li>
        ))}</ul>
        <button className="btn btn-ghost btn-sm w-fit" onClick={() => pick(null)}>برداشتن ارجاع</button>
      </div>
    </Dialog>
  );
}

export function AdminSupport() {
  const [st, setSt] = useState('');
  const q = useQuery({ queryKey: ['admin-tickets', st], queryFn: () => api<TRow[]>(`/admin/support${st ? `?status=${st}` : ''}`) });
  return (
    <div className="rise grid gap-5">
      <div><h1 className="text-[clamp(22px,2.6vw,28px)] font-extrabold">پشتیبانی</h1><p className="mt-1 text-muted">درخواست‌های کاربران. می‌توانید به راهیار یا مدرس ارجاع بدهید.</p></div>
      <div className="seg w-fit">{[['', 'باز و پاسخ‌داده'], ['OPEN', 'منتظر پاسخ'], ['CLOSED', 'بسته']].map(([k, t]) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{t}</button>)}</div>
      {q.isLoading ? <Spinner /> : q.data?.length ? <TicketList rows={q.data} showUser base="/admin/support" /> : <Empty icon={LifeBuoy} title="درخواستی نیست" />}
    </div>
  );
}
