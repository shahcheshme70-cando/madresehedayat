import { Flag, Award, BadgeDollarSign, MessageSquarePlus, BookOpen, BookOpenCheck, CalendarDays, Compass, House, KeyRound, LayoutDashboard, Landmark, LifeBuoy, Megaphone, Route, ScrollText, ShieldCheck, Users, Wrench } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { Brand } from '../../components/Shell';
import { MfaGate } from './MfaGate';
import { useAuth } from '../../lib/auth';
import { ROLE_LABEL } from '../../lib/fa';

const SECS = [
  { to: '/admin', label: 'پیشخوان', icon: LayoutDashboard, end: true },
  { to: '/admin/courses', label: 'دوره‌ها', icon: BookOpen },
  { to: '/admin/paths', label: 'مسیرها', icon: Route },
  { to: '/admin/tools', label: 'جعبه‌ابزار', icon: Wrench },
  { to: '/admin/rahyar', label: 'ساختار راهیاری', icon: Compass },
  { to: '/admin/events', label: 'برنامه‌ها', icon: CalendarDays },
  { to: '/admin/campaigns', label: 'پویش‌ها', icon: Flag },
  { to: '/admin/users', label: 'کاربران و نقش‌ها', icon: Users },
  { to: '/admin/business', label: 'مدل کسب‌وکار', icon: BadgeDollarSign },
  { to: '/admin/grants', label: 'دسترسی ویژه', icon: KeyRound },
  { to: '/admin/certificates', label: 'گواهی‌ها', icon: Award },
  { to: '/admin/mosques', label: 'مساجد', icon: Landmark },
  { to: '/admin/support', label: 'پشتیبانی', icon: LifeBuoy },
  { to: '/admin/feedback', label: 'بازخورد', icon: MessageSquarePlus },
  { to: '/admin/broadcasts', label: 'پیام گروهی', icon: Megaphone },
  { to: '/admin/samples', label: 'گزارش‌های نمونه', icon: BookOpenCheck },
  { to: '/admin/audit', label: 'گزارش تغییرات', icon: ScrollText, admin: true },
  { to: '/admin/security', label: 'گزارش دسترسی', icon: ShieldCheck, admin: true },
];

export default function AdminShell() {
  const { me, has } = useAuth();
  const secs = SECS.filter((s) => !s.admin || has('HQ_ADMIN'));
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 border-b border-line bg-card md:flex md:h-dvh md:flex-col md:overflow-y-auto md:border-b-0 md:border-e" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between gap-3 p-4 md:block"><Brand /><span className="text-xs font-bold text-muted md:mt-2 md:block">پنل ستاد</span></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:grid md:gap-0.5 md:overflow-visible md:pb-2" aria-label="بخش‌های پنل">
          {secs.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end} className={({ isActive }) => `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold no-underline ${isActive ? 'bg-leaf-soft text-leaf-ink' : 'text-body hover:bg-sunken'}`}>
              <s.icon className="size-[18px]" />{s.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden p-4 md:mt-auto md:block">
          <Link to="/" className="btn btn-ghost btn-sm mb-3 w-full justify-start"><House className="size-4" />نمای کنشگر</Link>
          <div className="flex items-center gap-2.5 rounded-xl bg-sunken p-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-leaf-soft font-extrabold text-leaf-ink">{me?.firstName[0]}</span>
            <span className="text-sm leading-tight"><b className="block text-ink">{me?.firstName} {me?.lastName}</b><span className="text-xs text-muted">{me?.roles.filter((r) => r.startsWith('HQ')).map((r) => ROLE_LABEL[r]).join('، ')}</span></span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8"><div className="mx-auto max-w-6xl"><MfaGate><Outlet /></MfaGate></div></main>
    </div>
  );
}

export function PageHead({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-[clamp(22px,2.6vw,28px)] font-extrabold">{title}</h1>{desc && <p className="mt-1 max-w-2xl text-muted">{desc}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
