import { useQuery } from '@tanstack/react-query';
import { CircleAlert, KeyRound, LogOut, Moon, Sun, SunMoon } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { maskMobile, ROLE_LABEL } from '../lib/fa';
import type { Me } from '../lib/types';

interface Province { id: string; name: string; counties: { id: string; name: string }[] }
type Theme = 'system' | 'light' | 'dark';

export function applyTheme(t: Theme) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
export const savedTheme = (): Theme => { try { return (localStorage.getItem('mh-theme') as Theme) || 'system'; } catch { return 'system'; } };

export default function Settings() {
  const { me, setMe, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const geo = useQuery({ queryKey: ['provinces'], queryFn: () => api<Province[]>('/geo/provinces'), staleTime: Infinity });
  const [f, setF] = useState({ firstName: me!.firstName, lastName: me!.lastName, provinceId: '', countyId: me!.county?.id ?? '', mosqueId: me!.mosque?.id ?? '', nearMosque: me!.nearMosque ?? '', nationalId: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(savedTheme());
  useEffect(() => {
    if (!f.provinceId && geo.data && me?.county) { const p = geo.data.find((x) => x.counties.some((c) => c.id === me.county!.id)); if (p) setF((x) => ({ ...x, provinceId: p.id })); }
  }, [geo.data]); // eslint-disable-line
  const counties = useMemo(() => geo.data?.find((p) => p.id === f.provinceId)?.counties ?? [], [geo.data, f.provinceId]);
  const mosques = useQuery({ queryKey: ['mosques', f.countyId], enabled: !!f.countyId, queryFn: () => api<{ id: string; name: string }[]>(`/geo/mosques?countyId=${f.countyId}`) });

  async function save(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (f.firstName.trim().length < 2 || f.lastName.trim().length < 2) { setErr('نام و نام خانوادگی را کامل بنویسید.'); return; }
    setBusy(true);
    try {
      const body: Record<string, string> = { firstName: f.firstName, lastName: f.lastName, countyId: f.countyId, mosqueId: f.mosqueId, nearMosque: f.mosqueId ? '' : f.nearMosque };
      if (f.nationalId.trim()) body.nationalId = f.nationalId.trim();
      setMe(await api<Me>('/auth/me', { method: 'PATCH', body }));
      setF((x) => ({ ...x, nationalId: '' }));
      toast('مشخصات ذخیره شد');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rise mx-auto grid max-w-2xl gap-8">
      <h1 className="text-[clamp(24px,3vw,32px)] font-extrabold">تنظیمات</h1>
      <form onSubmit={save} className="card grid gap-4 p-6" noValidate>
        <h2 className="text-lg font-extrabold">مشخصات</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label htmlFor="fn">نام</label><input id="fn" className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></div>
          <div className="field"><label htmlFor="ln">نام خانوادگی</label><input id="ln" className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></div>
          <div className="field"><label htmlFor="pr">استان</label><select id="pr" className="input" value={f.provinceId} onChange={(e) => setF({ ...f, provinceId: e.target.value, countyId: '', mosqueId: '' })}><option value="">انتخاب کنید</option>{geo.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="field"><label htmlFor="ct">شهرستان</label><select id="ct" className="input" value={f.countyId} onChange={(e) => setF({ ...f, countyId: e.target.value, mosqueId: '' })}><option value="">انتخاب کنید</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="mq">مسجد</label>
          <select id="mq" className="input" value={f.mosqueId} onChange={(e) => setF({ ...f, mosqueId: e.target.value })}><option value="">مسجدم در فهرست نیست / عضو مسجدی نیستم</option>{mosques.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        {!f.mosqueId && <div className="field"><label htmlFor="nm">نزدیک‌ترین مسجد</label><input id="nm" className="input" value={f.nearMosque} onChange={(e) => setF({ ...f, nearMosque: e.target.value })} /></div>}
        <div className="field"><label htmlFor="nid">کد ملی <span className="font-normal text-muted">(اختیاری؛ {me!.hasNationalId ? 'ثبت شده است' : 'بعضی خدمات لازمش دارند'})</span></label>
          <input id="nid" className="input ltr tnum" inputMode="numeric" maxLength={10} placeholder={me!.hasNationalId ? 'برای تغییر، کد تازه را بنویسید' : '۱۰ رقم'} value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} /></div>
        {err && <p className="err"><CircleAlert className="size-4" />{err}</p>}
        <div><button className="btn btn-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button></div>
      </form>

      <section className="card grid gap-4 p-6">
        <h2 className="text-lg font-extrabold">حساب</h2>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><b className="block text-ink">شمارهٔ موبایل</b><span dir="ltr" className="tnum text-muted">{maskMobile(me!.mobile)}</span></div></div>
        {me!.roles.length > 0 && <div><b className="block text-ink">نقش‌ها</b><div className="mt-1 flex flex-wrap gap-2">{me!.roles.map((r) => <span key={r} className="chip chip-dome">{ROLE_LABEL[r]}</span>)}</div></div>}
        {me!.cores.length > 0 && <div><b className="block text-ink">هسته‌ها</b><div className="mt-1 flex flex-wrap gap-2">{me!.cores.map((c) => <span key={c.id} className="chip">{c.name}{c.isLeader ? ' · مسئول' : ''}</span>)}</div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3"><div><b className="block text-ink">ورود با سامانهٔ پایه</b><span className="text-sm text-muted">{me!.ssoLinked ? 'حساب شما وصل است' : 'به‌زودی؛ هنوز راه نیفتاده'}</span></div><KeyRound className="size-5 text-muted" /></div>
      </section>

      <section className="card grid gap-3 p-6">
        <h2 className="text-lg font-extrabold">پیام راهیار</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-5 accent-[var(--leaf)]" checked={me!.allowRahyarMessages} onChange={async (e) => {
            const v = e.target.checked;
            try { await api('/me/prefs', { method: 'PATCH', body: { allowRahyarMessages: v } }); setMe({ ...me!, allowRahyarMessages: v }); toast(v ? 'راهیار می‌تواند به شما پیام بدهد' : 'پیام راهیار خاموش شد'); } catch (er) { toast((er as Error).message, 'err'); }
          }} />
          <span><b className="block text-ink">راهیارم بتواند به من پیام بدهد</b><span className="text-sm text-muted">شمارهٔ همراه شما در هیچ حالتی به راهیار نشان داده نمی‌شود. اگر خاموش باشد، راهیار فقط به پیام‌هایی که خودتان می‌فرستید پاسخ می‌دهد. بازخورد گزارش مأموریت‌ها همیشه می‌رسد.</span></span>
        </label>
      </section>

      <section className="card grid gap-3 p-6">
        <h2 className="text-lg font-extrabold">نمایش</h2>
        <div className="seg w-fit" role="group" aria-label="پوسته">
          {([['system', 'خودکار', SunMoon], ['light', 'روشن', Sun], ['dark', 'تیره', Moon]] as [Theme, string, any][]).map(([k, t, I]) => (
            <button key={k} aria-pressed={theme === k} onClick={() => { setTheme(k); applyTheme(k); try { localStorage.setItem('mh-theme', k); } catch { /* ignore */ } }}><I className="me-1 inline size-4" />{t}</button>
          ))}
        </div>
      </section>

      <button className="btn btn-secondary w-fit" onClick={async () => { await logout(); nav('/login'); }}><LogOut className="size-4" />خروج از حساب</button>
    </div>
  );
}
