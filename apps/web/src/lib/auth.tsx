import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { eitaaApp, inEitaa } from './eitaa';
import { api, ApiError } from './api';
import type { Me, Role } from './types';

interface AuthState {
  me: Me | null;
  loading: boolean;
  isStaff: boolean;
  has: (...r: Role[]) => boolean;
  logout: () => Promise<void>;
  setMe: (m: Me) => void;
}

const Ctx = createContext<AuthState>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try { return await api<Me>('/auth/me'); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  const me = q.data ?? null;
  useEffect(() => {
    if (!me || !inEitaa()) return;
    try { if (sessionStorage.getItem('mh-eitaa-linked') === me.id) return; } catch { /* */ }
    eitaaApp().then((w) => w?.initData && api('/auth/eitaa', { body: { initData: w.initData } }).then(() => { try { sessionStorage.setItem('mh-eitaa-linked', me.id); } catch { /* */ } }).catch(() => {}));
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // نشست در میانهٔ کار تمام شد (توکن تازه نشد): کاربر بیرون می‌رود و صفحهٔ ورود پیام می‌دهد
  useEffect(() => {
    const out = () => {
      if (!qc.getQueryData(['me'])) return;
      qc.clear(); qc.setQueryData(['me'], null);
      try { sessionStorage.setItem('mh-expired', '1'); } catch { /* */ }
    };
    window.addEventListener('mh:session-expired', out);
    return () => window.removeEventListener('mh:session-expired', out);
  }, [qc]);
  const has = (...r: Role[]) => !!me && r.some((x) => me.roles.includes(x));
  const value: AuthState = {
    me, loading: q.isLoading, has, isStaff: has('HQ_ADMIN', 'HQ_OPERATOR'),
    logout: async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); qc.clear(); qc.setQueryData(['me'], null); },
    setMe: (m) => qc.setQueryData(['me'], m),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
