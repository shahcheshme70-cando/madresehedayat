import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPinned, Pencil, Plus, Trash2, UserRound, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Dialog, Empty, ErrorBox, Spinner, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fa } from '../../lib/fa';
import { PageHead } from './AdminShell';

type Layer = 'DEPUTY' | 'MANAGER' | 'REGIONAL' | 'PROVINCIAL' | 'COUNTY';
interface Pos {
  id: string; gender: 'MALE' | 'FEMALE'; layer: Layer; title: string; parentId: string | null; provinceId: string | null; countyId: string | null;
  holder: { id: string; firstName: string; lastName: string; mobile: string | null } | null; province: string | null; county: string | null;
  regionProvinces: { id: string; name: string }[]; learnerCount: number;
}
interface Province { id: string; name: string; counties: { id: string; name: string }[] }

const CHILD: Record<Layer, Layer | null> = { DEPUTY: 'MANAGER', MANAGER: 'REGIONAL', REGIONAL: 'PROVINCIAL', PROVINCIAL: 'COUNTY', COUNTY: null };
const FA: Record<Layer, string> = { DEPUTY: 'معاون راهیاری', MANAGER: 'مسئول راهیاری', REGIONAL: 'راهیار منطقه‌ای', PROVINCIAL: 'راهیار استانی', COUNTY: 'راهیار شهرستانی' };
const DOT: Record<Layer, string> = { DEPUTY: 'bg-ink', MANAGER: 'bg-deep', REGIONAL: 'bg-dome', PROVINCIAL: 'bg-leaf', COUNTY: 'bg-sprout' };

type Dlg = { kind: 'add'; parent: Pos | null; layer: Layer } | { kind: 'edit'; p: Pos } | { kind: 'provinces'; p: Pos } | null;

