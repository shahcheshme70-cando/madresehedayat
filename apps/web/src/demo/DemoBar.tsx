import { Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEMO_ADMIN, resetDemo } from './server';

const faNum = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

/** نوار نسخهٔ نمایشی: در صفحهٔ ورود باز است، جاهای دیگر یک دکمهٔ کوچک */
export function DemoBar() {
  const [hash, setHash] = useState(window.location.hash);
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setInterval(() => setHash(window.location.hash), 400); return () => clearInterval(t); }, []);
  const onLogin = hash.startsWith('#/login') || hash === '' || hash === '#/';
  const admin = hash.startsWith('#/admin');
  const show = open || (onLogin && hash.startsWith('#/login'));
  return (
    <div className={`fixed z-40 ${admin ? 'bottom-3' : 'bottom-[calc(84px+env(safe-area-inset-bottom,0px))] md:bottom-3'}`} style={{ left: 'max(12px, env(safe-area-inset-left, 0px))' }}>
      {show ? (
        <div className="rise flex max-w-[min(520px,calc(100vw-24px))] items-start gap-2 rounded-2xl bg-ink px-4 py-3 text-xs leading-6 text-bg shadow-lift">
          <Info className="mt-1 size-4 shrink-0 text-flame" />
          <span>نسخهٔ نمایشی؛ داده‌ها فقط در مرورگر شماست. کد ورود همیشه <b>۱۲۳۴۵</b> است. برای دیدن پنل ستاد با شمارهٔ <b dir="ltr">{faNum(DEMO_ADMIN)}</b> ثبت‌نام کنید.{' '}
            <button className="font-bold text-flame underline" onClick={() => { resetDemo(); window.location.hash = '#/login'; window.location.reload(); }}>شروع دوباره</button></span>
          {!hash.startsWith('#/login') && <button onClick={() => setOpen(false)} aria-label="بستن"><X className="size-4" /></button>}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-bg shadow-lift"><Info className="size-3.5 text-flame" />نسخهٔ نمایشی</button>
      )}
    </div>
  );
}
