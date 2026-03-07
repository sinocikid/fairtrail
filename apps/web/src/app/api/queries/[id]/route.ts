import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const token = body?.deleteToken;
  if (!token || typeof token !== 'string') {
    return apiError('Missing delete token', 401);
  }

  const query = await prisma.query.findUnique({
    where: { id },
    select: { deleteToken: true },
  });

  if (!query) {
    return apiError('Tracker not found', 404);
  }

  if (!query.deleteToken || query.deleteToken !== token) {
    return apiError('Invalid delete token', 403);
  }

  await prisma.query.delete({ where: { id } });

  return apiSuccess({ deleted: true });
}
