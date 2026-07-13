import { getMockContent, getMockAnalysis, type AnalysisData } from './mockData';
import type { PersonaType } from './prompts';

export interface GenerationParams {
  channel: 'shorts' | 'blog' | 'cafe' | 'sales' | 'instagram';
  persona: PersonaType;
  sourceText: string;
  apiKey?: string;
  model?: string;
  isMock?: boolean;
  refineInstruction?: string;
  previousContent?: string;
}

export interface AnalyzeParams {
  sourceText: string;
  apiKey?: string;
  model?: string;
  isMock?: boolean;
}

export async function analyzeProposal({
  sourceText,
  apiKey,
  model = 'gemini-3.5-flash',
  isMock = false,
}: AnalyzeParams): Promise<AnalysisData> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 450));
    return getMockAnalysis(sourceText);
  }

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourceText,
      model,
      apiKey: apiKey || undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error || `HTTP 에러! 상태 코드: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function generateMarketingCopy({
  channel,
  persona,
  sourceText,
  apiKey,
  model = 'gemini-3.5-flash',
  isMock = false,
  refineInstruction,
  previousContent,
}: GenerationParams): Promise<string> {
  // If Mock mode is enabled, simulate latency and return high quality mock content
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 800));
    return getMockContent(channel, persona, sourceText) + (refineInstruction ? `\n\n[수정사항 반영: ${refineInstruction}]` : '');
  }

  // To hide and protect the API key from being bundled into client code (which Vercel / Vite static build does),
  // we route the request through our backend endpoint "/api/generate".
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      persona,
      sourceText,
      model,
      // Optional client override key if entered in settings panel
      apiKey: apiKey || undefined,
      refineInstruction,
      previousContent,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error || `HTTP 에러! 상태 코드: ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data?.text) {
    throw new Error('올바른 텍스트 응답을 받지 못했습니다. API 응답 구조를 확인해 주세요.');
  }

  return data.text;
}
