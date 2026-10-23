import { AccessLog } from '../security/security';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { AdminService } from './admin.service';

const LESSON_TYPES = ['VIDEO', 'AUDIO', 'TEXT', 'QUIZ', 'PRACTICE', 'WORKSHEET', 'MISSION', 'TOOL'] as const;
const ROLE_NAMES = ['HQ_ADMIN', 'HQ_OPERATOR', 'INSTRUCTOR', 'RAHYAR', 'IMAM', 'ORG_ADMIN'] as const;

class CreateCourseDto { @IsString() @Length(3, 120) title: string; }
class UpdateCourseDto {
  @IsOptional() @IsString() @Length(3, 120) title?: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(4000) about?: string;
  @IsOptional() @IsString() @MaxLength(40) level?: string;
  @IsOptional() @IsString() @MaxLength(80) instructor?: string;
  @IsOptional() @IsString() @MaxLength(20) color?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsIn(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']) status?: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  @IsOptional() @IsBoolean() isRestricted?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) passScore?: number;
  @IsOptional() @IsIn(['ON_SUBMIT', 'ON_APPROVAL']) missionRule?: 'ON_SUBMIT' | 'ON_APPROVAL';
  @IsOptional() @IsBoolean() hasCertificate?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) outcomes?: string[];
  @IsOptional() @IsBoolean() bumpVersion?: boolean;
}
class DepDto { @IsString() requiresId: string; @IsIn(['PREREQUISITE', 'COREQUISITE']) kind: 'PREREQUISITE' | 'COREQUISITE'; }
class DepsDto { @IsArray() @ValidateNested({ each: true }) @Type(() => DepDto) deps: DepDto[]; }
class TitleDto { @IsString() @Length(1, 120) title: string; }
class ReorderItem { @IsString() id: string; @IsArray() @IsString({ each: true }) lessons: string[]; }
class ReorderDto { @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderItem) modules: ReorderItem[]; }
class AddLessonDto { @IsString() @Length(1, 160) title: string; @IsIn(LESSON_TYPES) type: (typeof LESSON_TYPES)[number]; }
class UpdateLessonDto {
  @IsOptional() @IsString() @Length(1, 160) title?: string;
  @IsOptional() @IsInt() @Min(0) @Max(36000) durationSec?: number;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() isFinalQuiz?: boolean;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
}
class PathDto { @IsString() @Length(2, 120) title: string; @IsOptional() @IsString() @MaxLength(1000) description?: string; }
class UpdatePathDto {
  @IsOptional() @IsString() @Length(2, 120) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsString() @MaxLength(20) color?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsObject() quiz?: Record<string, unknown> | null;
  @IsOptional() @IsInt() @Min(0) @Max(100) passScore?: number;
}
class PathCoursesDto { @IsArray() @IsString({ each: true }) courseIds: string[]; }
class ActiveDto { @IsBoolean() isActive: boolean; }
class RoleDto { @IsIn(ROLE_NAMES) role: (typeof ROLE_NAMES)[number]; @IsOptional() @IsString() networkId?: string; }
class GrantDto {
  @IsArray() @IsString({ each: true }) courseIds: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(2000) @IsString({ each: true }) mobiles?: string[];
  @IsOptional() @IsString() networkId?: string;
  @IsOptional() @IsString() expiresAt?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
class NetworkDto { @IsIn(['BROTHERS', 'BANOUR', 'ORGANIZATION']) kind: 'BROTHERS' | 'BANOUR' | 'ORGANIZATION'; @IsString() @Length(2, 80) name: string; @IsOptional() @IsBoolean() underRahyar?: boolean; }
class RevokeDto { @IsBoolean() revoke: boolean; }
class MosqueDto { @IsString() @Length(2, 120) name: string; @IsString() countyId: string; }

@Controller('admin')
@Roles('HQ_ADMIN', 'HQ_OPERATOR')
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly access: AccessLog) {}

  @Get('stats') stats() { return this.admin.stats(); }

  @Get('courses') courses() { return this.admin.listCourses(); }
  @Post('courses') createCourse(@CurrentUser() u: AuthUser, @Body() d: CreateCourseDto) { return this.admin.createCourse(u.id, d); }
  @Get('courses/:id') course(@Param('id') id: string) { return this.admin.getCourse(id); }
  @Get('courses/:id/problems') problems(@Param('id') id: string) { return this.admin.publishProblems(id); }
  @Patch('courses/:id') updateCourse(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateCourseDto) { return this.admin.updateCourse(u.id, id, d); }
  @Delete('courses/:id') @Roles('HQ_ADMIN') deleteCourse(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.admin.deleteCourse(u.id, id); }
  @Put('courses/:id/dependencies') deps(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: DepsDto) { return this.admin.setDependencies(u.id, id, d.deps); }
  @Post('courses/:id/modules') addModule(@Param('id') id: string, @Body() d: TitleDto) { return this.admin.addModule(id, d.title); }
  @Put('courses/:id/order') reorder(@Param('id') id: string, @Body() d: ReorderDto) { return this.admin.reorder(id, d.modules); }
  @Patch('modules/:id') updateModule(@Param('id') id: string, @Body() d: TitleDto) { return this.admin.updateModule(id, d.title); }
  @Delete('modules/:id') deleteModule(@Param('id') id: string) { return this.admin.deleteModule(id); }
  @Post('modules/:id/lessons') addLesson(@Param('id') id: string, @Body() d: AddLessonDto) { return this.admin.addLesson(id, d); }
  @Patch('lessons/:id') updateLesson(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateLessonDto) { return this.admin.updateLesson(u.id, id, d); }
  @Delete('lessons/:id') deleteLesson(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.admin.deleteLesson(u.id, id); }

  @Get('paths') paths() { return this.admin.listPaths(); }
  @Post('paths') createPath(@CurrentUser() u: AuthUser, @Body() d: PathDto) { return this.admin.createPath(u.id, d); }
  @Patch('paths/:id') updatePath(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdatePathDto) { return this.admin.updatePath(u.id, id, d); }
  @Put('paths/:id/courses') pathCourses(@Param('id') id: string, @Body() d: PathCoursesDto) { return this.admin.setPathCourses(id, d.courseIds); }
  @Delete('paths/:id') deletePath(@Param('id') id: string) { return this.admin.deletePath(id); }

  @Get('users') users(@CurrentUser() u: AuthUser, @Query('q') q = '', @Query('page') page = '1') { this.access.write(u.id, 'users.list', null); return this.admin.listUsers(q, Number(page) || 1); }
  @Patch('users/:id') @Roles('HQ_ADMIN') setActive(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: ActiveDto) { return this.admin.setActive(u.id, id, d.isActive); }
  @Post('users/:id/roles') @HttpCode(200) @Roles('HQ_ADMIN') grantRole(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: RoleDto) { return this.admin.grantRole(u.id, id, d.role, d.networkId); }
  @Delete('users/:id/roles/:role') @Roles('HQ_ADMIN') revokeRole(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('role') role: RoleDto['role']) { return this.admin.revokeRole(u.id, id, role); }

  @Get('grants') grants() { return this.admin.listGrants(); }
  @Post('grants') @Roles('HQ_ADMIN') createGrants(@CurrentUser() u: AuthUser, @Body() d: GrantDto) { return this.admin.createGrants(u.id, d); }
  @Delete('grants/:id') @Roles('HQ_ADMIN') deleteGrant(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.admin.deleteGrant(u.id, id); }

  @Get('networks') networks() { return this.admin.listNetworks(); }
  @Post('networks') @Roles('HQ_ADMIN') createNetwork(@CurrentUser() u: AuthUser, @Body() d: NetworkDto) { return this.admin.createNetwork(u.id, d); }

  @Get('certificates') certs(@Query('q') q?: string) { return this.admin.listCertificates(q); }
  @Post('certificates/:code/revoke') @HttpCode(200) @Roles('HQ_ADMIN') revoke(@CurrentUser() u: AuthUser, @Param('code') code: string, @Body() d: RevokeDto) { return this.admin.revokeCertificate(u.id, code, d.revoke); }

  @Get('mosques') mosques(@Query('unverified') unv?: string) { return this.admin.listMosques(unv === '1'); }
  @Post('mosques') addMosque(@CurrentUser() u: AuthUser, @Body() d: MosqueDto) { return this.admin.addMosque(u.id, d); }
  @Post('mosques/:id/verify') @HttpCode(200) verifyMosque(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.admin.verifyMosque(u.id, id); }

  @Get('audit') @Roles('HQ_ADMIN') audit() { return this.admin.audits(); }
}
