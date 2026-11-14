# HotelSync — Arquitectura Técnica

## Visión General

HotelSync es una plataforma de gestión hotelera multi-propiedad basada en arquitectura de microservicios. Cada servicio es independiente, con su propia base de datos PostgreSQL y API REST.

## Principios de Diseño

1. **Separación por dominio** — Cada microservicio gestiona un bounded context
2. **Database per service** — Sin sharing de bases de datos
3. **API-first** — Contratos explícitos vía Zod validation
4. **Idempotencia** — Las operaciones pueden reintentarse sin efectos adversos
5. **Defensive coding** — Validación en boundaries, error handling centralizado

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Runtime | Node.js | ≥ 20 |
| Language | TypeScript | 5.7 |
| Backend framework | Express | 4.x |
| ORM | Prisma | 6.19 |
| Validation | Zod | 3.x |
| Database | PostgreSQL | 16 (Alpine) |
| Frontend framework | Next.js | 15.1 (App Router) |
| UI | TailwindCSS | 3.4 |
| Testing | Jest | 29.x |
| CI/CD | GitHub Actions | — |
| Containerization | Docker Compose | — |

## Monorepo Structure

```
HOTELSYNC/
├── services/
│   ├── property-service/              ← Express + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← Modelo de datos
│   │   │   ├── seed.ts                ← Datos de prueba
│   │   │   └── migrations/            ← Migraciones generadas
│   │   ├── src/
│   │   │   ├── index.ts               ← Entry point
│   │   │   ├── routes/                ← Express routes
│   │   │   ├── controllers/           ← Request handlers
│   │   │   ├── services/              ← Business logic
│   │   │   ├── validators/            ← Zod schemas
│   │   │   ├── middleware/            ← Error handling, validation
│   │   │   └── types/                 ← TypeScript types
│   │   ├── tests/                     ← Jest unit tests
│   │   ├── Dockerfile                 ← Multi-stage build
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── rate-availability-service/     ← Express + Prisma
│       └── (misma estructura)
│   ├── booking-service/               ← Express + Prisma (3004)
│   │   └── (misma estructura + lib/events.ts)
│   ├── front-desk-service/            ← Express + Prisma (3005)
│   │   └── (misma estructura + lib/booking-client.ts)
│   ├── loyalty-service/               ← Express + Prisma (3009)
│   │   └── (misma estructura + lib/{broker,consumer,booking-client,user-client}.ts)
│   ├── analytics-service/             ← Express + Prisma (3011), réplicas read-only
│   │   └── (misma estructura + lib/{broker,outbox,sources}.ts + jobs/{etl,scheduler}.ts)
│   └── api-gateway/                   ← Proxy interno (8080), sin DB ni estado
│       └── src/{app,routes,config,proxy,middleware}/
├── apps/
│   ├── web/                           ← Next.js SSR (App Router)
│   │   ├── src/app/
│   │   │   ├── page.tsx               ← Home (listado de hoteles)
│   │   │   ├── hotels/
│   │   │   │   └── [id]/page.tsx      ← Detalle de hotel
│   │   │   └── availability/page.tsx  ← Consulta de disponibilidad
│   │   │   └── reservas/nueva/page.tsx ← Crear + confirmar reserva (Booking)
│   │   └── package.json
│   └── admin/                         ← Next.js Admin (App Router)
│       ├── src/app/
│       │   ├── page.tsx               ← Dashboard
│       │   ├── hotels/page.tsx        ← CRUD hoteles
│       │   ├── room-types/page.tsx    ← CRUD habitaciones
│       │   ├── inventory/page.tsx     ← Gestión de inventario
│       │   └── recepcion/page.tsx     ← Llegadas + check-in/out
│       └── package.json
├── docker-compose.yml                 ← 11× PostgreSQL 16 (5432–5442)
├── tsconfig.base.json                 ← Config compartida
├── package.json                       ← npm workspaces
└── .github/workflows/                 ← CI/CD
```

