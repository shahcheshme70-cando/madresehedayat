import {
  Award, BookOpen, Check, CircleAlert, ClipboardList, Flag, GraduationCap, Headphones, Landmark, ListChecks, LoaderCircle,
  PenLine, PlayCircle, Route, Sparkles, Users, Wrench, X, type LucideIcon,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fa } from '../lib/fa';

/** نمادهای مجاز برای دوره و مسیر (نام در پایگاه داده) */
export const ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen, users: Users, sparkles: Sparkles, landmark: Landmark, route: Route, 'graduation-cap': GraduationCap, award: Award, flag: Flag,
};
export const CourseIcon = ({ name, className }: { name: string; className?: string }) => {
  const I = ICONS[name] ?? BookOpen;
  return <I className={className} aria-hidden="true" />;
};

export const LESSON_ICON: Record<string, LucideIcon> = {
  VIDEO: PlayCircle, AUDIO: Headphones, TEXT: BookOpen, QUIZ: ListChecks, PRACTICE: Sparkles, WORKSHEET: PenLine, MISSION: Flag, TOOL: Wrench,
};

export function Spinner({ label = 'در حال بارگذاری' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status"><LoaderCircle className="size-5 animate-spin" /><span>{label}…</span></div>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'خطایی پیش آمد';
  return (
    <div className="card mx-auto my-10 max-w-md p-6 text-center">
      <CircleAlert className="mx-auto size-8 text-rose" />
      <p className="mt-3 font-bold text-ink">{msg}</p>
      {onRetry && <button className="btn btn-secondary btn-sm mt-4" onClick={onRetry}>دوباره امتحان کنید</button>}
    </div>
  );
}

export function Empty({ icon: I = ClipboardList, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <I className="size-8 text-leaf" aria-hidden="true" />
      <b className="text-ink">{title}</b>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bar flex-1" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'پیشرفت'}><span style={{ width: `${value}%` }} /></div>
      <span className="tnum text-sm font-bold text-ink">٪{fa(value)}</span>
    </div>
  );
}

/* ───────── پیام کوتاه (toast) ───────── */
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = ++n.current;
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }} role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`rise pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lift ${t.tone === 'ok' ? 'bg-ink text-bg' : 'bg-rose text-white'}`}>
            {t.tone === 'ok' ? <Check className="size-4" /> : <CircleAlert className="size-4" />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ───────── پنجرهٔ گفت‌وگو ───────── */
export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`m-auto w-[calc(100%-24px)] ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-3xl border border-line bg-card p-0 text-body shadow-lift backdrop:bg-ink/40`}>
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-extrabold">{title}</h2>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="بستن"><X className="size-5" /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
