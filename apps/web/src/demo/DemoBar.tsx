import { Info, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { demoLoginAs, PERSONAS, resetDemo } from './server';

/** نوار نسخهٔ نمایشی: در صفحهٔ ورود باز است، جاهای دیگر یک دکمهٔ کوچک. با آن می‌شود نقش عوض کرد. */
export function DemoBar() {
  const [hash, setHash] = useState(window.location.hash);
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setInterval(() => setHash(window.location.hash), 400); return () => clearInterval(t); }, []);
  const admin = hash.startsWith('#/admin');
  const show = open || hash.startsWith('#/login');
  const as = (m: string) => { demoLoginAs(m); window.location.hash = m === PERSONAS[PERSONAS.length - 1].mobile ? '#/admin' : '#/'; window.location.reload(); };
  return (
    <div className={`fixed z-40 ${admin ? 'bottom-3' : 'bottom-[calc(84px+env(safe-area-inset-bottom,0px))] md:bottom-3'}`} style={{ left: 'max(12px, env(safe-area-inset-left, 0px))' }}>
      {show ? (
        <div className="rise grid max-w-[min(440px,calc(100vw-24px))] gap-2.5 rounded-2xl bg-ink px-4 py-3 text-xs leading-6 text-bg shadow-lift">
          <div className="flex items-start gap-2">
            <Info className="mt-1 size-4 shrink-0 text-flame" />
            <span className="flex-1">نسخهٔ نمایشی؛ داده‌ها فقط در مرورگر شماست. کد ورود همیشه <b>۱۲۳۴۵</b> است. با هر شماره‌ای ثبت‌نام کنید، یا یکی از نقش‌های آماده را ببینید:</span>
            {!hash.startsWith('#/login') && <button onClick={() => setOpen(false)} aria-label="بستن"><X className="size-4" /></button>}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PERSONAS.map((p) => (
              <button key={p.mobile} onClick={() => as(p.mobile)} className="flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 text-start hover:bg-white/20">
                <UserRound className="mt-1 size-3.5 shrink-0 text-flame" /><span><b className="block">{p.label}</b><span className="opacity-75">{p.hint}</span></span>
              </button>
            ))}
          </div>
          <button className="w-fit font-bold text-flame underline" onClick={() => { resetDemo(); window.location.hash = '#/login'; window.location.reload(); }}>شروع دوباره (پاک کردن داده‌ها)</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-bg shadow-lift"><Info className="size-3.5 text-flame" />نسخهٔ نمایشی · عوض کردن نقش</button>
      )}
    </div>
  );
}
