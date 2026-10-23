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
  /** نمایهٔ کور شماره (HMAC) برای جست‌وجو؛ خود شماره رمزگذاری‌شده در mobileEnc است (۱۳.۲) */
  mobile: text('mobile').notNull().unique(),
  mobileEnc: text('mobile_enc'),
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
  allowRahyarMessages: boolean('allow_rahyar_messages').notNull().default(true), // پیام مستقیم راهیار (۳.۶)
  notifyMessenger: boolean('notify_messenger').notNull().default(true), // اعلان‌ها در بله هم برسد
  totpSecret: text('totp_secret'), // رمز دوم کارکنان (رمزگذاری‌شده)
  totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
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
  mfaAt: timestamp('mfa_at', { withTimezone: true }), // رمز دوم کارکنان در این نشست تأیید شده
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
  inviteCode: text('invite_code').unique(), // پیوند دعوت امام محله برای اعضای آزاد
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
  quiz: jsonb('quiz'), // آزمون جامع مسیر: { questions: [...] } مثل درس آزمون
  passScore: integer('pass_score').notNull().default(60),
  createdAt: createdAt(),
});

export const pathAttempts = pgTable('path_attempts', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pathId: text('path_id').notNull().references(() => paths.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  passed: boolean('passed').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('path_attempt_idx').on(t.userId, t.pathId)]);

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
  courseId: text('course_id').references(() => courses.id), // گواهی دوره
  pathId: text('path_id').references(() => paths.id), // یا گواهی مسیر
  holderName: text('holder_name').notNull(),
  courseTitle: text('course_title').notNull(),
  score: integer('score'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [uniqueIndex('cert_user_course_uq').on(t.userId, t.courseId), uniqueIndex('cert_user_path_uq').on(t.userId, t.pathId)]);

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


// ═══════════════════════ مرحلهٔ ۲ ═══════════════════════

// ───────────── شبکهٔ راهیاری ─────────────
// دو درخت جدا (برادران و بانور). «جایگاه» جدا از «فرد» است تا جابه‌جایی افراد سوابق را به‌هم نریزد.
export const rahyarLayer = pgEnum('rahyar_layer', ['DEPUTY', 'MANAGER', 'REGIONAL', 'PROVINCIAL', 'COUNTY']);

export const rahyarPositions = pgTable('rahyar_positions', {
  id: id(),
  gender: gender('gender').notNull(), // درخت برادران یا بانور
  layer: rahyarLayer('layer').notNull(),
  title: text('title').notNull(),
  parentId: text('parent_id'),
  holderId: text('holder_id').references(() => users.id), // نفری که الان این جایگاه را دارد
  provinceId: text('province_id').references(() => provinces.id), // برای PROVINCIAL
  countyId: text('county_id').references(() => counties.id), // برای COUNTY
  createdAt: createdAt(),
}, (t) => [index('rahyar_parent_idx').on(t.parentId), index('rahyar_holder_idx').on(t.holderId)]);

/** استان‌های هر منطقه (جایگاه REGIONAL) — معاون هر درخت تعیین می‌کند */
export const regionProvinces = pgTable('region_provinces', {
  regionId: text('region_id').notNull().references(() => rahyarPositions.id, { onDelete: 'cascade' }),
  provinceId: text('province_id').notNull().references(() => provinces.id),
}, (t) => [primaryKey({ columns: [t.regionId, t.provinceId] })]);

/** سپردن کنشگر به یک راهیار شهرستانی مشخص (وقتی شهرستان چند راهیار دارد) — با راهیار استانی */
export const rahyarAssignments = pgTable('rahyar_assignments', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  positionId: text('position_id').notNull().references(() => rahyarPositions.id, { onDelete: 'cascade' }),
  assignedById: text('assigned_by_id').references(() => users.id),
  createdAt: createdAt(),
});

// ───────────── گزارش مأموریت ─────────────
export const missionMessageKind = pgEnum('mission_message_kind', ['REPORT', 'FEEDBACK', 'REVISE', 'APPROVE', 'REPLY']);

/** رشتهٔ گفت‌وگوی هر مأموریت: گزارش، بازخورد، درخواست اصلاح، تأیید */
export const missionMessages = pgTable('mission_messages', {
  id: id(),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id),
  kind: missionMessageKind('kind').notNull(),
  body: text('body').notNull(),
  createdAt: createdAt(),
}, (t) => [index('mission_msg_idx').on(t.learnerId, t.lessonId)]);

/** عکس‌های مأموریت: اصلی ۱ سال، شاهد ۶ ماه (۳.۴) */
export const privateFiles = pgTable('private_files', {
  key: text('key').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // MISSION_MAIN | MISSION_EVIDENCE
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// ───────────── اعضای سازمان مشترک ─────────────
export const networkMembers = pgTable('network_members', {
  networkId: text('network_id').notNull().references(() => networks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.networkId, t.userId] })]);

// ───────────── برنامه‌ها ─────────────
export const eventKind = pgEnum('event_kind', ['ONLINE', 'IN_PERSON']);
export const eventStatus = pgEnum('event_status', ['DRAFT', 'PUBLISHED', 'CANCELLED']);
export const registrationStatus = pgEnum('registration_status', ['REGISTERED', 'WAITLIST', 'PENDING', 'REJECTED', 'CANCELLED']);

