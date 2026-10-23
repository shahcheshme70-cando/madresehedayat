import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Award, Check, KeyRound, Landmark, Plus, Route, Search, ShieldOff, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ago, fa, jDate, ROLE_LABEL } from '../../lib/fa';
import type { Role } from '../../lib/types';
import { PageHead } from './AdminShell';
import { JalaliInput } from '../../components/JalaliInput';
import { QuizBuilder } from './CourseEditor';
import type { AdminCourse } from './Courses';

const useCourses = () => useQuery({ queryKey: ['admin-courses'], queryFn: () => api<AdminCourse[]>('/admin/courses') });

/* ───────── مسیرها ───────── */
interface APath { id: string; title: string; description: string | null; published: boolean; quiz?: any; passScore?: number; courses: { courseId: string; title: string; status: string }[] }

export function Paths() {
  const q = useQuery({ queryKey: ['admin-paths'], queryFn: () => api<APath[]>('/admin/paths') });
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const create = useMutation({ mutationFn: () => api('/admin/paths', { body: { title } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-paths'] }); setOpen(false); setTitle(''); toast('مسیر ساخته شد'); } });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <div className="rise">
      <PageHead title="مسیرها" desc="مسیر چند دوره را به ترتیب کنار هم می‌گذارد. مسیر را از دوره‌های ثبت‌شده بسازید؛ فقط دوره‌های منتشرشده برای کنشگران دیده می‌شوند.">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="size-4" />مسیر تازه</button>
      </PageHead>
      {q.data!.length ? <div className="grid gap-4">{q.data!.map((p) => <PathEditor key={p.id} p={p} />)}</div> : <Empty icon={Route} title="هنوز مسیری نساخته‌اید" />}
      <Dialog open={open} onClose={() => setOpen(false)} title="مسیر تازه">
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (title.trim().length >= 2) create.mutate(); }}>
          <div className="field"><label htmlFor="pt">نام مسیر</label><input id="pt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
          <button className="btn btn-primary w-fit" disabled={create.isPending}>ساخت</button>
        </form>
      </Dialog>
    </div>
  );
}

function PathEditor({ p }: { p: APath }) {
  const courses = useCourses();
  const qc = useQueryClient();
  const toast = useToast();
  const [ids, setIds] = useState(p.courses.map((c) => c.courseId));
  const [f, setF] = useState({ title: p.title, description: p.description ?? '' });
  const [quiz, setQuiz] = useState<any>(p.quiz ?? { questions: [] });
  const [pass, setPass] = useState(p.passScore ?? 60);
  const [showQuiz, setShowQuiz] = useState(false);
  const [pick, setPick] = useState('');
  useEffect(() => setIds(p.courses.map((c) => c.courseId)), [p.courses]);
  const inval = () => qc.invalidateQueries({ queryKey: ['admin-paths'] });
  const save = async () => {
    try {
      await api(`/admin/paths/${p.id}`, { method: 'PATCH', body: { ...f, quiz: quiz.questions?.length ? quiz : null, passScore: pass } });
      await api(`/admin/paths/${p.id}/courses`, { method: 'PUT', body: { courseIds: ids } });
      inval(); toast('مسیر ذخیره شد');
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  const title = (id: string) => courses.data?.find((c) => c.id === id)?.title ?? '…';
  const status = (id: string) => courses.data?.find((c) => c.id === id)?.status;
  const mv = (i: number, d: number) => setIds((x) => { const y = [...x]; const j = i + d; if (j < 0 || j >= y.length) return x; [y[i], y[j]] = [y[j], y[i]]; return y; });
  return (
    <section className="card grid gap-3 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input h-10 min-w-0 flex-1 font-bold" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="نام مسیر" />
        <button className={`btn btn-sm ${p.published ? 'btn-secondary' : 'btn-primary'}`} onClick={() => api(`/admin/paths/${p.id}`, { method: 'PATCH', body: { published: !p.published } }).then(() => { inval(); toast(p.published ? 'از دید کنشگران برداشته شد' : 'مسیر منتشر شد'); })}>{p.published ? 'برداشتن از انتشار' : 'انتشار'}</button>
        <button className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف مسیر" onClick={() => { if (window.confirm('این مسیر حذف شود؟ دوره‌ها حذف نمی‌شوند.')) api(`/admin/paths/${p.id}`, { method: 'DELETE' }).then(inval); }}><Trash2 className="size-4" /></button>
      </div>
      <textarea className="input min-h-16" placeholder="توضیح کوتاه مسیر" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <ol className="grid gap-2">{ids.map((id, i) => (
        <li key={id} className="flex items-center gap-2 rounded-xl border border-line p-2">
          <span className="grid size-7 place-items-center rounded-full bg-sunken text-sm font-bold">{fa(i + 1)}</span>
          <span className="flex-1 text-sm font-semibold text-ink">{title(id)}</span>
          {status(id) !== 'PUBLISHED' && <span className="chip chip-flame">منتشر نشده</span>}
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="بالا" onClick={() => mv(i, -1)}><ArrowUp className="size-4" /></button>
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="پایین" onClick={() => mv(i, 1)}><ArrowDown className="size-4" /></button>
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="برداشتن" onClick={() => setIds((x) => x.filter((y) => y !== id))}><X className="size-4" /></button>
        </li>
      ))}</ol>
      <div className="flex gap-2"><select className="input h-10 flex-1" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">افزودن دوره به مسیر…</option>{courses.data?.filter((c) => !ids.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <button className="btn btn-secondary btn-sm h-10" disabled={!pick} onClick={() => { setIds((x) => [...x, pick]); setPick(''); }}><Plus className="size-4" /></button></div>
      <div className="rounded-xl border border-line p-3">
        <button type="button" className="flex w-full items-center justify-between text-sm font-bold text-ink" onClick={() => setShowQuiz((v) => !v)} aria-expanded={showQuiz}>
          <span>آزمون جامع مسیر {quiz.questions?.length ? <span className="chip chip-leaf ms-1">{fa(quiz.questions.length)} پرسش</span> : <span className="chip ms-1">ندارد</span>}</span><span className="text-muted">{showQuiz ? 'بستن' : 'ویرایش'}</span></button>
        {showQuiz && <div className="mt-3 grid gap-3">
          <p className="hint">پس از تمام شدن همهٔ دوره‌های مسیر باز می‌شود؛ قبولی = گواهی مسیر.</p>
          <div className="field w-40"><label htmlFor={`ps-${p.id}`}>نمرهٔ قبولی (٪)</label><input id={`ps-${p.id}`} className="input h-10 ltr" inputMode="numeric" value={pass} onChange={(e) => setPass(Math.max(0, Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0)))} /></div>
          <QuizBuilder c={quiz} set={setQuiz} />
        </div>}
      </div>
      <div><button className="btn btn-primary btn-sm" onClick={save}>ذخیرهٔ مسیر</button></div>
    </section>
  );
}

/* ───────── کاربران ───────── */
interface URow { id: string; mobile: string; firstName: string; lastName: string; gender: string | null; isActive: boolean; createdAt: string; county: string | null; province: string | null; mosque: string | null; nearMosque: string | null; roles: Role[]; courses: number }

export function UsersPage() {
  const { has } = useAuth();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDebounced(term); setPage(1); }, 350); return () => clearTimeout(t); }, [term]);
  const q = useQuery({ queryKey: ['admin-users', debounced, page], queryFn: () => api<{ total: number; rows: URow[] }>(`/admin/users?q=${encodeURIComponent(debounced)}&page=${page}`) });
  const [sel, setSel] = useState<URow | null>(null);
  return (
    <div className="rise">
      <PageHead title="کاربران و نقش‌ها" desc="نقش‌ها در خود مدرسه تعیین می‌شوند. مدیر ستاد می‌تواند نقش بدهد یا حسابی را غیرفعال کند." />
      <div className="relative mb-4 max-w-sm"><Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="input pe-9" placeholder="نام یا شماره" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="جست‌وجوی کاربر" /></div>
      {q.isLoading ? <Spinner /> : q.data?.rows.length ? (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-sunken text-start text-xs text-muted"><tr>{['نام', 'شماره', 'محل', 'نقش‌ها', 'دوره', 'عضویت'].map((h) => <th key={h} className="px-4 py-2.5 text-start font-bold">{h}</th>)}</tr></thead>
              <tbody>{q.data.rows.map((u) => (
                <tr key={u.id} className={`border-t border-line ${!u.isActive ? 'opacity-55' : ''}`}>
                  <td className="px-4 py-2.5"><button className="font-semibold text-ink hover:text-leaf-ink" onClick={() => setSel(u)}>{u.firstName} {u.lastName}</button>{!u.isActive && <span className="chip ms-2">غیرفعال</span>}</td>
                  <td className="tnum px-4 py-2.5" dir="ltr">{fa(u.mobile)}</td>
                  <td className="px-4 py-2.5 text-muted">{u.mosque ?? u.nearMosque ?? '—'}{u.county ? `، ${u.county}` : ''}</td>
                  <td className="px-4 py-2.5"><div className="flex flex-wrap gap-1">{u.roles.map((r) => <span key={r} className="chip chip-dome">{ROLE_LABEL[r]}</span>)}</div></td>
                  <td className="tnum px-4 py-2.5">{fa(u.courses)}</td>
                  <td className="px-4 py-2.5 text-muted">{ago(u.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm text-muted">
            <span>{fa(q.data.total)} کاربر</span>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</button>
            <button className="btn btn-ghost btn-sm" disabled={page * 50 >= q.data.total} onClick={() => setPage((p) => p + 1)}>بعدی</button>
          </div>
        </>
      ) : <Empty icon={Users} title="کاربری پیدا نشد" />}
      <Dialog open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.firstName} ${sel.lastName}` : ''}>{sel && <UserRoles u={sel} canEdit={has('HQ_ADMIN')} onDone={() => setSel(null)} />}</Dialog>
    </div>
  );
}

function UserRoles({ u, canEdit, onDone }: { u: URow; canEdit: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>(u.roles);
  const call = async (p: Promise<unknown>, msg: string) => { try { await p; qc.invalidateQueries({ queryKey: ['admin-users'] }); toast(msg); } catch (e) { toast((e as Error).message, 'err'); } };
  const toggle = (r: Role) => {
    if (roles.includes(r)) { setRoles((x) => x.filter((y) => y !== r)); call(api(`/admin/users/${u.id}/roles/${r}`, { method: 'DELETE' }), 'نقش برداشته شد'); }
    else { setRoles((x) => [...x, r]); call(api(`/admin/users/${u.id}/roles`, { body: { role: r } }), 'نقش داده شد'); }
  };
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted"><span dir="ltr" className="tnum">{fa(u.mobile)}</span> · {u.mosque ?? u.nearMosque ?? 'بدون مسجد'}{u.county ? ` · ${u.county}، ${u.province}` : ''} · {u.gender === 'FEMALE' ? 'خواهر' : u.gender === 'MALE' ? 'برادر' : ''}</p>
      <div><b className="mb-2 block text-ink">نقش‌ها</b>
        <div className="flex flex-wrap gap-2">{(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <button key={r} disabled={!canEdit} onClick={() => toggle(r)} aria-pressed={roles.includes(r)} className={`chip h-9 cursor-pointer px-3 ${roles.includes(r) ? 'chip-leaf' : ''}`}>{roles.includes(r) && <Check className="size-4" />}{ROLE_LABEL[r]}</button>
        ))}</div>
        <p className="hint mt-2">جایگاه راهیار (لایه و محدوده) از «ساختار راهیاری» و امام محله از «مساجد» تعیین می‌شود.</p></div>
      {canEdit && (roles.includes('HQ_ADMIN') || roles.includes('HQ_OPERATOR')) && <button className="btn btn-ghost btn-sm w-fit" onClick={() => call(api(`/admin/security/users/${u.id}/mfa-reset`, { method: 'POST' }), 'رمز دوم بازنشانی شد؛ در ورود بعدی دوباره راه می‌اندازد')}>بازنشانی رمز دوم (گوشی گم شده)</button>}
      {canEdit && <button className={`btn btn-sm w-fit ${u.isActive ? 'btn-ghost text-rose' : 'btn-secondary'}`} onClick={() => call(api(`/admin/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } }), u.isActive ? 'حساب غیرفعال شد' : 'حساب فعال شد').then(onDone)}>
        <ShieldOff className="size-4" />{u.isActive ? 'غیرفعال کردن حساب' : 'فعال کردن حساب'}</button>}
    </div>
  );
}

