# PRD — Channel Manager

**Product Requirements Document (dedicado)**

| Campo | Detalle |
| --- | --- |
| Producto | HotelSync — Microservicio Channel Manager (nuevo) |
| Tipo | Integración bidireccional con un **proveedor simulado** (v0.1); OTAs reales fuera de alcance |
| Estado | Propuesta v0.1 — requiere validación del equipo y del profesor |
| Documentos relacionados | `docs/HotelSync_PRD.md` (§canales externos, O1), `docs/plan-microservicio-usuarios.md`, `ARCHITECTURE.md`, `API.md` |
| Código relevante | `services/booking-service/src/services/booking.service.ts`, `services/booking-service/src/lib/events.ts`, `services/front-desk-service/src/lib/consumer.ts`, `services/billing-service/src/lib/consumer.ts` |

> Convención del repo: base de datos por servicio, referencias entre servicios solo por UUID (sin FK ni joins), Route → Controller → Service, Zod en el borde, errores `{error}` con `AppError(status)`.

---

## 1. Resumen ejecutivo

El Channel Manager conecta HotelSync con los canales de venta en **ambas direcciones**:

- **Entrante**: las reservas creadas en un canal entran a HotelSync como reservas de ese canal.
- **Saliente**: la disponibilidad y las tarifas de HotelSync se publican hacia los canales para que no vendan lo que no hay.

En **v0.1 ambos lados operan contra un proveedor simulado** (doble de pruebas con sandbox local, sin red externa real). Las integraciones con OTAs reales (Booking.com, Expedia, Airbnb y similares) quedan **fuera de alcance** hasta cumplir el criterio de salida de R3.

## 2. Problema

1. **Canales ciegos**: hoy no hay forma de ingresar una reserva originada fuera de la web propia ni de informar a terceros cuánto queda libre.
2. **Inconsistencia de eventos verificada** (relevada en código el 2026-10-06): `booking.created` se publica cuando la reserva queda `pending` (`booking.service.ts:105`), pero Front Desk la proyecta como `confirmed` (`front-desk-service/src/lib/consumer.ts:46,56`) y Billing abre el folio contra ella (`billing-service/src/lib/consumer.ts:24`). La semántica errónea está además **fijada en tests** (`consumer.test.ts:18` en Front Desk, `consumer.test.ts:11` en Billing). Si el Channel Manager empieza a inyectar reservas OTA sobre este contrato, multiplica el daño: folios y llegadas "confirmadas" sin inventario reservado.
3. **Ambigüedad previa**: el stub `booking-service/src/lib/events.ts:6` dice que "Channel Manager lo publica (reservas OTA)", sugiriendo publicación directa al exchange. Este PRD lo reemplaza (ver §6.4).

## 3. Objetivos y métricas

| # | Objetivo | Métrica de éxito |
| --- | --- | --- |
| O1 | Cero sobreventa multicanal | 0 confirmaciones (directas + de canal) por encima del inventario vendible de R&A *(provisional: ver §10)* |
| O2 | Toda reserva del canal visible y operable | 100% de reservas del canal consultables por staff del hotel y con `manage_token` para el huésped |
| O3 | Latencia de sincronización acotada | p95 < 60 s entre confirmación interna y publicación a canales *(provisional: ver §10)* |
| O4 | Trazabilidad punta a punta | Toda reserva del canal lleva `channel: "ota:<nombre>"` + id de reserva externa, buscable por ambos |

## 4. Alcance

### 4.1 In-scope

- Adaptadores por canal contra el **proveedor simulado** (primero uno; el contrato del adaptador debe servir luego para una OTA real sin cambiar el núcleo).
- Ingesta de reservas del canal vía **API REST de Booking** con el contrato interno protegido de §5.4 (no el `POST /v1/bookings` anónimo de la web), reutilizando `manage_token` para el huésped y `booked_by_user_id` cuando aplique.
- Publicación de disponibilidad/tarifas hacia los canales a partir de los eventos canónicos (ver §6).
- Idempotencia de ingesta por id externo del canal (reintentos del proveedor no duplican reservas).
- Panel/read-model mínimo: las reservas del canal aparecen en los listados existentes de staff (mismo hotel, mismo scope).

### 4.2 Out-of-scope (v0.1)

- Integraciones reales con OTAs (Booking.com, Expedia, Airbnb y similares).
- Revenue management sobre canales (reglas de precio por canal).
- Conciliación contable con liquidaciones de canales (lo consume Billing después, no este servicio).
- Webhooks entrantes sin firma del proveedor (toda ingesta push debe verificarse con el secreto del canal).

## 5. Diseño del servicio

