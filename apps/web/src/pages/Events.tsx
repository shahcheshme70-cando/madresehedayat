import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, CircleAlert, Clock, Hourglass, MapPin, MonitorPlay, Star, Ticket, Users, Video } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../components/ui';
import { useFeedbackContext } from '../components/Feedback';
import { useOpenLink } from '../lib/open';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fa, jDate, jDateTime, jTime, REG_LABEL } from '../lib/fa';
import type { EventCard, EventDetail } from '../lib/types';

type Scope = 'upcoming' | 'mine' | 'past';

export function DateBadge({ d }: { d: string }) {
  const x = new Date(d);
  const day = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }).format(x);
  const mon = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short' }).format(x);
  return (
    <div className="grid w-14 shrink-0 place-items-center rounded-2xl bg-dome-soft py-2 text-dome-ink" aria-hidden="true">
      <b className="text-2xl leading-none">{day}</b><span className="text-xs font-bold">{mon}</span>
    </div>
  );
}

export function RegChip({ e }: { e: EventCard }) {
  if (e.status === 'CANCELLED') return <span className="chip chip-rose">لغو شد</span>;
  if (e.my?.attendedAt) return <span className="chip chip-leaf">شرکت کردید</span>;
  if (e.my) return <span className={`chip ${e.my.status === 'REGISTERED' ? 'chip-leaf' : e.my.status === 'REJECTED' ? 'chip-rose' : 'chip-flame'}`}>{REG_LABEL[e.my.status]}</span>;
  if (e.seatsLeft === 0) return <span className="chip">{e.waitlist ? 'پر — فهرست انتظار' : 'ظرفیت پر'}</span>;
  if (e.seatsLeft != null && e.seatsLeft <= 5) return <span className="chip chip-flame">{fa(e.seatsLeft)} جای خالی</span>;
  return null;
}

export function EventRow({ e }: { e: EventCard }) {
  return (
    <Link to={`/events/${e.id}`} className="card flex items-center gap-4 p-4 no-underline transition hover:border-line-strong">
      <DateBadge d={e.startsAt} />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-ink">{e.title}</b>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1"><Clock className="size-3.5" />{jTime(e.startsAt)}</span>
          <span className="flex min-w-0 max-w-full items-center gap-1">{e.kind === 'ONLINE' ? <><Video className="size-3.5" />آنلاین</> : <><MapPin className="size-3.5" /><span className="truncate">{e.location ?? 'حضوری'}</span></>}</span>
        </span>
      </div>
      <RegChip e={e} />
    </Link>
  );
}

export default function Events() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const q = useQuery({ queryKey: ['events', scope], queryFn: () => api<EventCard[]>(`/events?scope=${scope}`) });
  return (
    <div className="rise grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">برنامه‌ها</h1><p className="mt-1 text-muted">دورهمی‌ها، کارگاه‌های حضوری و کلاس‌های آنلاین</p></div>
        <div className="seg" role="group" aria-label="کدام برنامه‌ها">
          {([['upcoming', 'پیش رو'], ['mine', 'ثبت‌نام‌های من'], ['past', 'گذشته']] as [Scope, string][]).map(([k, t]) => <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)}>{t}</button>)}
        </div>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : q.data?.length ? (
        <div className="grid gap-3 lg:grid-cols-2">{q.data.map((e) => <EventRow key={e.id} e={e} />)}</div>
      ) : <Empty icon={CalendarDays} title={scope === 'mine' ? 'در برنامه‌ای ثبت‌نام نکرده‌اید' : scope === 'past' ? 'برنامهٔ گذشته‌ای نیست' : 'فعلاً برنامه‌ای برای شما اعلام نشده'}>برنامه‌های تازه که برای شهر و گروه شما باشد اینجا می‌آید و اعلانش را می‌گیرید.</Empty>}
    </div>
  );
}