## Base de Datos

### Aislamiento

Cada microservicio tiene su propia instancia de PostgreSQL. No hay foreign keys entre servicios.

```
┌─────────────────────┐     ┌─────────────────────────┐
│   property_db       │     │   rate_availability_db   │
│   (localhost:5432)  │     │   (localhost:5433)       │
├─────────────────────┤     ├─────────────────────────┤
│ hotel               │     │ inventory               │
│ room_type           │     │ rates                   │
│ cancellation_policy │     │ rate_rules              │
└─────────────────────┘     └─────────────────────────┘
┌─────────────────────┐     ┌─────────────────────────┐
│   booking_db        │     │   front_desk_db          │
│   (localhost:5434)  │     │   (localhost:5435)       │
├─────────────────────┤     ├─────────────────────────┤
│ bookings            │     │ room_assignments        │
│                     │     │ guest_incidents         │
└─────────────────────┘     └─────────────────────────┘
┌─────────────────────────┐
│   loyalty_db            │
│   (localhost:5440)      │
├─────────────────────────┤
│ loyalty_accounts        │
│ points_transactions     │
│ event_outbox            │
└─────────────────────────┘
┌─────────────────────────┐
│   analytics_db          │
│   (localhost:5442)      │
├─────────────────────────┤
│ occupancy_daily         │
│ kpi_by_property         │
│ event_outbox            │
└─────────────────────────┘
```

### Property Service Schema

```sql
CREATE TABLE hotel (
    hotel_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL
);

CREATE TABLE room_type (
    room_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotel(hotel_id),
    name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    base_rate DECIMAL(10,2) NOT NULL CHECK (base_rate >= 0),
    amenities JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE cancellation_policy (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotel(hotel_id),
    name VARCHAR(255) NOT NULL,
    description TEXT
);
```

### Rate & Availability Service Schema

```sql
CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id UUID NOT NULL,
    date DATE NOT NULL,
    available_count INT NOT NULL CHECK (available_count >= 0),
    blocked_count INT NOT NULL CHECK (blocked_count >= 0),
    UNIQUE(room_type_id, date)
);

CREATE TABLE rates (
    rate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id UUID NOT NULL,
    report_date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE rate_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    multiplier DECIMAL(5,2) NOT NULL CHECK (multiplier > 0),
    min_stay INT NOT NULL CHECK (min_stay >= 1),
    CHECK (start_date <= end_date)
);
```

### Booking Service Schema

```sql
CREATE TABLE bookings (
    booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL,
    hotel_id UUID NOT NULL,
    room_type_id UUID NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | confirmed | cancelled
    channel VARCHAR(20) NOT NULL DEFAULT 'direct',   -- direct | ota | phone
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    version INT NOT NULL DEFAULT 0,                  -- bloqueo optimista
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (check_out > check_in)
);
CREATE INDEX bookings_hotel_id_status_idx ON bookings(hotel_id, status);
CREATE INDEX bookings_room_type_id_check_in_idx ON bookings(room_type_id, check_in);
```

### Front Desk Service Schema

```sql
CREATE TABLE room_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE,   -- una asignación por reserva (sin doble check-in)
    physical_room_number VARCHAR(20) NOT NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMPTZ
);

CREATE TABLE guest_incidents (
    incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',   -- open | in_progress | resolved
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Loyalty Service Schema

```sql
CREATE TABLE loyalty_accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,                 -- referencia externa a user-service
    tier VARCHAR(20) NOT NULL DEFAULT 'silver',   -- silver | gold | platinum
    points_balance INT NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE points_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,                        -- referencia externa a user-service
    type VARCHAR(10) NOT NULL,                    -- earn | redeem
    points INT NOT NULL CHECK (points > 0),
    booking_id UUID UNIQUE,                       -- idempotencia: una acreditación por booking
    reason VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX points_transactions_user_id_created_at_idx ON points_transactions(user_id, created_at DESC);

