import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Building2, CheckCheck, Copy, Landmark, Link2, MessageCircle, Plus, RefreshCw, Send, Trash2, UserMinus, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, fa } from '../lib/fa';
import type { Notice } from '../lib/types';
import { OrgReport, OrgSubscriptionCard, PlansTable, type OrgSub } from './Business';

const Title = ({ t, d, children }: { t: string; d?: string; children?: React.ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">{t}</h1>{d && <p className="mt-1 max-w-2xl text-muted">{d}</p>}</div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

/** نشانی پیوند دعوت برای فرستادن در پیام‌رسان */
export const inviteUrl = (code: string) => `${location.origin}${import.meta.env.VITE_DEMO ? location.pathname + '#' : ''}/join/${code}`;

export function CopyButton({ text, label = 'کپی' }: { text: string; label?: string }) {
  const toast = useToast();
  return <button className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); toast('کپی شد'); } catch { toast('کپی نشد؛ متن را دستی بردارید', 'err'); } }}><Copy className="size-4" />{label}</button>;
}

// ───────── اعلان‌ها ─────────
export function Notifications() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<Notice[]>('/notifications') });
  const read = useMutation({ mutationFn: (ids?: string[]) => api('/notifications/read', { body: { ids } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); } });
  const unread = (q.data ?? []).filter((n) => !n.readAt);
  return (
    <div className="rise mx-auto grid max-w-3xl gap-6">
      <Title t="اعلان‌ها">{unread.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => read.mutate(undefined)}><CheckCheck className="size-4" />همه خوانده شد</button>}</Title>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {q.data.map((n) => (
            <li key={n.id}>
              <button className={`flex w-full items-start gap-3 px-4 py-3.5 text-start hover:bg-sunken ${n.readAt ? '' : 'bg-leaf-soft/40'}`}
                onClick={() => { if (!n.readAt) read.mutate([n.id]); if (n.link) nav(n.link); }}>
                <span className={`mt-2 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-leaf'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1"><b className={`block ${n.readAt ? 'font-semibold text-body' : 'text-ink'}`}>{n.title}</b>{n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}</span>
                <span className="shrink-0 text-xs text-muted">{ago(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <Empty icon={Bell} title="اعلانی ندارید">پاسخ راهیار، یادآوری برنامه‌ها و خبرهای هسته اینجا می‌آید.</Empty>}
    </div>
  );
}

// ───────── گفت‌وگو ─────────
export interface Dm { id: string; body: string; createdAt: string; authorId: string; firstName: string; lastName: string }
export function Thread({ messages, meId, empty }: { messages: Dm[]; meId: string; empty: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length]);
  if (!messages.length) return <p className="py-10 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="grid gap-2.5">
      {messages.map((m) => {
        const mine = m.authorId === meId;
        return (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? 'justify-self-start rounded-ss-md bg-leaf-soft text-ink' : 'justify-self-end rounded-se-md bg-sunken text-ink'}`}>
            {!mine && <b className="mb-0.5 block text-xs text-leaf-ink">{m.firstName} {m.lastName}</b>}
            <p className="whitespace-pre-line text-[15px] leading-7">{m.body}</p>
            <span className="mt-0.5 block text-[11px] text-muted">{ago(m.createdAt)}</span>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function Composer({ onSend, disabled, placeholder = 'پیام…' }: { onSend: (t: string) => Promise<unknown>; disabled?: boolean; placeholder?: string }) {
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const go = async () => { if (!t.trim()) return; setBusy(true); try { await onSend(t.trim()); setT(''); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); } };
  return (
    <div className="flex items-end gap-2">
      <textarea className="input min-h-[46px] flex-1 resize-none py-2.5" rows={1} placeholder={placeholder} value={t} disabled={disabled}
        onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } }} />
      <button className="btn btn-primary btn-icon h-[46px] w-[46px]" disabled={disabled || busy || !t.trim()} onClick={go} aria-label="فرستادن"><Send className="size-5 -scale-x-100" /></button>
    </div>
  );
}

