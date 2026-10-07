FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY services/channel-manager-service/package.json ./services/channel-manager-service/package.json
RUN npm ci --workspace=services/channel-manager-service --include-workspace-root=false

COPY services/channel-manager-service/prisma ./services/channel-manager-service/prisma
COPY services/channel-manager-service/tsconfig.json ./services/channel-manager-service/tsconfig.json
COPY services/channel-manager-service/src ./services/channel-manager-service/src
WORKDIR /app/services/channel-manager-service
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/channel-manager-service/package.json ./services/channel-manager-service/package.json
COPY --from=builder /app/services/channel-manager-service/dist ./services/channel-manager-service/dist
COPY --from=builder /app/services/channel-manager-service/prisma ./services/channel-manager-service/prisma
COPY --from=builder /app/services/channel-manager-service/node_modules ./services/channel-manager-service/node_modules
COPY --from=builder /app/services/channel-manager-service/node_modules/.prisma/client ./node_modules/.prisma/client
WORKDIR /app/services/channel-manager-service
EXPOSE 3008
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm start"]