- **Puerto sugerido**: `3008` (siguiente libre; DB propia `channel_db` en `5439`).
- **Base propia** (`channel_db`): `ota_channels` (nombre, credenciales cifradas, mapeos), `external_reservations` (`external_id` UNIQUE por canal + `booking_id` de HotelSync), `sync_cursors` (último estado publicado por tipo/hotel/fecha), `event_outbox` (mismo patrón que el resto).
- **API propia** (operativa, rol MANAGER/SUPER_ADMIN): CRUD de canales, reintento manual de sincronización, estado de cursores.
- **Auth**: JWT de usuario para lo operativo (mismo `requireAuth`/`requireRole`); las llamadas máquina-a-máquina con canales usan service keys dedicadas, nunca JWT de usuario (mismo criterio que `verifyServiceKey` en R&A y `isTrustedService` en Booking). Ver §7 para la separación entre credenciales del proveedor y service keys internas.
- **Resiliencia**: reintentos con backoff + DLQ por canal; si un canal cae, los demás siguen (aislamiento por adaptador).

### 5.4 Contrato interno de ingesta (protegido e idempotente)

El `POST /v1/bookings` público **no sirve** para ingesta de canales, por tres motivos verificados en `services/booking-service/src/validators/booking.ts:13,32`: el enum de `channel` es solo `["direct","ota","phone"]` (sin `ota:<nombre>`), no recibe ID externo ni clave de idempotencia, y devuelve `manage_token` pensado para huéspedes web, no para máquinas. El contrato interno exige:

1. **Validación contra catálogo**: `channel ∈ {direct, phone} ∪ {ota:<canal-registrado>}` con Zod en el borde de Booking (el canal debe existir en `ota_channels`).
2. **Idempotencia atómica**: nuevo campo `channel_external_id` + constraint `UNIQUE(channel, channel_external_id)` en la tabla `bookings` (reemplaza la tabla separada de mapeo: la referencia viaja **dentro** de la misma transacción de creación). Si el par ya existe, el POST devuelve la reserva existente (200, sin duplicar). Esto cierra la ventana de crash entre "crear la reserva" y "guardar su referencia externa": nunca hay dos filas que mapear.
3. **Auth máquina-a-máquina**: la ingesta la invoca Channel Manager con su service key dedicada (header propio, comparada con `timingSafeEqual`); el par anónimo + `manage_token` queda reservado a huéspedes web. Un `manage_token` jamás autoriza ingesta.
4. El `manage_token` se sigue generando y entregando al huésped (vía el canal) para gestión post-compra, y `booked_by_user_id` se registra cuando el canal identifica cuenta existente.

## 6. Contrato de eventos (recomendación)

> Estado: propuesta. Requiere aprobarse antes de implementar el Channel Manager, porque la ingesta del canal amplifica la inconsistencia actual.

### 6.1 Semántica acordada

| Evento | Significado | Cuándo se publica |
| --- | --- | --- |
| `booking.created` | Nació una reserva **`pending`** (sin inventario comprometido) | En la misma transacción que crea la reserva (outbox, como hoy) |
| `booking.confirmed` (**nuevo**) | R&A reservó inventario **y** Booking transicionó a `confirmed` | En la misma transacción del `updateMany` a `confirmed` (outbox) |
| `booking.cancelled` | La reserva se canceló (libera inventario si estaba `confirmed`) | Como hoy (outbox en la transacción de cancel) |

### 6.2 Consumers

- **Front Desk**: reacciona a `booking.confirmed` para la llegada (ya no a `booking.created`); `booking.created` solo alimenta proyecciones explícitamente `pending`, o se ignora.
- **Billing**: abre el folio con `booking.confirmed`, nunca con la mera creación.
- **Channel Manager (saliente)**: publica disponibilidad a OTAs a partir de `booking.confirmed` / `booking.cancelled` (+ señales de R&A donde aplique).
- **Migración obligatoria**: actualizar `front-desk-service/src/lib/consumer.ts`, `billing-service/src/lib/consumer.ts` **y sus tests** (`consumer.test.ts:18` y `:11` codifican hoy la semántica errónea), más el read-model (`arrival.status`) y el seed de Billing si asume folios de pendientes.

### 6.3 Saga de confirmación y el límite del outbox

El `confirm()` actual (`booking.service.ts:210-256`) ya implementa mini-saga: REST a R&A (`reserveInventory` con `idempotency_key: booking:<id>:confirm`) y luego `updateMany` optimista; si el update pierde, compensa con `releaseInventory`. El cambio propuesto:

1. `updateMany` a `confirmed` **+** `enqueueOutboxEvent("booking.confirmed")` en la **misma transacción Prisma** (patrón ya usado en `create` y `cancel`).
2. El llamado REST a R&A **no puede** ir en esa transacción (otra base, otro servicio): queda fuera, antes del update, como hoy.
3. Ventana de crash entre `reserve` y `updateMany`: el inventario queda reservado huérfano con la reserva en `pending`. El PRD exige **reconciliador** (job que detecta `pending` con reserva aplicada en R&A por `idempotency_key` y reintenta el confirm o libera), no solo compensación del path de conflicto.

### 6.4 Channel Manager nunca publica eventos canónicos

