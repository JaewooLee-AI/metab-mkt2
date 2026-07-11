import { getSystemPrompt } from '../src/prompts.ts';

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

export async function handleGenerationLogic(body: any) {
  const { channel, persona, sourceText, model = 'gemini-3.5-flash', refineInstruction, previousContent } = body;

  if (!channel || !persona || !sourceText) {
    throw { status: 400, message: '필수 파라미터가 누락되었습니다.' };
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
      const fs = await import('fs');
      const path = await import('path');
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

  const systemPrompt = getSystemPrompt(channel, persona);
  let userContent = '';
  if (refineInstruction && previousContent) {
    userContent = `이전 생성 결과물과 기획안 원문을 바탕으로 아래의 수정 지시사항을 반영하여 마케팅 카피를 다시 작성해 주세요.
이전 결과물의 마크다운 구조(예: 숏폼의 경우 화면 묘사와 음성/자막이 있는 2단 마크다운 표 형태)를 그대로 유지하면서 내용을 수정 및 확장해 주세요.

[기획안 원문]
${sourceText}

[이전 생성 결과물]
${previousContent}

[수정 지시사항]
- ${refineInstruction}

원래 지정된 채널별 지침사항과 수정 지시사항을 모두 완벽하게 준수하여 출력해 주세요.`;
  } else {
    userContent = `아래의 기획안 원문을 바탕으로 마케팅 카피를 생성해 주세요:

[기획안 원문]
${sourceText}

지침사항에 맞춰 구조와 뉘앙스를 완벽하게 살린 결과물만 출력해 주세요.`;
  }

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
          parts: [{ text: userContent }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2500,
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
    throw { status: 500, message: '올바른 텍스트 응답을 받지 못했습니다.' };
  }

  return { text: textResult };
}

