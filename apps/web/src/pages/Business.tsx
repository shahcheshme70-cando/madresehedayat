import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Building2, Check, Download, FileText, HandHeart, Minus, Plus, Receipt, Settings2, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { JalaliInput } from '../components/JalaliInput';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { fa, jDate, toEn } from '../lib/fa';
import { PageHead } from './admin/AdminShell';

/* ═════════════ مدل کسب‌وکار (دور چهارم — docs/decisions.md) ═════════════ */

export const money = (n: number | null | undefined) => (n == null ? '—' : fa(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬'));
export function moneyShort(n: number) {
  if (Math.abs(n) >= 1e9) return fa((n / 1e9).toFixed(n % 1e9 ? 2 : 0)).replace('.', '٫') + ' میلیارد';
  if (Math.abs(n) >= 1e6) return fa((n / 1e6).toFixed(n % 1e6 && n < 1e8 ? 1 : 0)).replace('.', '٫') + ' میلیون';
  return money(n);
}
const num = (v: string) => { const n = Number(toEn(v).replace(/[^\d]/g, '')); return Number.isFinite(n) ? n : 0; };

export type Plan = 'ORG_BASIC' | 'ORG_PREMIUM';
export const PLAN_LABEL: Record<Plan, string> = { ORG_BASIC: 'سازمانی پایه', ORG_PREMIUM: 'سازمانی ویژه' };
const SUB_ST: Record<string, [string, string]> = { ACTIVE: ['chip-leaf', 'فعال'], UPCOMING: ['chip-dome', 'آینده'], ENDED: ['', 'تمام‌شده'], CANCELLED: ['chip-rose', 'لغوشده'] };

interface PlansData { tiers: { id: string; label: string; who: string; price: string }[]; services: { group: string; items: { name: string; note?: string; v: string }[] }[] }

/** جدول بسته‌ها و خدمات؛ در پنل ستاد و پنل سازمان */
export function PlansTable({ highlight }: { highlight?: string }) {
  const q = useQuery({ queryKey: ['plans'], queryFn: () => api<PlansData>('/plans'), staleTime: Infinity });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { tiers, services } = q.data!;
  const cell = (v: string) => v === 'y' ? <Check className="mx-auto size-5 text-leaf" aria-label="دارد" /> : v === 'l' ? <span className="chip chip-flame">محدود</span> : <Minus className="mx-auto size-4 text-line-strong" aria-label="ندارد" />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="bg-sunken">
          <th className="px-4 py-3 text-start text-xs font-bold text-muted">خدمت</th>
          {tiers.map((t) => <th key={t.id} className={`px-3 py-3 text-center ${highlight === t.id ? 'bg-leaf-soft' : ''}`}><b className="block text-ink">{t.label}</b><span className="text-xs font-normal text-muted">{t.price}</span></th>)}
        </tr></thead>
        <tbody>{services.map((g) => [
          <tr key={g.group}><th colSpan={tiers.length + 1} className="bg-bg px-4 py-2 text-start text-xs font-extrabold text-leaf-ink">{g.group}</th></tr>,
          ...g.items.map((it) => (
            <tr key={it.name} className="border-t border-line">
              <td className="px-4 py-2.5"><span className="text-ink">{it.name}</span>{it.note && <span className="block text-xs text-muted">{it.note}</span>}</td>
              {tiers.map((t, i) => <td key={t.id} className={`px-3 py-2.5 text-center ${highlight === t.id ? 'bg-leaf-soft/50' : ''}`}>{cell(it.v[i])}</td>)}
            </tr>)),
        ])}</tbody>
      </table>
    </div>
  );
}

/* ───────── پیشخوان ستاد: سنجه‌ها ───────── */
interface Kpi {
  activeUsers: number; fieldActive: number; costYear: number; costPerFieldActive: number | null; costPerActive: number | null; perSeat: number;
  orgs: number; seatsSold: number; year: number; income: { subscriptions: number; services: number; sponsors: number }; incomeTotal: number; hqShare: number;
}
export function BusinessKpi() {
  const q = useQuery({ queryKey: ['biz-kpi'], queryFn: () => api<Kpi>('/admin/business/kpi') });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const k = q.data!;
  const pct = (x: number) => (k.costYear ? Math.min(100, (x / k.costYear) * 100) : 0);
  return (
    <section className="card grid gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-extrabold">کنشگر فعال میدانی و هزینه</h2><Link to="/admin/business" className="text-sm font-bold text-leaf-ink">مدل کسب‌وکار ←</Link></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['کنشگر فعال میدانی', fa(k.fieldActive), 'مأموریت یا کار پویش در ۱۲ ماه'],
          ['هزینه به ازای هر نفر', k.costPerFieldActive ? moneyShort(k.costPerFieldActive) : '—', 'تومان، برای هر کنشگر فعال میدانی'],
          ['سازمان‌های مشترک', fa(k.orgs), `${fa(k.seatsSold)} نفر در اشتراک`],
          ['قیمت هر نفر', moneyShort(k.perSeat), 'تومان در سال، پیش از تخفیف'],
        ].map(([l, v, s]) => <div key={l} className="rounded-2xl bg-sunken p-3"><span className="text-xs text-muted">{l}</span><b className="tnum block text-2xl text-ink">{v}</b><span className="text-xs text-muted">{s}</span></div>)}
      </div>
      <div>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>هزینهٔ سال: <b className="text-ink">{moneyShort(k.costYear)}</b> تومان</span><span className="text-muted">درآمد پرداخت‌شدهٔ {fa(k.year)}: <b className="text-ink">{moneyShort(k.incomeTotal)}</b></span></div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label="سهم پرداخت‌کنندگان از هزینهٔ سال">
          <span style={{ width: `${pct(k.income.subscriptions)}%` }} className="bg-leaf" /><span style={{ width: `${pct(k.income.sponsors)}%` }} className="bg-dome" /><span style={{ width: `${pct(k.income.services)}%` }} className="bg-flame" />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          <span><i className="me-1 inline-block size-2.5 rounded-sm bg-leaf" />اشتراک {moneyShort(k.income.subscriptions)}</span>
          <span><i className="me-1 inline-block size-2.5 rounded-sm bg-dome" />حامیان {moneyShort(k.income.sponsors)}</span>
          <span><i className="me-1 inline-block size-2.5 rounded-sm bg-flame" />خدمات {moneyShort(k.income.services)}</span>
          <span><i className="me-1 inline-block size-2.5 rounded-sm bg-line" />ستاد {moneyShort(k.hqShare)}</span>
        </div>
      </div>
    </section>
  );
}

