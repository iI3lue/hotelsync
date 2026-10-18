# HotelSync — Guía para Agentes

Monorepo con npm workspaces. Node ≥20. Express + TypeScript + Prisma + PostgreSQL 16 | Next.js + Tailwind | Docker Compose | Zod en bordes de API.
Documentos extensos: README.md (instalación y endpoints), ARCHITECTURE.md (patrones), API.md (contratos). Consultarlos solo si se requiere detalle.

## Estructura y puertos
- services/property-service:3001 | rate-availability-service:3002 | user-service:3003 | booking-service:3004 | front-desk-service:3005 | housekeeping-service:3006 | billing-service:3007 | analytics-service:3011
- apps/front:3000 (público + /admin) | apps/admin heredado
- PostgreSQL 16 por servicio: 5432-5442 | RabbitMQ 5672/15672 (exchange hotelsync.events) | Redis 6379 | Adminer 8080
- Estructura por servicio: src/{routes,controllers,services,validators,middleware}/index.ts + prisma/{schema,seed,migrations} + tests/

## Comandos (desde la raíz)
db:up → copiar .env.example a cada services/*/.env → npm install → migrate:* → seed:* → dev:*
npm run dev:<property|rate|booking|front-desk|housekeeping|billing|analytics|front> | npm test / lint (lint = tsc --noEmit) | build = tsc

## Reglas obligatorias
- Flujo Route → Controller → Service. Validar con Zod en el borde. Errores: {error} con AppError(status). No exponer detalles internos.
- Base de datos por servicio. Sin claves foráneas entre servicios, solo UUID. Sin joins entre bases de datos.
- Booking: pending→confirmed con versión optimista (409 en conflicto) + reserva/libera inventario vía REST hacia R&A. Front Desk exige confirmed (409 en caso contrario). Sin doble check-in (booking_id UNIQUE).
- Eventos mediante outbox (pending→sent) + RabbitMQ: booking.created/cancelled, checkout.completed, folio.closed, metrics.updated. Sin RABBITMQ_URL quedan pending, sin interrumpir la operación.
- Analytics: ETL idempotente por (hotel_id, date) sobre réplicas read-only de booking/property (sin migraciones ni joins cross-DB); en raw queries castear `date` a `::text`; dashboard `/admin/analytics` solo MANAGER/SUPER_ADMIN. ETL manual: `docker exec hotelsync-analytics-service-1 node dist/jobs/etl.js --from=YYYY-MM-DD --to=YYYY-MM-DD` (`to` exclusivo).
- Cada servicio requiere su .env con DATABASE_URL propio, de lo contrario Prisma falla.

## Producción y splits (aprendido 2026-10-05)
- 1 repo + 1 Render + 1 Neon por servicio (`iI3lue/hotelsync-*`). Clones locales en
  `Temp/opencode/hotelsync-split/*` (+ `user-service-repo`, `front-sync`). Sincronizar =
  copiar `src`+`tests`+`prisma` (nunca Dockerfile/package.json/.env del split sin revisar).
- Antes de pushear un split: comparar por hash ambas vías. Los splits pueden tener
  endpoints que el monorepo perdió (`folios/by-booking`, `check-in/:bookingId`):
  preservarlos y asegurarlos, jamás copia ciega. Billing tiene test solo-split que mantener.
- `npx prisma generate` antes de `tsc --noEmit` en splits (el client stale da errores
  falsos). Rate/property necesitan `amqplib` + lock regenerado si se trae `broker.ts`.
- BFF: el middleware solo inyecta el Bearer, nunca rota (las Set-Cookie sobre
  `NextResponse.next()` se pierden en rewrites). Renovar en `/api/auth/refresh`,
  `/api/auth/me` y retry del cliente.
- Vercel: `NEXT_PUBLIC_*` es build-time (Redeploy obligatorio); `APP_BASE_URL` fija el
  `redirect_uri` de Auth0; previews cambian de URL por deploy (no whitelisteare previews).
- Auth0/Google: alinear `AUTH0_CLIENT_ID` en Render user-service con la app del front;
  user-service exige `nonce`; el callback propaga `?error=oauth&step=` para diagnosticar.
- Front-sync divergió del monorepo: sync quirúrgico por archivos de auth, no copia total.

## Analytics en producción (2026-10-17)
- Repo de deploy: `iI3lue/hotelsync-analytics-service` → Render free `https://hotelsync-analytics-service.onrender.com` (oregon; Render inyecta `PORT`). Build `npm ci && npx prisma generate && npm run build`; start `npx prisma migrate deploy && npm start`.
- Neon `hotelsync-analytics-db` (`analytics_db`); lee `property_db`/`booking_db` con el rol `hotelsync_analytics_ro` (SELECT, sin escritura). Migrar con host directo, no pooler.
- Env en Render: `DATABASE_URL`, `DATABASE_URL_PROPERTY`, `DATABASE_URL_BOOKING`, `AUTH_JWT_SECRET`, `RABBITMQ_URL`, `ETL_LOOKBACK_DAYS=30`. Sin `RABBITMQ_URL` el outbox queda `pending`; el scheduler in-process corre al arranque y cada 6 h (el free tier duerme a los 15 min, de ahí el lookback).
- Front: `NEXT_PUBLIC_ANALYTICS_API_URL=https://hotelsync-analytics-service.onrender.com/v1` es build-time en Vercel; deploy = push de `front-sync` a `iI3lue/hotelsync-front:main`.
- Backfill manual: `npx tsx src/jobs/etl.ts --from=YYYY-MM-DD --to=YYYY-MM-DD` con las URLs productivas.
