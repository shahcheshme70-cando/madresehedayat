/**
 * شکل محتوای هر نوع درس (ستون lessons.content).
 * پاسخ درست پرسش‌ها هرگز برای یادگیرنده فرستاده نمی‌شود؛ فقط پس از ثبت پاسخ، توضیح برمی‌گردد.
 */
export interface VideoContent { provider: 'aparat' | 'file'; aparatHash?: string; fileKey?: string; summary?: string; transcript?: string }
export interface AudioContent { fileKey?: string; url?: string; summary?: string; transcript?: string }
export interface TextContent { body: string; keyPoints?: string[] }
export interface QuizQuestion {
  id: string;
  kind: 'single' | 'multi' | 'tf';
  text: string;
  options: { id: string; text: string }[];
  correct: string[];
  explain?: string;
}
export interface QuizContent { intro?: string; questions: QuizQuestion[] }
export interface WorksheetContent { prompt: string; fields: { id: string; label: string; hint?: string }[] }
export interface MissionContent { goal: string; steps: string[] }

/** نسخهٔ امن برای یادگیرنده: پاسخ‌های درست حذف می‌شود */
export function publicContent(type: string, content: any) {
  if (type === 'QUIZ' && content?.questions) {
    return {
      ...content,
      questions: (content as QuizContent).questions.map(({ correct: _c, explain: _e, ...q }) => q),
    };
  }
  return content ?? {};
}

export function gradeQuiz(content: QuizContent, answers: Record<string, string[]>) {
  const results = content.questions.map((q) => {
    const given = [...new Set(answers[q.id] ?? [])].sort();
    const want = [...q.correct].sort();
    const ok = given.length === want.length && given.every((g, i) => g === want[i]);
    return { id: q.id, ok, correct: q.correct, explain: q.explain ?? '' };
  });
  const score = content.questions.length ? Math.round((results.filter((r) => r.ok).length / content.questions.length) * 100) : 0;
  return { score, results };
}