/* ───────── پنل ستاد: مدل کسب‌وکار ───────── */
const TABS = [
  { k: 'subscriptions', t: 'اشتراک‌ها', i: Building2 },
  { k: 'invoices', t: 'فاکتورها', i: Receipt },
  { k: 'sponsors', t: 'حامیان', i: HandHeart },
  { k: 'services', t: 'خدمات سفارشی', i: Sparkles },
  { k: 'pricing', t: 'هزینه و قیمت', i: Settings2 },
];
export function AdminBusiness() {
  const { tab = 'subscriptions' } = useParams();
  return (
    <div className="rise">
      <PageHead title="مدل کسب‌وکار" desc="کنشگر هرگز پول نمی‌دهد. سازمان‌ها اشتراک سالانه به ازای هر نفر دارند؛ حامیان هزینهٔ دوره‌ها را می‌دهند و خدمات سفارشی جدا قیمت می‌خورد. قرارداد و پرداخت فعلاً بیرون از سامانه است و این‌جا ثبت می‌شود." />
      <nav className="seg mb-5" aria-label="بخش‌های مدل کسب‌وکار">
        {TABS.map((x) => <Link key={x.k} to={`/admin/business/${x.k}`} aria-current={tab === x.k ? 'page' : undefined}
          className={`flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold no-underline ${tab === x.k ? 'bg-card text-ink shadow-sm' : 'text-body'}`}><x.i className="size-4" />{x.t}</Link>)}
      </nav>
      {tab === 'subscriptions' && <Subscriptions />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'sponsors' && <Sponsors />}
      {tab === 'services' && <Services />}
      {tab === 'pricing' && <Pricing />}
    </div>
  );
}

/* اشتراک‌ها */
interface Sub {
  id: string; networkId: string; org: string; plan: Plan; seats: number; used: number; startsAt: string; endsAt: string; status: string; contractNo: string | null;
  pricePerSeat: number; discountPct: number; fixedFee: number; amount: number; note: string | null; courses: { id: string; title: string }[]; invoiced: number; paid: number;
}
interface Net { id: string; name: string; kind: string }
interface ACourse { id: string; title: string; isRestricted: boolean; status: string; sponsorId: string | null }