export function Messages() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const r = useQuery({ queryKey: ['my-rahyar'], queryFn: () => api<{ rahyar: { name: string; title: string; layer: string } | null }>('/me/rahyar') });
  const q = useQuery({ queryKey: ['dm'], queryFn: () => api<Dm[]>('/messages'), refetchInterval: 30_000 });
  if (r.isLoading || q.isLoading) return <Spinner />;
  const rah = r.data?.rahyar;
  return (
    <div className="rise mx-auto grid max-w-2xl gap-5">
      <Title t="پیام با راهیار" d="پرسش، گزارش کوتاه یا هماهنگی. شمارهٔ همراه شما به راهیار نشان داده نمی‌شود." />
      {rah ? (
        <div className="card flex items-center gap-3 p-4">
          <span className="grid size-11 place-items-center rounded-full bg-dome-soft font-extrabold text-dome-ink">{rah.name[0]}</span>
          <div><b className="block text-ink">{rah.name}</b><span className="text-sm text-muted">{rah.title}</span></div>
        </div>
      ) : <Empty icon={MessageCircle} title="هنوز راهیاری برایتان تعیین نشده">به‌محض تعیین راهیار شهرستان یا استان، اینجا می‌توانید با او گفت‌وگو کنید.</Empty>}
      {rah && (
        <div className="card grid gap-4 p-4">
          <Thread messages={q.data ?? []} meId={me!.id} empty="گفت‌وگو را شما شروع کنید." />
          <Composer onSend={async (t) => { await api('/messages', { body: { body: t } }); qc.invalidateQueries({ queryKey: ['dm'] }); }} />
        </div>
      )}
      <p className="hint">{me?.allowRahyarMessages ? 'راهیار هم می‌تواند به شما پیام بدهد.' : 'پیام‌دادن راهیار به شما خاموش است؛ فقط به پیام‌های خودتان پاسخ می‌دهد.'} <Link to="/settings" className="font-bold text-leaf-ink">تغییر در تنظیمات</Link></p>
    </div>
  );
}

// ───────── هسته‌ها ─────────
interface CoreRow { id: string; name: string; isLeader: boolean; memberCount: number; networkName: string; networkKind: string }
interface Member { id: string; name: string; active?: number; done?: number; attended?: number; last?: string | null }
interface CoreFull { id: string; name: string; network: string; networkKind: string; mosque: string | null; leader: { id: string; name: string } | null; canManage: boolean; inviteCode: string | null; members: Member[] }

