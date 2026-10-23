import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, MessageSquarePlus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { FB_KIND, FB_STATUS, Stars } from '../../components/Feedback';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { ago, fa } from '../../lib/fa';
import { PageHead } from './AdminShell';

/** صندوق بازخورد و کیفیت محتوا (ستاد) */
interface Fb { id: string; kind: string; mood: number | null; body: string; path: string | null; device: string | null; imageKey: string | null; status: string; tags: string[]; reply: string | null; createdAt: string; from: string | null; course: string | null; lesson: string | null }
interface Stats { byKind: Record<string, number>; byStatus: Record<string, number>; mood: { avg: number | null; n: number }; pages: { path: string; n: number; bugs: number }[] }
const MOODS = ['😞', '🙁', '😐', '🙂', '😍'];

export default function FeedbackAdmin() {
  const [tab, setTab] = useState<'inbox' | 'quality'>('inbox');
  return (
    <div className="rise">
      <PageHead title="بازخورد" desc="هر کاربر از هر صفحه می‌تواند مشکل، پیشنهاد یا نظر محتوایی بفرستد. با پاسخ یا تغییر وضعیت، فرستنده با اعلان خبردار می‌شود. «بی‌نام»ها نام ندارند." />
      <div className="seg mb-5">{([['inbox', 'صندوق'], ['quality', 'کیفیت محتوا']] as const).map(([k, t]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}</div>
      {tab === 'inbox' ? <Inbox /> : <Quality />}
    </div>
  );
}

function Inbox() {
  const [st, setSt] = useState('NEW');
  const [kind, setKind] = useState('');
  const q = useQuery({ queryKey: ['admin-feedback', st, kind], queryFn: () => api<Fb[]>(`/admin/feedback?${st ? `status=${st}` : ''}${kind ? `&kind=${kind}` : ''}`) });
  const s = useQuery({ queryKey: ['admin-feedback-stats'], queryFn: () => api<Stats>('/admin/feedback/stats') });
  const [open, setOpen] = useState<Fb | null>(null);
  return (
    <div className="grid gap-4">
      {s.data && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4"><span className="text-sm text-muted">تازه</span><b className="tnum block text-2xl text-ink">{fa(s.data.byStatus.NEW ?? 0)}</b></div>
        <div className="card p-4"><span className="text-sm text-muted">مشکل در ۳۰ روز</span><b className="tnum block text-2xl text-ink">{fa(s.data.byKind.BUG ?? 0)}</b></div>
        <div className="card p-4"><span className="text-sm text-muted">پیشنهاد در ۳۰ روز</span><b className="tnum block text-2xl text-ink">{fa(s.data.byKind.IDEA ?? 0)}</b></div>
        <div className="card p-4"><span className="text-sm text-muted">حس کلی ({fa(s.data.mood.n)} نفر)</span><b className="tnum block text-2xl text-ink">{s.data.mood.avg != null ? `${MOODS[Math.round(s.data.mood.avg) - 1]} ${fa(String(s.data.mood.avg).replace('.', '٫'))}` : '—'}</b></div>
      </div>}
      {!!s.data?.pages.length && <details className="card p-4"><summary className="cursor-pointer font-bold text-ink">صفحه‌هایی که بیشترین بازخورد را داشته‌اند</summary>
        <ul className="mt-2 grid gap-1 text-sm">{s.data.pages.map((p) => <li key={p.path} className="flex justify-between gap-3"><span dir="ltr" className="truncate">{p.path}</span><span className="text-muted">{fa(p.n)}{p.bugs ? ` · ${fa(p.bugs)} مشکل` : ''}</span></li>)}</ul></details>}
      <div className="flex flex-wrap gap-2">
        <div className="seg">{[['NEW', 'تازه'], ['REVIEWING', 'در حال بررسی'], ['PLANNED', 'در برنامه'], ['DONE', 'انجام شد'], ['DECLINED', 'فعلاً نه'], ['', 'همه']].map(([k, t]) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{t}</button>)}</div>
        <select className="input h-10" style={{ width: 'auto' }} aria-label="نوع" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">همهٔ نوع‌ها</option>{Object.entries(FB_KIND).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}</select>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data?.length ? (
        <ul className="grid gap-2">{q.data.map((f) => { const K = FB_KIND[f.kind]; return (
          <li key={f.id}><button className="card flex w-full items-start gap-3 p-4 text-start hover:border-line-strong" onClick={() => setOpen(f)}>
            <K.i className="mt-1 size-5 shrink-0 text-leaf" />
            <span className="min-w-0 flex-1"><span className="line-clamp-2 text-ink">{f.body}</span>
              <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted"><span>{f.from ?? 'بی‌نام'}</span>{f.course && <span>{f.course}{f.lesson ? ` › ${f.lesson}` : ''}</span>}{!f.course && f.path && <span dir="ltr">{f.path}</span>}<span>{ago(f.createdAt)}</span>{f.imageKey && <ImageIcon className="size-3.5" aria-label="عکس دارد" />}</span></span>
            {f.mood && <span className="text-xl" aria-label={`حس ${fa(f.mood)} از ۵`}>{MOODS[f.mood - 1]}</span>}
            <span className={`chip ${FB_STATUS[f.status][0]}`}>{FB_STATUS[f.status][1]}</span>
          </button></li>); })}</ul>
      ) : <Empty icon={MessageSquarePlus} title="موردی نیست" />}
      {open && <Triage f={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Triage({ f, onClose }: { f: Fb; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const [v, setV] = useState({ status: f.status, tags: f.tags.join('، '), reply: f.reply ?? '' });
  const m = useMutation({ mutationFn: () => api(`/admin/feedback/${f.id}`, { method: 'PATCH', body: { status: v.status, tags: v.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean), reply: v.reply } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-feedback'] }); qc.invalidateQueries({ queryKey: ['admin-feedback-stats'] }); toast(v.reply && v.reply !== f.reply ? 'ثبت شد؛ پاسخ برای فرستنده رفت' : 'ثبت شد'); onClose(); },
    onError: (e) => toast((e as Error).message, 'err') });
  return (
    <Dialog open onClose={onClose} title={FB_KIND[f.kind].t} wide>
      <div className="grid gap-4">
        <div className="grid gap-1 text-sm text-muted"><span>از: <b className="text-ink">{f.from ?? 'بی‌نام'}</b> · {ago(f.createdAt)}</span>
          {f.path && <span>صفحه: <span dir="ltr">{f.path}</span>{f.course ? ` (${f.course}${f.lesson ? ` › ${f.lesson}` : ''})` : ''}</span>}
          {f.device && <span>دستگاه: <span dir="ltr">{f.device}</span></span>}</div>
        <p className="whitespace-pre-wrap rounded-2xl bg-sunken p-4 leading-8 text-ink">{f.body}</p>
        {f.imageKey && <a href={`/api/files/${f.imageKey}`} target="_blank" rel="noreferrer"><img src={`/api/files/${f.imageKey}`} alt="عکس صفحه" className="max-h-64 rounded-xl border border-line" /></a>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field"><label htmlFor="ts">وضعیت</label><select id="ts" className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{Object.entries(FB_STATUS).map(([k, [, t]]) => <option key={k} value={k}>{t}</option>)}</select></div>
          <div className="field"><label htmlFor="tt">برچسب‌ها <span className="font-normal text-muted">(با ویرگول)</span></label><input id="tt" className="input" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="گوشی، آزمون" /></div>
        </div>
        <div className="field"><label htmlFor="tr">پاسخ به فرستنده <span className="font-normal text-muted">(اختیاری؛ با اعلان می‌رسد)</span></label><textarea id="tr" className="input min-h-24" maxLength={2000} value={v.reply} onChange={(e) => setV({ ...v, reply: e.target.value })} /></div>
        <div className="flex gap-2"><button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>ثبت</button><button className="btn btn-ghost" onClick={onClose}>انصراف</button></div>
      </div>
    </Dialog>
  );
}

interface Quality { courses: { id: string; title: string; avg: number | null; n: number; learners: number }[]; lessons: { id: string; title: string; course: string; up: number; down: number; reasons: { reason: string; n: number }[] }[]; comments: { kind: string; title: string; comment: string; score: number; at: string }[] }
function Quality() {
  const q = useQuery({ queryKey: ['content-quality'], queryFn: () => api<Quality>('/admin/content-quality') });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  return (
    <div className="grid gap-6">
      <section className="grid gap-3"><h2 className="text-base font-extrabold">امتیاز دوره‌ها</h2>
        <div className="card overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="bg-sunken text-xs text-muted"><tr>{['دوره', 'امتیاز', 'شمار امتیاز', 'یادگیرنده'].map((h) => <th key={h} className="px-4 py-2.5 text-start">{h}</th>)}</tr></thead>
          <tbody>{d.courses.map((c) => <tr key={c.id} className="border-t border-line"><td className="px-4 py-2.5 text-ink">{c.title}</td><td className="px-4 py-2.5">{c.avg != null ? <span className="flex items-center gap-2"><Stars value={c.avg} size="size-4" />{fa(String(c.avg).replace('.', '٫'))}</span> : <span className="text-muted">—</span>}</td><td className="tnum px-4 py-2.5">{fa(c.n)}</td><td className="tnum px-4 py-2.5">{fa(c.learners)}</td></tr>)}</tbody></table></div>
        <p className="hint">امتیاز در صفحهٔ دوره از ۵ امتیاز به بالا به کاربران نشان داده می‌شود.</p></section>
      <section className="grid gap-3"><h2 className="text-base font-extrabold">درس‌هایی که بیشتر «به کارم نیامد» گرفته‌اند</h2>
        {d.lessons.length ? <ul className="grid gap-2">{d.lessons.map((l) => (
          <li key={l.id} className="card flex flex-wrap items-center gap-3 p-4"><span className="min-w-0 flex-1"><b className="block text-ink">{l.title}</b><span className="text-xs text-muted">{l.course}</span></span>
            <span className="flex items-center gap-1 text-sm text-leaf-ink"><ThumbsUp className="size-4" />{fa(l.up)}</span><span className="flex items-center gap-1 text-sm text-rose"><ThumbsDown className="size-4" />{fa(l.down)}</span>
            <span className="flex w-full flex-wrap gap-1.5">{l.reasons.map((r) => <span key={r.reason} className="chip">{r.reason} · {fa(r.n)}</span>)}</span></li>))}</ul>
          : <Empty icon={ThumbsUp} title="هنوز امتیازی ثبت نشده" />}</section>
      <section className="grid gap-3"><h2 className="text-base font-extrabold">تازه‌ترین نظرها <span className="text-sm font-normal text-muted">(بی‌نام)</span></h2>
        {d.comments.length ? <ul className="grid gap-2">{d.comments.map((c, i) => (
          <li key={i} className="card grid gap-1 p-4"><span className="flex flex-wrap items-center gap-2 text-xs text-muted">{c.kind === 'course' ? <Stars value={c.score} size="size-3.5" /> : c.score ? <ThumbsUp className="size-3.5 text-leaf" /> : <ThumbsDown className="size-3.5 text-rose" />}{c.title} · {ago(c.at)}</span><p className="text-body">{c.comment}</p></li>))}</ul>
          : <Empty icon={MessageSquarePlus} title="هنوز نظری نیست" />}</section>
    </div>
  );
}
