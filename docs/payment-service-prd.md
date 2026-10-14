# PRD: Payment Service (Pasarela de Pago)

> Estado: aprobado para construcción. Decisión registrada 2026-10-14: si el pago en
> línea falla, la reserva queda `pending` con `payment_status=PENDING` para reintentar.
> No hay cancelación automática.

## 1. Visión general

Nuevo microservicio encargado de procesar, registrar y conciliar los pagos de las
reservas en HotelSync. Dos flujos:

- **Pago en línea (Pay Now):** el huésped paga con tarjeta (simulada) al crear la
  reserva en la web.
- **Pago en destino (Pay at Reception):** la reserva nace `confirmed` con saldo
  pendiente; el huésped paga en el front desk (efectivo o datáfono).

## 2. Historias de usuario

- Como **huésped**, al finalizar mi reserva quiero elegir entre pagar ahora con
  tarjeta o pagar al llegar, para tener flexibilidad.
- Como **huésped**, si pago en línea quiero un formulario seguro (simulado) y
  confirmación inmediata.
- Como **recepcionista**, quiero ver qué huéspedes deben su estancia y registrar un
  pago manual (efectivo/datáfono) antes de entregar la llave o al check-out.

## 3. Flujos técnicos (eventos RabbitMQ, exchange `hotelsync.events`)

### Flujo A — Pago en línea

1. Front crea la reserva en booking-service → nace `pending` con
   `payment_status=PENDING`, `payment_method_preference=ONLINE`.
2. Front llama a `POST /v1/checkout` con `booking_id` + tarjeta.
3. payment-service verifica el total contra booking-service, autoriza en la
   pasarela simulada y persiste la transacción (idempotente por `booking_id`).
4. Emite `payment.completed` vía outbox (`pending` → `sent`).
5. booking-service consume `payment.completed` y marca la reserva `confirmed` + `PAID`
   (con versión optimista; 409 en conflicto).

**Fallo de pago:** la tarjeta rechazada devuelve 402, la transacción queda `FAILED`
y la reserva sigue `pending`/`PENDING` para reintentar. Sin cancelación automática.

### Flujo B — Pago en recepción

1. Front crea la reserva con `payment_method_preference=RECEPTION` → nace `confirmed`
   con `payment_status=PENDING` (compatible con la regla "Front Desk exige confirmed").
2. El staff llama a `POST /v1/admin/payments` (canal `FRONT_DESK`) para saldar.
3. Se emite `payment.completed` igual que en el Flujo A.

## 4. Contratos del servicio

Base: `http://localhost:3010/v1` (DB propia `payment_db` en `:5441`).

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/checkout` | Bearer huésped | Paga una reserva con tarjeta simulada |
| GET | `/checkout/:bookingId` | Bearer | Estado de pago de una reserva |
| POST | `/admin/payments` | Bearer staff | Registra pago manual (efectivo/datáfono) |

Evento emitido: `payment.completed` `{ booking_id, transaction_id, amount, currency }`.

### Reglas inviolables (heredadas del monorepo)

- Flujo Route → Controller → Service. Zod en el borde. Errores `{error}` con
  `AppError(status)`. Sin detalles internos.
- DB por servicio. Sin FKs entre servicios: `booking_id`/`user_id` son UUID lógicos.
- `AUTH_JWT_SECRET` **idéntico** al de user-service (un secreto distinto rompe la
  verificación con 401 — verificado en loyalty 2026-10-14).
- Sin `RABBITMQ_URL` la operación sigue y el outbox queda `pending`.
- `POST` de cobro nunca se reintenta en el cliente; la idempotencia vive en el
  servidor (`booking_id` único: un segundo cobro de la misma reserva devuelve la
  transacción existente, nunca un doble cargo).

## 5. Esquema base (`prisma/schema.prisma`)

```prisma
model PaymentTransaction {
  transaction_id String   @id @default(uuid()) @db.Uuid
  booking_id     String   @unique @db.Uuid // idempotencia: una reserva = un cobro
  user_id        String?  @db.Uuid
  amount         Decimal  @db.Decimal(10, 2)
  currency       String   @default("COP") @db.VarChar(10)
  method         String   @db.VarChar(20) // CREDIT_CARD | CASH | TRANSFER | TERMINAL
  status         String   @db.VarChar(20) // COMPLETED | FAILED | REFUNDED
  channel        String   @db.VarChar(20) // WEB | FRONT_DESK
  failure_reason String?  @db.VarChar(255)
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@map("payment_transactions")
}
```

## 6. Cambios en el monorepo existente

- **Infra:** `docker-compose.yml` → `payment-db` (`5441:5432`) + `payment-service`
  (`3010:3009`→`3010`) + volumen `payment_data`.
- **booking-service:** `schema.prisma` (campos `payment_status`, `payment_method_preference`
  en `Booking`) + nuevo consumidor `payment.completed` en `src/lib/` (no existe
  `consumer.ts`: crearlo siguiendo `loyalty-service/src/lib/consumer.ts`).
- **booking-service NO cambia su `status`:** no se agrega ningún estado nuevo a la
  reserva (`pending → confirmed` se mantiene; front-desk y check-in único intactos).
- **Front:** rewrite `/api/payments/:path*` → `:3010/v1/:path*`; `api-client.ts`
  (`processWebPayment`, `processFrontDeskPayment`); `BookingForm.tsx` (selector de
  método + form de tarjeta mock); `reservas/nueva/page.tsx` (orquesta crear →
  pagar → confirmar); `ReceptionBoard.tsx` (badge "Pago pendiente");
  `admin/recepcion/page.tsx` (modal "Registrar pago").
- **Raíz:** scripts `dev:payment`, `migrate:payment` (+ `seed:payment` si aplica).

## 7. Orden de construcción

1. booking-service: migración (`payment_status`, `payment_method_preference`) sin
   romper reservas existentes (default `PENDING`/`ONLINE` o nullable + backfill).
2. Cascarón payment-service en Node + Docker + DB.
3. Consumidor `payment.completed` en booking + evento en payment (outbox).
4. Front público (reserva con método de pago).
5. Panel recepcionista (badge + modal de pago manual).
6. Verificación: `tsc --noEmit`, `jest`, `next build`, flujo A y B de punta a punta.
