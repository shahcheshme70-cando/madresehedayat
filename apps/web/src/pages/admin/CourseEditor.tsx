import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CircleAlert, ExternalLink, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CourseIcon, Dialog, ErrorBox, ICONS, LESSON_ICON, Spinner, useToast } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useTools } from '../Tools';
import { fa, jDate, LESSON_LABEL, minutes, STATUS_LABEL } from '../../lib/fa';
import type { LessonType } from '../../lib/types';
import type { AdminCourse } from './Courses';
import { STATUS_CHIP } from './Courses';

interface ALesson { id: string; title: string; type: LessonType; order: number; durationSec: number; required: boolean; isFinalQuiz: boolean; content: any }
interface FullCourse extends AdminCourse {
  about: string | null; level: string | null; instructor: string | null; passScore: number; missionRule: 'ON_SUBMIT' | 'ON_APPROVAL';
  hasCertificate: boolean; outcomes: string[];
  modules: { id: string; title: string; order: number; lessons: ALesson[] }[];
  dependencies: { requiresId: string; kind: 'PREREQUISITE' | 'COREQUISITE'; title: string }[];
}

const COLORS = [['green', 'سبز'], ['dome', 'فیروزه‌ای'], ['deep', 'آبی'], ['flame', 'زرد'], ['rose', 'سرخ']];
const TYPES: LessonType[] = ['TEXT', 'VIDEO', 'AUDIO', 'QUIZ', 'WORKSHEET', 'MISSION', 'TOOL', 'LIVE'];

export default function CourseEditor() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin-course', id], queryFn: () => api<FullCourse>(`/admin/courses/${id}`) });
  const [editLesson, setEditLesson] = useState<ALesson | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const inval = () => { qc.invalidateQueries({ queryKey: ['admin-course', id] }); qc.invalidateQueries({ queryKey: ['admin-courses'] }); };
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/admin/courses/${id}`, { method: 'PATCH', body }),
    onSuccess: (_r, v) => { inval(); setProblems([]); toast(v.status ? `وضعیت: ${STATUS_LABEL[v.status as string]}` : 'ذخیره شد'); },
    onError: (e) => { const a = e as ApiError; if (a.data?.problems) setProblems(a.data.problems); toast(a.message, 'err'); },
  });
  const del = useMutation({
    mutationFn: () => api(`/admin/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-courses'] }); toast('دوره حذف شد'); nav('/admin/courses'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data!;

  return (
    <div className="rise grid gap-6">
      <nav className="text-sm text-muted"><Link to="/admin/courses" className="text-leaf-ink">دوره‌ها</Link> / {c.title}</nav>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-[clamp(22px,2.6vw,28px)] font-extrabold">{c.title}</h1>
        <span className={STATUS_CHIP[c.status]}>{STATUS_LABEL[c.status]}</span>
        {c.status === 'PUBLISHED' && <Link to={`/courses/${c.slug}`} className="btn btn-ghost btn-sm" target="_blank"><ExternalLink className="size-4" />دیدن در مدرسه</Link>}
        {c.status === 'DRAFT' && <button className="btn btn-secondary btn-sm" onClick={() => patch.mutate({ status: 'REVIEW' })}>فرستادن برای بازبینی</button>}
        {(c.status === 'DRAFT' || c.status === 'REVIEW') && <button className="btn btn-primary btn-sm" onClick={() => patch.mutate({ status: 'PUBLISHED' })}>انتشار</button>}
        {c.status === 'REVIEW' && <button className="btn btn-ghost btn-sm" onClick={() => patch.mutate({ status: 'DRAFT' })}>برگرداندن به پیش‌نویس</button>}
        {c.status === 'PUBLISHED' && <button className="btn btn-secondary btn-sm" onClick={() => patch.mutate({ status: 'PUBLISHED', bumpVersion: true })}>انتشار نسخهٔ تازه</button>}
        {c.status === 'PUBLISHED' && <button className="btn btn-ghost btn-sm" onClick={() => patch.mutate({ status: 'ARCHIVED' })}>بایگانی</button>}
        {c.status === 'ARCHIVED' && <button className="btn btn-secondary btn-sm" onClick={() => patch.mutate({ status: 'PUBLISHED' })}>انتشار دوباره</button>}
      </header>
      {problems.length > 0 && (
        <div className="rounded-2xl bg-rose-soft p-4 text-sm text-rose"><b className="flex items-center gap-2"><CircleAlert className="size-4" />پیش از انتشار این‌ها را درست کنید:</b>
          <ul className="mt-2 list-disc ps-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>
      )}
      {c.status === 'PUBLISHED' && <p className="rounded-2xl bg-sunken p-3 text-sm text-muted">این دوره منتشر شده است. اصلاحات جزئی به همه می‌رسد؛ برای تغییر اساسی «انتشار نسخهٔ تازه» را بزنید تا یادگیرنده‌های فعلی روی نسخهٔ قبلی بمانند.</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Outline c={c} onEdit={setEditLesson} inval={inval} />
        <div className="grid content-start gap-6">
          <MetaForm c={c} save={(b) => patch.mutate(b)} saving={patch.isPending} />
          <Dependencies c={c} inval={inval} />
          <button className="btn btn-ghost btn-sm w-fit text-rose" onClick={() => { if (window.confirm('این دوره حذف شود؟')) del.mutate(); }}><Trash2 className="size-4" />حذف دوره</button>
        </div>
      </div>
      <Dialog open={!!editLesson} onClose={() => setEditLesson(null)} title={editLesson ? `${LESSON_LABEL[editLesson.type]}: ${editLesson.title}` : ''} wide>
        {editLesson && <LessonEditor key={editLesson.id} l={editLesson} onSaved={() => { inval(); setEditLesson(null); }} />}
      </Dialog>
    </div>
  );
}