CREATE TABLE event_outbox (                        -- patrón estándar HotelSync
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ
);
CREATE INDEX event_outbox_status_created_at_idx ON event_outbox(status, created_at);
```

### Analytics Service Schema

```sql
CREATE TABLE occupancy_daily (                       -- capacidad + ocupación por hotel-día
    hotel_id UUID NOT NULL,
    date DATE NOT NULL,
    available_nights INT NOT NULL,                   -- habitaciones físicas activas
    occupied_nights INT NOT NULL,                    -- reservas confirmed que cubren la noche
    occupancy NUMERIC(5,4) NOT NULL,                 -- 0–1
    PRIMARY KEY (hotel_id, date)
);

CREATE TABLE kpi_by_property (                       -- ADR/RevPAR/ingreso por hotel-día
    hotel_id UUID NOT NULL,
    date DATE NOT NULL,
    adr NUMERIC(12,2) NOT NULL,
    revpar NUMERIC(12,2) NOT NULL,
    rooms_sold INT NOT NULL,
    revenue NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (hotel_id, date)
);

CREATE TABLE event_outbox (                          -- patrón estándar HotelSync
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,                 -- metrics.updated
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ
);
CREATE INDEX event_outbox_status_created_at_idx ON event_outbox(status, created_at);
```

> El ETL es idempotente (upsert por `(hotel_id, date)`): correrlo dos veces no
> duplica filas ni altera totales. `sources.ts` castea las columnas `date` a
> `::text` porque Prisma raw las mapea a `Date` y el contrato es `YYYY-MM-DD`.
> Los rangos son `[from, to)` y el ingreso se prorratea por noche.

## Patrones de Diseño

### API Layer (3 capas)

```
Route → Controller → Service
  ↓         ↓           ↓
Zod      Request     Business
Valid.   Parsing     Logic
```

1. **Routes** — Definen endpoints, aplican middleware de validación
2. **Controllers** — Parsean request, llaman services, formatean response
3. **Services** — Lógica de negocio pura, interactúa con Prisma

### Error Handling

```typescript
// Middleware centralizado
app.use(errorHandler);

// Error class custom
class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

// En services
throw new AppError("Hotel not found", 404);
```

### Validation con Zod

```typescript
// Definición del schema
const CreateHotelSchema = z.object({
  name: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  timezone: z.string().min(1),
});

// Middleware de validación
const validate = (schema: z.ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.issues });
  }
  req.body = result.data;
  next();
};
```

## Reglas de Negocio

| Regla | Servicio | Implementación |
|-------|----------|----------------|
| `available_count >= 0` | Rate & Availability | Prisma CHECK constraint + Zod validation |
| `blocked_count >= 0` | Rate & Availability | Prisma CHECK constraint + Zod validation |
| `price >= 0` | Rate & Availability | Prisma CHECK constraint |
| `multiplier > 0` | Rate & Availability | Zod `z.number().positive()` |
| `min_stay >= 1` | Rate & Availability | Zod `z.number().int().min(1)` |
| Disponibilidad real = available - blocked | Rate & Availability | Calculada en service layer |
| `check_out > check_in` | Booking | Zod refine + chequeo en service |
| Confirmar solo `pending → confirmed` | Booking | Bloqueo optimista con `version` (409 si conflicto) |
| Confirmar decrementa inventario (RN-1) | Booking → R&A | REST `POST /availability/reserve` (transacción, 409 si falta disponibilidad) |
| Cancelar libera inventario (RN-2) | Booking → R&A | REST `POST /availability/release` (solo si estaba `confirmed`) |
| Check-in solo con reserva `confirmed` | Front Desk | Lectura REST a Booking Service (409 si no) |
| Sin doble check-in | Front Desk | `booking_id` UNIQUE en `room_assignments` + chequeo |
| Puntos = floor(total_amount × multiplicador) | Loyalty | `processEarn` con el multiplicador del tier vigente (silver ×1.0, gold ×1.25, platinum ×1.50) |
| Una acreditación por `booking_id` | Loyalty | `booking_id` UNIQUE en `points_transactions` + chequeo de idempotencia |
| Tier solo asciende | Loyalty | `determineTier` nunca baja el tier actual |
| Canje valida saldo | Loyalty | `AppError 400` si `points_balance < points`; `points_balance >= 0` |
| Baja bloqueada con reservas activas | User → Booking | `DELETE /v1/users/me` consulta has-active con `x-user-key` (409 si hay; 503 fail-closed si Booking cae) |
| Sin borrado físico de cuentas | User | Baja lógica + anonimización (`DISABLED`, email `deleted_*`, hash `deleted$`); el `user_id` se conserva |
| Sin cross-service FK | Todos | Cada servicio es independiente |
| Referencias cross-servicio = UUID | Todos | Sin joins entre bases |

## Testing

### Estrategia

- **Unit tests** por service layer (mock de Prisma)
- **Integration tests** por controller (mock de service)
- **89 tests totales** (18 property + 24 rate-availability + 27 booking + 20 front-desk)

### Comandos

```bash
# Todos los tests
npm test