function Subscriptions() {
  const q = useQuery({ queryKey: ['admin-subs'], queryFn: () => api<Sub[]>('/admin/subscriptions') });
  const [edit, setEdit] = useState<Sub | 'new' | null>(null);
  const [inv, setInv] = useState<Sub | null>(null);
  const qc = useQueryClient(); const toast = useToast();
  const cancel = useMutation({ mutationFn: (id: string) => api(`/admin/subscriptions/${id}/cancel`, { method: 'POST' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-subs'] }); toast('لغو شد؛ به مدیر سازمان خبر داده شد'); }, onError: (e) => toast((e as Error).message, 'err') });
  const [confirm, setConfirm] = useState<Sub | null>(null);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="hint max-w-2xl">وقتی اشتراک تمام یا لغو شود، دوره‌های ویژه و پنل سازمان بسته می‌شود؛ پرونده و گواهی اعضا پاک نمی‌شود. ۳۰ و ۷ روز پیش از پایان به مدیر سازمان و مدیران ستاد یادآوری می‌رود.</p>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus className="size-4" />اشتراک تازه</button></div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data?.length ? (
        <ul className="grid gap-3">{q.data.map((s) => (
          <li key={s.id} className="card grid gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-lg text-ink">{s.org}</b><span className="chip">{PLAN_LABEL[s.plan]}</span><span className={`chip ${SUB_ST[s.status][0]}`}>{SUB_ST[s.status][1]}</span>
              {s.contractNo && <span className="text-sm text-muted">قرارداد {fa(s.contractNo)}</span>}
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <span><span className="text-muted">بازه: </span>{jDate(s.startsAt)} تا {jDate(s.endsAt)}</span>
              <span><span className="text-muted">نفرات: </span><b className={s.used > s.seats ? 'text-rose' : 'text-ink'}>{fa(s.used)}</b> از {fa(s.seats)}</span>
              <span><span className="text-muted">مبلغ: </span><b className="text-ink">{money(s.amount)}</b> تومان{s.discountPct ? ` (٪${fa(s.discountPct)} تخفیف)` : ''}</span>
              <span><span className="text-muted">پرداخت: </span><b className={s.paid >= s.amount ? 'text-leaf-ink' : 'text-flame-ink'}>{money(s.paid)}</b>{s.invoiced > s.paid ? <span className="text-muted"> · فاکتور باز {money(s.invoiced - s.paid)}</span> : ''}</span>
            </div>
            {s.courses.length > 0 && <div className="flex flex-wrap gap-1.5">{s.courses.map((c) => <span key={c.id} className="chip chip-dome">{c.title}</span>)}</div>}
            {s.status !== 'CANCELLED' && <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setEdit(s)}>ویرایش و تمدید</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setInv(s)}><FileText className="size-4" />فاکتور</button>
              <button className="btn btn-ghost btn-sm text-rose" onClick={() => setConfirm(s)}>لغو اشتراک</button>
            </div>}
          </li>))}</ul>
      ) : <Empty icon={Building2} title="هنوز اشتراکی ثبت نشده">اول سازمان را در «کاربران و نقش‌ها» بسازید و مدیرش را تعیین کنید؛ بعد قرارداد را این‌جا ثبت کنید.</Empty>}
      {edit && <SubEditor sub={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {inv && <InvoiceDialog init={{ subscriptionId: inv.id, title: `اشتراک ${PLAN_LABEL[inv.plan]} «${inv.org}»`, amount: Math.max(0, inv.amount - inv.invoiced) }} onClose={() => setInv(null)} />}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="لغو اشتراک">
        <p>اشتراک «{confirm?.org}» لغو شود؟ دوره‌های ویژه و پنل سازمان همین حالا بسته می‌شود؛ پرونده و گواهی اعضا سر جایش می‌ماند. این کار برگشت ندارد و برای ادامه باید اشتراک تازه ساخت.</p>
        <div className="mt-4 flex gap-2"><button className="btn btn-danger" onClick={() => { cancel.mutate(confirm!.id); setConfirm(null); }}>لغو اشتراک</button><button className="btn btn-ghost" onClick={() => setConfirm(null)}>انصراف</button></div>
      </Dialog>
    </div>
  );
}

function SubEditor({ sub, onClose }: { sub: Sub | null; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const nets = useQuery({ queryKey: ['admin-networks'], queryFn: () => api<Net[]>('/admin/networks') });
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<ACourse[]>('/admin/courses') });
  const year = 365 * 864e5;
  const [f, setF] = useState(() => sub
    ? { networkId: sub.networkId, plan: sub.plan, seats: String(sub.seats), startsAt: sub.startsAt, endsAt: sub.endsAt, contractNo: sub.contractNo ?? '', price: String(sub.pricePerSeat), discount: String(sub.discountPct), fee: String(sub.fixedFee), note: sub.note ?? '', courseIds: sub.courses.map((c) => c.id) }
    : { networkId: '', plan: 'ORG_BASIC' as Plan, seats: '100', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + year).toISOString(), contractNo: '', price: '', discount: '', fee: '', note: '', courseIds: [] as string[] });
  const seats = num(f.seats);
  const quote = useQuery({
    queryKey: ['quote', f.plan, seats, f.price, f.discount, f.fee],
    queryFn: () => api<{ pricePerSeat: number; discountPct: number; fixedFee: number; amount: number }>(`/admin/business/quote?plan=${f.plan}&seats=${seats}${f.price ? `&price=${num(f.price)}` : ''}${f.discount ? `&discount=${num(f.discount)}` : ''}${f.fee ? `&fee=${num(f.fee)}` : ''}`),
    enabled: seats > 0,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { networkId: f.networkId, plan: f.plan, seats, startsAt: f.startsAt, endsAt: f.endsAt, contractNo: f.contractNo || undefined, note: f.note || undefined, courseIds: f.courseIds,
        ...(f.price ? { pricePerSeat: num(f.price) } : {}), ...(f.discount ? { discountPct: num(f.discount) } : {}), ...(f.fee ? { fixedFee: num(f.fee) } : {}) };
      return sub ? api<{ warn: string | null }>(`/admin/subscriptions/${sub.id}`, { method: 'PATCH', body }) : api<{ warn: string | null }>('/admin/subscriptions', { body });
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['admin-subs'] }); qc.invalidateQueries({ queryKey: ['biz-kpi'] }); toast(r.warn ? 'ذخیره شد — ' + r.warn : 'ذخیره شد؛ به مدیر سازمان خبر داده شد', r.warn ? 'err' : 'ok'); onClose(); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const orgs = nets.data?.filter((n) => n.kind === 'ORGANIZATION') ?? [];
  const pub = courses.data?.filter((c) => c.status === 'PUBLISHED') ?? [];
  const toggle = (id: string) => setF((x) => ({ ...x, courseIds: x.courseIds.includes(id) ? x.courseIds.filter((y) => y !== id) : [...x.courseIds, id] }));
  return (
    <Dialog open onClose={onClose} title={sub ? `اشتراک «${sub.org}»` : 'اشتراک تازه'} wide>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label htmlFor="so">سازمان</label>
            <select id="so" className="input" required disabled={!!sub} value={f.networkId} onChange={(e) => setF({ ...f, networkId: e.target.value })}>
              <option value="">انتخاب کنید</option>{orgs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
            {!orgs.length && !nets.isLoading && <span className="hint">سازمانی نیست؛ اول در «کاربران و نقش‌ها» سازمان بسازید.</span>}</div>
          <div className="field"><label>بسته</label><div className="seg w-fit">{(['ORG_BASIC', 'ORG_PREMIUM'] as Plan[]).map((p) => <button type="button" key={p} aria-pressed={f.plan === p} onClick={() => setF({ ...f, plan: p })}>{PLAN_LABEL[p]}</button>)}</div></div>
          <div className="field"><label htmlFor="ss">سقف نفرات</label><input id="ss" className="input ltr tnum" inputMode="numeric" required value={fa(f.seats)} onChange={(e) => setF({ ...f, seats: toEn(e.target.value) })} /></div>
          <div className="field"><label htmlFor="sc">شمارهٔ قرارداد <span className="font-normal text-muted">(اختیاری)</span></label><input id="sc" className="input" value={f.contractNo} onChange={(e) => setF({ ...f, contractNo: e.target.value })} /></div>
          <div className="field"><label htmlFor="s1">شروع</label><JalaliInput id="s1" withTime={false} label="شروع" value={f.startsAt} onChange={(v) => setF({ ...f, startsAt: v })} /></div>
          <div className="field"><label htmlFor="s2">پایان</label><JalaliInput id="s2" withTime={false} label="پایان" value={f.endsAt} onChange={(v) => setF({ ...f, endsAt: v })} /></div>
        </div>
        <fieldset className="grid gap-3 rounded-2xl bg-sunken p-4">
          <legend className="sr-only">قیمت</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="field"><label htmlFor="sp">قیمت هر نفر (تومان)</label><input id="sp" className="input ltr tnum" inputMode="numeric" placeholder={quote.data ? money(quote.data.pricePerSeat) : 'پیشنهاد سامانه'} value={f.price ? money(num(f.price)) : ''} onChange={(e) => setF({ ...f, price: toEn(e.target.value) })} /></div>
            <div className="field"><label htmlFor="sd">تخفیف ٪</label><input id="sd" className="input ltr tnum" inputMode="numeric" placeholder={quote.data ? fa(quote.data.discountPct) : 'حجمی'} value={fa(f.discount)} onChange={(e) => setF({ ...f, discount: toEn(e.target.value) })} /></div>
            {f.plan === 'ORG_PREMIUM' && <div className="field"><label htmlFor="sf">هزینهٔ ثابت پشتیبانی تعهدی</label><input id="sf" className="input ltr tnum" inputMode="numeric" placeholder={quote.data ? money(quote.data.fixedFee) : ''} value={f.fee ? money(num(f.fee)) : ''} onChange={(e) => setF({ ...f, fee: toEn(e.target.value) })} /></div>}
          </div>
          <p className="text-sm">مبلغ قرارداد: <b className="tnum text-lg text-ink">{quote.data ? money(quote.data.amount) : '…'}</b> تومان
            <span className="hint block">خالی = قیمت پیشنهادی (هزینهٔ هر کاربر × ۱٫۵) و تخفیف حجمی (بیش از ۵۰۰ نفر ٪۱۵، بیش از ۲۰۰۰ نفر ٪۳۰).</span></p>
        </fieldset>
        <div className="field"><label>دوره‌های ویژهٔ سازمان</label>
          {courses.isLoading ? <Spinner /> : <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">{pub.map((c) => (
            <button type="button" key={c.id} aria-pressed={f.courseIds.includes(c.id)} onClick={() => toggle(c.id)} className={`chip cursor-pointer border ${f.courseIds.includes(c.id) ? 'chip-leaf border-leaf' : 'border-line'}`}>
              {f.courseIds.includes(c.id) && <Check className="size-3.5" />}{c.title}{!c.isRestricted && <span className="text-xs text-muted">(عمومی)</span>}</button>))}</div>}
          <span className="hint">دوره‌های «عمومی» برای همه باز است؛ دورهٔ ویژه را در دوره‌ساز «محدود» کنید.</span></div>
        <div className="field"><label htmlFor="sn">یادداشت <span className="font-normal text-muted">(اختیاری)</span></label><input id="sn" className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="flex gap-2"><button className="btn btn-primary" disabled={save.isPending || !f.networkId}>{sub ? 'ذخیره' : 'ثبت اشتراک'}</button><button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button></div>
      </form>
    </Dialog>
  );
}

