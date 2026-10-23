import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, BookOpen, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { CourseCard } from '../components/CourseCard';
import { Empty, Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fa, jDate } from '../lib/fa';
import type { CourseCard as C } from '../lib/types';

interface Cert { code: string; courseTitle: string; issuedAt: string; score: number | null; courseSlug: string }
type Tab = 'active' | 'done' | 'archived';

export default function Me() {
  const { me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['my-courses'], queryFn: () => api<C[]>('/me/courses') });
  const certs = useQuery({ queryKey: ['certs'], queryFn: () => api<Cert[]>('/me/certificates') });
  const [tab, setTab] = useState<Tab>('active');
  const archive = useMutation({
    mutationFn: ({ slug, archived }: { slug: string; archived: boolean }) => api(`/courses/${slug}/archive`, { body: { archived } }),
    onSuccess: (_r, v) => { qc.invalidateQueries({ queryKey: ['my-courses'] }); toast(v.archived ? 'دوره کنار گذاشته شد؛ پیشرفتش می‌ماند' : 'دوره برگشت'); },
  });
  if (mine.isLoading) return <Spinner />;
  const all = mine.data ?? [];
  const lists: Record<Tab, C[]> = {
    active: all.filter((c) => !c.me?.completedAt && !c.me?.archived),
    done: all.filter((c) => c.me?.completedAt),
    archived: all.filter((c) => !c.me?.completedAt && c.me?.archived),
  };
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); toast('شناسه کپی شد'); } catch { toast('کپی نشد؛ شناسه را دستی بردارید', 'err'); } };

  return (
    <div className="rise grid gap-10">
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-leaf-soft text-2xl font-extrabold text-leaf-ink">{me?.firstName[0]}</span>
        <div className="flex-1"><h1 className="text-[clamp(22px,3vw,30px)] font-extrabold">{me?.firstName} {me?.lastName}</h1>
          <p className="text-muted">{me?.mosque?.name ?? me?.nearMosque ?? 'بدون مسجد'}{me?.county ? ` · ${me.county.name}، ${me.county.province}` : ''}</p></div>
        <div className="flex gap-6">
          <div className="text-center"><b className="tnum block text-2xl text-ink">{fa(lists.done.length)}</b><span className="text-sm text-muted">دورهٔ تمام‌شده</span></div>
          <div className="text-center"><b className="tnum block text-2xl text-ink">{fa(certs.data?.length ?? 0)}</b><span className="text-sm text-muted">گواهی</span></div>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-extrabold">گواهی‌ها</h2>
        {certs.data?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {certs.data.map((c) => (
              <div key={c.code} className="card flex items-center gap-4 p-4">
                <Award className="size-11 shrink-0 rounded-xl bg-flame-soft p-2.5 text-flame-ink" />
                <div className="min-w-0 flex-1"><b className="block text-ink">{c.courseTitle}</b>
                  <span className="text-sm text-muted">{jDate(c.issuedAt)}{c.score != null ? ` · نمره ٪${fa(c.score)}` : ''}</span>
                  <span className="mt-0.5 block text-xs text-muted">شناسهٔ استعلام: <b dir="ltr" className="tnum">{c.code}</b></span></div>
                <div className="flex flex-col gap-1">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => copy(c.code)} aria-label="کپی شناسه"><Copy className="size-4" /></button>
                  <Link className="btn btn-ghost btn-icon btn-sm" to={`/verify/${c.code}`} aria-label="دیدن گواهی"><ExternalLink className="size-4" /></Link>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty icon={Award} title="هنوز گواهی ندارید">با تمام کردن هر دوره و قبولی در آزمون پایانی، گواهی‌اش اینجا می‌آید.</Empty>}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3"><h2 className="me-auto text-lg font-extrabold">دوره‌های من</h2>
          <div className="seg" role="group">{([['active', 'در حال گذراندن'], ['done', 'تمام‌شده'], ['archived', 'کنار گذاشته']] as [Tab, string][]).map(([k, t]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t} <span className="tnum text-muted">{fa(lists[k].length)}</span></button>)}</div></div>
        {lists[tab].length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists[tab].map((c) => (
              <div key={c.id} className="grid gap-2">
                <CourseCard c={c} />
                {tab !== 'done' && <button className="btn btn-ghost btn-sm" onClick={() => archive.mutate({ slug: c.slug, archived: tab === 'active' })}>{tab === 'active' ? 'کنار گذاشتن دوره' : 'برگرداندن به دوره‌های در حال گذراندن'}</button>}
              </div>
            ))}
          </div>
        ) : <Empty icon={BookOpen} title={tab === 'active' ? 'دورهٔ در حال گذراندنی ندارید' : tab === 'done' ? 'هنوز دوره‌ای را تمام نکرده‌اید' : 'دوره‌ای را کنار نگذاشته‌اید'}>{tab === 'active' && <Link to="/learn" className="font-bold text-leaf-ink">دیدن دوره‌ها</Link>}</Empty>}
      </section>
    </div>
  );
}
