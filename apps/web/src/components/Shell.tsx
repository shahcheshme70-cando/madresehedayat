import { useQuery } from '@tanstack/react-query';
import { Wrench, Award, Bell, LifeBuoy, Megaphone, BookOpen, CalendarDays, Compass, House, Landmark, LayoutDashboard, LogOut, MessageCircle, Settings, Building2, UsersRound, CalendarCog } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fa } from '../lib/fa';

const NAV = [
  { to: '/', label: 'خانه', icon: House, end: true },
  { to: '/learn', label: 'یادگیری', icon: BookOpen },
  { to: '/tools', label: 'جعبه‌ابزار', short: 'ابزار', icon: Wrench },
  { to: '/events', label: 'برنامه‌ها', icon: CalendarDays },
  { to: '/me', label: 'گواهی‌ها و پیشرفت', short: 'من', icon: Award },
];

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="مدرسهٔ هدایت — خانه">
      <img src="/brand/logo-mark.png" alt="" width={22} height={36} className="h-9 w-auto" />
      {!compact && <img src="/brand/logo-type-ink.png" alt="مدرسهٔ هدایت" className="h-[18px] w-auto dark:hidden" />}
      {!compact && <span className="hidden text-lg font-extrabold text-ink dark:inline">مدرسهٔ هدایت</span>}
    </Link>
  );
}

export function useUnread() {
  return useQuery({ queryKey: ['unread'], queryFn: () => api<{ count: number }>('/notifications/unread'), refetchInterval: 60_000, staleTime: 20_000 });
}

/** پیوندهای نقش‌ها: راهیار، امام، مسئول هسته، سازمان، برگزارکننده */
export function useRoleLinks() {
  const { me, has, isStaff } = useAuth();
  const links: { to: string; label: string; icon: typeof House }[] = [];
  if (has('RAHYAR')) links.push({ to: '/rahyar', label: 'پنل راهیاری', icon: Compass });
  if (me?.imamOf?.length) links.push({ to: '/imam', label: 'مسجد من', icon: Landmark });
  if (me?.cores?.length || me?.gender === 'FEMALE') links.push({ to: '/cores', label: 'هسته‌های من', icon: UsersRound });
  if (me?.orgs?.length) links.push({ to: '/org', label: 'پنل سازمان', icon: Building2 });
  if (isStaff || has('RAHYAR', 'INSTRUCTOR')) links.push({ to: '/manage/events', label: 'برگزاری برنامه', icon: CalendarCog });
  if (isStaff || has('RAHYAR') || me?.imamOf?.length || me?.cores?.some((c) => c.isLeader)) links.push({ to: '/broadcast', label: 'پیام گروهی', icon: Megaphone });
  links.push({ to: '/messages', label: 'پیام با راهیار', icon: MessageCircle });
  links.push({ to: '/help', label: 'کمک و پشتیبانی', icon: LifeBuoy });
  return links;
}

/** پوستهٔ کنشگر: سرصفحه در رایانه، نوار پایین در گوشی */
export function Shell() {
  const { me, isStaff, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const unread = useUnread();
  const links = useRoleLinks();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setMenu(false), [loc.pathname]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  const n = unread.data?.count ?? 0;
  const item = 'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-body no-underline hover:bg-sunken';
  return (
    <div className="min-h-dvh pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="wrap flex h-16 items-center gap-6">
          <Brand />
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="بخش‌های اصلی">
            {NAV.map((x) => (
              <NavLink key={x.to} to={x.to} end={x.end}
                className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3.5 py-2 text-[15px] font-semibold no-underline transition ${isActive ? 'bg-leaf-soft text-leaf-ink' : 'text-body hover:bg-sunken'}`}>
                <x.icon className="size-[18px]" /><span className="lg:hidden">{x.short ?? x.label}</span><span className="hidden lg:inline">{x.label}</span>
              </NavLink>
            ))}
          </nav>
          <div ref={box} className="relative ms-auto flex items-center gap-1.5 md:ms-0">
            {isStaff && <Link to="/admin" className="btn btn-secondary btn-sm"><LayoutDashboard className="size-4" /><span className="hidden sm:inline">پنل ستاد</span></Link>}
            <Link to="/notifications" className="btn btn-ghost btn-icon relative" aria-label={n ? `اعلان‌ها، ${fa(n)} تازه` : 'اعلان‌ها'}>
              <Bell className="size-5" />
              {n > 0 && <span className="tnum absolute -top-0.5 end-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose px-1 text-[11px] font-bold text-white">{fa(n > 99 ? 99 : n)}</span>}
            </Link>
            <button className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-sunken" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="حساب من">
              <span className="grid size-9 place-items-center rounded-full bg-leaf-soft font-extrabold text-leaf-ink">{me?.firstName[0]}</span>
              <span className="hidden text-start leading-tight lg:block"><b className="block text-sm text-ink">{me?.firstName} {me?.lastName}</b><span className="text-xs text-muted">{me?.mosque?.name ?? me?.county?.name}</span></span>
            </button>
            {menu && (
              <div className="rise absolute end-0 top-14 z-40 w-60 rounded-2xl border border-line bg-card p-2 shadow-lift">
                {links.map((l) => <Link key={l.to} to={l.to} className={item}><l.icon className="size-4 text-leaf-ink" />{l.label}</Link>)}
                <hr className="my-1.5 border-line" />
                <Link to="/settings" className={item}><Settings className="size-4" />تنظیمات حساب</Link>
                <button onClick={async () => { await logout(); nav('/login'); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-rose hover:bg-sunken"><LogOut className="size-4" />خروج</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="wrap py-6 md:py-10"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="بخش‌های اصلی">
        {NAV.map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold no-underline ${isActive ? 'text-leaf-ink' : 'text-muted'}`}>
            <x.icon className="size-6" />{x.short ?? x.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
