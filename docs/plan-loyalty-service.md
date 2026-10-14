# Plan de Implementación — Loyalty Service

**Fecha:** 2026-10-13
**Estado:** Aprobado, listo para implementación
**Fuente:** `HotelSync_Arquitectura.docx` §4.8 + §5.8, ER §5.8, PRD §5.8

---

## 1. Alcance

Microservicio de fidelización transversal a toda la cadena. Acumula puntos por estancia completada, gestiona niveles de membresía (plata, oro, platino) y mantiene un saldo único por usuario.

### Reglas de negocio

| ID | Regla |
|----|-------|
| LY-1 | Los puntos se acreditan solo tras el checkout (`booking.completed`) |
| LY-2 | Aplica solo a cuentas verificadas (registradas con email + password). Reservas guest (sin cuenta) no acumulan |
| LY-3 | Fórmula: `puntos = floor(total_amount × multiplicador_tier)` |
| LY-4 | Multiplicadores: plata ×1.0, oro ×1.25, platino ×1.50 |
| LY-5 | Umbrales de tier por balance acumulado: plata 0–999, oro 1000–4999, platino 5000+ |
| LY-6 | El tier para el cálculo es el vigente ANTES de acreditar; luego se recalcula por el nuevo balance |
| LY-7 | El tier nunca desciende automáticamente en V1 (solo ascenso) |
| LY-8 | Saldo único y transversal entre todas las propiedades |
| LY-9 | Redención: debita balance, valida saldo suficiente, registra transacción `redeem` |
| LY-10 | Idempotencia: una sola acreditación por `booking_id` |

---

## 2. Infraestructura

### Puertos y base de datos

| Recurso | Valor |
|---------|-------|
| Puerto servicio | **3009** |
| Puerto DB (docker) | **5440** |
| Nombre DB | `loyalty_db` |
| Volumen docker | `loyalty_data` |

Sin colisiones con existentes: property 3001/5432, rate 3002/5433, booking 3004/5434, front-desk 3005/5435, housekeeping 3006/5436, billing 3007/5437, user 3003/5438, channel-manager 3008/5439.

### Variables de entorno

```
NODE_ENV=development
PORT=3009
DATABASE_URL=postgresql://hotelsync:loyalty_dev@localhost:5440/loyalty_db
AUTH_JWT_SECRET=<mismo que el resto de servicios, min 32 chars>
BOOKING_SERVICE_URL=http://booking-service:3004/v1
BOOKING_SERVICE_KEY=<service key de booking>
USER_SERVICE_URL=http://user-service:3003/v1
USER_SERVICE_KEY=<service key de user-service>
RABBITMQ_URL=amqp://rabbitmq:5672
```

---

## 3. Modelo de datos

### Tablas (espejo de ER §5.8, adaptadas a cuentas verificadas)

**`loyalty_accounts`**
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| account_id | UUID | PK, default gen_random_uuid() |
| user_id | UUID | UNIQUE, NOT NULL, referencia externa a user-service |
| tier | VARCHAR(20) | NOT NULL, default 'silver', CHECK en ('silver','gold','platinum') |
| points_balance | INTEGER | NOT NULL, default 0, CHECK >= 0 |
| created_at | TIMESTAMPTZ | NOT NULL, default now() |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-update |

Índice: UNIQUE en `user_id`.

**`points_transactions`**
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| transaction_id | UUID | PK, default gen_random_uuid() |
| user_id | UUID | NOT NULL, referencia externa |
| type | VARCHAR(10) | NOT NULL, CHECK en ('earn','redeem') |
| points | INTEGER | NOT NULL, CHECK > 0 |
| booking_id | UUID | NULLABLE, UNIQUE cuando type='earn' |
| reason | VARCHAR(200) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, default now() |

Índices: `(user_id, created_at DESC)`, `(booking_id) WHERE booking_id IS NOT NULL`.

**`event_outbox`** (patrón estándar HotelSync)
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| event_id | UUID | PK |
| event_type | VARCHAR(50) | NOT NULL |
| payload | JSONB | NOT NULL |
| status | VARCHAR(20) | NOT NULL, default 'pending' |
| attempts | INTEGER | NOT NULL, default 0 |
| created_at | TIMESTAMPTZ | NOT NULL, default now() |
| sent_at | TIMESTAMPTZ | NULLABLE |

Índice: `(status, created_at)`.

---

## 4. API REST

