import { CalendarDays, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fa, toEn } from '../lib/fa';
import { monthLength, MONTHS, toGregorian, toJalali } from '../lib/jalali';

/**
 * انتخاب تاریخ (و ساعت) شمسی. مقدار بیرونی ISO است (یا '' برای خالی).
 * ساعت به وقت محلی مرورگر (تهران) خوانده و نوشته می‌شود.
 */
export function JalaliInput({ id, value, onChange, withTime = true, optional, label }: { id?: string; value: string; onChange: (iso: string) => void; withTime?: boolean; optional?: boolean; label?: string }) {
  const parse = (v: string) => {
    if (!v) return null;
    const d = new Date(v);
    const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { ...j, hh: d.getHours(), mm: d.getMinutes() };
  };
  const [s, setS] = useState(() => parse(value));
  useEffect(() => { setS(parse(value)); }, [value]);
  const now = toJalali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  const emit = (n: { jy: number; jm: number; jd: number; hh: number; mm: number }) => {
    const jd = Math.min(n.jd, monthLength(n.jy, n.jm));
    const g = toGregorian(n.jy, n.jm, jd);
    const d = new Date(g.gy, g.gm - 1, g.gd, withTime ? n.hh : 0, withTime ? n.mm : 0);
    setS({ ...n, jd });
    onChange(d.toISOString());
  };
  const cur = s ?? { ...now, hh: 18, mm: 0 };
  const years = Array.from({ length: 5 }, (_, i) => now.jy - 1 + i);
  if (!s) {
    return (
      <button type="button" id={id} className="input flex items-center gap-2 text-start text-muted" onClick={() => emit(cur)} aria-label={label ?? 'انتخاب تاریخ'}>
        <CalendarDays className="size-4" />{optional ? 'تعیین نشده — برای انتخاب بزنید' : 'انتخاب تاریخ'}
      </button>
    );
  }
  const sel = 'input w-auto min-w-0 px-2';
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label ?? 'تاریخ'}>
      <select id={id} className={sel} aria-label="روز" value={s.jd} onChange={(e) => emit({ ...s, jd: +e.target.value })}>
        {Array.from({ length: monthLength(s.jy, s.jm) }, (_, i) => <option key={i} value={i + 1}>{fa(i + 1)}</option>)}
      </select>
      <select className={sel} aria-label="ماه" value={s.jm} onChange={(e) => emit({ ...s, jm: +e.target.value })}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select className={sel} aria-label="سال" value={s.jy} onChange={(e) => emit({ ...s, jy: +e.target.value })}>
        {(years.includes(s.jy) ? years : [s.jy, ...years]).map((y) => <option key={y} value={y}>{fa(y)}</option>)}
      </select>
      {withTime && (
        <span className="flex items-center gap-1" dir="ltr">
          <input className="input w-16 text-center" inputMode="numeric" aria-label="ساعت" value={fa(String(s.hh).padStart(2, '0'))}
            onChange={(e) => { const h = Math.min(23, Math.max(0, +toEn(e.target.value).replace(/\D/g, '').slice(-2) || 0)); emit({ ...s, hh: h }); }} />
          <b>:</b>
          <input className="input w-16 text-center" inputMode="numeric" aria-label="دقیقه" value={fa(String(s.mm).padStart(2, '0'))}
            onChange={(e) => { const m = Math.min(59, Math.max(0, +toEn(e.target.value).replace(/\D/g, '').slice(-2) || 0)); emit({ ...s, mm: m }); }} />
        </span>
      )}
      {optional && <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="پاک کردن تاریخ" onClick={() => { setS(null); onChange(''); }}><X className="size-4" /></button>}
    </div>
  );
}
