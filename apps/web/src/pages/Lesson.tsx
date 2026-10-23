import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock, Flag, Lightbulb, RotateCcw, Wrench, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Dialog, ErrorBox, LESSON_ICON, Spinner, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { fa, jDate, LESSON_LABEL } from '../lib/fa';
import type { Completion, CourseDetail, LessonDetail, QuizQuestion } from '../lib/types';

export default function Lesson() {
  const { id } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const lesson = useQuery({ queryKey: ['lesson', id], queryFn: () => api<LessonDetail>(`/lessons/${id}`) });
  const course = useQuery({ queryKey: ['course', lesson.data?.course.slug], enabled: !!lesson.data, queryFn: () => api<CourseDetail>(`/courses/${lesson.data!.course.slug}`) });
  const [done, setDone] = useState<Completion | null>(null);

  if (lesson.isLoading) return <Spinner />;
  if (lesson.error) {
    const e = lesson.error as ApiError;
    return <ErrorBox error={e} onRetry={e.code === 'not_enrolled' ? undefined : () => lesson.refetch()} />;
  }
  const l = lesson.data!;
  const flat = course.data?.modules.flatMap((m) => m.lessons) ?? [];
  const idx = flat.findIndex((x) => x.id === l.id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  const I = LESSON_ICON[l.type];

  const refresh = (c?: Completion | null) => {
    qc.invalidateQueries({ queryKey: ['lesson', id] });
    qc.invalidateQueries({ queryKey: ['course', l.course.slug] });
    qc.invalidateQueries({ queryKey: ['my-courses'] });
    if (c?.completed) { qc.invalidateQueries({ queryKey: ['certs'] }); setDone(c); }
  };

  return (
    <div className="rise grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article className="grid min-w-0 content-start gap-5">
        <nav className="text-sm text-muted"><Link to={`/courses/${l.course.slug}`} className="text-leaf-ink">{l.course.title}</Link></nav>
        <header className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-leaf-soft text-leaf-ink"><I className="size-5" /></span>
          <div><span className="text-sm text-muted">{LESSON_LABEL[l.type]}{l.isFinalQuiz ? ' · آزمون پایانی' : ''}{!l.required ? ' · اختیاری' : ''}</span>
            <h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">{l.title}</h1></div>
        </header>
        <LessonBody l={l} onChange={refresh} />
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          {prev ? <Link to={`/lessons/${prev.id}`} className="btn btn-ghost"><ChevronRight className="size-4" />درس قبل</Link> : <span />}
          {next ? <Link to={`/lessons/${next.id}`} className="btn btn-secondary">درس بعد<ChevronLeft className="size-4" /></Link>
            : <Link to={`/courses/${l.course.slug}`} className="btn btn-secondary">بازگشت به دوره</Link>}
        </footer>
      </article>
      <aside className="hidden lg:block">
        <div className="card sticky top-24 overflow-hidden">
          <div className="border-b border-line p-4"><b className="text-ink">{l.course.title}</b>
            {course.data?.me && <div className="mt-2 bar"><span style={{ width: `${course.data.me.percent}%` }} /></div>}</div>
          <ol className="max-h-[60vh] overflow-auto p-2">
            {flat.map((x) => { const XI = LESSON_ICON[x.type]; return (
              <li key={x.id}><Link to={`/lessons/${x.id}`} aria-current={x.id === l.id ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm no-underline ${x.id === l.id ? 'bg-leaf-soft font-bold text-leaf-ink' : 'text-body hover:bg-sunken'}`}>
                {x.done ? <CircleCheck className="size-4 shrink-0 text-leaf" /> : <XI className="size-4 shrink-0 text-muted" />}<span className="line-clamp-1">{x.title}</span></Link></li>
            ); })}
          </ol>
        </div>
      </aside>
      <Dialog open={!!done} onClose={() => setDone(null)} title="دوره را تمام کردید">
        <div className="grid justify-items-center gap-3 text-center">
          <Award className="size-14 rounded-2xl bg-flame-soft p-3 text-flame-ink" />
          {done?.certificate ? (<>
            <p>گواهی «{l.course.title}» صادر شد.</p>
            <p className="text-sm text-muted">شناسهٔ استعلام: <b dir="ltr" className="tnum text-ink">{done.certificate.code}</b></p>
            <button className="btn btn-primary" onClick={() => nav(`/verify/${done.certificate!.code}`)}>دیدن گواهی</button>
          </>) : done?.waitingFor?.length ? (
            <p>گواهی پس از تمام کردن دورهٔ هم‌نیاز «{done.waitingFor.join('، ')}» صادر می‌شود.</p>
          ) : <p>همهٔ درس‌های لازم این دوره را گذراندید.</p>}
        </div>
      </Dialog>
    </div>
  );
}

function useProgress(id: string, onChange: (c?: Completion | null) => void) {
  const toast = useToast();
  return useMutation({
    mutationFn: (body: { positionSec?: number; completed?: boolean; data?: unknown }) => api<{ completion: Completion | null }>(`/lessons/${id}/progress`, { body }),
    onSuccess: (r, v) => { if (v.completed) { onChange(r.completion); if (!r.completion?.completed) toast('درس تکمیل شد'); } },
    onError: (e) => toast((e as Error).message, 'err'),
  });
}

function DoneBar({ l, onChange, label = 'تمام کردم' }: { l: LessonDetail; onChange: (c?: Completion | null) => void; label?: string }) {
  const p = useProgress(l.id, onChange);
  if (l.progress?.completedAt) return <p className="flex items-center gap-2 font-bold text-leaf-ink"><CheckCircle2 className="size-5" />این درس را {jDate(l.progress.completedAt)} تمام کردید</p>;
  return <div><button className="btn btn-primary" onClick={() => p.mutate({ completed: true })} disabled={p.isPending}><CircleCheck className="size-4" />{label}</button></div>;
}

function LessonBody({ l, onChange }: { l: LessonDetail; onChange: (c?: Completion | null) => void }) {
  const c = l.content ?? {};
  switch (l.type) {
    case 'TEXT': return (
      <div className="grid gap-6">
        <div className="prose-fa">{String(c.body ?? '').split(/\n{2,}/).map((p: string, i: number) => <p key={i}>{p}</p>)}</div>
        {Array.isArray(c.keyPoints) && c.keyPoints.length > 0 && (
          <div className="rounded-2xl bg-flame-soft p-5"><b className="flex items-center gap-2 text-flame-ink"><Lightbulb className="size-5" />نکته‌های کلیدی</b>
            <ul className="mt-2 grid gap-1.5 text-ink">{c.keyPoints.map((k: string) => <li key={k}>• {k}</li>)}</ul></div>
        )}
        <DoneBar l={l} onChange={onChange} label="خواندم" />
      </div>
    );
    case 'VIDEO': return <VideoLesson l={l} onChange={onChange} />;
    case 'AUDIO': return <MediaFile l={l} kind="audio" onChange={onChange} />;
    case 'QUIZ': return <Quiz l={l} onChange={onChange} />;
    case 'WORKSHEET': return <Worksheet l={l} onChange={onChange} />;
    case 'MISSION': return <Mission l={l} onChange={onChange} />;
    default: return (
      <div className="flex items-start gap-3 rounded-2xl bg-sunken p-5"><Wrench className="size-5 shrink-0 text-muted" /><p>این نوع درس ({LESSON_LABEL[l.type]}) در مرحلهٔ بعد ساخته می‌شود.</p></div>
    );
  }
}

function VideoLesson({ l, onChange }: { l: LessonDetail; onChange: (c?: Completion | null) => void }) {
  const c = l.content;
  if (c.provider === 'file') return <MediaFile l={l} kind="video" onChange={onChange} />;
  return (
    <div className="grid gap-4">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink">
        {c.aparatHash ? <iframe src={`https://www.aparat.com/video/video/embed/videohash/${c.aparatHash}/vt/frame`} title={l.title} allow="autoplay; fullscreen" allowFullScreen className="absolute inset-0 size-full border-0" />
          : <p className="absolute inset-0 grid place-items-center text-white/70">ویدیو هنوز اضافه نشده است</p>}
      </div>
      {c.summary && <p className="prose-fa">{c.summary}</p>}
      <p className="hint">ویدیو از آپارات پخش می‌شود؛ وقتی تا آخر دیدید، «دیدم» را بزنید.</p>
      <DoneBar l={l} onChange={onChange} label="دیدم" />
    </div>
  );
}

/** صوت یا ویدیو از سرور خود مدرسه: جای پخش ذخیره می‌شود و با ۹۰٪ خودکار تمام می‌شود */
function MediaFile({ l, kind, onChange }: { l: LessonDetail; kind: 'audio' | 'video'; onChange: (c?: Completion | null) => void }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const p = useProgress(l.id, onChange);
  const sent = useRef(!!l.progress?.completedAt);
  const last = useRef(0);
  const src = l.content.fileKey ? `/api/files/${l.content.fileKey}` : l.content.url;
  useEffect(() => { const m = ref.current; if (m && l.progress?.positionSec) m.currentTime = l.progress.positionSec; }, [l.id]); // eslint-disable-line
  const onTime = () => {
    const m = ref.current; if (!m || !m.duration) return;
    if (!sent.current && m.currentTime / m.duration >= 0.9) { sent.current = true; p.mutate({ completed: true, positionSec: Math.floor(m.currentTime) }); return; }
    if (Math.abs(m.currentTime - last.current) >= 15) { last.current = m.currentTime; p.mutate({ positionSec: Math.floor(m.currentTime) }); }
  };
  if (!src) return <p className="rounded-2xl bg-sunken p-5 text-muted">فایل این درس هنوز اضافه نشده است.</p>;
  return (
    <div className="grid gap-4">
      {kind === 'video'
        ? <video ref={(e) => { ref.current = e; }} src={src} controls preload="metadata" className="aspect-video w-full rounded-2xl bg-ink" onTimeUpdate={onTime} />
        : <audio ref={(e) => { ref.current = e; }} src={src} controls preload="metadata" className="w-full" onTimeUpdate={onTime} />}
      {l.content.summary && <p className="prose-fa">{l.content.summary}</p>}
      {l.progress?.completedAt ? <p className="flex items-center gap-2 font-bold text-leaf-ink"><CheckCircle2 className="size-5" />این درس را تمام کردید</p>
        : <p className="hint">وقتی تا آخر گوش دادید، درس خودکار تمام می‌شود.</p>}
    </div>
  );
}

interface QuizResult { score: number; passed: boolean; passScore: number; results: { id: string; ok: boolean; correct: string[]; explain: string }[]; completion: Completion | null; nextAllowedAt: string | null }

function Quiz({ l, onChange }: { l: LessonDetail; onChange: (c?: Completion | null) => void }) {
  const qs: QuizQuestion[] = l.content.questions ?? [];
  const [ans, setAns] = useState<Record<string, string[]>>({});
  const [res, setRes] = useState<QuizResult | null>(null);
  const [err, setErr] = useState('');
  const toast = useToast();
  const submit = useMutation({
    mutationFn: () => api<QuizResult>(`/lessons/${l.id}/quiz`, { body: { answers: ans } }),
    onSuccess: (r) => { setRes(r); onChange(r.completion); window.scrollTo({ top: 0, behavior: 'smooth' }); if (r.passed && !r.completion?.completed) toast('آزمون را گذراندید'); },
    onError: (e) => setErr((e as Error).message),
  });
  const wait = l.quiz?.nextAllowedAt && new Date(l.quiz.nextAllowedAt) > new Date() ? l.quiz.nextAllowedAt : res?.nextAllowedAt;
  const pick = (q: QuizQuestion, o: string) => setAns((a) => ({ ...a, [q.id]: q.kind === 'multi' ? (a[q.id]?.includes(o) ? a[q.id].filter((x) => x !== o) : [...(a[q.id] ?? []), o]) : [o] }));
  const answered = qs.every((q) => ans[q.id]?.length);
  const best = Math.max(-1, ...(l.quiz?.attempts.map((a) => a.score) ?? []));

  return (
    <div className="grid gap-5">
      {res ? (
        <div className={`rise flex flex-wrap items-center gap-4 rounded-2xl p-5 ${res.passed ? 'bg-leaf-soft text-leaf-ink' : 'bg-rose-soft text-rose'}`}>
          <b className="tnum text-4xl">٪{fa(res.score)}</b>
          <div className="flex-1"><b className="block">{res.passed ? 'قبول شدید' : 'هنوز به حد قبولی نرسیدید'}</b><span className="text-sm">حد قبولی ٪{fa(res.passScore)}؛ توضیح هر پرسش را پایین ببینید.</span></div>
          {!res.passed && !wait && <button className="btn btn-secondary" onClick={() => { setRes(null); setAns({}); }}><RotateCcw className="size-4" />دوباره</button>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <span>{fa(qs.length)} پرسش · حد قبولی ٪{fa(l.course.passScore)}</span>
          {best >= 0 && <span className="font-bold text-ink">بهترین نمرهٔ شما: ٪{fa(best)}</span>}
          {!!l.quiz?.attempts.length && <span>{fa(l.quiz.attempts.length)} بار تلاش</span>}
        </div>
      )}
      {wait && <p className="flex items-center gap-2 rounded-2xl bg-flame-soft p-4 text-sm text-flame-ink"><Clock className="size-4" />تلاش بعدی از {new Intl.DateTimeFormat('fa-IR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(wait))} ممکن است. در این فاصله درس‌ها را مرور کنید.</p>}
      <ol className="grid gap-4">
        {qs.map((q, i) => {
          const r = res?.results.find((x) => x.id === q.id);
          return (
            <li key={q.id} className="card p-5">
              <p className="font-bold text-ink"><span className="text-muted">{fa(i + 1)}. </span>{q.text}</p>
              {q.kind === 'multi' && <p className="hint">چند گزینه ممکن است درست باشد.</p>}
              <div className="mt-3 grid gap-2" role={q.kind === 'multi' ? 'group' : 'radiogroup'}>
                {q.options.map((o) => {
                  const sel = ans[q.id]?.includes(o.id);
                  const right = r?.correct.includes(o.id);
                  const cls = r ? (right ? 'border-leaf bg-leaf-soft' : sel ? 'border-rose bg-rose-soft' : 'border-line') : sel ? 'border-leaf bg-leaf-soft' : 'border-line hover:border-line-strong';
                  return (
                    <button key={o.id} type="button" disabled={!!res} onClick={() => pick(q, o.id)} role={q.kind === 'multi' ? 'checkbox' : 'radio'} aria-checked={!!sel}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-start transition ${cls}`}>
                      <span className={`grid size-5 shrink-0 place-items-center border-2 ${q.kind === 'multi' ? 'rounded-md' : 'rounded-full'} ${sel ? 'border-leaf bg-leaf' : 'border-line-strong'}`}>{sel && <span className="size-2 rounded-full bg-white" />}</span>
                      <span className="flex-1 text-ink">{o.text}</span>
                      {r && right && <CircleCheck className="size-5 text-leaf" />}{r && sel && !right && <XCircle className="size-5 text-rose" />}
                    </button>
                  );
                })}
              </div>
              {r?.explain && <p className={`mt-3 rounded-xl p-3 text-sm ${r.ok ? 'bg-leaf-soft text-leaf-ink' : 'bg-sunken text-body'}`}><b>{r.ok ? 'درست. ' : 'توضیح: '}</b>{r.explain}</p>}
            </li>
          );
        })}
      </ol>
      {!res && (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary btn-lg" disabled={!answered || submit.isPending || !!wait} onClick={() => { setErr(''); submit.mutate(); }}>{submit.isPending ? 'در حال ثبت…' : 'ثبت پاسخ‌ها'}</button>
          {!answered && <span className="hint">به همهٔ پرسش‌ها پاسخ دهید.</span>}
          {err && <span className="err"><CircleAlert className="size-4" />{err}</span>}
        </div>
      )}
    </div>
  );
}

function Worksheet({ l, onChange }: { l: LessonDetail; onChange: (c?: Completion | null) => void }) {
  const fields: { id: string; label: string; hint?: string }[] = l.content.fields ?? [];
  const [v, setV] = useState<Record<string, string>>(l.progress?.data ?? {});
  const p = useProgress(l.id, onChange);
  const toast = useToast();
  const filled = fields.every((f) => (v[f.id] ?? '').trim().length >= 3);
  return (
    <div className="grid gap-4">
      <p className="prose-fa">{l.content.prompt}</p>
      {fields.map((f) => (
        <div key={f.id} className="field"><label htmlFor={f.id}>{f.label}</label>
          <textarea id={f.id} className="input" value={v[f.id] ?? ''} onChange={(e) => setV((x) => ({ ...x, [f.id]: e.target.value }))} />
          {f.hint && <span className="hint">{f.hint}</span>}</div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary" onClick={() => p.mutate({ data: v }, { onSuccess: () => toast('پیش‌نویس ذخیره شد') })} disabled={p.isPending}>ذخیرهٔ پیش‌نویس</button>
        {l.progress?.completedAt ? <span className="chip chip-leaf"><CircleCheck className="size-4" />ثبت شده</span>
          : <button className="btn btn-primary" disabled={!filled || p.isPending} onClick={() => p.mutate({ data: v, completed: true })}>ثبت برگه</button>}
      </div>
      {!filled && !l.progress?.completedAt && <p className="hint">برای ثبت، همهٔ خانه‌ها را دست‌کم چند کلمه پر کنید.</p>}
    </div>
  );
}

function Mission({ l, onChange }: { l: LessonDetail; onChange: (c?: Completion | null) => void }) {
  const d = l.progress?.data ?? {};
  const [checks, setChecks] = useState<Record<number, boolean>>(d.checks ?? {});
  const [did, setDid] = useState<string>(d.did ?? '');
  const [learned, setLearned] = useState<string>(d.learned ?? '');
  const p = useProgress(l.id, onChange);
  const status: string | undefined = d.status;
  return (
    <div className="grid gap-5">
      <div className="rounded-2xl bg-flame-soft p-5"><b className="flex items-center gap-2 text-flame-ink"><Flag className="size-5" />مأموریت</b><p className="mt-1 text-ink">{l.content.goal}</p></div>
      {Array.isArray(l.content.steps) && l.content.steps.length > 0 && (
        <ul className="grid gap-2">{l.content.steps.map((s: string, i: number) => (
          <li key={i}><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3">
            <input type="checkbox" className="size-5 accent-[var(--leaf)]" checked={!!checks[i]} onChange={(e) => setChecks((c) => ({ ...c, [i]: e.target.checked }))} disabled={!!status} /><span>{s}</span></label></li>
        ))}</ul>
      )}
      {status ? (
        <div className="card grid gap-2 p-5">
          <b className="text-ink">گزارش شما</b><p><b>چه کردید: </b>{d.did}</p>{d.learned && <p><b>چه یاد گرفتید: </b>{d.learned}</p>}
          <span className={`chip w-fit ${status === 'submitted' ? 'chip-leaf' : 'chip-flame'}`}>{status === 'submitted' ? 'فرستاده شد' : 'در انتظار تأیید راهیار'}</span>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="field"><label htmlFor="did">چه کردید؟</label><textarea id="did" className="input" placeholder="با چه کسی، کجا، چطور" value={did} onChange={(e) => setDid(e.target.value)} /></div>
          <div className="field"><label htmlFor="lr">چه چیزی یاد گرفتید یا شما را غافلگیر کرد؟</label><textarea id="lr" className="input" value={learned} onChange={(e) => setLearned(e.target.value)} /></div>
          <p className="hint">عکس افراد را فقط با اجازهٔ خودشان بفرستید. بارگذاری عکس در مرحلهٔ بعد اضافه می‌شود.</p>
          <div><button className="btn btn-primary" disabled={did.trim().length < 10 || p.isPending} onClick={() => p.mutate({ completed: true, data: { checks, did, learned } })}>فرستادن گزارش</button></div>
        </div>
      )}
    </div>
  );
}
