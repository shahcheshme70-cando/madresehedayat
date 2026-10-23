import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Empty, Spinner, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { ago } from '../../lib/fa';
import { PageHead } from './AdminShell';

/** گزارش‌های نمونه: ستاد فقط گزارش‌هایی را می‌بیند که کنشگر اجازه داده (۳.۵ و ۲.۳) */
interface Sample { learnerId: string; lessonId: string; status: string; named: boolean; text: string; authorLabel: string; createdAt: string; publishedAt: string | null; lessonTitle: string; courseTitle: string }
export function Samples() {
  const qc = useQueryClient();
  const toast = useToast();
  const [st, setSt] = useState('CONSENTED');
  const q = useQuery({ queryKey: ['admin-samples', st], queryFn: () => api<Sample[]>(`/admin/samples?status=${st}`) });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: (v: { s: Sample; publish: boolean }) => api(`/admin/samples/${v.s.learnerId}/${v.s.lessonId}`, { body: { publish: v.publish, text: edit[v.s.learnerId + v.s.lessonId] } }),
    onSuccess: (_r, v) => { qc.invalidateQueries({ queryKey: ['admin-samples'] }); toast(v.publish ? 'منتشر شد' : 'از انتشار برداشته شد'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  return (
    <div className="rise">
      <PageHead title="گزارش‌های نمونه" desc="راهیار پیشنهاد می‌دهد، کنشگر اجازه می‌دهد (با نام یا بی‌نام)، و شما منتشر می‌کنید. متن گزارش‌های دیگر برای ستاد نمایش داده نمی‌شود." />
      <div className="seg mb-4">{[['CONSENTED', 'منتظر انتشار'], ['PUBLISHED', 'منتشرشده']].map(([k, t]) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{t}</button>)}</div>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <ul className="grid gap-3">{q.data.map((s) => { const k = s.learnerId + s.lessonId; return (
          <li key={k} className="card grid gap-3 p-5">
            <div className="text-sm text-muted">{s.courseTitle} · {s.lessonTitle} · {s.authorLabel} · {ago(s.createdAt)}</div>
            <textarea className="input min-h-32 leading-8" value={edit[k] ?? s.text} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} aria-label="متن نمونه" />
            <p className="hint">ویرایش فقط برای اصلاح نگارش یا حذف نام دیگران؛ معنای گزارش را عوض نکنید.</p>
            <div className="flex gap-2">{s.status === 'PUBLISHED'
              ? <><button className="btn btn-secondary btn-sm" onClick={() => m.mutate({ s, publish: true })}>ذخیرهٔ ویرایش</button><button className="btn btn-ghost btn-sm" onClick={() => m.mutate({ s, publish: false })}>برداشتن از انتشار</button></>
              : <button className="btn btn-primary btn-sm" onClick={() => m.mutate({ s, publish: true })}>انتشار</button>}</div>
          </li>); })}</ul>
      ) : <Empty icon={BookOpenCheck} title="موردی نیست" />}
    </div>
  );
}

interface ALog { id: string; action: string; label: string; at: string; actor: string; subject: string | null }
export function AccessLogPage() {
  const q = useQuery({ queryKey: ['access-log'], queryFn: () => api<ALog[]>('/admin/security/access') });
  return (
    <div className="rise">
      <PageHead title="گزارش دسترسی" desc="هر بار که کارکنان یا راهیاران دادهٔ شخصی کسی را می‌بینند اینجا ثبت می‌شود. یک سال نگه داشته می‌شود." />
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <div className="card overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className="bg-sunken text-xs text-muted"><tr>{['چه کسی', 'چه دید', 'دربارهٔ', 'کی'].map((h) => <th key={h} className="px-4 py-2.5 text-start font-bold">{h}</th>)}</tr></thead>
          <tbody>{q.data.map((a) => <tr key={a.id} className="border-t border-line"><td className="px-4 py-2.5 font-semibold text-ink">{a.actor}</td><td className="px-4 py-2.5">{a.label}</td><td className="px-4 py-2.5 text-muted">{a.subject ?? '—'}</td><td className="px-4 py-2.5 text-muted">{ago(a.at)}</td></tr>)}</tbody>
        </table></div>
      ) : <Empty icon={ShieldCheck} title="هنوز چیزی ثبت نشده" />}
    </div>
  );
}