function MetaForm({ c, save, saving }: { c: FullCourse; save: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [f, setF] = useState({ title: c.title, subtitle: c.subtitle ?? '', about: c.about ?? '', level: c.level ?? '', instructor: c.instructor ?? '', color: c.color, icon: c.icon,
    passScore: c.passScore, missionRule: c.missionRule, hasCertificate: c.hasCertificate, isRestricted: c.isRestricted, outcomes: c.outcomes.join('\n') });
  const s = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <section className="card grid gap-4 p-5">
      <h2 className="text-base font-extrabold">مشخصات دوره</h2>
      <div className="field"><label htmlFor="t">عنوان</label><input id="t" className="input" value={f.title} onChange={(e) => s('title', e.target.value)} /></div>
      <div className="field"><label htmlFor="st">زیرعنوان</label><input id="st" className="input" value={f.subtitle} onChange={(e) => s('subtitle', e.target.value)} placeholder="یک جمله دربارهٔ اینکه دوره چه می‌دهد" /></div>
      <div className="field"><label htmlFor="ab">توضیح</label><textarea id="ab" className="input" value={f.about} onChange={(e) => s('about', e.target.value)} /></div>
      <div className="field"><label htmlFor="oc">پس از این دوره… <span className="font-normal text-muted">(هر خط یک مورد)</span></label><textarea id="oc" className="input" value={f.outcomes} onChange={(e) => s('outcomes', e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field"><label htmlFor="lv">سطح</label><input id="lv" className="input" value={f.level} onChange={(e) => s('level', e.target.value)} placeholder="مقدماتی، میانه…" /></div>
        <div className="field"><label htmlFor="in">مدرس</label><input id="in" className="input" value={f.instructor} onChange={(e) => s('instructor', e.target.value)} /></div>
        <div className="field"><label htmlFor="ps">حد قبولی آزمون (٪)</label><input id="ps" className="input tnum" type="number" min={0} max={100} value={f.passScore} onChange={(e) => s('passScore', Number(e.target.value))} /></div>
        <div className="field"><label htmlFor="mr">تکمیل مأموریت</label><select id="mr" className="input" value={f.missionRule} onChange={(e) => s('missionRule', e.target.value)}><option value="ON_SUBMIT">با فرستادن گزارش</option><option value="ON_APPROVAL">با تأیید راهیار</option></select></div>
      </div>
      <div className="field"><span className="text-sm font-bold text-ink">رنگ و نماد</span>
        <div className="flex flex-wrap gap-2">{COLORS.map(([k, t]) => <button key={k} type="button" className={`tint-${k} chip cover ${f.color === k ? 'ring-2 ring-ink' : ''}`} onClick={() => s('color', k)}>{t}</button>)}</div>
        <div className="flex flex-wrap gap-2">{Object.keys(ICONS).map((k) => <button key={k} type="button" aria-label={k} className={`grid size-10 place-items-center rounded-xl border ${f.icon === k ? 'border-leaf bg-leaf-soft text-leaf-ink' : 'border-line'}`} onClick={() => s('icon', k)}><CourseIcon name={k} className="size-5" /></button>)}</div>
      </div>
      <label className="flex items-center gap-3"><input type="checkbox" className="size-5" checked={f.hasCertificate} onChange={(e) => s('hasCertificate', e.target.checked)} />گواهی دارد (آزمون پایانی لازم است)</label>
      <label className="flex items-center gap-3"><input type="checkbox" className="size-5" checked={f.isRestricted} onChange={(e) => s('isRestricted', e.target.checked)} />فقط برای مشترکان (با دسترسی ویژه)</label>
      <div><button className="btn btn-primary" disabled={saving} onClick={() => save({ ...f, outcomes: f.outcomes.split('\n').map((x) => x.trim()).filter(Boolean) })}>ذخیرهٔ مشخصات</button></div>
    </section>
  );
}

function Dependencies({ c, inval }: { c: FullCourse; inval: () => void }) {
  const all = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<AdminCourse[]>('/admin/courses') });
  const [deps, setDeps] = useState(c.dependencies.map((d) => ({ requiresId: d.requiresId, kind: d.kind })));
  const [pick, setPick] = useState('');
  const toast = useToast();
  useEffect(() => setDeps(c.dependencies.map((d) => ({ requiresId: d.requiresId, kind: d.kind }))), [c.dependencies]);
  const save = useMutation({
    mutationFn: () => api(`/admin/courses/${c.id}/dependencies`, { method: 'PUT', body: { deps } }),
    onSuccess: () => { inval(); toast('پیش‌نیازها ذخیره شد'); }, onError: (e) => toast((e as Error).message, 'err'),
  });
  const others = (all.data ?? []).filter((x) => x.id !== c.id && !deps.some((d) => d.requiresId === x.id));
  const title = (id: string) => all.data?.find((x) => x.id === id)?.title ?? '…';
  return (
    <section className="card grid gap-3 p-5">
      <h2 className="text-base font-extrabold">پیش‌نیاز و هم‌نیاز</h2>
      <p className="text-sm text-muted">پیش‌نیاز: تا تمام نشود، ثبت‌نام بسته است. هم‌نیاز: هم‌زمان ثبت‌نام می‌شود و گواهی پس از تمام شدن هر دو صادر می‌شود.</p>
      <ul className="grid gap-2">{deps.map((d, i) => (
        <li key={d.requiresId} className="flex items-center gap-2 rounded-xl border border-line p-2">
          <span className="flex-1 text-sm font-semibold text-ink">{title(d.requiresId)}</span>
          <select className="input h-9 w-auto text-sm" value={d.kind} onChange={(e) => setDeps((x) => x.map((y, j) => j === i ? { ...y, kind: e.target.value as any } : y))}><option value="PREREQUISITE">پیش‌نیاز</option><option value="COREQUISITE">هم‌نیاز</option></select>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeps((x) => x.filter((_, j) => j !== i))} aria-label="برداشتن"><X className="size-4" /></button>
        </li>
      ))}</ul>
      <div className="flex gap-2"><select className="input h-10 flex-1" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">افزودن دوره…</option>{others.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select>
        <button className="btn btn-secondary btn-sm h-10" disabled={!pick} onClick={() => { setDeps((x) => [...x, { requiresId: pick, kind: 'PREREQUISITE' }]); setPick(''); }}><Plus className="size-4" /></button></div>
      <div><button className="btn btn-primary btn-sm" onClick={() => save.mutate()} disabled={save.isPending}>ذخیره</button></div>
    </section>
  );
}

