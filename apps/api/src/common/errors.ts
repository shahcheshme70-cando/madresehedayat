import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * همهٔ خطاهای API یک شکل دارند: { code, message, ...data }
 * - message همیشه فارسی و برای کاربر نوشته شده است.
 * - خطاهای پیش‌بینی‌نشده (۵۰۰) یک «کد پیگیری» دارند که در گزارش سرور هم نوشته می‌شود
 *   تا پشتیبانی بتواند از روی همان کد، خطا را پیدا کند.
 */

/* ───────── نام فارسی خانه‌ها برای پیام‌های اعتبارسنجی ───────── */
const LABELS: Record<string, string> = {
  about: 'دربارهٔ برنامه', amount: 'مبلغ', anonymous: 'بی‌نام', body: 'متن', checks: 'فهرست کارها', code: 'کد', color: 'رنگ',
  comment: 'نظر', completed: 'انجام‌شده', content: 'محتوا', contractNo: 'شمارهٔ قرارداد', countyId: 'شهرستان', courseId: 'دوره',
  courseIds: 'دوره‌ها', data: 'داده‌ها', description: 'توضیح', device: 'دستگاه', discountPct: 'درصد تخفیف', durationSec: 'مدت',
  endsAt: 'زمان پایان', evidence: 'شاهد', expiresAt: 'تاریخ پایان', firstName: 'نام', fixedFee: 'هزینهٔ ثابت', gender: 'جنسیت',
  goal: 'هدف', hasCertificate: 'گواهی', icon: 'نماد', id: 'شناسه', ids: 'شناسه‌ها', instructor: 'مدرس', inviteCode: 'کد دعوت',
  isFinalQuiz: 'آزمون پایانی', isRestricted: 'دسترسی ویژه', kind: 'نوع', lastName: 'نام خانوادگی', layer: 'لایه', learned: 'آموخته‌ها',
  level: 'سطح', link: 'پیوند', mainPhoto: 'عکس اصلی', missionRule: 'قاعدهٔ مأموریت', mobile: 'شمارهٔ همراه', mobiles: 'شماره‌های همراه',
  mood: 'حس کلی', mosqueId: 'مسجد', name: 'نام', nationalId: 'کد ملی', nearMosque: 'مسجد نزدیک', networkId: 'سازمان', note: 'یادداشت',
  outcomes: 'دستاوردها', parentId: 'بخش بالادست', passScore: 'نمرهٔ قبولی', path: 'مسیر', plan: 'بسته', positionSec: 'جای پخش',
  price: 'قیمت', pricePerSeat: 'قیمت هر نفر', provinceId: 'استان', published: 'انتشار', quiz: 'آزمون', reasons: 'دلیل‌ها',
  regToken: 'نشانهٔ ثبت‌نام', reply: 'پاسخ', required: 'اجباری', scope: 'دامنه', seats: 'تعداد نفرات', serviceOrderId: 'سفارش خدمت',
  sponsorId: 'حامی', startsAt: 'زمان شروع', status: 'وضعیت', subscriptionId: 'اشتراک', subtitle: 'زیرعنوان', summary: 'خلاصه',
  tags: 'برچسب‌ها', termsAccepted: 'پذیرش شرایط', title: 'عنوان', up: 'رأی', tasks: 'کارهای پویش', subject: 'موضوع',
  message: 'پیام', text: 'متن', url: 'نشانی', location: 'نشانی محل', capacity: 'ظرفیت', speaker: 'میزبان', agenda: 'برنامهٔ جلسه',
  bring: 'همراه بیاورید', feeNote: 'هزینهٔ شرکت', answers: 'پاسخ‌ها', rating: 'امتیاز', stars: 'ستاره', reason: 'دلیل', type: 'نوع',
  slug: 'نشانی کوتاه', order: 'ترتیب', role: 'نقش', roles: 'نقش‌ها', userId: 'کاربر', eventId: 'برنامه', lessonId: 'درس',
  moduleId: 'فصل', coreId: 'هسته', priority: 'اولویت', target: 'هدف', audience: 'مخاطب', fileId: 'فایل', image: 'تصویر',
};
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const label = (f: string) => LABELS[f] ?? LABELS[f.replace(/\.\d+$/, '')] ?? null;
const num = (s?: string) => s?.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

