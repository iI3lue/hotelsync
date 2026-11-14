# HotelSync

Plataforma de gestión hotelera multi-propiedad basada en microservicios.

## Stack

- **Backend**: Express + TypeScript + Prisma + PostgreSQL 16
- **Frontend**: Next.js (App Router) + TypeScript + TailwindCSS
- **Infra**: Docker Compose, GitHub Actions CI/CD
- **Validación**: Zod en boundaries de API

## Estructura del monorepo

```
hotelsync/
��� services/
�   ��� property-service/         # Cat�logo de hoteles, habitaciones, pol�ticas
�   ��� rate-availability-service/ # Inventario, tarifas, reglas de precio, bloqueos
�   ��� booking-service/          # Reservas, confirmaci�n con bloqueo optimista
�   ��� front-desk-service/       # Llegadas, check-in/out, incidencias
��� apps/
�   ��� front/                    # Front único SSR (zona pública + /admin, puerto 3000)
��� docker-compose.yml            # 4� PostgreSQL 16 aislados
��� package.json                  # npm workspaces
��� tsconfig.base.json            # Config TypeScript compartida
```

## Requisitos previos

- Node.js ≥ 20
- Docker + Docker Compose
- npm ≥ 10

## Setup rápido

```bash
# 1. Clonar el repo
git clone <repo-url> && cd hotelsync

# 2. Copiar variables de entorno
cp .env.example services/property-service/.env
cp .env.example services/rate-availability-service/.env
cp .env.example services/booking-service/.env
cp .env.example services/front-desk-service/.env
cp .env.example services/housekeeping-service/.env
cp .env.example services/billing-service/.env

# 3. Levantar bases de datos
docker compose up -d

# 4. Instalar dependencias
npm install

# 5. Ejecutar migraciones
npm run migrate:property
npm run migrate:rate
npm run migrate:booking
npm run migrate:front-desk
npm run migrate:housekeeping
npm run migrate:billing

# 6. Sembrar datos de prueba
npm run seed:property
npm run seed:rate
npm run seed:booking
npm run seed:front-desk
npm run seed:housekeeping
npm run seed:billing

# 7. Iniciar en desarrollo
npm run dev:property     # Puerto 3001
npm run dev:rate         # Puerto 3002
npm run dev:booking      # Puerto 3004
npm run dev:front-desk   # Puerto 3005
npm run dev:housekeeping # Puerto 3006
npm run dev:billing      # Puerto 3007
npm run dev:front        # Puerto 3000 (público + /admin)
```

## Docker — Nivel 1 (bases + backends)

```bash
# Construir imágenes de los servicios
docker compose build property-service rate-availability-service booking-service front-desk-service housekeeping-service billing-service

# Levantar todo: 6× PostgreSQL + RabbitMQ + 6× servicios
docker compose up -d

# Ver estado
docker compose ps

# Ver logs
docker compose logs property-service --tail 50
docker compose logs rate-availability-service --tail 50
docker compose logs booking-service --tail 50
docker compose logs front-desk-service --tail 50
docker compose logs housekeeping-service --tail 50
docker compose logs billing-service --tail 50

# Apagar todo
docker compose down
```

> Los servicios en Docker usan `DATABASE_URL` con host `property-db` / `rate-availability-db`
> (red interna) y corren `prisma migrate deploy` al arrancar. Para desarrollo día a día
> se recomienda `npm run dev` (hot-reload); Docker es para demo / simular producción.
> Cada servicio (booking, front-desk incluidos) tiene su `.env` propio (copiado de
> `.env.example`) — sin él Prisma falla con `Environment variable not found: DATABASE_URL`.

## Ver datos visualmente

| Herramienta | URL | Credenciales | Qué muestra |
|-------------|-----|--------------|-------------|
| RabbitMQ Management | `http://localhost:15672` | `guest` / `guest` | Exchange `hotelsync.events`, colas `front-desk.arrivals`, `housekeeping.tasks`, `billing.folio` y `rate-availability.physical-rooms` |
| Adminer (bases del compose) | `http://localhost:8082` | Sistema `PostgreSQL`, usuario `hotelsync`, clave `hotelsync_dev` | Tablas `bookings`, `event_outbox`, `arrivals`, `cleaning_tasks`, `folios`, `invoices`, `occupancy_daily`, etc. |

Servidores en Adminer (red interna de compose, puerto `5432`):

