/**
 * نسخهٔ نمایشی — اتاق کلاس زندهٔ شبیه‌سازی‌شده.
 * در سامانهٔ اصلی «ورود به کلاس» صفحهٔ BigBlueButton خود مدرسه را باز می‌کند؛ این‌جا همان تجربه
 * (اسلاید، تصویر مدرس، گفت‌وگو، شرکت‌کنندگان، نظرسنجی، دست بالا، ضبط و ثبت خودکار حضور) شبیه‌سازی می‌شود.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, ChevronLeft, ChevronRight, CircleDot, Hand, Heart, LogOut, MessageSquare, Mic, MicOff, MonitorUp, Pause, Play, PhoneOff, Send,
  ThumbsUp, Users, Video, VideoOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Spinner, useToast } from '../components/ui';
import { api } from '../lib/api';
import { fa } from '../lib/fa';

interface Room { id: string; title: string; hostName: string; startsAt: string; endsAt: string; record: boolean; agenda: string | null; me: string; host: boolean; registered: number }
interface Att { minutes: number; needed: number; total: number; attended: boolean }

const PEOPLE = ['مریم صالحی', 'علی رضایی', 'سمیه کریمی', 'حسین احمدی', 'نرگس موسوی', 'محمد جعفری', 'زهرا نوری', 'رضا کاظمی', 'فاطمه یزدانی', 'امیر حیدری', 'لیلا شریفی', 'مهدی قاسمی', 'سارا رحیمی', 'جواد طاهری', 'الهه فرهادی', 'یاسر عباسی'];
const SCRIPT: [number, string, string][] = [
  [2, 'مریم صالحی', 'سلام، صدا خیلی خوب می‌آید'],
  [6, 'علی رضایی', 'نوجوان‌های محلهٔ ما بیشتر توی بازی‌های آنلاین هستند'],
  [11, 'سمیه کریمی', 'ما یک کانال برای بچه‌ها زدیم ولی بعد از دو هفته خوابید'],
  [16, 'حسین احمدی', 'سؤال: کانال را خود نوجوان‌ها اداره کنند یا مربی؟'],
  [22, 'نرگس موسوی', 'تجربهٔ مسابقهٔ عکس ما خیلی خوب بود؛ بچه‌ها خودشان داور گذاشتند'],
  [29, 'محمد جعفری', 'ممنون، این بخش خیلی کاربردی بود'],
  [37, 'زهرا نوری', 'ضبط کلاس را بعداً می‌شود دید؟'],
];
const POLL = { q: 'نوجوان‌های محلهٔ شما بیشتر کجا وقت می‌گذرانند؟', o: ['بازی‌های آنلاین', 'شبکه‌های اجتماعی', 'ویدیو و استریم', 'کمتر در فضای مجازی‌اند'], base: [9, 6, 4, 1] };
const mmss = (s: number) => `${fa(Math.floor(s / 60))}:${fa(String(Math.floor(s % 60)).padStart(2, '0'))}`;
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('‌');

export default function DemoLiveRoom() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const replay = sp.get('replay');
  const q = useQuery({ queryKey: ['demo-room', id], queryFn: () => api<Room>(`/demo/live/${id}`) });
  if (q.isLoading || !q.data) return <div className="grid min-h-dvh place-items-center bg-[#12141f] text-white"><Spinner label="ورود به کلاس" /></div>;
  return <RoomView r={q.data} replay={replay} hostView={sp.get('host') === '1' || q.data.host} />;
}

function RoomView({ r, replay, hostView }: { r: Room; replay: string | null; hostView: boolean }) {
  const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const slides = useMemo(() => [r.title, ...(r.agenda ?? '').split('\n').filter(Boolean), 'پرسش و پاسخ'], [r]);
  const [slide, setSlide] = useState(0);
  const [t, setT] = useState(0);
  const [mic, setMic] = useState(false); const [cam, setCam] = useState(false); const [hand, setHand] = useState(false);
  const [rec, setRec] = useState(r.record); const [playing, setPlaying] = useState(true);
  const [tab, setTab] = useState<'chat' | 'people' | 'poll'>('chat');
  const [msgs, setMsgs] = useState<{ who: string; text: string; me?: boolean }[]>([]);
  const [draft, setDraft] = useState('');
  const [vote, setVote] = useState<number | null>(null);
  const [floats, setFloats] = useState<{ id: number; k: 'like' | 'heart' }[]>([]);
  const [att, setAtt] = useState<Att | null>(null);
  const fid = useRef(0);
  const told = useRef(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const elapsed0 = Math.max(0, (Date.now() - new Date(r.startsAt).getTime()) / 1000);

  // زمان کلاس؛ پیام‌های ازپیش‌نوشته به ترتیب می‌رسند و اسلاید مدرس جلو می‌رود
  useEffect(() => { if (!playing) return; const h = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(h); }, [playing]);
  useEffect(() => {
    const due = SCRIPT.filter(([s]) => s === t);
    if (due.length) setMsgs((m) => [...m, ...due.map(([, who, text]) => ({ who, text }))]);
    if (!hostView && t > 0 && t % 14 === 0) setSlide((s) => Math.min(slides.length - 1, s + 1));
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length]);

  // ثبت حضور: هر ثانیه دو دقیقه (شتاب‌گرفته برای نمایش قاعدهٔ «دست‌کم نیمی از کلاس»)
  const tick = useMutation({
    mutationFn: () => api<Att>(`/events/${r.id}/live/demo-tick`, { body: { seconds: 60 * 6 } }),
    onSuccess: (a) => {
      setAtt(a);
      if (a.attended && !told.current) { told.current = true; toast('حضور شما ثبت شد؛ درس «جلسهٔ زنده» هم تمام شد'); qc.invalidateQueries(); }
    },
  });
  useEffect(() => { if (replay || hostView) return; tick.mutate(); const h = setInterval(() => tick.mutate(), 3000); return () => clearInterval(h); }, [replay, hostView]); // eslint-disable-line react-hooks/exhaustive-deps

  const react = (k: 'like' | 'heart') => { const i = ++fid.current; setFloats((f) => [...f, { id: i, k }]); setTimeout(() => setFloats((f) => f.filter((x) => x.id !== i)), 2200); };
  const send = () => { if (!draft.trim()) return; setMsgs((m) => [...m, { who: r.me || 'من', text: draft.trim(), me: true }]); setDraft(''); };
  const leave = (end = false) => { qc.invalidateQueries(); toast(end ? 'کلاس برای همه پایان یافت' : replay ? 'از ضبط بیرون آمدید' : 'از کلاس بیرون آمدید؛ هر وقت بخواهید دوباره وارد شوید'); nav(-1); };
  const people = [r.hostName, ...PEOPLE.slice(0, Math.max(6, Math.min(PEOPLE.length, r.registered + 12)))];
  const votes = POLL.base.map((v, i) => v + (vote === i ? 1 : 0)); const vsum = votes.reduce((a, b) => a + b, 0);
  const clock = replay ? t : elapsed0 + t;
  const dur = (new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime()) / 1000;

  return (
    <div className="flex min-h-dvh flex-col bg-[#12141f] text-[#eceef6]">
      <p className="bg-[#3a2f0b] px-4 py-1.5 text-center text-xs text-[#ffe9a8]" style={{ paddingTop: 'calc(0.375rem + env(safe-area-inset-top, 0px))' }}>
        شبیه‌سازی نسخهٔ نمایشی: در سامانهٔ اصلی، این کلاس روی BigBlueButton خود مدرسه باز می‌شود و همین امکانات را دارد.
      </p>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <b className="block truncate text-white">{replay ? `ضبط: ${r.title}` : r.title}</b>
          <span className="text-xs text-white/60">مدرس: {r.hostName}</span>
        </div>
        {replay ? <span className="chip bg-white/10 text-white">ضبط کلاس</span>
          : <span className="flex items-center gap-1.5 rounded-full bg-[#d64a6a] px-3 py-1 text-xs font-bold text-white"><span className="size-2 animate-pulse rounded-full bg-white" />زنده</span>}
        {!replay && rec && <span className="flex items-center gap-1 text-xs text-[#ff8fa6]"><CircleDot className="size-4" />در حال ضبط</span>}
        <span className="tnum text-sm text-white/70">{mmss(clock)}</span>
        <span className="flex items-center gap-1 text-sm text-white/70"><Users className="size-4" />{fa(people.length + 1)}</span>
      </header>

      <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="grid min-w-0 content-start gap-3">
          {/* صفحهٔ اصلی: اسلاید مدرس */}
          <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d3b2c] via-[#183044] to-[#102a45]">
            <div className="absolute inset-0 grid place-items-center p-6 pb-16 text-center sm:p-10">
              <div>
                <span className="text-xs text-white/50">اسلاید {fa(slide + 1)} از {fa(slides.length)}</span>
                <p className="mt-2 text-lg font-extrabold leading-relaxed text-white sm:text-3xl" style={{ textWrap: 'balance' }}>{slides[slide]}</p>
              </div>
            </div>
            {/* تصویر مدرس */}
            <div className="absolute bottom-2 end-2 w-20 overflow-hidden rounded-lg bg-[#262a4f] shadow-lg sm:bottom-3 sm:end-3 sm:w-40 sm:rounded-xl">
              <div className="grid aspect-video place-items-center">
                <span className="grid size-7 place-items-center rounded-full bg-[#34c47f] text-[11px] font-bold text-[#0b2a1a] ring-4 ring-[#34c47f]/40 sm:size-14 sm:text-base" style={{ animation: playing ? 'pulse 1.6s ease-in-out infinite' : undefined }}>{initials(r.hostName)}</span>
              </div>
              <span className="block truncate bg-black/40 px-2 py-0.5 text-[11px] text-white">{r.hostName}</span>
            </div>
            {floats.map((f) => <span key={f.id} className="pointer-events-none absolute bottom-6 text-[#ff8fa6]" style={{ animation: 'float-up 2.2s ease-out forwards', insetInlineStart: `${40 + (f.id % 5) * 5}%` }}>{f.k === 'like' ? <ThumbsUp className="size-7 text-[#7fe0ae]" /> : <Heart className="size-7 fill-current" />}</span>)}
            {hostView && !replay && (
              <div className="absolute top-3 start-3 flex gap-1.5">
                <button className="grid size-9 place-items-center rounded-full bg-black/40 text-white disabled:opacity-40" aria-label="اسلاید قبل" disabled={slide === 0} onClick={() => setSlide(slide - 1)}><ChevronRight className="size-5" /></button>
                <button className="grid size-9 place-items-center rounded-full bg-black/40 text-white disabled:opacity-40" aria-label="اسلاید بعد" disabled={slide === slides.length - 1} onClick={() => setSlide(slide + 1)}><ChevronLeft className="size-5" /></button>
              </div>
            )}
          </div>
          {replay ? (
            <div className="grid gap-2 rounded-2xl bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <button className="grid size-10 place-items-center rounded-full bg-[#34c47f] text-[#0b2a1a]" aria-label={playing ? 'توقف' : 'پخش'} onClick={() => setPlaying(!playing)}>{playing ? <Pause className="size-5" /> : <Play className="size-5" />}</button>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[#34c47f]" style={{ width: `${Math.min(100, (t / Math.max(60, dur / 60)) * 100)}%` }} /></div>
                <span className="tnum text-xs text-white/60">{mmss(t)}</span>
              </div>
              <p className="text-xs text-white/60">دیدن ضبط، درس «جلسهٔ زنده» را برای کسی که به کلاس نرسیده تمام می‌کند. ضبط ۶ ماه نگه داشته می‌شود و فقط برای ثبت‌نامی‌ها باز است.</p>
            </div>
          ) : hostView ? (
            <div className="grid gap-1.5 rounded-2xl bg-white/5 p-4 text-sm">
              <b className="text-white">شما برگزارکنندهٔ این کلاس هستید</b>
              <p className="text-xs leading-6 text-white/60">اسلاید را با دکمه‌های بالای صفحه جلو ببرید، ضبط را روشن یا خاموش کنید و در پایان «پایان کلاس» را بزنید. دقیقه‌های حضور هر نفر بعد از کلاس در «مدیریت این برنامه» می‌آید و حاضران خودکار ثبت می‌شوند.</p>
            </div>
          ) : (
            <div className="grid gap-1.5 rounded-2xl bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2 text-sm"><b className="text-white">حضور شما</b>
                <span className="tnum text-white/70">{att ? `${fa(att.minutes)} از ${fa(att.needed)} دقیقهٔ لازم` : '…'}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[#34c47f] transition-all" style={{ width: `${att ? Math.min(100, (att.minutes / Math.max(1, att.needed)) * 100) : 0}%` }} /></div>
              <p className="text-xs text-white/60">{att?.attended ? 'حضور شما ثبت شد. اگر این کلاس درس «جلسهٔ زنده» یک دوره است، آن درس هم تمام شد.' : 'هر کس دست‌کم نیمی از زمان کلاس را باشد، «حاضر» ثبت می‌شود. در نسخهٔ نمایشی زمان تندتر می‌گذرد.'}</p>
            </div>
          )}
        </section>

        {/* پنل کناری: گفت‌وگو، شرکت‌کنندگان، نظرسنجی */}
        <aside className="flex min-h-[340px] min-w-0 flex-col overflow-hidden rounded-2xl bg-white/5 lg:max-h-[calc(100dvh-190px)]">
          <div className="flex border-b border-white/10" role="tablist">
            {([['chat', 'گفت‌وگو', MessageSquare], ['people', 'افراد', Users], ['poll', 'نظرسنجی', BarChart3]] as const).map(([k, l, I]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold ${tab === k ? 'border-b-2 border-[#34c47f] text-white' : 'text-white/60'}`}><I className="size-4" />{l}</button>
            ))}
          </div>
          {tab === 'chat' && (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {!msgs.length && <p className="py-6 text-center text-sm text-white/50">پیام‌های کلاس این‌جا می‌آید.</p>}
                {msgs.map((m, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2 text-sm ${m.me ? 'bg-[#34c47f]/20' : 'bg-white/5'}`}><b className="block text-xs text-[#7fe0ae]">{m.who}</b><span className="text-white/90">{m.text}</span></div>
                ))}
                <div ref={chatEnd} />
              </div>
              {!replay && <form className="flex gap-2 border-t border-white/10 p-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <input className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40" placeholder="پیام یا پرسش…" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button className="grid size-10 place-items-center rounded-xl bg-[#34c47f] text-[#0b2a1a]" aria-label="فرستادن"><Send className="size-4" /></button>
              </form>}
            </>
          )}
          {tab === 'people' && (
            <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
              {[{ n: r.hostName, role: 'مدرس' }, { n: `${r.me || 'شما'} (شما)`, role: hostView ? 'برگزارکننده' : '', me: true }, ...people.slice(1).map((n) => ({ n, role: '' }))].map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs">{initials(p.n)}</span>
                  <span className="min-w-0 flex-1 truncate">{p.n}{p.role && <span className="ms-2 text-xs text-[#7fe0ae]">{p.role}</span>}</span>
                  {('me' in p && p.me && hand) || (!('me' in p) && i % 7 === 3) ? <Hand className="size-4 text-[#f2b705]" /> : null}
                  {(i === 0 || ('me' in p && p.me && mic)) ? <Mic className="size-4 text-white/70" /> : <MicOff className="size-4 text-white/30" />}
                </li>
              ))}
            </ul>
          )}
          {tab === 'poll' && (
            <div className="grid content-start gap-3 p-4">
              <b className="text-white">{POLL.q}</b>
              {POLL.o.map((o, i) => (
                <button key={o} disabled={vote !== null || !!replay} onClick={() => setVote(i)} className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-start text-sm ${vote === i ? 'border-[#34c47f]' : 'border-white/15'}`}>
                  {vote !== null && <span className="absolute inset-y-0 start-0 bg-[#34c47f]/20" style={{ width: `${(votes[i] / vsum) * 100}%` }} />}
                  <span className="relative flex justify-between gap-2"><span>{o}</span>{vote !== null && <span className="tnum text-white/70">٪{fa(Math.round((votes[i] / vsum) * 100))}</span>}</span>
                </button>
              ))}
              <p className="text-xs text-white/50">{vote === null ? 'نظر شما بی‌نام شمرده می‌شود.' : `${fa(vsum)} نفر رأی دادند.`}</p>
            </div>
          )}
        </aside>
      </div>

      {/* نوار کنترل */}
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-[#12141f]/95 px-3 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        {!replay && <>
          <Ctl on={mic} label={mic ? 'میکروفون روشن' : 'میکروفون خاموش'} onClick={() => { setMic(!mic); toast(mic ? 'میکروفون خاموش شد' : 'میکروفون روشن شد (در نسخهٔ نمایشی صدایی فرستاده نمی‌شود)'); }}>{mic ? <Mic className="size-5" /> : <MicOff className="size-5" />}</Ctl>
          <Ctl on={cam} label={cam ? 'دوربین روشن' : 'دوربین خاموش'} onClick={() => setCam(!cam)}>{cam ? <Video className="size-5" /> : <VideoOff className="size-5" />}</Ctl>
          <Ctl on={hand} label={hand ? 'دست پایین' : 'دست بالا'} onClick={() => { setHand(!hand); if (!hand) toast('دستتان بالا رفت؛ مدرس نوبت می‌دهد'); }}><Hand className="size-5" /></Ctl>
          <Ctl label="پسندیدم" onClick={() => react('like')}><ThumbsUp className="size-5" /></Ctl>
          <Ctl label="دوست داشتم" onClick={() => react('heart')}><Heart className="size-5" /></Ctl>
          {hostView && <>
            <Ctl label="اشتراک صفحه" onClick={() => toast('در کلاس واقعی صفحهٔ رایانه‌تان برای همه نمایش داده می‌شود')}><MonitorUp className="size-5" /></Ctl>
            <Ctl on={rec} label={rec ? 'توقف ضبط' : 'شروع ضبط'} onClick={() => { setRec(!rec); toast(rec ? 'ضبط متوقف شد' : 'ضبط شروع شد؛ به همه اعلام می‌شود'); }}><CircleDot className="size-5" /></Ctl>
          </>}
        </>}
        <span className="mx-1 hidden h-8 w-px bg-white/15 sm:block" />
        {hostView && !replay
          ? <button className="flex h-11 items-center gap-2 rounded-full bg-[#d64a6a] px-5 font-semibold text-white" onClick={() => leave(true)}><PhoneOff className="size-5" />پایان کلاس</button>
          : <button className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 font-semibold text-white" onClick={() => leave()}><LogOut className="size-5" />{replay ? 'بستن ضبط' : 'خروج'}</button>}
      </footer>
    </div>
  );
}

function Ctl({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={on} onClick={onClick}
    className={`grid size-11 place-items-center rounded-full transition ${on ? 'bg-[#34c47f] text-[#0b2a1a]' : 'bg-white/10 text-white hover:bg-white/20'}`}>{children}</button>;
}
