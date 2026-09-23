# Contexto de build: raiz del monorepo (HOTELSYNC/).
# Uso: docker compose build billing-service
FROM node:20-alpine AS builder

WORKDIR /app

# Manifiestos para aprovechar cache de capas
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY services/billing-service/package.json ./services/billing-service/package.json

# Instala deps del workspace (hoisted a /app/node_modules)
RUN npm ci --workspace=services/billing-service --include-workspace-root=false

# Codigo necesario para generar Prisma Client y compilar
COPY services/billing-service/prisma ./services/billing-service/prisma
COPY services/billing-service/tsconfig.json ./services/billing-service/tsconfig.json
COPY services/billing-service/src ./services/billing-service/src

WORKDIR /app/services/billing-service
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Manifiestos + dependencias hoisted
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/billing-service/package.json ./services/billing-service/package.json

# Artefactos compilados + schema Prisma (para migrate deploy si se necesita)
COPY --from=builder /app/services/billing-service/dist ./services/billing-service/dist
COPY --from=builder /app/services/billing-service/prisma ./services/billing-service/prisma

# Prisma Client generado en el builder (output custom al node_modules del servicio).
# El runtime resuelve @prisma/client desde /app/node_modules (hoisted) -> copiarlo ahi tambien.
COPY --from=builder /app/services/billing-service/node_modules ./services/billing-service/node_modules
COPY --from=builder /app/services/billing-service/node_modules/.prisma/client ./node_modules/.prisma/client

WORKDIR /app/services/billing-service

EXPOSE 3007
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
