# Contexto de build: raiz del monorepo (HOTELSYNC/).
# Uso: docker compose build api-gateway
FROM node:20-alpine AS builder

WORKDIR /app

# Manifiestos para aprovechar cache de capas
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY services/api-gateway/package.json ./services/api-gateway/package.json

# Instala deps del workspace (hoisted a /app/node_modules)
RUN npm ci --workspace=services/api-gateway --include-workspace-root=false

COPY services/api-gateway/tsconfig.json ./services/api-gateway/tsconfig.json
COPY services/api-gateway/src ./services/api-gateway/src

WORKDIR /app/services/api-gateway
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/package.json
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

WORKDIR /app/services/api-gateway

EXPOSE 8080
CMD ["npm", "start"]
