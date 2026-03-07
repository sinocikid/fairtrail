import { NextRequest } from 'next/server';
import { trackPageViewAsync } from '@/lib/analytics/track';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, ip, userAgent, referrer, botScore } = body;

    if (!path || !ip || !userAgent) {
      return apiError('Missing required fields', 400);
    }

    trackPageViewAsync({ path, ip, userAgent, referrer, botScore });
    return apiSuccess({ tracked: true });
  } catch {
    return apiError('Invalid request body', 400);
  }
}