Channel Manager entrega reservas del canal a Booking por **API REST** con el contrato de §5.4 (`channel: "ota:<nombre>"` validado + `channel_external_id` idempotente). **Booking sigue siendo el único publicador** de `booking.created/confirmed/cancelled`. Esto archiva y reemplaza el comentario del stub `booking-service/src/lib/events.ts:6` ("Channel Manager lo publica"). Ese stub además es Fase 1 (solo `console.log`): el contrato real vive en las filas del outbox + los bindings de cada consumer (`front-desk-service/src/lib/consumer.ts:80-85`, `billing-service/src/lib/consumer.ts:49-54`).

### 6.5 Eventos durables de Rate & Availability (dependencia del v0.1)

`booking.confirmed/cancelled` cubre solo cambios provocados por reservas. Los bloqueos (`POST /v1/blocks`), ajustes manuales de inventario y cambios de tarifa mutan R&A sin emitir nada hoy (su schema no tiene tabla outbox: solo `inventory`, `rates`, `rate_rules`). Sin estos eventos, un bloqueo por mantenimiento seguiría vendiéndose en el canal: el O1 quedaría abierto.

1. **Nuevos eventos**: `availability.updated` (bloqueos/desbloqueos y ajustes manuales: `room_type_id`, `date`, `available_count`, `reason`) y `rate.updated` (tarifas y reglas: `room_type_id`, `price`, `start_date`, `end_date`).
2. **Mismo patrón**: tabla `event_outbox` en R&A + dispatcher con confirm, exchange `hotelsync.events`, payloads con `booking_id` cuando el origen sea una reserva (permite correlación) y sin él cuando sea gestión manual.
3. **Regla de no-duplicación**: reserve/release de inventario por reservas **no** emiten eventos R&A; la señal canónica de esos cambios sigue siendo `booking.confirmed/cancelled`. Los eventos R&A cubren exclusivamente lo que Booking no ve.
4. Channel Manager (saliente) consume ambas familias; ante contradicción aparente, el estado de R&A manda sobre la proyección (es el dueño del inventario vendible).

## 7. Seguridad y roles: dos capas separadas

- **Capa externa (proveedor ↔ Channel Manager)**: credenciales o firma HMAC propias del proveedor simulado, configuradas por canal en `ota_channels`, cifradas en reposo en `channel_db`, rotables sin despliegue. Jamás en logs ni en el repo.
- **Capa interna (Channel Manager ↔ microservicios)**: service keys dedicadas por caller (`x-channel-manager-key` en Booking y R&A, comparadas con `timingSafeEqual`, mismo criterio que `verifyServiceKey` y `isTrustedService`). Nunca JWT de usuario entre servicios; nunca ninguna de estas claves al browser.
- **Operativa del Channel Manager** (canales, reintentos, cursores): JWT de usuario con `MANAGER` del hotel o `SUPER_ADMIN`.
- **Ingesta push** del proveedor (si la soporta): se verifica con la firma HMAC de la capa externa, no con JWT.

## 8. Plan de migración (orden sugerido)

1. Contrato interno de ingesta en Booking (§5.4: validación contra catálogo + `UNIQUE(channel, channel_external_id)` + service key de CM).
2. `booking.confirmed` en el outbox del `confirm()` + reconciliador de huérfanos.
3. Outbox + `availability.updated` / `rate.updated` en R&A (§6.5).
4. Migrar consumers de Front Desk y Billing (+ sus tests) a la nueva semántica; desplegar con doble suscripción temporal (`created` + `confirmed`) y bandera de corte por hotel.
5. Recién entonces: construir Channel Manager (ingesta por API + publicación saliente contra el proveedor simulado).
6. Archivar el stub `events.ts` o alinearlo al contrato (hoy dice que CM publica).

## 9. Riesgos y preguntas abiertas

- **R1 (resuelto en §6.5)**: R&A emite `availability.updated` / `rate.updated`; la publicación saliente ya no depende solo de eventos de Booking.
- **R2 (resuelto en §5.4)**: `channel` se valida contra catálogo y la idempotencia es atómica por constraint único.
- **R3**: ¿Qué canal simula primero el proveedor? El adaptador piloto necesita sandbox local con escenarios (overbooking simulado, caída del canal, reintentos duplicados). Las OTAs reales siguen fuera de alcance: criterio de salida = sandbox + contrato firmado + bandera por hotel.
- **R4**: Doble escritura inicial: durante la migración, Front Desk/Billing verán ambos eventos; la bandera de corte debe ser por hotel para rollout gradual.

## 10. Métricas provisionales

Las metas numéricas de §3 (O1 en su umbral exacto, O3 p95 < 60 s) son **provisionales** hasta acordar cómo medirlas, incluso para la simulación: definir dónde se instrumenta (timestamps de `updated_utc` vs hora de publicación en el canal), con qué ventana y con qué carga de prueba. Sin ese acuerdo, ningún número del PRD es exigible.

---

*Documento de propuesta — no implementa nada por sí mismo. La implementación sigue el ciclo SDD del repo.*

