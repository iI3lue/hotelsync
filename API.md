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

### Listar Habitaciones Físicas de un Hotel

```
GET /v1/hotels/:hotelId/rooms
```

**Response (200):** Lista las unidades físicas del hotel, incluyendo el nombre y el ID del tipo asociado.

```json
[
  {
    "physical_room_id": "f1b2c3d4-e5f6-4890-abcd-ef1234567890",
    "hotel_id": "eb74238a-9837-4e51-9f7b-34085e0b1be3",
    "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
    "room_number": "101",
    "available_from": "2026-10-02T00:00:00.000Z",
    "is_active": true,
    "roomType": {
      "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
      "name": "Standard Double"
    }
  }
]
```

---

### Crear Habitación Física

```
POST /v1/hotels/:hotelId/rooms
Content-Type: application/json
```

**Request body:**

```json
{
  "room_type_id": "1da37d42-6509-419a-929a-19a190fe9fcb",
  "room_number": "101",
  "available_from": "2026-10-02"
}
```

**Response (201):** Unidad física creada. El alta y el evento de inventario se guardan en una misma transacción; R&A procesa el evento de forma idempotente y agrega la unidad durante 365 días desde su fecha de disponibilidad.

**Errors:** `401` sin Bearer de MANAGER del hotel o SUPER_ADMIN; `404` si el tipo no pertenece al hotel; `409` si el hotel ya tiene ese número de habitación.

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

**Request body (reserva anonima, sin cuenta):**
```json
{
  "hotel_id": "c1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "room_type_id": "d1b2c3d4-e5f6-4890-abcd-ef1234567890",
  "check_in": "2026-10-01",
  "check_out": "2026-10-05",
  "channel": "direct",
  "total_amount": 25500,
  "guest": { "name": "Ana", "email": "ana@example.com", "phone": "+5491112345678" }
}
```

**Reglas de validación:**
| Campo | Regla |
|-------|-------|
| `hotel_id`, `room_type_id` | UUID válido |
| `check_in`, `check_out` | Formato `YYYY-MM-DD`, `check_out` posterior a `check_in` |
| `channel` | `direct` \| `ota` \| `phone` (default `direct`) |
| `total_amount` | Debe ser >= 0 |
| `guest` | Nombre, email y teléfono requeridos |

El backend genera `guest_id` y un `manage_token` del lado servidor (nunca se
acepta un `guest_id` del cliente). Si el request lleva Bearer, queda registrado
`booked_by_user_id`. La reserva se crea en estado `pending` y emite el evento
`booking.created` con el nombre del huésped para las llegadas.

**Response (201):** Objeto booking con `booking_id`/`guest_id` generados,
`status: "pending"` y `manage_token` (se muestra una sola vez; solo se guarda
su hash). El hash nunca se expone en ninguna respuesta. El token vence a los
30 días (`manage_token_expires_at`); vencido, lectura y cancelación devuelven
403 y hay que pedir uno nuevo a recepción.

### Mis Reservas

```
GET /v1/bookings/me   (Bearer)
```

Reservas de la cuenta: creadas con su sesión (`booked_by_user_id`) o con su
email. Une la cuenta `GUEST` opcional con reservas anónimas previas.

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
GET /v1/bookings/:id?token=<manage_token>
```

El UUID solo no autoriza: requiere Bearer de staff operativo
(`SUPER_ADMIN`, `MANAGER`, `RECEPTIONIST`) o el `manage_token` entregado en
el alta. Sin credenciales devuelve 401; con token ajeno, 403.

**Response (200):** Objeto booking (sin hash del token).

**Error (404):**
```json
{ "error": "Booking not found" }
```

---

### Confirmar Reserva (RN-1)

```
POST /v1/bookings/:id/confirm?token=<manage_token>
```

Requiere Bearer de staff operativo o el `manage_token` (el UUID solo no
autoriza). Solo transiciona `pending → confirmed`. Implementa RN-1 del PRD
de forma síncrona vía REST a Rate & Availability:

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
POST /v1/bookings/:id/cancel?token=<manage_token>
```

Mismo control de acceso que la lectura (staff o manage token).
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