export default function RahyarTree() {
  const { has, me } = useAuth();
  const [g, setG] = useState<'MALE' | 'FEMALE'>(me?.gender === 'FEMALE' && !has('HQ_ADMIN') ? 'FEMALE' : 'MALE');
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['rahyar-tree', g], queryFn: () => api<Pos[]>(`/rahyar/tree?gender=${g}`) });
  const geo = useQuery({ queryKey: ['provinces'], queryFn: () => api<Province[]>('/geo/provinces'), staleTime: Infinity });
  const [dlg, setDlg] = useState<Dlg>(null);
  const done = (t: string) => { qc.invalidateQueries({ queryKey: ['rahyar-tree'] }); setDlg(null); toast(t); };
  const err = (e: unknown) => toast((e as Error).message, 'err');
  const del = useMutation({ mutationFn: (id: string) => api(`/rahyar/positions/${id}`, { method: 'DELETE' }), onSuccess: () => done('جایگاه حذف شد'), onError: err });
  const all = q.data ?? [];
  const kids = (id: string | null) => all.filter((p) => p.parentId === id).sort((a, b) => a.title.localeCompare(b.title, 'fa'));
  const deputy = all.find((p) => p.layer === 'DEPUTY');
  const editable = has('HQ_ADMIN') || (!!deputy?.holder && deputy.holder.id === me?.id);
  const taken = new Set(all.flatMap((p) => p.regionProvinces.map((r) => r.id)));
  const uncovered = (geo.data ?? []).filter((p) => !taken.has(p.id));

  const Node = ({ p, depth }: { p: Pos; depth: number }) => {
    const child = CHILD[p.layer];
    const ch = kids(p.id);
    return (
      <li className="grid gap-2">
        <div className="card flex flex-wrap items-center gap-3 p-3.5" style={{ marginInlineStart: `${Math.min(depth, 4) * 20}px` }}>
          <span className={`size-2.5 shrink-0 rounded-full ${DOT[p.layer]}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <b className="block text-ink">{p.title}</b>
            <span className="text-sm text-muted">{p.holder ? <><UserRound className="me-1 inline size-3.5" />{p.holder.firstName} {p.holder.lastName}{p.holder.mobile && <span dir="ltr" className="tnum ms-1">({fa(p.holder.mobile)})</span>}</> : <span className="text-flame-ink">بدون راهیار — مسئولیت با لایهٔ بالا</span>}</span>
            {p.layer === 'REGIONAL' && <div className="mt-1.5 flex flex-wrap gap-1">{p.regionProvinces.length ? p.regionProvinces.map((r) => <span key={r.id} className="chip h-6 text-xs">{r.name}</span>) : <span className="text-xs text-rose">استانی ندارد</span>}</div>}
          </div>
          <span className="chip tnum" title="کنشگرانی که مسئول مستقیمشان این جایگاه است"><UsersRound className="size-3.5" />{fa(p.learnerCount)}</span>
          {editable && <div className="flex gap-1">
            {child && <button className="btn btn-ghost btn-sm" onClick={() => setDlg({ kind: 'add', parent: p, layer: child })}><Plus className="size-4" /><span className="hidden sm:inline">{FA[child]}</span></button>}
            {p.layer === 'REGIONAL' && <button className="btn btn-ghost btn-icon btn-sm" aria-label="استان‌های منطقه" onClick={() => setDlg({ kind: 'provinces', p })}><MapPinned className="size-4" /></button>}
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="ویرایش" onClick={() => setDlg({ kind: 'edit', p })}><Pencil className="size-4" /></button>
            {!ch.length && <button className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف" onClick={() => del.mutate(p.id)}><Trash2 className="size-4" /></button>}
          </div>}
        </div>
        {ch.length > 0 && <ul className="grid gap-2">{ch.map((c) => <Node key={c.id} p={c} depth={depth + 1} />)}</ul>}
      </li>
    );
  };

  return (
    <div className="rise grid gap-6">
      <PageHead title="ساختار راهیاری" desc="دو درخت جدا: برادران و بانور. معاون → مسئول → منطقه‌ای → استانی → شهرستانی. جایگاه خالی، مسئولیتش با نزدیک‌ترین لایهٔ پرِ بالادست است.">
        <div className="seg">{([['MALE', 'برادران'], ['FEMALE', 'بانور']] as const).map(([k, t]) => <button key={k} aria-pressed={g === k} onClick={() => setG(k)}>{t}</button>)}</div>
      </PageHead>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : deputy ? (
        <>
          {uncovered.length > 0 && <p className="rounded-xl bg-flame-soft p-3 text-sm text-ink"><b className="text-flame-ink">استان‌های بی‌منطقه: </b>{uncovered.map((p) => p.name).join('، ')}. کنشگران این استان‌ها مستقیم با معاون‌اند تا به منطقه‌ای سپرده شوند.</p>}
          <ul className="grid gap-2"><Node p={deputy} depth={0} /></ul>
        </>
      ) : <Empty icon={UsersRound} title={`درخت ${g === 'MALE' ? 'برادران' : 'بانور'} هنوز ساخته نشده`}>{editable && <button className="btn btn-primary mt-2" onClick={() => setDlg({ kind: 'add', parent: null, layer: 'DEPUTY' })}><Plus className="size-4" />ساختن جایگاه معاون</button>}</Empty>}
      {dlg?.kind === 'add' && <AddDialog g={g} parent={dlg.parent} layer={dlg.layer} geo={geo.data ?? []} onClose={() => setDlg(null)} onDone={() => done('جایگاه ساخته شد')} />}
      {dlg?.kind === 'edit' && <EditDialog p={dlg.p} onClose={() => setDlg(null)} onDone={() => done('ذخیره شد')} />}
      {dlg?.kind === 'provinces' && <ProvDialog p={dlg.p} all={all} geo={geo.data ?? []} onClose={() => setDlg(null)} onDone={() => done('استان‌های منطقه ذخیره شد')} />}
    </div>
  );
}

function AddDialog({ g, parent, layer, geo, onClose, onDone }: { g: string; parent: Pos | null; layer: Layer; geo: Province[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  // استان‌های قابل انتخاب برای جایگاه استانی: استان‌های همان منطقه
  const provOptions = layer === 'PROVINCIAL' ? geo.filter((p) => !parent?.regionProvinces.length || parent.regionProvinces.some((r) => r.id === p.id)) : geo;
  const [f, setF] = useState({ title: '', provinceId: layer === 'COUNTY' ? parent?.provinceId ?? '' : '', countyId: '' });
  const counties = geo.find((p) => p.id === f.provinceId)?.counties ?? [];
  const m = useMutation({ mutationFn: () => api('/rahyar/positions', { body: { gender: g, layer, parentId: parent?.id, title: f.title || undefined, provinceId: f.provinceId || undefined, countyId: f.countyId || undefined } }), onSuccess: onDone, onError: (e) => toast((e as Error).message, 'err') });
  return (
    <Dialog open onClose={onClose} title={`${FA[layer]} تازه${parent ? ` زیر «${parent.title}»` : ''}`}>
      <div className="grid gap-4">
        {layer === 'PROVINCIAL' && <div className="field"><label htmlFor="pp">استان</label><select id="pp" className="input" value={f.provinceId} onChange={(e) => setF({ ...f, provinceId: e.target.value })}><option value="">انتخاب</option>{provOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {parent && !parent.regionProvinces.length && <span className="hint">اول استان‌های این منطقه را تعیین کنید.</span>}</div>}
        {layer === 'COUNTY' && <div className="field"><label htmlFor="cc">شهرستان</label><select id="cc" className="input" value={f.countyId} onChange={(e) => setF({ ...f, countyId: e.target.value })}><option value="">انتخاب</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <span className="hint">اگر یک شهرستان چند راهیار بخواهد، چند جایگاه بسازید؛ راهیار استان کنشگران را بینشان تقسیم می‌کند.</span></div>}
        <div className="field"><label htmlFor="tt">عنوان <span className="font-normal text-muted">(خالی = خودکار)</span></label><input id="tt" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={layer === 'MANAGER' ? 'مثلاً مسئول راهیاری شمال' : layer === 'REGIONAL' ? 'مثلاً منطقهٔ ۲' : ''} /></div>
        <button className="btn btn-primary w-fit" disabled={m.isPending || (layer === 'PROVINCIAL' && !f.provinceId) || (layer === 'COUNTY' && !f.countyId)} onClick={() => m.mutate()}>ساختن</button>
      </div>
    </Dialog>
  );
}

function EditDialog({ p, onClose, onDone }: { p: Pos; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(p.title);
  const [mobile, setMobile] = useState('');
  const m = useMutation({ mutationFn: (body: any) => api(`/rahyar/positions/${p.id}`, { method: 'PATCH', body }), onSuccess: onDone, onError: (e) => toast((e as Error).message, 'err') });
  return (
    <Dialog open onClose={onClose} title={p.title}>
      <div className="grid gap-5">
        <div className="field"><label htmlFor="et">عنوان جایگاه</label><div className="flex gap-2"><input id="et" className="input flex-1" value={title} onChange={(e) => setTitle(e.target.value)} /><button className="btn btn-secondary h-[46px]" disabled={title.trim().length < 2 || title === p.title} onClick={() => m.mutate({ title })}>ذخیره</button></div></div>
        <div className="field"><label htmlFor="hm">راهیار این جایگاه</label>
          <p className="text-sm text-body">{p.holder ? `اکنون: ${p.holder.firstName} ${p.holder.lastName}` : 'خالی است'}</p>
          <div className="flex gap-2"><input id="hm" className="input ltr tnum flex-1" dir="ltr" inputMode="tel" placeholder="شمارهٔ همراه، 09…" value={mobile} onChange={(e) => setMobile(e.target.value)} /><button className="btn btn-primary h-[46px]" disabled={mobile.trim().length < 10 || m.isPending} onClick={() => m.mutate({ holderMobile: mobile })}>گماشتن</button></div>
          <span className="hint">باید پیش‌تر در مدرسه حساب ساخته باشد و {p.gender === 'MALE' ? 'برادر' : 'خواهر'} باشد. نقش راهیار خودکار داده می‌شود.</span>
          {p.holder && <button className="btn btn-ghost btn-sm w-fit text-rose" onClick={() => m.mutate({ holderMobile: null })}>خالی کردن جایگاه</button>}
        </div>
      </div>
    </Dialog>
  );
}

function ProvDialog({ p, all, geo, onClose, onDone }: { p: Pos; all: Pos[]; geo: Province[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<string[]>(p.regionProvinces.map((r) => r.id));
  const owner = new Map(all.filter((x) => x.id !== p.id).flatMap((x) => x.regionProvinces.map((r) => [r.id, x.title] as const)));
  const m = useMutation({ mutationFn: () => api(`/rahyar/positions/${p.id}/provinces`, { method: 'PUT', body: { provinceIds: sel } }), onSuccess: onDone, onError: (e) => toast((e as Error).message, 'err') });
  return (
    <Dialog open onClose={onClose} title={`استان‌های ${p.title}`} wide>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{geo.map((g) => {
          const o = owner.get(g.id);
          return (
            <label key={g.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${o ? 'border-line opacity-50' : 'cursor-pointer border-line hover:border-line-strong'}`}>
              <input type="checkbox" className="size-4 accent-[var(--leaf)]" disabled={!!o} checked={sel.includes(g.id)} onChange={(e) => setSel(e.target.checked ? [...sel, g.id] : sel.filter((x) => x !== g.id))} />
              <span>{g.name}{o && <span className="block text-xs text-muted">{o}</span>}</span>
            </label>
          );
        })}</div>
        <p className="hint">هر استان فقط در یک منطقه است. جایگاه‌های استانی این استان‌ها خودکار زیر همین منطقه می‌روند.</p>
        <button className="btn btn-primary w-fit" disabled={m.isPending} onClick={() => m.mutate()}>ذخیره ({fa(sel.length)} استان)</button>
      </div>
    </Dialog>
  );
}
