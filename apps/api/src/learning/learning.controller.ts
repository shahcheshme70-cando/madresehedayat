import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser, MaybeUser, Public } from '../common/auth.decorators';
import { LearningService } from './learning.service';

class ProgressDto {
  @IsOptional() @IsInt() @Min(0) @Max(36000) positionSec?: number;
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
}
class QuizDto { @IsObject() answers: Record<string, string[]>; }
class ArchiveDto { @IsBoolean() archived: boolean; }

@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Public() @Get('courses')
  catalog(@MaybeUser() u?: AuthUser) { return this.learning.catalog(u?.id); }

  @Public() @Get('paths')
  paths(@MaybeUser() u?: AuthUser) { return this.learning.paths(u?.id); }

  @Public() @Get('courses/:key')
  course(@Param('key') key: string, @MaybeUser() u?: AuthUser) { return this.learning.courseDetail(key, u?.id); }

  @Post('courses/:key/enroll') @HttpCode(200)
  enroll(@CurrentUser() u: AuthUser, @Param('key') key: string) { return this.learning.enroll(u.id, key); }

  @Post('courses/:key/archive') @HttpCode(200)
  archive(@CurrentUser() u: AuthUser, @Param('key') key: string, @Body() dto: ArchiveDto) { return this.learning.archive(u.id, key, dto.archived); }

  @Get('lessons/:id')
  lesson(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.learning.lesson(u.id, id); }

  @Post('lessons/:id/progress') @HttpCode(200)
  progress(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ProgressDto) { return this.learning.saveProgress(u.id, id, dto); }

  @Post('lessons/:id/quiz') @HttpCode(200)
  quiz(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: QuizDto) { return this.learning.submitQuiz(u.id, id, dto.answers); }

  @Get('paths/:slug/exam')
  pathExam(@CurrentUser() u: AuthUser, @Param('slug') slug: string) { return this.learning.pathExam(u.id, slug); }

  @Post('paths/:slug/exam') @HttpCode(200)
  submitPathExam(@CurrentUser() u: AuthUser, @Param('slug') slug: string, @Body() dto: QuizDto) { return this.learning.submitPathExam(u.id, slug, dto.answers); }

  @Get('me/courses')
  myCourses(@CurrentUser() u: AuthUser) { return this.learning.myCourses(u.id); }

  @Get('me/certificates')
  myCertificates(@CurrentUser() u: AuthUser) { return this.learning.myCertificates(u.id); }

  /** صفحهٔ استعلام عمومی گواهی */
  @Public() @Get('verify/:code')
  verify(@Param('code') code: string) { return this.learning.verify(code); }
}
