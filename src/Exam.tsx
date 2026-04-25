import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, CheckCircle2, Trophy, Clock, ArrowLeft, Headphones, BookOpen, CheckSquare } from 'lucide-react';

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
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const progress = (answeredCount / totalQs) * 100;

    return (
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm transition-all duration-300">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <button onClick={onExit} className="flex items-center gap-2 font-black text-slate-400 hover:text-slate-600 transition-colors px-3 py-2 rounded-xl hover:bg-slate-50">
                    <ChevronLeft className="w-5 h-5" />
                    <span className="hidden sm:inline">EXIT</span>
                </button>

                <div className="flex flex-col items-center flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                        {section === 'listening' ? <Headphones className="w-4 h-4 text-blue-600" /> : <BookOpen className="w-4 h-4 text-emerald-600" />}
                        <h2 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-tight">
                            {section === 'listening' ? 'Section 1: Listening' : 'Section 2: Reading'}
                        </h2>
                    </div>
                    <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-500 ${section === 'listening' ? 'bg-blue-600' : 'bg-emerald-600'}`} 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                </div>

                <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black font-mono text-lg sm:text-xl border transition-all ${
                    timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-800 border-slate-200'
                }`}>
                    <Clock className="w-5 h-5 hidden xs:inline" />
                    {formatTime(timeLeft)}
                </div>
            </div>
        </div>
    );
};

const QuestionCard: React.FC<{
    q: Question;
    index: number;
    answer: string | undefined;
    onAnswer: (val: string) => void;
    playingAudioId: number | null;
    setPlayingAudioId: (id: number | null) => void;
}> = ({ q, index, answer, onAnswer, playingAudioId, setPlayingAudioId }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (playingAudioId !== q.id && audioRef.current) {
            audioRef.current.pause();
        }
    }, [playingAudioId, q.id]);

    const handlePlay = () => {
        setPlayingAudioId(q.id);
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

            {/* Listening Audio */}
            {q.type === 'listening' && (
                <div className="mb-10 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex items-center gap-6 group/audio transition-all hover:bg-blue-50/30 active:scale-[0.99]">
                    <div 
                        onClick={() => {
                            if (audioRef.current) {
                                if (playingAudioId === q.id) {
                                    audioRef.current.pause();
                                    setPlayingAudioId(null);
                                } else {
                                    audioRef.current.play();
                                }
                            }
                        }}
                        className={`p-4 rounded-2xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-90 ${playingAudioId === q.id ? 'bg-blue-600 text-white animate-pulse' : 'bg-white text-blue-600'}`}
                    >
                        <Play className="w-6 h-6 fill-current" />
                    </div>
                    <audio 
                        ref={audioRef}
                        onPlay={handlePlay}
                        onPause={() => setPlayingAudioId(null)}
                        onEnded={() => setPlayingAudioId(null)}
                        className="hidden" 
                        src={q.audio?.startsWith('http') ? q.audio : `http://localhost:3001/${q.audio}`}
                    />
                </div>
            )}

            {/* Reading Context */}
            {(q.context || q.passage) && (
                <div className="mb-10 p-8 bg-slate-50/50 rounded-3xl border border-slate-100 text-slate-700 text-lg leading-relaxed shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
                    <p className="whitespace-pre-line">{q.context || q.passage}</p>
                </div>
            )}

            {/* Image (Part 1) */}
            {q.image && (
                <div className="mb-10 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100 max-w-4xl mx-auto group/img">
                    <img 
                        className="w-full h-auto object-cover transform transition-transform duration-700 group-hover/img:scale-105" 
                        src={q.image.startsWith('http') ? q.image : `http://localhost:3001/${q.image}`} 
                        alt="Question Scene" 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800';
                        }}
                    />
                    <div className="p-3 bg-white/90 backdrop-blur-sm text-[10px] text-center text-slate-400 border-t border-slate-100 font-bold uppercase tracking-widest">
                        Imagery provided by <a href="https://unsplash.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Unsplash API</a>
                    </div>
                </div>
            )}

            {/* Question Text */}
            <h3 className="text-2xl font-black text-slate-800 mb- aggregation-10 leading-tight">
                {q.question || (q.type === 'listening' ? "Listen carefully and choose the best response:" : "Read the text and choose the best answer:")}
            </h3>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
                {q.options.map((opt, i) => {
                    const label = String.fromCharCode(65 + i);
                    const isSelected = answer === label;
                    return (
                        <button
                            key={label}
                            onClick={() => onAnswer(label)}
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
                            <span className={`font-bold text-lg ${isSelected ? 'text-blue-900' : 'text-slate-600'}`}>
                                {opt}
                            </span>
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
          
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-3 mb-16">
             {data.questions.map((q, i) => (
                <div key={q.id} className={`p-4 rounded-2xl border-2 font-black transition-all hover:scale-110 ${
                    userAnswers[q.id] === q.answer ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
                }`}>
                    <div className="text-[10px] opacity-60 mb-1">Q{i+1}</div>
                    {userAnswers[q.id] || '-'}
                </div>
             ))}
          </div>

          <button 
            onClick={onBack}
            className="px-16 py-6 bg-slate-900 text-white rounded-full font-black text-xl hover:bg-black hover:scale-105 transition-all flex items-center gap-4 mx-auto shadow-2xl"
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
                    ? "Carefully observe any photography provided and listen to the audio prompts. You will only hear each prompt once." 
                    : "Read the provided passages or incomplete sentences and select the best answer to complete the meaning."}
             </p>
          </div>

          <div className="space-y-12">
            {currentQs.map((q, idx) => (
                <QuestionCard 
                    key={q.id}
                    q={q}
                    index={currentSection === 'listening' ? idx : listeningQs.length + idx}
                    answer={userAnswers[q.id]}
                    onAnswer={(val) => handleAnswer(q.id, val)}
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
                  GO TO READING SECTION
                  <ChevronRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
                </button>
            ) : (
                <button 
                  onClick={() => setIsFinished(true)}
                  className="group px-16 py-8 bg-emerald-600 text-white rounded-full font-black text-2xl hover:bg-emerald-700 transition-all flex items-center gap-6 shadow-2xl shadow-emerald-200 hover:-translate-y-2 active:translate-y-0"
                >
                  COMPLETE & SEE SCORE
                  <CheckCircle2 className="w-8 h-8 group-hover:scale-125 transition-transform" />
                </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Exam;
