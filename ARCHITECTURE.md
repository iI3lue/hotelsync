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
│   └── front-desk-service/            ← Express + Prisma (3005)
│       └── (misma estructura + lib/booking-client.ts)
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
├── docker-compose.yml                 ← 4× PostgreSQL 16
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
  - Sin FK entre bases: la referencia es el UUID.
- **Asíncrona (eventos, stub Fase 1):** `booking.created` / `booking.cancelled`
  (Booking) y `checkout.completed` (Front Desk) se publican como log con
  `booking_id` para trazabilidad. En Fase 2 se cablean a RabbitMQ: Front Desk y
  Rate & Availability consumen `booking.created`, Channel Manager lo publica
  (OTAs), Housekeeping y Billing consumen `checkout.completed`.

## Plan de Evolución

### V1 (Actual)
- Property Service (3001) + Rate & Availability Service (3002)
- Booking Service (3004) + Front Desk Service (3005)
- 4× PostgreSQL (5432–5435)
- Frontend SSR (`/reservas/nueva` real) + Admin (`/recepcion`)

### V2 (Futuro)
- Channel Manager Service (sincronización OTAs, publica `booking.created`)
- Housekeeping Service (consume `checkout.completed`)
- Billing Service (folios, consume `checkout.completed`)
- Loyalty + Analytics
- Redis (cache, sesiones)
- RabbitMQ (eventos asíncronos reales)
- API Gateway
- Auth service (JWT, roles)
