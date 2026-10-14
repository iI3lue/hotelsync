FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY services/loyalty-service/package.json ./services/loyalty-service/
RUN npm ci
COPY services/loyalty-service ./services/loyalty-service
WORKDIR /app/services/loyalty-service
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/loyalty-service/node_modules ./services/loyalty-service/node_modules
COPY --from=builder /app/services/loyalty-service/dist ./services/loyalty-service/dist
COPY --from=builder /app/services/loyalty-service/prisma ./services/loyalty-service/prisma
COPY --from=builder /app/services/loyalty-service/package.json ./services/loyalty-service/

WORKDIR /app/services/loyalty-service
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
