FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY services/payment-service/package.json ./services/payment-service/
RUN npm ci
COPY services/payment-service ./services/payment-service
WORKDIR /app/services/payment-service
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/payment-service/node_modules ./services/payment-service/node_modules
COPY --from=builder /app/services/payment-service/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder /app/services/payment-service/dist ./services/payment-service/dist
COPY --from=builder /app/services/payment-service/prisma ./services/payment-service/prisma
COPY --from=builder /app/services/payment-service/package.json ./services/payment-service/

WORKDIR /app/services/payment-service
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
