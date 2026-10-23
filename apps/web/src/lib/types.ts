export type Role = 'HQ_ADMIN' | 'HQ_OPERATOR' | 'INSTRUCTOR' | 'RAHYAR' | 'IMAM' | 'ORG_ADMIN';
export type LessonType = 'VIDEO' | 'AUDIO' | 'TEXT' | 'QUIZ' | 'PRACTICE' | 'WORKSHEET' | 'MISSION' | 'TOOL';

export interface Me {
  id: string; mobile: string; firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' | null;
  hasNationalId: boolean; county: { id: string; name: string; province: string } | null;
  mosque: { id: string; name: string } | null; nearMosque: string | null; roles: Role[];
  cores: { id: string; name: string; isLeader: boolean }[]; ssoLinked: boolean;
}

export interface MyState { enrolledAt: string; completedAt: string | null; archived: boolean; percent: number; lastLessonId: string | null }

export interface CourseCard {
  id: string; slug: string; title: string; subtitle: string | null; level: string | null; instructor: string | null;
  color: string; icon: string; hasCertificate: boolean; lessonCount?: number; durationSec?: number; me: MyState | null;
}

export interface PathCard {
  id: string; slug: string; title: string; description: string | null; icon: string; color: string;
  courseCount: number; completedCount: number; courses: CourseCard[];
}

export interface LessonRow { id: string; title: string; type: LessonType; durationSec: number; required: boolean; isFinalQuiz: boolean; done: boolean; best: number | null }
export interface CourseDetail extends CourseCard {
  about: string | null; outcomes: string[]; passScore: number; missionRule: 'ON_SUBMIT' | 'ON_APPROVAL';
  dependencies: { kind: 'PREREQUISITE' | 'COREQUISITE'; course: CourseCard; done: boolean }[];
  locked: boolean;
  modules: { id: string; title: string; lessons: LessonRow[] }[];
  me: (MyState & { certificate: { code: string; issuedAt: string; score: number | null } | null }) | null;
}

export interface QuizQuestion { id: string; kind: 'single' | 'multi' | 'tf'; text: string; options: { id: string; text: string }[] }
export interface LessonDetail {
  id: string; title: string; type: LessonType; durationSec: number; required: boolean; isFinalQuiz: boolean;
  content: any;
  course: { id: string; slug: string; title: string; passScore: number };
  progress: { positionSec: number; completedAt: string | null; data: any } | null;
  quiz?: { attempts: { score: number; passed: boolean; at: string }[]; nextAllowedAt: string | null };
}

export interface Completion { completed: boolean; certificate?: { code: string }; waitingFor?: string[] }
