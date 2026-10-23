import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CircleAlert, Compass, Search, ShieldX } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useRouteError } from 'react-router';
import { Brand } from '../components/Shell';
import { Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fa, jDate } from '../lib/fa';

/** پوستهٔ صفحه‌های عمومی (بدون ورود) */
export function PublicShell({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="wrap flex h-16 items-center justify-between"><Brand />
          <Link to={me ? '/' : '/login'} className="btn btn-secondary btn-sm">{me ? 'بازگشت به مدرسه' : 'ورود'}</Link></div>
      </header>
      <main className="wrap py-10">{children}</main>
    </div>
  );
}

interface Verify { valid: boolean; revoked?: boolean; holderName?: string; courseTitle?: string; issuedAt?: string; score?: number | null; code?: string }

export function VerifyPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState(code ?? '');
  const q = useQuery({ queryKey: ['verify', code], enabled: !!code, queryFn: () => api<Verify>(`/verify/${encodeURIComponent(code!)}`) });
  const submit = (e: FormEvent) => { e.preventDefault(); if (input.trim()) nav(`/verify/${input.trim().toUpperCase()}`); };
  return (
    <PublicShell>
      <div className="mx-auto grid max-w-2xl gap-8">
        <header className="text-center"><h1 className="text-[clamp(24px,3vw,32px)] font-extrabold">استعلام گواهی</h1>
          <p className="mt-1 text-muted">شناسهٔ روی گواهی را وارد کنید تا درستی‌اش را ببینید.</p></header>
        <form onSubmit={submit} className="flex gap-2">
          <input className="input ltr tnum flex-1 text-center tracking-widest" placeholder="HD-XXXX-XXXX" value={input} onChange={(e) => setInput(e.target.value)} aria-label="شناسهٔ استعلام" />
          <button className="btn btn-primary"><Search className="size-4" />استعلام</button>
        </form>
        {q.isLoading && <Spinner label="در حال استعلام" />}
        {q.data && (q.data.valid ? (
          <article className="rise card overflow-hidden text-center">
            <div className="h-2" style={{ background: 'linear-gradient(90deg, var(--sprout), var(--leaf), var(--dome), var(--deep))' }} />
            <div className="grid justify-items-center gap-3 p-8">
              <img src="/brand/logo-full.png" alt="" className="h-20 w-auto" />
              <span className="chip chip-leaf"><BadgeCheck className="size-4" />گواهی معتبر است</span>
              <p className="text-sm text-muted">گواهی پایان دوره</p>
              <h2 className="text-2xl font-extrabold">{q.data.courseTitle}</h2>
              <p className="max-w-md text-lg">این گواهی تأیید می‌کند که <b className="text-ink">{q.data.holderName}</b> این دوره را در تاریخ {jDate(q.data.issuedAt!)}{q.data.score != null ? ` با نمرهٔ ${fa(q.data.score)} از ۱۰۰` : ''} در مدرسهٔ هدایت به پایان رسانده است.</p>
              <p className="mt-2 text-xs text-muted">شناسهٔ استعلام: <b dir="ltr" className="tnum">{q.data.code}</b></p>
            </div>
          </article>
        ) : (
          <div className="rise card flex items-start gap-3 p-6">
            {q.data.revoked ? <ShieldX className="size-6 shrink-0 text-rose" /> : <CircleAlert className="size-6 shrink-0 text-rose" />}
            <div><b className="text-ink">{q.data.revoked ? 'این گواهی باطل شده است' : 'گواهی‌ای با این شناسه پیدا نشد'}</b>
              <p className="text-sm text-muted">{q.data.revoked ? 'صادرکننده این گواهی را باطل کرده است.' : 'شناسه را دوباره بررسی کنید؛ شکلش مثل HD-7K2Q-9MXA است.'}</p></div>
          </div>
        ))}
      </div>
    </PublicShell>
  );
}

