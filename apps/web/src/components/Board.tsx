import { AlertTriangle, CheckCircle2, Plus, RefreshCw, Timer, Trophy, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fa, toEn } from '../lib/fa';

/* شکل داده‌ها همان نمونهٔ اولیه است: یادداشت‌های هر خانه (n)، خانه‌های متنی (f) و جدول‌های ویژه */
export interface Note { t: string; d?: boolean }
export interface BoardData {
  n: Record<string, Note[]>; f: Record<string, string>;
  dm?: { opts: string[]; crit: { t: string; w: number }[]; s: Record<string, number> };
  raci?: { tasks: string[]; roles: string[]; m: Record<string, string> };
  bud?: { rows: { t: string; p: number; q: number }[]; ppl: number };
}
export interface Cell { k: string; h: string; ph?: string }
export interface Tool {
  id: string; t: string; en: string; cat: string; ic: string; lay: string; d: string; use: string; how: string[];
  f?: [string, string, string?][]; cells?: Cell[]; ax?: { x: [string, string]; y: [string, string] }; center?: string; flow?: number; hats?: number;
  rows?: string[]; cols?: string[]; dm?: BoardData['dm']; raci?: { tasks: string[]; roles: string[] }; bud?: BoardData['bud'];
  ex?: Partial<BoardData> & { f?: Record<string, string>; n?: Record<string, string[]>; dm?: { s: Record<string, number> }; raci?: { m: Record<string, string> } };
  published?: boolean;
}

export function emptyBoard(t: Tool): BoardData {
  const d: BoardData = { n: {}, f: {} };
  if (t.dm) d.dm = { opts: [...t.dm.opts], crit: t.dm.crit.map((c) => ({ ...c })), s: {} };
  if (t.raci) d.raci = { tasks: [...t.raci.tasks], roles: [...t.raci.roles], m: {} };
  if (t.bud) d.bud = { rows: t.bud.rows.map((r) => ({ ...r })), ppl: t.bud.ppl };
  return d;
}

/** نمونهٔ پرشده روی نوشته‌های کاربر اضافه می‌شود (چیزی پاک نمی‌شود) */
export function withExample(t: Tool, d: BoardData): BoardData {
  const ex = t.ex as any; if (!ex) return d;
  const n = { ...d.n };
  for (const [k, items] of Object.entries(ex.n ?? {})) n[k] = [...(n[k] ?? []), ...(items as string[]).map((x) => ({ t: x }))];
  const f = { ...d.f };
  for (const [k, v] of Object.entries(ex.f ?? {})) if (!String(f[k] ?? '').trim()) f[k] = v as string;
  const out: BoardData = { ...d, n, f };
  if (ex.dm && d.dm) out.dm = { ...d.dm, s: { ...ex.dm.s, ...d.dm.s } };
  if (ex.raci && d.raci) out.raci = { ...d.raci, m: { ...ex.raci.m, ...d.raci.m } };
  return out;
}

export const boardCount = (d: BoardData) =>
  Object.values(d.n).reduce((s, a) => s + a.length, 0) + Object.values(d.f).filter((v) => String(v).trim()).length + Object.keys(d.dm?.s ?? {}).length + Object.keys(d.raci?.m ?? {}).length;

const nf = (n: number) => fa(Math.round(n).toLocaleString('en-US'));
const HAT = ['bg-white text-ink border-line-strong', 'bg-rose-soft', 'bg-ink/90 text-white', 'bg-flame-soft', 'bg-leaf-soft', 'bg-dome-soft'];