/** متن فارسی یک قید class-validator؛ عددها از متن انگلیسی پیش‌فرض بیرون کشیده می‌شوند */
function ruleText(rule: string, en: string, missing: boolean): string {
  const [a, b] = num(en);
  if (missing) return 'لازم است';
  switch (rule) {
    case 'isNotEmpty': case 'arrayNotEmpty': return 'لازم است';
    case 'isString': return 'باید متن باشد';
    case 'isInt': return 'باید عدد صحیح باشد';
    case 'isNumber': case 'isNumberString': return 'باید عدد باشد';
    case 'isBoolean': return 'باید بله یا خیر باشد';
    case 'isArray': return 'باید فهرست باشد';
    case 'isObject': case 'nestedValidation': return 'شکل درستی ندارد';
    case 'isDateString': case 'isISO8601': case 'isDate': return 'تاریخ درستی نیست';
    case 'isIn': case 'isEnum': return 'از گزینه‌های مجاز نیست';
    case 'min': return `نباید کمتر از ${fa(a)} باشد`;
    case 'max': return `نباید بیشتر از ${fa(a)} باشد`;
    case 'maxLength': return `حداکثر ${fa(a)} نویسه می‌تواند باشد`;
    case 'minLength': return `دست‌کم ${fa(a)} نویسه لازم دارد`;
    case 'isLength':
      if (/shorter|less/.test(en)) return `حداکثر ${fa(b ?? a)} نویسه می‌تواند باشد`;
      return a ? `دست‌کم ${fa(a)} نویسه لازم دارد` : 'لازم است';
    case 'arrayMinSize': return a ? `دست‌کم ${fa(a)} مورد لازم دارد` : 'لازم است';
    case 'arrayMaxSize': return `حداکثر ${fa(a)} مورد می‌تواند داشته باشد`;
    case 'matches': return 'شکل درستی ندارد';
    case 'whitelistValidation': return 'پذیرفته نیست';
    default: return 'درست پر نشده است';
  }
}

/** خطاهای اعتبارسنجی را به { field: 'پیام فارسی' } تبدیل می‌کند (خانه‌های تودرتو با نقطه) */
function flatten(errors: ValidationError[], parent = '', out: Record<string, string> = {}) {
  for (const e of errors) {
    const path = parent ? `${parent}.${e.property}` : e.property;
    if (e.constraints) {
      const rules = Object.keys(e.constraints);
      const missing = e.value === undefined || e.value === null || e.value === '';
      // قید «لازم است» یا نخستین قیدی که خطا داده
      const rule = rules.find((r) => r === 'isNotEmpty') ?? rules[rules.length - 1];
      const name = label(e.property) ?? label(parent.split('.')[0]) ?? null;
      out[path] = `${name ? `«${name}»` : 'یکی از خانه‌ها'} ${ruleText(rule, e.constraints[rule], missing && !rules.includes('whitelistValidation'))}`;
    }
    if (e.children?.length) flatten(e.children, path, out);
  }
  return out;
}

export function validationException(errors: ValidationError[]) {
  const fields = flatten(errors);
  const list = Object.values(fields);
  const message = list.length === 1 ? list[0] : `${fa(list.length)} خانه درست پر نشده: ${list.slice(0, 3).join('؛ ')}${list.length > 3 ? '؛ …' : ''}`;
  return new BadRequestException({ code: 'invalid', message, fields });
}

/* ───────── خطاهای پیش‌فرض Nest/Express که پیام انگلیسی دارند ───────── */
const BY_STATUS: Record<number, [string, string]> = {
  400: ['bad_request', 'درخواست شکل درستی نداشت؛ صفحه را تازه کنید و دوباره امتحان کنید'],
  401: ['unauthenticated', 'اول وارد شوید'],
  403: ['forbidden', 'به این بخش دسترسی ندارید'],
  404: ['not_found', 'این نشانی در سامانه نیست'],
  405: ['not_allowed', 'این کار از این راه انجام نمی‌شود'],
  408: ['timeout', 'پاسخ دیر آمد؛ دوباره امتحان کنید'],
  409: ['conflict', 'این کار با وضع فعلی جور نیست؛ صفحه را تازه کنید'],
  413: ['too_large', 'حجم فرستاده‌شده بیش از اندازه است؛ فایل یا متن کوچک‌تری بفرستید'],
  415: ['bad_type', 'نوع داده یا فایل پذیرفته نیست'],
  429: ['too_many', 'درخواست‌ها پشت سر هم زیاد شد؛ یک دقیقه صبر کنید و دوباره امتحان کنید'],
  503: ['unavailable', 'سامانه لحظه‌ای در دسترس نیست؛ چند دقیقهٔ دیگر دوباره امتحان کنید'],
};

/* ───────── خطاهای پایگاه داده (کدهای Postgres) ───────── */
/** drizzle خطای Postgres را در cause می‌پیچد؛ کد اصلی را از هر لایه بیرون می‌کشد */
export const pgCode = (e: any): string | undefined => [e, e?.cause, e?.cause?.cause].find((x) => x && typeof x.code === 'string' && /^[0-9A-Z]{5}$/.test(x.code))?.code;
/**
 * متن امن یک خطا برای گزارش سرور: drizzle در پیام خطا پارامترهای پرس‌وجو (یعنی دادهٔ کاربر) را هم می‌آورد؛
 * این‌جا فقط کد و پیام Postgres و متن SQL بدون پارامترها نوشته می‌شود.
 */
