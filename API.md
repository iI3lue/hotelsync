# HotelSync — Guía de Endpoints

Todos los endpoints usan prefijo `/v1/`. Las respuestas exitosas usan HTTP 200. Los errores retornan el código adecuado con un body `{ "error": "..." }`.

---

## Property Service (puerto 3001)

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "service": "property-service" }
```

---

### Listar Hoteles

```
GET /v1/hotels
```

**Response (200):**
```json
[
  {
    "hotel_id": "eb74238a-9837-4e51-9f7b-34085e0b1be3",
    "name": "Hotel Sync Centro",
    "city": "Buenos Aires",
    "country": "Argentina",
    "timezone": "America/Argentina/Buenos_Aires",
    "roomTypes": [
      {
        "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
        "hotel_id": "eb74238a-9837-4e51-9f7b-34085e0b1be3",
        "name": "Standard Double",
        "capacity": 2,
        "base_rate": "8500",
        "amenities": ["wifi", "tv", "air_conditioning"]
      }
    ],
    "cancellationPolicies": [
      {
        "policy_id": "633155bd-6eff-49a6-bde7-5a6efe2498cd",
        "hotel_id": "eb74238a-9837-4e51-9f7b-34085e0b1be3",
        "name": "Flexible",
        "description": "Free cancellation up to 24 hours before check-in."
      }
    ]
  }
]
```

---

### Obtener Hotel por ID

```
GET /v1/hotels/:id
```

**Response (200):** Mismo formato que un elemento del listado.

**Error (404):**
```json
{ "error": "Hotel not found" }
```

---

### Crear Hotel

```
POST /v1/hotels
Content-Type: application/json
```

**Request body:**
```json
{
  "name": "Hotel Sync Costa",
  "city": "Mar del Plata",
  "country": "Argentina",
  "timezone": "America/Argentina/Buenos_Aires"
}
```

**Response (201):**
```json
{
  "hotel_id": "19c43d35-6c3e-4866-9209-e89d7fe94149",
  "name": "Hotel Sync Costa",
  "city": "Mar del Plata",
  "country": "Argentina",
  "timezone": "America/Argentina/Buenos_Aires"
}
```

**Error (400):**
```json
{ "error": "Validation failed", "details": [...] }
```

---

### Listar Tipos de Habitación de un Hotel

```
GET /v1/hotels/:id/room-types
```

**Response (200):**
```json
[
  {
    "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
    "hotel_id": "eb74238a-9837-4e51-9f7b-34085e0b1be3",
    "name": "Standard Double",
    "capacity": 2,
    "base_rate": "8500",
    "amenities": ["wifi", "tv", "air_conditioning"]
  }
]
```

---

### Crear Tipo de Habitación

```
POST /v1/room-types
Content-Type: application/json
```

**Request body:**
```json
{
  "hotel_id": "eb74238a-9837-4e51-9f7b-34085e0b1be3",
  "name": "Standard Double",
  "capacity": 2,
  "base_rate": 8500,
  "amenities": ["wifi", "tv", "air_conditioning"]
}
```

**Response (201):** Objeto room_type con `room_type_id` generado.

---

### Actualizar Tipo de Habitación

```
PUT /v1/room-types/:id
Content-Type: application/json
```

**Request body (campos opcionales):**
```json
{
  "name": "Standard Double Plus",
  "capacity": 3,
  "base_rate": 9500,
  "amenities": ["wifi", "tv", "air_conditioning", "minibar"]
}
```

**Response (200):** Objeto room_type actualizado.

---

### Obtener Política de Cancelación

```
GET /v1/hotels/:id/cancellation-policy
```

**Response (200):**
```json
[
  {
    "policy_id": "633155bd-6eff-49a6-bde7-5a6efe2498cd",
    "hotel_id": "eb74238a-9837-4e51-9f7b-34085e0b1be3",
    "name": "Flexible",
    "description": "Free cancellation up to 24 hours before check-in."
  }
]
```

---

## Rate & Availability Service (puerto 3002)

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "service": "rate-availability-service" }
```

---

### Consultar Disponibilidad

```
GET /v1/availability?room_type_id=<uuid>&date=<YYYY-MM-DD>
```

**Parámetros query:**
| Param | Requerido | Descripción |
|-------|-----------|-------------|
| `room_type_id` | Sí | UUID del tipo de habitación |
| `date` | Sí | Fecha en formato `YYYY-MM-DD` |