const TERMS: [string, string[]][] = [
  ['دربارهٔ مدرسه و این شرایط', ['مدرسهٔ هدایت، مدرسهٔ مجازی کنشگران مسجد و هسته‌هاست. با ساختن حساب یا استفاده از مدرسه، این شرایط را می‌پذیرید.']],
  ['حساب کاربری', ['حساب شخصی است؛ آن را در اختیار دیگری نگذارید. ورود با کد پیامکی است.', 'اگر شماره‌تان عوض شد، از تنظیمات آن را به‌روز کنید.']],
  ['دوره، نمره و گواهی', ['گواهی پایان دوره را مدرسه صادر می‌کند و هر گواهی شناسهٔ استعلام دارد. تکرار آزمون آزاد است و بهترین نمره می‌ماند.', 'تقلب یا انجام آزمون به‌جای دیگری، گواهی را باطل می‌کند.']],
  ['محتوای شما', ['یادداشت‌ها، برگه‌ها و ابزارهایی که پر می‌کنید مال خودتان است. گزارش مأموریت را راهیارتان می‌خواند.', 'عکس افراد را فقط با اجازهٔ خودشان بفرستید.']],
  ['حریم خصوصی', ['چه داده‌ای نگه می‌داریم: نام، شماره، جنسیت، شهرستان و مسجد، پیشرفت در دوره‌ها و آنچه خودتان می‌نویسید.', 'چه کسی می‌بیند: راهیارتان، مسئول هسته‌تان و ستاد آموزش، هر کدام فقط آنچه برای همراهی لازم است.', 'کجا نگه‌داری می‌شود: روی سرورهای داخل کشور. داده‌های شما به هیچ سرویس بیرونی، از جمله سرویس‌های هوش مصنوعی، فرستاده نمی‌شود.', 'حق شما: هر وقت بخواهید نسخه‌ای از داده‌هایتان را بگیرید یا حذف حساب را درخواست کنید؛ پس از ۷ روز مهلت لغو، داده‌ها تا ۳۰ روز پاک می‌شوند.']],
  ['پیامک و اعلان', ['پیامک فقط برای ورود، یادآوری‌هایی که روشن کرده‌اید و پیام‌های ستاد آموزش فرستاده می‌شود.']],
];

export function TermsPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(24px,3vw,34px)] font-extrabold">شرایط استفاده و حریم خصوصی</h1>
        <p className="mt-2 rounded-xl bg-flame-soft p-3 text-sm text-flame-ink">پیش‌نویس است و پس از بازبینی کارفرما نهایی می‌شود.</p>
        <div className="mt-8 grid gap-8">
          {TERMS.map(([t, ps], i) => (
            <section key={t}><h2 className="flex items-center gap-3 text-xl font-extrabold"><span className="grid size-8 place-items-center rounded-lg bg-leaf-soft text-sm text-leaf-ink">{fa(i + 1)}</span>{t}</h2>
              <div className="prose-fa mt-2">{ps.map((p) => <p key={p}>{p}</p>)}</div></section>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto grid max-w-lg justify-items-center gap-3 py-16 text-center">
      <Compass className="size-16 rounded-3xl bg-leaf-soft p-4 text-leaf-ink" />
      <h1 className="text-2xl font-extrabold">این صفحه پیدا نشد</h1>
      <p className="text-muted">شاید پیوند قدیمی است یا این درس و دوره برداشته شده.</p>
      <div className="mt-2 flex gap-2"><Link to="/" className="btn btn-primary">خانه</Link><Link to="/learn" className="btn btn-secondary">همهٔ دوره‌ها</Link></div>
    </div>
  );
}

/** وقتی صفحه‌ای هنگام نمایش خطا داد */
export function RouteError() {
  const e = useRouteError() as Error | undefined;
  return (
    <div className="mx-auto grid max-w-lg justify-items-center gap-3 px-4 py-16 text-center">
      <CircleAlert className="size-16 rounded-3xl bg-flame-soft p-4 text-flame-ink" />
      <h1 className="text-2xl font-extrabold">چیزی درست کار نکرد</h1>
      <p className="text-muted">این صفحه باز نشد. پیشرفت و نوشته‌هایتان سالم است؛ یک بار دوباره امتحان کنید.</p>
      <div className="mt-2 flex gap-2"><button className="btn btn-primary" onClick={() => window.location.reload()}>دوباره امتحان کنید</button><a href="/" className="btn btn-secondary">خانه</a></div>
      {e?.message && <details className="mt-4 text-xs text-muted"><summary>جزئیات فنی</summary><code dir="ltr">{e.message}</code></details>}
    </div>
  );
}
