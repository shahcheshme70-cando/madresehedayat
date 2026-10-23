import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Megaphone, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Empty, Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { ago, fa } from '../lib/fa';

type Aud = { kind: string; ids?: string[]; label: string };
interface Opts { hq: boolean; options: Aud[]; approvalOver: number; roles: { id: string; label: string }[] }
export interface BRow { id: string; title: string; body: string | null; audience: { label: string }; recipientCount: number; status: string; createdAt: string; sender: string }
const ST: Record<string, [string, string]> = { SENT: ['chip-leaf', 'فرستاده شد'], PENDING: ['chip-flame', 'منتظر تأیید'], REJECTED: ['chip-rose', 'تأیید نشد'] };

/** پیام گروهی: هر کس فقط به گروه‌هایی که در اختیارش است */
export function BroadcastPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const o = useQuery({ queryKey: ['bc-options'], queryFn: () => api<Opts>('/broadcasts/options') });
  const mine = useQuery({ queryKey: ['bc-mine'], queryFn: () => api<BRow[]>('/broadcasts/mine') });
  const geo = useQuery({ queryKey: ['provinces'], queryFn: () => api<{ id: string; name: string; counties: { id: string; name: string }[] }[]>('/geo/provinces'), staleTime: Infinity, enabled: !!o.data?.hq });
  const nets = useQuery({ queryKey: ['admin-networks'], queryFn: () => api<{ id: string; name: string }[]>('/admin/networks'), enabled: !!o.data?.hq });
  const courses = useQuery({ queryKey: ['catalog'], queryFn: () => api<{ id: string; title: string }[]>('/courses'), enabled: !!o.data?.hq });
  const [aud, setAud] = useState<Aud | null>(null);
  const [f, setF] = useState({ title: '', body: '', link: '' });
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(null);
    if (!aud || (aud.kind !== 'ALL' && aud.kind !== 'SCOPE' && !aud.ids?.length)) return;
    const t = setTimeout(() => api<{ count: number }>('/broadcasts/preview', { body: { kind: aud.kind, ids: aud.ids } }).then((r) => setCount(r.count)).catch(() => setCount(null)), 300);
    return () => clearTimeout(t);
  }, [aud]);
  const send = useMutation({
    mutationFn: () => api<{ status: string; recipients: number }>('/broadcasts', { body: { kind: aud!.kind, ids: aud!.ids, title: f.title, body: f.body || undefined, link: f.link || undefined } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['bc-mine'] }); setF({ title: '', body: '', link: '' }); toast(r.status === 'PENDING' ? `برای ${fa(r.recipients)} نفر؛ منتظر تأیید مدیر ستاد` : `برای ${fa(r.recipients)} نفر فرستاده شد`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (o.isLoading) return <Spinner />;
  const opts = o.data!;
  const hqKinds: [string, string][] = opts.hq ? [['PROVINCE', 'استان'], ['COUNTY', 'شهرستان'], ['NETWORK', 'شبکه یا سازمان'], ['ROLE', 'نقش'], ['COURSE', 'یادگیرندگان یک دوره']] : [];
  if (!opts.options.length && !opts.hq) return <Empty icon={Megaphone} title="گروهی برای پیام دادن ندارید">پیام گروهی برای راهیار، امام محله و مسئول هسته است.</Empty>;
  const pickSel = (kind: string, label: string, list: { id: string; name?: string; title?: string; label?: string }[]) => (
    <select className="input" value={aud?.kind === kind ? aud.ids?.[0] ?? '' : ''} onChange={(e) => { const x = list.find((i) => i.id === e.target.value); setAud(x ? { kind, ids: [x.id], label: `${label}: ${x.name ?? x.title ?? x.label}` } : null); }}>
      <option value="">انتخاب کنید</option>{list.map((i) => <option key={i.id} value={i.id}>{i.name ?? i.title ?? i.label}</option>)}
    </select>
  );
  return (
    <div className="rise mx-auto grid max-w-3xl gap-6">
      <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">پیام گروهی</h1><p className="mt-1 text-muted">پیام به‌صورت اعلان داخل سامانه (و بله، برای کسانی که وصل کرده‌اند) می‌رسد. بیش از {fa(opts.approvalOver)} گیرنده، تأیید مدیر ستاد می‌خواهد.</p></div>
      <section className="card grid gap-4 p-5">
        <b className="text-ink">به چه کسانی؟</b>
        <div className="flex flex-wrap gap-2">{opts.options.map((a) => <button key={a.kind + (a.ids?.[0] ?? '')} className={`chip h-9 cursor-pointer px-3 ${aud?.label === a.label ? 'chip-leaf' : ''}`} onClick={() => setAud(a)}>{a.label}</button>)}</div>
        {opts.hq && <div className="grid gap-3 sm:grid-cols-2">
          {hqKinds.map(([k, t]) => (
            <div key={k} className="field"><label>{t}</label>
              {k === 'PROVINCE' ? pickSel(k, 'استان', geo.data ?? [])
                : k === 'COUNTY' ? pickSel(k, 'شهرستان', (geo.data ?? []).flatMap((p) => p.counties.map((c) => ({ id: c.id, name: `${c.name} (${p.name})` }))))
                : k === 'NETWORK' ? pickSel(k, 'شبکه', nets.data ?? [])
                : k === 'ROLE' ? pickSel(k, 'نقش', opts.roles)
                : pickSel(k, 'دوره', courses.data ?? [])}</div>
          ))}
        </div>}
        {aud && <p className="rounded-xl bg-sunken p-3 text-sm"><b>{aud.label}</b>{count != null && <> · <span className="tnum">{fa(count)}</span> گیرنده{count > opts.approvalOver && <span className="text-flame-ink"> · نیاز به تأیید مدیر ستاد</span>}</>}</p>}
      </section>
      <section className="card grid gap-4 p-5">
        <div className="field"><label htmlFor="bt">عنوان</label><input id="bt" className="input" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="bb">متن <span className="font-normal text-muted">(اختیاری)</span></label><textarea id="bb" className="input min-h-28" maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        <div className="field"><label htmlFor="bl">پیوند داخل مدرسه <span className="font-normal text-muted">(اختیاری، مثلاً ‎/events)</span></label><input id="bl" className="input ltr" dir="ltr" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div>
        <button className="btn btn-primary w-fit" disabled={!aud || f.title.trim().length < 2 || !count || send.isPending} onClick={() => send.mutate()}><Send className="size-4 -scale-x-100" />فرستادن</button>
      </section>
      <section><h2 className="mb-3 font-extrabold">پیام‌های من</h2><BroadcastList rows={mine.data ?? []} /></section>
    </div>
  );
}

export function BroadcastList({ rows, onReview }: { rows: BRow[]; onReview?: (id: string, ok: boolean) => void }) {
  if (!rows.length) return <p className="text-sm text-muted">پیامی نیست.</p>;
  return (
    <ul className="grid gap-2">{rows.map((b) => (
      <li key={b.id} className="card flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1"><b className="block text-ink">{b.title}</b>{b.body && <p className="mt-1 line-clamp-2 text-sm text-body">{b.body}</p>}
          <span className="mt-1 block text-xs text-muted">{b.sender} · {b.audience.label} · <span className="tnum">{fa(b.recipientCount)}</span> نفر · {ago(b.createdAt)}</span></div>
        <span className={`chip ${ST[b.status][0]}`}>{ST[b.status][1]}</span>
        {onReview && b.status === 'PENDING' && <div className="flex gap-1"><button className="btn btn-primary btn-sm" onClick={() => onReview(b.id, true)}><Check className="size-4" />تأیید</button><button className="btn btn-ghost btn-sm" onClick={() => onReview(b.id, false)}><X className="size-4" />رد</button></div>}
      </li>
    ))}</ul>
  );
}

export function AdminBroadcasts() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-bc'], queryFn: () => api<BRow[]>('/admin/broadcasts') });
  const review = async (id: string, ok: boolean) => { try { await api(`/admin/broadcasts/${id}/${ok ? 'approve' : 'reject'}`, { method: 'POST' }); qc.invalidateQueries({ queryKey: ['admin-bc'] }); toast(ok ? 'فرستاده شد' : 'رد شد'); } catch (e) { toast((e as Error).message, 'err'); } };
  return (
    <div className="rise grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[clamp(22px,2.6vw,28px)] font-extrabold">پیام‌های گروهی</h1><p className="mt-1 text-muted">پیام‌های بیش از هزار گیرنده اینجا منتظر تأیید می‌مانند.</p></div>
        <Link to="/broadcast" className="btn btn-primary"><Megaphone className="size-4" />پیام تازه</Link></div>
      {q.isLoading ? <Spinner /> : <BroadcastList rows={q.data ?? []} onReview={review} />}
    </div>
  );
}
