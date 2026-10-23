import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { eitaaApp, eitaaContact, inEitaa } from '../lib/eitaa';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fa, maskMobile, toEn } from '../lib/fa';
import type { Me } from '../lib/types';

type Step = 'mobile' | 'code' | 'register';
interface Province { id: string; name: string; counties: { id: string; name: string }[] }

const normMobile = (v: string) => {
  const s = toEn(v).replace(/[\s\-()]/g, '').replace(/^\+98/, '0').replace(/^0098/, '0');
  return s.length === 10 && s.startsWith('9') ? '0' + s : s;
};

export default function Login() {
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  // کد ورود اگر بله یا ایتا وصل باشد رایگان همان‌جا می‌رود (مدل کسب‌وکار: کم کردن پیامک)
  const [channel, setChannel] = useState<'SMS' | 'BALE' | 'EITAA'>('SMS');
  const [isNew, setIsNew] = useState(false);
  const [regToken, setRegToken] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (me) nav(next, { replace: true }); }, [me, nav, next]);
  // داخل ایتا: اگر حساب ایتا پیش‌تر وصل شده، بی‌کد وارد می‌شویم
  const [eitaa, setEitaa] = useState<{ name: string } | null>(null);
  useEffect(() => {
    if (!inEitaa()) return;
    eitaaApp().then(async (w) => {
      if (!w?.initData) return;
      try {
        const r = await api<{ linked: boolean; user?: any; firstName?: string; lastName?: string }>('/auth/eitaa', { body: { initData: w.initData } });
        if (r.linked && r.user) setMe(r.user); else setEitaa({ name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() });
      } catch { /* ورود معمولی */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function withEitaaPhone() {
    setErr(''); setBusy(true);
    try {
      const contact = await eitaaContact();
      if (!contact) { setErr('شماره از ایتا دریافت نشد؛ با کد پیامکی وارد شوید.'); return; }
      const r = await api<{ needsRegistration: boolean; regToken?: string; user?: any }>('/auth/eitaa/contact', { body: { contact } });
      if (r.needsRegistration) { setRegToken(r.regToken!); setStep('register'); } else setMe(r.user);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  async function sendCode(e?: FormEvent, via?: 'sms') {
    e?.preventDefault();
    const m = normMobile(mobile);
    if (!/^09\d{9}$/.test(m)) { setErr('شماره باید ۱۱ رقم باشد و با ۰۹ شروع شود.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api<{ resendIn: number; isNew: boolean; devCode?: string; channel: 'SMS' | 'BALE' | 'EITAA' }>('/auth/otp', { body: { mobile: m, ...(via ? { via } : {}) } });
      setMobile(m); setIsNew(r.isNew); setChannel(r.channel ?? 'SMS'); setDevCode(r.devCode ?? null); setWait(r.resendIn); setCode(''); setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      const a = e as ApiError;
      if (a.code === 'otp_wait' && step === 'mobile') { setStep('code'); setWait(a.data?.wait ?? 60); }
      setErr(a.message);
    } finally { setBusy(false); }
  }

  async function verify(e?: FormEvent) {
    e?.preventDefault();
    const c = toEn(code).replace(/\D/g, '');
    if (c.length !== 5) { setErr('کد ۵ رقمی را کامل وارد کنید.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api<{ needsRegistration: boolean; regToken?: string; user?: Me }>('/auth/verify', { body: { mobile, code: c } });
      if (r.needsRegistration) { setRegToken(r.regToken!); setStep('register'); }
      else { setMe(r.user!); nav(next, { replace: true }); }
    } catch (e) { setErr((e as Error).message); setCode(''); codeRef.current?.focus(); } finally { setBusy(false); }
  }

  useEffect(() => { if (step === 'code' && toEn(code).replace(/\D/g, '').length === 5) verify(); /* ارسال خودکار وقتی ۵ رقم کامل شد */ // eslint-disable-next-line
  }, [code]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex items-start justify-center px-4 py-10 sm:items-center" style={{ paddingTop: 'max(40px, env(safe-area-inset-top))' }}>
        <div className="w-full max-w-[440px]">
          <img src="/brand/logo-full.png" alt="مدرسهٔ هدایت" className="mb-6 h-20 w-auto" />
          {step === 'mobile' && (
            <form onSubmit={sendCode} noValidate className="rise">
              <h1 className="text-[clamp(24px,3vw,30px)] font-extrabold">ورود یا ثبت‌نام</h1>
              <p className="mt-1.5 text-muted">با شمارهٔ موبایلتان وارد شوید؛ اگر بار اول است، همین‌جا ثبت‌نام می‌کنید. اگر بله یا ایتا را در تنظیمات وصل کرده باشید، کد همان‌جا می‌آید.</p>
              <div className="field mt-6">
                <label htmlFor="mobile">شمارهٔ موبایل</label>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
                  <input id="mobile" className="input ltr tnum h-[52px] !pr-11 text-lg tracking-wider" inputMode="numeric" autoComplete="tel" placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
                    value={mobile} onChange={(e) => { setMobile(e.target.value); setErr(''); }} autoFocus />
                </div>
                {err && <p className="err"><CircleAlert className="size-4" />{err}</p>}
              </div>
              {eitaa && <div className="mt-6 grid gap-2 rounded-2xl bg-leaf-soft p-4">
                <b className="text-ink">سلام{eitaa.name ? ` ${eitaa.name}` : ''}! از ایتا آمده‌اید.</b>
                <p className="text-sm text-body">با شمارهٔ حساب ایتایتان، بدون کد پیامکی وارد شوید. یک‌بار که وارد شوید، دفعه‌های بعد خودکار وارد می‌شوید و اعلان‌ها در ایتا هم می‌رسد.</p>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={withEitaaPhone}>ورود با شمارهٔ ایتا</button>
              </div>}
              <button className={`btn btn-lg mt-6 w-full ${eitaa ? 'btn-secondary' : 'btn-primary'}`} disabled={busy}>{busy ? 'در حال ارسال…' : 'دریافت کد'}</button>
              <SsoButton />
              <p className="mt-6 text-center text-sm text-muted">ادامه یعنی پذیرفتن <Link to="/terms" className="font-semibold text-leaf-ink">شرایط استفاده و حریم خصوصی</Link>.</p>
            </form>
          )}
          {step === 'code' && (
            <form onSubmit={verify} noValidate className="rise">
              <button type="button" className="btn btn-ghost btn-sm -ms-3 mb-2" onClick={() => { setStep('mobile'); setErr(''); }}><ArrowRight className="size-4" />تغییر شماره</button>
              <h1 className="text-[clamp(24px,3vw,30px)] font-extrabold">کد تأیید را وارد کنید</h1>
              {channel === 'SMS'
                ? <p className="mt-1.5 text-muted">کد ۵ رقمی به <b dir="ltr" className="tnum text-ink">{maskMobile(mobile)}</b> پیامک شد.</p>
                : <p className="mt-1.5 text-muted">کد ۵ رقمی در <b className="text-ink">{channel === 'BALE' ? 'بله' : 'ایتا'}</b> برایتان فرستاده شد (گفت‌وگو با بات مدرسه).</p>}
              <div className="field mt-6">
                <label htmlFor="code" className="sr-only">کد تأیید</label>
                <input id="code" ref={codeRef} className="input ltr tnum h-16 text-center text-3xl font-extrabold tracking-[0.6em]" inputMode="numeric" autoComplete="one-time-code" maxLength={5}
                  placeholder="•••••" value={fa(toEn(code).replace(/\D/g, ''))} onChange={(e) => { setCode(toEn(e.target.value).replace(/\D/g, '').slice(0, 5)); setErr(''); }} />
                {err && <p className="err justify-center"><CircleAlert className="size-4" />{err}</p>}
                {devCode && <p className="hint text-center">نسخهٔ توسعه: کد <b className="tnum">{fa(devCode)}</b> است (پیامک واقعی خاموش است).</p>}
              </div>
              <button className="btn btn-primary btn-lg mt-6 w-full" disabled={busy}>{busy ? 'در حال بررسی…' : isNew ? 'ادامهٔ ثبت‌نام' : 'ورود'}</button>
              <div className="mt-4 text-center text-sm">
                {wait > 0 ? <span className="text-muted">ارسال دوباره تا <b className="tnum">{fa(wait)}</b> ثانیهٔ دیگر</span>
                  : <button type="button" className="font-bold text-leaf-ink" onClick={() => sendCode()} disabled={busy}>ارسال دوبارهٔ کد</button>}
                {channel !== 'SMS' && wait <= 0 && <button type="button" className="ms-4 font-bold text-muted" onClick={() => sendCode(undefined, 'sms')} disabled={busy}>با پیامک بفرست</button>}
              </div>
            </form>
          )}
          {step === 'register' && <Register regToken={regToken} mobile={mobile} invite={params.get('invite') ?? ''} onDone={(u) => { setMe(u); nav(next, { replace: true }); }} />}
        </div>
      </div>
      <Art />
    </div>
  );
}

function SsoButton() {
  const [msg, setMsg] = useState('');
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />یا<span className="h-px flex-1 bg-line" /></div>
      <button type="button" className="btn btn-secondary w-full" onClick={async () => {
        try { await api('/auth/sso/core'); } catch (e) { setMsg((e as Error).message); }
      }}><KeyRound className="size-4" />ورود با سامانهٔ پایهٔ هدایت</button>
      {msg && <p className="hint mt-2 text-center">{msg}</p>}
    </>
  );
}

function Register({ regToken, mobile, invite, onDone }: { regToken: string; mobile: string; invite: string; onDone: (u: Me) => void }) {
  const geo = useQuery({ queryKey: ['provinces'], queryFn: () => api<Province[]>('/geo/provinces'), staleTime: Infinity });
  const [f, setF] = useState({ firstName: '', lastName: '', gender: '', provinceId: '', countyId: '', mosqueId: '', mosqueMode: 'list' as 'list' | 'other' | 'none', nearMosque: '', inviteCode: invite });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const counties = useMemo(() => geo.data?.find((p) => p.id === f.provinceId)?.counties ?? [], [geo.data, f.provinceId]);
  const mosques = useQuery({ queryKey: ['mosques', f.countyId], enabled: !!f.countyId, queryFn: () => api<{ id: string; name: string }[]>(`/geo/mosques?countyId=${f.countyId}`) });
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.firstName.trim().length < 2) er.firstName = 'نام را بنویسید';
    if (f.lastName.trim().length < 2) er.lastName = 'نام خانوادگی را بنویسید';
    if (!f.gender) er.gender = 'یکی را انتخاب کنید';
    if (!f.countyId) er.countyId = 'شهرستان را انتخاب کنید';
    if (f.mosqueMode === 'list' && !f.mosqueId) er.mosqueId = 'مسجدتان را انتخاب کنید، یا گزینهٔ پایین را بزنید';
    if (f.mosqueMode !== 'list' && f.nearMosque.trim().length < 3) er.nearMosque = f.mosqueMode === 'none' ? 'نام نزدیک‌ترین مسجد را بنویسید' : 'نام و نشانی مسجد را بنویسید';
    setErrs(er); if (Object.keys(er).length) return;
    setBusy(true); setErr('');
    try {
      const r = await api<{ user: Me }>('/auth/register', { body: {
        regToken, firstName: f.firstName, lastName: f.lastName, gender: f.gender, countyId: f.countyId,
        mosqueId: f.mosqueMode === 'list' ? f.mosqueId : undefined, nearMosque: f.mosqueMode !== 'list' ? f.nearMosque : undefined,
        inviteCode: f.inviteCode || undefined,
      } });
      onDone(r.user);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const E = ({ k }: { k: string }) => errs[k] ? <p className="err"><CircleAlert className="size-4" />{errs[k]}</p> : null;
  return (
    <form onSubmit={submit} noValidate className="rise">
      <h1 className="text-[clamp(24px,3vw,30px)] font-extrabold">به مدرسهٔ هدایت خوش آمدید</h1>
      <p className="mt-1.5 text-muted">چند مشخصه برای ساختن حسابتان؛ کمتر از یک دقیقه طول می‌کشد. شماره: <b dir="ltr" className="tnum">{maskMobile(mobile)}</b></p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="field"><label htmlFor="fn">نام</label><input id="fn" className="input" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" /><E k="firstName" /></div>
        <div className="field"><label htmlFor="ln">نام خانوادگی</label><input id="ln" className="input" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" /><E k="lastName" /></div>
      </div>
      <fieldset className="field mt-4">
        <legend className="mb-1.5 text-sm font-bold text-ink">جنسیت</legend>
        <div className="seg">{[['MALE', 'برادر'], ['FEMALE', 'خواهر']].map(([v, t]) => <button type="button" key={v} aria-pressed={f.gender === v} onClick={() => set('gender', v)}>{t}</button>)}</div>
        <p className="hint">شبکهٔ راهیاری برادران و بانور جداست؛ راهیارتان بر همین اساس تعیین می‌شود.</p><E k="gender" />
      </fieldset>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="field"><label htmlFor="pr">استان</label>
          <select id="pr" className="input" value={f.provinceId} onChange={(e) => { set('provinceId', e.target.value); set('countyId', ''); set('mosqueId', ''); }}>
            <option value="">انتخاب کنید</option>{geo.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div className="field"><label htmlFor="ct">شهرستان</label>
          <select id="ct" className="input" value={f.countyId} disabled={!f.provinceId} onChange={(e) => { set('countyId', e.target.value); set('mosqueId', ''); }}>
            <option value="">انتخاب کنید</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select><E k="countyId" /></div>
      </div>
      <div className="field mt-4">
        <label htmlFor="mq">مسجد</label>
        {f.mosqueMode === 'list' ? (
          <select id="mq" className="input" value={f.mosqueId} disabled={!f.countyId} onChange={(e) => set('mosqueId', e.target.value)}>
            <option value="">{f.countyId ? (mosques.data?.length ? 'انتخاب کنید' : 'مسجدی برای این شهرستان ثبت نشده') : 'اول شهرستان را انتخاب کنید'}</option>
            {mosques.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : (
          <input id="mq" className="input" value={f.nearMosque} onChange={(e) => set('nearMosque', e.target.value)}
            placeholder={f.mosqueMode === 'none' ? 'نام نزدیک‌ترین مسجد به محل زندگی‌تان' : 'نام مسجد و محله'} />
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {f.mosqueMode !== 'other' && <button type="button" className="font-semibold text-leaf-ink" onClick={() => set('mosqueMode', 'other')}>مسجدم در فهرست نیست</button>}
          {f.mosqueMode !== 'none' && <button type="button" className="font-semibold text-leaf-ink" onClick={() => set('mosqueMode', 'none')}>عضو مسجدی نیستم</button>}
          {f.mosqueMode !== 'list' && <button type="button" className="font-semibold text-muted" onClick={() => set('mosqueMode', 'list')}>انتخاب از فهرست</button>}
        </div>
        {f.mosqueMode === 'none' && <p className="hint">اشکالی ندارد؛ نزدیک‌ترین مسجد را بنویسید تا برنامه‌های محله‌تان را ببینید.</p>}
        <E k="mosqueId" /><E k="nearMosque" />
      </div>
      <div className="field mt-4"><label htmlFor="inv">کد دعوت هسته <span className="font-normal text-muted">(اختیاری)</span></label>
        <input id="inv" className="input ltr" value={f.inviteCode} onChange={(e) => set('inviteCode', e.target.value)} placeholder="اگر امام محله یا مسئول هسته کدی داده" /></div>
      {err && <p className="err mt-4"><CircleAlert className="size-4" />{err}</p>}
      <button className="btn btn-primary btn-lg mt-6 w-full" disabled={busy}>{busy ? 'در حال ساخت حساب…' : 'ساخت حساب و ورود'}</button>
    </form>
  );
}

function Art() {
  return (
    <div className="relative hidden overflow-hidden lg:grid lg:place-items-center" style={{ background: 'radial-gradient(120% 90% at 100% 0%, #1F6FA8 0, #18406B 45%, #102A45 100%)' }}>
      <div className="absolute -bottom-40 -start-40 size-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(14,159,90,.45), transparent 65%)' }} />
      <div className="absolute -end-32 -top-32 size-[420px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(242,183,5,.25), transparent 65%)' }} />
      <div className="relative z-10 max-w-[520px] p-12 text-white">
        <h2 className="text-[clamp(30px,3.4vw,44px)] font-extrabold leading-snug text-white">یاد بگیرید،<br />در مسجد به کار ببندید.</h2>
        <p className="mt-4 text-lg leading-loose text-white/75">دوره‌های کوتاه برای کنشگران مسجد و هسته‌ها؛ با آزمون، مأموریت میدانی و گواهی معتبر.</p>
        <ul className="mt-8 grid gap-4">
          {[[ShieldCheck, 'گواهی با شناسهٔ استعلام', 'هر کسی می‌تواند درستی گواهی را بررسی کند'], [Smartphone, 'روی هر گوشی', 'بدون نصب برنامه؛ با اینترنت ضعیف هم']].map(([I, t, d]: any) => (
            <li key={t} className="flex items-center gap-4"><I className="size-10 shrink-0 rounded-xl bg-white/10 p-2.5 text-[#A9E1C7]" /><span><b className="block">{t}</b><span className="text-sm text-white/60">{d}</span></span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