Prefijo: `/v1/loyalty`

### Endpoints autenticados (JWT del huésped)

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/me/loyalty` | Cuenta de loyalty del usuario logueado: tier, balance, últimas 10 transacciones |
| POST | `/redeem` | Canjear puntos. Body: `{points: number, reason: string}` |

### Endpoints de staff/admin (JWT con role ADMIN o MANAGER)

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/users/:userId/loyalty` | Consultar cuenta de cualquier huésped |
| POST | `/points` | Ajuste manual de puntos (admin). Body: `{user_id, points, reason, booking_id?}` |

### Endpoint público

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/levels` | Tabla de tiers: nombre, multiplicador, umbral mínimo |

### Health

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/health` | Status + timestamp |

---

## 5. Flujo de eventos (RabbitMQ)

### Consumer

| Propiedad | Valor |
|-----------|-------|
| Exchange | `hotelsync.events` (topic) |
| Cola | `loyalty.points` (durable) |
| Routing key | `booking.completed` |
| Prefetch | 1 |
| Ack | Manual, tras procesar OK |
| Error | `nack` + requeue |

### Handler — lógica paso a paso

1. Recibe `{booking_id, physical_room_number}`.
2. REST `GET {BOOKING_SERVICE_URL}/bookings/:booking_id` con service key.
   - 404 → ack (no acreditamos por reserva inexistente).
   - 502/503 → nack + reintento.
3. Si `booked_by_user_id` es `null` → log informativo, ack (reserva guest).
4. REST `GET {USER_SERVICE_URL}/users/:user_id` con service key para verificar cuenta activa.
   - 404 → ack (cuenta no existe, no acreditamos).
   - Inactiva → ack + log warn.
   - 502/503 → nack + reintento.
5. Transacción Prisma:
   - Buscar `LoyaltyAccount` por `user_id`. Si no existe → crear con tier `silver`, balance 0.
   - Verificar idempotencia: si ya existe `PointsTransaction` con ese `booking_id` → retorno temprano.
   - Calcular puntos: `floor(total_amount × multiplicador(tier_actual))`.
   - Insertar transacción `earn` con `booking_id`.
   - Incrementar `points_balance`.
   - Recalcular tier por nuevo balance (ascenso automático).
6. Ack.

### Verificación de cuenta — user-service

El documento §4.8 dice "comunicación asíncrona" para Loyalty, pero user-service hoy no publica eventos. Para V1 la verificación es REST síncrono en el momento del earn (mismo patrón que housekeeping verifica staff activo vía REST). Agregar broker + outbox a user-service queda como mejora futura.

---

## 6. Comunicación entre servicios

| Dirección | Protocolo | Uso |
|-----------|-----------|-----|
| Front Desk → Loyalty | RabbitMQ `booking.completed` | Disparador de acreditación |
| Loyalty → Booking | REST `GET /v1/bookings/:id` | Obtener `booked_by_user_id`, `hotel_id`, `total_amount` |
| Loyalty → User-service | REST `GET /users/:id` | Verificar cuenta activa + obtener email/name |

Sin FKs entre bases. Referencias por UUID externo (`user_id`, `booking_id`).

---

## 7. Autenticación y autorización

- Verificación local de JWT HS256 con `AUTH_JWT_SECRET` compartido (mismo patrón que housekeeping/billing: `lib/auth.ts`).
- `GET /me/loyalty` y `POST /redeem` → cualquier usuario autenticado, scope propio.
- `GET /users/:userId/loyalty` y `POST /points` → requiere role `ADMIN` (global) o `MANAGER` (scope hotel, aunque loyalty es transversal a hotel).
- Sin auth → 401 con `{error: "Unauthorized"}`.

---

## 8. Estructura de archivos

