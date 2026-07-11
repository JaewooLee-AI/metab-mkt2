import fs from 'fs';
import path from 'path';

async function fetchWithRetry(url: string, options: any, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status === 503) {
        if (i < retries - 1) {
          console.warn(`Gemini API returned status ${response.status}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      }
      return response;
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`Fetch error: ${err}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  return fetch(url, options);
}

export async function handleAnalyzeLogic(body: any) {
  const { sourceText, model = 'gemini-3.5-flash' } = body;

  if (!sourceText || sourceText.trim().length < 2) {
    throw { status: 400, message: '마케팅 콘텐츠 생성을 위해 최소 2자 이상의 기획안 내용이 필요합니다.' };
  }

  // Load API key from process.env (backend-side)
  let apiKey = process.env.GEMINI_API_KEY;
  
  // If not found, check VITE_ prefix as a fallback
  if (!apiKey) {
    apiKey = process.env.VITE_GEMINI_API_KEY;
  }

  // Fallback: manually read local .env file if it exists and process.env is not populated
  if (!apiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.*)/);
        if (match) {
          apiKey = match[1].trim();
        } else {
          const matchVite = envContent.match(/VITE_GEMINI_API_KEY\s*=\s*(.*)/);
          if (matchVite) {
            apiKey = matchVite[1].trim();
          }
        }
      }
    } catch (e) {
      console.warn('Fallback .env read failed:', e);
    }
  }

  if (!apiKey) {
    throw { status: 500, message: '서버에 API Key가 설정되지 않았습니다. .env 파일을 확인해 주세요.' };
  }

  const prompt = `당신은 (주)메타비(Questour)의 전문 마케팅 컨텍스트 분석가입니다.
제공된 메타비 야외 방탈출/에듀테인먼트 기획안 원문을 심층 분석하여 아래의 JSON 구조로 응답해주세요.

[중요 지침]
1. 만약 제공된 [기획안 원문]이 매우 짧거나 구체적인 정보(장소, 미션, 역사적 팩트 등)가 부족하더라도 (예: "북촌에서의 고풍스런 경험" 등), 입력된 키워드와 단서를 바탕으로 전문 마케터 및 퀘스트 기획자의 상상력과 기획력을 총동원하여 매력적인 가상의 야외 방탈출/에듀테인먼트 시나리오를 창작 및 구체화해서 모든 필드를 정성스럽게 채워주십시오. 절대 필드를 비워두거나 에러를 내지 마십시오.
2. 각 필드는 대충 요약하지 말고, 전체 문맥과 의도를 파악하여 최대한 상세하고 구체적으로(최대한 풍부한 어휘와 긴 텍스트로) 채워주세요. 단, 각 필드당 300~600자 내외로 상세하게 서술하되 전체 JSON 출력이 끝까지 잘리지 않고 완전히 유효하게 끝나도록 하십시오.

JSON 구조:
{
  "title": "추천 퀘스트 제목 (사용자가 관심을 가질 만한 매력적인 제목)",
  "location": "공간적 배경 및 지형지물 특징 (현장 및 GPS 맵 상의 특징 상세 서술)",
  "missions": "주요 미션 및 퍼즐 기믹 특징 (스마트폰 기믹, 지형지물 상호작용 등 상세 서술)",
  "historical_elements": "역사적 학습 요소 및 교육적 가치 (역사적 팩트, 학습 내용 등을 풍부하게 서술)",
  "play_time": "플레이 예상 시간 및 적정 난이도 제안 (소요 시간, 걷는 거리, 체력적 부담 분석)",
  "selling_points": [
    "핵심 세일즈 포인트 1 (경험 가치 중심)",
    "핵심 세일즈 포인트 2 (에듀테인먼트 가치 중심)",
    "핵심 세일즈 포인트 3 (스토리/몰입 가치 중심)"
  ],
  "raw_analysis_summary": "기획안 전체를 종합 분석한 고밀도 요약 및 마케팅 컨텍스트 통합 프롬프트 (타겟의 심리, 감정선 변화, 현장감 등을 생생하게 녹여내어 후속 프롬프트에서 컨텍스트 주입용으로 사용될 약 500자 이상의 긴 텍스트)"
}

[기획안 원문]
${sourceText}`;

  let currentModel = model;
  let url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  };

  let response = await fetchWithRetry(url, requestOptions);

  // Fallback to gemini-2.5-flash if gemini-3.5-flash fails with 503 / 429
  if (!response.ok && (response.status === 429 || response.status === 503) && currentModel === 'gemini-3.5-flash') {
    console.warn(`Falling back from gemini-3.5-flash to gemini-2.5-flash due to status ${response.status}`);
    currentModel = 'gemini-2.5-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
    response = await fetchWithRetry(url, requestOptions);
  }

  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `HTTP 에러! 상태 코드: ${response.status}`;
    throw { status: response.status, message: errorMessage };
  }

  const data: any = await response.json();
  const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResult) {
    throw { status: 500, message: '올바른 분석 응답을 받지 못했습니다.' };
  }

  try {
    const parsedData = JSON.parse(textResult);
    return parsedData;
  } catch (err) {
    console.error('Failed to parse JSON response from Gemini:', textResult, err);
    throw { status: 500, message: '분석 결과의 JSON 파싱에 실패했습니다.' };
  }
}