/* فاکتورها */
interface Inv { id: string; number: string; title: string; amount: number; status: 'ISSUED' | 'PAID' | 'VOID'; paidAt: string | null; paymentRef: string | null; createdAt: string; org: string | null; sponsor: string | null }
const INV_ST: Record<string, [string, string]> = { ISSUED: ['chip-flame', 'منتظر پرداخت'], PAID: ['chip-leaf', 'پرداخت شد'], VOID: ['', 'باطل'] };
function Invoices() {
  const q = useQuery({ queryKey: ['admin-invoices'], queryFn: () => api<Inv[]>('/admin/invoices') });
  const [pay, setPay] = useState<Inv | null>(null);
  const [newInv, setNewInv] = useState(false);
  const qc = useQueryClient(); const toast = useToast();
  const voidM = useMutation({ mutationFn: (id: string) => api(`/admin/invoices/${id}/void`, { method: 'POST' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-invoices'] }); toast('باطل شد'); }, onError: (e) => toast((e as Error).message, 'err') });
  const open = q.data?.filter((i) => i.status === 'ISSUED').reduce((a, i) => a + i.amount, 0) ?? 0;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="hint max-w-2xl">پرداخت فعلاً با واریز بیرون از سامانه است و این‌جا با شمارهٔ پیگیری ثبت می‌شود. درگاه پرداخت بعد از نسخهٔ ۱ همین فاکتورها را می‌پردازد.{open > 0 && <> مانده: <b className="text-ink">{money(open)}</b> تومان.</>}</p>
        <button className="btn btn-secondary" onClick={() => setNewInv(true)}><Plus className="size-4" />فاکتور دیگر</button></div>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead className="bg-sunken text-xs text-muted"><tr>{['شماره', 'شرح', 'پرداخت‌کننده', 'مبلغ (تومان)', 'وضعیت', ''].map((h) => <th key={h} className="px-4 py-2.5 text-start font-bold">{h}</th>)}</tr></thead>
          <tbody>{q.data.map((i) => (
            <tr key={i.id} className="border-t border-line">
              <td className="tnum px-4 py-2.5 font-semibold text-ink" dir="ltr">{i.number}</td><td className="px-4 py-2.5">{i.title}</td><td className="px-4 py-2.5 text-muted">{i.org ?? i.sponsor ?? '—'}</td>
              <td className="tnum px-4 py-2.5 text-ink">{money(i.amount)}</td>
              <td className="px-4 py-2.5"><span className={`chip ${INV_ST[i.status][0]}`}>{INV_ST[i.status][1]}</span>{i.paymentRef && <span className="hint block">پیگیری {fa(i.paymentRef)} · {jDate(i.paidAt!)}</span>}</td>
              <td className="px-4 py-2.5 text-end">{i.status === 'ISSUED' && <><button className="btn btn-secondary btn-sm" onClick={() => setPay(i)}>ثبت پرداخت</button><button className="btn btn-ghost btn-sm" onClick={() => voidM.mutate(i.id)}>باطل</button></>}</td>
            </tr>))}</tbody>
        </table></div>
      ) : <Empty icon={Receipt} title="فاکتوری نیست">از کنار هر اشتراک، حامی یا خدمت سفارشی فاکتور بسازید.</Empty>}
      {pay && <PayDialog inv={pay} onClose={() => setPay(null)} />}
      {newInv && <InvoiceDialog init={{ title: '', amount: 0 }} free onClose={() => setNewInv(false)} />}
    </div>
  );
}
function PayDialog({ inv, onClose }: { inv: Inv; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const [ref, setRef] = useState(''); const [at, setAt] = useState(new Date().toISOString());
  const m = useMutation({ mutationFn: () => api(`/admin/invoices/${inv.id}/pay`, { body: { paymentRef: toEn(ref), paidAt: at } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-invoices'] }); qc.invalidateQueries({ queryKey: ['admin-subs'] }); qc.invalidateQueries({ queryKey: ['biz-kpi'] }); toast('پرداخت ثبت شد'); onClose(); }, onError: (e) => toast((e as Error).message, 'err') });
  return (
    <Dialog open onClose={onClose} title={`ثبت پرداخت ${fa(inv.number)}`}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <p className="text-sm">مبلغ: <b className="text-ink">{money(inv.amount)}</b> تومان</p>
        <div className="field"><label htmlFor="pr">شمارهٔ پیگیری بانکی</label><input id="pr" className="input ltr tnum" required minLength={2} value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        <div className="field"><label htmlFor="pa">تاریخ پرداخت</label><JalaliInput id="pa" withTime={false} label="تاریخ پرداخت" value={at} onChange={setAt} /></div>
        <button className="btn btn-primary" disabled={m.isPending}>ثبت</button>
      </form>
    </Dialog>
  );
}
function InvoiceDialog({ init, onClose, free }: { init: { subscriptionId?: string; serviceOrderId?: string; sponsorId?: string; networkId?: string; title: string; amount: number }; onClose: () => void; free?: boolean }) {
  const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState({ ...init, amount: String(init.amount || '') });
  const nets = useQuery({ queryKey: ['admin-networks'], queryFn: () => api<Net[]>('/admin/networks'), enabled: !!free });
  const sps = useQuery({ queryKey: ['admin-sponsors'], queryFn: () => api<Sponsor[]>('/admin/sponsors'), enabled: !!free });
  const m = useMutation({ mutationFn: () => api<Inv>('/admin/invoices', { body: { ...f, amount: num(f.amount) } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['admin-invoices'] }); qc.invalidateQueries({ queryKey: ['admin-subs'] }); toast(`فاکتور ${fa(r.number)} صادر شد`); onClose(); }, onError: (e) => toast((e as Error).message, 'err') });
  return (
    <Dialog open onClose={onClose} title="صدور فاکتور">
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        {free && <div className="grid gap-3 sm:grid-cols-2">
          <div className="field"><label htmlFor="in">سازمان</label><select id="in" className="input" value={f.networkId ?? ''} onChange={(e) => setF({ ...f, networkId: e.target.value || undefined })}><option value="">—</option>{nets.data?.filter((n) => n.kind === 'ORGANIZATION').map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
          <div className="field"><label htmlFor="is">یا حامی</label><select id="is" className="input" value={f.sponsorId ?? ''} onChange={(e) => setF({ ...f, sponsorId: e.target.value || undefined })}><option value="">—</option>{sps.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>}
        <div className="field"><label htmlFor="it">شرح</label><input id="it" className="input" required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="ia">مبلغ (تومان)</label><input id="ia" className="input ltr tnum" inputMode="numeric" required value={f.amount ? money(num(f.amount)) : ''} onChange={(e) => setF({ ...f, amount: toEn(e.target.value) })} /></div>
        <button className="btn btn-primary" disabled={m.isPending || !num(f.amount)}>صدور</button>
      </form>
    </Dialog>
  );
}

/* حامیان */
interface Sponsor { id: string; name: string; kind: 'ORG' | 'PERSON'; termsAccepted: boolean; note: string | null; courses: { id: string; title: string }[]; paid: number }
const TERMS = ['محتوای دوره فقط با تأیید ستاد مدرسه است', 'نام حامی فقط در یک خط «با حمایت …» در صفحهٔ دوره می‌آید؛ بی لوگو و بی تبلیغ در درس‌ها', 'دوره پس از ساخت مال مدرسه است'];
function Sponsors() {
  const q = useQuery({ queryKey: ['admin-sponsors'], queryFn: () => api<Sponsor[]>('/admin/sponsors') });
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<ACourse[]>('/admin/courses') });
  const [edit, setEdit] = useState<Sponsor | 'new' | null>(null);
  const [inv, setInv] = useState<Sponsor | null>(null);
  const qc = useQueryClient(); const toast = useToast();
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/sponsors/${id}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sponsors'] }); toast('حذف شد'); }, onError: (e) => toast((e as Error).message, 'err') });
  const setCourse = useMutation({ mutationFn: (v: { courseId: string; sponsorId: string | null }) => api(`/admin/courses/${v.courseId}/sponsor`, { body: { sponsorId: v.sponsorId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sponsors'] }); qc.invalidateQueries({ queryKey: ['admin-courses'] }); toast('ذخیره شد'); }, onError: (e) => toast((e as Error).message, 'err') });
  const [pick, setPick] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="hint max-w-2xl">حامی هزینهٔ ساخت یک دوره را می‌دهد. سه شرط: {TERMS.join('؛ ')}.</div>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus className="size-4" />حامی تازه</button></div>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">{q.data.map((s) => (
          <li key={s.id} className="card grid content-start gap-3 p-5">
            <div className="flex items-center gap-2"><HandHeart className="size-5 text-leaf" /><b className="text-ink">{s.name}</b><span className="chip">{s.kind === 'ORG' ? 'نهاد' : 'شخص'}</span></div>
            <p className="text-sm text-muted">پرداخت‌شده: <b className="text-ink">{money(s.paid)}</b> تومان{s.note ? ` · ${s.note}` : ''}</p>
            <div className="flex flex-wrap gap-1.5">{s.courses.map((c) => <span key={c.id} className="chip chip-dome">{c.title}<button className="text-muted" aria-label={`برداشتن حامی از ${c.title}`} onClick={() => setCourse.mutate({ courseId: c.id, sponsorId: null })}>×</button></span>)}</div>
            <div className="flex gap-2"><select className="input h-9 text-sm" aria-label="افزودن دوره" value={pick[s.id] ?? ''} onChange={(e) => setPick({ ...pick, [s.id]: e.target.value })}><option value="">دورهٔ حمایت‌شده…</option>{courses.data?.filter((c) => !c.sponsorId).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
              <button className="btn btn-secondary btn-sm" disabled={!pick[s.id]} onClick={() => { setCourse.mutate({ courseId: pick[s.id], sponsorId: s.id }); setPick({ ...pick, [s.id]: '' }); }}>افزودن</button></div>
            <div className="flex flex-wrap gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setEdit(s)}>ویرایش</button><button className="btn btn-ghost btn-sm" onClick={() => setInv(s)}><FileText className="size-4" />فاکتور</button>
              {!s.courses.length && <button className="btn btn-ghost btn-sm text-rose" onClick={() => del.mutate(s.id)}><Trash2 className="size-4" />حذف</button>}</div>
          </li>))}</ul>
      ) : <Empty icon={HandHeart} title="هنوز حامی‌ای نیست" />}
      {edit && <SponsorEditor s={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {inv && <InvoiceDialog init={{ sponsorId: inv.id, title: `حمایت از ساخت دوره — ${inv.name}`, amount: 0 }} onClose={() => setInv(null)} />}
    </div>
  );
}
function SponsorEditor({ s, onClose }: { s: Sponsor | null; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState({ name: s?.name ?? '', kind: s?.kind ?? 'ORG', termsAccepted: s?.termsAccepted ?? false, note: s?.note ?? '' });
  const m = useMutation({ mutationFn: () => (s ? api(`/admin/sponsors/${s.id}`, { method: 'PATCH', body: f }) : api('/admin/sponsors', { body: f })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sponsors'] }); toast('ذخیره شد'); onClose(); }, onError: (e) => toast((e as Error).message, 'err') });
  return (
    <Dialog open onClose={onClose} title={s ? 'ویرایش حامی' : 'حامی تازه'}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="field"><label htmlFor="sn">نام (همانی که در «با حمایت …» می‌آید)</label><input id="sn" className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="seg w-fit">{[['ORG', 'نهاد'], ['PERSON', 'شخص']].map(([k, t]) => <button type="button" key={k} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k as 'ORG' })}>{t}</button>)}</div>
        <div className="rounded-2xl bg-sunken p-4 text-sm"><b className="text-ink">شرط‌های حمایت</b><ol className="mt-2 list-decimal space-y-1 ps-5">{TERMS.map((t) => <li key={t}>{t}</li>)}</ol>
          <label className="mt-3 flex items-center gap-3 font-semibold text-ink"><input type="checkbox" className="size-5 accent-[var(--leaf)]" checked={f.termsAccepted} onChange={(e) => setF({ ...f, termsAccepted: e.target.checked })} />حامی هر سه را پذیرفته است</label></div>
        <div className="field"><label htmlFor="sno">یادداشت <span className="font-normal text-muted">(اختیاری؛ شماره و نشانی شخصی ننویسید)</span></label><input id="sno" className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <button className="btn btn-primary" disabled={m.isPending || !f.termsAccepted}>ذخیره</button>
      </form>
    </Dialog>
  );
}

/* خدمات سفارشی */
interface Svc { id: string; kind: string; title: string; costs: { item: string; amount: number }[]; cost: number; price: number; status: string; networkId: string | null; sponsorId: string | null; courseId: string | null; note: string | null; org: string | null; sponsor: string | null; course: string | null; createdAt: string }
const SVC_KIND: Record<string, string> = { COURSE: 'دورهٔ اختصاصی', WORKSHOP: 'کارگاه حضوری', RAHYAR_NETWORK: 'راه‌اندازی شبکهٔ راهیاری', ONBOARDING: 'جلسهٔ راه‌اندازی', OTHER: 'دیگر' };
const SVC_ST: Record<string, [string, string]> = { PROPOSED: ['chip-dome', 'پیشنهاد'], ACTIVE: ['chip-flame', 'در حال انجام'], DONE: ['chip-leaf', 'انجام شد'], CANCELLED: ['', 'لغو'] };
const BUDGET_ROWS = ['نویسنده', 'بازبین دینی', 'ضبط صوت و ویدیو', 'طراحی'];
function Services() {
  const q = useQuery({ queryKey: ['admin-services'], queryFn: () => api<Svc[]>('/admin/services') });
  const [edit, setEdit] = useState<Svc | 'new' | null>(null);
  const [inv, setInv] = useState<Svc | null>(null);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="hint max-w-2xl">کارهایی که بیرون از اشتراک عادی برای یک سازمان یا حامی انجام می‌شود. قیمت = هزینهٔ واقعی (برگهٔ بودجهٔ یکسان) + ٪۵۰.</p>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus className="size-4" />خدمت تازه</button></div>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <ul className="grid gap-3">{q.data.map((s) => (
          <li key={s.id} className="card flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1"><b className="text-ink">{s.title}</b><span className="block text-sm text-muted">{SVC_KIND[s.kind]} · {s.org ?? s.sponsor}{s.course ? ` · دورهٔ «${s.course}»` : ''}</span></div>
            <div className="text-sm"><span className="text-muted">هزینه </span>{money(s.cost)}<span className="text-muted"> · قیمت </span><b className="text-ink">{money(s.price)}</b></div>
            <span className={`chip ${SVC_ST[s.status][0]}`}>{SVC_ST[s.status][1]}</span>
            <div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => setEdit(s)}>ویرایش</button><button className="btn btn-ghost btn-sm" onClick={() => setInv(s)}><FileText className="size-4" />فاکتور</button></div>
          </li>))}</ul>
      ) : <Empty icon={Sparkles} title="خدمت سفارشی‌ای ثبت نشده" />}
      {edit && <ServiceEditor s={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {inv && <InvoiceDialog init={{ serviceOrderId: inv.id, title: `${SVC_KIND[inv.kind]}: ${inv.title}`, amount: inv.price }} onClose={() => setInv(null)} />}
    </div>
  );
}
function ServiceEditor({ s, onClose }: { s: Svc | null; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const nets = useQuery({ queryKey: ['admin-networks'], queryFn: () => api<Net[]>('/admin/networks') });
  const sps = useQuery({ queryKey: ['admin-sponsors'], queryFn: () => api<Sponsor[]>('/admin/sponsors') });
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<ACourse[]>('/admin/courses') });
  const pricing = useQuery({ queryKey: ['biz-pricing'], queryFn: () => api<Pricing>('/admin/business/pricing') });
  const [f, setF] = useState({
    kind: s?.kind ?? 'COURSE', title: s?.title ?? '', networkId: s?.networkId ?? '', sponsorId: s?.sponsorId ?? '', courseId: s?.courseId ?? '', status: s?.status ?? 'PROPOSED', note: s?.note ?? '',
    costs: s?.costs.map((c) => ({ item: c.item, amount: String(c.amount) })) ?? BUDGET_ROWS.map((item) => ({ item, amount: '' })), price: s ? String(s.price) : '',
  });
  const cost = f.costs.reduce((a, c) => a + num(c.amount), 0);
  const markup = pricing.data?.costs.serviceMarkup ?? 1.5;
  const suggested = Math.round((cost * markup) / 1000) * 1000;
  const m = useMutation({
    mutationFn: () => { const body = { kind: f.kind, title: f.title, networkId: f.networkId || null, sponsorId: f.sponsorId || null, courseId: f.courseId || null, status: f.status, note: f.note || undefined,
      costs: f.costs.filter((c) => c.item.trim() && num(c.amount)).map((c) => ({ item: c.item.trim(), amount: num(c.amount) })), ...(f.price ? { price: num(f.price) } : {}) };
      return s ? api(`/admin/services/${s.id}`, { method: 'PATCH', body }) : api('/admin/services', { body }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-services'] }); toast('ذخیره شد'); onClose(); }, onError: (e) => toast((e as Error).message, 'err'),
  });
  return (
    <Dialog open onClose={onClose} title={s ? 'ویرایش خدمت سفارشی' : 'خدمت سفارشی تازه'} wide>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label htmlFor="vk">نوع</label><select id="vk" className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(SVC_KIND).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
          <div className="field"><label htmlFor="vt">عنوان</label><input id="vt" className="input" required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="field"><label htmlFor="vn">سفارش‌دهنده: سازمان</label><select id="vn" className="input" value={f.networkId} onChange={(e) => setF({ ...f, networkId: e.target.value })}><option value="">—</option>{nets.data?.filter((n) => n.kind === 'ORGANIZATION').map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
          <div className="field"><label htmlFor="vs">یا حامی</label><select id="vs" className="input" value={f.sponsorId} onChange={(e) => setF({ ...f, sponsorId: e.target.value })}><option value="">—</option>{sps.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          {f.kind === 'COURSE' && <div className="field"><label htmlFor="vc">دورهٔ ساخته‌شده</label><select id="vc" className="input" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">هنوز ساخته نشده</option>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><span className="hint">اگر حامی سفارش داده باشد، نامش روی دوره می‌آید.</span></div>}
          <div className="field"><label htmlFor="vst">وضعیت</label><select id="vst" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(SVC_ST).map(([k, [, t]]) => <option key={k} value={k}>{t}</option>)}</select></div>
        </div>
        <fieldset className="grid gap-2 rounded-2xl bg-sunken p-4">
          <legend className="mb-1 text-sm font-bold text-ink">برگهٔ بودجه</legend>
          {f.costs.map((c, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_160px_auto] gap-2">
              <input className="input h-10" aria-label="ردیف هزینه" value={c.item} onChange={(e) => setF({ ...f, costs: f.costs.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)) })} />
              <input className="input ltr tnum h-10" inputMode="numeric" aria-label={`مبلغ ${c.item}`} placeholder="تومان" value={c.amount ? money(num(c.amount)) : ''} onChange={(e) => setF({ ...f, costs: f.costs.map((x, j) => (j === i ? { ...x, amount: toEn(e.target.value) } : x)) })} />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="حذف ردیف" onClick={() => setF({ ...f, costs: f.costs.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></button>
            </div>))}
          <button type="button" className="btn btn-ghost btn-sm w-fit" onClick={() => setF({ ...f, costs: [...f.costs, { item: '', amount: '' }] })}><Plus className="size-4" />ردیف</button>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <span>هزینهٔ واقعی: <b className="text-ink">{money(cost)}</b> تومان</span>
            <div className="field"><label htmlFor="vp">قیمت (تومان)</label><input id="vp" className="input ltr tnum" inputMode="numeric" placeholder={money(suggested)} value={f.price ? money(num(f.price)) : ''} onChange={(e) => setF({ ...f, price: toEn(e.target.value) })} /><span className="hint">خالی = هزینه + ٪{fa(Math.round((markup - 1) * 100))}</span></div>
          </div>
        </fieldset>
        <div className="field"><label htmlFor="vno">یادداشت</label><input id="vno" className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <button className="btn btn-primary w-fit" disabled={m.isPending || !cost || (!f.networkId && !f.sponsorId)}>ذخیره</button>
      </form>
    </Dialog>
  );
}

/* هزینه و قیمت */
interface Pricing { costs: Record<string, number> & { serviceMarkup: number }; model: { monthly: number; base: number; content: number; total: number; perUser: number; perSeat: number } }
const COST_FIELDS: [string, string, string, string][] = [
  ['expectedUsers', 'کاربران فعال در سال', 'نفر', 'پایه'],
  ['srvMain', 'سرور اصلی', 'تومان در ماه', 'زیرساخت'], ['srvLive', 'سرور کلاس زنده', 'تومان در ماه', 'زیرساخت'], ['storage', 'فضای پشتیبان و فایل', 'تومان در ماه', 'زیرساخت'],
  ['smsPrice', 'قیمت هر پیامک', 'تومان', 'زیرساخت'], ['smsPerUser', 'پیامک ورود هر کاربر در ماه', 'عدد', 'زیرساخت'],
  ['dev', 'برنامه‌نویس', 'تومان در ماه', 'تیم'], ['ops', 'پشتیبانی و عملیات', 'تومان در ماه', 'تیم'], ['content', 'مدیر محتوا', 'تومان در ماه', 'تیم'],
  ['coursesPerYear', 'دورهٔ تازه در سال', 'عدد', 'محتوا'], ['courseCost', 'هزینهٔ ساخت هر دوره', 'تومان', 'محتوا'],
  ['markup', 'ضریب قیمت اشتراک', '× هزینهٔ هر کاربر', 'قیمت'], ['serviceMarkup', 'ضریب خدمات سفارشی', '× هزینهٔ واقعی', 'قیمت'], ['premiumFixedFee', 'هزینهٔ ثابت پشتیبانی تعهدی', 'تومان در سال', 'قیمت'],
];
function Pricing() {
  const q = useQuery({ queryKey: ['biz-pricing'], queryFn: () => api<Pricing>('/admin/business/pricing') });
  const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { if (q.data) setF(Object.fromEntries(Object.entries(q.data.costs).map(([k, v]) => [k, String(v)]))); }, [q.data]);
  const m = useMutation({ mutationFn: () => api('/admin/business/costs', { method: 'PATCH', body: { costs: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(toEn(v).replace(/[^\d.]/g, ''))])) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['biz-pricing'] }); qc.invalidateQueries({ queryKey: ['biz-kpi'] }); toast('ذخیره شد؛ قیمت‌های تازه از اشتراک بعدی'); }, onError: (e) => toast((e as Error).message, 'err') });
  const groups = useMemo(() => [...new Set(COST_FIELDS.map((x) => x[3]))], []);
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const md = q.data!.model;
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <form className="card grid gap-4 p-5" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          {groups.map((g) => <fieldset key={g} className="grid gap-2"><legend className="mb-1 text-sm font-extrabold text-leaf-ink">{g}</legend>
            {COST_FIELDS.filter((x) => x[3] === g).map(([k, l, u]) => (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-3 border-b border-dashed border-line pb-2">
                <label htmlFor={`c-${k}`} className="text-sm">{l}<span className="hint block">{u}</span></label>
                <input id={`c-${k}`} className="input ltr tnum h-10" inputMode="decimal" value={f[k] && !k.toLowerCase().includes('markup') ? money(Number(toEn(f[k]).replace(/[^\d]/g, ''))) : fa(f[k] ?? '')} onChange={(e) => setF({ ...f, [k]: toEn(e.target.value).replace(/٬/g, '') })} />
              </div>))}
          </fieldset>)}
          <button className="btn btn-primary w-fit" disabled={m.isPending}>ذخیره</button>
          <p className="hint">عددهای پیش‌فرض را کارفرما در تصمیم دور چهارم داده است. با قیمت واقعی فروشندگان به‌روز کنید.</p>
        </form>
        <div className="grid content-start gap-3">
          <div className="card grid gap-2 p-5 text-sm">
            {[['هزینهٔ پایه در ماه', md.monthly], ['هزینهٔ پایه در سال', md.base], ['ساخت محتوا در سال', md.content]].map(([l, v]) => <div key={l as string} className="flex justify-between gap-3 border-b border-line pb-2"><span>{l}</span><b className="text-ink">{moneyShort(v as number)}</b></div>)}
            <div className="flex justify-between gap-3 border-b border-line pb-2 text-base"><span>کل هزینهٔ سال</span><b className="text-leaf-ink">{moneyShort(md.total)}</b></div>
            <div className="flex justify-between gap-3 border-b border-line pb-2"><span>هزینهٔ هر کاربر فعال در سال</span><b className="text-ink">{money(md.perUser)}</b></div>
            <div className="flex justify-between gap-3 text-base"><span>قیمت هر نفر برای سازمان‌ها</span><b className="text-leaf-ink">{money(md.perSeat)} تومان</b></div>
          </div>
          <div className="flex items-start gap-2 rounded-2xl bg-flame-soft p-4 text-sm text-flame-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" />تخفیف حجمی: بیش از ۵۰۰ نفر ٪۱۵، بیش از ۲۰۰۰ نفر ٪۳۰. دورهٔ آزمایشی رایگان ندارد.</div>
        </div>
      </div>
      <section className="grid gap-3"><h2 className="text-base font-extrabold">بسته‌ها و خدمات</h2><PlansTable /></section>
    </div>
  );
}

/* ───────── پنل سازمان: اشتراک و گزارش فصلی ───────── */
export interface OrgSub {
  active: boolean; used: number; endedAt: string | null;
  subscription: { id: string; plan: Plan; planLabel: string; seats: number; startsAt: string; endsAt: string; status: string; daysLeft: number } | null;
  features: { exportData: boolean; quarterlyReport: boolean; broadcast: boolean; events: boolean; campaignsPerYear: number | null; prioritySupport: boolean; certName: string } | null;
}
export function OrgSubscriptionCard({ s, orgId }: { s: OrgSub; orgId: string }) {
  const sub = s.subscription;
  if (!sub || !s.active) return (
    <div className="flex items-start gap-3 rounded-2xl bg-flame-soft p-4 text-flame-ink"><TriangleAlert className="mt-0.5 size-5 shrink-0" />
      <div><b>اشتراک فعال نیست{s.endedAt ? ` (تمام شد ${jDate(s.endedAt)})` : ''}.</b><p className="text-sm">{sub ? `اشتراک بعدی از ${jDate(sub.startsAt)} شروع می‌شود.` : 'برای تمدید با ستاد مدرسه هماهنگ کنید.'} پرونده و گواهی اعضا محفوظ است.</p></div></div>
  );
  const pct = Math.min(100, (s.used / sub.seats) * 100);
  return (
    <section className="card grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2"><BadgeDollarSign className="size-5 text-leaf" /><b className="text-ink">{sub.planLabel}</b>
          <span className={`chip ${sub.daysLeft <= 30 ? 'chip-flame' : 'chip-leaf'}`}>{sub.daysLeft <= 30 ? `${fa(sub.daysLeft)} روز مانده` : `تا ${jDate(sub.endsAt)}`}</span></div>
        <div className="flex items-center gap-3"><div className="bar flex-1" role="progressbar" aria-valuenow={s.used} aria-valuemax={sub.seats} aria-label="نفرات"><span style={{ width: `${pct}%` }} /></div><span className="tnum text-sm"><b className="text-ink">{fa(s.used)}</b> از {fa(sub.seats)} نفر</span></div>
        {sub.daysLeft <= 30 && <p className="hint">برای تمدید با ستاد مدرسه هماهنگ کنید؛ پس از پایان، دوره‌های ویژه و این پنل بسته می‌شود.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {s.features?.broadcast && <Link to="/broadcast" className="btn btn-secondary btn-sm">پیام به اعضا</Link>}
        {s.features?.events && <Link to="/manage/events/new" className="btn btn-secondary btn-sm">برنامه برای اعضا</Link>}
        {s.features?.exportData && <a href={`/api/org/${orgId}/export`} className="btn btn-secondary btn-sm" download><Download className="size-4" />خروجی اکسل</a>}
      </div>
    </section>
  );
}
interface Report { label: string; members: number; activeLearners: number; fieldActive: number; lessonsCompleted: number; coursesCompleted: number; missionsDone: number; certificates: number; campaignParticipants: number; eventsAttended: number; courses: { id: string; title: string; enrolled: number; completed: number }[] }
export function OrgReport({ orgId }: { orgId: string }) {
  const [pick, setPick] = useState('');
  const q = useQuery({ queryKey: ['org-report', orgId, pick], queryFn: () => api<{ quarters: { jy: number; q: number; label: string }[]; report: Report }>(`/org/${orgId}/report${pick ? `?${pick}` : ''}`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { quarters, report: r } = q.data!;
  const cells: [string, number, string?][] = [
    ['اعضا', r.members], ['یادگیرندهٔ فعال', r.activeLearners, 'دست‌کم یک درس تمام کرده'], ['کنشگر فعال میدانی', r.fieldActive, 'مأموریت یا کار پویش'],
    ['درس تمام‌شده', r.lessonsCompleted], ['دورهٔ تمام‌شده', r.coursesCompleted], ['مأموریت انجام‌شده', r.missionsDone],
    ['گواهی', r.certificates], ['شرکت در پویش', r.campaignParticipants, 'نفر'], ['حضور در برنامه‌ها', r.eventsAttended],
  ];
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold">گزارش فصلی</h2>
        <select className="input h-10" style={{ width: "auto" }} aria-label="فصل" value={pick} onChange={(e) => setPick(e.target.value)}>{quarters.map((x, i) => <option key={i} value={i === 0 ? '' : `jy=${x.jy}&q=${x.q}`}>{fa(x.label)}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{cells.map(([l, v, h]) => <div key={l} className="card p-4"><span className="text-sm text-muted">{l}</span><b className="tnum block text-2xl text-ink">{fa(v)}</b>{h && <span className="text-xs text-muted">{h}</span>}</div>)}</div>
      {r.courses.length > 0 && <div className="card overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead className="bg-sunken text-xs text-muted"><tr><th className="px-4 py-2.5 text-start">دورهٔ ویژه</th><th className="px-4 py-2.5">ثبت‌نام</th><th className="px-4 py-2.5">تمام</th></tr></thead>
        <tbody>{r.courses.map((c) => <tr key={c.id} className="border-t border-line"><td className="px-4 py-2.5 text-ink">{c.title}</td><td className="tnum px-4 py-2.5 text-center">{fa(c.enrolled)}</td><td className="tnum px-4 py-2.5 text-center">{fa(c.completed)}</td></tr>)}</tbody></table></div>}
      <p className="hint">فقط عدد؛ هیچ نام و متنی از گزارش‌های اعضا در این گزارش نیست.</p>
    </section>
  );
}
