import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fa, toEn } from '../../lib/fa';

/** پنل ستاد فقط پس از رمز دوم باز می‌شود (۱۳.۴) */
export function MfaGate({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; svg: string } | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const enrolled = !!me?.mfaEnrolled;
  useEffect(() => {
    if (!me?.mfaPending || enrolled || setup) return;
    api<{ secret: string; uri: string }>('/auth/mfa/setup', { method: 'POST' })
      .then(async (r) => setSetup({ secret: r.secret, svg: await QRCode.toString(r.uri, { type: 'svg', margin: 1 }) }))
      .catch((e) => setErr((e as Error).message));
  }, [me?.mfaPending, enrolled, setup]);
  if (!me?.mfaPending) return <>{children}</>;
  const verify = async () => {
    setBusy(true); setErr('');
    try { await api('/auth/mfa/verify', { body: { code: toEn(code) } }); await qc.invalidateQueries(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto grid max-w-md gap-5 py-10">
      <div className="grid justify-items-center gap-2 text-center">
        <ShieldCheck className="size-12 text-leaf" />
        <h1 className="text-2xl font-extrabold">{enrolled ? 'رمز دوم' : 'راه‌اندازی رمز دوم'}</h1>
        <p className="text-muted">{enrolled ? 'کد ۶ رقمی برنامهٔ احراز هویت گوشی‌تان را وارد کنید.' : 'برای ورود به پنل ستاد، یک‌بار برنامهٔ احراز هویت را روی گوشی وصل کنید (Google Authenticator، Microsoft Authenticator یا هر برنامهٔ مشابه).'}</p>
      </div>
      {!enrolled && setup && (
        <div className="card grid justify-items-center gap-3 p-5 text-center">
          <ol className="grid gap-1 text-start text-sm text-body">
            <li>۱. برنامه را باز کنید و «افزودن حساب» یا «+» را بزنید.</li>
            <li>۲. این کد QR را اسکن کنید.</li>
            <li>۳. کد ۶ رقمی‌ای را که برنامه نشان می‌دهد پایین وارد کنید.</li>
          </ol>
          <div className="w-48 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.svg }} role="img" aria-label="کد QR رمز دوم" />
          <details className="text-sm"><summary className="cursor-pointer text-muted">اسکن نمی‌شود؟ کلید را دستی وارد کنید</summary><code dir="ltr" className="mt-2 block break-all rounded-lg bg-sunken p-2">{setup.secret}</code></details>
        </div>
      )}
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); verify(); }}>
        <input className="input ltr tnum text-center text-2xl tracking-[.4em]" dir="ltr" inputMode="numeric" maxLength={6} autoFocus placeholder="••••••" aria-label="کد ۶ رقمی"
          value={fa(code)} onChange={(e) => setCode(toEn(e.target.value).replace(/\D/g, '').slice(0, 6))} />
        {err && <p className="err justify-center">{err}</p>}
        <button className="btn btn-primary btn-lg" disabled={code.length !== 6 || busy}><KeyRound className="size-4" />{enrolled ? 'ورود به پنل' : 'فعال‌سازی و ورود'}</button>
      </form>
      <p className="hint text-center">گوشی‌تان را گم کردید؟ از مدیر ستاد بخواهید رمز دوم شما را بازنشانی کند.</p>
    </div>
  );
}
