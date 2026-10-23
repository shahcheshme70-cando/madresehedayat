import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Camera, CameraOff, CheckCircle2, CircleAlert, Download, Megaphone, Pencil, Plus, QrCode, ScanLine, Send, Star, Trash2, WifiOff, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fa, jDateTime, toEn } from '../lib/fa';
import { DateBadge } from './Events';
import { JalaliInput } from '../components/JalaliInput';

const useBase = () => (useLocation().pathname.startsWith('/admin') ? '/admin/events' : '/manage/events');

interface MRow { id: string; title: string; kind: string; startsAt: string; status: string; registered: number; waitlist: number; pending: number; attended: number; capacity: number | null }
interface Person { userId: string; name: string; status: string; code: string; attendedAt: string | null; method: string | null; lateCancel: boolean; feedback: { rating: number; comment?: string } | null; county: string | null; mosque: string | null; byGroup: boolean }
interface Full { event: any; counts: { registered: number; waitlist: number; pending: number; attended: number }; rating: number | null; people: Person[] }

const ST: Record<string, [string, string]> = { DRAFT: ['', 'پیش‌نویس'], PUBLISHED: ['chip-leaf', 'منتشر شده'], CANCELLED: ['chip-rose', 'لغو شده'] };

export function ManageEventList() {
  const base = useBase();
  const q = useQuery({ queryKey: ['manage-events'], queryFn: () => api<MRow[]>('/manage/events') });
  return (
    <div className="rise grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">برگزاری برنامه</h1><p className="mt-1 text-muted">برنامه بسازید، ثبت‌نامی‌ها را ببینید و دم در حضور بزنید.</p></div>
        <Link to={`${base}/new`} className="btn btn-primary"><Plus className="size-4" />برنامهٔ تازه</Link>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data?.length ? (
        <ul className="grid gap-2">{q.data.map((e) => (
          <li key={e.id}><Link to={`${base}/${e.id}`} className="card flex flex-wrap items-center gap-4 p-4 no-underline hover:border-line-strong">
            <DateBadge d={e.startsAt} />
            <div className="min-w-0 flex-1"><b className="block text-ink">{e.title}</b><span className="text-sm text-muted">{jDateTime(e.startsAt)} · {e.kind === 'ONLINE' ? 'آنلاین' : 'حضوری'}</span></div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className={`chip ${ST[e.status][0]}`}>{ST[e.status][1]}</span>
              <span className="chip">{fa(e.registered)}{e.capacity ? `/${fa(e.capacity)}` : ''} ثبت‌نام</span>
              {e.waitlist > 0 && <span className="chip chip-flame">{fa(e.waitlist)} انتظار</span>}
              {e.pending > 0 && <span className="chip chip-dome">{fa(e.pending)} منتظر تأیید</span>}
              {e.attended > 0 && <span className="chip chip-leaf">{fa(e.attended)} حاضر</span>}
            </div>
          </Link></li>
        ))}</ul>
      ) : <Empty icon={Megaphone} title="هنوز برنامه‌ای نساخته‌اید" />}
    </div>
  );
}

const toLocal = (v?: string | null) => v ?? '';
const fromLocal = (v: string) => v || null;

