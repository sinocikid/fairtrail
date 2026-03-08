import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api-response';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  // Only allow setup if no config exists yet
  const existing = await prisma.extractionConfig.findFirst({
    where: { id: 'singleton' },
  });

  if (existing?.adminPasswordHash) {
    return apiError('Setup already completed. Use admin panel to change settings.', 403);
  }

  const body = await request.json();
  const { adminPassword, provider, model } = body as {
    adminPassword: string;
    provider: string;
    model: string;
  };

  if (!adminPassword || adminPassword.length < 8) {
    return apiError('Password must be at least 8 characters', 400);
  }

  if (!provider || !model) {
    return apiError('Provider and model are required', 400);
  }

  const passwordHash = createHash('sha256').update(adminPassword).digest('hex');

  await prisma.extractionConfig.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      provider,
      model,
      adminPasswordHash: passwordHash,
    },
    update: {
      provider,
      model,
      adminPasswordHash: passwordHash,
    },
  });

  return apiSuccess({ message: 'Setup complete' });
}
