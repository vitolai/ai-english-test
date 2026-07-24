import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Settings, Play, Globe, FileText, Shuffle, X, Eye, EyeOff, Cloud, Server, Globe as GlobeIcon, Zap, Shield, Sparkles, Key, ExternalLink } from 'lucide-react';
import { PROVIDERS, type ProviderConfig, type ModelInfo } from './lib/providers.ts';

export interface AIConfig {
  aiSource: string;
  aiModel: string;
  apiUrl: string;
  apiKey: string;
  visionModel?: string;
  maxStorage?: number;
  provider?: string;
  modelCapabilities?: string[];
}

interface DashboardProps {
  onStart: (count: number, source: string, payload: File | string | null, config: AIConfig, maxStorage?: number) => void;
  onReview?: (sessionId: string) => void;
  onClearError?: () => void;
}

interface SourceOptionProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}

const SourceOption: React.FC<SourceOptionProps> = ({ icon, title, desc, active, onClick }) => (
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

const Dashboard: React.FC<DashboardProps> = ({ onStart }) => {
  const [count, setCount] = useState(10);
  const [source, setSource] = useState('random');
  const [webUrl, setWebUrl] = useState('https://news.google.com/');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Provider & Model State — load from localStorage on first render
  const savedConfig = useMemo(() => {
    try {
      const raw = localStorage.getItem('toeic_ai_config');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);
  const [providerId, setProviderId] = useState<string>(savedConfig?.providerId || 'openrouter');
  const [modelId, setModelId] = useState<string>(savedConfig?.modelId || 'nvidia/nemotron-3-super-120b-a12b:free');
  const [customModel, setCustomModel] = useState('');
  const [apiUrl, setApiUrl] = useState(savedConfig?.apiUrl || '');
  const [apiKey, setApiKey] = useState(savedConfig?.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);

  // Computed values from providers.ts — filter out hidden providers
  const providers = useMemo(() => (Object.values(PROVIDERS) as ProviderConfig[]).filter(p => !p.hidden), []);
  const currentProvider = providers.find(p => p.id === providerId);
  const availableModels = useMemo(() => currentProvider?.models || [], [currentProvider]);

  // Determine if provider needs custom base URL
  const needsCustomUrl = currentProvider?.userProvidesBaseUrl === true;
  const needsApiKey = currentProvider?.requiresApiKey !== false;

  // Default API URLs per provider - CLOUD ONLY
  const defaultUrls: Record<string, string> = {
    nvidia: 'https://integrate.api.nvidia.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    groq: 'https://api.groq.com/openai/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta',
    azure: '', // User provides their Azure endpoint
    together: 'https://api.together.xyz/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    deepseek: 'https://api.deepseek.com/v1',
    cohere: 'https://api.cohere.ai/v1',
    bedrock: '', // User provides their AWS Bedrock endpoint
    ollama: 'https://ollama.com/v1', // Ollama Cloud
    custom: '',
    mock: 'mock://local',
  };

  // Default models per provider
  const defaultModels: Record<string, string> = {
    nvidia: 'nvidia/nemotron-3-super-120b',
    openrouter: 'nvidia/nemotron-3-super-120b-a12b:free',
    groq: 'llama-3.2-90b-vision-preview',
    anthropic: 'claude-3-5-sonnet-20241022',
    google: 'gemini-2.5-flash',
    azure: 'gpt-4o',
    together: 'meta-llama/Llama-3.2-90B-Vision-Instruct',
    fireworks: 'accounts/fireworks/models/llama-v3p2-90b-vision-instruct',
    deepseek: 'deepseek-chat',
    cohere: 'command-r-plus',
    bedrock: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    ollama: 'nemotron-3-super',
    custom: 'custom-model',
    mock: 'mock-toeic-generator',
  };

  // Key provider URLs - correct links for each provider
  const keyProviderUrls: Record<string, string> = {
    nvidia: 'https://build.nvidia.com/',
    openrouter: 'https://openrouter.ai/keys',
    groq: 'https://console.groq.com/keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    google: 'https://aistudio.google.com/apikey',
    azure: 'https://portal.azure.com/',
    together: 'https://api.together.xyz/settings/api-keys',
    fireworks: 'https://fireworks.ai/account/api-keys',
    deepseek: 'https://platform.deepseek.com/api_keys',
    cohere: 'https://dashboard.cohere.ai/api-keys',
    bedrock: 'https://console.aws.amazon.com/bedrock/',
    ollama: 'https://ollama.com/',
    custom: '#',
    mock: '#',
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cloud': return <Cloud className="w-5 h-5" />;
      case 'aggregator': return <Zap className="w-5 h-5" />;
      case 'local': return <Server className="w-5 h-5" />;
      case 'custom': return <Sparkles className="w-5 h-5" />;
      case 'mock': return <Shield className="w-5 h-5" />;
      default: return <Server className="w-5 h-5" />;
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'cloud': return 'bg-blue-100 text-blue-600';
      case 'aggregator': return 'bg-purple-100 text-purple-600';
      case 'local': return 'bg-green-100 text-green-600';
      case 'custom': return 'bg-orange-100 text-orange-600';
      case 'mock': return 'bg-green-100 text-green-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const handleStart = () => {
    if (needsApiKey && !apiKey.trim()) {
      alert(`Please enter your ${currentProvider?.name} API Key.`);
      return;
    }
    if (modelId === 'custom' && !customModel.trim()) {
      alert('Please enter custom model name.');
      return;
    }

    const finalApiUrl = apiUrl || defaultUrls[providerId] || '';
    const finalModel = modelId === 'custom' ? customModel : modelId;

    // Persist to localStorage so next visit auto-fills
    try {
      localStorage.setItem('toeic_ai_config', JSON.stringify({
        providerId,
        modelId,
        apiUrl: finalApiUrl,
        apiKey,
      }));
    } catch { /* ignore */ }

    const config: AIConfig = {
      aiSource: 'ai-cloud',
      aiModel: finalModel,
      apiUrl: finalApiUrl,
      apiKey: apiKey,
      provider: providerId,
      maxStorage: 50,
    };

    setIsSettingsOpen(false);
    onStart(count, source, source === 'web' ? webUrl : pdfFile, config, 50);
  };

  // Initialize defaults when provider changes — restore per-provider API key from localStorage
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (currentProvider) {
      setModelId(defaultModels[providerId] || currentProvider.models[0]?.id || '');
      setApiUrl(defaultUrls[providerId] || '');
      // Restore per-provider API key
      try {
        const saved = localStorage.getItem(`toeic_api_key_${providerId}`) || '';
        setApiKey(saved);
      } catch { setApiKey(''); }
    }
  }, [providerId, currentProvider]);

  // Count options
  const countOptions = [10, 20, 50, 100, 200];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-600 h-2 w-full"></div>
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">English Proficiency Practice Exam</h1>
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
                {countOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    className={`py-4 rounded-2xl font-black transition-all ${count === c ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 transform scale-105' : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-blue-200'}`}
                  >
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
                <input type="text" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} placeholder="https://technews.tw/..." className="w-full p-4 rounded-2xl border-2 border-blue-100 bg-white text-slate-900 font-bold outline-none placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
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
          <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Settings className="w-6 h-6 text-blue-600" />
                AI Configuration
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-600" />
                  AI Provider
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {providers.map((p: ProviderConfig) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProviderId(p.id);
                        setModelId(defaultModels[p.id] || '');
                        setApiKey('');
                        setApiUrl(defaultUrls[p.id] || '');
                      }}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all text-center ${
                        providerId === p.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                          : 'border-slate-100 text-slate-500 hover:border-blue-200'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${getCategoryBg(p.category)}`}>
                        {getCategoryIcon(p.category)}
                      </div>
                      <span className="font-bold text-sm">{p.name}</span>
                      <span className="text-xs text-slate-400 capitalize">{p.category}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Model
                </label>
                <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-bold outline-none">
                  {availableModels.map((m: ModelInfo) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.pricing?.inputPer1M === 0 && m.pricing?.outputPer1M === 0 && '(Free)'}
                    </option>
                  ))}
                  <option value="custom">Custom Model...</option>
                </select>
                {modelId === 'custom' && (
                  <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} className="w-full mt-3 p-4 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" placeholder="Enter model name (e.g. qwen3:32b)" />
                )}
              </div>

              {/* API Endpoint */}
              {needsCustomUrl && (
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <GlobeIcon className="w-5 h-5 text-blue-600" />
                    API Endpoint
                  </label>
                  <input type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 font-mono text-sm outline-none placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder={defaultUrls[providerId] || 'Enter custom endpoint'} />
                </div>
              )}

              {/* API Key */}
              {needsApiKey && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">API Key</label>
                    <a href={keyProviderUrls[currentProvider?.id || ''] || '#'} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1">
                      Get {currentProvider?.name} Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full p-4 pr-12 rounded-xl border-2 border-slate-200 bg-white text-slate-900 font-mono outline-none placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder={`Enter your ${currentProvider?.name} API Key`} />
                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Your key is encrypted and stored locally. Never sent to our servers.</p>
                </div>
              )}

              {/* Ollama Cloud Notice */}
              {providerId === 'ollama' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-800 font-medium flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    <strong>Ollama Cloud:</strong> Enter your Ollama Cloud API key above. Endpoint defaults to <code className="bg-blue-100 px-1 rounded">https://ollama.com/v1</code>.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-sm">
              <button onClick={handleStart} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-lg hover:shadow-blue-200 transition-all">
                GO! START PRACTICE
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      <footer className="py-4 text-center text-xs text-slate-400 w-full border-t border-slate-200 mt-auto">
        Not affiliated with ETS. TOEIC is a trademark of Educational Testing Service.
      </footer>
    </div>
  );
};

export default Dashboard;