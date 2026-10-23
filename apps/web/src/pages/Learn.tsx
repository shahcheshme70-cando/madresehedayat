import { useQuery } from '@tanstack/react-query';
import { Route, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CourseCard } from '../components/CourseCard';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { fa } from '../lib/fa';
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
    </div>
  );
}