export function MyCores() {
  const { me } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-cores'], queryFn: () => api<{ cores: CoreRow[]; imamOf: { id: string; name: string }[] }>('/cores/mine') });
  const [make, setMake] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/cores', { body: { name } }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['me'] }); toast('هسته ساخته شد'); nav(`/cores/${c.id}`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const join = useMutation({
    mutationFn: () => api<{ joined: string; id: string; name: string }>('/join', { body: { code } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['my-cores'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast(`به ${r.name} پیوستید`); setCode(''); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const canCreate = me?.gender === 'FEMALE';
  return (
    <div className="rise grid gap-6">
      <Title t="هسته‌های من" d={canCreate ? 'در شبکهٔ بانور هر عضو می‌تواند هسته بسازد و مسئولش باشد؛ هم‌زمان در چند هسته هم می‌شود بود.' : 'هسته‌ها را امام محله می‌سازد؛ با پیوند دعوت به هستهٔ خود بپیوندید.'}>
        {canCreate && <button className="btn btn-primary" onClick={() => setMake(true)}><Plus className="size-4" />هستهٔ تازه</button>}
      </Title>
      {q.isLoading ? <Spinner /> : q.data?.cores.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.cores.map((c) => (
            <Link key={c.id} to={`/cores/${c.id}`} className="card grid gap-2 p-5 no-underline hover:border-line-strong">
              <UsersRound className="size-9 rounded-xl bg-leaf-soft p-2 text-leaf-ink" />
              <b className="text-ink">{c.name}</b>
              <span className="text-sm text-muted">{fa(c.memberCount)} عضو · {c.networkName}</span>
              {c.isLeader && <span className="chip chip-leaf w-fit">مسئول هسته</span>}
            </Link>
          ))}
        </div>
      ) : <Empty icon={UsersRound} title="عضو هسته‌ای نیستید">{canCreate ? 'یک هسته با دوستانتان بسازید یا کد دعوت را وارد کنید.' : 'کد دعوتی را که امام محله یا مسئول هسته فرستاده وارد کنید.'}</Empty>}
      <div className="card flex flex-wrap items-end gap-3 p-5">
        <div className="field min-w-0 flex-1"><label htmlFor="jc">کد دعوت دارید؟</label><input id="jc" className="input ltr" dir="ltr" placeholder="h7k2…" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <button className="btn btn-secondary" disabled={code.trim().length < 4 || join.isPending} onClick={() => join.mutate()}>پیوستن</button>
      </div>
      <Dialog open={make} onClose={() => setMake(false)} title="هستهٔ تازه">
        <div className="grid gap-4">
          <div className="field"><label htmlFor="cn">نام هسته</label><input id="cn" className="input" placeholder="مثلاً هستهٔ ریحانه" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <p className="hint">شما مسئول هسته می‌شوید و بعد پیوند دعوت را برای اعضا می‌فرستید. مسئولیت را بعداً می‌توانید به عضو دیگری بسپارید.</p>
          <button className="btn btn-primary" disabled={name.trim().length < 2 || create.isPending} onClick={() => create.mutate()}>ساختن</button>
        </div>
      </Dialog>
    </div>
  );
}

function MemberTable({ members, onRemove, leaderId, onMakeLeader }: { members: Member[]; onRemove?: (m: Member) => void; leaderId?: string | null; onMakeLeader?: (m: Member) => void }) {
  if (!members.length) return <p className="py-6 text-center text-sm text-muted">هنوز عضوی نیست.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead><tr className="border-b border-line text-start text-muted"><th className="py-2 text-start font-semibold">نام</th><th className="font-semibold">در حال گذراندن</th><th className="font-semibold">دورهٔ تمام‌شده</th><th className="font-semibold">حضور در برنامه</th><th className="font-semibold">آخرین فعالیت</th><th /></tr></thead>
        <tbody>{members.map((m) => (
          <tr key={m.id} className="border-b border-line last:border-0">
            <td className="py-2.5 font-semibold text-ink">{m.name}{leaderId === m.id && <span className="chip chip-leaf ms-2 h-6">مسئول</span>}</td>
            <td className="tnum text-center">{fa(m.active ?? 0)}</td><td className="tnum text-center">{fa(m.done ?? 0)}</td><td className="tnum text-center">{fa(m.attended ?? 0)}</td>
            <td className="text-center text-muted">{m.last ? ago(m.last) : '—'}</td>
            <td className="whitespace-nowrap text-end">
              {onMakeLeader && leaderId !== m.id && <button className="btn btn-ghost btn-sm" onClick={() => onMakeLeader(m)}>مسئول شود</button>}
              {onRemove && <button className="btn btn-ghost btn-icon btn-sm" aria-label={`برداشتن ${m.name}`} onClick={() => onRemove(m)}><UserMinus className="size-4" /></button>}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function CorePage() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const q = useQuery({ queryKey: ['core', id], queryFn: () => api<CoreFull>(`/cores/${id}`) });
  const done = () => { qc.invalidateQueries({ queryKey: ['core', id] }); qc.invalidateQueries({ queryKey: ['me'] }); };
  const remove = useMutation({ mutationFn: (uid: string) => api(`/cores/${id}/members/${uid}`, { method: 'DELETE' }), onSuccess: (_r, uid) => { if (uid === me?.id) nav('/cores'); else done(); } });
  const leader = useMutation({ mutationFn: (uid: string) => api(`/cores/${id}`, { method: 'PATCH', body: { leaderId: uid } }), onSuccess: () => { done(); toast('مسئول هسته عوض شد'); } });
  const regen = useMutation({ mutationFn: () => api(`/cores/${id}/invite`, { method: 'POST' }), onSuccess: () => { done(); toast('پیوند تازه ساخته شد؛ پیوند قبلی دیگر کار نمی‌کند'); } });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data!;
  return (
    <div className="rise grid gap-6">
      <Link to="/cores" className="text-sm font-bold text-leaf-ink">→ هسته‌های من</Link>
      <Title t={c.name} d={`${c.network}${c.mosque ? ' · ' + c.mosque : ''}${c.leader ? ' · مسئول: ' + c.leader.name : ' · هنوز مسئول ندارد'}`} />
      {c.canManage && c.inviteCode && (
        <section className="card grid gap-3 p-5">
          <b className="flex items-center gap-2 text-ink"><Link2 className="size-5 text-leaf" />پیوند دعوت</b>
          <p className="text-sm text-muted">این پیوند را در پیام‌رسان برای اعضا بفرستید. با ثبت‌نام از این پیوند، مستقیم عضو هسته می‌شوند.</p>
          <div className="flex flex-wrap items-center gap-2"><code dir="ltr" className="max-w-full truncate rounded-lg bg-sunken px-3 py-2 text-sm">{inviteUrl(c.inviteCode)}</code>
            <CopyButton text={inviteUrl(c.inviteCode)} label="کپی پیوند" />
            <button className="btn btn-ghost btn-sm" onClick={() => regen.mutate()}><RefreshCw className="size-4" />پیوند تازه</button></div>
        </section>
      )}
      <section className="card p-5">
        <h2 className="mb-3 font-extrabold">اعضا <span className="tnum text-muted">{fa(c.members.length)}</span></h2>
        {c.canManage ? <>
          <MemberTable members={c.members} leaderId={c.leader?.id} onRemove={(m) => remove.mutate(m.id)} onMakeLeader={(m) => leader.mutate(m.id)} />
          <p className="hint mt-3">شما پیشرفت دوره‌ها و حضور اعضا را می‌بینید؛ نمرهٔ آزمون، برگه‌های کار و گزارش مأموریت‌ها فقط برای خودشان و راهیارشان است.</p>
        </> : (
          <ul className="flex flex-wrap gap-2">{c.members.map((m) => <li key={m.id} className="chip">{m.name}</li>)}</ul>
        )}
      </section>
      {!c.canManage && <button className="btn btn-ghost btn-sm w-fit text-rose" onClick={() => remove.mutate(me!.id)}><Trash2 className="size-4" />بیرون آمدن از هسته</button>}
    </div>
  );
}

/** /join/:code — پیوند دعوت هسته یا مسجد برای کسی که وارد شده */
export function JoinPage() {
  const { code = '' } = useParams();
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => api<{ joined: string; id: string; name: string }>('/join', { body: { code } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); } });
  useEffect(() => { m.mutate(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="rise mx-auto max-w-md">
      {m.isPending || m.isIdle ? <Spinner label="در حال پیوستن" /> : m.error ? <ErrorBox error={m.error} /> : (
        <div className="card grid justify-items-center gap-3 p-8 text-center">
          {m.data!.joined === 'core' ? <UsersRound className="size-12 text-leaf" /> : <Landmark className="size-12 text-leaf" />}
          <h1 className="text-xl font-extrabold">به {m.data!.name} پیوستید</h1>
          <Link className="btn btn-primary" to={m.data!.joined === 'core' ? `/cores/${m.data!.id}` : '/'}>{m.data!.joined === 'core' ? 'دیدن هسته' : 'خانه'}</Link>
        </div>
      )}
    </div>
  );
}

// ───────── امام محله ─────────
interface ImamMosque { id: string; name: string; inviteCode: string; cores: { id: string; name: string; inviteCode: string; leader: string | null; members: Member[] }[]; free: Member[]; totals: { members: number; active: number; completed: number } }

export function ImamPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['imam'], queryFn: () => api<ImamMosque[]>('/imam') });
  const [make, setMake] = useState<string | null>(null);
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/cores', { body: { name, mosqueId: make } }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['imam'] }); setMake(null); setName(''); toast('هسته ساخته شد'); nav(`/cores/${c.id}`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <div className="rise grid gap-8">
      {q.data!.map((m) => (
        <section key={m.id} className="grid gap-5">
          <Title t={m.name} d="هسته‌ها و اعضای آزاد مسجد. مسئولیت هر هسته را خودتان دارید یا به یکی از اعضا می‌سپارید.">
            <button className="btn btn-primary" onClick={() => setMake(m.id)}><Plus className="size-4" />هستهٔ تازه</button>
          </Title>
          <div className="grid grid-cols-3 gap-3">
            {[['عضو', m.totals.members], ['فعال در دوره‌ها', m.totals.active], ['دورهٔ تمام‌شده', m.totals.completed]].map(([t, v]) => (
              <div key={t as string} className="card p-4 text-center"><b className="tnum block text-2xl text-ink">{fa(v as number)}</b><span className="text-sm text-muted">{t}</span></div>
            ))}
          </div>
          <div className="card grid gap-2 p-5">
            <b className="flex items-center gap-2 text-ink"><Link2 className="size-5 text-leaf" />پیوند دعوت مسجد</b>
            <p className="text-sm text-muted">برای کسانی که هنوز در هسته‌ای نیستند. با این پیوند به مسجد وصل می‌شوند و در فهرست «اعضای آزاد» می‌آیند.</p>
            <div className="flex flex-wrap items-center gap-2"><code dir="ltr" className="max-w-full truncate rounded-lg bg-sunken px-3 py-2 text-sm">{inviteUrl(m.inviteCode)}</code><CopyButton text={inviteUrl(m.inviteCode)} label="کپی پیوند" /></div>
          </div>
          {m.cores.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="me-auto font-extrabold">{c.name}</h2><span className="text-sm text-muted">{c.leader ? `مسئول: ${c.leader}` : 'بدون مسئول'}</span><Link className="btn btn-secondary btn-sm" to={`/cores/${c.id}`}>مدیریت</Link></div>
              <MemberTable members={c.members} />
            </div>
          ))}
          <div className="card p-5"><h2 className="mb-3 font-extrabold">اعضای آزاد <span className="tnum text-muted">{fa(m.free.length)}</span></h2><MemberTable members={m.free} /></div>
        </section>
      ))}
      <Dialog open={!!make} onClose={() => setMake(null)} title="هستهٔ تازه">
        <div className="grid gap-4">
          <div className="field"><label htmlFor="icn">نام هسته</label><input id="icn" className="input" placeholder="مثلاً هستهٔ نوجوانان" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <p className="hint">بعد از ساختن، پیوند دعوت هسته را برای اعضا بفرستید و اگر خواستید یکی را مسئول کنید.</p>
          <button className="btn btn-primary" disabled={name.trim().length < 2 || create.isPending} onClick={() => create.mutate()}>ساختن</button>
        </div>
      </Dialog>
    </div>
  );
}