**Response (200):** Arreglo de llegadas con `guest_name` proyectado desde
`booking.created`.

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
  "physical_room_number": "101",
  "physical_room_id": "f1b2c3d4-e5f6-4890-abcd-ef1234567890"
}
```

`physical_room_id` es el UUID externo del catálogo de Property (sin FK entre
bases) y es opcional: recepción puede seguir operando solo con el número.

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

Setea `checked_out_at` y emite `checkout.completed` (lo consumen
Housekeeping y Billing) y `booking.completed` (lo consumirá Loyalty).

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

## Housekeeping Service (puerto 3006)

Consume `checkout.completed` de RabbitMQ (cola `housekeeping.tasks`): marca la
habitación como sucia y crea la tarea de limpieza automáticamente (HK-2).
Requiere `BOOKING_SERVICE_URL` (default `http://localhost:3004/v1`) para
resolver el hotel de la reserva.

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "service": "housekeeping-service" }
```

---

### Tareas de Limpieza

```
GET /v1/tasks?hotel_id=<uuid>&status=<pending|assigned|in_progress|done|cancelled>
GET /v1/tasks/mine?status=<...>                                    (Bearer)
PUT /v1/tasks/:id/assign    (Bearer HOUSEKEEPER|MANAGER|SUPER_ADMIN)
PUT /v1/tasks/:id/start     (Bearer HOUSEKEEPER|MANAGER|SUPER_ADMIN)
PUT /v1/tasks/:id/complete  (Bearer HOUSEKEEPER|MANAGER|SUPER_ADMIN)
```

**PUT /v1/tasks/:id/assign body:**
```json
{ "assigned_to_user_id": "11111111-2222-4333-8444-555555555555" }
```

La asignación guarda el UUID de la cuenta (no un nombre libre) y `/mine`
filtra por el usuario del JWT. Al asignar se verifica contra user-service que
sea personal activo de limpieza del mismo hotel (sin `USER_SERVICE_URL` se
omite la validación remota). Completar exige ser el asignado o manager del
hotel, deja la habitación en `clean` en la misma transacción (HK-4) y registra
`completed_by_user_id` + `completed_at`. `checkout.completed` propaga
`physical_room_id` y Housekeeping lo persiste en estado y tarea.
Transiciones válidas: `pending → assigned|in_progress|cancelled`,
`assigned → in_progress|cancelled`, `in_progress → done|cancelled`.

---

### Habitaciones

```
GET /v1/rooms/status?hotel_id=<uuid>
PUT /v1/rooms/:id/status
```

**PUT body:**
```json
{ "status": "dirty" | "cleaning" | "clean" | "maintenance" }
```

**Response (200):** Objeto `room_status` con su estado (HK-1).

---

## Billing Service (puerto 3007)

Consume `booking.created` (abre el folio con el cargo de habitación) y
`checkout.completed` (cierra el folio y emite la factura) de RabbitMQ
(cola `billing.folio`). Publica `folio.closed` vía outbox
transaccional. Requiere `BOOKING_SERVICE_URL` y `PROPERTY_SERVICE_URL`
(país del hotel para la tasa fiscal, BL-4).

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "service": "billing-service" }
```

---

### Folios

```
GET /v1/folios?hotel_id=<uuid>&status=<open|closed>
GET /v1/folios/:id
GET /v1/folios/guest/:id
POST /v1/charges
POST /v1/folios/:id/close
```

**POST /v1/charges body:**
```json
{
  "folio_id": "f1c2c3d4-e5f6-4890-abcd-ef1234567890",
  "concept": "Minibar",
  "amount": 15000,
  "category": "minibar" | "spa" | "restaurant" | "room" | "other"
}
```

**Reglas de negocio:**
- Solo se agregan cargos al folio abierto (409 si está cerrado)
- El cierre es idempotente: si ya existe factura la devuelve sin duplicar
- Cierre + factura + evento en una sola transacción (rollback conjunto)

**Response POST /v1/folios/:id/close (200):** Objeto `invoice` con
`subtotal`, `tax_rate`, `tax_amount`, `total`, `currency` y `country`.