/* ───────── دسترسی ویژه ───────── */
interface Grant { id: string; courseTitle: string; user: string | null; network: string | null; note: string | null; expiresAt: string | null; createdAt: string }
interface Net { id: string; kind: string; name: string; underRahyar: boolean }

export function Grants() {
  const { has } = useAuth();
  const q = useQuery({ queryKey: ['admin-grants'], queryFn: () => api<Grant[]>('/admin/grants') });
  const nets = useQuery({ queryKey: ['admin-networks'], queryFn: () => api<Net[]>('/admin/networks') });
  const courses = useCourses();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ courseIds: [] as string[], target: 'mobiles' as 'mobiles' | 'network', mobiles: '', networkId: '', expiresAt: '', note: '' });
  const [missing, setMissing] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: () => api<{ created: number; missing: string[] }>('/admin/grants', { body: {
      courseIds: f.courseIds, note: f.note || undefined, expiresAt: f.expiresAt || undefined,
      ...(f.target === 'network' ? { networkId: f.networkId } : { mobiles: f.mobiles.split(/[\s,،]+/).filter(Boolean) }),
    } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['admin-grants'] }); toast(`${fa(r.created)} دسترسی ثبت شد`); setMissing(r.missing); if (!r.missing.length) setOpen(false); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const [orgFor, setOrgFor] = useState<Net | null>(null);
  const [orgMobile, setOrgMobile] = useState('');
  const setOrgAdmin = useMutation({
    mutationFn: () => api(`/admin/networks/${orgFor!.id}/admin`, { body: { mobile: orgMobile } }),
    onSuccess: () => { setOrgFor(null); toast('مدیر سازمان ثبت شد؛ از «پنل سازمان» اعضا را اضافه می‌کند'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const [netName, setNetName] = useState('');
  const [under, setUnder] = useState(true);
  const addNet = useMutation({ mutationFn: () => api('/admin/networks', { body: { kind: 'ORGANIZATION', name: netName, underRahyar: under } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-networks'] }); setNetName(''); toast('سازمان اضافه شد'); } });
  if (q.isLoading) return <Spinner />;
  const restricted = (courses.data ?? []).filter((c) => c.isRestricted);
  return (
    <div className="rise grid gap-6">
      <PageHead title="دسترسی ویژه" desc="دوره‌های «فقط برای مشترکان» را به یک یا چند نفر، یا به همهٔ افراد یک سازمان (مثل برکت) بدهید. پرداخت بیرون از سامانه انجام می‌شود.">
        {has('HQ_ADMIN') && <button className="btn btn-primary" onClick={() => { setMissing([]); setOpen(true); }}><Plus className="size-4" />دسترسی تازه</button>}
      </PageHead>
      {q.data?.length ? (
        <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="bg-sunken text-xs text-muted"><tr>{['دوره', 'به', 'تا', 'یادداشت', ''].map((h) => <th key={h} className="px-4 py-2.5 text-start font-bold">{h}</th>)}</tr></thead>
          <tbody>{q.data.map((g) => (
            <tr key={g.id} className="border-t border-line"><td className="px-4 py-2.5 font-semibold text-ink">{g.courseTitle}</td><td className="px-4 py-2.5">{g.network ? <span className="chip chip-dome">{g.network}</span> : g.user}</td>
              <td className="px-4 py-2.5 text-muted">{g.expiresAt ? jDate(g.expiresAt) : 'بی‌پایان'}</td><td className="px-4 py-2.5 text-muted">{g.note}</td>
              <td className="px-4 py-2.5">{has('HQ_ADMIN') && <button className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="لغو دسترسی" onClick={() => api(`/admin/grants/${g.id}`, { method: 'DELETE' }).then(() => qc.invalidateQueries({ queryKey: ['admin-grants'] }))}><Trash2 className="size-4" /></button>}</td></tr>
          ))}</tbody></table></div>
      ) : <Empty icon={KeyRound} title="هنوز دسترسی ویژه‌ای ثبت نشده" />}
      <section className="card grid gap-3 p-5">
        <h2 className="text-base font-extrabold">سازمان‌های مشترک</h2>
        <div className="flex flex-wrap gap-2">{nets.data?.map((n) => <span key={n.id} className="chip">{n.name}{n.kind === 'ORGANIZATION' ? (n.underRahyar ? ' · زیر شبکهٔ راهیاری' : ' · بدون راهیار') : ''}
          {n.kind === 'ORGANIZATION' && has('HQ_ADMIN') && <button className="font-bold text-leaf-ink" onClick={() => { setOrgFor(n); setOrgMobile(''); }}>· مدیر</button>}</span>)}</div>
        {has('HQ_ADMIN') && <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (netName.trim().length >= 2) addNet.mutate(); }}>
          <input className="input h-10 w-56" placeholder="نام سازمان، مثلاً برکت" value={netName} onChange={(e) => setNetName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={under} onChange={(e) => setUnder(e.target.checked)} />افرادش زیر شبکهٔ راهیاری باشند</label>
          <button className="btn btn-secondary btn-sm h-10">افزودن سازمان</button></form>}
      </section>
      <Dialog open={!!orgFor} onClose={() => setOrgFor(null)} title={`مدیر سازمان ${orgFor?.name ?? ''}`}>
        <div className="grid gap-3">
          <input className="input ltr tnum" dir="ltr" inputMode="tel" placeholder="09…" value={orgMobile} onChange={(e) => setOrgMobile(e.target.value)} aria-label="شمارهٔ همراه مدیر" />
          <p className="hint">مدیر سازمان پنل خودش را دارد: اعضا را با شماره اضافه می‌کند و فقط پیشرفت دوره‌های همین اشتراک را می‌بیند.</p>
          <button className="btn btn-primary w-fit" disabled={orgMobile.trim().length < 10 || setOrgAdmin.isPending} onClick={() => setOrgAdmin.mutate()}>ثبت</button>
        </div>
      </Dialog>
      <Dialog open={open} onClose={() => setOpen(false)} title="دسترسی تازه">
        <div className="grid gap-4">
          <div className="field"><span className="text-sm font-bold text-ink">دوره‌ها</span>
            {restricted.length ? <div className="grid gap-1.5">{restricted.map((c) => <label key={c.id} className="flex items-center gap-2"><input type="checkbox" checked={f.courseIds.includes(c.id)} onChange={(e) => setF({ ...f, courseIds: e.target.checked ? [...f.courseIds, c.id] : f.courseIds.filter((x) => x !== c.id) })} />{c.title}</label>)}</div>
              : <p className="hint">هیچ دوره‌ای «فقط برای مشترکان» نیست. اول در ویرایش دوره این گزینه را روشن کنید.</p>}</div>
          <div className="seg w-fit">{[['mobiles', 'به چند نفر'], ['network', 'به یک سازمان']].map(([k, t]) => <button key={k} aria-pressed={f.target === k} onClick={() => setF({ ...f, target: k as any })}>{t}</button>)}</div>
          {f.target === 'mobiles'
            ? <div className="field"><label htmlFor="mb">شماره‌ها <span className="font-normal text-muted">(هر خط یا با ویرگول)</span></label><textarea id="mb" className="input ltr tnum" value={f.mobiles} onChange={(e) => setF({ ...f, mobiles: e.target.value })} /></div>
            : <div className="field"><label htmlFor="nt">سازمان</label><select id="nt" className="input" value={f.networkId} onChange={(e) => setF({ ...f, networkId: e.target.value })}><option value="">انتخاب کنید</option>{nets.data?.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="ex">تا تاریخ <span className="font-normal text-muted">(اختیاری)</span></label><JalaliInput id="ex" optional withTime={false} label="تا تاریخ" value={f.expiresAt} onChange={(v) => setF({ ...f, expiresAt: v })} /></div>
            <div className="field"><label htmlFor="no">یادداشت</label><input id="no" className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="مثلاً قرارداد برکت ۱۴۰۵" /></div>
          </div>
          {missing.length > 0 && <p className="rounded-xl bg-flame-soft p-3 text-sm text-flame-ink">این شماره‌ها حساب ندارند یا نادرست‌اند: <span dir="ltr" className="tnum">{missing.join('، ')}</span>. پس از ثبت‌نام، دوباره دسترسی بدهید.</p>}
          <button className="btn btn-primary w-fit" disabled={!f.courseIds.length || (f.target === 'network' ? !f.networkId : !f.mobiles.trim()) || create.isPending} onClick={() => create.mutate()}>ثبت دسترسی</button>
        </div>
      </Dialog>
    </div>
  );
}

/* ───────── گواهی‌ها ───────── */
interface ACert { id: string; code: string; holderName: string; courseTitle: string; score: number | null; issuedAt: string; revokedAt: string | null }
export function Certificates() {
  const { has } = useAuth();
  const [term, setTerm] = useState('');
  const q = useQuery({ queryKey: ['admin-certs', term], queryFn: () => api<ACert[]>(`/admin/certificates?q=${encodeURIComponent(term)}`) });
  const qc = useQueryClient();
  return (
    <div className="rise">
      <PageHead title="گواهی‌ها" desc="گواهی‌ها را مدرسه صادر می‌کند. هر گواهی شناسهٔ استعلام دارد که در صفحهٔ عمومی استعلام بررسی می‌شود." />
      <div className="relative mb-4 max-w-sm"><Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="input pe-9" placeholder="شناسه، نام یا دوره" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="جست‌وجوی گواهی" /></div>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="bg-sunken text-xs text-muted"><tr>{['شناسه', 'دارنده', 'دوره', 'نمره', 'تاریخ', ''].map((h) => <th key={h} className="px-4 py-2.5 text-start font-bold">{h}</th>)}</tr></thead>
          <tbody>{q.data.map((c) => (
            <tr key={c.id} className={`border-t border-line ${c.revokedAt ? 'opacity-55' : ''}`}>
              <td className="tnum px-4 py-2.5" dir="ltr">{c.code}</td><td className="px-4 py-2.5 font-semibold text-ink">{c.holderName}</td><td className="px-4 py-2.5">{c.courseTitle}</td>
              <td className="tnum px-4 py-2.5">{c.score != null ? fa(c.score) : '—'}</td><td className="px-4 py-2.5 text-muted">{jDate(c.issuedAt)}</td>
              <td className="px-4 py-2.5">{has('HQ_ADMIN') && <button className="btn btn-ghost btn-sm" onClick={() => { if (c.revokedAt || window.confirm('این گواهی باطل شود؟')) api(`/admin/certificates/${c.code}/revoke`, { body: { revoke: !c.revokedAt } }).then(() => qc.invalidateQueries({ queryKey: ['admin-certs'] })); }}>{c.revokedAt ? 'بازگرداندن' : 'ابطال'}</button>}</td>
            </tr>
          ))}</tbody></table></div>
      ) : <Empty icon={Award} title="گواهی‌ای پیدا نشد" />}
    </div>
  );
}

/* ───────── مساجد ───────── */
interface AMosque { id: string; name: string; verified: boolean; county: string; province: string; createdAt: string; imam: string | null }
interface Province { id: string; name: string; counties: { id: string; name: string }[] }
export function Mosques() {
  const [onlyNew, setOnlyNew] = useState(false);
  const q = useQuery({ queryKey: ['admin-mosques', onlyNew], queryFn: () => api<AMosque[]>(`/admin/mosques${onlyNew ? '?unverified=1' : ''}`) });
  const geo = useQuery({ queryKey: ['provinces'], queryFn: () => api<Province[]>('/geo/provinces'), staleTime: Infinity });
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: '', provinceId: '', countyId: '' });
  const counties = geo.data?.find((p) => p.id === f.provinceId)?.counties ?? [];
  const [imamFor, setImamFor] = useState<AMosque | null>(null);
  const [imamMobile, setImamMobile] = useState('');
  const setImam = useMutation({
    mutationFn: () => api(`/admin/mosques/${imamFor!.id}/imam`, { body: { mobile: imamMobile } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-mosques'] }); setImamFor(null); setImamMobile(''); toast('امام محله ثبت شد'); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const add = useMutation({ mutationFn: () => api('/admin/mosques', { body: { name: f.name, countyId: f.countyId } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-mosques'] }); setF({ ...f, name: '' }); toast('مسجد اضافه شد'); } });
  return (
    <div className="rise grid gap-6">
      <PageHead title="مساجد" desc="فهرست مساجدی که کنشگران هنگام ثبت‌نام انتخاب می‌کنند." />
      <form className="card flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (f.name.trim() && f.countyId) add.mutate(); }}>
        <div className="field min-w-48 flex-1"><label htmlFor="mn">نام مسجد</label><input id="mn" className="input h-10" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="mp">استان</label><select id="mp" className="input h-10" value={f.provinceId} onChange={(e) => setF({ ...f, provinceId: e.target.value, countyId: '' })}><option value="">انتخاب</option>{geo.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field"><label htmlFor="mc">شهرستان</label><select id="mc" className="input h-10" value={f.countyId} onChange={(e) => setF({ ...f, countyId: e.target.value })}><option value="">انتخاب</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <button className="btn btn-primary h-10"><Plus className="size-4" />افزودن</button>
      </form>
      <div className="seg w-fit"><button aria-pressed={!onlyNew} onClick={() => setOnlyNew(false)}>همه</button><button aria-pressed={onlyNew} onClick={() => setOnlyNew(true)}>منتظر تأیید</button></div>
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <div className="card overflow-hidden"><ul>{q.data.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"><Landmark className="size-4 text-muted" /><span className="flex-1"><b className="text-ink">{m.name}</b> <span className="text-sm text-muted">· {m.county}، {m.province}</span>{m.imam && <span className="block text-xs text-muted">امام محله: {m.imam}</span>}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setImamFor(m); setImamMobile(''); }}>{m.imam ? 'تغییر امام' : 'تعیین امام'}</button>
            {m.verified ? <span className="chip chip-leaf">تأییدشده</span> : <button className="btn btn-secondary btn-sm" onClick={() => api(`/admin/mosques/${m.id}/verify`, { method: 'POST' }).then(() => qc.invalidateQueries({ queryKey: ['admin-mosques'] }))}>تأیید</button>}</li>
        ))}</ul></div>
      ) : <Empty icon={Landmark} title="مسجدی نیست" />}
      <Dialog open={!!imamFor} onClose={() => setImamFor(null)} title={`امام محلهٔ ${imamFor?.name ?? ''}`}>
        <div className="grid gap-3">
          <div className="field"><label htmlFor="im">شمارهٔ همراه امام</label><input id="im" className="input ltr tnum" dir="ltr" inputMode="tel" value={imamMobile} onChange={(e) => setImamMobile(e.target.value)} placeholder="09…" /><span className="hint">باید پیش‌تر در مدرسه ثبت‌نام کرده باشد. امام از «مسجد من» هسته می‌سازد و پیوند دعوت می‌فرستد.</span></div>
          <div className="flex gap-2"><button className="btn btn-primary" disabled={imamMobile.trim().length < 10 || setImam.isPending} onClick={() => setImam.mutate()}>ثبت</button>
            {imamFor?.imam && <button className="btn btn-ghost text-rose" onClick={() => api(`/admin/mosques/${imamFor.id}/imam`, { body: {} }).then(() => { qc.invalidateQueries({ queryKey: ['admin-mosques'] }); setImamFor(null); })}>برداشتن امام</button>}</div>
        </div>
      </Dialog>
    </div>
  );
}

/* ───────── گزارش تغییرات ───────── */
export function Audit() {
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => api<{ id: string; action: string; target: string | null; createdAt: string; actor: string }[]>('/admin/audit') });
  if (q.isLoading) return <Spinner />;
  return (
    <div className="rise">
      <PageHead title="گزارش تغییرات" desc="صد تغییر آخر کارکنان در مدرسه." />
      <div className="card overflow-hidden"><ul>{q.data?.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0"><b className="text-ink">{a.actor}</b><code className="rounded bg-sunken px-1.5" dir="ltr">{a.action}</code><span className="text-muted" dir="ltr">{a.target}</span><span className="ms-auto text-muted">{ago(a.createdAt)}</span></li>
      ))}</ul></div>
    </div>
  );
}
