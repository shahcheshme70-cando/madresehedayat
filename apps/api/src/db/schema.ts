/**
 * مدرسهٔ هدایت — مدل داده (مرحلهٔ ۱)
 * Drizzle ORM روی PostgreSQL. بدون موتور باینری، تا روی سرورهای داخل ایران هم بدون دانلود خارجی کار کند.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createId } from './id';

const id = () => text('id').primaryKey().$defaultFn(createId);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

// ───────────── هویت ─────────────
export const gender = pgEnum('gender', ['MALE', 'FEMALE']);

export const users = pgTable('users', {
  id: id(),
  mobile: text('mobile').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: gender('gender'),
  nationalId: text('national_id'), // اختیاری؛ بعضی خدمات الزامی‌اش می‌کنند
  countyId: text('county_id').references(() => counties.id),
  mosqueId: text('mosque_id').references(() => mosques.id),
  nearMosque: text('near_mosque'), // اگر عضو مسجدی نیست، نزدیک‌ترین مسجد
  coreSsoId: text('core_sso_id').unique(), // شناسه در سامانهٔ پایه اگر حساب وصل شده
  isActive: boolean('is_active').notNull().default(true),
  deleteRequestedAt: timestamp('delete_requested_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const otpRequests = pgTable('otp_requests', {
  id: id(),
  mobile: text('mobile').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('otp_mobile_idx').on(t.mobile, t.createdAt)]);

export const sessions = pgTable('sessions', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

// ───────────── نقش‌ها ─────────────
export const role = pgEnum('role', ['HQ_ADMIN', 'HQ_OPERATOR', 'INSTRUCTOR', 'RAHYAR', 'IMAM', 'ORG_ADMIN']);

export const roleGrants = pgTable('role_grants', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: role('role').notNull(),
  networkId: text('network_id').references(() => networks.id), // برای IMAM و ORG_ADMIN
  createdAt: createdAt(),
}, (t) => [unique('role_grant_uq').on(t.userId, t.role, t.networkId).nullsNotDistinct()]);

// ───────────── جغرافیا و مسجد ─────────────
export const provinces = pgTable('provinces', {
  id: id(),
  name: text('name').notNull().unique(),
});

export const counties = pgTable('counties', {
  id: id(),
  name: text('name').notNull(),
  provinceId: text('province_id').notNull().references(() => provinces.id),
}, (t) => [uniqueIndex('county_uq').on(t.provinceId, t.name)]);

export const mosques = pgTable('mosques', {
  id: id(),
  name: text('name').notNull(),
  countyId: text('county_id').notNull().references(() => counties.id),
  address: text('address'),
  verified: boolean('verified').notNull().default(false),
  imamId: text('imam_id'),
  createdAt: createdAt(),
});

// ───────────── شبکه‌ها و هسته‌ها ─────────────
export const networkKind = pgEnum('network_kind', ['BROTHERS', 'BANOUR', 'ORGANIZATION']);

export const networks = pgTable('networks', {
  id: id(),
  kind: networkKind('kind').notNull(),
  name: text('name').notNull(),
  underRahyar: boolean('under_rahyar').notNull().default(true),
  createdAt: createdAt(),
});

export const cores = pgTable('cores', {
  id: id(),
  name: text('name').notNull(),
  networkId: text('network_id').notNull().references(() => networks.id),
  mosqueId: text('mosque_id').references(() => mosques.id),
  leaderId: text('leader_id').references(() => users.id),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: createdAt(),
});

export const coreMemberships = pgTable('core_memberships', {
  coreId: text('core_id').notNull().references(() => cores.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.coreId, t.userId] })]);

// ───────────── ساختار آموزش ─────────────
export const courseStatus = pgEnum('course_status', ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']);
export const missionRule = pgEnum('mission_rule', ['ON_SUBMIT', 'ON_APPROVAL']);

export const courses = pgTable('courses', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  about: text('about'),
  level: text('level'),
  instructor: text('instructor'),
  color: text('color').notNull().default('green'),
  icon: text('icon').notNull().default('book-open'),
  status: courseStatus('status').notNull().default('DRAFT'),
  isRestricted: boolean('is_restricted').notNull().default(false),
  passScore: integer('pass_score').notNull().default(60),
  missionRule: missionRule('mission_rule').notNull().default('ON_SUBMIT'),
  hasCertificate: boolean('has_certificate').notNull().default(true),
  outcomes: text('outcomes').array().notNull().default(sql`'{}'::text[]`),
  version: integer('version').notNull().default(1),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const dependencyKind = pgEnum('dependency_kind', ['PREREQUISITE', 'COREQUISITE']);

export const courseDependencies = pgTable('course_dependencies', {
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  requiresId: text('requires_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  kind: dependencyKind('kind').notNull(),
}, (t) => [primaryKey({ columns: [t.courseId, t.requiresId] })]);

export const modules = pgTable('modules', {
  id: id(),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
});

export const lessonType = pgEnum('lesson_type', ['VIDEO', 'AUDIO', 'TEXT', 'QUIZ', 'PRACTICE', 'WORKSHEET', 'MISSION', 'TOOL']);

export const lessons = pgTable('lessons', {
  id: id(),
  moduleId: text('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: lessonType('type').notNull(),
  order: integer('order').notNull(),
  durationSec: integer('duration_sec').notNull().default(0),
  required: boolean('required').notNull().default(true),
  isFinalQuiz: boolean('is_final_quiz').notNull().default(false),
  /** محتوای درس بسته به نوعش؛ شکل‌ها در src/learning/lesson-content.ts */
  content: jsonb('content').notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const paths = pgTable('paths', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  icon: text('icon').notNull().default('route'),
  color: text('color').notNull().default('green'),
  published: boolean('published').notNull().default(false),
  createdAt: createdAt(),
});