export const events = pgTable('events', {
  id: id(),
  title: text('title').notNull(),
  description: text('description'),
  agenda: text('agenda'),
  kind: eventKind('kind').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  location: text('location'), // نشانی برنامهٔ حضوری
  mapUrl: text('map_url'), // پیوند نشان یا بلد
  onlineUrl: text('online_url'), // پیوند کلاس آنلاین
  bring: text('bring'), // چه چیزی همراه بیاورید
  hostName: text('host_name'),
  capacity: integer('capacity'), // خالی = بی‌سقف
  waitlist: boolean('waitlist').notNull().default(true),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  registrationDeadline: timestamp('registration_deadline', { withTimezone: true }),
  audienceGender: gender('audience_gender'),
  audienceProvinceId: text('audience_province_id').references(() => provinces.id),
  audienceCountyId: text('audience_county_id').references(() => counties.id),
  courseId: text('course_id').references(() => courses.id), // برنامه‌ای که بخشی از یک دوره است
  status: eventStatus('status').notNull().default('DRAFT'),
  cancelReason: text('cancel_reason'),
  createdById: text('created_by_id').notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('events_starts_idx').on(t.startsAt)]);

export const registrations = pgTable('registrations', {
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: registrationStatus('status').notNull(),
  checkInCode: text('check_in_code').notNull(), // کد کارت ورود (QR)
  registeredById: text('registered_by_id').references(() => users.id), // ثبت‌نام گروهی مسئول هسته
  lateCancel: boolean('late_cancel').notNull().default(false),
  attendedAt: timestamp('attended_at', { withTimezone: true }),
  attendanceMethod: text('attendance_method'), // QR | MANUAL | ONLINE
  feedback: jsonb('feedback'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.eventId, t.userId] }), uniqueIndex('reg_checkin_uq').on(t.eventId, t.checkInCode)]);

/** یادآوری‌هایی که فرستاده شده (تا تکراری نشود) */
export const eventReminders = pgTable('event_reminders', {
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // DAY | SOON
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.eventId, t.kind] })]);

// ───────────── اعلان و پیام ─────────────
export const notifications = pgTable('notifications', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('notif_user_idx').on(t.userId, t.createdAt)]);

/** گفت‌وگوی کنشگر با راهیارانش (هر کنشگر یک رشته) */
export const directMessages = pgTable('direct_messages', {
  id: id(),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  readByLearnerAt: timestamp('read_by_learner_at', { withTimezone: true }),
  readByRahyarAt: timestamp('read_by_rahyar_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('dm_learner_idx').on(t.learnerId, t.createdAt)]);


// ═══════════════════════ مرحلهٔ ۳ — گام ۱ ═══════════════════════

/** اتصال حساب به پیام‌رسان‌ها (بله؛ ایتا وقتی رابط رسمی‌اش آماده شود) */
export const messengerLinks = pgTable('messenger_links', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // BALE | EITAA
  chatId: text('chat_id').notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.provider] }), uniqueIndex('messenger_chat_uq').on(t.provider, t.chatId)]);

export const messengerCodes = pgTable('messenger_codes', {
  code: text('code').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** تنظیمات کوچک سامانه (مثلاً جای خواندن به‌روزرسانی‌های بله) */
export const kv = pgTable('kv', { key: text('key').primaryKey(), value: text('value').notNull() });

/** پیام گروهی (۶.۴) */
export const broadcasts = pgTable('broadcasts', {
  id: id(),
  senderId: text('sender_id').notNull().references(() => users.id),
  audience: jsonb('audience').notNull(), // { kind, ids?, label }
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  recipientCount: integer('recipient_count').notNull(),
  status: text('status').notNull(), // PENDING | SENT | REJECTED
  reviewedById: text('reviewed_by_id').references(() => users.id),
  createdAt: createdAt(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

/** پشتیبانی (۶.۳) */
export const tickets = pgTable('tickets', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // LOGIN | COURSE | TECH | OTHER
  subject: text('subject').notNull(),
  status: text('status').notNull().default('OPEN'), // OPEN | ANSWERED | CLOSED
  assigneeId: text('assignee_id').references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('ticket_status_idx').on(t.status, t.updatedAt)]);

export const ticketMessages = pgTable('ticket_messages', {
  id: id(),
  ticketId: text('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id),
  body: text('body').notNull(), // رمزگذاری‌شده
  createdAt: createdAt(),
});

/** گزارش نمونه (۳.۵): پیشنهاد راهیار ← اجازهٔ کنشگر ← تأیید ستاد */
export const missionSamples = pgTable('mission_samples', {
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  proposedById: text('proposed_by_id').notNull().references(() => users.id),
  status: text('status').notNull(), // PROPOSED | CONSENTED | PUBLISHED | DECLINED
  named: boolean('named'),
  text: text('text'), // فقط پس از اجازهٔ کنشگر کپی می‌شود
  authorLabel: text('author_label'),
  createdAt: createdAt(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.learnerId, t.lessonId] })]);

/** دیدن دادهٔ شخصی به دست کارکنان و راهیاران (۱۳.۳)؛ ۱ سال نگه داشته می‌شود */
export const accessLogs = pgTable('access_logs', {
  id: id(),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  subjectId: text('subject_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('access_log_at_idx').on(t.at)]);