| Base | Servidor | Nombre DB |
|------|----------|-----------|
| Booking | `booking-db` | `booking_db` |
| Front Desk | `front-desk-db` | `front_desk_db` |
| Property | `property-db` | `property_db` |
| Rate & Availability | `rate-availability-db` | `rate_availability_db` |
| Housekeeping | `housekeeping-db` | `housekeeping_db` |
| Billing | `billing-db` | `billing_db` |
| Analytics | `analytics-db` | `analytics_db` |

> Alternativa sin compose: `npx prisma studio` dentro de cada servicio (usa su `.env`).
> Si Studio falla en Windows con `Unable to get DMMF ... spawn UNKNOWN`, es instalación corrupta
> del CLI: cerrar los `prisma studio` colgados, borrar `node_modules/prisma` y `node_modules/@prisma`,
> y correr `npm install` en la raíz (restaura exacto según el lockfile). Verificado con Prisma 6.19.3 + Node 24.

## Endpoints API

### Property Service (puerto 3001)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/hotels` | Listar hoteles |
| POST | `/v1/hotels` | Crear hotel (SUPER_ADMIN) |
| GET | `/v1/hotels/:id` | Obtener hotel |
| GET | `/v1/hotels/:id/room-types` | Tipos de habitación del hotel |
| POST | `/v1/room-types` | Crear tipo (MANAGER del hotel o SUPER_ADMIN) |
| PUT | `/v1/room-types/:id` | Actualizar tipo (mismo alcance) |
| GET | `/v1/hotels/:id/cancellation-policy` | Política de cancelación |
| GET | `/v1/hotels/:id/rooms` | Habitaciones físicas del hotel |
| POST | `/v1/hotels/:id/rooms` | Alta de unidad + evento a R&A (MANAGER/SUPER_ADMIN) |

### Rate & Availability Service (puerto 3002)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/availability` | Consultar disponibilidad |
| GET | `/v1/rates` | Listar tarifas |
| PUT | `/v1/rate-rules` | Crear/actualizar regla de tarifa |
| POST | `/v1/blocks` | Bloquear/desbloquear inventario (MANAGER/SUPER_ADMIN) |

### Booking Service (puerto 3004)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/bookings` | Listar reservas (filtros `hotel_id`, `status`, `date`) |
| POST | `/v1/bookings` | Crear reserva anónima con datos del huésped (`pending`, devuelve `manage_token`, emite `booking.created`) |
| GET | `/v1/bookings/:id` | Obtener reserva (staff o `?token=` de gestión) |
| POST | `/v1/bookings/:id/confirm` | Confirmar con staff o manage token (bloqueo optimista anti-sobreventa) |
| GET | `/v1/bookings/me` | Reservas propias de la cuenta (Bearer) |
| POST | `/v1/bookings/:id/cancel` | Cancelar con manage token o staff (emite `booking.cancelled`) |
| GET | `/v1/bookings/by-user/:userId/has-active` | Reservas activas de una cuenta (`x-user-key`, solo server-to-server) |

### Front Desk Service (puerto 3005)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/arrivals?hotel_id=&date=` | Llegadas del día (read model local, vía RabbitMQ) |
| POST | `/v1/check-in` | Check-in con habitación física (+ `physical_room_id` opcional del catálogo) |
| GET | `/v1/check-in/:bookingId` | Asignación de una reserva (404 si no tiene check-in) |
| POST | `/v1/check-out` | Check-out (emite `checkout.completed`) |
| GET | `/v1/incidents` | Listar incidencias |
| POST | `/v1/incidents` | Crear incidencia |
| PATCH | `/v1/incidents/:id` | Cambiar estado de incidencia |

### Housekeeping Service (puerto 3006)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/tasks?hotel_id=&status=` | Cola de tareas (vía `checkout.completed`) |
| GET | `/v1/tasks/mine` | Tareas del usuario logueado (Bearer) |
| PUT | `/v1/tasks/:id/assign` | Asignar por UUID de cuenta (HOUSEKEEPER/MANAGER/SUPER_ADMIN) |
| PUT | `/v1/tasks/:id/start` | Pasar a en limpieza (mismo rol) |
| PUT | `/v1/tasks/:id/complete` | Completar con registro de quién/cuándo (habitación a `clean`) |
| GET | `/v1/rooms/status?hotel_id=` | Estados de habitación |
| PUT | `/v1/rooms/:id/status` | Estado manual (`dirty\|cleaning\|clean\|maintenance`) |

