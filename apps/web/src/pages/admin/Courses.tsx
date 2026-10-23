import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Lock, Plus, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { CourseIcon, Dialog, Empty, ErrorBox, Spinner, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { ago, fa, STATUS_LABEL } from '../../lib/fa';
import { PageHead } from './AdminShell';

export interface AdminCourse {
  id: string; slug: string; title: string; subtitle: string | null; status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'; color: string; icon: string;
  isRestricted: boolean; updatedAt: string; lessonCount: number; learnerCount: number; completedCount: number; version: number;
}

export const STATUS_CHIP: Record<string, string> = { DRAFT: 'chip', REVIEW: 'chip chip-flame', PUBLISHED: 'chip chip-leaf', ARCHIVED: 'chip' };

export default function Courses() {
  const q = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<AdminCourse[]>('/admin/courses') });
  const [st, setSt] = useState<string>('all');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const list = useMemo(() => (q.data ?? []).filter((c) => (st === 'all' || c.status === st) && (!term.trim() || c.title.includes(term.trim()))), [q.data, st, term]);
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const count = (k: string) => (q.data ?? []).filter((c) => c.status === k).length;
  return (
    <div className="rise">
      <PageHead title="دوره‌ها" desc="دوره بسازید، درس‌ها را بچینید و پس از بازبینی منتشر کنید. دورهٔ منتشرشده برای کنشگران دیده می‌شود.">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="size-4" />دورهٔ تازه</button>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="seg" role="group">{[['all', 'همه', q.data?.length ?? 0], ...Object.entries(STATUS_LABEL).map(([k, t]) => [k, t, count(k)])].map(([k, t, n]) => <button key={k as string} aria-pressed={st === k} onClick={() => setSt(k as string)}>{t} <span className="tnum text-muted">{fa(n as number)}</span></button>)}</div>
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="input h-10 pe-9" placeholder="جست‌وجو" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="جست‌وجوی دوره" /></div>
      </div>
      {list.length ? (
        <div className="card overflow-hidden">
          <ul>{list.map((c) => (
            <li key={c.id} className="border-b border-line last:border-0">
              <Link to={`/admin/courses/${c.id}`} className={`tint-${c.color} flex flex-wrap items-center gap-4 px-4 py-3 no-underline hover:bg-sunken`}>
                <span className="cover grid size-11 shrink-0 place-items-center rounded-xl"><CourseIcon name={c.icon} className="size-5" /></span>
                <span className="min-w-0 flex-1"><b className="block text-ink">{c.title}</b><span className="text-xs text-muted">{fa(c.lessonCount)} درس · ویرایش {ago(c.updatedAt)}{c.version > 1 ? ` · نسخهٔ ${fa(c.version)}` : ''}</span></span>
                {c.isRestricted && <span className="chip chip-dome"><Lock className="size-3.5" />ویژهٔ مشترکان</span>}
                <span className="tnum text-sm text-muted">{fa(c.learnerCount)} یادگیرنده · {fa(c.completedCount)} تکمیل</span>
                <span className={STATUS_CHIP[c.status]}>{STATUS_LABEL[c.status]}</span>
              </Link>
            </li>
          ))}</ul>
        </div>
      ) : <Empty icon={BookOpen} title="دوره‌ای نیست">{st === 'all' ? 'اولین دوره را بسازید.' : 'در این وضعیت دوره‌ای نیست.'}</Empty>}
      <NewCourse open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewCourse({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api<{ id: string }>('/admin/courses', { body: { title } }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['admin-courses'] }); toast('دوره ساخته شد؛ حالا درس‌هایش را اضافه کنید'); nav(`/admin/courses/${c.id}`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); if (title.trim().length >= 3) m.mutate(); };
  return (
    <Dialog open={open} onClose={onClose} title="دورهٔ تازه">
      <form onSubmit={submit} className="grid gap-4">
        <div className="field"><label htmlFor="nt">عنوان دوره</label><input id="nt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً اردوداری" autoFocus /><span className="hint">بعداً همه‌چیز قابل ویرایش است.</span></div>
        <div className="flex gap-2"><button className="btn btn-primary" disabled={title.trim().length < 3 || m.isPending}>ساخت دوره</button><button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button></div>
      </form>
    </Dialog>
  );
}
