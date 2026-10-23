import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Check, CircleCheck, Circle, Clock, Layers, Lock, Play, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { CourseIcon, ErrorBox, LESSON_ICON, Progress, Spinner, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { fa, jDate, LESSON_LABEL, minutes } from '../lib/fa';
import type { CourseDetail } from '../lib/types';

export default function Course() {
  const { slug } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['course', slug], queryFn: () => api<CourseDetail>(`/courses/${slug}`) });
  const enroll = useMutation({
    mutationFn: () => api(`/courses/${slug}/enroll`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['course', slug] });
      qc.invalidateQueries({ queryKey: ['my-courses'] }); qc.invalidateQueries({ queryKey: ['catalog'] });
      toast('در دوره ثبت‌نام شدید');
      const first = q.data?.modules[0]?.lessons[0];
      if (first) nav(`/lessons/${first.id}`);
    },
    onError: (e) => toast((e as ApiError).message, 'err'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data!;
  const all = c.modules.flatMap((m) => m.lessons);
  const next = all.find((l) => !l.done) ?? all[0];
  const total = all.reduce((s, l) => s + l.durationSec, 0);
  const prereq = c.dependencies.filter((d) => d.kind === 'PREREQUISITE');
  const coreq = c.dependencies.filter((d) => d.kind === 'COREQUISITE');

  let cta;
  if (c.me?.completedAt) cta = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="chip chip-leaf"><CircleCheck className="size-4" />{jDate(c.me.completedAt)} تمامش کردید</span>
      {c.me.certificate && <Link className="btn btn-primary" to={`/verify/${c.me.certificate.code}`}><Award className="size-4" />دیدن گواهی</Link>}
    </div>
  );
  else if (!next) cta = <p className="rounded-2xl bg-sunken p-4 text-muted">درس‌های این دوره هنوز آماده نشده است.</p>;
  else if (c.me) cta = (
    <div className="grid gap-3">
      <Link className="btn btn-primary btn-lg w-fit" to={`/lessons/${c.me.lastLessonId ?? next.id}`}><Play className="size-5" />{c.me.percent ? 'ادامهٔ دوره' : 'شروع اولین درس'}</Link>
      <div className="max-w-sm"><Progress value={c.me.percent} /></div>
    </div>
  );
  else if (c.locked) cta = (
    <div className="flex items-start gap-3 rounded-2xl bg-flame-soft p-4 text-flame-ink">
      <Lock className="mt-1 size-5 shrink-0" />
      <div><b>اول این دوره‌ها را تمام کنید:</b>
        <ul className="mt-1">{prereq.filter((d) => !d.done).map((d) => <li key={d.course.id}><Link className="font-bold underline" to={`/courses/${d.course.slug}`}>{d.course.title}</Link></li>)}</ul></div>
    </div>
  );
  else cta = (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn btn-primary btn-lg" onClick={() => enroll.mutate()} disabled={enroll.isPending}>{enroll.isPending ? 'در حال ثبت‌نام…' : 'ثبت‌نام و شروع'}</button>
      <span className="text-sm text-muted">رایگان</span>
    </div>
  );

  return (
    <div className="rise grid gap-10">
      <nav className="text-sm text-muted"><Link to="/learn" className="text-leaf-ink">یادگیری</Link> / {c.title}</nav>
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {c.level && <span className="text-sm font-bold text-leaf-ink">{c.level}</span>}
          <h1 className="text-[clamp(26px,3.6vw,40px)] font-extrabold">{c.title}</h1>
          {c.about && <p className="prose-fa">{c.about}</p>}
          {c.sponsor && <p className="text-sm text-muted">این دوره با حمایت <b className="font-semibold text-body">{c.sponsor}</b> ساخته شد.</p>}
          {cta}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['مدرس', c.instructor ?? '—'], ['زمان کل', minutes(total)], ['درس‌ها', `${fa(all.length)} درس`], ['قبولی آزمون', `٪${fa(c.passScore)}`]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-sunken p-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-bold text-ink">{v}</dd></div>
            ))}
          </dl>
          {coreq.length > 0 && <p className="text-sm text-muted">هم‌نیاز: {coreq.map((d) => d.course.title).join('، ')} — هم‌زمان با این دوره ثبت‌نام می‌شود و گواهی پس از تمام شدن هر دو صادر می‌شود.</p>}
        </div>
        <aside className={`tint-${c.color} grid content-start gap-4`}>
          <div className="cover grid h-44 place-items-center rounded-3xl"><CourseIcon name={c.icon} className="size-16" /></div>
          {c.outcomes.length > 0 && (
            <div className="card p-5"><h2 className="text-base font-extrabold">پس از این دوره</h2>
              <ul className="mt-2 grid gap-2">{c.outcomes.map((o) => <li key={o} className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-leaf" /><span>{o}</span></li>)}</ul></div>
          )}
        </aside>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between"><h2 className="text-lg font-extrabold">سرفصل‌ها</h2><span className="text-sm text-muted">{fa(all.filter((l) => l.done).length)} از {fa(all.length)} درس</span></div>
        <div className="grid gap-4">
          {c.modules.map((m, mi) => (
            <div key={m.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3"><div><span className="text-xs text-muted">بخش {fa(mi + 1)}</span><h3 className="text-base font-extrabold">{m.title}</h3></div>
                <span className="flex items-center gap-1 text-sm text-muted"><Layers className="size-4" />{fa(m.lessons.length)}</span></div>
              <ul>
                {m.lessons.map((l) => {
                  const I = LESSON_ICON[l.type];
                  const row = (
                    <>
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-body"><I className="size-[18px]" /></span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{l.title}</span>
                        <span className="flex flex-wrap gap-x-3 text-xs text-muted"><span>{LESSON_LABEL[l.type]}</span>{l.durationSec > 0 && <span className="flex items-center gap-1"><Clock className="size-3" />{minutes(l.durationSec)}</span>}{!l.required && <span>اختیاری</span>}{l.isFinalQuiz && <span className="font-bold text-flame-ink">آزمون پایانی</span>}{l.best != null && <span>بهترین نمره: ٪{fa(l.best)}</span>}</span></span>
                      {l.done ? <CircleCheck className="size-5 text-leaf" aria-label="تمام شده" /> : <Circle className="size-5 text-line-strong" aria-label="تمام نشده" />}
                    </>
                  );
                  return <li key={l.id} className="border-b border-line last:border-0">{c.me ? <Link to={`/lessons/${l.id}`} className="flex items-center gap-3 px-5 py-3 no-underline hover:bg-sunken">{row}</Link> : <div className="flex items-center gap-3 px-5 py-3">{row}</div>}</li>;
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
      {c.hasCertificate && (
        <p className="flex items-start gap-3 rounded-2xl bg-dome-soft p-4 text-sm text-dome-ink"><ShieldCheck className="size-5 shrink-0" />با تمام کردن درس‌های لازم و قبولی در آزمون پایانی، گواهی این دوره با یک شناسهٔ استعلام صادر می‌شود.</p>
      )}
    </div>
  );
}