### Billing Service (puerto 3007)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/folios?hotel_id=&status=` | Folios abiertos/cerrados |
| GET | `/v1/folios/:id` | Folio con cargos y factura |
| GET | `/v1/folios/by-booking/:bookingId` | Folio de una reserva (usa la factura de recepción) |
| GET | `/v1/folios/guest/:id` | Folios de un huésped |
| POST | `/v1/charges` | Agregar cargo (staff de recepción/manager/admin) |
| POST | `/v1/folios/:id/close` | Cerrar y emitir factura, idempotente (mismo rol) |
| GET | `/v1/invoices?hotel_id=` | Facturas del hotel |
| GET | `/v1/invoices/:id` | Factura con folio y cargos |

### User Service (puerto 3003)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/v1/auth/register` | Registro público opcional (cuenta `GUEST`) |
| POST | `/v1/auth/login` | Login, devuelve access (15 min) + refresh (7d con rotación atómica) |
| POST | `/v1/auth/federated` | Login con Google vía Auth0 (verifica JWKS, crea/vincula GUEST) |
| POST | `/v1/auth/refresh` | Rota el refresh y emite un par nuevo |
| POST | `/v1/auth/logout` | Revoca el refresh (idempotente) |
| GET | `/v1/users/me` | Perfil propio + rol vigente |
| PATCH | `/v1/users/me` | Editar nombre/teléfono propios |
| DELETE | `/v1/users/me` | Baja de cuenta propia (verificada; 409 si hay reservas activas) |
| POST | `/v1/admin/users` | Alta de personal (SUPER_ADMIN; devuelve `initial_password` si no se indicó) |
| GET | `/v1/admin/users` | Listar personal (SUPER_ADMIN todo; MANAGER solo su hotel) |
| PATCH | `/v1/admin/users/:id` | Editar personal o desactivar (SUPER_ADMIN) |
| POST | `/v1/hotels/:hotelId/staff` | Alta de recepcionista/limpieza (MANAGER del hotel o SUPER_ADMIN) |
| GET | `/v1/hotels/:hotelId/staff` | Personal del hotel (mismo alcance) |
| PATCH | `/v1/hotels/:hotelId/staff/:userId` | Activar/desactivar asignación del hotel |

Auth HS256 con `AUTH_JWT_SECRET` compartido (mismo valor en user-service y
consumidores). Sin ese secreto los servicios que verifican no arrancan; sin
`RABBITMQ_URL` el resto opera igual. El seed crea el `SUPER_ADMIN` inicial
desde `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`.

### Analytics Service (puerto 3011)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check (sin auth) |
| GET | `/v1/occupancy?hotel_id=&from=&to=` | Ocupación diaria (`to` exclusivo) |
| GET | `/v1/adr?hotel_id=&from=&to=` | ADR diario |
| GET | `/v1/revpar?hotel_id=&from=&to=` | RevPAR diario |
| GET | `/v1/forecast?hotel_id=&from=&to=&horizon=14` | Previsión (media móvil, `horizon` 1–90) |
| GET | `/v1/dashboard/:hotelId?from=&to=` | KPIs promedio + previsión en una llamada |

Requiere Bearer con rol `MANAGER` o `SUPER_ADMIN`. Las series y el dashboard
responden `{ "data": ... }` con montos en COP.

## Testing

```bash
# Ejecutar todos los tests
npm test

# Tests de un servicio específico
cd services/property-service && npm test
cd services/rate-availability-service && npm test
cd services/booking-service && npm test
cd services/front-desk-service && npm test
cd services/housekeeping-service && npm test
cd services/billing-service && npm test
```

## Arquitectura

### Diagrama de Microservicios