```
services/loyalty-service/
├── package.json
├── tsconfig.json
├── Dockerfile
├── jest.config.js
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── loyalty.ts          ← /me/loyalty, /redeem
│   │   ├── admin.ts            ← /users/:id/loyalty, /points
│   │   └── levels.ts           ← /levels
│   ├── controllers/
│   │   ├── loyalty.controller.ts
│   │   ├── admin.controller.ts
│   │   └── levels.controller.ts
│   ├── services/
│   │   └── loyalty.service.ts  ← lógica de negocio principal
│   ├── validators/
│   │   ├── loyalty.ts          ← Zod schemas
│   │   └── common.ts
│   ├── middleware/
│   │   ├── error-handler.ts    ← AppError centralizado
│   │   ├── auth.ts             ← verificación JWT local
│   │   └── validate.ts         ← Zod middleware
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── broker.ts           ← conexión RabbitMQ + consume
│   │   ├── consumer.ts         ← handler booking.completed
│   │   ├── outbox.ts           ← dispatcher (si publica eventos)
│   │   ├── booking-client.ts   ← REST a booking-service
│   │   ├── user-client.ts      ← REST a user-service
│   │   └── constants.ts        ← tiers, multiplicadores, umbrales
│   └── types/
│       └── index.ts
└── tests/
    ├── services/
    │   └── loyalty.service.test.ts
    ├── controllers/
    │   └── loyalty.controller.test.ts
    └── consumer/
        └── loyalty.consumer.test.ts
```

Dependencias: `express`, `zod`, `@prisma/client`, `amqplib`.

---

## 9. Seed

3 cuentas demo con `user_id` inventados (referencias externas a user-service):
- **Silver:** balance 500 pts, 3 transacciones earn.
- **Gold:** balance 2500 pts, 6 transacciones earn.
- **Platinum:** balance 7200 pts, 10 transacciones earn + 2 redeem.

---

## 10. Cambios en archivos raíz

### `package.json`

Agregar scripts:
```json
"dev:loyalty": "npm run dev --workspace=services/loyalty-service",
"migrate:loyalty": "npm exec --workspace=services/loyalty-service -- prisma migrate dev",
"seed:loyalty": "npm run seed --workspace=services/loyalty-service"
```

### `docker-compose.yml`

Agregar servicios:
- `loyalty-db`: postgres:16-alpine, puerto 5440:5432, volumen `loyalty_data`.
- `loyalty-service`: build desde `services/loyalty-service/Dockerfile`, puerto 3009, env vars según sección 2, depends_on de `loyalty-db`, `booking-service`, `user-service`, `rabbitmq`.

### Documentación

- `ARCHITECTURE.md`: agregar Loyalty a tabla de servicios, puertos y diagrama de comunicación.
- `API.md`: documentar endpoints.
- `README.md`: actualizar lista de servicios y comandos.

---

## 11. Tests

### Unit tests (Jest)

**loyalty.service.test.ts:**
- Earn con multiplicador plata (×1.0) — verifica cálculo exacto.
- Earn con multiplicador oro (×1.25) — verifica cálculo.
- Earn con multiplicador platino (×1.50) — verifica cálculo.
- Ascenso automático de tier tras earn (plata→oro, oro→platino).
- Sin descenso automático de tier.
- Idempotencia: dos earns con el mismo `booking_id` → solo uno acredita.
- Redeem con saldo suficiente → debita correctamente.
- Redeem con saldo insuficiente → AppError 400.
- Redeem con cuenta inexistente → AppError 404.

**loyalty.consumer.test.ts:**
- `booking.completed` con booking que tiene `booked_by_user_id` → acredita.
- `booking.completed` con booking sin `booked_by_user_id` (guest) → no acredita.
- Replay del mismo `booking.completed` → no duplica.
- Booking service responde 404 → no acredita, ack.
- Booking service responde 502 → nack, reintenta.
- User-service responde inactivo → no acredita, ack.

**loyalty.controller.test.ts:**
- Validación Zod (400 con body inválido).
- 401 sin token.
- 403 para endpoint admin sin role.

---

## 12. Orden de ejecución sugerido

1. Scaffold del servicio (package.json, tsconfig, Dockerfile, .env.example).
2. Prisma schema + migración + generate.
3. Implementar service layer + validators + tests unitarios.
4. Implementar controllers + routes.
5. Implementar booking-client + user-client.
6. Implementar consumer + broker + tests de consumer.
7. Compose + scripts raíz + .env por servicio.
8. Docs (ARCHITECTURE.md, API.md, README.md).
9. Seed + verificación end-to-end: checkout → booking.completed → puntos acreditados.
10. Split `hotelsync-loyalty` + Neon `loyalty_db` + push por hash.

---

## 13. Decisiones pendientes para V2

- Eventos desde user-service (`user.registered`, `user.account_deactivated`) para cache local en Loyalty en lugar de REST síncrono.
- Acreditación retroactiva para guests que se registran después de la estancia.
- Evento `loyalty.tier_upgraded` para Analytics.
- Expiración de puntos por antigüedad.
