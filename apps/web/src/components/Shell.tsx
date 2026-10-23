import { Award, BookOpen, House, LayoutDashboard, LogOut, Settings, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/', label: 'خانه', icon: House, end: true },
  { to: '/learn', label: 'یادگیری', icon: BookOpen },
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

/** پوستهٔ کنشگر: سرصفحه در رایانه، نوار پایین در گوشی */
export function Shell() {
  const { me, isStaff, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  return (
    <div className="min-h-dvh pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="wrap flex h-16 items-center gap-6">
          <Brand />
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="بخش‌های اصلی">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3.5 py-2 text-[15px] font-semibold no-underline transition ${isActive ? 'bg-leaf-soft text-leaf-ink' : 'text-body hover:bg-sunken'}`}>
                <n.icon className="size-[18px]" />{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="relative ms-auto flex items-center gap-2 md:ms-0">
            {isStaff && <Link to="/admin" className="btn btn-secondary btn-sm"><LayoutDashboard className="size-4" /><span className="hidden sm:inline">پنل ستاد</span></Link>}
            <button className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-sunken" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="حساب من">
              <span className="grid size-9 place-items-center rounded-full bg-leaf-soft font-extrabold text-leaf-ink">{me?.firstName[0]}</span>
              <span className="hidden text-start leading-tight lg:block"><b className="block text-sm text-ink">{me?.firstName} {me?.lastName}</b><span className="text-xs text-muted">{me?.mosque?.name ?? me?.county?.name}</span></span>
            </button>
            {menu && (
              <div className="rise absolute end-0 top-14 z-40 w-56 rounded-2xl border border-line bg-card p-2 shadow-lift" onMouseLeave={() => setMenu(false)}>
                <Link to="/settings" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-body no-underline hover:bg-sunken"><Settings className="size-4" />تنظیمات حساب</Link>
                <Link to="/me" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-body no-underline hover:bg-sunken"><UserRound className="size-4" />پیشرفت من</Link>
                <button onClick={async () => { await logout(); nav('/login'); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose hover:bg-sunken"><LogOut className="size-4" />خروج</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="wrap py-6 md:py-10"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-card/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-label="بخش‌های اصلی">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold no-underline ${isActive ? 'text-leaf-ink' : 'text-muted'}`}>
            <n.icon className="size-6" />{n.short ?? n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
