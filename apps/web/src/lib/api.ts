/** درخواست به API با کوکی؛ اگر توکن منقضی شده بود یک بار تازه‌اش می‌کند. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public data: any = {}) { super(message); }
}

/** پیام فارسی برای وقتی پاسخ سرور JSON نیست (مثلاً صفحهٔ خطای nginx هنگام به‌روزرسانی) */
const BY_STATUS: Record<number, [string, string]> = {
  0: ['offline', 'اتصال برقرار نشد؛ اینترنت را بررسی کنید'],
  401: ['unauthenticated', 'اول وارد شوید'],
  403: ['forbidden', 'به این بخش دسترسی ندارید'],
  404: ['not_found', 'پیدا نشد'],
  408: ['timeout', 'پاسخ دیر آمد؛ دوباره امتحان کنید'],
  413: ['too_large', 'حجم فرستاده‌شده بیش از اندازه است؛ فایل یا متن کوچک‌تری بفرستید'],
  429: ['too_many', 'درخواست‌ها پشت سر هم زیاد شد؛ یک دقیقه صبر کنید و دوباره امتحان کنید'],
  500: ['server_error', 'خطایی در سرور پیش آمد؛ کمی بعد دوباره امتحان کنید'],
  502: ['unavailable', 'سامانه در حال به‌روزرسانی یا لحظه‌ای در دسترس نیست؛ چند دقیقهٔ دیگر دوباره امتحان کنید'],
  503: ['unavailable', 'سامانه در حال به‌روزرسانی یا لحظه‌ای در دسترس نیست؛ چند دقیقهٔ دیگر دوباره امتحان کنید'],
  504: ['timeout', 'سامانه دیر پاسخ داد؛ چند دقیقهٔ دیگر دوباره امتحان کنید'],
};
export const statusError = (status: number): [string, string] => BY_STATUS[status] ?? (status >= 500 ? BY_STATUS[500] : ['error', 'این کار انجام نشد؛ دوباره امتحان کنید']);

/** پیام یک خطا برای نمایش؛ هر چیزی که ApiError نباشد پیام عمومی می‌گیرد */
export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'خطایی پیش آمد؛ دوباره امتحان کنید');
/** پیام هر خانه از خطای اعتبارسنجی سرور: { title: '«عنوان» لازم است' } */
export const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError && e.code === 'invalid' && e.data?.fields && !Array.isArray(e.data.fields) ? e.data.fields : {});

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
    const [code, message] = BY_STATUS[0];
    throw new ApiError(0, code, typeof navigator !== 'undefined' && navigator.onLine === false ? 'به اینترنت وصل نیستید؛ بعد از وصل شدن دوباره امتحان کنید' : message);
  }
  // ‌/auth/me هم تازه می‌شود (وگرنه بعد از ۱۵ دقیقه دوری، کاربر بیرون افتاده دیده می‌شد)
  if (res.status === 401 && opts.retry !== false && (!path.startsWith('/auth/') || path.startsWith('/auth/me') || path.startsWith('/auth/mfa'))) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.code === 'token_expired' || data.code === 'unauthenticated') {
      if (await refresh()) return api<T>(path, { ...opts, retry: false });
      if (path === '/auth/me') throw new ApiError(401, 'unauthenticated', 'اول وارد شوید');
      // نشست تمام شده: برنامه به صفحهٔ ورود می‌رود و پیام می‌دهد
      window.dispatchEvent(new CustomEvent('mh:session-expired'));
      throw new ApiError(401, 'session_expired', 'نشست شما تمام شده است؛ دوباره وارد شوید');
    }
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const [code, message] = statusError(res.status);
    throw new ApiError(res.status, typeof data?.code === 'string' ? data.code : code, typeof data?.message === 'string' ? data.message : message, data ?? {});
  }
  if (text && data === null) throw new ApiError(502, 'unavailable', BY_STATUS[502][1]);
  return data as T;
}