# Tests con coverage
cd services/property-service && npx jest --coverage
```

### Estructura de Tests

```
tests/
├── services/
│   ├── hotel.service.test.ts
│   ├── room-type.service.test.ts
│   └── cancellation-policy.service.test.ts
├── controllers/
│   ├── hotel.controller.test.ts
│   └── ...
└── setup.ts              ← Global test setup
```

## CI/CD

### Pipeline (GitHub Actions)

```
Push → Lint → Test → Build → (Deploy)
  │      │       │       │
  │      │       │       └─ Docker build / Vercel build
  │      │       └─ Jest tests
  │      └─ ESLint + TypeScript check
  └─ Trigger on push to main
```

### Deploy

| Componente | Plataforma | Método |
|------------|------------|--------|
| Backend services | Render | Docker build → Web Service |
| Frontend apps | Vercel | Git integration → Auto deploy |
| Databases | Render | Managed PostgreSQL |

## Seguridad (V1)

- **Input validation** — Zod en todos los boundaries de API
- **SQL injection** — Prisma parameterized queries
- **Error handling** — No se exponen detalles internos
- **CORS** — Configurado por origin
- **Rate limiting** — Pendiente para V2

## Comunicación entre Servicios

- **Síncrona (REST):**
  - Front Desk consulta Booking (`GET /v1/bookings/:id`,
    `GET /v1/bookings?hotel_id=&status=confirmed&date=`) vía `BOOKING_SERVICE_URL`.
  - Booking reserva/libera inventario en Rate & Availability (`POST
    /v1/availability/reserve` y `/release`) vía `RATE_SERVICE_URL`. Reserva con
    transacción + `available_count >= count` (409 si no alcanza); cancelar
    compensa liberando. Si el servicio no responde → 502.
  - Loyalty consulta Booking (`GET /v1/bookings/:id`) y User (`GET /users/:id`)
    con `x-service-key` para validar la reserva y que la cuenta esté activa
    antes de acreditar puntos.
  - User consulta Booking (`GET /v1/bookings/by-user/:id/has-active`) con
    `x-user-key` antes de una baja de cuenta (variante A): 409 si hay
    reservas activas, 503 fail-closed si Booking no responde.
  - Sin FK entre bases: la referencia es el UUID.
- **Asíncrona (eventos, outbox + RabbitMQ):** publicados vía outbox
  (`pending → sent`) sobre el exchange `hotelsync.events`: `booking.created` /
  `booking.cancelled`, `booking.completed` (Front Desk) y `checkout.completed`
  (Front Desk). Consumen: Housekeeping y Billing `checkout.completed`, y Loyalty
  `booking.completed` (cola `loyalty.points`, prefetch 1, ack manual,
  acreditación idempotente por `booking_id`). Analytics corre un ETL (scheduler
  cada 6 h o corrida manual por rango) que lee `booking_db` y `property_db`
  mediante réplicas de solo lectura (`DATABASE_URL_BOOKING` /
  `DATABASE_URL_PROPERTY`, sin migraciones) y publica `metrics.updated` por
  outbox tras cada upsert de agregados. Sin `RABBITMQ_URL` los eventos
  quedan `pending` sin interrumpir la operación.

## API Gateway interno

El gateway (8080) es un proxy sin estado entre el BFF y los servicios. **No es público**: el único
punto público sigue siendo `apps/front` (Vercel), que es también el dueño de Auth0.

- **Enrutamiento:** tabla declarativa `SERVICE_ROUTES` (`src/routes.ts`) con 11 prefijos
  (`/property`, `/rate`, `/users`, `/booking`, `/front-desk`, `/housekeeping`, `/billing`,
  `/channel-manager`, `/loyalty`, `/payments`, `/analytics`); el schema Zod de configuración se
  deriva de esa misma tabla, así que agregar un servicio es una sola entrada.
- **Borde:** exige `x-gateway-secret` (comparación en tiempo constante) salvo en `/health`;
  descarta `cookie`, `x-service-key`, `x-loyalty-key`, `x-provider-key`, `x-internal-*` y
  `x-gateway-secret`; regenera `x-request-id`; propaga `Authorization` intacto y `x-client-ip`
  solo si el llamador está autenticado con el secreto. Única excepción: `x-provider-key` se
  permite en `/channel-manager/*` porque el BFF es el dueño de la clave del simulador.
- **Errores:** 504 en timeout, 502 si el upstream no responde, 401 sin secreto, 404 JSON para
  prefijos desconocidos. Sin reintentos ni cache (las escrituras del flujo de reserva no son
  idempotentes).
- **Despertar servicios:** el primer request autenticado dispara en segundo plano un `/health` a los
  11 upstreams (fire-and-forget, nunca bloquea la respuesta) y se repite como mucho cada
  `WAKE_ALL_INTERVAL_MS` (default 30 min). Resuelve el 502 instantáneo del edge de Render cuando la
  instancia free duerme. `WAKE_ALL_ENABLED=false` lo desactiva.
- **Activación:** el BFF enruta por el gateway solo los servicios de `GATEWAY_SERVICES`
  (lista separada por comas, incluida en el build). Vacía = rollback total a destinos directos.
- **Fuera de alcance:** rate limiting distribuido (sin Redis). La instrumentación Prometheus
  (`prom-client` + `/metrics`) ya existe en property-service y api-gateway; el resto de servicios
  sigue observándose por logs estructurados y `/health` (ver README, «Observabilidad local»).

Runbook: `docs/api-gateway-cutover.md`. Plan y decisiones: `docs/plan-api-gateway.md`.

## Plan de Evolución

### V1 (Actual)
- Property Service (3001) + Rate & Availability Service (3002)
- Booking Service (3004) + Front Desk Service (3005)
- Loyalty Service (3009, consume `booking.completed`)
- Analytics Service (3011, ETL sobre réplicas + dashboard de revenue)
- 11× PostgreSQL (5432–5442)
- Frontend SSR (`/reservas/nueva` real) + Admin (`/recepcion`) + Loyalty en perfil

### V2 (Futuro)
- Channel Manager Service (sincronización OTAs, publica `booking.created`)
- Housekeeping Service (consume `checkout.completed`)
- Billing Service (folios, consume `checkout.completed`)
- Analytics + Loyalty V2 (expiración de puntos, eventos desde user-service)
- Redis (cache, sesiones)
- Auth service (JWT, roles)
