import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import type { AIConfig } from './Dashboard';
import Exam from './Exam';
import axios from 'axios';
import { X } from 'lucide-react';

const App: React.FC = () => {
    const [examData, setExamData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ phase: 'starting', progress: 0, message: 'Initializing TOEIC AI Engine...' });
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'dashboard' | 'exam'>('dashboard');

    const API_BASE = 'http://localhost:3001';

    useEffect(() => {
        let interval: any;
        if (loading && sessionId) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_BASE}/api/status/${sessionId}`);
                    setStatus(res.data);
                    
                    if (res.data.phase === 'completed') {
                        clearInterval(interval);
                        loadSession(sessionId);
                    }
                    // BUGFIX: If server reports error, stop polling and unblock the UI
                    if (res.data.phase === 'error') {
                        clearInterval(interval);
                        setError(res.data.message || 'Generation failed. Please check your settings and try again.');
                        setLoading(false);
                        setSessionId(null);
                    }
                } catch (err) {
                    console.error('Status poll error', err);
                }
            }, 1500);
        }
        return () => clearInterval(interval);
    }, [loading, sessionId]);

    const startExam = async (count: number, source: string, payload: any, config: AIConfig, maxStorage?: number) => {
        console.log('App: startExam triggered', { count, source, hasPayload: !!payload });
        setLoading(true);
        setSessionId(null);
        setError(null);
        
        // FINAL FRONTEND GUARD: Block network request if API Key is empty or too short
        if (config.aiSource !== 'ollama') {
            if (!config.apiKey.trim()) {
                setError("No API Key provided. Please enter your API Key in Settings.");
                setLoading(false);
                return;
            }
            if (config.apiKey.trim().length < 20) {
                setError("Invalid API Key: Key is too short to be valid. Please check your credentials in Settings.");
                setLoading(false);
                return;
            }
        }

        setStatus({ phase: 'starting', progress: 0, message: 'Ingesting knowledge source...' });

        try {
            let processedSeedText = 'International business topics';
            
            // 1. Handle Ingestion if needed
            if (source === 'url') {
                const ingestRes = await axios.post(`${API_BASE}/api/ingest/web`, { url: payload });
                processedSeedText = (ingestRes.data.text || '').slice(0, 3000); // Truncate to safe length
            } else if (source === 'pdf' && payload) {
                const formData = new FormData();
                formData.append('pdfFile', payload);
                const ingestRes = await axios.post(`${API_BASE}/api/ingest/pdf`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                processedSeedText = (ingestRes.data.text || '').slice(0, 3000); // Truncate to safe length
            } else if (source === 'random') {
                processedSeedText = 'Generate a high-quality TOEIC exam covering diverse international business contexts including office interactions, travel, logistics, and corporate meetings.';
            }

            setStatus({ phase: 'starting', progress: 10, message: 'Initializing generation engine...' });

            const endpoint = `${API_BASE}/api/generate`;
            const res = await axios.post(endpoint, {
                seedText: processedSeedText,
                questionCount: count,
                aiSource: config.aiSource,
                model: config.aiModel,
                apiKey: config.apiKey,
                visionModel: config.visionModel,
                config: { apiUrl: config.apiUrl },
                maxStorage
            });
            
            console.log('App: Generation started', res.data);
            setSessionId(res.data.session_id);
            
            // TRANSITION FIX: If the response comes back with data immediately, enter the exam
            if (res.data.data) {
                setExamData(res.data.data);
                setLoading(false);
                setView('exam');
            }
        } catch (err: any) {
            console.error('App: Generation failed', err);
            // Surface the exact error from backend (e.g. "401 Unauthorized" from AI provider)
            const serverMsg = err.response?.data?.error;
            setError(serverMsg || err.message || 'Generation failed. Check your API Key and network.');
            setLoading(false);
        }
    };

    const loadSession = async (sid: string) => {
        setLoading(true);
        setSessionId(sid);
        setError(null);
        try {
            const examRes = await axios.get(`${API_BASE}/storage/sessions/${sid}/exam_data.json`);
            setExamData(examRes.data);
            setLoading(false);
            setView('exam');
        } catch (err: any) {
            console.error('App: Load session failed', err);
            setError('Could not load session history.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {loading && (
                <div className="fixed inset-0 z-50 bg-blue-900/60 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6 transition-all duration-500">
                    <div className="relative mb-12">
                        <div className="w-24 h-24 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center font-black text-xs text-white/40 uppercase">TOEIC</div>
                    </div>
                    <h2 className="text-5xl font-black mb-4 tracking-tighter uppercase">{status.phase === 'vision' ? 'Visual Analysis' : 'Exam Generation'}</h2>
                    <p className="text-blue-200 font-bold text-xl mb-12 h-8 text-center">{status.message}</p>
                    
                    <div className="w-80 h-3 bg-white/10 rounded-full overflow-hidden border border-white/5 relative">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-1000 ease-out" 
                            style={{ width: `${status.progress}%` }}
                        ></div>
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] w-1/2"></div>
                    </div>
                    <div className="mt-4 font-black text-white/40 text-sm tracking-widest">{status.progress}% COMPLETE</div>
                </div>
            )}
            
            {view === 'dashboard' ? (
                <div className="w-full flex flex-col items-center">
                    {error && (
                        <div className="max-w-6xl w-full px-6 pt-6">
                            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-8 py-6 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top duration-300">
                                <div className="bg-red-600 text-white p-2 rounded-xl shrink-0 mt-0.5">
                                    <X className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-black uppercase tracking-widest text-[10px] mb-1 opacity-60">Generation Failed</p>
                                    <p className="text-sm font-bold">{error}</p>
                                    <button
                                        onClick={() => { setError(null); setLoading(false); setSessionId(null); }}
                                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-full text-xs font-black tracking-widest hover:bg-red-700 transition-all uppercase"
                                    >
                                        DISMISS &amp; TRY AGAIN
                                    </button>
                                </div>
                                <button 
                                    onClick={() => { setError(null); setLoading(false); setSessionId(null); }}
                                    className="p-2 hover:bg-red-100 rounded-lg transition-colors shrink-0"
                                >
                                    <X className="w-5 h-5 opacity-40 hover:opacity-100" />
                                </button>
                            </div>
                        </div>
                    )}
                    <Dashboard onStart={startExam} onReview={loadSession} onClearError={() => setError(null)} />
                </div>
            ) : (
                examData && (
                    <Exam 
                        data={examData} 
                        onBack={() => {
                            setLoading(false);
                            setSessionId(null);
                            setView('dashboard');
                            setExamData(null);
                        }} 
                    />
                )
            )}
        </div>
    );
};

export default App;
