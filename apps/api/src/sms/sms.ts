import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';

export abstract class SmsSender {
  abstract sendOtp(mobile: string, code: string): Promise<void>;
}

/** برای توسعه: کد را در لاگ می‌نویسد و چیزی نمی‌فرستد. */
@Injectable()
export class ConsoleSms extends SmsSender {
  private readonly log = new Logger('SMS');
  async sendOtp(mobile: string, code: string) {
    this.log.warn(`کد ورود برای ${mobile}: ${code} (ارسال واقعی خاموش است)`);
  }
}

/**
 * کاوه‌نگار — سرویس Verify Lookup با قالب از پیش تأییدشده.
 * مستند: https://kavenegar.com/rest.html (verify/lookup)
 */
@Injectable()
export class KavenegarSms extends SmsSender {
  private readonly log = new Logger('Kavenegar');
  async sendOtp(mobile: string, code: string) {
    const url = new URL(`https://api.kavenegar.com/v1/${config.kavenegarApiKey}/verify/lookup.json`);
    url.searchParams.set('receptor', mobile);
    url.searchParams.set('token', code);
    url.searchParams.set('template', config.kavenegarTemplate);
    const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      this.log.error(`ارسال پیامک ناموفق بود: ${res.status}`);
      throw new Error('sms_failed');
    }
  }
}