```
┌─────────────────────────────────────────────────────────┐
│                      FRONT ÚNICO                        │
│  ┌──────────────────────────────────────────────┐    │
│  │   Front (3000) — público + /admin            │    │
│  │   Next.js SSR                                │    │
│  └──────────────────┬───────────────────────────┘    │
└────────────────────┼────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      BACKENDS                           │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │ Property (3001)  │  │ Rate & Availability(3002)│    │
│  │ Express + Prisma │  │ Express + Prisma         │    │
│  └────────┬─────────┘  └────────┬─────────────────┘    │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │ Booking (3004)   │  │ Front Desk (3005)        │    │
│  │ Express + Prisma │  │ Express + Prisma         │    │
│  └────────┬─────────┘  └────────┬─────────────────┘    │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │ Housekeeping(3006)│  │ Billing (3007)           │    │
│  │ Express + Prisma │  │ Express + Prisma         │    │
│  └────────┬─────────┘  └────────┬─────────────────┘    │
└───────────┼──────────────────────┼───────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────┐  ┌───────────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│   property_db     │  │ rate_availability_db  │  │   booking_db      │  │  front_desk_db    │
│   PostgreSQL 16   │  │   PostgreSQL 16       │  │  PostgreSQL 16    │  │  PostgreSQL 16    │
└───────────────────┘  └───────────────────────┘  └───────────────────┘  └───────────────────┘
┌───────────────────┐  ┌───────────────────┐
│ housekeeping_db   │  │   billing_db      │
│   PostgreSQL 16   │  │   PostgreSQL 16   │
└───────────────────┘  └───────────────────┘
```

Front Desk → Booking por REST (`BOOKING_SERVICE_URL`) para check-in puntual;
Booking ↔ Front Desk por RabbitMQ (`RABBITMQ_URL`, exchange topic
`hotelsync.events`, consola en `:15672`): Booking publica
`booking.created`/`booking.cancelled` con outbox transaccional + confirms,
Front Desk proyecta el read model `arrivals` (cola `front-desk.arrivals`,
ack manual, upsert idempotente) y publica `checkout.completed` también vía
outbox. Housekeeping consume `checkout.completed` (cola `housekeeping.tasks`:
habitación a sucia + tarea automática) y Billing consume `booking.created`
(apertura de folio) y `checkout.completed` (cierre + `folio.closed`
vía outbox propio). Sin `RABBITMQ_URL` los servicios operan igual pero los
eventos quedan `pending` en el outbox.

Property también publica `physical-room.created` desde su outbox al registrar
una unidad. R&A consume la cola `rate-availability.physical-rooms`, agrega una
unidad disponible por fecha durante 365 días desde `available_from` y limpia
las claves de Redis; los eventos repetidos no vuelven a sumar inventario.

Analytics agrega noches desde `booking_db` y capacidad desde `property_db` con
un ETL por hotel-día (upsert idempotente por `(hotel_id, date)`) y publica
`metrics.updated` por outbox. Corre al arrancar (`ETL_START_DELAY_MS`, 30 s) y
cada `ETL_INTERVAL_MS` (6 h). Corrida manual con rango (`to` exclusivo):

```bash
docker exec hotelsync-analytics-service-1 node dist/jobs/etl.js --from=2026-09-22 --to=2026-10-24
```

El dashboard de revenue vive en `/admin/analytics` (rol `MANAGER` o `SUPER_ADMIN`).

### API Gateway interno (puerto 8080)

El gateway no es público: vive detrás del BFF. El front (`apps/front`) reescribe `/api/<servicio>/*`
hacia `GATEWAY_URL/<servicio>/*` solo para los servicios listados en `GATEWAY_SERVICES`, e inyecta
`x-gateway-secret` y `x-client-ip`. El gateway valida el secreto, descarta cabeceras internas
(`cookie`, `x-service-key`, `x-provider-key`, `x-internal-*`) y reenvía el resto tal cual, incluido
`Authorization`. El front sigue siendo el único punto público y el dueño de Auth0.

```
navegador → Vercel (apps/front) → /api/<servicio>/* → gateway (8080) → servicio
```

- Local: `docker compose up -d api-gateway` (escucha en `http://localhost:8080`, `/health` incluido).
  El compose define `GATEWAY_SHARED_SECRET=hotelsync-dev-gateway-secret-change-me`; el front debe usar el
  mismo valor en `GATEWAY_SHARED_SECRET` (Adminer queda en `http://localhost:8082`).
- **Despertar servicios:** el primer request autenticado que cruza el gateway dispara en segundo plano un
  `GET /health` a los 11 servicios (los free de Render devuelven 502 mientras arrancan). Se repite como
  mucho cada `WAKE_ALL_INTERVAL_MS` (default 30 min). Se controla con `WAKE_ALL_ENABLED` y
  `WAKE_ALL_TIMEOUT_MS`. El log `wake.broadcast` separa `waking` (502/503/504 del edge: el arranque ya
  se disparó) de `failed` (red, timeout o status inesperado).