// ───────── سازمان مشترک ─────────
interface OrgFull { id: string; name: string; underRahyar: boolean; subscription: OrgSub; courses: { id: string; title: string }[]; members: { id: string; name: string; courses: { courseId: string; state: 'done' | 'active' | 'none' }[] }[] }

export function OrgList() {
  const q = useQuery({ queryKey: ['orgs'], queryFn: () => api<{ id: string; name: string; subscription: OrgSub }[]>('/org') });
  const nav = useNavigate();
  useEffect(() => { if (q.data?.length === 1) nav(`/org/${q.data[0].id}`, { replace: true }); }, [q.data, nav]);
  if (q.isLoading) return <Spinner />;
  return (
    <div className="rise grid gap-6"><Title t="پنل سازمان" />
      {q.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{q.data.map((o) => <Link key={o.id} to={`/org/${o.id}`} className="card flex items-center gap-3 p-5 no-underline"><Building2 className="size-6 text-leaf" /><b className="flex-1 text-ink">{o.name}</b>
          {o.subscription.active ? <span className="chip chip-leaf">{o.subscription.subscription?.planLabel}</span> : <span className="chip chip-flame">اشتراک فعال نیست</span>}</Link>)}</div>
        : <Empty icon={Building2} title="مدیر سازمانی نیستید" />}
    </div>
  );
}

