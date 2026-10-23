import { useQuery } from '@tanstack/react-query';
import { MessageSquarePlus, Activity, Award, BookOpen, CircleCheck, Landmark, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorBox, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fa, STATUS_LABEL } from '../../lib/fa';
import { PageHead } from './AdminShell';
import { BusinessKpi } from '../Business';

interface Stats {
  users: number; newUsersWeek: number; activeWeek: number; enrollments: number; completions: number; certificates: number;
  courses: Record<string, number>; topCourses: { id: string; title: string; n: number }[]; unverifiedMosques: number;
}

export default function Dashboard() {
  const { me } = useAuth();
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<Stats>('/admin/stats') });
  const fb = useQuery({ queryKey: ['admin-feedback-stats'], queryFn: () => api<{ byStatus: Record<string, number> }>('/admin/feedback/stats') });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data!;
  const kpis = [
    { l: 'کاربران', v: s.users, sub: `${fa(s.newUsersWeek)} نفر این هفته`, i: Users, cls: 'bg-leaf-soft text-leaf-ink' },
    { l: 'فعال در هفته', v: s.activeWeek, sub: 'دست‌کم یک درس باز کرده‌اند', i: Activity, cls: 'bg-dome-soft text-dome-ink' },
    { l: 'ثبت‌نام در دوره‌ها', v: s.enrollments, sub: `${fa(s.completions)} تکمیل`, i: BookOpen, cls: 'bg-deep-soft text-deep' },
    { l: 'گواهی صادرشده', v: s.certificates, sub: 'معتبر', i: Award, cls: 'bg-flame-soft text-flame-ink' },
  ];
  const max = Math.max(1, ...s.topCourses.map((c) => c.n));
  return (
    <div className="rise">
      <PageHead title={`سلام، ${me?.firstName}`} desc="نمای کلی مدرسه؛ عددها زنده‌اند." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.l} className="card grid gap-1 p-4">
            <span className="flex items-center gap-2 text-sm text-muted"><k.i className={`size-7 rounded-lg p-1.5 ${k.cls}`} />{k.l}</span>
            <b className="tnum text-3xl text-ink">{fa(k.v)}</b><span className="text-xs text-muted">{k.sub}</span>
          </div>
        ))}
      </div>
      <div className="mt-6"><BusinessKpi /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-base font-extrabold">پرثبت‌نام‌ترین دوره‌ها</h2>
          <ul className="grid gap-3">{s.topCourses.map((c) => (
            <li key={c.id} className="grid gap-1"><div className="flex justify-between gap-3 text-sm"><Link to={`/admin/courses/${c.id}`} className="font-semibold text-ink">{c.title}</Link><span className="tnum text-muted">{fa(c.n)} نفر</span></div>
              <div className="bar"><span style={{ width: `${(c.n / max) * 100}%` }} /></div></li>
          ))}</ul>
        </section>
        <section className="card grid content-start gap-3 p-5">
          <h2 className="text-base font-extrabold">وضعیت دوره‌ها</h2>
          <div className="flex flex-wrap gap-2">{Object.entries(STATUS_LABEL).map(([k, t]) => <Link key={k} to="/admin/courses" className="chip">{t}: <b className="tnum">{fa(s.courses[k] ?? 0)}</b></Link>)}</div>
          {(s.courses.REVIEW ?? 0) > 0 && <Link to="/admin/courses" className="flex items-center gap-2 rounded-xl bg-flame-soft p-3 text-sm font-semibold text-flame-ink"><CircleCheck className="size-4" />{fa(s.courses.REVIEW)} دوره منتظر بازبینی و انتشار است</Link>}
          {(fb.data?.byStatus.NEW ?? 0) > 0 && <Link to="/admin/feedback" className="flex items-center gap-2 rounded-xl bg-leaf-soft p-3 text-sm font-semibold text-leaf-ink"><MessageSquarePlus className="size-4" />{fa(fb.data!.byStatus.NEW)} بازخورد تازه منتظر خواندن است</Link>}
          {s.unverifiedMosques > 0 && <Link to="/admin/mosques" className="flex items-center gap-2 rounded-xl bg-dome-soft p-3 text-sm font-semibold text-dome-ink"><Landmark className="size-4" />{fa(s.unverifiedMosques)} مسجد معرفی‌شده منتظر تأیید است</Link>}
          <Link to="/admin/courses" className="btn btn-primary mt-2 w-fit"><UserPlus className="size-4" />ساخت دورهٔ تازه</Link>
        </section>
      </div>
    </div>
  );
}