export const pathItems = pgTable('path_items', {
  pathId: text('path_id').notNull().references(() => paths.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
}, (t) => [primaryKey({ columns: [t.pathId, t.courseId] })]);

// ───────────── یادگیری ─────────────
export const enrollments = pgTable('enrollments', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  courseVersion: integer('course_version').notNull().default(1),
  lastLessonId: text('last_lesson_id'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId] })]);

export const lessonProgress = pgTable('lesson_progress', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  positionSec: integer('position_sec').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  data: jsonb('data'),
  updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.lessonId] })]);

export const quizAttempts = pgTable('quiz_attempts', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull(),
  score: integer('score').notNull(),
  passed: boolean('passed').notNull(),
  createdAt: createdAt(),
}, (t) => [index('attempt_user_lesson_idx').on(t.userId, t.lessonId)]);

export const certificates = pgTable('certificates', {
  id: id(),
  code: text('code').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id),
  courseId: text('course_id').notNull().references(() => courses.id),
  holderName: text('holder_name').notNull(),
  courseTitle: text('course_title').notNull(),
  score: integer('score'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [uniqueIndex('cert_user_course_uq').on(t.userId, t.courseId)]);

// ───────────── دسترسی ویژه ─────────────
export const accessGrants = pgTable('access_grants', {
  id: id(),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  networkId: text('network_id').references(() => networks.id, { onDelete: 'cascade' }),
  issuedById: text('issued_by_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  note: text('note'),
  createdAt: createdAt(),
}, (t) => [index('grant_course_idx').on(t.courseId)]);

// ───────────── ممیزی ─────────────
export const auditLogs = pgTable('audit_logs', {
  id: id(),
  actorId: text('actor_id').references(() => users.id),
  action: text('action').notNull(),
  target: text('target'),
  meta: jsonb('meta'),
  createdAt: createdAt(),
}, (t) => [index('audit_created_idx').on(t.createdAt)]);

// ───────────── روابط ─────────────
export const usersRelations = relations(users, ({ many, one }) => ({
  roles: many(roleGrants),
  county: one(counties, { fields: [users.countyId], references: [counties.id] }),
  mosque: one(mosques, { fields: [users.mosqueId], references: [mosques.id] }),
}));
export const roleGrantsRelations = relations(roleGrants, ({ one }) => ({
  user: one(users, { fields: [roleGrants.userId], references: [users.id] }),
}));
export const countiesRelations = relations(counties, ({ one }) => ({
  province: one(provinces, { fields: [counties.provinceId], references: [provinces.id] }),
}));
export const mosquesRelations = relations(mosques, ({ one }) => ({
  county: one(counties, { fields: [mosques.countyId], references: [counties.id] }),
}));
export const coursesRelations = relations(courses, ({ many }) => ({
  modules: many(modules),
  dependencies: many(courseDependencies, { relationName: 'dependent' }),
}));
export const courseDependenciesRelations = relations(courseDependencies, ({ one }) => ({
  course: one(courses, { fields: [courseDependencies.courseId], references: [courses.id], relationName: 'dependent' }),
  requires: one(courses, { fields: [courseDependencies.requiresId], references: [courses.id] }),
}));
export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, { fields: [modules.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));
export const lessonsRelations = relations(lessons, ({ one }) => ({
  module: one(modules, { fields: [lessons.moduleId], references: [modules.id] }),
}));
export const pathsRelations = relations(paths, ({ many }) => ({ items: many(pathItems) }));
export const pathItemsRelations = relations(pathItems, ({ one }) => ({
  path: one(paths, { fields: [pathItems.pathId], references: [paths.id] }),
  course: one(courses, { fields: [pathItems.courseId], references: [courses.id] }),
}));
export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  course: one(courses, { fields: [certificates.courseId], references: [courses.id] }),
}));
