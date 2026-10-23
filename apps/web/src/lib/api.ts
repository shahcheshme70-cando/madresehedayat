/** درخواست به API با کوکی؛ اگر توکن منقضی شده بود یک بار تازه‌اش می‌کند. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public data: any = {}) { super(message); }
}

let refreshing: Promise<boolean> | null = null;
async function refresh() {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' }).then((r) => r.ok).finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData; retry?: boolean } = {}): Promise<T> {
  if (import.meta.env.VITE_DEMO) {
    const { demoApi } = await import('../demo/server');
    try { return await demoApi(path, opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'), opts.body); }
    catch (e: any) { throw new ApiError(e.status ?? 500, e.code ?? 'error', e.message, e.data); }
  }
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'), credentials: 'include', headers: {} };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); (init.headers as Record<string, string>)['content-type'] = 'application/json'; }
  let res: Response;
  try { res = await fetch('/api' + path, init); } catch {
    throw new ApiError(0, 'offline', 'اتصال برقرار نشد؛ اینترنت را بررسی کنید');
  }
  if (res.status === 401 && opts.retry !== false && !path.startsWith('/auth/')) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.code === 'token_expired' || data.code === 'unauthenticated') {
      if (await refresh()) return api<T>(path, { ...opts, retry: false });
    }
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'error', data?.message && typeof data.message === 'string' ? data.message : 'خطایی پیش آمد؛ دوباره امتحان کنید', data);
  return data as T;
}
