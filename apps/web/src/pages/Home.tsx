import { useQuery } from '@tanstack/react-query';
import { Award, ChevronLeft, Play, Route } from 'lucide-react';
import { Link } from 'react-router';
import { CourseCard } from '../components/CourseCard';
import { CourseIcon, Empty, ErrorBox, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fa } from '../lib/fa';
import type { CourseCard as C, PathCard } from '../lib/types';

function greet() {
  const h = new Date().getHours();
  return h < 5 ? 'شب بخیر' : h < 12 ? 'صبح بخیر' : h < 17 ? 'ظهر بخیر' : 'عصر بخیر';
}

export default function Home() {
  const { me } = useAuth();
  const mine = useQuery({ queryKey: ['my-courses'], queryFn: () => api<C[]>('/me/courses') });
  const paths = useQuery({ queryKey: ['paths'], queryFn: () => api<PathCard[]>('/paths') });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<C[]>('/courses') });
  if (mine.isLoading) return <Spinner />;
  if (mine.error) return <ErrorBox error={mine.error} onRetry={() => mine.refetch()} />;
  const active = (mine.data ?? []).filter((c) => !c.me?.completedAt && !c.me?.archived);
  const current = active[0];
  const doneCount = (mine.data ?? []).filter((c) => c.me?.completedAt).length;
  const fresh = (catalog.data ?? []).filter((c) => !c.me).slice(0, 3);

  return (
    <div className="rise grid gap-10">
      <section>
        <h1 className="text-[clamp(24px,3vw,32px)] font-extrabold">{greet()}، {me?.firstName}</h1>
        <p className="mt-1 text-muted">{me?.mosque?.name ?? me?.nearMosque ?? ''}{me?.county ? ` · ${me.county.name}` : ''}</p>
      </section>

      {current ? (
        <section className={`tint-${current.color} card grid overflow-hidden md:grid-cols-[220px_minmax(0,1fr)]`}>
          <div className="cover grid min-h-32 place-items-center"><CourseIcon name={current.icon} className="size-14" /></div>
          <div className="grid gap-3 p-5 md:p-7">
            <span className="text-sm font-bold text-leaf-ink">ادامهٔ یادگیری</span>
            <h2 className="text-xl font-extrabold">{current.title}</h2>
            <div className="max-w-md"><div className="bar"><span style={{ width: `${current.me!.percent}%` }} /></div><p className="mt-1.5 text-sm text-muted">٪{fa(current.me!.percent)} از دوره را گذرانده‌اید</p></div>
            <div className="flex flex-wrap gap-2">
              <Link className="btn btn-primary" to={current.me!.lastLessonId ? `/lessons/${current.me!.lastLessonId}` : `/courses/${current.slug}`}><Play className="size-4" />ادامه</Link>
              <Link className="btn btn-ghost" to={`/courses/${current.slug}`}>صفحهٔ دوره</Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="card grid gap-3 p-6 md:p-8">
          <h2 className="text-xl font-extrabold">{doneCount ? 'دورهٔ بعدی‌تان را انتخاب کنید' : 'از کجا شروع کنم؟'}</h2>
          <p className="max-w-xl text-muted">{doneCount ? `تا امروز ${fa(doneCount)} دوره را تمام کرده‌اید. یک مسیر را ادامه دهید یا دورهٔ تازه‌ای بردارید.` : 'یک مسیر را باز کنید و اولین دوره‌اش را شروع کنید. هر دوره چند درس کوتاه دارد و آخرش گواهی می‌گیرید.'}</p>
          <div><Link to="/learn" className="btn btn-primary">دیدن دوره‌ها<ChevronLeft className="size-4" /></Link></div>
        </section>
      )}

      {active.length > 1 && (
        <section>
          <h2 className="mb-4 text-lg font-extrabold">دوره‌های در حال گذراندن</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{active.slice(1).map((c) => <CourseCard key={c.id} c={c} />)}</div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-3"><h2 className="text-lg font-extrabold">مسیرها</h2><Link to="/learn" className="text-sm font-bold text-leaf-ink">همهٔ دوره‌ها</Link></div>
        {paths.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {paths.data.map((p) => (
              <Link key={p.id} to={`/paths/${p.slug}`} className={`tint-${p.color} card flex items-center gap-4 p-4 no-underline transition hover:shadow-lift`}>
                <span className="cover grid size-14 shrink-0 place-items-center rounded-2xl"><Route className="size-6" /></span>
                <span className="min-w-0 flex-1"><b className="block text-ink">{p.title}</b><span className="text-sm text-muted">{fa(p.courseCount)} دوره · {fa(p.completedCount)} تمام‌شده</span></span>
                <ChevronLeft className="size-5 text-muted" />
              </Link>
            ))}
          </div>
        ) : <Empty icon={Route} title="هنوز مسیری منتشر نشده" />}
      </section>

      {fresh.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-extrabold">دوره‌هایی که هنوز شروع نکرده‌اید</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fresh.map((c) => <CourseCard key={c.id} c={c} />)}</div>
        </section>
      )}

      {doneCount > 0 && (
        <Link to="/me" className="card flex items-center gap-4 p-4 no-underline">
          <Award className="size-10 shrink-0 rounded-xl bg-flame-soft p-2 text-flame-ink" />
          <span className="flex-1"><b className="block text-ink">{fa(doneCount)} گواهی گرفته‌اید</b><span className="text-sm text-muted">گواهی‌ها و شناسهٔ استعلامشان</span></span>
          <ChevronLeft className="size-5 text-muted" />
        </Link>
      )}
    </div>
  );
}