export function Board({ tool: t, data: d, onChange, readOnly }: { tool: Tool; data: BoardData; onChange?: (d: BoardData) => void; readOnly?: boolean }) {
  const set = (fn: (x: BoardData) => BoardData) => { if (!readOnly && onChange) onChange(fn(structuredClone(d))); };
  const cs = t.cells ?? [];

  const field = ({ k, label, ph, area }: { k: string; label: string; ph?: string; area?: boolean }) => (
    <label key={k} className="grid gap-1">
      <span className="text-sm font-bold text-ink">{label}</span>
      {readOnly ? <p className="min-h-6 whitespace-pre-line text-body">{d.f[k] || <span className="text-muted">—</span>}</p>
        : area ? <AutoArea value={d.f[k] ?? ''} placeholder={ph} onChange={(v) => set((x) => ({ ...x, f: { ...x.f, [k]: v } }))} />
        : <input className="input" value={d.f[k] ?? ''} placeholder={ph} onChange={(e) => set((x) => ({ ...x, f: { ...x.f, [k]: e.target.value } }))} />}
    </label>
  );

  const notes = ({ c, cls = '', editHead }: { c: Cell; cls?: string; editHead?: boolean; key?: string }) => {
    const ns = d.n[c.k] ?? [];
    return (
      <div key={c.k} className={`bcell ${cls}`}>
        <div className="flex items-center gap-2">
          {editHead && !readOnly ? <input className="bhin" value={d.f['h_' + c.k] ?? ''} placeholder={c.h} aria-label={`عنوان ${c.h}`} onChange={(e) => set((x) => ({ ...x, f: { ...x.f, ['h_' + c.k]: e.target.value } }))} />
            : <b className="flex-1 text-sm">{editHead ? d.f['h_' + c.k] || c.h : c.h}</b>}
          {ns.length > 0 && <span className="tnum rounded-full bg-black/5 px-2 text-xs font-bold">{fa(ns.length)}</span>}
        </div>
        <div className="grid gap-1.5">
          {ns.map((n, i) => (
            <span key={i} className={`note ${n.d ? 'done' : ''}`}>
              {t.lay === 'check' && <input type="checkbox" className="size-4 accent-[var(--leaf)]" checked={!!n.d} disabled={readOnly} aria-label="انجام شد"
                onChange={(e) => set((x) => { x.n[c.k][i].d = e.target.checked; return x; })} />}
              <span className="flex-1">{n.t}</span>
              {!readOnly && <button type="button" className="nx" aria-label="حذف" onClick={() => set((x) => { x.n[c.k] = x.n[c.k].filter((_, j) => j !== i); return x; })}><X className="size-3.5" /></button>}
            </span>
          ))}
        </div>
        {!readOnly && <AddNote ph={c.ph ?? 'یک مورد بنویسید…'} label={c.h} onAdd={(v) => set((x) => ({ ...x, n: { ...x.n, [c.k]: [...(x.n[c.k] ?? []), { t: v }] } }))} />}
      </div>
    );
  };

  let body: ReactNode = null;
  switch (t.lay) {
    case 'quad':
      body = (
        <div className={`bquad ${t.ax ? 'ax' : ''}`}>
          {t.ax && <><span className="axx a1">{t.ax.x[0]}</span><span className="axx a2">{t.ax.x[1]}</span><span className="axy a1">{t.ax.y[0]}</span><span className="axy a2">{t.ax.y[1]}</span></>}
          {cs.map((c) => notes({ c: c }))}
          {t.center && t.f && <div className="qctr">{field({ k: t.f[0][0], label: t.f[0][1], ph: t.f[0][2] })}</div>}
        </div>
      );
      break;
    case 'cols':
      body = <div className={`bcols ${t.flow ? 'flow' : ''}`} style={{ ['--n' as string]: cs.length }}>{cs.map((c, i) => notes({ c: c, cls: t.hats ? HAT[i] : '' }))}</div>;
      break;
    case 'check': {
      const all = cs.flatMap((c) => d.n[c.k] ?? []), done = all.filter((n) => n.d).length;
      body = <>
        <div className="bcols" style={{ ['--n' as string]: cs.length }}>{cs.map((c) => notes({ c: c }))}</div>
        {all.length > 0 && <div className="mt-3 flex items-center gap-3"><div className="bar flex-1"><span style={{ width: `${(done / all.length) * 100}%` }} /></div><span className="tnum text-sm">{fa(done)} از {fa(all.length)} انجام شد</span></div>}
      </>;
      break;
    }
    case 'fish':
      body = (
        <div className="bfish">
          <div className="fhead">{field({ k: 'head', label: 'مسئله (سر ماهی)', ph: t.f?.[0]?.[2], area: true })}</div>
          <div className="fbones">{cs.map((c, i) => notes({ c, cls: i < 3 ? 'up' : 'dn' }))}<i className="spine" aria-hidden="true" /></div>
        </div>
      );
      break;
    case 'chain':
      body = <div className="bchain">{(t.f ?? []).map(([k, l, ph], i) => (
        <div key={k} className={`link ${i === 0 ? 'first' : i === (t.f!.length - 1) ? 'root' : ''}`}><span className="ln">{i === 0 ? <AlertTriangle className="size-4" /> : fa(i)}</span><div className="flex-1">{field({ k: k, label: l, ph: ph || (i ? 'چون…' : '') })}</div></div>
      ))}</div>;
      break;
    case 'tree':
      body = <div className="btree">{notes({ c: cs[0], cls: 'tb-e' })}<div className="trunk">{field({ k: 'core', label: t.f![0][1], ph: t.f![0][2], area: true })}</div>{notes({ c: cs[1], cls: 'tb-c' })}</div>;
      break;
    case 'layers':
      body = <div className="blayers">{cs.map((c, i) => notes({ c: c, cls: `ly ly${i}` }))}</div>;
      break;
    case 'ff':
      body = <div className="bff">{notes({ c: cs[0], cls: 'ffd' })}<div className="ffgoal">{field({ k: 'goal', label: t.f![0][1], ph: t.f![0][2], area: true })}</div>{notes({ c: cs[1], cls: 'ffr' })}</div>;
      break;
    case 'cycle':
      body = <div className="bcycle">{cs.map((c, i) => notes({ c: c, cls: `cy${i}` }))}<span className="cyc" aria-hidden="true"><RefreshCw className="size-6" /></span></div>;
      break;
    case 'mind':
      body = <div className="bmind">{cs.slice(0, 4).map((c) => notes({ c: c, editHead: true }))}<div className="mctr">{field({ k: 'center', label: t.f![0][1], ph: t.f![0][2], area: true })}</div>{cs.slice(4).map((c) => notes({ c: c, editHead: true }))}</div>;
      break;
    case 'form':
      body = <>
        <div className="grid gap-4 md:grid-cols-2">{(t.f ?? []).map(([k, l, ph]) => field({ k: k, label: l, ph: ph, area: true }))}</div>
        {t.id === 'smart' && <div className="mt-4 rounded-2xl bg-leaf-soft p-4">{d.f.s ? <><b className="text-xs text-leaf-ink">جملهٔ هدف</b><p className="mt-1 text-ink">«{d.f.s}{d.f.m ? `؛ با این نشانه که ${d.f.m}` : ''}{d.f.t ? `، ${d.f.t}` : ''}.»{d.f.a && <span className="text-muted"> با {d.f.a}.</span>}</p></> : <span className="text-sm text-muted">با پر کردن خانه‌ها، جملهٔ هدف اینجا ساخته می‌شود.</span>}</div>}
      </>;
      break;
    case 'grid8':
      body = <>{!readOnly && <EightTimer />}<div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => (
        <label key={i} className="grid gap-1 rounded-2xl border border-line bg-card p-3"><span className="tnum text-xs font-bold text-muted">{fa(i + 1)}</span>
          {readOnly ? <p className="min-h-16 text-body">{d.f['g' + i] ?? ''}</p> : <AutoArea value={d.f['g' + i] ?? ''} placeholder={`ایدهٔ ${fa(i + 1)}`} onChange={(v) => set((x) => ({ ...x, f: { ...x.f, ['g' + i]: v } }))} />}</label>
      ))}</div></>;
      break;
    case 'rc':
      body = <div className="overflow-x-auto"><table className="brc"><thead><tr><th />{t.cols!.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{t.rows!.map((r, ri) => (
        <tr key={r}><th>{r}</th>{t.cols!.map((c, ci) => <td key={c}>{readOnly ? <p className="whitespace-pre-line">{d.f[`${ri}_${ci}`] ?? ''}</p> : <AutoArea value={d.f[`${ri}_${ci}`] ?? ''} label={`${r} · ${c}`} onChange={(v) => set((x) => ({ ...x, f: { ...x.f, [`${ri}_${ci}`]: v } }))} />}</td>)}</tr>
      ))}</tbody></table></div>;
      break;
    case 'raci': {
      const R = d.raci!;
      const bad = R.tasks.map((tk, ri) => [tk, R.roles.filter((_, ci) => R.m[`${ri}_${ci}`] === 'A').length] as const).filter(([tk, n]) => tk && n !== 1);
      body = <>
        <div className="overflow-x-auto"><table className="brc"><thead><tr><th>کار</th>{R.roles.map((r, ci) => <th key={ci}>{readOnly ? r : <input className="bhin" value={r} aria-label={`نقش ${fa(ci + 1)}`} onChange={(e) => set((x) => { x.raci!.roles[ci] = e.target.value; return x; })} />}</th>)}
          {!readOnly && <th><button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="نقش تازه" onClick={() => set((x) => { x.raci!.roles.push('نقش تازه'); return x; })}><Plus className="size-4" /></button></th>}</tr></thead>
          <tbody>{R.tasks.map((tk, ri) => (
            <tr key={ri}><th>{readOnly ? tk : <input className="bhin" value={tk} aria-label={`کار ${fa(ri + 1)}`} onChange={(e) => set((x) => { x.raci!.tasks[ri] = e.target.value; return x; })} />}</th>
              {R.roles.map((r, ci) => { const v = R.m[`${ri}_${ci}`] ?? ''; return <td key={ci} className="text-center">{readOnly ? <b className={`raci-${v}`}>{v}</b> : (
                <select className={`input h-9 w-16 px-1 text-center font-bold raci-${v}`} value={v} aria-label={`${tk} · ${r}`} onChange={(e) => set((x) => { if (e.target.value) x.raci!.m[`${ri}_${ci}`] = e.target.value; else delete x.raci!.m[`${ri}_${ci}`]; return x; })}>
                  <option value="" />{['R', 'A', 'C', 'I'].map((o) => <option key={o}>{o}</option>)}</select>)}</td>; })}
              {!readOnly && <td><button type="button" className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف کار" onClick={() => set((x) => { x.raci!.tasks.splice(ri, 1); const m: Record<string, string> = {}; Object.entries(x.raci!.m).forEach(([k, v]) => { const [a, b] = k.split('_').map(Number); if (a !== ri) m[`${a > ri ? a - 1 : a}_${b}`] = v; }); x.raci!.m = m; return x; })}><X className="size-4" /></button></td>}</tr>
          ))}</tbody></table></div>
        <div className="mt-2 flex flex-wrap items-center gap-3">{!readOnly && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set((x) => { x.raci!.tasks.push(''); return x; })}><Plus className="size-4" />کار تازه</button>}<span className="text-xs text-muted"><b>R</b> انجام می‌دهد · <b>A</b> پاسخ‌گوست · <b>C</b> مشورت می‌دهد · <b>I</b> در جریان است</span></div>
        {R.tasks.length > 0 && (bad.length ? <p className="mt-3 flex gap-2 rounded-xl bg-flame-soft p-3 text-sm"><AlertTriangle className="size-4 shrink-0 text-flame-ink" />هر کار دقیقاً یک «A» لازم دارد: {bad.map(([tk, n]) => `«${tk}» ${n ? fa(n) + ' پاسخ‌گو دارد' : 'پاسخ‌گو ندارد'}`).join('، ')}.</p>
          : <p className="mt-3 flex gap-2 rounded-xl bg-leaf-soft p-3 text-sm"><CheckCircle2 className="size-4 shrink-0 text-leaf" />همهٔ کارها یک پاسخ‌گوی روشن دارند.</p>)}
      </>;
      break;
    }
    case 'dm': {
      const D = d.dm!;
      const tot = D.opts.map((_, ri) => D.crit.reduce((s, c, ci) => s + (+D.s[`${ri}_${ci}`] || 0) * (+c.w || 1), 0));
      const mx = D.crit.reduce((s, c) => s + 5 * (+c.w || 1), 0), best = Math.max(0, ...tot), bi = tot.indexOf(best);
      body = <>
        <div className="overflow-x-auto"><table className="brc"><thead><tr><th>گزینه</th>{D.crit.map((c, ci) => (
          <th key={ci}>{readOnly ? <>{c.t} <span className="text-xs text-muted">(وزن {fa(c.w)})</span></> : <div className="grid gap-1"><input className="bhin" value={c.t} aria-label={`معیار ${fa(ci + 1)}`} onChange={(e) => set((x) => { x.dm!.crit[ci].t = e.target.value; return x; })} />
            <label className="flex items-center gap-1 text-xs font-normal text-muted">وزن<select className="input h-8 w-14 px-1" value={c.w} onChange={(e) => set((x) => { x.dm!.crit[ci].w = +e.target.value; return x; })}>{[1, 2, 3].map((w) => <option key={w} value={w}>{fa(w)}</option>)}</select></label></div>}</th>
        ))}<th>جمع وزنی</th>{!readOnly && <th />}</tr></thead>
          <tbody>{D.opts.map((o, ri) => (
            <tr key={ri}><th>{readOnly ? o : <input className="bhin" value={o} aria-label={`گزینه ${fa(ri + 1)}`} onChange={(e) => set((x) => { x.dm!.opts[ri] = e.target.value; return x; })} />}</th>
              {D.crit.map((c, ci) => <td key={ci} className="text-center">{readOnly ? fa(D.s[`${ri}_${ci}`] ?? '—') : (
                <select className="input h-9 w-16 px-1 text-center" value={D.s[`${ri}_${ci}`] ?? ''} aria-label={`امتیاز ${o} در ${c.t}`} onChange={(e) => set((x) => { if (e.target.value) x.dm!.s[`${ri}_${ci}`] = +e.target.value; else delete x.dm!.s[`${ri}_${ci}`]; return x; })}>
                  <option value="">—</option>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{fa(v)}</option>)}</select>)}</td>)}
              <td className="tnum text-center font-bold">{tot[ri] ? fa(tot[ri]) : '—'}</td>
              {!readOnly && <td><button type="button" className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف گزینه" onClick={() => set((x) => { x.dm!.opts.splice(ri, 1); const s: Record<string, number> = {}; Object.entries(x.dm!.s).forEach(([k, v]) => { const [a, b] = k.split('_').map(Number); if (a !== ri) s[`${a > ri ? a - 1 : a}_${b}`] = v; }); x.dm!.s = s; return x; })}><X className="size-4" /></button></td>}</tr>
          ))}</tbody></table></div>
        {!readOnly && <div className="mt-2 flex gap-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => set((x) => { x.dm!.opts.push(''); return x; })}><Plus className="size-4" />گزینهٔ تازه</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => set((x) => { x.dm!.crit.push({ t: 'معیار تازه', w: 1 }); return x; })}><Plus className="size-4" />معیار تازه</button></div>}
        {best > 0 && <p className="mt-3 flex gap-2 rounded-xl bg-leaf-soft p-3 text-sm"><Trophy className="size-4 shrink-0 text-leaf" /><span>بالاترین جمع وزنی: <b>{D.opts[bi]}</b> با {fa(best)} از {fa(mx)}. عدد پایان گفت‌وگو نیست؛ دلیل امتیازها را با تیم مرور کنید.</span></p>}
      </>;
      break;
    }
    case 'budget': {
      const B = d.bud!;
      const tot = B.rows.reduce((s, r) => s + (+r.p || 0) * (+r.q || 0), 0);
      const big = [...B.rows].sort((a, b) => b.p * b.q - a.p * a.q)[0];
      const num = (v: string) => +toEn(v).replace(/[^\d]/g, '') || 0;
      body = <>
        <div className="overflow-x-auto"><table className="brc"><thead><tr><th>هزینه</th><th>قیمت واحد (تومان)</th><th>تعداد</th><th>جمع</th>{!readOnly && <th />}</tr></thead>
          <tbody>{B.rows.map((r, ri) => (
            <tr key={ri}><th>{readOnly ? r.t : <input className="bhin" value={r.t} aria-label="عنوان هزینه" onChange={(e) => set((x) => { x.bud!.rows[ri].t = e.target.value; return x; })} />}</th>
              <td>{readOnly ? nf(r.p) : <input className="input h-9 tnum" inputMode="numeric" value={fa(r.p)} aria-label="قیمت واحد" onChange={(e) => set((x) => { x.bud!.rows[ri].p = num(e.target.value); return x; })} />}</td>
              <td>{readOnly ? fa(r.q) : <input className="input h-9 w-20 tnum" inputMode="numeric" value={fa(r.q)} aria-label="تعداد" onChange={(e) => set((x) => { x.bud!.rows[ri].q = num(e.target.value); return x; })} />}</td>
              <td className="tnum font-bold">{nf((+r.p || 0) * (+r.q || 0))}</td>
              {!readOnly && <td><button type="button" className="btn btn-ghost btn-icon btn-sm text-rose" aria-label="حذف ردیف" onClick={() => set((x) => { x.bud!.rows.splice(ri, 1); return x; })}><X className="size-4" /></button></td>}</tr>
          ))}</tbody></table></div>
        <div className="mt-2 flex flex-wrap items-center gap-3">{!readOnly && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set((x) => { x.bud!.rows.push({ t: '', p: 0, q: 1 }); return x; })}><Plus className="size-4" />ردیف تازه</button>}
          <label className="flex items-center gap-2 text-sm text-muted">شرکت‌کننده‌ها {readOnly ? <b>{fa(B.ppl)}</b> : <input className="input h-9 w-20 tnum" inputMode="numeric" value={fa(B.ppl)} onChange={(e) => set((x) => { x.bud!.ppl = num(e.target.value); return x; })} />}</label></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{[['جمع کل', `${nf(tot)} تومان`], ['سهم هر نفر', B.ppl ? `${nf(tot / B.ppl)} تومان` : '—'], ['بزرگ‌ترین هزینه', big?.t || '—']].map(([a, b]) => <div key={a} className="rounded-2xl bg-sunken p-3"><span className="text-xs text-muted">{a}</span><b className="tnum block text-ink">{b}</b></div>)}</div>
      </>;
      break;
    }
  }
  return <div className={`board lay-${t.lay}`}>{body}</div>;
}

