# Contexto de build: raiz del monorepo (HOTELSYNC/).
# Uso: docker compose build rate-availability-service
FROM node:20-alpine AS builder

WORKDIR /app

# Manifiestos para aprovechar cache de capas
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY services/rate-availability-service/package.json ./services/rate-availability-service/package.json

# Instala deps del workspace (hoisted a /app/node_modules)
RUN npm ci --workspace=services/rate-availability-service --include-workspace-root=false

# Codigo necesario para generar Prisma Client y compilar
COPY services/rate-availability-service/prisma ./services/rate-availability-service/prisma
COPY services/rate-availability-service/tsconfig.json ./services/rate-availability-service/tsconfig.json
COPY services/rate-availability-service/src ./services/rate-availability-service/src

WORKDIR /app/services/rate-availability-service
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Manifiestos + dependencias hoisted
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/rate-availability-service/package.json ./services/rate-availability-service/package.json

# Artefactos compilados + schema Prisma (para migrate deploy si se necesita)
COPY --from=builder /app/services/rate-availability-service/dist ./services/rate-availability-service/dist
COPY --from=builder /app/services/rate-availability-service/prisma ./services/rate-availability-service/prisma

# Prisma Client generado en el builder (output custom al node_modules del servicio).
# El runtime resuelve @prisma/client desde /app/node_modules (hoisted) -> copiarlo ahi tambien.
COPY --from=builder /app/services/rate-availability-service/node_modules ./services/rate-availability-service/node_modules
COPY --from=builder /app/services/rate-availability-service/node_modules/.prisma/client ./node_modules/.prisma/client

WORKDIR /app/services/rate-availability-service

EXPOSE 3002
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
