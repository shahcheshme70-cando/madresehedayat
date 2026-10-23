import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthUser, IS_PUBLIC, RoleName, ROLES } from './auth.decorators';

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
        const p = this.jwt.verify<{ sub: string; roles: RoleName[] }>(token);
        req.user = { id: p.sub, roles: p.roles ?? [] };
      } catch {
        if (!isPublic) throw new UnauthorizedException({ code: 'token_expired', message: 'نشست شما تمام شده است' });
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException({ code: 'unauthenticated', message: 'اول وارد شوید' });
    const need = this.reflector.getAllAndOverride<RoleName[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (need?.length && !need.some((r) => req.user!.roles.includes(r))) {
      throw new ForbiddenException({ code: 'forbidden', message: 'به این بخش دسترسی ندارید' });
    }
    return true;
  }
}
