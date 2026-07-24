import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Trophy, ArrowLeft, Headphones, BookOpen, CheckSquare, Volume2, Printer } from 'lucide-react';

interface Question {
  id: number;
  part: number;
  type: 'listening' | 'reading';
  answer: string;
  options: string[];
  image?: string;
  audio?: string;
  question?: string;
  context?: string;
  passage?: string;
  transcript?: string;
}

interface ExamProps {
  data: {
    title: string;
    questions: Question[];
    listeningTime?: number;
    readingTime?: number;
  };
  onBack: () => void;
}

const StickyHeader: React.FC<{
  section: 'listening' | 'reading';
  timeLeft: number;
  totalQs: number;
  answeredCount: number;
  onExit: () => void;
  notification?: string;
}> = ({ section, timeLeft, totalQs, answeredCount, onExit, notification }) => {
  const progress = totalQs > 0 ? (answeredCount / totalQs) * 100 : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-4 lg:px-8 lg:py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={onExit} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                {section === 'listening' ? 'Listening Comprehension' : 'Reading Test'}
              </p>
              <p className="text-xs font-bold text-slate-400">{answeredCount} / {totalQs} Answered</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {notification && (
              <div className="px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold animate-pulse">
                {notification}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
              {section === 'listening' ? <Headphones className="w-5 h-5 text-blue-600" /> : <BookOpen className="w-5 h-5 text-blue-600" />}
              <span className="font-mono font-black text-lg text-slate-800 tabular-nums">
                {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="w-48 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Normalize an Unsplash image ID stored on a Question.
// The backend mock generator stores bare IDs (e.g. '1556761175-b413da4baf72'),
// but the AI provider sometimes returns IDs already prefixed with 'photo' or
// 'photo-' (e.g. 'photo-1504198453319-5da941019820') or even malformed
// concatenations (e.g. 'photo15041984533195e291196'). The frontend builds the
// URL as 'https://images.unsplash.com/photo-${id}', so a stray 'photo' prefix
// produces 'photo-photo-...' and 404s. This helper strips any leading
// 'photo'/'photo-' and validates the remaining ID matches the Unsplash format
// (digits-word). Anything that doesn't validate falls back to a known-good ID
// so Part 1 always shows a photo.
const FALLBACK_UNSPLASH_ID = '1556761175-b413da4baf72';
function unsplashUrl(rawId: string | undefined): string | null {
  if (!rawId) return null;
  let id = rawId.trim();
  // Strip any leading 'photo-' or 'photo' prefix the AI may have included.
  id = id.replace(/^photo-?/i, '');
  // Valid Unsplash photo IDs look like '1556761175-b413da4baf72' (digits-word).
  if (!/^\d+-[a-z0-9_-]+$/i.test(id)) {
    id = FALLBACK_UNSPLASH_ID;
  }
  return `https://images.unsplash.com/photo-${id}?w=800&h=600&fit=crop&crop=entropy&auto=format`;
}

// Trim P6 passage blanks so the number of blanks matches the number of
// questions that share this same passage.  If a passage has 3 blanks but
// only 2 questions reference it, the third blank line is removed.
// If 2 blanks but 3 questions, extra blanks are appended.
function trimP6PassageBlanks(q: Question, allQuestions: Question[]): string {
  if (q.part !== 6 || q.type !== 'reading') return q.context || q.passage || '';
  const passage = q.context || q.passage || '';
  // Count how many P6 questions share this exact passage text
  const sharedCount = allQuestions.filter(
    q2 => q2.part === 6 && q2.type === 'reading' && (q2.context || q2.passage) === passage
  ).length;
  if (sharedCount === 0) return passage;
  // Count all blanks: numbered (1), (2), (3) AND underscore ___ patterns
  const blankRegex = /(\(\d+\)|_{3,})/g;
  const allBlanks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = blankRegex.exec(passage)) !== null) {
    allBlanks.push(m[0]);
  }
  if (allBlanks.length === sharedCount) return passage;

  if (allBlanks.length > sharedCount) {
    // Remove excess blanks from the end of the passage
    let result = passage;
    for (let i = allBlanks.length - 1; i >= sharedCount; i--) {
      const blank = allBlanks[i];
      const idx = result.lastIndexOf(blank);
      if (idx !== -1) {
        result = result.slice(0, idx) + result.slice(idx + blank.length);
      }
    }
    return result.replace(/\n\s*$/, '').trimEnd();
  }

  // allBlanks.length < sharedCount: append missing blank markers
  let result = passage.trimEnd();
  for (let i = allBlanks.length + 1; i <= sharedCount; i++) {
    result += ` (${i})`;
  }
  return result;
}

const QuestionCard: React.FC<{
  q: Question;
  index: number;
  answer: string | undefined;
  onAnswer: (qid: number, val: string) => void;
  playingAudioId: number | null;
  setPlayingAudioId: (id: number | null) => void;
  allQuestions: Question[];
}> = ({ q, index, answer, onAnswer, playingAudioId, setPlayingAudioId, allQuestions }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isPart1 = q.type === 'listening' && q.part === 1;
  const isPart2 = q.type === 'listening' && q.part === 2;
  const isListeningPart34 = q.type === 'listening' && (q.part === 3 || q.part === 4);

  useEffect(() => {
    if (playingAudioId !== q.id && audioRef.current) {
      audioRef.current.pause();
    }
  }, [playingAudioId, q.id]);

  // For P3/P4 group audio: detect if any question sharing the same audio
  // file is currently playing, so all questions in the group show "Playing...".
  const isGroupPlaying = useMemo(() => {
    if (playingAudioId === null || !q.audio) return false;
    const playingQ = allQuestions.find(qq => qq.id === playingAudioId);
    return Boolean(playingQ && playingQ.audio === q.audio && playingQ.id !== q.id);
  }, [playingAudioId, q.id, q.audio, allQuestions]);

  const isActive = playingAudioId === q.id || isGroupPlaying;

  const handlePlay = () => {
    if (audioRef.current) {
      if (playingAudioId === q.id) {
        audioRef.current.pause();
        setPlayingAudioId(null);
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  return (
    <div id={`q-${q.id}`} className="group relative bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 lg:p-12 mb-12 transition-all hover:shadow-xl hover:border-blue-100">
      {/* Answered Indicator */}
      {answer && (
        <div className="absolute -top-3 -right-3 bg-blue-600 text-white p-2 rounded-full shadow-lg transform scale-110 animate-in zoom-in">
          <CheckSquare className="w-5 h-5" />
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl shadow-lg shadow-blue-200">
            {index + 1}
          </span>
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Part {q.part}</h4>
            <p className="text-xs font-bold text-blue-500">{q.type.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* PART 1: Photo + Audio ONLY (no text, no transcript, no question text) */}
      {isPart1 && (
        <>
          {/* Photo */}
          {unsplashUrl(q.image) && (
            <div className="mb-10 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex items-center justify-center group/photo transition-all hover:bg-blue-50/30">
              <img 
                src={unsplashUrl(q.image) || undefined}
                alt="TOEIC Part 1 Photograph"
                className="max-w-full max-h-[500px] rounded-xl shadow-lg border border-slate-200 object-cover"
              />
            </div>
          )}

          {/* Audio Player - centered, large */}
          {q.audio && (
            <div className="mb-10 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex items-center gap-6 group/audio transition-all hover:bg-blue-50/30 active:scale-[0.99]">
              <div 
                onClick={handlePlay}
                className={`p-4 rounded-2xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-90 flex-shrink-0 ${
                  isActive ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600'
                }`}
              >
                <Volume2 className={`w-8 h-8 ${isActive ? 'text-blue-200' : ''}`} />
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {isActive ? 'Playing...' : 'Tap to Play Audio'}
                </p>
                <p className="text-xs text-slate-500">A, B, C, D will be spoken in sequence</p>
              </div>
              <audio 
                ref={audioRef}
                onPlay={() => setPlayingAudioId(q.id)}
                onPause={() => setPlayingAudioId(null)}
                onEnded={() => setPlayingAudioId(null)}
                className="hidden" 
                src={q.audio.startsWith('http') ? q.audio : `/storage/${q.audio}`}
              />
            </div>
          )}
        </>
      )}

      {/* PART 2: Audio ONLY (no photo, no transcript, no question text, 3 options) */}
      {isPart2 && q.audio && (
        <div className="mb-10 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex items-center gap-6 group/audio transition-all hover:bg-blue-50/30 active:scale-[0.99]">
          <div 
            onClick={handlePlay}
            className={`p-4 rounded-2xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-90 flex-shrink-0 ${
              isActive ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600'
            }`}
          >
            <Volume2 className={`w-8 h-8 ${isActive ? 'text-blue-200' : ''}`} />
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isActive ? 'Playing...' : 'Tap to Play Question & Responses'}
            </p>
            <p className="text-xs text-slate-500">A, B, C responses will be spoken</p>
          </div>
          <audio 
            ref={audioRef}
            onPlay={() => setPlayingAudioId(q.id)}
            onPause={() => setPlayingAudioId(null)}
            onEnded={() => setPlayingAudioId(null)}
            className="hidden" 
            src={q.audio.startsWith('http') ? q.audio : `/storage/${q.audio}`}
          />
        </div>
      )}

      {/* PART 3/4: Audio + Question Text + 4 Options */}
      {isListeningPart34 && q.audio && (
        <div className="mb-10 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex items-center gap-6 group/audio transition-all hover:bg-blue-50/30 active:scale-[0.99]">
          <div 
            onClick={handlePlay}
            className={`p-4 rounded-2xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-90 flex-shrink-0 ${
              isActive ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600'
            }`}
          >
            <Volume2 className={`w-8 h-8 ${isActive ? 'text-blue-200' : ''}`} />
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isActive ? 'Playing...' : 'Tap to Play Conversation/Talk & Question'}
            </p>
            <p className="text-xs text-slate-500">Then answer the question below</p>
          </div>
          <audio 
            ref={audioRef}
            onPlay={() => setPlayingAudioId(q.id)}
            onPause={() => setPlayingAudioId(null)}
            onEnded={() => setPlayingAudioId(null)}
            className="hidden" 
            src={q.audio.startsWith('http') ? q.audio : `/storage/${q.audio}`}
          />
        </div>
      )}

      {/* Reading Context / Passage (hidden for Part 1) */}
      {!isPart1 && (q.context || q.passage) && (
        <div className="mb-10 p-8 bg-slate-50/50 rounded-3xl border border-slate-100 text-slate-700 text-lg leading-relaxed shadow-inner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
          <p className="whitespace-pre-line">{trimP6PassageBlanks(q, allQuestions)}</p>
        </div>
      )}

      {/* Question Text - HIDDEN for Part 1 & 2 (audio only) */}
      {!isPart1 && !isPart2 && (
        <h3 className="text-2xl font-black text-slate-900 mb-8 leading-tight">
          {q.question || (q.type === 'listening' ? 'Listen to the conversation/talk and answer the question:' : 'Read the text and choose the best answer:')}
        </h3>
      )}
      {/* Part 1: No text shown at all - instruction is in audio area */}

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
        {q.options.map((opt, i) => {
          const label = String.fromCharCode(65 + i);
          const isSelected = answer === label;
          const isPart2Only3 = isPart2 && i >= 3; // Part 2 only has 3 options
          if (isPart2Only3) return null;
          return (
            <label
              key={label}
              className={`flex items-center gap-5 p-6 rounded-2xl border-2 text-left transition-all duration-300 group/btn cursor-pointer ${
                isSelected 
                  ? 'border-blue-600 bg-blue-50/80 ring-4 ring-blue-100 shadow-lg' 
                  : 'border-slate-100 hover:border-blue-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                value={label}
                checked={isSelected}
                onChange={() => onAnswer(q.id, label)}
                className="sr-only"
              />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 transition-all ${
                isSelected ? 'bg-blue-600 text-white rotate-6' : 'bg-slate-100 text-slate-400 group-hover/btn:bg-blue-100 group-hover/btn:text-blue-600'
              }`}>
                {label}
              </div>
              {/* Part 1 & Part 2: hide option text (audio only) - show placeholder */}
              {isPart1 || isPart2 ? (
                <span className={`font-bold text-sm italic ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                  (Listen to audio)
                </span>
              ) : (
                <span className={`font-bold text-lg ${isSelected ? 'text-blue-900' : 'text-slate-600'}`}>
                  {opt}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
};

const Exam: React.FC<ExamProps> = ({ data, onBack }) => {
  const isTestMode = process.env.NODE_ENV === 'test' || new URLSearchParams(window.location.search).get('fastTimer') === '1';
  const timerDivisor = isTestMode ? 100 : 1;

  const [currentSection, setCurrentSection] = useState<'listening' | 'reading'>('listening');
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [listeningTimeLeft, setListeningTimeLeft] = useState((data.listeningTime || 600) / timerDivisor);
  const [readingTimeLeft, setReadingTimeLeft] = useState((data.readingTime || 600) / timerDivisor);
  const [isFinished, setIsFinished] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [listeningExpired, setListeningExpired] = useState(false);
  const [listeningLocked, setListeningLocked] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const listeningQs = data.questions ? data.questions.filter(q => q.type === 'listening') : [];
  const readingQs = data.questions ? data.questions.filter(q => q.type === 'reading') : [];
  const effectiveSection = listeningLocked ? 'reading' : currentSection;
  const currentQs = effectiveSection === 'listening' ? listeningQs : readingQs;

  useEffect(() => {
    if (isFinished) return;
    if (currentSection === 'listening' && listeningTimeLeft <= 0) return;
    if (currentSection === 'reading' && readingTimeLeft <= 0) return;
    const interval = setInterval(() => {
      if (currentSection === 'listening') {
        setListeningTimeLeft(t => t - 1);
      } else {
        setReadingTimeLeft(t => t - 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentSection, listeningTimeLeft, readingTimeLeft, isFinished]);

  useEffect(() => {
    if (listeningTimeLeft <= 0 && !isFinished && currentSection === 'listening' && !listeningExpired) {
      setListeningExpired(true);
      setListeningLocked(true);
      jumpToReading();
    }
  }, [listeningTimeLeft, isFinished, currentSection, listeningExpired]);

  useEffect(() => {
    if (listeningExpired) {
      setShowToast(true);
      const toastTimer = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(toastTimer);
    }
  }, [listeningExpired]);

  useEffect(() => {
    if (readingTimeLeft <= 0 && !isFinished && currentSection === 'reading') {
      setIsFinished(true);
    }
  }, [readingTimeLeft, isFinished, currentSection]);

  const handleAnswer = (qid: number, option: string) => {
    setUserAnswers(prev => ({ ...prev, [qid]: option }));
  };

  const jumpToReading = () => {
    setCurrentSection('reading');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isFinished) {
    const score = data.questions.filter(q => userAnswers[q.id] === q.answer).length;
    const total = data.questions.length;
    const pct = ((score / total) * 100).toFixed(0);
    const PART_LABELS: Record<number, string> = { 1: 'LP1', 2: 'LP2', 3: 'LP3', 4: 'LP4', 5: 'RP5', 6: 'RP6', 7: 'RP7' };

    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-10 text-slate-900 animate-in fade-in duration-500">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .print-full-width { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
            .print-break-inside-avoid { break-inside: avoid; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
        <div className="max-w-5xl w-full mx-auto print-full-width">
          {/* Score Summary */}
          <div className="bg-white rounded-[3rem] shadow-2xl p-10 lg:p-20 text-center border border-slate-100 mb-12 print-break-inside-avoid">
            <div className="mb-10 relative inline-block no-print">
              <div className="absolute inset-0 bg-amber-200 blur-3xl opacity-30 rounded-full animate-pulse" />
              <Trophy className="w-24 h-24 text-amber-500 relative z-10" />
            </div>
            <h2 className="text-5xl font-black text-slate-800 mb-4 tracking-tighter">Exam Completed!</h2>
            <p className="text-2xl font-bold text-blue-600 mb-2">
              Score: {score} / {total} ({pct}%)
            </p>
            <div className="flex justify-center gap-8 mt-6 mb-4">
              <div className="text-center">
                <div className="text-4xl font-black text-emerald-600">{score}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-red-500">{total - score}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Incorrect</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-slate-700">{pct}%</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Percentage</div>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="no-print mt-8 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-black text-lg transition-all flex items-center gap-3 mx-auto shadow-sm hover:scale-105"
            >
              <Printer className="w-5 h-5" />
              Print Results
            </button>
          </div>

          {/* Detailed Answer Review */}
          <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden mb-12">
            <div className="bg-slate-800 text-white px-8 py-5 font-black text-lg">
              Detailed Answer Review ({total} questions)
            </div>
            <div className="divide-y divide-slate-100">
              {data.questions.map((q, i) => {
                const userAns = userAnswers[q.id];
                const isCorrect = userAns === q.answer;
                const partLabel = PART_LABELS[q.part] || `P${q.part}`;
                const isPart1 = q.type === 'listening' && q.part === 1;
                const isPart34 = q.type === 'listening' && (q.part === 3 || q.part === 4);
                const hasPassage = Boolean(q.context || q.passage);
                const optionLabels = ['A', 'B', 'C', 'D'];
                return (
                  <div key={q.id} className={`px-8 py-6 print-break-inside-avoid ${
                    !userAns ? 'bg-slate-50/60' : isCorrect ? 'bg-emerald-50/40' : 'bg-red-50/40'
                  }`}>
                    {/* Header row */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-black tracking-wider">
                        {partLabel}
                      </span>
                      <span className="text-lg font-black text-slate-700">Q{i + 1}</span>
                      <span className={`ml-auto text-sm font-bold px-3 py-1 rounded-full ${
                        !userAns ? 'bg-slate-200 text-slate-500' : isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {!userAns ? 'Unanswered' : isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    {/* Photo thumbnail for Part 1 */}
                    {isPart1 && unsplashUrl(q.image) && (
                      <div className="mb-4">
                        <img
                          src={unsplashUrl(q.image) || undefined}
                          alt="Part 1 photograph"
                          className="w-32 h-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                        />
                      </div>
                    )}

                    {/* Passage for Part 3/4 */}
                    {isPart34 && hasPassage && (
                      <div className="mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
                        <p className="whitespace-pre-line">{q.context || q.passage}</p>
                      </div>
                    )}

                    {/* Full question text (NO truncation) */}
                    <p className="text-base font-bold text-slate-800 mb-4 leading-relaxed">
                      {q.question || (q.type === 'listening' ? 'Listen to the audio and answer the question.' : 'Read the text and choose the best answer.')}
                    </p>

                    {/* All 4 options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {q.options.map((opt, oi) => {
                        const label = optionLabels[oi];
                        const isUserSelected = userAns === label;
                        const isCorrectOption = q.answer === label;
                        let borderCls = 'border-slate-200';
                        let bgCls = 'bg-white';
                        let textCls = 'text-slate-500';
                        if (isCorrectOption) {
                          borderCls = 'border-emerald-500';
                          bgCls = 'bg-emerald-50';
                          textCls = 'text-emerald-800';
                        }
                        if (isUserSelected && !isCorrectOption) {
                          borderCls = 'border-red-500';
                          bgCls = 'bg-red-50';
                          textCls = 'text-red-700';
                        }
                        return (
                          <div
                            key={label}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 ${borderCls} ${bgCls} transition-all`}
                          >
                            <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                              isCorrectOption ? 'bg-emerald-500 text-white' : isUserSelected ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {label}
                            </span>
                            <span className={`text-sm font-semibold ${textCls}`}>
                              {isPart1 || (q.type === 'listening' && q.part === 2) ? '(Audio option)' : opt}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* User answer vs correct summary */}
                    <div className="flex items-center gap-6 mt-4 text-sm">
                      <span className="font-bold text-slate-500">
                        Your answer: <span className={isCorrect ? 'text-emerald-600' : 'text-red-600'}>{userAns || '—'}</span>
                      </span>
                      <span className="font-bold text-slate-500">
                        Correct: <span className="text-emerald-600">{q.answer}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Return to Dashboard */}
          <div className="flex justify-center mb-16">
            <button
              onClick={onBack}
              className="no-print px-16 py-6 bg-slate-900 text-white rounded-full font-black text-xl hover:bg-black hover:scale-105 transition-all flex items-center gap-4 shadow-2xl"
            >
              <ArrowLeft className="w-6 h-6" />
              RETURN TO DASHBOARD
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-blue-100">
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-amber-500 text-white rounded-full font-black text-lg shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          Listening time is up! Now in Reading section.
        </div>
      )}
      <StickyHeader 
        section={effectiveSection} 
        timeLeft={effectiveSection === 'listening' ? listeningTimeLeft : readingTimeLeft} 
        totalQs={data.questions.length} 
        answeredCount={Object.keys(userAnswers).length} 
        onExit={onBack}
        notification={undefined}
      />

      <main className="flex-1 p-6 lg:p-16">
        <div className="max-w-5xl mx-auto">
          {/* Section Introduction */}
          <div className="mb-16 text-center animate-in slide-in-from-top-8 duration-700">
             <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase">
                {effectiveSection === 'listening' ? 'Listening Comprehension' : 'Reading Test'}
             </h1>
             <p className="text-slate-500 font-bold text-xl max-w-2xl mx-auto leading-relaxed">
                {effectiveSection === 'listening' 
                    ? 'Carefully observe any photograph provided and listen to the audio prompts. You will only hear each prompt once.'
                    : 'Read the provided passages or incomplete sentences and select the best answer to complete the meaning.'
                }
             </p>
          </div>

          <div className="space-y-12">
            {currentQs.map((q, idx) => (
              <QuestionCard 
                key={q.id}
                q={q}
                index={effectiveSection === 'listening' ? idx : listeningQs.length + idx}
                answer={userAnswers[q.id]}
                onAnswer={handleAnswer}
                playingAudioId={playingAudioId}
                setPlayingAudioId={setPlayingAudioId}
                allQuestions={data.questions}
              />
            ))}
          </div>

          {/* Transition Buttons */}
          <div className="mt-20 mb-32 flex justify-center">
            {effectiveSection === 'listening' && listeningTimeLeft > 0 ? (
              <button 
                onClick={() => { setListeningLocked(true); jumpToReading(); }}
                className="group px-16 py-8 bg-blue-600 text-white rounded-full font-black text-2xl hover:bg-blue-700 transition-all flex items-center gap-6 shadow-2xl shadow-blue-200 hover:-translate-y-2 active:translate-y-0"
              >
                <BookOpen className="w-8 h-8" />
                PROCEED TO READING SECTION
                <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : effectiveSection === 'reading' ? (
              <button 
                onClick={() => setIsFinished(true)}
                className="group px-16 py-8 bg-emerald-600 text-white rounded-full font-black text-2xl hover:bg-emerald-700 transition-all flex items-center gap-6 shadow-2xl shadow-emerald-200 hover:-translate-y-2 active:translate-y-0"
              >
                <Trophy className="w-8 h-8" />
                FINISH EXAM & VIEW SCORE
                <CheckCircle2 className="w-8 h-8 group-hover:scale-110 transition-transform" />
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Exam;