**Response (200):**
```json
{
  "inventory_id": "uuid",
  "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
  "date": "2026-09-14",
  "available_count": 10,
  "blocked_count": 0,
  "real_availability": 10
}
```

**Regla de negocio:** `real_availability = available_count - blocked_count`

**Error (404):**
```json
{ "error": "No inventory found for this room type and date" }
```

---

### Listar Tarifas

```
GET /v1/rates?room_type_id=<uuid>
```

**Parámetros query:**
| Param | Requerido | Descripción |
|-------|-----------|-------------|
| `room_type_id` | Sí | UUID del tipo de habitación |

**Response (200):**
```json
[
  {
    "rate_id": "uuid",
    "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
    "report_date": "2026-09-13",
    "price": "8500"
  }
]
```

---

### Crear/Actualizar Regla de Tarifa

```
PUT /v1/rate-rules
Content-Type: application/json
```

**Request body:**
```json
{
  "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
  "start_date": "2026-09-14",
  "end_date": "2026-10-14",
  "multiplier": 1.2,
  "min_stay": 2
}
```

**Reglas de validación:**
| Campo | Regla |
|-------|-------|
| `multiplier` | Debe ser > 0 |
| `min_stay` | Debe ser >= 1 |
| `start_date` | Debe ser <= `end_date` |

**Response (201):**
```json
{
  "rule_id": "uuid",
  "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
  "start_date": "2026-09-14",
  "end_date": "2026-10-14",
  "multiplier": "1.20",
  "min_stay": 2
}
```

---

### Bloquear/Desbloquear Inventario

```
POST /v1/blocks
Content-Type: application/json
```

**Request body:**
```json
{
  "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
  "date": "2026-09-14",
  "count": 3,
  "reason": "maintenance"
}
```

**Reglas de negocio:**
- El inventario debe existir para esa room_type y fecha
- `blocked_count + count <= available_count` (no se puede bloquear más de lo disponible)
- Para desbloquear, usar `count` negativo

**Response (200):**
```json
{
  "inventory_id": "uuid",
  "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
  "date": "2026-09-14",
  "available_count": 10,
  "blocked_count": 3,
  "real_availability": 7
}
```

**Error (400):**
```json
{ "error": "Cannot block more than available" }
```

---

### Reservar inventario (RN-1)

```
POST /v1/availability/reserve
Content-Type: application/json
```

Decrementa `available_count` por cada fecha del rango de forma **atómica**
(pseudo-BAC): si algún día no tiene disponibilidad suficiente, no hay ningún
cambio y retorna 409. Lo invoca Booking Service al confirmar una reserva.

**Request body:**
```json
{
  "room_type_id": "d1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "check_in": "2026-10-01",
  "check_out": "2026-10-05",
  "count": 1
}
```

**Reglas de negocio:**
- El rango debe ser válido (`check_out` posterior a `check_in`)
- `count` entero positivo (default 1)
- Si `check_out - check_in` excede el total de días disponibles, retorna 409 sin efecto

**Response (200):**
```json
{ "reserved": true, "days": 4 }
```

**Error (409):**
```json
{ "error": "Insufficient availability on 2026-10-02 for room type d1b2c3d4..." }
```

---

### Liberar inventario (RN-2)

```
POST /v1/availability/release
Content-Type: application/json
```

Incrementa `available_count` por cada fecha del rango. Lo invoca Booking
Service al cancelar una reserva `confirmed`.

**Request body:** idéntico a `/availability/reserve`.

**Response (200):**
```json
{ "released": true, "days": 4 }
```

---