function AddNote({ ph, label, onAdd }: { ph: string; label: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form className="addn" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(''); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={ph} aria-label={`افزودن به ${label}`} />
      <button type="submit" aria-label="افزودن" disabled={!v.trim()}><Plus className="size-4" /></button>
    </form>
  );
}

/** متن چندخطی که با نوشتن بلند می‌شود؛ تغییر را با کمی تأخیر بالا می‌فرستد تا تایپ روان بماند */
function AutoArea({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const t = useRef<number>(0);
  useEffect(() => { if (document.activeElement !== ref.current) setV(value); }, [value]);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }, [v]);
  return <textarea ref={ref} className="input min-h-[46px] resize-none py-2 leading-7" rows={1} value={v} placeholder={placeholder} aria-label={label}
    onChange={(e) => { setV(e.target.value); clearTimeout(t.current); const x = e.target.value; t.current = window.setTimeout(() => onChange(x), 250); }}
    onBlur={() => { clearTimeout(t.current); if (v !== value) onChange(v); }} />;
}

function EightTimer() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { if (left === null || left <= 0) return; const id = setTimeout(() => setLeft((x) => (x ?? 1) - 1), 1000); return () => clearTimeout(id); }, [left]);
  const s = left ?? 480;
  return (
    <div className="mb-3 flex items-center gap-3">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLeft(left === null || left <= 0 ? 480 : null)}><Timer className="size-4" />{left !== null && left > 0 ? 'توقف' : 'شروع زمان‌سنج ۸ دقیقه'}</button>
      <b className="tnum text-lg">{fa(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)}</b>
      {left === 0 && <span className="chip chip-flame">وقت تمام شد</span>}
    </div>
  );
}
