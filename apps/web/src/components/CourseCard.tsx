import { CircleCheck, Clock, Layers } from 'lucide-react';
import { Link } from 'react-router';
import { fa, minutes } from '../lib/fa';
import type { CourseCard as C } from '../lib/types';
import { CourseIcon } from './ui';

export function CourseCard({ c }: { c: C }) {
  const done = !!c.me?.completedAt;
  return (
    <Link to={`/courses/${c.slug}`} className={`tint-${c.color} card group flex flex-col overflow-hidden no-underline transition hover:-translate-y-0.5 hover:shadow-lift`}>
      <div className="cover relative grid h-28 place-items-center">
        <CourseIcon name={c.icon} className="size-10 transition group-hover:scale-110" />
        {done && <span className="chip chip-leaf absolute end-3 top-3"><CircleCheck className="size-4" />تکمیل‌شده</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-[17px] font-extrabold">{c.title}</h3>
        {c.subtitle && <p className="line-clamp-2 text-sm text-muted">{c.subtitle}</p>}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[13px] text-muted">
          {c.lessonCount != null && <span className="flex items-center gap-1"><Layers className="size-3.5" />{fa(c.lessonCount)} درس</span>}
          {!!c.durationSec && <span className="flex items-center gap-1"><Clock className="size-3.5" />{minutes(c.durationSec)}</span>}
          {c.level && <span>{c.level}</span>}
        </div>
        {c.me && !done && (
          <div className="mt-2 flex items-center gap-2">
            <div className="bar flex-1"><span style={{ width: `${c.me.percent}%` }} /></div>
            <span className="tnum text-xs font-bold text-ink">٪{fa(c.me.percent)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
