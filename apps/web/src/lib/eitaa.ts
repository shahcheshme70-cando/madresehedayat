/**
 * اجرای مدرسه داخل برنامهٔ ایتا.
 * نشانی مقصد برنامه در پنل ایتایار باید «https://دامنه/?eitaa=1» باشد. فقط در این حالت کیت توسعهٔ ایتا
 * (طبق مستند ایتا از نشانی رسمی) بارگذاری می‌شود؛ در مرورگر معمولی هیچ اسکریپت بیرونی‌ای بار نمی‌شود.
 */
const KEY = 'mh-in-eitaa';
declare global { interface Window { Eitaa?: { WebApp: any } } }

export function inEitaa() {
  try {
    if (new URLSearchParams(location.search).get('eitaa') === '1') sessionStorage.setItem(KEY, '1');
    return sessionStorage.getItem(KEY) === '1';
  } catch { return false; }
}

let loading: Promise<any> | null = null;
export function eitaaApp(): Promise<any | null> {
  if (!inEitaa()) return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    if (window.Eitaa?.WebApp) return resolve(window.Eitaa.WebApp);
    const s = document.createElement('script');
    s.src = 'https://developer.eitaa.com/eitaa-web-app.js';
    s.onload = () => { const w = window.Eitaa?.WebApp; try { w?.ready(); w?.expand?.(); } catch { /* نسخه‌های قدیمی */ } resolve(w ?? null); };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(window.Eitaa?.WebApp ?? null), 8000);
  });
  return loading;
}

/** شمارهٔ همراه تأییدشده از ایتا (با رضایت کاربر) */
export async function eitaaContact(): Promise<string | null> {
  const w = await eitaaApp();
  if (!w?.requestContact) return null;
  return new Promise((resolve) => w.requestContact((ok: boolean, contact: string) => resolve(ok ? contact : null)));
}
