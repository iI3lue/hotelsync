# HotelSync — Cambios en Housekeeping y Billing respecto al documento de arquitectura

Documento de contraste entre lo implementado en `services/housekeeping-service` y
`services/billing-service` y el documento de arquitectura
(`docs/HotelSync_Arquitectura.docx`, secciones 4.6, 4.7, 5.6, 5.7).
Fecha: 2026-09-27.

---

## 1. Qué es columna y qué no

**Columnas** = lo que existe físicamente en PostgreSQL (verificable con `\d`
en `psql` o Adminer). Todo lo listado en las secciones 2 y 3 lo es.

**No son columnas** las relaciones navegables que aparecen anidadas en el JSON
de la API o en Prisma Studio:

- Un folio devuelto por la API trae `"charges": [...]` e `"invoice": {...}`
  adentro, pero en la tabla `folios` no existe ninguna columna `charges` ni
  `invoice`. Esos objetos los arma Prisma al responder (con `include`).
- Un charge devuelto por la API trae `"folio": {...}` adentro, pero en la
  tabla `charges` solo existe `folio_id` (un UUID suelto). No hay ningún
  objeto guardado en disco.
- Regla práctica: si se ve en **Adminer** (`\dt` / `\d`), es columna real.
  Si se ve solo en **Prisma Studio** o en el **JSON de la API**, es una
  relación.

---

## 2. Billing: motivo de cada campo y tabla extra

Columnas reales de `folios`: `folio_id`, `booking_id`, `hotel_id`,
`guest_id`, `currency`, `total`, `status`, `created_at`, `updated_at`.
Columnas reales de `charges`: `charge_id`, `folio_id`, `concept`, `amount`,
`category`, `added_at`.

| Campo / tabla | Estado frente al doc | Motivo |
|---|---|---|
| Tabla `invoices` | No está en el doc | BL-2 exige *factura final* con subtotal, impuesto, total, moneda y país. El doc ordena generarla pero no dice dónde persistirla; sin tabla, la factura existiría solo como evento volátil. La tabla es el documento fiscal guardado |
| `folios.hotel_id` | No lo nombra el doc | Filtrar folios por hotel y resolver la tasa fiscal sin llamar a Booking en cada consulta |
| `folios.guest_id` | Exigido por el doc | El propio doc define `GET /folios/guest/{id}`; sin esta columna ese endpoint sería imposible |
| `folios.status` (`open`/`closed`) | Exigido por el doc | BL-2 y `POST /folios/{id}/close` lo requieren: sin estado no hay forma de impedir cargos en un folio ya cerrado ni de hacer el cierre idempotente |
| `folios.created_at` / `updated_at` | Patrón del doc | El doc usa `updated_at NOT NULL` (HK) y `added_at` (charges). Auditoría estándar |
| `folios.total`, `folios.currency` | Literales del doc §5.7 | Sin cambios |
| `charges.concept`, `charges.amount`, `charges.added_at` | Literales del doc §5.7 | Sin cambios |
| `charges.category` | Extra puro | Distinguir habitación/minibar/spa/restaurante para reportes. El doc mete todo en `concept` |
| `charges` / `invoice` dentro del JSON de folio | Relaciones, no columnas | Las arma Prisma con `include`; en disco solo vive `folio_id` |
| `folio {}` dentro del JSON de charge | Relación, no columna | En disco solo vive `folio_id` |

---

## 3. Housekeeping: motivo de cada campo extra

Columnas reales de `room_status`: `room_status_id`, `hotel_id`,
`room_number`, `status`, `assigned_to` (nullable), `updated_at`.
Columnas reales de `cleaning_history`: `history_id`, `room_status_id`,
`booking_id` (UNIQUE), `hotel_id`, `room_number`, `status`, `assigned_to`
(nullable), `created_at`, `updated_at`.

| Campo | Estado frente al doc | Motivo |
|---|---|---|
| `room_status.hotel_id` + `room_number` | El doc usa un solo `room_id` | La cadena tiene muchos hoteles y el "101" se repite en todos. Con un solo identificador no se puede operar por hotel. El doc no tiene filtro por hotel en HK; esa es su limitación |
| `room_status.assigned_to` nullable | El doc lo pide NOT NULL | Al crear el estado sucio automáticamente en el checkout todavía no hay personal asignado. NOT NULL obligaría a inventar un valor falso; la regla real ("requerido al asignar") vive en la API |
| `cleaning_history.booking_id` UNIQUE | No está en el doc | Idempotencia: sin esto, si RabbitMQ redeliverea `checkout.completed`, se crean tareas duplicadas. Es la clave que garantiza "un checkout = una tarea" |
| `cleaning_history.hotel_id`, `room_number`, `status`, `assigned_to`, timestamps | No están en el doc | El doc no modela el ciclo de vida de la tarea (`pending → assigned → in_progress → done`) ni filtros por hotel; estos campos son los que lo hacen posible |
| `room_status.status` (CHECK `dirty\|cleaning\|clean\|maintenance`), `updated_at` | Literales del doc §5.6 | Sin cambios |

---

## 4. Decisiones que se mantienen pendientes

1. `assigned_to` nullable en `room_status` (desviación mínima documentada arriba).
2. Tabla `invoices` como extensión necesaria de BL-2.
3. Billing consume además `booking.created` (el doc §4.7 solo lista
   `checkout.completed`): sin apertura temprana no hay folio donde acumular
   cargos durante la estancia (BL-1).
4. Sin FKs entre bases (§5.7 las sugiere, §5.10 las prohíbe: UUID sin joins).
   Manda §5.10.
5. `bookings.status = 'completed'` sin setter hasta la fase de Loyalty.
