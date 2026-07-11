import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAnalyzeLogic } from './analyze-logic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers for Vercel deployment flexibility
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const result = await handleAnalyzeLogic(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('API Serverless Error:', err);
    return res.status(err.status || 500).json({ error: err.message || '서버 오류' });
  }
}