export function logText(e: any): string {
  if (e && typeof e.query === 'string' && e.cause) return `${pgCode(e) ?? ''} ${e.cause?.message ?? ''} | sql: ${e.query.slice(0, 200)}`.trim();
  const msg = String(e?.message ?? e).replace(/\nparams:[\s\S]*$/, '').replace(/params: [\s\S]*$/, '');
  const stack = typeof e?.stack === 'string' ? e.stack.split('\n').slice(1, 6).join('\n') : '';
  return stack ? `${msg}\n${stack}` : msg;
}
/** خطای «تکراری» (unique) — برای کارهایی که هم‌زمانی را با تلاش دوباره حل می‌کنند */
export const isUnique = (e: unknown) => pgCode(e) === '23505';

function pgError(e: any): { status: number; code: string; message: string } | null {
  const pg = [e, e?.cause, e?.cause?.cause].find((x) => x && typeof x.code === 'string' && /^[0-9A-Z]{5}$/.test(x.code));
  if (pg) {
    switch (pg.code) {
      case '23505': return { status: 409, code: 'duplicate', message: 'این مورد پیش‌تر ثبت شده است؛ تکراری نمی‌شود' };
      case '23503': return pg.message?.includes('delete')
        ? { status: 409, code: 'in_use', message: 'این مورد جای دیگری به کار رفته و پاک نمی‌شود؛ اول آن‌ها را بردارید' }
        : { status: 400, code: 'missing_ref', message: 'یکی از موردهای انتخاب‌شده دیگر وجود ندارد؛ صفحه را تازه کنید' };
      case '23502': return { status: 400, code: 'invalid', message: 'یکی از خانه‌های لازم خالی مانده است' };
      case '22001': return { status: 400, code: 'too_long', message: 'یکی از نوشته‌ها بیش از اندازه بلند است' };
      case '22P02': case '22007': case '22008': return { status: 400, code: 'bad_input', message: 'یکی از مقدارها شکل درستی ندارد' };
      case '22003': return { status: 400, code: 'out_of_range', message: 'یکی از عددها بیش از اندازه بزرگ است' };
      case '40001': case '40P01': return { status: 409, code: 'busy', message: 'هم‌زمان کار دیگری روی همین مورد انجام شد؛ دوباره امتحان کنید' };
      case '57014': return { status: 503, code: 'timeout', message: 'کار بیش از اندازه طول کشید؛ دوباره امتحان کنید' };
    }
    if (/^(08|53|57P)/.test(pg.code)) return { status: 503, ...{ code: 'db_unavailable', message: BY_STATUS[503][1] } };
  }
  const sys = [e, e?.cause].find((x) => x && /^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND)$/.test(x.code));
  if (sys) return { status: 503, code: 'unavailable', message: BY_STATUS[503][1] };
  return null;
}

@Catch()
export class AllErrorsFilter implements ExceptionFilter {
  private log = new Logger('Error');

  catch(e: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    if (res.headersSent) return;

    if (e instanceof HttpException) {
      const status = e.getStatus();
      const body = e.getResponse() as any;
      // خطاهای خود سامانه همین حالا { code, message } فارسی دارند
      if (body && typeof body === 'object' && typeof body.code === 'string' && typeof body.message === 'string') return res.status(status).json(body);
      const [code, message] = status === 400 && /JSON/i.test(String(body?.message ?? e.message))
        ? ['bad_json', 'داده‌های فرستاده‌شده خراب بود؛ صفحه را تازه کنید و دوباره بفرستید']
        : BY_STATUS[status] ?? (status >= 500 ? ['server_error', 'خطایی در سرور پیش آمد'] : ['error', 'این کار انجام نشد؛ دوباره امتحان کنید']);
      return res.status(status).json({ code, message });
    }

    // خطاهای express پیش از رسیدن به Nest (body-parser) هم status دارند
    const any = e as any;
    if (any?.type === 'entity.too.large' || any?.status === 413) return res.status(413).json({ code: 'too_large', message: BY_STATUS[413][1] });
    if (any?.type === 'entity.parse.failed') return res.status(400).json({ code: 'bad_json', message: 'داده‌های فرستاده‌شده خراب بود؛ صفحه را تازه کنید و دوباره بفرستید' });

    const db = pgError(e);
    const ref = randomBytes(4).toString('hex').toUpperCase();
    if (db) {
      if (db.status >= 500) this.log.error(`[${ref}] ${req.method} ${req.path} → ${db.code}: ${logText(e)}`);
      const { status, ...body } = db;
      return res.status(status).json(status >= 500 ? { ...body, ref } : body);
    }
    // ناشناخته: پیام فنی به کاربر نمی‌رود، فقط کد پیگیری
    this.log.error(`[${ref}] ${req.method} ${req.path} → ${logText(e)}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'server_error', ref,
      message: `خطایی در سرور پیش آمد و ثبت شد. اگر دوباره تکرار شد، این کد را به پشتیبانی بدهید: ${ref}`,
    });
  }
}