- Rollback: `GATEWAY_SERVICES=""` en el BFF y redeploy → vuelve a destinos directos.
- Runbook completo: `docs/api-gateway-cutover.md`. Plan: `docs/plan-api-gateway.md`.

### Observabilidad local (Prometheus + Grafana)

```bash
npm run monitoring:up     # Prometheus + Grafana + blackbox-exporter
npm run monitoring:logs
npm run monitoring:down
```

| Herramienta | URL | Credenciales | Qué muestra |
|-------------|-----|--------------|-------------|
| Prometheus | `http://localhost:9090` | — | Targets, consultas ad-hoc y reglas |
| Grafana | `http://localhost:3030` | `admin` / `admin` | Dashboard **HotelSync — Overview** (carpeta `HotelSync`) |

- **Job `hotelsync-health`:** blackbox-exporter hace `GET /health` a los 11 servicios y al gateway (12 targets), con `probe_success`, `probe_duration_seconds` y `probe_http_status_code`. El gateway se sondea en `8080`; si otra app local ocupa ese puerto, el probe da falso positivo (responde 200 a cualquier ruta).
- **Job `hotelsync-metrics`:** scrape de `/metrics` (prom-client) en `property-service:3001`, `rate-availability-service:3002`, `user-service:3003`, `booking-service:3004`, `front-desk-service:3005` y `api-gateway:8080`. Métricas: `hotelsync_http_requests_total` y `hotelsync_http_request_duration_seconds` (etiquetas `method`, `route` normalizada, `status`), `hotelsync_http_requests_in_flight`, y en los servicios con outbox (`property`, `rate`, `booking`, `front-desk`) `hotelsync_outbox_pending_events` + `hotelsync_broker_connected`.
- **Alcance actual:** pilotos en property, rate-availability, user, booking, front-desk y api-gateway (19 targets en total). Faltan housekeeping, billing, channel-manager, loyalty, payment y analytics; el patrón a copiar es `src/lib/metrics.ts` (con `ROUTE_PREFIXES` del servicio) + `app.use(httpMetrics)` + `GET /metrics` antes de `requireGateway`. Si un middleware rechaza antes de casar ruta, la etiqueta cae al prefijo montado (p. ej. `/v1/auth`) en vez de `unmatched`.
- `/metrics` se monta antes de `requireGateway`, así que queda accesible sin secreto: aceptable en local; en producción conviene restringirlo a nivel de ingress/red.

### Modelo de Datos

#### Property Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `hotel` | hotel_id (PK), name, city, country, timezone | — |
| `room_type` | room_type_id (PK), hotel_id (FK), name, capacity, base_rate, amenities | — |
| `cancellation_policy` | policy_id (PK), hotel_id (FK), name, description | — |
| `physical_rooms` | physical_room_id (PK), hotel_id (FK), room_type_id (FK), room_number, available_from, is_active | UNIQUE(hotel_id, room_number) |
| `event_outbox` | event_id (PK), event_type, payload, status, created_at, sent_at | Índice por estado y fecha |

#### Rate & Availability Service

| `processed_events` | event_id (PK), event_type, processed_at | Deduplica eventos publicados por Property |

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `inventory` | inventory_id (PK), room_type_id, date, available_count, blocked_count | @@unique(room_type_id, date) |
| `rates` | rate_id (PK), room_type_id, report_date, price | — |
| `rate_rules` | rule_id (PK), room_type_id, start_date, end_date, multiplier, min_stay | — |

#### Booking Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `bookings` | booking_id (PK), guest_id, hotel_id, room_type_id, check_in, check_out, status, channel, total_amount, version | @@index(hotel_id, status), @@index(room_type_id, check_in) |
| `event_outbox` | event_id (PK), event_type, payload (JSONB), status, attempts, created_at, sent_at | @@index(status, created_at) |

#### Front Desk Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `room_assignments` | assignment_id (PK), booking_id (UNIQUE), physical_room_number, checked_in_at, checked_out_at | Sin doble check-in |
| `guest_incidents` | incident_id (PK), booking_id, description, status | @@index(booking_id) |
| `arrivals` | booking_id (PK), hotel_id, room_type_id, guest_id, check_in, check_out, channel, status | Read model de `booking.created`/`cancelled`, @@index(hotel_id, check_in) |
| `event_outbox` | event_id (PK), event_type, payload (JSONB), status, attempts, created_at, sent_at | @@index(status, created_at) |

