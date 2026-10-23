import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export type RoleName = 'HQ_ADMIN' | 'HQ_OPERATOR' | 'INSTRUCTOR' | 'RAHYAR' | 'IMAM' | 'ORG_ADMIN';

export interface AuthUser {
  id: string;
  roles: RoleName[];
}

export const IS_PUBLIC = 'isPublic';
/** این مسیر بدون ورود باز است */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** فقط این نقش‌ها (هر کدام کافی است) */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** کاربر اختیاری در مسیرهای عمومی */
export const MaybeUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});