export function OrgPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['org', id], queryFn: () => api<OrgFull>(`/org/${id}`), retry: false });
  const sub = useQuery({ queryKey: ['org-sub', id], queryFn: () => api<OrgSub>(`/org/${id}/subscription`), enabled: q.error instanceof ApiError && q.error.code === 'no_subscription' });
  const [tab, setTab] = useState<'members' | 'report' | 'plans'>('members');
  const [add, setAdd] = useState(false);
  const [list, setList] = useState('');
  const [res, setRes] = useState<{ added: number; missing: string[] } | null>(null);
  const addM = useMutation({
    mutationFn: () => api<{ added: number; missing: string[] }>(`/org/${id}/members`, { body: { mobiles: list.split(/[\s,،]+/).filter(Boolean) } }),
    onSuccess: (r) => { setRes(r); qc.invalidateQueries({ queryKey: ['org', id] }); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const rm = useMutation({ mutationFn: (uid: string) => api(`/org/${id}/members/${uid}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['org', id] }); toast('از اشتراک برداشته شد'); } });
  if (q.isLoading) return <Spinner />;
  // بی‌اشتراک: پنل بسته است، ولی وضعیت و بسته‌ها دیده می‌شود
  if (q.error instanceof ApiError && q.error.code === 'no_subscription') return (
    <div className="rise grid gap-6"><Title t="پنل سازمان" />
      {sub.data ? <OrgSubscriptionCard s={sub.data} orgId={id} /> : <Spinner />}
      <section className="grid gap-3"><h2 className="text-lg font-extrabold">بسته‌های سازمانی</h2><PlansTable /></section>
    </div>
  );
  if (q.error) return <ErrorBox error={q.error} />;
  const o = q.data!;
  const st = { done: ['chip-leaf', 'تمام'], active: ['chip-flame', 'در حال گذراندن'], none: ['', 'شروع نکرده'] } as const;
  return (
    <div className="rise grid gap-6">
      <Title t={o.name} d={`${fa(o.members.length)} عضو · ${fa(o.courses.length)} دوره در اشتراک${o.underRahyar ? ' · زیر پوشش شبکهٔ راهیاری' : ''}`}>
        <button className="btn btn-primary" onClick={() => { setAdd(true); setRes(null); setList(''); }}><Plus className="size-4" />افزودن عضو</button>
      </Title>
      <OrgSubscriptionCard s={o.subscription} orgId={id} />
      <div className="seg w-fit">{([['members', 'اعضا'], ['report', 'گزارش فصلی'], ['plans', 'بسته‌ها']] as const).map(([k, t]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}</div>
      {tab === 'report' && <OrgReport orgId={id} />}
      {tab === 'plans' && <PlansTable highlight={o.subscription.subscription?.plan} />}
      {tab === 'members' && <section className="card p-5">
        {o.members.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-line text-muted"><th className="py-2 text-start font-semibold">نام</th>{o.courses.map((c) => <th key={c.id} className="px-2 font-semibold">{c.title}</th>)}<th /></tr></thead>
              <tbody>{o.members.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 font-semibold text-ink">{m.name}</td>
                  {m.courses.map((c) => <td key={c.courseId} className="px-2 text-center"><span className={`chip ${st[c.state][0]}`}>{st[c.state][1]}</span></td>)}
                  <td className="text-end"><button className="btn btn-ghost btn-icon btn-sm" aria-label={`برداشتن ${m.name}`} onClick={() => rm.mutate(m.id)}><UserMinus className="size-4" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty icon={UsersRound} title="هنوز عضوی اضافه نشده">شمارهٔ همراه کسانی را که در مدرسه حساب دارند وارد کنید.</Empty>}
      </section>}
      <p className="hint">شما فقط پیشرفت دوره‌های همین اشتراک را می‌بینید؛ متن گزارش‌ها و یادداشت‌های اعضا خصوصی است. قرارداد و پرداخت با ستاد مدرسه است.</p>
      <Dialog open={add} onClose={() => setAdd(false)} title="افزودن عضو با شمارهٔ همراه">
        {res ? (
          <div className="grid gap-3">
            <p className="text-ink">{fa(res.added)} نفر اضافه شدند.</p>
            {res.missing.length > 0 && <div className="rounded-xl bg-flame-soft p-3 text-sm"><b className="text-flame-ink">این شماره‌ها هنوز در مدرسه ثبت‌نام نکرده‌اند:</b><p dir="ltr" className="tnum mt-1 text-end">{res.missing.join('، ')}</p><p className="mt-1 text-body">از آن‌ها بخواهید ثبت‌نام کنند و دوباره اضافه‌شان کنید.</p></div>}
            <button className="btn btn-primary" onClick={() => setAdd(false)}>بستن</button>
          </div>
        ) : (
          <div className="grid gap-3">
            <textarea className="input ltr min-h-40" dir="ltr" placeholder={'09121234567\n09351234567'} value={list} onChange={(e) => setList(e.target.value)} />
            <p className="hint">هر شماره در یک خط یا با ویرگول جدا.</p>
            <button className="btn btn-primary" disabled={!list.trim() || addM.isPending} onClick={() => addM.mutate()}>افزودن</button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
