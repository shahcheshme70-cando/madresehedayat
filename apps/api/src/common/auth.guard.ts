import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { config } from '../config';
import { AuthUser, IS_PUBLIC, RoleName, ROLES } from './auth.decorators';

const STAFF: RoleName[] = ['HQ_ADMIN', 'HQ_OPERATOR'];

export const ACCESS_COOKIE = 'mh_at';

/** گارد سراسری: توکن دسترسی را از کوکی یا سرآیند Authorization می‌خواند و نقش‌ها را بررسی می‌کند. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const token = req.cookies?.[ACCESS_COOKIE] ?? req.headers.authorization?.replace(/^Bearer /, '');
    if (token) {
      try {
        const p = this.jwt.verify<{ sub: string; roles: RoleName[]; mfa?: boolean }>(token);
        const roles = p.roles ?? [];
        // کارکنان ستاد تا رمز دوم را تأیید نکنند، اختیار ستادی ندارند (۱۳.۴)
        const pending = config.staffMfa && !p.mfa && roles.some((r) => STAFF.includes(r));
        req.user = { id: p.sub, roles: pending ? roles.filter((r) => !STAFF.includes(r)) : roles, mfaPending: pending };
      } catch {
        if (!isPublic) throw new UnauthorizedException({ code: 'token_expired', message: 'نشست شما تمام شده است' });
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException({ code: 'unauthenticated', message: 'اول وارد شوید' });
    const need = this.reflector.getAllAndOverride<RoleName[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (need?.length && !need.some((r) => req.user!.roles.includes(r))) {
      if (req.user.mfaPending && need.some((r) => STAFF.includes(r))) throw new ForbiddenException({ code: 'mfa_required', message: 'برای ورود به پنل ستاد، رمز دوم را وارد کنید' });
      throw new ForbiddenException({ code: 'forbidden', message: 'به این بخش دسترسی ندارید' });
    }
    return true;
  }
}