export function EventEditor() {
  const { id } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { has, isStaff } = useAuth();
  const onlyOnline = !isStaff && !has('RAHYAR');
  const ex = useQuery({ queryKey: ['manage-event', id], queryFn: () => api<Full>(`/manage/events/${id}`), enabled: !!id });
  const geo = useQuery({ queryKey: ['provinces'], queryFn: () => api<{ id: string; name: string; counties: { id: string; name: string }[] }[]>('/geo/provinces'), staleTime: Infinity });
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (id && ex.data) { const e = ex.data.event; setF({ ...e, startsAt: toLocal(e.startsAt), endsAt: toLocal(e.endsAt), registrationDeadline: toLocal(e.registrationDeadline) }); }
    else if (!id) setF({ kind: onlyOnline ? 'ONLINE' : 'IN_PERSON', waitlist: true, requiresApproval: false, title: '', startsAt: '', endsAt: '' });
  }, [id, ex.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => {
      const body: any = {};
      for (const k of ['title', 'kind', 'description', 'agenda', 'location', 'mapUrl', 'onlineUrl', 'bring', 'hostName', 'waitlist', 'requiresApproval', 'audienceGender', 'audienceProvinceId', 'audienceCountyId']) body[k] = f[k] ?? null;
      body.capacity = f.capacity ? Number(toEn(String(f.capacity))) : null;
      body.startsAt = fromLocal(f.startsAt); body.endsAt = fromLocal(f.endsAt); body.registrationDeadline = fromLocal(f.registrationDeadline);
      return id ? api(`/manage/events/${id}`, { method: 'PATCH', body }) : api<{ id: string }>('/manage/events', { body });
    },
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['manage-events'] }); qc.invalidateQueries({ queryKey: ['manage-event', id] }); toast('ذخیره شد'); nav(`${base}/${id ?? r.id}`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (!f || (id && ex.isLoading)) return <Spinner />;
  const set = (k: string) => (e: { target: { value: string } }) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const counties = geo.data?.find((p) => p.id === f.audienceProvinceId)?.counties ?? [];
  return (
    <div className="rise mx-auto grid max-w-3xl gap-6">
      <Link to={id ? `${base}/${id}` : base} className="text-sm font-bold text-leaf-ink">→ بازگشت</Link>
      <h1 className="text-[clamp(22px,3vw,28px)] font-extrabold">{id ? 'ویرایش برنامه' : 'برنامهٔ تازه'}</h1>
      <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <section className="card grid gap-4 p-5">
          <div className="field"><label htmlFor="t">عنوان</label><input id="t" className="input" required value={f.title} onChange={set('title')} placeholder="مثلاً کارگاه گفت‌وگو با نوجوان" /></div>
          {!onlyOnline && <div className="seg w-fit">{[['IN_PERSON', 'حضوری'], ['ONLINE', 'آنلاین']].map(([k, t]) => <button type="button" key={k} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })}>{t}</button>)}</div>}
          {onlyOnline && <p className="hint">مدرس‌ها برنامهٔ آنلاینِ خودشان را می‌سازند.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="s">شروع</label><JalaliInput id="s" label="شروع" value={f.startsAt} onChange={(v) => setF((x: any) => ({ ...x, startsAt: v, endsAt: x.endsAt || (v ? new Date(new Date(v).getTime() + 2 * 3600_000).toISOString() : '') }))} /></div>
            <div className="field"><label htmlFor="en">پایان</label><JalaliInput id="en" label="پایان" value={f.endsAt} onChange={(v) => setF((x: any) => ({ ...x, endsAt: v }))} /></div>
          </div>
          {f.kind === 'IN_PERSON' ? <>
            <div className="field"><label htmlFor="loc">نشانی</label><input id="loc" className="input" value={f.location ?? ''} onChange={set('location')} placeholder="شهر، مسجد، سالن" /></div>
            <div className="field"><label htmlFor="map">پیوند نقشه <span className="font-normal text-muted">(نشان یا بلد، اختیاری)</span></label><input id="map" className="input ltr" dir="ltr" value={f.mapUrl ?? ''} onChange={set('mapUrl')} placeholder="https://nshn.ir/…" /></div>
          </> : <div className="field"><label htmlFor="ou">پیوند کلاس</label><input id="ou" className="input ltr" dir="ltr" value={f.onlineUrl ?? ''} onChange={set('onlineUrl')} placeholder="https://…" /><span className="hint">فقط ثبت‌نامی‌ها و از یک ساعت پیش از شروع می‌بینند؛ ورودشان حضور حساب می‌شود.</span></div>}
          <div className="field"><label htmlFor="h">میزبان یا سخنران <span className="font-normal text-muted">(اختیاری)</span></label><input id="h" className="input" value={f.hostName ?? ''} onChange={set('hostName')} /></div>
          <div className="field"><label htmlFor="d">دربارهٔ برنامه</label><textarea id="d" className="input min-h-28" value={f.description ?? ''} onChange={set('description')} /></div>
          <div className="field"><label htmlFor="ag">برنامهٔ جلسه <span className="font-normal text-muted">(اختیاری)</span></label><textarea id="ag" className="input" value={f.agenda ?? ''} onChange={set('agenda')} /></div>
          <div className="field"><label htmlFor="b">همراه بیاورید <span className="font-normal text-muted">(اختیاری)</span></label><input id="b" className="input" value={f.bring ?? ''} onChange={set('bring')} /></div>
        </section>
        <section className="card grid gap-4 p-5">
          <h2 className="font-extrabold">ثبت‌نام</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="c">ظرفیت <span className="font-normal text-muted">(خالی = بی‌سقف)</span></label><input id="c" inputMode="numeric" className="input ltr" value={f.capacity ?? ''} onChange={set('capacity')} /></div>
            <div className="field"><label htmlFor="dl">مهلت ثبت‌نام <span className="font-normal text-muted">(اختیاری)</span></label><JalaliInput id="dl" optional label="مهلت ثبت‌نام" value={f.registrationDeadline ?? ''} onChange={(v) => setF((x: any) => ({ ...x, registrationDeadline: v }))} /></div>
          </div>
          <label className="flex items-center gap-3"><input type="checkbox" className="size-5 accent-[var(--leaf)]" checked={!!f.waitlist} onChange={(e) => setF({ ...f, waitlist: e.target.checked })} />وقتی پر شد، فهرست انتظار داشته باشد</label>
          <label className="flex items-center gap-3"><input type="checkbox" className="size-5 accent-[var(--leaf)]" checked={!!f.requiresApproval} onChange={(e) => setF({ ...f, requiresApproval: e.target.checked })} />ثبت‌نام‌ها را خودم تأیید کنم</label>
        </section>
        <section className="card grid gap-4 p-5">
          <h2 className="font-extrabold">مخاطب</h2>
          <div className="seg w-fit">{[['', 'همه'], ['FEMALE', 'خواهران'], ['MALE', 'برادران']].map(([k, t]) => <button type="button" key={k} aria-pressed={(f.audienceGender ?? '') === k} onClick={() => setF({ ...f, audienceGender: k || null })}>{t}</button>)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="ap">استان</label><select id="ap" className="input" value={f.audienceProvinceId ?? ''} onChange={(e) => setF({ ...f, audienceProvinceId: e.target.value || null, audienceCountyId: null })}><option value="">همهٔ استان‌ها</option>{geo.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="ac">شهرستان</label><select id="ac" className="input" disabled={!counties.length} value={f.audienceCountyId ?? ''} onChange={(e) => setF({ ...f, audienceCountyId: e.target.value || null })}><option value="">همهٔ شهرستان‌ها</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <p className="hint">برنامه فقط به همین مخاطبان نشان داده می‌شود.</p>
        </section>
        <div className="flex gap-2"><button className="btn btn-primary btn-lg" disabled={save.isPending}>{id ? 'ذخیرهٔ تغییرات' : 'ساختن پیش‌نویس'}</button></div>
        {id && ex.data?.event.status === 'PUBLISHED' && <p className="hint">اگر زمان یا نشانی را عوض کنید، به همهٔ ثبت‌نامی‌ها خبر داده می‌شود.</p>}
      </form>
    </div>
  );
}

export function ManageEvent() {
  const { id = '' } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['manage-event', id], queryFn: () => api<Full>(`/manage/events/${id}`) });
  const [tab, setTab] = useState('REGISTERED');
  const [dlg, setDlg] = useState<'cancel' | 'notify' | null>(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState({ title: '', body: '' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['manage-event', id] }); qc.invalidateQueries({ queryKey: ['manage-events'] }); };
  const err = (e: unknown) => toast((e as Error).message, 'err');
  const publish = useMutation({ mutationFn: () => api(`/manage/events/${id}/publish`, { method: 'POST' }), onSuccess: () => { refresh(); toast('منتشر شد؛ مخاطبان می‌بینند'); }, onError: err });
  const cancel = useMutation({ mutationFn: () => api(`/manage/events/${id}/cancel`, { body: { reason } }), onSuccess: () => { refresh(); setDlg(null); toast('لغو شد و به ثبت‌نامی‌ها خبر داده شد'); }, onError: err });
  const del = useMutation({ mutationFn: () => api(`/manage/events/${id}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['manage-events'] }); nav(base); }, onError: err });
  const decide = useMutation({ mutationFn: (v: { userId: string; action: string }) => api(`/manage/events/${id}/people/${v.userId}`, { body: { action: v.action } }), onSuccess: refresh, onError: err });
  const notify = useMutation({ mutationFn: () => api<{ sent: number }>(`/manage/events/${id}/notify`, { body: { ...msg, to: 'registered' } }), onSuccess: (r) => { setDlg(null); setMsg({ title: '', body: '' }); toast(`برای ${fa(r.sent)} نفر فرستاده شد`); }, onError: err });
  const csv = async () => {
    try {
      if (import.meta.env.VITE_DEMO) { toast('در نسخهٔ نمایشی فایل ساخته نمی‌شود', 'err'); return; }
      const r = await fetch(`/api/manage/events/${id}/csv`, { credentials: 'include' });
      const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `registrants-${id}.csv`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { err(e); }
  };
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { event: e, counts, people, rating } = q.data!;
  const list = people.filter((p) => (tab === 'ATTENDED' ? p.attendedAt : p.status === tab));
  const tabs: [string, string, number][] = [['REGISTERED', 'ثبت‌نام', counts.registered], ['WAITLIST', 'انتظار', counts.waitlist], ['PENDING', 'منتظر تأیید', counts.pending], ['ATTENDED', 'حاضر', counts.attended], ['CANCELLED', 'انصراف', people.filter((p) => p.status === 'CANCELLED').length]];
  return (
    <div className="rise grid gap-6">
      <Link to={base} className="text-sm font-bold text-leaf-ink">→ برنامه‌های من</Link>
      <header className="flex flex-wrap items-start gap-4">
        <DateBadge d={e.startsAt} />
        <div className="min-w-0 flex-1"><h1 className="text-[clamp(20px,2.6vw,26px)] font-extrabold">{e.title}</h1>
          <p className="mt-1 text-muted">{jDateTime(e.startsAt)} · {e.kind === 'ONLINE' ? 'آنلاین' : e.location ?? 'حضوری'}</p>
          <div className="mt-2 flex flex-wrap gap-2"><span className={`chip ${ST[e.status][0]}`}>{ST[e.status][1]}</span>{rating != null && <span className="chip chip-flame"><Star className="size-3.5" />{fa(rating)} از ۵</span>}</div></div>
        <div className="flex flex-wrap gap-2">
          {e.status === 'DRAFT' && <button className="btn btn-primary" disabled={publish.isPending} onClick={() => publish.mutate()}>انتشار</button>}
          {e.status === 'PUBLISHED' && e.kind === 'IN_PERSON' && <Link className="btn btn-primary" to={`${base}/${id}/checkin`}><ScanLine className="size-4" />حضور دم در</Link>}
          {e.status !== 'CANCELLED' && <Link className="btn btn-secondary" to={`${base}/${id}/edit`}><Pencil className="size-4" />ویرایش</Link>}
          {e.status === 'PUBLISHED' && <button className="btn btn-secondary" onClick={() => setDlg('notify')}><Send className="size-4" />پیام به ثبت‌نامی‌ها</button>}
          <button className="btn btn-ghost" onClick={csv}><Download className="size-4" />CSV</button>
          {e.status === 'PUBLISHED' && <button className="btn btn-ghost text-rose" onClick={() => setDlg('cancel')}><Ban className="size-4" />لغو</button>}
          {e.status === 'DRAFT' && <button className="btn btn-ghost text-rose" onClick={() => del.mutate()}><Trash2 className="size-4" />حذف</button>}
        </div>
      </header>
      <section className="card p-5">
        <div className="seg mb-4" role="group">{tabs.map(([k, t, n]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t} <span className="tnum text-muted">{fa(n)}</span></button>)}</div>
        {list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-line text-muted"><th className="py-2 text-start font-semibold">نام</th><th className="text-start font-semibold">شهرستان / مسجد</th><th className="font-semibold">کد</th><th className="font-semibold">حضور</th><th /></tr></thead>
              <tbody>{list.map((p) => (
                <tr key={p.userId} className="border-b border-line last:border-0">
                  <td className="py-2.5"><b className="text-ink">{p.name}</b>{p.byGroup && <span className="block text-xs text-muted">ثبت‌نام گروهی</span>}{p.lateCancel && <span className="block text-xs text-flame-ink">انصراف دیرهنگام</span>}{p.feedback?.comment && <span className="block text-xs text-muted">«{p.feedback.comment}»</span>}</td>
                  <td className="text-muted">{[p.county, p.mosque].filter(Boolean).join(' · ')}</td>
                  <td dir="ltr" className="tnum text-center text-muted">{p.status === 'REGISTERED' ? p.code : ''}</td>
                  <td className="text-center">{p.attendedAt ? <span className="chip chip-leaf">{p.method === 'ONLINE' ? 'آنلاین' : p.method === 'QR' ? 'با کارت' : 'دستی'}</span> : '—'}</td>
                  <td className="whitespace-nowrap text-end">
                    {p.status === 'PENDING' && <><button className="btn btn-secondary btn-sm" onClick={() => decide.mutate({ userId: p.userId, action: 'approve' })}>تأیید</button><button className="btn btn-ghost btn-sm" onClick={() => decide.mutate({ userId: p.userId, action: 'reject' })}>رد</button></>}
                    {p.status === 'REGISTERED' && (p.attendedAt
                      ? <button className="btn btn-ghost btn-sm" onClick={() => decide.mutate({ userId: p.userId, action: 'unattend' })}>برداشتن حضور</button>
                      : <button className="btn btn-secondary btn-sm" onClick={() => decide.mutate({ userId: p.userId, action: 'attend' })}>حاضر</button>)}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="py-8 text-center text-sm text-muted">کسی در این فهرست نیست.</p>}
        <p className="hint mt-3">شمارهٔ همراه شرکت‌کنندگان نشان داده نمی‌شود؛ برای خبر دادن از «پیام به ثبت‌نامی‌ها» استفاده کنید.</p>
      </section>
      <Dialog open={dlg === 'cancel'} onClose={() => setDlg(null)} title="لغو برنامه">
        <div className="grid gap-3"><label htmlFor="rs" className="text-sm font-bold">دلیل لغو <span className="font-normal text-muted">(برای همهٔ ثبت‌نامی‌ها فرستاده می‌شود)</span></label>
          <textarea id="rs" className="input" value={reason} onChange={(x) => setReason(x.target.value)} />
          <button className="btn btn-danger w-fit" disabled={reason.trim().length < 3 || cancel.isPending} onClick={() => cancel.mutate()}>لغو برنامه</button></div>
      </Dialog>
      <Dialog open={dlg === 'notify'} onClose={() => setDlg(null)} title="پیام به ثبت‌نامی‌ها">
        <div className="grid gap-3">
          <input className="input" placeholder="عنوان کوتاه، مثلاً «تغییر سالن»" value={msg.title} onChange={(x) => setMsg({ ...msg, title: x.target.value })} />
          <textarea className="input" placeholder="متن (اختیاری)" value={msg.body} onChange={(x) => setMsg({ ...msg, body: x.target.value })} />
          <button className="btn btn-primary w-fit" disabled={msg.title.trim().length < 2 || notify.isPending} onClick={() => notify.mutate()}>فرستادن</button></div>
      </Dialog>
    </div>
  );
}

// ───────── حضور دم در ─────────
type Result = { ok: boolean; name?: string; message: string; already?: boolean; offline?: boolean };
const QKEY = (id: string) => `mh-checkin-queue-${id}`;
const readQ = (id: string): { code: string; at: string }[] => { try { return JSON.parse(localStorage.getItem(QKEY(id)) ?? '[]'); } catch { return []; } };
const writeQ = (id: string, v: { code: string; at: string }[]) => { try { localStorage.setItem(QKEY(id), JSON.stringify(v)); } catch { /* حافظه در دسترس نیست */ } };

export function CheckIn() {
  const { id = '' } = useParams();
  const base = useBase();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['manage-event', id], queryFn: () => api<Full>(`/manage/events/${id}`) });
  const [code, setCode] = useState('');
  const [last, setLast] = useState<Result | null>(null);
  const [queue, setQueue] = useState(() => readQ(id));
  const [cam, setCam] = useState(false);
  const busy = useRef(false);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

  const submit = useCallback(async (raw: string) => {
    const c = toEn(raw).trim();
    if (!c || busy.current) return;
    busy.current = true;
    try {
      const r = await api<Result>(`/manage/events/${id}/checkin`, { body: { code: c } });
      setLast(r); qc.invalidateQueries({ queryKey: ['manage-event', id] });
      if (r.ok && navigator.vibrate) navigator.vibrate(60);
    } catch (e: any) {
      if (e?.code === 'offline') {
        const nq = [...readQ(id), { code: c, at: new Date().toISOString() }]; writeQ(id, nq); setQueue(nq);
        setLast({ ok: true, offline: true, message: 'بی‌اینترنت ثبت شد؛ بعداً همگام می‌شود' });
      } else setLast({ ok: false, message: e?.message ?? 'خطا' });
    } finally { setCode(''); setTimeout(() => { busy.current = false; }, 1200); }
  }, [id, qc]);

  const sync = useMutation({
    mutationFn: () => api<Result[]>(`/manage/events/${id}/checkin-bulk`, { body: { items: readQ(id) } }),
    onSuccess: (r) => { writeQ(id, []); setQueue([]); qc.invalidateQueries({ queryKey: ['manage-event', id] }); setLast({ ok: true, message: `${fa(r.filter((x) => x.ok).length)} ورود همگام شد${r.some((x) => !x.ok) ? `؛ ${fa(r.filter((x) => !x.ok).length)} کد نامعتبر` : ''}` }); },
  });
  useEffect(() => { const on = () => readQ(id).length && sync.mutate(); window.addEventListener('online', on); return () => window.removeEventListener('online', on); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { event: e, counts } = q.data!;
  return (
    <div className="rise mx-auto grid max-w-lg gap-5">
      <Link to={`${base}/${id}`} className="text-sm font-bold text-leaf-ink">→ {e.title}</Link>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">حضور دم در</h1><span className="chip chip-leaf tnum">{fa(counts.attended)} از {fa(counts.registered)} حاضر</span></div>
      {supported ? (cam ? <Scanner onCode={submit} onClose={() => setCam(false)} /> : <button className="btn btn-primary btn-lg" onClick={() => setCam(true)}><Camera className="size-5" />خواندن کارت با دوربین</button>)
        : <p className="flex gap-2 rounded-xl bg-sunken p-3 text-sm text-body"><QrCode className="size-4 shrink-0" />این مرورگر خواندن QR را پشتیبانی نمی‌کند؛ کد ۶ حرفی زیر کارت را تایپ کنید.</p>}
      <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); submit(code); }}>
        <input className="input ltr tnum flex-1 text-center text-xl tracking-[.3em] uppercase" dir="ltr" maxLength={6} placeholder="K7M2QX" value={code} onChange={(x) => setCode(x.target.value.toUpperCase())} aria-label="کد ورود" autoComplete="off" />
        <button className="btn btn-secondary h-[46px]" disabled={code.length < 4}>ثبت</button>
      </form>
      {last && (
        <div className={`rise flex items-center gap-3 rounded-2xl p-4 ${last.offline ? 'bg-flame-soft' : last.ok ? (last.already ? 'bg-dome-soft' : 'bg-leaf-soft') : 'bg-rose-soft'}`} role="status">
          {last.offline ? <WifiOff className="size-8 text-flame-ink" /> : last.ok ? <CheckCircle2 className="size-8 text-leaf" /> : <XCircle className="size-8 text-rose" />}
          <div>{last.name && <b className="block text-lg text-ink">{last.name}</b>}<span className="text-body">{last.message}</span></div>
        </div>
      )}
      {queue.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3 p-4"><WifiOff className="size-5 text-flame-ink" /><span className="flex-1 text-sm">{fa(queue.length)} ورود بی‌اینترنت ثبت شده</span>
          <button className="btn btn-secondary btn-sm" disabled={sync.isPending} onClick={() => sync.mutate()}>همگام‌سازی</button></div>
      )}
      <p className="hint">اگر کسی کارت نداشت، از فهرست ثبت‌نامی‌ها دکمهٔ «حاضر» را بزنید.</p>
    </div>
  );
}

function Scanner({ onCode, onClose }: { onCode: (c: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null; let stop = false; let timer = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const det = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop || !video.current) return;
          try { const r = await det.detect(video.current); if (r[0]?.rawValue) onCode(r[0].rawValue); } catch { /* فریم بعد */ }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch { setErr('دسترسی به دوربین داده نشد. از تنظیمات مرورگر اجازه دهید یا کد را تایپ کنید.'); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink">
      {err ? <p className="flex gap-2 p-5 text-sm text-white"><CircleAlert className="size-4 shrink-0" />{err}</p> : <video ref={video} className="aspect-square w-full object-cover" playsInline muted />}
      <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/80" aria-hidden="true" />
      <button className="btn btn-secondary btn-sm absolute top-3 start-3" onClick={onClose}><CameraOff className="size-4" />بستن دوربین</button>
    </div>
  );
}


