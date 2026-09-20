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
�   ��� web/                      # Web p�blica SSR (reservaci�n directa)
�   ��� admin/                    # Panel de administraci�n
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

# 3. Levantar bases de datos
docker compose up -d

# 4. Instalar dependencias
npm install

# 5. Ejecutar migraciones
npm run migrate:property
npm run migrate:rate
npm run migrate:booking
npm run migrate:front-desk

# 6. Sembrar datos de prueba
npm run seed:property
npm run seed:rate
npm run seed:booking
npm run seed:front-desk

# 7. Iniciar en desarrollo
npm run dev:property   # Puerto 3001
npm run dev:rate       # Puerto 3002
npm run dev:booking    # Puerto 3004
npm run dev:front-desk # Puerto 3005
npm run dev:web        # Puerto 3000
npm run dev:admin      # Puerto 3003
```

## Docker — Nivel 1 (bases + backends)

```bash
# Construir imágenes de los servicios
docker compose build property-service rate-availability-service booking-service front-desk-service

# Levantar todo: 4× PostgreSQL + 4× servicios
docker compose up -d

# Ver estado
docker compose ps

# Ver logs
docker compose logs property-service --tail 50
docker compose logs rate-availability-service --tail 50
docker compose logs booking-service --tail 50
docker compose logs front-desk-service --tail 50

# Apagar todo
docker compose down
```

> Los servicios en Docker usan `DATABASE_URL` con host `property-db` / `rate-availability-db`
> (red interna) y corren `prisma migrate deploy` al arrancar. Para desarrollo día a día
> se recomienda `npm run dev` (hot-reload); Docker es para demo / simular producción.

## Endpoints API

### Property Service (puerto 3001)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/hotels` | Listar hoteles |
| POST | `/v1/hotels` | Crear hotel |
| GET | `/v1/hotels/:id` | Obtener hotel |
| GET | `/v1/hotels/:id/room-types` | Tipos de habitación del hotel |
| POST | `/v1/room-types` | Crear tipo de habitación |
| PUT | `/v1/room-types/:id` | Actualizar tipo de habitación |
| GET | `/v1/hotels/:id/cancellation-policy` | Política de cancelación |

### Rate & Availability Service (puerto 3002)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/availability` | Consultar disponibilidad |
| GET | `/v1/rates` | Listar tarifas |
| PUT | `/v1/rate-rules` | Crear/actualizar regla de tarifa |
| POST | `/v1/blocks` | Bloquear/desbloquear inventario |

### Booking Service (puerto 3004)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/bookings` | Listar reservas (filtros `hotel_id`, `status`, `date`) |
| POST | `/v1/bookings` | Crear reserva (`pending`, emite `booking.created`) |
| GET | `/v1/bookings/:id` | Obtener reserva |
| POST | `/v1/bookings/:id/confirm` | Confirmar (bloqueo optimista anti-sobreventa) |
| POST | `/v1/bookings/:id/cancel` | Cancelar (emite `booking.cancelled`) |

### Front Desk Service (puerto 3005)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/arrivals?hotel_id=&date=` | Llegadas del día (vía Booking Service) |
| POST | `/v1/check-in` | Check-in con habitación física |
| POST | `/v1/check-out` | Check-out (emite `checkout.completed`) |
| GET | `/v1/incidents` | Listar incidencias |
| POST | `/v1/incidents` | Crear incidencia |
| PATCH | `/v1/incidents/:id` | Cambiar estado de incidencia |

## Testing

```bash
# Ejecutar todos los tests
npm test

# Tests de un servicio específico
cd services/property-service && npm test
cd services/rate-availability-service && npm test
cd services/booking-service && npm test
cd services/front-desk-service && npm test
```

## Arquitectura

### Diagrama de Microservicios

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTENDS                          │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │   Web (3000) │  │ Admin (3003) │                    │
│  │  Next.js SSR │  │  Next.js     │                    │
│  └──────┬───────┘  └──────┬───────┘                    │
└─────────┼──────────────────┼─────────────────────────────┘
          │                  │
          ▼                  ▼
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
└───────────┼──────────────────────┼───────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────┐  ┌───────────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│   property_db     │  │ rate_availability_db  │  │   booking_db      │  │  front_desk_db    │
│   PostgreSQL 16   │  │   PostgreSQL 16       │  │  PostgreSQL 16    │  │  PostgreSQL 16    │
└───────────────────┘  └───────────────────────┘  └───────────────────┘  └───────────────────┘
```

Front Desk → Booking por REST (`BOOKING_SERVICE_URL`); eventos
(`booking.created`, `checkout.completed`) como stub con log hasta Fase 2 (RabbitMQ).

### Modelo de Datos

#### Property Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `hotel` | hotel_id (PK), name, city, country, timezone | — |
| `room_type` | room_type_id (PK), hotel_id (FK), name, capacity, base_rate, amenities | — |
| `cancellation_policy` | policy_id (PK), hotel_id (FK), name, description | — |

#### Rate & Availability Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `inventory` | inventory_id (PK), room_type_id, date, available_count, blocked_count | @@unique(room_type_id, date) |
| `rates` | rate_id (PK), room_type_id, report_date, price | — |
| `rate_rules` | rule_id (PK), room_type_id, start_date, end_date, multiplier, min_stay | — |

#### Booking Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `bookings` | booking_id (PK), guest_id, hotel_id, room_type_id, check_in, check_out, status, channel, total_amount, version | @@index(hotel_id, status), @@index(room_type_id, check_in) |

#### Front Desk Service

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| `room_assignments` | assignment_id (PK), booking_id (UNIQUE), physical_room_number, checked_in_at, checked_out_at | Sin doble check-in |
| `guest_incidents` | incident_id (PK), booking_id, description, status | @@index(booking_id) |

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

| Servicio | Plataforma | Puerto |
|----------|------------|--------|
| Property Service | Render | 3001 |
| Rate & Availability | Render | 3002 |
| Booking Service | Render | 3004 |
| Front Desk Service | Render | 3005 |
| Web frontend | Vercel | — |
| Admin frontend | Vercel | — |

## Licencia

Proyecto académico — Arquitectura y Modelamiento de Software (UCC)