---

### Facturas

```
GET /v1/invoices?hotel_id=<uuid>
GET /v1/invoices/:id
```

**Response (200):** Factura con su folio y cargos. Tasas por país (BL-4,
tabla simplificada): CO 19%, AR 21%, CL 19%, MX 16%, ES 21%, resto 0%.

---

## User Service (puerto 3003)

Auth HS256 con `AUTH_JWT_SECRET` compartido entre user-service y los
servicios que verifican. Access de 8h (`role`, `hotel_id`, `scope` en claims)
+ refresh opaco de 7d con rotación (solo se guarda su hash).

### Registro y login

```
POST /v1/auth/register
POST /v1/auth/login
Content-Type: application/json
```

**Request register:**
```json
{ "email": "huesped@example.com", "password": "Secret123!", "name": "Ana" }
```

**Response (201 register / 200 login):** `access_token`, `refresh_token`,
`token_type: "Bearer"`, `expires_in`, `user` (sin hash) y `assignment`
(rol + hotel vigentes). El registro crea cuenta `GUEST` activa; la
verificación por correo queda pendiente (sin proveedor de mail).

**Error (409):** email ya registrado. **Error (401):** credenciales inválidas.

### Login federado (Google vía Auth0)

```
POST /v1/auth/federated
Content-Type: application/json
```

**Request body:** `{ "provider": "auth0", "id_token": "<ID token de Auth0>" }`

El servicio verifica firma, emisor y audiencia contra el JWKS de Auth0
(`AUTH0_DOMAIN`/`AUTH0_CLIENT_ID`). Si la identidad externa ya está vinculada,
reutiliza la cuenta; si es nueva, crea cuenta `GUEST` (sin contraseña
utilizable) y la vincula en `external_identities`. Nunca vincula por email
coincidente: un email con contraseña devuelve 409.

**Response (201):** mismo par access + refresh que el login.

**Errors:** `503` si Auth0 no está configurado; `401` con token inválido;
`400` si la identidad no trae email.

### Refresh y logout

```
POST /v1/auth/refresh
POST /v1/auth/logout
```

**Request body:** `{ "refresh_token": "<opaco>" }`

**Response refresh (200):** par nuevo; el refresh usado queda revocado.
**Response logout (200):** `{ "logged_out": true }` (idempotente).

### Perfil propio

```
GET /v1/users/me        (Bearer)
PATCH /v1/users/me      (Bearer, solo name/phone)
```

### Administración de personal (SUPER_ADMIN)

```
POST /v1/admin/users                       (Bearer SUPER_ADMIN)
GET /v1/admin/users?hotel_id=&role=        (Bearer SUPER_ADMIN o MANAGER)
PATCH /v1/admin/users/:id                  (Bearer SUPER_ADMIN)
```

**Request alta:**
```json
{ "email": "recep@example.com", "name": "Recep", "role": "RECEPTIONIST", "hotel_id": "<uuid>" }
```

Roles de hotel (`MANAGER`, `RECEPTIONIST`, `HOUSEKEEPER`) exigen `hotel_id`;
`SUPER_ADMIN` y `GUEST` son globales. Sin `password` se genera una temporal
devuelta como `initial_password` una sola vez. Un MANAGER lista solo su hotel;
no puede desactivarse a sí mismo un SUPER_ADMIN.

---

## Errores Comunes

| HTTP Code | Significado | Ejemplo |
|-----------|-------------|---------|
| 400 | Request inválido / validación fallida | Campo faltante, valor fuera de rango |
| 401 | Falta el Bearer o es inválido/expirado | Alta de habitación sin login |
| 403 | Rol o alcance insuficiente | Manager de otro hotel |
| 404 | Recurso no encontrado | Hotel o inventario inexistente |
| 409 | Conflicto de estado o concurrencia | Confirmar reserva no-pending, doble check-in |
| 502 | Servicio dependiente no disponible | Booking Service caído (solo Front Desk) |
| 500 | Error interno del servidor | Error de base de datos |

Todos los errores retornan:
```json
{ "error": "mensaje descriptivo" }
```