function Outline({ c, onEdit, inval }: { c: FullCourse; onEdit: (l: ALesson) => void; inval: () => void }) {
  const toast = useToast();
  const [adding, setAdding] = useState<string | null>(null);
  const [nl, setNl] = useState<{ title: string; type: LessonType }>({ title: '', type: 'TEXT' });
  const call = (p: Promise<unknown>, ok?: string) => p.then(() => { inval(); if (ok) toast(ok); }).catch((e) => toast((e as Error).message, 'err'));
  const order = (mods: FullCourse['modules']) => call(api(`/admin/courses/${c.id}/order`, { method: 'PUT', body: { modules: mods.map((m) => ({ id: m.id, lessons: m.lessons.map((l) => l.id) })) } }));
  const moveLesson = (mi: number, li: number, d: -1 | 1) => {
    const mods = c.modules.map((m) => ({ ...m, lessons: [...m.lessons] }));
    const ls = mods[mi].lessons; const j = li + d;
    if (j >= 0 && j < ls.length) { [ls[li], ls[j]] = [ls[j], ls[li]]; }
    else if (j < 0 && mi > 0) { mods[mi - 1].lessons.push(ls.splice(li, 1)[0]); }
    else if (j >= ls.length && mi < mods.length - 1) { mods[mi + 1].lessons.unshift(ls.splice(li, 1)[0]); }
    else return;
    order(mods);
  };
  const moveModule = (mi: number, d: -1 | 1) => { const mods = [...c.modules]; const j = mi + d; if (j < 0 || j >= mods.length) return; [mods[mi], mods[j]] = [mods[j], mods[mi]]; order(mods); };
  return (
    <section className="grid content-start gap-4">
      <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">بخش‌ها و درس‌ها</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => call(api(`/admin/courses/${c.id}/modules`, { body: { title: `بخش ${fa(c.modules.length + 1)}` } }), 'بخش تازه اضافه شد')}><Plus className="size-4" />بخش تازه</button></div>
      {c.modules.map((m, mi) => (
        <div key={m.id} className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-2.5">
            <span className="text-xs text-muted">بخش {fa(mi + 1)}</span>
            <b className="flex-1 text-ink">{m.title}</b>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="تغییر نام بخش" onClick={() => { const t = window.prompt('نام تازهٔ بخش', m.title); if (t?.trim()) call(api(`/admin/modules/${m.id}`, { method: 'PATCH', body: { title: t.trim() } })); }}><Pencil className="size-4" /></button>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="بالا" onClick={() => moveModule(mi, -1)} disabled={mi === 0}><ArrowUp className="size-4" /></button>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="پایین" onClick={() => moveModule(mi, 1)} disabled={mi === c.modules.length - 1}><ArrowDown className="size-4" /></button>
            {!m.lessons.length && <button className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف بخش" onClick={() => call(api(`/admin/modules/${m.id}`, { method: 'DELETE' }), 'بخش حذف شد')}><Trash2 className="size-4" /></button>}
          </div>
          <ul>{m.lessons.map((l, li) => { const I = LESSON_ICON[l.type]; return (
            <li key={l.id} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0">
              <I className="size-4 shrink-0 text-muted" />
              <button className="min-w-0 flex-1 text-start" onClick={() => onEdit(l)}><span className="block truncate font-semibold text-ink">{l.title}</span>
                <span className="text-xs text-muted">{LESSON_LABEL[l.type]}{l.durationSec ? ` · ${minutes(l.durationSec)}` : ''}{!l.required ? ' · اختیاری' : ''}{l.isFinalQuiz ? ' · آزمون پایانی' : ''}</span></button>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="بالا" onClick={() => moveLesson(mi, li, -1)}><ArrowUp className="size-4" /></button>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="پایین" onClick={() => moveLesson(mi, li, 1)}><ArrowDown className="size-4" /></button>
              <button className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف درس" onClick={() => { if (window.confirm(`درس «${l.title}» حذف شود؟`)) call(api(`/admin/lessons/${l.id}`, { method: 'DELETE' }), 'درس حذف شد'); }}><Trash2 className="size-4" /></button>
            </li>
          ); })}</ul>
          {adding === m.id ? (
            <form className="flex flex-wrap gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (nl.title.trim()) call(api(`/admin/modules/${m.id}/lessons`, { body: nl }), 'درس اضافه شد').then(() => { setAdding(null); setNl({ title: '', type: 'TEXT' }); }); }}>
              <input className="input h-10 min-w-0 flex-1" placeholder="عنوان درس" value={nl.title} onChange={(e) => setNl({ ...nl, title: e.target.value })} autoFocus />
              <select className="input h-10 w-auto" value={nl.type} onChange={(e) => setNl({ ...nl, type: e.target.value as LessonType })}>{TYPES.map((t) => <option key={t} value={t}>{LESSON_LABEL[t]}</option>)}</select>
              <button className="btn btn-primary btn-sm h-10">افزودن</button><button type="button" className="btn btn-ghost btn-sm h-10" onClick={() => setAdding(null)}>انصراف</button>
            </form>
          ) : <button className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-sm font-semibold text-leaf-ink hover:bg-sunken" onClick={() => setAdding(m.id)}><Plus className="size-4" />درس تازه در این بخش</button>}
        </div>
      ))}
    </section>
  );
}

/* ───────── ویرایشگر درس ───────── */

const aparatHash = (v: string) => { const m = v.trim().match(/aparat\.com\/v\/([A-Za-z0-9]+)/) ?? v.trim().match(/videohash\/([A-Za-z0-9]+)/); return m ? m[1] : v.trim(); };
const rid = () => Math.random().toString(36).slice(2, 8);

function LessonEditor({ l, onSaved }: { l: ALesson; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(l.title);
  const [mins, setMins] = useState(Math.round(l.durationSec / 60));
  const [required, setRequired] = useState(l.required);
  const [isFinal, setIsFinal] = useState(l.isFinalQuiz);
  const [content, setContent] = useState<any>(l.content ?? {});
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api<{ problem: string | null }>(`/admin/lessons/${l.id}`, { method: 'PATCH', body: { title, durationSec: mins * 60, required, isFinalQuiz: isFinal, content } }),
    onSuccess: (r) => { if (r.problem) { setProblem(r.problem); toast('ذخیره شد، ولی هنوز کامل نیست', 'err'); } else { toast('درس ذخیره شد'); onSaved(); } },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
        <div className="field"><label htmlFor="lt">عنوان درس</label><input id="lt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label htmlFor="lm">مدت (دقیقه)</label><input id="lm" type="number" min={0} className="input tnum" value={mins} onChange={(e) => setMins(Number(e.target.value))} /></div>
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={required} onChange={(e) => setRequired(e.target.checked)} />برای تکمیل دوره لازم است</label>
        {l.type === 'QUIZ' && <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} />آزمون پایانی دوره</label>}
      </div>
      <ContentEditor type={l.type} c={content} set={setContent} />
      {problem && <p className="err"><CircleAlert className="size-4" />{problem}</p>}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-2 border-t border-line bg-card px-6 py-4"><button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ درس'}</button></div>
    </div>
  );
}

function Uploader({ accept, onDone, label }: { accept: string; onDone: (key: string, name: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <label className={`btn btn-secondary w-fit ${busy ? 'opacity-60' : ''}`}>
      <Upload className="size-4" />{busy ? 'در حال بارگذاری…' : label}
      <input type="file" accept={accept} className="sr-only" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true);
        try { const fd = new FormData(); fd.append('file', f); const r = await api<{ key: string; name: string }>('/admin/uploads', { form: fd }); onDone(r.key, r.name); toast('فایل بارگذاری شد'); }
        catch (er) { toast((er as Error).message, 'err'); } finally { setBusy(false); e.target.value = ''; }
      }} />
    </label>
  );
}

