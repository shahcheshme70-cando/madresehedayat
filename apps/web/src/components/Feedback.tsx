import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bug, ImagePlus, Lightbulb, MessageSquareHeart, MessageSquarePlus, BookOpen, CircleEllipsis, Star, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { api } from '../lib/api';
import { fa } from '../lib/fa';
import { Dialog, useToast } from './ui';

/* ═════════════ بازخورد: از هر صفحه، امتیاز درس، امتیاز دوره ═════════════ */

export const FB_KIND: Record<string, { t: string; i: typeof Bug; hint: string }> = {
  BUG: { t: 'مشکل', i: Bug, hint: 'چه کردید و چه دیدید؟ اگر می‌شود، عکس صفحه را هم بگذارید.' },
  IDEA: { t: 'پیشنهاد', i: Lightbulb, hint: 'چه چیزی کارتان را راحت‌تر می‌کند؟' },
  CONTENT: { t: 'محتوا', i: BookOpen, hint: 'دربارهٔ درس، متن، صوت یا ویدیو: کجا نامفهوم یا نادرست بود؟' },
  PRAISE: { t: 'تشکر', i: MessageSquareHeart, hint: 'چه چیزی به کارتان آمد؟ تیم مدرسه می‌خواند.' },
  OTHER: { t: 'دیگر', i: CircleEllipsis, hint: '' },
};
export const FB_STATUS: Record<string, [string, string]> = { NEW: ['chip-dome', 'رسید'], REVIEWING: ['chip-flame', 'در حال بررسی'], PLANNED: ['chip-leaf', 'در برنامه'], DONE: ['chip-leaf', 'انجام شد'], DECLINED: ['', 'فعلاً نه'] };
const MOODS = ['😞', '🙁', '😐', '🙂', '😍'];

