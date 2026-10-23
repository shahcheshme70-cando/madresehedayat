import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Route, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CourseCard } from '../components/CourseCard';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { fa, jDate } from '../lib/fa';
import type { CourseCard as C, PathCard } from '../lib/types';

type Filter = 'all' | 'mine' | 'done' | 'new';

export default function Learn() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<C[]>('/courses') });
  const paths = useQuery({ queryKey: ['paths'], queryFn: () => api<PathCard[]>('/paths') });
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const list = useMemo(() => (catalog.data ?? []).filter((c) => {
    if (q.trim() && !(c.title + (c.subtitle ?? '')).includes(q.trim())) return false;
    if (f === 'mine') return !!c.me && !c.me.completedAt;
    if (f === 'done') return !!c.me?.completedAt;
    if (f === 'new') return !c.me;
    return true;
  }), [catalog.data, q, f]);
  if (catalog.isLoading) return <Spinner />;
  if (catalog.error) return <ErrorBox error={catalog.error} onRetry={() => catalog.refetch()} />;
  return (
    <div className="rise grid gap-10">
      <header>
        <h1 className="text-[clamp(24px,3vw,32px)] font-extrabold">یادگیری</h1>
        <p className="mt-1 max-w-2xl text-muted">دوره‌ها در مسیرها کنار هم چیده شده‌اند. از هر جا که به کار امروزتان در مسجد نزدیک‌تر است شروع کنید.</p>
      </header>
      {!!paths.data?.length && (
        <section>
          <h2 className="mb-4 text-lg font-extrabold">مسیرها</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paths.data.map((p) => (
              <Link key={p.id} to={`/paths/${p.slug}`} className={`tint-${p.color} card overflow-hidden no-underline transition hover:shadow-lift`}>
                <div className="cover flex items-center gap-3 p-4"><Route className="size-6" /><b className="text-ink">{p.title}</b></div>
                <div className="p-4 text-sm text-muted"><p className="line-clamp-2">{p.description}</p><p className="mt-2 font-semibold text-body">{fa(p.courseCount)} دوره{p.completedCount ? ` · ${fa(p.completedCount)} تمام‌شده` : ''}</p></div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="me-auto text-lg font-extrabold">همهٔ دوره‌ها</h2>
          <div className="seg" role="group" aria-label="فیلتر">
            {([['all', 'همه'], ['mine', 'در حال گذراندن'], ['done', 'تمام‌شده'], ['new', 'شروع‌نشده']] as [Filter, string][]).map(([k, t]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{t}</button>)}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input className="input h-10 pe-9" type="search" placeholder="جست‌وجو در دوره‌ها" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جست‌وجو" />
          </div>
        </div>
        {list.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => <CourseCard key={c.id} c={c} />)}</div>
          : <Empty title="دوره‌ای پیدا نشد">عبارت دیگری را امتحان کنید یا فیلتر را بردارید.</Empty>}
      </section>
    </div>
  );
}

export function PathPage() {
  const { slug } = useParams();
  const paths = useQuery({ queryKey: ['paths'], queryFn: () => api<PathCard[]>('/paths') });
  if (paths.isLoading) return <Spinner />;
  const p = paths.data?.find((x) => x.slug === slug);
  if (!p) return <Empty icon={Route} title="این مسیر پیدا نشد"><Link to="/learn" className="font-bold text-leaf-ink">بازگشت به یادگیری</Link></Empty>;
  return (
    <div className="rise grid gap-8">
      <nav className="text-sm text-muted"><Link to="/learn" className="text-leaf-ink">یادگیری</Link> / {p.title}</nav>
      <header className={`tint-${p.color} cover rounded-3xl p-6 md:p-10`}>
        <Route className="size-8" />
        <h1 className="mt-3 text-[clamp(24px,3vw,34px)] font-extrabold">{p.title}</h1>
        {p.description && <p className="mt-2 max-w-2xl text-body">{p.description}</p>}
        <p className="mt-4 text-sm font-bold text-ink">{fa(p.completedCount)} از {fa(p.courseCount)} دوره تمام شده</p>
      </header>
      <ol className="grid gap-4">
        {p.courses.map((c, i) => (
          <li key={c.id} className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3">
            <span className={`mt-4 grid size-10 place-items-center rounded-full font-extrabold ${c.me?.completedAt ? 'bg-leaf text-white' : 'bg-sunken text-ink'}`}>{fa(i + 1)}</span>
            <CourseCard c={c} />
          </li>
        ))}
      </ol>
      {p.hasExam && (
        <section className="card flex flex-wrap items-center gap-4 p-5">
          <Award className="size-11 shrink-0 rounded-xl bg-flame-soft p-2.5 text-flame-ink" />
          <div className="min-w-0 flex-1"><b className="block text-ink">آزمون جامع مسیر</b><span className="text-sm text-muted">{p.completedCount < p.courseCount ? 'وقتی همهٔ دوره‌های مسیر تمام شد باز می‌شود.' : 'همهٔ دوره‌ها تمام شده؛ با قبولی، گواهی مسیر می‌گیرید.'}</span></div>
          <Link to={`/paths/${p.slug}/exam`} className={`btn ${p.completedCount < p.courseCount ? 'btn-secondary' : 'btn-primary'}`}>{p.completedCount < p.courseCount ? 'دیدن' : 'شروع آزمون'}</Link>
        </section>
      )}
    </div>
  );
}

interface PathExamData {
  path: { slug: string; title: string }; passScore: number; locked: boolean; waitingFor: string[]; intro: string | null;
  questions: { id: string; kind: 'single' | 'multi' | 'tf'; text: string; options: { id: string; text: string }[] }[];
  attempts: { score: number; passed: boolean; at: string }[]; nextAllowedAt: string | null; certificate: { code: string; score: number | null } | null;
}

export function PathExam() {
  const { slug = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['path-exam', slug], queryFn: () => api<PathExamData>(`/paths/${slug}/exam`) });
  const [ans, setAns] = useState<Record<string, string[]>>({});
  const [res, setRes] = useState<{ score: number; passed: boolean; results: { id: string; ok: boolean; correct: string[]; explain: string }[]; certificate: { code: string } | null } | null>(null);
  const [err, setErr] = useState('');
  const submit = useMutation({
    mutationFn: () => api<typeof res>(`/paths/${slug}/exam`, { body: { answers: ans } }),
    onSuccess: (r) => { setRes(r); qc.invalidateQueries({ queryKey: ['path-exam', slug] }); qc.invalidateQueries({ queryKey: ['certs'] }); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    onError: (e) => setErr((e as Error).message),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <Empty icon={Route} title={(q.error as Error).message} />;
  const e = q.data!;
  const pick = (qq: PathExamData['questions'][number], o: string) => setAns((a) => ({ ...a, [qq.id]: qq.kind === 'multi' ? (a[qq.id]?.includes(o) ? a[qq.id].filter((x) => x !== o) : [...(a[qq.id] ?? []), o]) : [o] }));
  const answered = e.questions.every((qq) => ans[qq.id]?.length);
  return (
    <div className="rise mx-auto grid max-w-3xl gap-6">
      <nav className="text-sm text-muted"><Link to={`/paths/${slug}`} className="text-leaf-ink">{e.path.title}</Link> / آزمون جامع</nav>
      <h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">آزمون جامع مسیر «{e.path.title}»</h1>
      {e.certificate && <div className="card flex flex-wrap items-center gap-3 p-4"><Award className="size-8 text-flame-ink" /><span className="flex-1">گواهی مسیر را گرفته‌اید{e.certificate.score != null ? ` (نمره ٪${fa(e.certificate.score)})` : ''}.</span><Link className="btn btn-secondary btn-sm" to={`/verify/${e.certificate.code}`}>دیدن گواهی</Link></div>}
      {e.locked ? (
        <div className="card grid gap-2 p-5"><b className="text-ink">آزمون هنوز باز نیست</b><p className="text-body">اول این دوره‌ها را تمام کنید:</p><ul className="list-inside list-disc text-body">{e.waitingFor.map((w) => <li key={w}>{w}</li>)}</ul></div>
      ) : res ? (
        <div className={`card grid gap-3 p-5 ${res.passed ? 'border-leaf' : ''}`}>
          <b className="text-xl text-ink">{res.passed ? 'قبول شدید' : 'این بار نشد'} — نمرهٔ ٪{fa(res.score)}</b>
          <p className="text-body">{res.passed ? (res.certificate ? 'گواهی مسیر صادر شد و در «گواهی‌ها و پیشرفت» است.' : '') : `برای قبولی ٪${fa(e.passScore)} لازم است. پاسخ‌ها را مرور کنید و دوباره امتحان کنید.`}</p>
          <ol className="grid gap-2">{e.questions.map((qq, i) => { const r = res.results.find((x) => x.id === qq.id); return <li key={qq.id} className={`rounded-xl p-3 text-sm ${r?.ok ? 'bg-leaf-soft' : 'bg-rose-soft'}`}><b>{fa(i + 1)}. {qq.text}</b>{r?.explain && <p className="mt-1">{r.explain}</p>}</li>; })}</ol>
          <div className="flex gap-2">{res.certificate && <Link className="btn btn-primary" to={`/verify/${res.certificate.code}`}>دیدن گواهی</Link>}{!res.passed && <button className="btn btn-secondary" onClick={() => { setRes(null); setAns({}); }}>تلاش دوباره</button>}</div>
        </div>
      ) : (
        <>
          {e.intro && <p className="prose-fa">{e.intro}</p>}
          <p className="hint">نمرهٔ قبولی ٪{fa(e.passScore)}. دو بار اول بی‌فاصله، از بار سوم هر ۲۴ ساعت یک بار. بهترین نمره می‌ماند.</p>
          {e.nextAllowedAt ? <p className="rounded-xl bg-flame-soft p-3 text-ink">تلاش بعدی از {jDate(e.nextAllowedAt)} ممکن است.</p> : (
            <>
              <ol className="grid gap-4">{e.questions.map((qq, i) => (
                <li key={qq.id} className="card p-5"><p className="font-bold text-ink"><span className="text-muted">{fa(i + 1)}. </span>{qq.text}</p>
                  <div className="mt-3 grid gap-2">{qq.options.map((o) => { const sel = ans[qq.id]?.includes(o.id); return (
                    <button key={o.id} type="button" onClick={() => pick(qq, o.id)} aria-pressed={!!sel} className={`rounded-xl border px-4 py-3 text-start ${sel ? 'border-leaf bg-leaf-soft' : 'border-line hover:border-line-strong'}`}>{o.text}</button>); })}</div></li>
              ))}</ol>
              <div className="flex items-center gap-3"><button className="btn btn-primary btn-lg" disabled={!answered || submit.isPending} onClick={() => { setErr(''); submit.mutate(); }}>ثبت پاسخ‌ها</button>{err && <span className="err">{err}</span>}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
