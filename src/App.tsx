import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Settings, 
  Copy, 
  Check, 
  RotateCcw, 
  AlertCircle, 
  Play, 
  BookOpen, 
  MessageSquare, 
  ShoppingCart,
  Lock,
  ChevronDown,
  Info,
  Loader2,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Send,
  Bookmark
} from 'lucide-react';
import { PERSONAS, type PersonaType } from './prompts';
import { generateMarketingCopy, analyzeProposal } from './gemini';
import type { AnalysisData } from './mockData';
import { MarkdownRenderer } from './components/MarkdownRenderer';

type ChannelType = 'shorts' | 'blog' | 'cafe' | 'sales' | 'instagram';

export default function App() {
  // 1. App State
  const [sourceText, setSourceText] = useState<string>(() => {
    return localStorage.getItem('questour_source_text') || 
      '여주 영릉(세종대왕릉) 역사 탐험 미션: 소리박물관의 도난당한 비밀 유물을 찾아서\n\n' +
      '- 지역: 경기도 여주\n' +
      '- 주요 로케이션: 여주 세종대왕릉, 명성황후 생가, 곤충박물관, 여주 세종국악당(소리박물관)\n' +
      '- 미션 개요: 스마트폰 GPS 지령을 활용해 세종대왕과 명성황후의 생애 역사적 팩트를 자연스럽게 탐사하고, 마지막 소리박물관에서 미제 주파수를 맞추어 도난당한 보물 유물을 회수하는 에듀테인먼트 야외 추리 게임.';
  });
  const [targetPersona, setTargetPersona] = useState<PersonaType>('couple');
  
  // Settings State
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('questour_gemini_api_key') || '';
  });
  const [model, setModel] = useState<string>(() => {
    return localStorage.getItem('questour_gemini_model') || 'gemini-3.5-flash';
  });
  const [isMock, setIsMock] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Generation / Loading States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loading, setLoading] = useState<Record<ChannelType, boolean>>({
    shorts: false,
    blog: false,
    cafe: false,
    sales: false,
    instagram: false,
  });
  const [results, setResults] = useState<Record<ChannelType, string>>({
    shorts: '',
    blog: '',
    cafe: '',
    sales: '',
    instagram: '',
  });
  const [errors, setErrors] = useState<Record<ChannelType, string | null>>({
    shorts: null,
    blog: null,
    cafe: null,
    sales: null,
    instagram: null,
  });

  const [analysisResult, setAnalysisResult] = useState<{
    data: AnalysisData | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  // UI Feedback States
  const [copiedChannel, setCopiedChannel] = useState<ChannelType | null>(null);

  // Save state to localStorage for premium UX persistence
  useEffect(() => {
    localStorage.setItem('questour_source_text', sourceText);
  }, [sourceText]);

  useEffect(() => {
    localStorage.setItem('questour_gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('questour_gemini_model', model);
  }, [model]);

  // 2. Main Generation Handler
  const handleGenerate = async () => {
    // Validate Input
    if (!sourceText.trim()) {
      setValidationError('마케팅 변환을 위한 원본 기획 문서를 먼저 입력해주세요');
      return;
    }
    setValidationError(null);
    setIsGenerating(true);

    // Reset and set loading for Step 1 analysis and channels
    setAnalysisResult({ data: null, loading: true, error: null });
    setLoading({ shorts: true, blog: true, cafe: true, sales: true, instagram: true });
    setErrors({ shorts: null, blog: null, cafe: null, sales: null, instagram: null });
    setResults({ shorts: '', blog: '', cafe: '', sales: '', instagram: '' });

    // Step 1: Run Context Analysis
    let analyzedData: AnalysisData | null = null;
    try {
      analyzedData = await analyzeProposal({
        sourceText,
        apiKey,
        model,
        isMock,
      });
      setAnalysisResult({ data: analyzedData, loading: false, error: null });
    } catch (err: any) {
      console.error('Error analyzing proposal:', err);
      const errMsg = err.message || '기획안 분석 중 오류가 발생했습니다.';
      setAnalysisResult({ data: null, loading: false, error: errMsg });
      setErrors({
        shorts: '분석 단계 실패로 생성이 취소되었습니다.',
        blog: '분석 단계 실패로 생성이 취소되었습니다.',
        cafe: '분석 단계 실패로 생성이 취소되었습니다.',
        sales: '분석 단계 실패로 생성이 취소되었습니다.',
        instagram: '분석 단계 실패로 생성이 취소되었습니다.',
      });
      setLoading({ shorts: false, blog: false, cafe: false, sales: false, instagram: false });
      setIsGenerating(false);
      return;
    }

    // Step 2: Trigger parallel calls for 5 channels with the richly expanded analysis context
    const channels: ChannelType[] = ['shorts', 'blog', 'cafe', 'sales', 'instagram'];
    const richSourceText = analyzedData ? `
[기획안 분석 데이터]
- 추천 퀘스트 타이틀: ${analyzedData.title}
- 공간적 배경 및 탐방 장소: ${analyzedData.location}
- 미션 및 퍼즐 기믹 특성: ${analyzedData.missions}
- 교육적 가치 및 역사 팩트: ${analyzedData.historical_elements}
- 예상 플레이 및 난이도: ${analyzedData.play_time}
- 종합 분석 요약: ${analyzedData.raw_analysis_summary}
` : sourceText;
    
    await Promise.all(
      channels.map(async (channel) => {
        try {
          const content = await generateMarketingCopy({
            channel,
            persona: targetPersona,
            sourceText: richSourceText,
            apiKey,
            model,
            isMock,
          });
          setResults((prev) => ({ ...prev, [channel]: content }));
        } catch (err: any) {
          console.error(`Error generating copy for ${channel}:`, err);
          setErrors((prev) => ({ ...prev, [channel]: err.message || '콘텐츠 생성 중 오류 발생' }));
        } finally {
          setLoading((prev) => ({ ...prev, [channel]: false }));
        }
      })
    );

    setIsGenerating(false);
  };

  // 3. Individual Retry Handler for robust error tolerance
  const handleRetryChannel = async (channel: ChannelType) => {
    setLoading((prev) => ({ ...prev, [channel]: true }));
    setErrors((prev) => ({ ...prev, [channel]: null }));
    setResults((prev) => ({ ...prev, [channel]: '' }));

    const richSourceText = analysisResult.data ? `
[기획안 분석 데이터]
- 추천 퀘스트 타이틀: ${analysisResult.data.title}
- 공간적 배경 및 탐방 장소: ${analysisResult.data.location}
- 미션 및 퍼즐 기믹 특성: ${analysisResult.data.missions}
- 교육적 가치 및 역사 팩트: ${analysisResult.data.historical_elements}
- 예상 플레이 및 난이도: ${analysisResult.data.play_time}
- 종합 분석 요약: ${analysisResult.data.raw_analysis_summary}
` : sourceText;

    try {
      const content = await generateMarketingCopy({
        channel,
        persona: targetPersona,
        sourceText: richSourceText,
        apiKey,
        model,
        isMock,
      });
      setResults((prev) => ({ ...prev, [channel]: content }));
    } catch (err: any) {
      console.error(`Error retrying copy for ${channel}:`, err);
      setErrors((prev) => ({ ...prev, [channel]: err.message || '콘텐츠 재생성 중 오류 발생' }));
    } finally {
      setLoading((prev) => ({ ...prev, [channel]: false }));
    }
  };

  // 3.5. Individual Refine Handler for adjusting content
  const handleRefineChannel = async (channel: ChannelType, instruction: string) => {
    setLoading((prev) => ({ ...prev, [channel]: true }));
    setErrors((prev) => ({ ...prev, [channel]: null }));
    const previousContent = results[channel];

    const richSourceText = analysisResult.data ? `
[기획안 분석 데이터]
- 추천 퀘스트 타이틀: ${analysisResult.data.title}
- 공간적 배경 및 탐방 장소: ${analysisResult.data.location}
- 미션 및 퍼즐 기믹 특성: ${analysisResult.data.missions}
- 교육적 가치 및 역사 팩트: ${analysisResult.data.historical_elements}
- 예상 플레이 및 난이도: ${analysisResult.data.play_time}
- 종합 분석 요약: ${analysisResult.data.raw_analysis_summary}
` : sourceText;

    try {
      const content = await generateMarketingCopy({
        channel,
        persona: targetPersona,
        sourceText: richSourceText,
        apiKey,
        model,
        isMock,
        refineInstruction: instruction,
        previousContent,
      });
      setResults((prev) => ({ ...prev, [channel]: content }));
    } catch (err: any) {
      console.error(`Error refining copy for ${channel}:`, err);
      setErrors((prev) => ({ ...prev, [channel]: err.message || '콘텐츠 수정 중 오류 발생' }));
    } finally {
      setLoading((prev) => ({ ...prev, [channel]: false }));
    }
  };


  // 4. Clipboard Handler
  const handleCopyToClipboard = (channel: ChannelType, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedChannel(channel);
      setTimeout(() => setCopiedChannel(null), 2000);
    });
  };

  const selectedPersonaInfo = PERSONAS[targetPersona];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 🚀 Header Navigation */}
      <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center shadow-lg shadow-brand-orange/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Questour <span className="text-brand-orange">B2C Marketing Factory</span>
              </h1>
              <p className="text-xs text-slate-400">메타비 전용 OSMU 마케팅 카피 대시보드</p>
            </div>
          </div>
          
          {/* Quick Settings Indicator */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${isMock ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isMock ? '모의 테스트 모드' : `Gemini API 연동 (${model})`}
            </div>
            
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-lg border transition-all ${
                showSettings 
                  ? 'bg-brand-orange/10 border-brand-orange/50 text-brand-orange' 
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
              title="설정 열기"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ⚙️ Collapsible Settings Panel */}
      {showSettings && (
        <section className="bg-slate-900 border-b border-slate-800 px-6 py-5 transition-all">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Setting 1: API Key */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-brand-orange" />
                Gemini API Key
              </label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={import.meta.env.VITE_GEMINI_API_KEY ? '✔ .env 키가 로드됨 (오버라이드하려면 입력)' : 'API Key를 입력하세요'}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-orange transition-colors"
              />
              <p className="text-[10px] text-slate-500">입력한 키는 브라우저 로컬 저장소에 안전하게 로컬 저장됩니다.</p>
            </div>

            {/* Setting 2: Model Name */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">사용할 Gemini 모델</label>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-orange transition-colors"
              >
                <option value="gemini-3.5-flash">gemini-3.5-flash (추천)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              </select>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="기타 모델 직접 지정"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-orange transition-colors w-full"
                />
              </div>
            </div>

            {/* Setting 3: Mock Mode Toggle */}
            <div className="flex flex-col justify-between bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">모의 테스트 생성 (Mock Mode)</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Gemini API 키가 없어도 완성도 높은 결과를 즉각 테스트합니다.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isMock} 
                    onChange={(e) => setIsMock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange"></div>
                </label>
              </div>
              <span className={`text-[11px] font-medium block mt-2 ${isMock ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isMock ? '상태: 모의 데이터 즉시 로드 적용' : '상태: 실제 구글 Gemini API 서버 호출'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 💻 Main Workspace Layout */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* 📥 Left Panel (30% Width on large screens) */}
        <section className="lg:col-span-3 flex flex-col gap-5 bg-slate-900/40 border border-slate-800/60 p-5 rounded-2xl backdrop-blur-sm self-start">
          
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">콘텐츠 빌더 설정</h2>
            <Sparkles className="w-4 h-4 text-brand-orange animate-pulse" />
          </div>

          {/* Persona Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400">타겟 페르소나 선택</label>
            <div className="relative">
              <select
                value={targetPersona}
                onChange={(e) => setTargetPersona(e.target.value as PersonaType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange transition-colors appearance-none cursor-pointer"
              >
                {Object.values(PERSONAS).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Persona Context Card */}
          <div className="bg-slate-950/80 rounded-xl border border-slate-800/60 p-3.5 flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-brand-orange font-medium">
              <Info className="w-3.5 h-3.5" />
              <span>선택 페르소나 전략 분석</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">고객 Pain Point:</span>
              <p className="text-slate-300 mt-0.5 leading-relaxed">{selectedPersonaInfo.painPoint}</p>
            </div>
            <div className="border-t border-slate-800/50 mt-1.5 pt-1.5">
              <span className="text-slate-400 block font-semibold">시스템 전략 훅:</span>
              <p className="text-slate-300 mt-0.5 leading-relaxed italic">"{selectedPersonaInfo.strategicHook}"</p>
            </div>
          </div>

          {/* Source Text Input */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-400">기획안 원문 입력 (Source Text)</label>
              <span className="text-[10px] text-slate-500">{sourceText.length} 자</span>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => {
                setSourceText(e.target.value);
                if (e.target.value.trim()) setValidationError(null);
              }}
              placeholder="여기에 야외 방탈출 콘텐츠의 원본 기획안 또는 미션 개요를 입력해 주세요."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-orange transition-colors resize-y min-h-[220px]"
            />
          </div>

          {/* Validation Warning */}
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/60 text-red-400 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{validationError}</p>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
              isGenerating
                ? 'bg-slate-800 cursor-not-allowed text-slate-500 shadow-none'
                : 'bg-brand-orange hover:bg-brand-orange-hover hover:scale-[1.01] active:scale-[0.99] shadow-brand-orange/20'
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>마케팅 엔진 가동 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>마케팅 에셋 팩토리 가동</span>
              </>
            )}
          </button>

          {/* Step 1: Proposal Analysis Result (Step 1 기획안 분석 결과) */}
          {analysisResult.loading && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 flex flex-col items-center justify-center py-6 text-slate-400 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-300 block">Step 1: 컨텍스트 심층 분석 진행 중</span>
                <span className="text-[10px] text-slate-500">인공지능이 기획서를 세밀하게 분석하고 있습니다...</span>
              </div>
            </div>
          )}

          {analysisResult.error && (
            <div className="rounded-xl border border-red-950 bg-red-950/20 p-4 text-xs text-red-400">
              <span className="font-semibold block mb-1">Step 1 분석 실패</span>
              <p>{analysisResult.error}</p>
            </div>
          )}

          {analysisResult.data && !analysisResult.loading && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3.5 animate-fade-in">
              <h3 className="text-xs font-bold text-brand-orange uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Step 1: 기획안 분석 결과 (추출됨)
              </h3>
              <div className="text-xs space-y-3 text-slate-300">
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">추천 퀘스트 타이틀:</span>
                  <span className="text-white font-medium">{analysisResult.data.title}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">공간적 배경 및 탐방 장소:</span>
                  <span className="leading-relaxed block">{analysisResult.data.location}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">교육적 가치 및 역사 팩트:</span>
                  <span className="leading-relaxed block">{analysisResult.data.historical_elements}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">미션 및 퍼즐 기믹 특성:</span>
                  <span className="leading-relaxed block">{analysisResult.data.missions}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">예상 플레이 및 난이도:</span>
                  <span className="leading-relaxed block">{analysisResult.data.play_time}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 📤 Right Panel (70% Width on large screens, 2x2 Grid Output) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">4대 채널 OSMU 대시보드</h2>
              <span className="text-xs bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">OSMU 가동</span>
            </div>
            
            {/* Legend info */}
            <span className="text-xs text-slate-400 hidden sm:inline">
              원본 1개로 숏폼, 블로그, 맘카페, 상세페이지 문구를 동시 퍼블리싱
            </span>
          </div>

          {/* 2x2 Grid Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* --- CARD 1: SHORTS --- */}
            <ChannelCard
              title="숏폼 비디오 대본 (Shorts)"
              channel="shorts"
              icon={<Play className="w-4 h-4 text-rose-500" />}
              loading={loading.shorts}
              content={results.shorts}
              error={errors.shorts}
              copied={copiedChannel === 'shorts'}
              onCopy={(txt) => handleCopyToClipboard('shorts', txt)}
              onRetry={() => handleRetryChannel('shorts')}
              onRefine={(inst) => handleRefineChannel('shorts', inst)}
            />

            {/* --- CARD 2: BLOG --- */}
            <ChannelCard
              title="네이버 블로그 리뷰 (Blog)"
              channel="blog"
              icon={<BookOpen className="w-4 h-4 text-emerald-500" />}
              loading={loading.blog}
              content={results.blog}
              error={errors.blog}
              copied={copiedChannel === 'blog'}
              onCopy={(txt) => handleCopyToClipboard('blog', txt)}
              onRetry={() => handleRetryChannel('blog')}
              onRefine={(inst) => handleRefineChannel('blog', inst)}
            />

            {/* --- CARD 3: MOM CAFE --- */}
            <ChannelCard
              title="지역 맘카페 바이럴 (Cafe)"
              channel="cafe"
              icon={<MessageSquare className="w-4 h-4 text-sky-500" />}
              loading={loading.cafe}
              content={results.cafe}
              error={errors.cafe}
              copied={copiedChannel === 'cafe'}
              onCopy={(txt) => handleCopyToClipboard('cafe', txt)}
              onRetry={() => handleRetryChannel('cafe')}
              onRefine={(inst) => handleRefineChannel('cafe', inst)}
            />

            {/* --- CARD 4: SALES PAGE --- */}
            <ChannelCard
              title="예매 상세페이지 카피 (Sales)"
              channel="sales"
              icon={<ShoppingCart className="w-4 h-4 text-brand-orange" />}
              loading={loading.sales}
              content={results.sales}
              error={errors.sales}
              copied={copiedChannel === 'sales'}
              onCopy={(txt) => handleCopyToClipboard('sales', txt)}
              onRetry={() => handleRetryChannel('sales')}
              onRefine={(inst) => handleRefineChannel('sales', inst)}
            />

            {/* --- CARD 5: INSTAGRAM --- */}
            <div className="md:col-span-2">
              <InstagramChannelCard
                title="인스타그램 피드 & 이미지 생성 (Instagram)"
                channel="instagram"
                icon={<InstagramIcon className="w-4 h-4 text-pink-500" />}
                loading={loading.instagram}
                content={results.instagram}
                error={errors.instagram}
                copied={copiedChannel === 'instagram'}
                onCopy={(txt) => handleCopyToClipboard('instagram', txt)}
                onRetry={() => handleRetryChannel('instagram')}
                onRefine={(inst) => handleRefineChannel('instagram', inst)}
                persona={targetPersona}
              />
            </div>

          </div>
        </section>
      </main>

      {/* <footer> */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© 2026 Questour B2C Marketing Factory. All rights reserved.</p>
      </footer>
    </div>
  );
}

// 📦 Reusable Channel Card Component
interface ChannelCardProps {
  title: string;
  channel: ChannelType;
  icon: React.ReactNode;
  loading: boolean;
  content: string;
  error: string | null;
  copied: boolean;
  onCopy: (text: string) => void;
  onRetry: () => void;
  onRefine: (instruction: string) => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
  title,
  icon,
  loading,
  content,
  error,
  copied,
  onCopy,
  onRetry,
  onRefine,
}) => {
  const [showRefine, setShowRefine] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');

  const handleRefineSubmit = (inst: string) => {
    if (!inst.trim()) return;
    onRefine(inst);
    setCustomInstruction('');
    setShowRefine(false);
  };

  return (
    <article className={`bg-slate-900/60 rounded-2xl border backdrop-blur-md transition-all flex flex-col h-[480px] overflow-hidden ${
      error 
        ? 'border-red-900/50 hover:border-red-900 shadow-lg shadow-red-950/10' 
        : content 
          ? 'border-slate-800 hover:border-slate-700 shadow-md' 
          : 'border-slate-900/80 opacity-70'
    }`}>
      
      {/* Card Header */}
      <div className="bg-slate-900/40 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xs font-semibold text-slate-200 tracking-wide">{title}</h3>
        </div>
        
        {/* Top Right Utilities */}
        <div className="flex items-center gap-2">
          {content && !loading && !error && (
            <>
              <button
                onClick={onRetry}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="처음부터 다시 생성"
              >
                <RotateCcw className="w-3 h-3" />
                <span>재수행</span>
              </button>
              <button
                onClick={() => onCopy(content)}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors cursor-pointer ${
                  copied 
                    ? 'bg-emerald-950 border border-emerald-900 text-emerald-400' 
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>복사</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-grow p-4 overflow-y-auto min-h-0 bg-slate-950/20">
        {loading ? (
          /* Animated Skeleton Loading State */
          <div className="space-y-3.5 animate-pulse pt-2">
            <div className="h-3.5 bg-slate-800 rounded w-1/3"></div>
            <div className="h-2.5 bg-slate-800 rounded w-5/6"></div>
            <div className="h-2.5 bg-slate-800 rounded"></div>
            <div className="h-2.5 bg-slate-800 rounded w-4/6"></div>
            <div className="space-y-2 pt-4">
              <div className="h-2 bg-slate-800 rounded"></div>
              <div className="h-2 bg-slate-800 rounded w-3/4"></div>
              <div className="h-2 bg-slate-800 rounded w-5/6"></div>
            </div>
          </div>
        ) : error ? (
          /* Error Fallback State */
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">콘텐츠 생성 지연</h4>
            <p className="text-xs text-slate-500 mt-1 mb-4 max-w-[200px] leading-relaxed">
              {error}
            </p>
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 bg-red-950/50 hover:bg-red-950 text-red-400 border border-red-900/60 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>재시도</span>
            </button>
          </div>
        ) : content ? (
          /* Display Rendered Output */
          <MarkdownRenderer content={content} />
        ) : (
          /* Initial Empty/Idle State */
          <div className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-600">
            <div className="w-12 h-12 rounded-full border border-dashed border-slate-800 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-slate-700 animate-pulse" />
            </div>
            <p className="text-xs leading-relaxed max-w-[200px]">
              기획안 원문을 입력하고 빌더에서 팩토리를 작동하여 카피를 생성해 보세요.
            </p>
          </div>
        )}
      </div>

      {/* Refinement Panel at the bottom of the card */}
      {content && !loading && !error && (
        <div className="bg-slate-900/80 border-t border-slate-800/80 p-3 shrink-0 flex flex-col gap-2">
          {/* Quick Refine Buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleRefineSubmit('이전 결과물보다 훨씬 더 길고 상세하며 풍부하게 작성해줘')}
              className="text-[10px] bg-slate-950 border border-slate-850 hover:border-brand-orange/45 hover:text-brand-orange text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              📝 더 길고 자세하게
            </button>
            <button
              onClick={() => handleRefineSubmit('핵심 내용 위주로 짧고 명확하게 요약해줘')}
              className="text-[10px] bg-slate-950 border border-slate-850 hover:border-brand-orange/45 hover:text-brand-orange text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              ⚡ 핵심 요약 (짧게)
            </button>
            <button
              onClick={() => handleRefineSubmit('페르소나의 결핍(Pain Point)과 타겟 훅을 더욱 강력하게 강조해줘')}
              className="text-[10px] bg-slate-950 border border-slate-850 hover:border-brand-orange/45 hover:text-brand-orange text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              🎯 타겟 훅 강조
            </button>
            <button
              onClick={() => setShowRefine(!showRefine)}
              className={`text-[10px] border px-2 py-1 rounded transition-colors cursor-pointer ${
                showRefine 
                  ? 'bg-brand-orange/10 border-brand-orange/40 text-brand-orange' 
                  : 'bg-slate-950 border-slate-850 hover:border-brand-orange/40 text-slate-300'
              }`}
            >
              ✍️ 직접 수정 요청 {showRefine ? '접기' : '열기'}
            </button>
          </div>

          {/* Custom Refinement Input Form */}
          {showRefine && (
            <div className="flex gap-2 animate-fadeIn">
              <input
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="예: 존댓말로 변경해줘, 이벤트 혜택 강조해줘..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-orange transition-colors flex-grow"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRefineSubmit(customInstruction);
                }}
              />
              <button
                onClick={() => handleRefineSubmit(customInstruction)}
                className="bg-brand-orange hover:bg-brand-orange/95 text-white font-medium rounded-lg px-3 py-1.5 text-xs transition-colors shrink-0 cursor-pointer"
              >
                적용
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

// 📷 Local Instagram SVG Icon to avoid version issues
const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

// 📦 Custom Instagram Card Component
interface InstagramChannelCardProps {
  title: string;
  channel: ChannelType;
  icon: React.ReactNode;
  loading: boolean;
  content: string;
  error: string | null;
  copied: boolean;
  onCopy: (text: string) => void;
  onRetry: () => void;
  onRefine: (instruction: string) => void;
  persona: PersonaType;
}

const InstagramChannelCard: React.FC<InstagramChannelCardProps> = ({
  title,
  icon,
  loading,
  content,
  error,
  onRetry,
  onRefine,
  persona,
}) => {
  const [showRefine, setShowRefine] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [editablePrompt, setEditablePrompt] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Parse structured content
  const { prompt, caption, hashtags } = useMemo(() => {
    if (!content) return { prompt: '', caption: '', hashtags: '' };
    const promptRegex = /\[영문 프롬프트\]([\s\S]*?)(?=\[인스타 캡션\]|\[해시태그\]|$)/i;
    const captionRegex = /\[인스타 캡션\]([\s\S]*?)(?=\[영문 프롬프트\]|\[해시태그\]|$)/i;
    const hashtagsRegex = /\[해시태그\]([\s\S]*?)(?=\[영문 프롬프트\]|\[인스타 캡션\]|$)/i;
    
    const pMatch = content.match(promptRegex);
    const cMatch = content.match(captionRegex);
    const hMatch = content.match(hashtagsRegex);
    
    const cleanContent = (text: string) => {
      let result = text.trim();
      if (result.startsWith('(') && result.endsWith(')')) {
        result = result.substring(1, result.length - 1).trim();
      }
      return result;
    };

    return {
      prompt: pMatch ? cleanContent(pMatch[1]) : '',
      caption: cMatch ? cleanContent(cMatch[1]) : '',
      hashtags: hMatch ? cleanContent(hMatch[1]) : '',
    };
  }, [content]);

  // Sync editable prompt when content finishes loading
  useEffect(() => {
    if (prompt) {
      setEditablePrompt(prompt);
      setGeneratedImageUrl(null); // Reset generated image when prompt changes
    }
  }, [prompt]);

  const handleRefineSubmit = (inst: string) => {
    if (!inst.trim()) return;
    onRefine(inst);
    setCustomInstruction('');
    setShowRefine(false);
  };

  const handleGenerateImage = () => {
    if (!editablePrompt.trim()) return;
    setIsGeneratingImage(true);
    // Use pollinations.ai for client-side dynamic image generation
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(editablePrompt)}?width=1080&height=1080&nologo=true&seed=${seed}`;
    
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setGeneratedImageUrl(url);
      setIsGeneratingImage(false);
    };
    img.onerror = () => {
      setGeneratedImageUrl(url);
      setIsGeneratingImage(false);
    };
  };

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(editablePrompt).then(() => {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    });
  };

  const handleCopyCaption = () => {
    const fullText = `${caption}\n\n${hashtags}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    });
  };

  return (
    <article className={`bg-slate-900/60 rounded-2xl border backdrop-blur-md transition-all flex flex-col min-h-[580px] overflow-hidden ${
      error 
        ? 'border-red-900/50 hover:border-red-900 shadow-lg shadow-red-950/10' 
        : content 
          ? 'border-slate-800 hover:border-slate-700 shadow-md' 
          : 'border-slate-900/80 opacity-70'
    }`}>
      
      {/* Card Header */}
      <div className="bg-slate-900/40 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xs font-semibold text-slate-200 tracking-wide">{title}</h3>
        </div>
        
        {/* Top Right Utilities */}
        <div className="flex items-center gap-2">
          {content && !loading && !error && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="처음부터 다시 생성"
            >
              <RotateCcw className="w-3 h-3" />
              <span>재수행</span>
            </button>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-grow p-5 overflow-y-auto min-h-0 bg-slate-950/20">
        {loading ? (
          /* Animated Skeleton Loading State */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-center">
            <div className="space-y-3.5 animate-pulse pt-2">
              <div className="h-3.5 bg-slate-800 rounded w-1/3"></div>
              <div className="h-10 bg-slate-800 rounded w-full"></div>
              <div className="h-6 bg-slate-800 rounded w-1/2"></div>
              <div className="space-y-2 pt-4 border-t border-slate-800/40">
                <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                <div className="h-20 bg-slate-800 rounded"></div>
              </div>
            </div>
            <div className="flex justify-center items-center">
              <div className="w-[280px] h-[360px] bg-slate-850 rounded-xl border border-slate-800/60 animate-pulse flex flex-col justify-between p-4">
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-slate-800"></div>
                  <div className="w-20 h-2 bg-slate-800 rounded"></div>
                </div>
                <div className="flex-grow my-4 bg-slate-800 rounded-lg"></div>
                <div className="w-full h-4 bg-slate-800 rounded"></div>
              </div>
            </div>
          </div>
        ) : error ? (
          /* Error Fallback State */
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">콘텐츠 생성 지연</h4>
            <p className="text-xs text-slate-500 mt-1 mb-4 max-w-[200px] leading-relaxed">
              {error}
            </p>
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 bg-red-950/50 hover:bg-red-950 text-red-400 border border-red-900/60 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>재시도</span>
            </button>
          </div>
        ) : content ? (
          /* Display custom side-by-side Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-stretch">
            {/* Editor Area (Left Column) */}
            <div className="flex flex-col gap-4 justify-between">
              
              {/* Step 1: English Prompt Editor */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-400">Step 1: 영문 이미지 프롬프트 (편집 가능)</label>
                  <button
                    onClick={handleCopyPrompt}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 border border-slate-800 px-2 py-0.5 rounded bg-slate-950 transition-colors"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={editablePrompt}
                  onChange={(e) => setEditablePrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-orange resize-none h-28"
                />
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || !editablePrompt}
                  className="py-2.5 px-3 bg-brand-orange hover:bg-brand-orange/95 hover:scale-[1.01] active:scale-[0.99] disabled:scale-100 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-orange/10 cursor-pointer"
                >
                  {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  {isGeneratingImage ? 'AI가 이미지 그리는 중...' : '인스타그램 이미지 생성하기 (Flow)'}
                </button>
              </div>

              {/* Step 2: Instagram Caption Viewer */}
              <div className="flex flex-col gap-2 flex-grow min-h-0">
                <div className="flex justify-between items-center border-t border-slate-800/40 pt-3">
                  <label className="text-xs font-semibold text-slate-400">Step 2: 인스타그램 본문 피드 캡션</label>
                  <button
                    onClick={handleCopyCaption}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 border border-slate-800 px-2 py-0.5 rounded bg-slate-950 transition-colors"
                  >
                    {copiedCaption ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-3.5 overflow-y-auto max-h-48 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap flex-grow">
                  {caption || '본문 생성 실패. 재생성을 이용해 주세요.'}
                  {hashtags && <div className="text-sky-400 mt-3 font-medium">{hashtags}</div>}
                </div>
              </div>

            </div>

            {/* Instagram Feed Mockup Preview (Right Column) */}
            <div className="flex items-center justify-center bg-slate-950/30 rounded-2xl border border-slate-800/40 p-4 min-h-[360px]">
              <div className="w-full max-w-[280px] bg-slate-900 rounded-xl border border-slate-800/60 shadow-xl overflow-hidden text-xs flex flex-col">
                {/* Header */}
                <div className="px-3 py-2 flex items-center justify-between border-b border-slate-800/40 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[1.5px]">
                      <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
                        <Sparkles className="w-3 h-3 text-brand-orange" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[10px] text-slate-200">questour_official</span>
                      <span className="text-[8px] text-slate-500 font-light">{PERSONAS[persona].name} · Yeoju</span>
                    </div>
                  </div>
                  <span className="text-slate-400 hover:text-white cursor-pointer font-bold">•••</span>
                </div>
                
                {/* Image Canvas */}
                <div className="aspect-square bg-slate-950 relative flex items-center justify-center overflow-hidden group shrink-0">
                  {isGeneratingImage ? (
                    <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
                      <div className="space-y-1 px-2">
                        <span className="text-[10px] font-semibold text-slate-200 block">AI 이미지 렌더링 중</span>
                        <span className="text-[8px] text-slate-500 leading-normal block">영문 프롬프트를 분석해 1:1 인스타 이미지를 실시간 드로잉하고 있습니다...</span>
                      </div>
                    </div>
                  ) : generatedImageUrl ? (
                    <img 
                      src={generatedImageUrl} 
                      alt="Generated Instagram content" 
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-102" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-slate-600 gap-2.5">
                      <div className="w-9 h-9 rounded-full border border-dashed border-slate-800 flex items-center justify-center bg-slate-950">
                        <ImageIcon className="w-4 h-4 text-slate-700 animate-pulse" />
                      </div>
                      <p className="text-[9px] leading-relaxed max-w-[170px] text-slate-500">
                        왼쪽 프롬프트를 기반으로 실시간 인스타그램 맞춤 AI 이미지를 생성해 보세요.
                      </p>
                      <button
                        onClick={handleGenerateImage}
                        className="py-1 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[9px] font-semibold text-slate-300 transition-colors cursor-pointer"
                      >
                        이미지 생성 가동
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-3 py-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <Heart className={`w-4 h-4 cursor-pointer hover:scale-110 active:scale-90 transition-transform ${generatedImageUrl ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
                    <MessageCircle className="w-4 h-4 text-slate-400 cursor-pointer hover:scale-110 transition-transform" />
                    <Send className="w-4 h-4 text-slate-400 cursor-pointer hover:scale-110 transition-transform" />
                  </div>
                  <Bookmark className="w-4 h-4 text-slate-400 cursor-pointer hover:scale-110 transition-transform" />
                </div>

                {/* Info & Text */}
                <div className="px-3 pb-3 shrink-0 flex flex-col gap-1 border-t border-slate-800/10 pt-1.5 min-h-[64px]">
                  <span className="font-semibold text-[9px] text-slate-300">Liked by 1,248 users</span>
                  <div className="text-[9px] leading-relaxed text-slate-300 line-clamp-2">
                    <span className="font-bold text-slate-200 mr-1.5">questour_official</span>
                    {caption || '여주 세종대왕릉 역사 탐험 미션!'}
                  </div>
                  {hashtags && (
                    <span className="text-[9px] text-sky-500 font-medium line-clamp-1">{hashtags}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Initial Empty/Idle State */
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-650 min-h-[300px]">
            <div className="w-12 h-12 rounded-full border border-dashed border-slate-800 flex items-center justify-center mb-3">
              <InstagramIcon className="w-5 h-5 text-slate-700 animate-pulse" />
            </div>
            <p className="text-xs leading-relaxed max-w-[240px] text-slate-500">
              기획안 원문을 입력하고 빌더에서 팩토리를 작동하여 영문 이미지 프롬프트와 인스타 카피를 생성해 보세요.
            </p>
          </div>
        )}
      </div>

      {/* Refinement Panel at the bottom of the card */}
      {content && !loading && !error && (
        <div className="bg-slate-900/80 border-t border-slate-800/80 p-3 shrink-0 flex flex-col gap-2">
          {/* Quick Refine Buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleRefineSubmit('이전 결과물보다 훨씬 더 길고 상세하며 풍부하게 작성해줘')}
              className="text-[10px] bg-slate-950 border border-slate-850 hover:border-brand-orange/45 hover:text-brand-orange text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              📝 더 길고 자세하게
            </button>
            <button
              onClick={() => handleRefineSubmit('핵심 내용 위주로 짧고 명확하게 요약해줘')}
              className="text-[10px] bg-slate-950 border border-slate-850 hover:border-brand-orange/45 hover:text-brand-orange text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              ⚡ 핵심 요약 (짧게)
            </button>
            <button
              onClick={() => handleRefineSubmit('영문 이미지 프롬프트를 더 극적이고 현대적이고 영화같은 묘사로 보강해줘')}
              className="text-[10px] bg-slate-950 border border-slate-850 hover:border-brand-orange/45 hover:text-brand-orange text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              🎨 영문 프롬프트 강화
            </button>
            <button
              onClick={() => setShowRefine(!showRefine)}
              className={`text-[10px] border px-2 py-1 rounded transition-colors cursor-pointer ${
                showRefine 
                  ? 'bg-brand-orange/10 border-brand-orange/40 text-brand-orange' 
                  : 'bg-slate-950 border-slate-850 hover:border-brand-orange/40 text-slate-300'
              }`}
            >
              ✍️ 직접 수정 요청 {showRefine ? '접기' : '열기'}
            </button>
          </div>

          {/* Custom Refinement Input Form */}
          {showRefine && (
            <div className="flex gap-2 animate-fadeIn">
              <input
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="예: 영문 프롬프트에 드론샷 추가해줘, 본문 해시태그 추가해줘..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-orange transition-colors flex-grow"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRefineSubmit(customInstruction);
                }}
              />
              <button
                onClick={() => handleRefineSubmit(customInstruction)}
                className="bg-brand-orange hover:bg-brand-orange/95 text-white font-medium rounded-lg px-3 py-1.5 text-xs transition-colors shrink-0 cursor-pointer"
              >
                적용
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};