type Ctx = Record<string, string>;
const FbCtx = createContext<{ open: (kind?: string) => void; setContext: (c: Ctx | null) => void }>({ open: () => {}, setContext: () => {} });
export const useFeedback = () => useContext(FbCtx);
/** صفحه‌ها زمینهٔ خود را (دوره، درس، برنامه…) برای بازخورد اعلام می‌کنند */
export function useFeedbackContext(c: Ctx | null) {
  const { setContext } = useFeedback();
  const key = JSON.stringify(c);
  useEffect(() => { setContext(c); return () => setContext(null); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<string | null>(null);
  const ctx = useRef<Ctx | null>(null);
  const setContext = useCallback((c: Ctx | null) => { ctx.current = c; }, []);
  const open = useCallback((k = 'IDEA') => setKind(k), []);
  return (
    <FbCtx.Provider value={{ open, setContext }}>
      {children}
      {kind && <FeedbackDialog initialKind={kind} context={ctx.current} onClose={() => setKind(null)} />}
    </FbCtx.Provider>
  );
}

function FeedbackDialog({ initialKind, context, onClose }: { initialKind: string; context: Ctx | null; onClose: () => void }) {
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ kind: initialKind, mood: 0, body: '', anonymous: false });
  const [img, setImg] = useState<{ key: string; url: string } | null>(null);
  const [up, setUp] = useState(false);
  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast('عکس باید کمتر از ۱۰ مگابایت باشد', 'err'); return; }
    setUp(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api<{ key: string }>('/uploads/mission?kind=feedback', { form: fd });
      setImg({ key: r.key, url: URL.createObjectURL(file) });
    } catch (e) { toast((e as Error).message, 'err'); } finally { setUp(false); }
  };
  const send = useMutation({
    mutationFn: () => api('/feedback', { body: {
      kind: f.kind, body: f.body.trim(), anonymous: f.anonymous, path: loc.pathname, ...(f.mood ? { mood: f.mood } : {}), ...(context ? { context } : {}), ...(img ? { imageKey: img.key } : {}),
      ...(f.kind === 'BUG' ? { device: `${navigator.userAgent.match(/(Firefox|Edg|OPR|Chrome|Safari)\/[\d.]+/)?.[0] ?? 'مرورگر'} · ${innerWidth}×${innerHeight}${/Mobi/.test(navigator.userAgent) ? ' · گوشی' : ''}` } : {}),
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-feedback'] }); toast('ممنون! بازخوردتان رسید؛ نتیجه را با اعلان خبر می‌دهیم'); onClose(); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const K = FB_KIND[f.kind];
  return (
    <Dialog open onClose={onClose} title="بازخورد به تیم مدرسه">
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="نوع بازخورد">{Object.entries(FB_KIND).map(([k, v]) => (
          <button type="button" key={k} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold ${f.kind === k ? 'border-leaf bg-leaf-soft text-leaf-ink' : 'border-line text-body'}`}><v.i className="size-4" />{v.t}</button>))}</div>
        <div className="field"><span className="text-sm font-bold text-ink">حس کلی‌تان از مدرسه <span className="font-normal text-muted">(اختیاری)</span></span>
          <div className="flex gap-1" role="radiogroup" aria-label="حس کلی">{MOODS.map((m, i) => (
            <button type="button" key={i} role="radio" aria-checked={f.mood === i + 1} aria-label={`${fa(i + 1)} از ۵`} onClick={() => setF({ ...f, mood: f.mood === i + 1 ? 0 : i + 1 })}
              className={`grid size-11 place-items-center rounded-xl text-2xl transition ${f.mood === i + 1 ? 'bg-leaf-soft ring-2 ring-leaf' : 'bg-sunken grayscale-[60%] hover:grayscale-0'}`}>{m}</button>))}</div></div>
        <div className="field"><label htmlFor="fb-body">بنویسید</label>
          <textarea id="fb-body" className="input min-h-32" required minLength={3} maxLength={3000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={K.hint} />
          <span className="hint">این صفحه همراه بازخورد فرستاده می‌شود. شماره یا نشانی کسی را ننویسید.</span></div>
        {(f.kind === 'BUG' || f.kind === 'CONTENT') && (img ? (
          <div className="relative w-fit"><img src={img.url} alt="عکس صفحه" className="max-h-40 rounded-xl border border-line" /><button type="button" className="btn btn-secondary btn-icon btn-sm absolute -top-2 -start-2" aria-label="برداشتن عکس" onClick={() => setImg(null)}><X className="size-4" /></button></div>
        ) : (
          <label className="btn btn-ghost btn-sm w-fit cursor-pointer"><ImagePlus className="size-4" />{up ? 'در حال بارگذاری…' : 'افزودن عکس صفحه (اختیاری)'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={up} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
        ))}
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 accent-[var(--leaf)]" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />
          <span>بی‌نام بفرست<span className="hint block">نامتان به کارکنان نشان داده نمی‌شود؛ پاسخ و وضعیت را خودتان در «کمک و پشتیبانی» می‌بینید.</span></span></label>
        <button className="btn btn-primary" disabled={send.isPending || up || f.body.trim().length < 3}>{send.isPending ? 'در حال فرستادن…' : 'فرستادن'}</button>
      </form>
    </Dialog>
  );
}

/** پیوند آرام پایین هر صفحه */
export function FeedbackLink() {
  const { open } = useFeedback();
  return (
    <div className="wrap pb-8 text-center">
      <button className="inline-flex items-center gap-2 text-sm text-muted hover:text-leaf-ink" onClick={() => open('IDEA')}><MessageSquarePlus className="size-4" />نظر یا مشکلی دربارهٔ این صفحه دارید؟</button>
    </div>
  );
}

/** «این درس به کارتان آمد؟» */
export function LessonRating({ lessonId }: { lessonId: string }) {
  const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['lesson-rating', lessonId], queryFn: () => api<{ rating: { up: boolean; reasons: string[]; comment: string | null } | null; reasons: { up: string[]; down: string[] } }>(`/lessons/${lessonId}/rating`) });
  const [draft, setDraft] = useState<{ up: boolean; reasons: string[]; comment: string } | null>(null);
  const save = useMutation({ mutationFn: (v: { up: boolean; reasons: string[]; comment: string }) => api(`/lessons/${lessonId}/rating`, { body: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lesson-rating', lessonId] }); }, onError: (e) => toast((e as Error).message, 'err') });
  if (!q.data) return null;
  const r = draft ?? (q.data.rating ? { ...q.data.rating, comment: q.data.rating.comment ?? '' } : null);
  const pick = (up: boolean) => { const v = { up, reasons: [], comment: '' }; setDraft(v); save.mutate(v); };
  const opts = r ? (r.up ? q.data.reasons.up : q.data.reasons.down) : [];
  return (
    <section className="rounded-2xl border border-line p-4" aria-label="امتیاز این درس">
      <div className="flex flex-wrap items-center gap-3"><b className="text-ink">این درس به کارتان آمد؟</b>
        <div className="flex gap-2">
          <button className={`btn btn-sm ${r?.up === true ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={r?.up === true} onClick={() => pick(true)}><ThumbsUp className="size-4" />بله</button>
          <button className={`btn btn-sm ${r?.up === false ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={r?.up === false} onClick={() => pick(false)}><ThumbsDown className="size-4" />نه چندان</button>
        </div></div>
      {r && draft && (
        <div className="mt-3 grid gap-2">
          <div className="flex flex-wrap gap-2">{opts.map((o) => <button key={o} type="button" aria-pressed={r.reasons.includes(o)} className={`chip cursor-pointer border ${r.reasons.includes(o) ? 'chip-leaf border-leaf' : 'border-line'}`}
            onClick={() => setDraft({ ...r, reasons: r.reasons.includes(o) ? r.reasons.filter((x) => x !== o) : [...r.reasons, o] })}>{o}</button>)}</div>
          <textarea className="input min-h-16" maxLength={1000} placeholder="اگر خواستید، کوتاه بنویسید (اختیاری)" value={r.comment} onChange={(e) => setDraft({ ...r, comment: e.target.value })} aria-label="توضیح" />
          <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={save.isPending} onClick={() => { save.mutate(r, { onSuccess: () => { setDraft(null); toast('ممنون؛ ثبت شد'); } }); }}>ثبت</button><button className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>بستن</button></div>
        </div>
      )}
      {r && !draft && <p className="hint mt-2">ثبت شد؛ ممنون. برای تغییر دوباره بزنید.</p>}
    </section>
  );
}

/** ستاره‌ها (نمایش یا انتخاب) */
export function Stars({ value, onChange, size = 'size-6' }: { value: number; onChange?: (n: number) => void; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={`${fa(value)} از ۵ ستاره`}>
      {[1, 2, 3, 4, 5].map((n) => onChange
        ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${fa(n)} ستاره`} onClick={() => onChange(n)}><Star className={`${size} ${n <= value ? 'fill-flame text-flame' : 'text-line-strong'}`} /></button>
        : <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-flame text-flame' : 'text-line-strong'}`} />)}
    </span>
  );
}

/** امتیاز دوره: پس از سه درس یا پایان دوره */
export function CourseRating({ slug, mine, canRate }: { slug: string; mine: { stars: number; comment: string | null } | null; canRate: boolean }) {
  const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState({ stars: mine?.stars ?? 0, comment: mine?.comment ?? '' });
  const [edit, setEdit] = useState(!mine);
  const m = useMutation({ mutationFn: () => api(`/courses/${slug}/rating`, { body: { stars: f.stars, comment: f.comment || undefined } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course', slug] }); setEdit(false); toast('ممنون؛ امتیازتان ثبت شد'); }, onError: (e) => toast((e as Error).message, 'err') });
  if (!canRate) return null;
  return (
    <section className="card grid gap-3 p-5" aria-label="امتیاز شما به دوره">
      <h2 className="font-extrabold">نظر شما دربارهٔ این دوره</h2>
      {edit ? <>
        <Stars value={f.stars} onChange={(n) => setF({ ...f, stars: n })} size="size-8" />
        <textarea className="input min-h-20" maxLength={2000} placeholder="چه چیزی خوب بود؟ چه چیزی را بهتر کنیم؟ (اختیاری)" value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} aria-label="نظر" />
        <p className="hint">نظرتان بی‌نام به تیم محتوا می‌رسد.</p>
        <button className="btn btn-primary w-fit" disabled={!f.stars || m.isPending} onClick={() => m.mutate()}>ثبت</button>
      </> : <div className="flex flex-wrap items-center gap-3"><Stars value={f.stars} /><button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>تغییر</button></div>}
    </section>
  );
}