/** کارت ورود: کد QR که برگزارکننده دم در می‌خواند (با کد ۶ حرفی برای وقتی دوربین کار نکند) */
export function TicketCard({ eventId, code, title, when }: { eventId: string; code: string; title: string; when: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { QRCode.toString(`MH1:${eventId}:${code}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#262A4F', light: '#FFFFFF' } }).then(setSvg); }, [eventId, code]);
  return (
    <div className="mx-auto grid w-full max-w-xs justify-items-center gap-3 rounded-3xl border border-line bg-white p-5 text-center text-[#262A4F] shadow-lift">
      <span className="flex items-center gap-1.5 text-sm font-bold"><Ticket className="size-4" />کارت ورود</span>
      <div className="w-52 max-w-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="کد QR ورود" />
      <b dir="ltr" className="tnum text-2xl tracking-[.3em]">{code}</b>
      <span className="text-sm">{title}</span><span className="text-xs opacity-70">{when}</span>
    </div>
  );
}

export function EventPage() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api<EventDetail>(`/events/${id}`) });
  useFeedbackContext({ eventId: id });
  const [ticket, setTicket] = useState(false);
  const [group, setGroup] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const done = () => { qc.invalidateQueries({ queryKey: ['event', id] }); qc.invalidateQueries({ queryKey: ['events'] }); };
  const reg = useMutation({
    mutationFn: () => api<{ status: string }>(`/events/${id}/register`, { method: 'POST' }),
    onSuccess: (r) => { done(); toast(r.status === 'REGISTERED' ? 'ثبت‌نام شدید' : r.status === 'WAITLIST' ? 'در فهرست انتظار قرار گرفتید' : 'درخواستتان برای برگزارکننده فرستاده شد'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const cancel = useMutation({
    mutationFn: () => api<{ late: boolean }>(`/events/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => { done(); setAskCancel(false); toast('انصراف ثبت شد؛ جایتان به نفر بعدی می‌رسد'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const openLink = useOpenLink();
  const join = useMutation({
    mutationFn: () => api<{ url: string }>(`/events/${id}/join`, { method: 'POST' }),
    onSuccess: (r) => { done(); openLink(r.url); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const e = q.data!;
  const now = Date.now();
  const started = new Date(e.startsAt).getTime() < now;
  const ended = new Date(e.endsAt).getTime() < now;
  const lateCancel = new Date(e.startsAt).getTime() - now < 24 * 3600_000;
  const active = e.my && ['REGISTERED', 'WAITLIST', 'PENDING'].includes(e.my.status);
  const closed = e.status !== 'PUBLISHED' || started || (e.registrationDeadline && new Date(e.registrationDeadline).getTime() < now);

  return (
    <div className="rise mx-auto grid max-w-4xl gap-6">
      <Link to="/events" className="text-sm font-bold text-leaf-ink">→ همهٔ برنامه‌ها</Link>
      {e.status === 'CANCELLED' && <div className="flex items-start gap-3 rounded-2xl bg-rose-soft p-4 text-rose"><CircleAlert className="mt-0.5 size-5 shrink-0" /><div><b>این برنامه لغو شد.</b>{e.cancelReason && <p className="mt-1 text-body">{e.cancelReason}</p>}</div></div>}
      <header className="flex flex-wrap items-start gap-4">
        <DateBadge d={e.startsAt} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">{e.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2"><span className="chip chip-dome">{e.kind === 'ONLINE' ? 'آنلاین' : 'حضوری'}</span>{e.audienceGender && <span className="chip">{e.audienceGender === 'FEMALE' ? 'ویژهٔ خواهران' : 'ویژهٔ برادران'}</span>}<RegChip e={e} /></div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-5">
          <dl className="card grid gap-3 p-5">
            <div className="flex gap-3"><Clock className="mt-0.5 size-5 shrink-0 text-leaf" /><div><dt className="sr-only">زمان</dt><dd className="text-ink">{jDateTime(e.startsAt)} تا {jTime(e.endsAt)}</dd></div></div>
            {e.kind === 'IN_PERSON' && e.location && <div className="flex gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-leaf" /><div><dt className="sr-only">نشانی</dt><dd className="text-ink">{e.location}</dd>{e.mapUrl && <a href={e.mapUrl} target="_blank" rel="noopener" className="text-sm font-bold text-leaf-ink">دیدن روی نقشه</a>}</div></div>}
            {e.hostName && <div className="flex gap-3"><Users className="mt-0.5 size-5 shrink-0 text-leaf" /><dd className="text-ink">میزبان: {e.hostName}</dd></div>}
            {e.capacity != null && <div className="flex gap-3"><Ticket className="mt-0.5 size-5 shrink-0 text-leaf" /><dd className="text-ink">ظرفیت {fa(e.capacity)} نفر{e.seatsLeft != null && ` · ${e.seatsLeft ? fa(e.seatsLeft) + ' جای خالی' : 'پر شده'}`}</dd></div>}
            {e.registrationDeadline && <div className="flex gap-3"><Hourglass className="mt-0.5 size-5 shrink-0 text-leaf" /><dd className="text-ink">مهلت ثبت‌نام: {jDateTime(e.registrationDeadline)}</dd></div>}
          </dl>
          {e.description && <section><h2 className="mb-2 font-extrabold">دربارهٔ برنامه</h2><p className="prose-fa whitespace-pre-line">{e.description}</p></section>}
          {e.agenda && <section><h2 className="mb-2 font-extrabold">برنامهٔ جلسه</h2><p className="prose-fa whitespace-pre-line">{e.agenda}</p></section>}
          {e.bring && <section className="rounded-2xl bg-flame-soft p-4"><b className="text-flame-ink">همراه بیاورید: </b><span className="text-ink">{e.bring}</span></section>}
          {e.useBbb && <LiveSection eventId={e.id} ended={ended} />}
          {e.feeNote && <section className="rounded-2xl bg-sunken p-4"><b className="text-ink">هزینهٔ شرکت: </b><span>{e.feeNote}</span><p className="hint mt-1">پرداخت با برگزارکننده است؛ مدرسه پولی دریافت نمی‌کند.</p></section>}
        </div>

        <aside className="card grid content-start gap-3 p-5 md:sticky md:top-24">
          {e.blockedReason && !e.my ? <p className="flex gap-2 text-sm text-muted"><CircleAlert className="size-4 shrink-0" />{e.blockedReason}</p>
            : e.my?.status === 'REGISTERED' ? (
              <>
                <b className="text-ink">ثبت‌نام شما قطعی است</b>
                {e.kind === 'IN_PERSON' && e.my.checkInCode && !e.my.attendedAt && <button className="btn btn-primary" onClick={() => setTicket(true)}><Ticket className="size-4" />کارت ورود</button>}
                {e.kind === 'ONLINE' && !ended && (e.onlineSoon
                  ? <button className="btn btn-primary" onClick={() => join.mutate()} disabled={join.isPending}><MonitorPlay className="size-4" />ورود به کلاس</button>
                  : <p className="hint">پیوند کلاس هنوز گذاشته نشده.</p>)}
                {e.kind === 'ONLINE' && <p className="hint">{e.useBbb ? 'کلاس از ۱۵ دقیقه پیش از شروع باز می‌شود. اگر دست‌کم نیمی از زمان کلاس حاضر باشید، حضورتان ثبت می‌شود.' : 'پیوند کلاس از یک ساعت پیش از شروع باز می‌شود و ورودتان حضور حساب می‌شود.'}</p>}
                {e.record && <p className="hint">این کلاس ضبط می‌شود؛ ضبط فقط برای ثبت‌نامی‌ها و تا ۶ ماه می‌ماند.</p>}
                {!import.meta.env.VITE_DEMO && <a className="btn btn-secondary" href={`/api/events/${e.id}/ics`}><CalendarPlus className="size-4" />افزودن به تقویم</a>}
              </>
            ) : e.my?.status === 'WAITLIST' ? <p className="text-sm text-body"><b className="block text-ink">در فهرست انتظارید</b>اگر کسی انصراف بدهد، به نوبت جایش را می‌گیرید و اعلانش را می‌گیرید.</p>
            : e.my?.status === 'PENDING' ? <p className="text-sm text-body"><b className="block text-ink">منتظر تأیید برگزارکننده</b>نتیجه را با اعلان خبر می‌دهیم.</p>
            : !closed ? (
              <>
                <button className="btn btn-primary btn-lg" disabled={reg.isPending} onClick={() => reg.mutate()}>{e.requiresApproval ? 'درخواست شرکت' : e.seatsLeft === 0 ? 'رفتن به فهرست انتظار' : 'ثبت‌نام'}</button>
                {e.requiresApproval && <p className="hint">برگزارکننده درخواست‌ها را بررسی می‌کند.</p>}
              </>
            ) : <p className="text-sm text-muted">{e.status === 'CANCELLED' ? 'این برنامه برگزار نمی‌شود.' : ended ? 'این برنامه برگزار شده است.' : 'ثبت‌نام بسته است.'}</p>}

          {active && !started && e.status === 'PUBLISHED' && <button className="btn btn-ghost btn-sm text-rose" onClick={() => setAskCancel(true)}>انصراف</button>}
          {e.ledCores.length > 0 && !closed && <button className="btn btn-secondary btn-sm" onClick={() => setGroup(true)}><Users className="size-4" />ثبت‌نام گروهی هسته</button>}
          {e.canManage && e.useBbb && e.status === 'PUBLISHED' && !ended && e.my?.status !== 'REGISTERED' && <button className="btn btn-primary btn-sm" onClick={() => join.mutate()} disabled={join.isPending}><MonitorPlay className="size-4" />ورود به کلاس (برگزارکننده)</button>}
          {e.canManage && <Link className="btn btn-ghost btn-sm" to={`/manage/events/${e.id}`}>مدیریت این برنامه</Link>}
          {e.my?.attendedAt && <Feedback e={e} onDone={done} />}
        </aside>
      </div>

      <Dialog open={ticket} onClose={() => setTicket(false)} title="کارت ورود">
        {e.my?.checkInCode && <TicketCard eventId={e.id} code={e.my.checkInCode} title={e.title} when={jDateTime(e.startsAt)} />}
        <p className="hint mt-4 text-center">دم در این کد را نشان دهید. اگر اینترنت نبود، عکس صفحه هم کار می‌کند. {me?.firstName} {me?.lastName}</p>
      </Dialog>
      <Dialog open={askCancel} onClose={() => setAskCancel(false)} title="انصراف از برنامه">
        <p className="text-body">{lateCancel ? 'کمتر از ۲۴ ساعت به شروع مانده؛ انصراف دیرهنگام ثبت می‌شود تا برگزارکننده بداند. باز هم بهتر از نیامدن است، چون جای شما به نفر بعدی می‌رسد.' : 'جای شما به نفر بعدی فهرست انتظار می‌رسد.'}</p>
        <div className="mt-5 flex gap-2"><button className="btn btn-danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>انصراف می‌دهم</button><button className="btn btn-ghost" onClick={() => setAskCancel(false)}>نه، می‌آیم</button></div>
      </Dialog>
      {group && <GroupRegister e={e} onClose={() => { setGroup(false); done(); }} />}
    </div>
  );
}

function Feedback({ e, onDone }: { e: EventDetail; onDone: () => void }) {
  const [rating, setRating] = useState(e.my?.feedback?.rating ?? 0);
  const [comment, setComment] = useState(e.my?.feedback?.comment ?? '');
  const toast = useToast();
  const m = useMutation({ mutationFn: () => api(`/events/${e.id}/feedback`, { body: { rating, comment } }), onSuccess: () => { toast('ممنون از نظرتان'); onDone(); } });
  return (
    <div className="grid gap-2 border-t border-line pt-3">
      <b className="text-sm text-ink">برنامه چطور بود؟</b>
      <div className="flex gap-1" role="radiogroup" aria-label="امتیاز">{[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={rating === n} aria-label={`${fa(n)} از ۵`} onClick={() => setRating(n)} className="p-0.5"><Star className={`size-7 ${n <= rating ? 'fill-[var(--flame)] text-flame' : 'text-line-strong'}`} /></button>
      ))}</div>
      <textarea className="input min-h-20" placeholder="یک جمله، اختیاری" value={comment} onChange={(x) => setComment(x.target.value)} />
      <button className="btn btn-secondary btn-sm" disabled={!rating || m.isPending} onClick={() => m.mutate()}>{e.my?.feedback ? 'به‌روزرسانی نظر' : 'ثبت نظر'}</button>
    </div>
  );
}

function GroupRegister({ e, onClose }: { e: EventDetail; onClose: () => void }) {
  const [coreId, setCoreId] = useState(e.ledCores[0]?.id ?? '');
  const core = useQuery({ queryKey: ['core', coreId], queryFn: () => api<{ members: { id: string; name: string }[] }>(`/cores/${coreId}`), enabled: !!coreId });
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [res, setRes] = useState<{ name: string; status: string; reason?: string }[] | null>(null);
  const m = useMutation({ mutationFn: () => api<typeof res>(`/events/${e.id}/register-group`, { body: { coreId, userIds: Object.keys(pick).filter((k) => pick[k]) } }), onSuccess: setRes });
  const chosen = Object.values(pick).filter(Boolean).length;
  return (
    <Dialog open onClose={onClose} title="ثبت‌نام گروهی">
      {res ? (
        <div className="grid gap-3">
          <ul className="grid gap-2">{res!.map((r, i) => <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-sunken px-3 py-2"><span>{r.name}</span><span className={`chip ${r.status === 'REGISTERED' ? 'chip-leaf' : r.status === 'WAITLIST' || r.status === 'PENDING' ? 'chip-flame' : 'chip-rose'}`}>{REG_LABEL[r.status] ?? r.reason ?? 'ثبت نشد'}</span></li>)}</ul>
          <p className="hint">برای هر نفر اعلان رفت تا اگر نمی‌تواند بیاید، خودش انصراف بدهد.</p>
          <button className="btn btn-primary" onClick={onClose}>بستن</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {e.ledCores.length > 1 && <select className="input" value={coreId} onChange={(x) => { setCoreId(x.target.value); setPick({}); }}>{e.ledCores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          {core.isLoading ? <Spinner /> : (
            <ul className="grid max-h-80 gap-1.5 overflow-y-auto">{core.data?.members.map((x) => (
              <li key={x.id}><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5"><input type="checkbox" className="size-5 accent-[var(--leaf)]" checked={!!pick[x.id]} onChange={(ev) => setPick((p) => ({ ...p, [x.id]: ev.target.checked }))} />{x.name}</label></li>
            ))}</ul>
          )}
          <button className="btn btn-primary" disabled={!chosen || m.isPending} onClick={() => m.mutate()}>ثبت‌نام {fa(chosen)} نفر</button>
        </div>
      )}
    </Dialog>
  );
}


/** کلاس روی سرور مدرسه: حضور من و ضبط‌ها */
interface LiveInfo { useBbb: boolean; record: boolean; available: boolean; finalized: boolean; attendance: { minutes: number; needed: number; total: number } | null; recordings: { id: string; durationSec: number | null; startedAt: string | null; expiresAt: string }[]; canSeeRecordings: boolean }
export function LiveSection({ eventId, ended }: { eventId: string; ended: boolean }) {
  const q = useQuery({ queryKey: ['live', eventId], queryFn: () => api<LiveInfo>(`/events/${eventId}/live`), refetchInterval: ended ? false : 60_000 });
  const qc = useQueryClient(); const toast = useToast(); const openLink = useOpenLink();
  const open = useMutation({ mutationFn: (rid: string) => api<{ url: string }>(`/events/${eventId}/recordings/${rid}`, { method: 'POST' }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['lesson'] }); qc.invalidateQueries({ queryKey: ['course'] }); openLink(r.url); }, onError: (e) => toast((e as Error).message, 'err') });
  const l = q.data; if (!l) return null;
  if (!l.attendance && !l.recordings.length && !(ended && l.record && l.canSeeRecordings)) return null;
  return (
    <section className="card grid gap-3 p-5">
      <h2 className="font-extrabold">کلاس زنده</h2>
      {l.attendance && <div className="grid gap-1 text-sm"><span>حضور شما: <b className="text-ink">{fa(l.attendance.minutes)} دقیقه</b> از {fa(l.attendance.total)} دقیقه</span>
        <div className="bar" role="progressbar" aria-valuenow={l.attendance.minutes} aria-valuemax={l.attendance.total} aria-label="حضور"><span style={{ width: `${Math.min(100, (l.attendance.minutes / Math.max(1, l.attendance.total)) * 100)}%` }} /></div>
        <span className="hint">{l.attendance.minutes >= l.attendance.needed ? 'حضورتان کامل است' : `برای ثبت حضور دست‌کم ${fa(l.attendance.needed)} دقیقه لازم است`}{l.finalized ? '' : '؛ حضور نهایی نیم ساعت پس از پایان کلاس ثبت می‌شود'}.</span></div>}
      {l.recordings.length > 0 ? <div className="grid gap-2">{l.recordings.map((r, i) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-sunken p-3"><MonitorPlay className="size-5 text-leaf" /><span className="min-w-0 flex-1 text-sm">ضبط {l.recordings.length > 1 ? fa(i + 1) : 'کلاس'}{r.durationSec ? ` · ${fa(Math.round(r.durationSec / 60))} دقیقه` : ''}<span className="hint block">تا {jDate(r.expiresAt)} نگه داشته می‌شود</span></span>
          <button className="btn btn-secondary btn-sm" disabled={open.isPending} onClick={() => open.mutate(r.id)}>دیدن ضبط</button></div>))}</div>
        : ended && l.record && l.canSeeRecordings ? <p className="hint">ضبط کلاس پس از پردازش (معمولاً تا چند ساعت) همین‌جا می‌آید و با اعلان خبر می‌دهیم.</p> : null}
    </section>
  );
}