## Booking Service (puerto 3004)

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "service": "booking-service" }
```

---

### Crear Reserva

```
POST /v1/bookings
Content-Type: application/json
```

**Request body:**
```json
{
  "guest_id": "b1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "hotel_id": "c1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "room_type_id": "d1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "check_in": "2026-10-01",
  "check_out": "2026-10-05",
  "channel": "direct",
  "total_amount": 25500
}
```

**Reglas de validación:**
| Campo | Regla |
|-------|-------|
| `guest_id`, `hotel_id`, `room_type_id` | UUID válido |
| `check_in`, `check_out` | Formato `YYYY-MM-DD`, `check_out` posterior a `check_in` |
| `channel` | `direct` \| `ota` \| `phone` (default `direct`) |
| `total_amount` | Debe ser >= 0 |

La reserva se crea en estado `pending` y emite el evento `booking.created`
(stub con log; RabbitMQ en Fase 2).

**Response (201):** Objeto booking con `booking_id` generado y `status: "pending"`.

**Error (400):**
```json
{ "error": "check_out must be after check_in" }
```

---

### Listar Reservas

```
GET /v1/bookings?hotel_id=<uuid>&status=<pending|confirmed|cancelled>&date=<YYYY-MM-DD>
```

Todos los filtros son opcionales. `date` filtra reservas que cubren esa fecha
(`check_in <= date <= check_out`) — usado por Front Desk para las llegadas del día.

**Response (200):** Arreglo de bookings ordenado por `check_in` ascendente.

---

### Obtener Reserva por ID

```
GET /v1/bookings/:id
```

**Response (200):** Objeto booking.

**Error (404):**
```json
{ "error": "Booking not found" }
```

---

### Confirmar Reserva (RN-1)

```
POST /v1/bookings/:id/confirm
```

Solo transiciona `pending → confirmed`. Implementa RN-1 del PRD de forma
síncrona vía REST a Rate & Availability:

1. Reserva inventario (`POST /v1/availability/reserve`) en R&A
2. Aplica `version` como bloqueo optimista (BK-4, RTA-4 del PRD): si la
   reserva cambió entre la lectura y la escritura, **libera el inventario
   reservado (compensación)** y retorna 409 para que el cliente reintente
3. Emite `booking.created` (stub con log; RabbitMQ en Fase 2)

**Response (200):** Objeto booking con `status: "confirmed"`.

**Error (409):**
```json
{ "error": "Cannot confirm booking with status cancelled" }
```

**Error (502):** Rate & Availability Service no disponible.

---

### Cancelar Reserva (RN-2)

```
POST /v1/bookings/:id/cancel
```

Transiciona `pending|confirmed → cancelled` y emite `booking.cancelled`.
Implementa RN-2 del PRD: si la reserva estaba `confirmed`, libera el
inventario en R&A (`POST /v1/availability/release`) antes de cancelar.

**Response (200):** Objeto booking con `status: "cancelled"`.

**Error (409):**
```json
{ "error": "Booking is already cancelled" }
```

---

## Front Desk Service (puerto 3005)

Opera contra Booking Service vía REST (sin FK entre bases, solo UUID).
Requiere `BOOKING_SERVICE_URL` (default `http://localhost:3004/v1`).

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "service": "front-desk-service" }
```

---

### Llegadas del Día

```
GET /v1/arrivals?hotel_id=<uuid>&date=<YYYY-MM-DD>
```

Retorna las reservas `confirmed` del hotel que cubren la fecha (delegado a
Booking Service).

**Response (200):** Arreglo de bookings.

---

### Check-in

```
POST /v1/check-in
Content-Type: application/json
```

**Request body:**
```json
{
  "booking_id": "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "physical_room_number": "101"
}
```

**Reglas de negocio:**
- La reserva debe existir en Booking Service y estar `confirmed` (si no, 404/409)
- Sin doble check-in por reserva (409 si ya existe asignación)

**Response (201):** Objeto `room_assignment` con `checked_in_at`.

---

### Check-out

```
POST /v1/check-out
Content-Type: application/json
```

**Request body:**
```json
{
  "booking_id": "a1b2c3d4-e5f6-4890-abcd-ef1234567890"
}
```

Setea `checked_out_at` y emite `checkout.completed` (lo consumirán
Housekeeping y Billing en Fase 2).

**Response (200):** Objeto `room_assignment` cerrado.

**Error (404):** Sin check-in activo para esa reserva.

---

### Incidencias del Huésped

```
GET /v1/incidents?booking_id=<uuid>
POST /v1/incidents
PATCH /v1/incidents/:id
```

**POST body:**
```json
{
  "booking_id": "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "description": "Canilla goteando en el baño"
}
```

**PATCH body:** `{ "status": "open" | "in_progress" | "resolved" }`

---

## Errores Comunes

| HTTP Code | Significado | Ejemplo |
|-----------|-------------|---------|
| 400 | Request inválido / validación fallida | Campo faltante, valor fuera de rango |
| 404 | Recurso no encontrado | Hotel o inventario inexistente |
| 409 | Conflicto de estado o concurrencia | Confirmar reserva no-pending, doble check-in |
| 502 | Servicio dependiente no disponible | Booking Service caído (solo Front Desk) |
| 500 | Error interno del servidor | Error de base de datos |

Todos los errores retornan:
```json
{ "error": "mensaje descriptivo" }
```
