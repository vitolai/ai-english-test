import React, { useState } from 'react';
import { Settings, Play, Globe, FileText, Shuffle, X, Eye, EyeOff, Cloud, Server } from 'lucide-react';

export interface AIConfig {
  aiSource: string;
  aiModel: string;
  apiUrl: string;
  apiKey: string;
  visionModel?: string;
  maxStorage?: number;
  provider?: 'ollama' | 'groq';
}

interface DashboardProps {
  onStart: (count: number, source: string, payload: any, config: AIConfig, maxStorage?: number) => void;
  onReview?: (sessionId: string) => void;
  onClearError?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onStart }) => {
  const [count, setCount] = useState(10);
  const [source, setSource] = useState('random');
  const [webUrl, setWebUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [provider, setProvider] = useState<'ollama' | 'groq'>('ollama');
  
  const aiSource = 'ai-cloud';
  const [aiModel, setAiModel] = useState('nemotron-3-super:cloud');
  const [customModel, setCustomModel] = useState('');
  const [aiApiUrl, setAiApiUrl] = useState('http://localhost:11434/v1/chat/completions');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const maxStorage = 50;

  const [groqModel, setGroqModel] = useState('llama-3.1-70b-versatile');
  const [groqApiKey, setGroqApiKey] = useState('');

  const counts = [10, 20, 30, 50, 100, 200];

  const SourceOption = ({ icon, title, desc, active, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-6 p-6 rounded-3xl border-2 transition-all text-left group ${active ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-blue-200'}`}
    >
      <div className={`p-4 rounded-2xl transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
        {icon}
      </div>
      <div>
        <h3 className={`font-black text-xl ${active ? 'text-blue-900' : 'text-slate-700'}`}>{title}</h3>
        <p className="text-slate-500 font-medium">{desc}</p>
      </div>
      <div className={`ml-auto w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-blue-600 bg-blue-600 ring-4 ring-blue-100' : 'border-slate-200'}`}>
        {active && <div className="w-3 h-3 bg-white rounded-full" />}
      </div>
    </button>
  );

  const handleStart = () => {
    if (!apiKey && provider === 'ollama') {
      alert('Please enter your API Key.');
      return;
    }
    if (!groqApiKey && provider === 'groq') {
      alert('Please enter your Groq API Key.');
      return;
    }
    if (aiModel === 'custom' && !customModel) {
      alert('Please enter custom model name.');
      return;
    }

    const config: AIConfig = {
      aiSource,
      aiModel: provider === 'ollama' 
        ? (aiModel === 'custom' ? customModel : aiModel)
        : groqModel,
      apiUrl: provider === 'ollama' ? aiApiUrl : 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: provider === 'ollama' ? apiKey : groqApiKey,
      provider
    };

    setIsSettingsOpen(false);
    onStart(count, source, source === 'web' ? webUrl : pdfFile, config, maxStorage);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-600 h-2 w-full"></div>
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">TOEIC Practice Exam</h1>
              <p className="text-slate-500 mt-2 text-lg">Configure your exam settings and start practicing</p>
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
              <Settings className="text-slate-600 w-6 h-6" />
            </button>
          </div>
          <div className="space-y-12">
            <div>
              <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Number of Questions</label>
              <div className="grid grid-cols-6 gap-3">
                {counts.map((c) => (
                  <button key={c} onClick={() => setCount(c)} className={`py-4 rounded-2xl font-black transition-all ${count === c ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 transform scale-105' : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-blue-200'}`}>
                    {c === 200 ? '200 (Full)' : c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Content Source</label>
              <div className="grid grid-cols-1 gap-4">
                <SourceOption icon={<Shuffle className="w-6 h-6" />} title="Random Shuffle" desc="Practice with randomized questions" active={source === 'random'} onClick={() => setSource('random')} />
                <SourceOption icon={<Globe className="w-6 h-6" />} title="Web-Sourced Content" desc="Real-time news from tech and finance" active={source === 'web'} onClick={() => setSource('web')} />
                <SourceOption icon={<FileText className="w-6 h-6" />} title="Self Import" desc="Upload your own PDF or text files" active={source === 'self'} onClick={() => setSource('self')} />
              </div>
            </div>
            {source === 'web' && (
              <div className="p-8 bg-blue-50/50 rounded-3xl border-2 border-blue-100">
                <label className="block text-sm font-black text-blue-400 uppercase tracking-widest mb-4">Target Website URL</label>
                <input type="text" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} placeholder="https://technews.tw/..." className="w-full p-4 rounded-2xl border-2 border-blue-100 bg-white font-bold outline-none" />
              </div>
            )}
            {source === 'self' && (
              <div className="p-8 bg-blue-50/50 rounded-3xl border-2 border-blue-100">
                <label className="block text-sm font-black text-blue-400 uppercase tracking-widest mb-4">Upload PDF Document</label>
                <div className="w-full relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-300 bg-white rounded-2xl">
                  <input type="file" accept=".pdf" onChange={(e) => { if (e.target.files) setPdfFile(e.target.files[0]) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <FileText className="w-12 h-12 text-blue-400 mb-3" />
                  <span className="font-bold text-blue-800 text-lg">{pdfFile ? pdfFile.name : 'Click to select a PDF'}</span>
                </div>
              </div>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-full font-black text-xl flex items-center justify-center gap-4 transition-all hover:shadow-2xl active:scale-95 group">
              <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
              START EXAM
            </button>
          </div>
        </div>
      </div>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Settings className="w-6 h-6 text-blue-600" />
                AI Configuration
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-3">AI Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setProvider('ollama')}
                    className={`p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${provider === 'ollama' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-blue-200'}`}
                  >
                    <Server className="w-5 h-5" />
                    <span className="font-bold">Ollama</span>
                  </button>
                  <button
                    onClick={() => setProvider('groq')}
                    className={`p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${provider === 'groq' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-blue-200'}`}
                  >
                    <Cloud className="w-5 h-5" />
                    <span className="font-bold">Groq</span>
                  </button>
                </div>
              </div>

              {provider === 'ollama' ? (
                <>
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Model</label>
                    <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-bold outline-none">
                      <option value="ollama/nemotron-3-super:cloud">ollama/nemotron-3-super:cloud</option>
                      <option value="ollama/minimax-m2.7:cloud">ollama/minimax-m2.7:cloud</option>
                      <option value="ollama/deepseek-v3.1:671b-cloud">ollama/deepseek-v3.1:671b-cloud</option>
                      <option value="ollama/qwen3-coder:480b-cloud">ollama/qwen3-coder:480b-cloud</option>
                      <option value="custom">Custom...</option>
                    </select>
                  </div>
                  {aiModel === 'custom' && (
                    <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" placeholder="Enter model name (e.g. qwen3:32b)" />
                  )}
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-3">API Endpoint</label>
                    <input type="text" value={aiApiUrl} onChange={(e) => setAiApiUrl(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 font-mono text-sm outline-none" placeholder="http://localhost:11434/v1/chat/completions" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">Ollama API Key</label>
                      <a href="https://ollama.com/" target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1">
                        Get Ollama <Globe className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full p-4 pr-12 rounded-xl border-2 border-blue-200 bg-white text-blue-950 font-mono font-bold outline-none ring-blue-50 focus:ring-4 transition-all" placeholder="Enter your Cloud API Key" />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Model</label>
                    <select value={groqModel} onChange={(e) => setGroqModel(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-bold outline-none">
                      <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Fast)</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B (Ultra Fast)</option>
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                      <option value="gemma2-9b-it">Gemma 2 9B</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">Groq API Key</label>
                      <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1">
                        Get Groq Key <Globe className="w-3 h-3" />
                      </a>
                    </div>
                    <input type="password" value={groqApiKey} onChange={(e) => setGroqApiKey(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 font-mono outline-none" placeholder="Enter your Groq API Key" />
                    <p className="text-xs text-slate-400 mt-2">Groq offers free tier with generous rate limits</p>
                  </div>
                </>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button onClick={handleStart} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-lg hover:shadow-blue-200 transition-all">
                GO! START PRACTICE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;