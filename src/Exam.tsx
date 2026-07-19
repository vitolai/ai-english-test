import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Trophy, ArrowLeft, Headphones, BookOpen, CheckSquare, Volume2 } from 'lucide-react';

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
}> = ({ section, timeLeft, totalQs, answeredCount, onExit }) => {
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
            <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
              <Headphones className="w-5 h-5 text-blue-600" />
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

const QuestionCard: React.FC<{
  q: Question;
  index: number;
  answer: string | undefined;
  onAnswer: (qid: number, val: string) => void;
  playingAudioId: number | null;
  setPlayingAudioId: (id: number | null) => void;
}> = ({ q, index, answer, onAnswer, playingAudioId, setPlayingAudioId }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isPart1 = q.type === 'listening' && q.part === 1;
  const isPart2 = q.type === 'listening' && q.part === 2;
  const isListeningPart34 = q.type === 'listening' && (q.part === 3 || q.part === 4);

  useEffect(() => {
    if (playingAudioId !== q.id && audioRef.current) {
      audioRef.current.pause();
    }
  }, [playingAudioId, q.id]);

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
                  playingAudioId === q.id ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600'
                }`}
              >
                <Volume2 className={`w-8 h-8 ${playingAudioId === q.id ? 'text-blue-200' : ''}`} />
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {playingAudioId === q.id ? 'Playing...' : 'Tap to Play Audio'}
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
              playingAudioId === q.id ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600'
            }`}
          >
            <Volume2 className={`w-8 h-8 ${playingAudioId === q.id ? 'text-blue-200' : ''}`} />
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
              {playingAudioId === q.id ? 'Playing...' : 'Tap to Play Question & Responses'}
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
              playingAudioId === q.id ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600'
            }`}
          >
            <Volume2 className={`w-8 h-8 ${playingAudioId === q.id ? 'text-blue-200' : ''}`} />
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
              {playingAudioId === q.id ? 'Playing...' : 'Tap to Play Conversation/Talk & Question'}
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

      {/* Reading Context / Passage */}
      {(q.context || q.passage) && (
        <div className="mb-10 p-8 bg-slate-50/50 rounded-3xl border border-slate-100 text-slate-700 text-lg leading-relaxed shadow-inner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
          <p className="whitespace-pre-line">{q.context || q.passage}</p>
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
            <button
              key={label}
              onClick={() => onAnswer(q.id, label)}
              className={`flex items-center gap-5 p-6 rounded-2xl border-2 text-left transition-all duration-300 group/btn ${
                isSelected 
                  ? 'border-blue-600 bg-blue-50/80 ring-4 ring-blue-100 shadow-lg' 
                  : 'border-slate-100 hover:border-blue-200 bg-white hover:bg-slate-50'
              }`}
            >
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
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Exam: React.FC<ExamProps> = ({ data, onBack }) => {
  const [currentSection, setCurrentSection] = useState<'listening' | 'reading'>('listening');
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState((data.listeningTime || 0) + (data.readingTime || 0) || 1200);
  const [isFinished, setIsFinished] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);

  const listeningQs = data.questions ? data.questions.filter(q => q.type === 'listening') : [];
  const readingQs = data.questions ? data.questions.filter(q => q.type === 'reading') : [];
  const currentQs = currentSection === 'listening' ? listeningQs : readingQs;

  useEffect(() => {
    if (isFinished || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, isFinished]);

  useEffect(() => {
    if (timeLeft <= 0 && !isFinished) {
      setIsFinished(true);
    }
  }, [timeLeft, isFinished]);

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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 animate-in fade-in zoom-in duration-500">
        <div className="max-w-5xl w-full bg-white rounded-[3rem] shadow-2xl p-10 lg:p-20 text-center border border-slate-100">
          <div className="mb-10 relative inline-block">
             <div className="absolute inset-0 bg-amber-200 blur-3xl opacity-30 rounded-full animate-pulse" />
             <Trophy className="w-24 h-24 text-amber-500 relative z-10" />
          </div>
          <h2 className="text-5xl font-black text-slate-800 mb-4 tracking-tighter">Exam Completed!</h2>
          <p className="text-2xl font-bold text-blue-600 mb-16">
            Score: {score} / {total} ({((score / total) * 100).toFixed(0)}%)
          </p>
          
          {/* Detailed Answer Review */}
          <div className="mt-16 overflow-hidden rounded-3xl border border-slate-200 shadow-lg">
            <div className="bg-slate-800 text-white px-6 py-4 font-black text-lg">
              Detailed Answer Review ({total} questions)
            </div>
            <div className="divide-y divide-slate-100">
              {data.questions.map((q, i) => {
                const userAns = userAnswers[q.id];
                const isCorrect = userAns === q.answer;
                const partLabel = q.type === 'listening' ? 'L' : 'R';
                return (
                  <div key={q.id} className={`flex items-center px-6 py-4 ${isCorrect ? 'bg-emerald-50/40' : 'bg-red-50/40'}`}>
                    <div className="w-16 flex-shrink-0">
                      <div className="text-xs font-bold text-slate-400">{partLabel}P{q.part}</div>
                      <div className="text-lg font-black text-slate-700">Q{i+1}</div>
                    </div>
                    <div className="flex-1 min-w-0 px-4">
                      <div className="text-sm text-slate-500 truncate">
                        {(q.question || 'Listen to the audio').slice(0, 60)}
                      </div>
                    </div>
                    <div className="flex-shrink-0 grid grid-cols-2 gap-6 text-center">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Your Answer</div>
                        <div className={`text-2xl font-black ${userAns ? (isCorrect ? 'text-emerald-600' : 'text-red-600') : 'text-slate-300'}`}>
                          {userAns || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Correct</div>
                        <div className="text-2xl font-black text-emerald-600">{q.answer}</div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4 w-8">
                      {isCorrect ? <span className="text-xl">✅</span> : <span className="text-xl">❌</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            onClick={onBack}
            className="px-16 py-6 bg-slate-900 text-white rounded-full font-black text-xl hover:bg-black hover:scale-105 transition-all flex items-center gap-4 mx-auto shadow-2xl mt-12"
          >
            <ArrowLeft className="w-6 h-6" />
            RETURN TO DASHBOARD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-blue-100">
      <StickyHeader 
        section={currentSection} 
        timeLeft={timeLeft} 
        totalQs={data.questions.length} 
        answeredCount={Object.keys(userAnswers).length} 
        onExit={onBack} 
      />

      <main className="flex-1 p-6 lg:p-16">
        <div className="max-w-5xl mx-auto">
          {/* Section Introduction */}
          <div className="mb-16 text-center animate-in slide-in-from-top-8 duration-700">
             <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase">
                {currentSection === 'listening' ? 'Listening Comprehension' : 'Reading Test'}
             </h1>
             <p className="text-slate-500 font-bold text-xl max-w-2xl mx-auto leading-relaxed">
                {currentSection === 'listening' 
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
                index={currentSection === 'listening' ? idx : listeningQs.length + idx}
                answer={userAnswers[q.id]}
                onAnswer={handleAnswer}
                playingAudioId={playingAudioId}
                setPlayingAudioId={setPlayingAudioId}
              />
            ))}
          </div>

          {/* Transition Buttons */}
          <div className="mt-20 mb-32 flex justify-center">
            {currentSection === 'listening' ? (
              <button 
                onClick={jumpToReading}
                className="group px-16 py-8 bg-blue-600 text-white rounded-full font-black text-2xl hover:bg-blue-700 transition-all flex items-center gap-6 shadow-2xl shadow-blue-200 hover:-translate-y-2 active:translate-y-0"
              >
                <BookOpen className="w-8 h-8" />
                PROCEED TO READING SECTION
                <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button 
                onClick={() => setIsFinished(true)}
                className="group px-16 py-8 bg-emerald-600 text-white rounded-full font-black text-2xl hover:bg-emerald-700 transition-all flex items-center gap-6 shadow-2xl shadow-emerald-200 hover:-translate-y-2 active:translate-y-0"
              >
                <Trophy className="w-8 h-8" />
                FINISH EXAM & VIEW SCORE
                <CheckCircle2 className="w-8 h-8 group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Exam;