#### Housekeeping Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `room_status` | room_status_id (PK), hotel_id, room_number, status (`dirty\|cleaning\|clean\|maintenance`), assigned_to | @@unique(hotel_id, room_number) |
| `cleaning_history` | history_id (PK), room_status_id (FK), booking_id (UNIQUE), hotel_id, room_number, status, assigned_to | Idempotente por booking_id |

#### Billing Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `folios` | folio_id (PK), booking_id (UNIQUE), hotel_id, guest_id, currency, total, status (`open\|closed`) | Idempotente por booking_id |
| `charges` | charge_id (PK), folio_id (FK), concept, amount, category, added_at | @@index(folio_id) |
| `invoices` | invoice_id (PK), folio_id (UNIQUE), invoice_number (UNIQUE), subtotal, tax_rate, tax_amount, total, currency, country | Una factura por folio |
| `event_outbox` | event_id (PK), event_type, payload (JSONB), status, attempts, created_at, sent_at | @@index(status, created_at) |

#### Analytics Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `occupancy_daily` | hotel_id, date, available_nights, occupied_nights, occupancy (0–1, 4 decimales) | PK(hotel_id, date) |
| `kpi_by_property` | hotel_id, date, adr, revpar, rooms_sold, revenue | PK(hotel_id, date) |
| `event_outbox` | event_id (PK), event_type (`metrics.updated`), payload (JSONB), status, attempts, created_at, sent_at | Índice por estado y fecha |

### Reglas de Negocio

- `available_count >= 0` — no se puede tener inventario negativo
- `blocked_count >= 0` — no se pueden bloquear más habitaciones de las disponibles
- `price >= 0` — precios no negativos
- `multiplier > 0` — multiplicador de tarifa debe ser positivo
- `min_stay >= 1` — estadía mínima de 1 noche
- **Disponibilidad real** = `available_count - blocked_count`
- `check_out > check_in` — validado en Zod y en service (Booking)
- **Confirmar solo `pending → confirmed`** con bloqueo optimista (`version`, 409 si conflicto)
- **Check-in solo con reserva `confirmed`** (Front Desk lee Booking por REST, 409 si no)
- **Sin joins cross-servicio** — cada microservicio tiene su propia PostgreSQL
- **Referencias cross-servicio** — solo UUID, sin foreign keys

## CI/CD

### GitHub Actions

- **ci.yml**: lint + test + build en cada push
- **deploy.yml**: deploy automático (pendiente de configurar)

### Deploy (producción)

| Servicio | Plataforma | Puerto | URL prod |
|----------|------------|--------|----------|
| Property Service | Render | 3001 | `https://hotelsync-property-service.onrender.com` |
| Rate & Availability | Render | 3002 | `https://hotelsync-rate-availability-service.onrender.com` |
| User Service | Render | 3003 | `https://hotelsync-user-service.onrender.com` |
| Booking Service | Render | 3004 | `https://hotelsync-booking-service.onrender.com` |
| Front Desk Service | Render | 3005 | `https://hotelsync-front-desk-service.onrender.com` |
| Housekeeping Service | Render | 3006 | `https://hotelsync-housekeeping-service.onrender.com` |
| Billing Service | Render | 3007 | `https://hotelsync-billing-service.onrender.com` |
| API Gateway (interno, detrás del BFF) | Render | 8080 | `https://hotelsync-api-gateway-tu1c.onrender.com` |
| Front único (público + /admin) | Vercel | — | `https://hotelsync-front.vercel.app` |

### Estado de producción (2026-10-05)

- Los 7 backends en `live` con el hardening (scope por hotel, service keys,
  HS256 con `iss`/`aud`, refresh atómico, nonce en federated) y todas las
  migraciones aplicadas. Front con login Google funcionando, logout,
  redirect por rol y cotización COP en vivo (`/api/rates` + polling 10 min).
- `AUTH_JWT_SECRET` idéntico en los 7 backends; claves `SERVICE_API_KEY` y
  `BOOKING_SERVICE_KEY` pareadas entre Booking y sus consumidores;
  `USER_SERVICE_URL` en Housekeeping. Las `NEXT_PUBLIC_*` de Vercel se
  hornean en el build: cualquier cambio exige Redeploy.

## Licencia

Proyecto académico — Arquitectura y Modelamiento de Software (UCC)
