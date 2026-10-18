# Contexto de build: raiz del monorepo (HOTELSYNC/).
# Uso: docker compose build analytics-service
FROM node:20-alpine AS builder

WORKDIR /app

# Manifiestos para aprovechar cache de capas
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY services/analytics-service/package.json ./services/analytics-service/package.json

# Instala deps del workspace (hoisted a /app/node_modules)
RUN npm ci --workspace=services/analytics-service --include-workspace-root=false

# Codigo necesario para generar Prisma Client y compilar
COPY services/analytics-service/prisma ./services/analytics-service/prisma
COPY services/analytics-service/tsconfig.json ./services/analytics-service/tsconfig.json
COPY services/analytics-service/src ./services/analytics-service/src

WORKDIR /app/services/analytics-service
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Manifiestos + dependencias hoisted
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/analytics-service/package.json ./services/analytics-service/package.json

# Artefactos compilados + schema Prisma (para migrate deploy en el arranque)
COPY --from=builder /app/services/analytics-service/dist ./services/analytics-service/dist
COPY --from=builder /app/services/analytics-service/prisma ./services/analytics-service/prisma

# Deps no hoisted (amqplib queda anidado por conflicto de versiones entre workspaces).
COPY --from=builder /app/services/analytics-service/node_modules ./services/analytics-service/node_modules

# Prisma Client generado en el builder (output custom al node_modules del servicio).
# El runtime resuelve @prisma/client desde /app/node_modules (hoisted) -> copiarlo ahi tambien.
COPY --from=builder /app/services/analytics-service/node_modules/.prisma/client ./node_modules/.prisma/client

WORKDIR /app/services/analytics-service

EXPOSE 3011
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
