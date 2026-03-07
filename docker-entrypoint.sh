#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma 2>/dev/null || \
  npx prisma db push --schema=apps/web/prisma/schema.prisma --accept-data-loss

echo "Starting Fairtrail..."
exec node apps/web/server.js