function ContentEditor({ type, c, set }: { type: LessonType; c: any; set: (c: any) => void }) {
  switch (type) {
    case 'TEXT': return (
      <>
        <div className="field"><label htmlFor="body">متن درس <span className="font-normal text-muted">(بین بندها یک خط خالی)</span></label><textarea id="body" className="input min-h-64" value={c.body ?? ''} onChange={(e) => set({ ...c, body: e.target.value })} /></div>
        <div className="field"><label htmlFor="kp">نکته‌های کلیدی <span className="font-normal text-muted">(هر خط یکی؛ اختیاری)</span></label><textarea id="kp" className="input" value={(c.keyPoints ?? []).join('\n')} onChange={(e) => set({ ...c, keyPoints: e.target.value.split('\n').filter((x) => x.trim()) })} /></div>
      </>
    );
    case 'VIDEO': return (
      <div className="grid gap-4">
        <div className="seg w-fit">{[['aparat', 'آپارات'], ['file', 'فایل روی سرور مدرسه']].map(([k, t]) => <button type="button" key={k} aria-pressed={c.provider === k} onClick={() => set({ ...c, provider: k })}>{t}</button>)}</div>
        {c.provider === 'file'
          ? <div className="grid gap-2"><Uploader accept="video/mp4,video/webm" label="بارگذاری ویدیو" onDone={(key) => set({ ...c, fileKey: key })} />{c.fileKey && <span className="hint">فایل: {c.fileKey}</span>}<p className="hint">ویدیوی روی سرور مدرسه جای پخش را ذخیره می‌کند و با ۹۰٪ دیدن، درس خودکار تمام می‌شود.</p></div>
          : <div className="field"><label htmlFor="ap">پیوند ویدیو در آپارات</label><input id="ap" className="input ltr" placeholder="https://www.aparat.com/v/abc123" value={c.aparatHash ?? ''} onChange={(e) => set({ ...c, aparatHash: aparatHash(e.target.value) })} />
              <span className="hint">پیوند صفحهٔ ویدیو را بچسبانید؛ شناسه‌اش خودکار برداشته می‌شود.{c.aparatHash ? ` شناسه: ${c.aparatHash}` : ''}</span>
              <p className="rounded-xl bg-flame-soft p-3 text-sm text-ink"><b className="text-flame-ink">توجه: </b>ویدیوی آپارات پایان خودکار و پرسش وسط ویدیو ندارد؛ کنشگر خودش «دیدم» را می‌زند. برای ویدیوهای کوتاه و کلیدی که دیده شدنشان مهم است، «فایل روی سرور مدرسه» را انتخاب کنید.</p></div>}
        <div className="field"><label htmlFor="sm">خلاصه <span className="font-normal text-muted">(اختیاری)</span></label><textarea id="sm" className="input" value={c.summary ?? ''} onChange={(e) => set({ ...c, summary: e.target.value })} /></div>
      </div>
    );
    case 'AUDIO': return (
      <div className="grid gap-3">
        <Uploader accept="audio/*" label="بارگذاری فایل صوتی" onDone={(key) => set({ ...c, fileKey: key })} />
        {c.fileKey && <audio src={`/api/files/${c.fileKey}`} controls className="w-full" />}
        <div className="field"><label htmlFor="sm">خلاصه <span className="font-normal text-muted">(اختیاری)</span></label><textarea id="sm" className="input" value={c.summary ?? ''} onChange={(e) => set({ ...c, summary: e.target.value })} /></div>
      </div>
    );
    case 'WORKSHEET': return (
      <div className="grid gap-3">
        <div className="field"><label htmlFor="pr">توضیح برگه</label><textarea id="pr" className="input" value={c.prompt ?? ''} onChange={(e) => set({ ...c, prompt: e.target.value })} /></div>
        <b className="text-sm text-ink">خانه‌های برگه</b>
        {(c.fields ?? []).map((f: any, i: number) => (
          <div key={f.id} className="flex gap-2"><input className="input" value={f.label} placeholder="پرسش یا عنوان خانه" onChange={(e) => set({ ...c, fields: c.fields.map((x: any, j: number) => j === i ? { ...x, label: e.target.value } : x) })} />
            <button type="button" className="btn btn-ghost btn-icon" aria-label="حذف" onClick={() => set({ ...c, fields: c.fields.filter((_: any, j: number) => j !== i) })}><X className="size-4" /></button></div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm w-fit" onClick={() => set({ ...c, fields: [...(c.fields ?? []), { id: rid(), label: '' }] })}><Plus className="size-4" />خانهٔ تازه</button>
      </div>
    );
    case 'MISSION': return (
      <div className="grid gap-3">
        <div className="field"><label htmlFor="g">هدف مأموریت</label><textarea id="g" className="input" value={c.goal ?? ''} onChange={(e) => set({ ...c, goal: e.target.value })} /></div>
        <div className="field"><label htmlFor="stp">قدم‌ها <span className="font-normal text-muted">(هر خط یک قدم)</span></label><textarea id="stp" className="input" value={(c.steps ?? []).join('\n')} onChange={(e) => set({ ...c, steps: e.target.value.split('\n').filter((x) => x.trim()) })} /></div>
      </div>
    );
    case 'QUIZ': return <QuizBuilder c={c} set={set} />;
    case 'TOOL': return <ToolPick c={c} set={set} />;
    case 'LIVE': return <LivePick c={c} set={set} />;
    default: return <p className="text-muted">ویرایشگر این نوع درس در مرحلهٔ بعد ساخته می‌شود.</p>;
  }
}

function LivePick({ c, set }: { c: any; set: (c: any) => void }) {
  const evs = useQuery({ queryKey: ['manage-events'], queryFn: () => api<{ id: string; title: string; kind: string; startsAt: string; status: string; useBbb?: boolean }[]>('/manage/events') });
  const online = (evs.data ?? []).filter((e) => e.kind === 'ONLINE' && e.status !== 'CANCELLED');
  return (
    <div className="grid gap-2">
      <div className="field"><label htmlFor="lv">برنامهٔ آنلاین</label>
        <select id="lv" className="input" value={c.eventId ?? ''} onChange={(e) => set({ ...c, eventId: e.target.value })}><option value="">انتخاب کنید</option>
          {online.map((e) => <option key={e.id} value={e.id}>{e.title} — {jDate(e.startsAt)}{e.useBbb ? '' : ' (پیوند بیرونی)'}{e.status === 'DRAFT' ? ' (پیش‌نویس)' : ''}</option>)}</select></div>
      <p className="hint">اول برنامهٔ آنلاین را در «برنامه‌ها» بسازید. یادگیرنده از همین درس ثبت‌نام و وارد کلاس می‌شود؛ با حضور دست‌کم نیمی از زمان یا دیدن ضبط، درس تمام می‌شود. برای سنجش حضور، «کلاس روی سرور مدرسه» را انتخاب کنید.</p>
    </div>
  );
}

function ToolPick({ c, set }: { c: any; set: (c: any) => void }) {
  const tools = useTools(true);
  return (
    <div className="grid gap-2">
      <div className="field"><label htmlFor="tl">ابزار</label>
        <select id="tl" className="input" value={c.toolId ?? ''} onChange={(e) => set({ ...c, toolId: e.target.value })}><option value="">انتخاب کنید</option>
          {tools.data?.categories.map((cat) => <optgroup key={cat.id} label={cat.title}>{tools.data!.tools.filter((t) => t.cat === cat.id).map((t) => <option key={t.id} value={t.id}>{t.t}{t.published ? '' : ' (منتشر نشده)'}</option>)}</optgroup>)}</select></div>
      <p className="hint">کنشگر در این درس یک «کار» تازه از این ابزار پر می‌کند که در «کارهای من» هم می‌ماند؛ با پر کردنش درس تمام می‌شود.</p>
    </div>
  );
}

export function QuizBuilder({ c, set }: { c: any; set: (c: any) => void }) {
  const qs: any[] = c.questions ?? [];
  const up = (i: number, q: any) => set({ ...c, questions: qs.map((x, j) => (j === i ? q : x)) });
  return (
    <div className="grid gap-4">
      {qs.map((q, i) => (
        <div key={q.id} className="rounded-2xl border border-line p-4">
          <div className="mb-2 flex items-center gap-2"><b className="text-ink">پرسش {fa(i + 1)}</b>
            <select className="input ms-auto h-9 w-auto text-sm" value={q.kind} onChange={(e) => up(i, { ...q, kind: e.target.value, correct: e.target.value === 'multi' ? q.correct : q.correct.slice(0, 1) })}><option value="single">تک‌گزینه‌ای</option><option value="multi">چندپاسخی</option><option value="tf">درست / نادرست</option></select>
            <button type="button" className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف پرسش" onClick={() => set({ ...c, questions: qs.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></button></div>
          <textarea className="input min-h-16" placeholder="متن پرسش" value={q.text} onChange={(e) => up(i, { ...q, text: e.target.value })} />
          <div className="mt-3 grid gap-2">
            {q.options.map((o: any, oi: number) => {
              const right = q.correct.includes(o.id);
              return (
                <div key={o.id} className="flex items-center gap-2">
                  <button type="button" aria-pressed={right} title="گزینهٔ درست" onClick={() => up(i, { ...q, correct: q.kind === 'multi' ? (right ? q.correct.filter((x: string) => x !== o.id) : [...q.correct, o.id]) : [o.id] })}
                    className={`grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${right ? 'border-leaf bg-leaf text-white' : 'border-line-strong text-muted'}`}>{right ? '✓' : fa(oi + 1)}</button>
                  <input className="input h-10" value={o.text} placeholder={`گزینهٔ ${fa(oi + 1)}`} onChange={(e) => up(i, { ...q, options: q.options.map((x: any) => x.id === o.id ? { ...x, text: e.target.value } : x) })} readOnly={q.kind === 'tf'} />
                  {q.kind !== 'tf' && q.options.length > 2 && <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="حذف گزینه" onClick={() => up(i, { ...q, options: q.options.filter((x: any) => x.id !== o.id), correct: q.correct.filter((x: string) => x !== o.id) })}><X className="size-4" /></button>}
                </div>
              );
            })}
            {q.kind !== 'tf' && q.options.length < 6 && <button type="button" className="btn btn-ghost btn-sm w-fit" onClick={() => up(i, { ...q, options: [...q.options, { id: rid(), text: '' }] })}><Plus className="size-4" />گزینهٔ تازه</button>}
          </div>
          <p className="hint mt-1">روی دایرهٔ کنار گزینهٔ درست بزنید.</p>
          <input className="input mt-2 h-10" placeholder="توضیح پس از پاسخ (چرا این گزینه درست است)" value={q.explain ?? ''} onChange={(e) => up(i, { ...q, explain: e.target.value })} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ ...c, questions: [...qs, { id: rid(), kind: 'single', text: '', options: [{ id: rid(), text: '' }, { id: rid(), text: '' }, { id: rid(), text: '' }], correct: [], explain: '' }] })}><Plus className="size-4" />پرسش چندگزینه‌ای</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const t = rid(), f = rid(); set({ ...c, questions: [...qs, { id: rid(), kind: 'tf', text: '', options: [{ id: t, text: 'درست' }, { id: f, text: 'نادرست' }], correct: [], explain: '' }] }); }}><Plus className="size-4" />درست / نادرست</button>
      </div>
    </div>
  );
}
