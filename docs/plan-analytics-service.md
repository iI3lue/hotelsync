# Plan: analytics-service (Revenue Management)

Agregar el microservicio de Analytics al monorepo: ETL periódico sobre réplicas de
solo lectura de booking/property que calcula ocupación, ADR, RevPAR y forecast por
propiedad, los expone por REST a un dashboard de revenue en el admin, y publica
`metrics.updated` vía outbox.

**Estado de partida:** ya existe una base sin commitear (`services/analytics-service/`
+ `docs/analytics-service-prd.md`) de un workstream anterior, y los scripts
`dev:analytics` / `migrate:analytics` ya están commiteados en el root. Este plan la
**alinea con la arquitectura vigente** (payment/loyalty/channel-manager no existían
cuando se escribió el docx), corrige desviaciones del scaffold y la completa de punta
a punta: migración, infra docker, ETL real, dashboard, verificación y docs.

Fuente de verdad de producto: `docs/HotelSync_Arquitectura.docx` §4.9 y §5.9.
Fuente de verdad de diseño: `docs/analytics-service-prd.md` (ya redactado).

---

## 1. Qué pide el docx y qué se reconcilia con la realidad

### 1.1 Docx §4.9 — responsabilidad y contratos

- **Responsabilidad única:** calcular ocupación, ADR y RevPAR por propiedad, ejecutar
  previsiones y alimentar dashboards de revenue **mediante ETL sobre réplicas de solo
  lectura**. Separado para que la carga analítica no degrade lo transaccional.
- **Endpoints:** `GET /occupancy`, `GET /adr`, `GET /revpar`, `GET /forecast`,
  `GET /dashboard/{propiedad}`.
- **Comunicación:** ETL periódico sobre réplicas (no hay REST hacia otros servicios);
  REST síncrona solo para el dashboard.
- **Evento que publica:** `metrics.updated`.
- **Tablas:** `occupancy_daily`, `revpar_by_property`, `adr_by_property`.
- **Modelo §5.9:** PKs `occupancy_id`/`revpar_id`/`adr_id`, FK lógica `property_id`,
  índice `(property_id, report_date)`, `occupancy_pct BETWEEN 0 AND 100`.

### 1.2 Reconciliación con la arquitectura actual (decisiones ya tomadas)

| Tema | Docx | Arquitectura real / decisión | Motivo |
|---|---|---|---|
| Tablas ADR/RevPAR | 2 tablas separadas | Fusionadas en `kpi_by_property` (ya en scaffold) | Misma granularidad hotel+día, siempre se leen juntas, evita joins |
| PK | UUID sustituto por tabla | PK compuesta `(hotel_id, date)` | Agregado idempotente (upsert natural); el resto del monorepo usa UUID pero acá el par es la clave real |
| Ocupación | `occupancy_pct` 0–100 | Ratio `Decimal(5,4)` 0–1 | Consistente con la fórmula del PRD (`occupied/available`); el front formatea el % |
| Nombre FK | `property_id` | `hotel_id` | Es el nombre real en property/booking (`hotels`, `hotel_id`) |
| Estado de reservas | `pending/confirmed/cancelled/completed` | **`completed` no existe**: booking nunca sale de `confirmed` (verificado en booking-service) | ETL cuenta `status='confirmed'` — correcto tal cual |
| Capacidad | "disponibilidad" genérica | `physical_rooms` de property (`is_active = true`) | Es la tabla real de habitaciones físicas; el SQL del scaffold ya coincide |
| Revenue | ingreso | `bookings.total_amount` de reservas `confirmed` (no `payment_status`) | Revenue management reconoce la estadía confirmada; el cobro (payment-service) es otro dominio. Revisar en decisiones abiertas |
| Puerto / DB | no fija | **3011** (siguiente libre tras payment:3010) y **5442** (tras 5441) | Consistente con el scaffold y el PRD |
| Evento | `metrics.updated` directo | Por **outbox `pending → sent`** + exchange `hotelsync.events` | Convención vigente del monorepo. El scaffold hoy inserta `sent` al crear — corregir (§2) |
| Réplicas | réplicas read-only | Local: mismas DBs dev. Prod: rol/credencial read-only por DB origen | No hay réplicas reales en dev; en Neon se resuelve con rol read-only |
| Multi-tenancy | no menciona | Staff scoped por hotel (MANAGER/SUPER_ADMIN); `SUPER_ADMIN` global | Convención de auth del resto de los servicios |

---

## 2. Inventario del workstream existente (sin commitear)

| Componente | Estado | Nota |
|---|---|---|
| `docs/analytics-service-prd.md` | Listo | PRD completo (contratos, definiciones, esquema, orden de construcción) |
| Scaffold del servicio | Listo en su mayoría | `index.ts`, rutas, controllers, validators (Zod), auth JWT+roles, `lib/broker`, `lib/metrics` (matemática pura + 4 tests), `lib/sources` (SQL raw), `analytics.service` (ETL + series + forecast + dashboard), `schema.prisma`, Dockerfile (patrón monorepo), jest/tsconfig |
| Scripts root | **Ya commiteados** | `dev:analytics`, `migrate:analytics` (verificado: `package.json` limpio vs HEAD) |
| Migraciones Prisma | **Faltan** | No existe `services/analytics-service/prisma/migrations/` |
| Outbox | **Desviado** | El ETL crea la fila con `status: "sent"` si hay `RABBITMQ_URL` y publica inline; no hay `lib/outbox.ts` ni dispatcher. Rompe el patrón pending→sent |
| SQL de `sources.ts` | Correcto pero con TODOs | `bookings` (confirmed) y `physical_rooms` (is_active) coinciden con los schemas reales; limpiar TODOs y convertir Decimal |
| Tests | Solo unit de métricas | Faltan unit del ETL (upsert idempotente, outbox pending) e integración de endpoints (401/403/200) |
| `DATABASE_URL_RATE` | Declarado, sin uso | El ETL v1 no lee rate-availability (capacidad sale de property) |
| Docker compose | **Falta analytics** | No hay `analytics-db` (5442) ni servicio `analytics-service` (3011) |
| Rewrite + dashboard front | **Faltan** | `next.config.js` no tiene `/api/analytics`; no hay página de revenue en `/admin` |
| Docs | **Faltan** | `README.md`, `ARCHITECTURE.md`, `API.md` y `AGENTS.md` no mencionan analytics (0 refs) |

---

## 3. Decisiones abiertas (confirmar antes de Fase 1)

| # | Decisión | Recomendación | Impacto |
|---|---|---|---|
| D1 | Outbox: ¿dispatcher pending→sent o queda inline? | Migrar al patrón vigente (`lib/outbox.ts` + dispatcher) | Consistencia con booking/billing/front-desk; reintentos confiables |
| D2 | Fuente de revenue del ADR/RevPAR: ¿`total_amount` de reservas confirmed, o solo `payment_status='PAID'`? | `total_amount` (revenue management reconoce estadía; los pagos tienen su propio servicio) | Cambia el número mostrado; definirlo ahora evita retrabajo del SQL |
| D3 | Gráficos del dashboard: ¿agregar `recharts` o SVG/Tailwind a mano? | SVG/Tailwind (el front hoy no tiene librería de charts; pocas series) | Dependencia nueva y peso del bundle vs esfuerzo de UI |
| D4 | Cron del ETL: ¿`setInterval` interno (`ETL_INTERVAL_MS`, default 6 h) + corrida manual, o cron externo? | Intervalo interno configurable; en prod, cron job de Render apuntando a `npm run etl` | Deploy y operación |
| D5 | `DATABASE_URL_RATE`: ¿se usa o se elimina? | Eliminar del v1 (no se lee rate-availability) | Superficie de configuración y accesos read-only |

---

## 4. Fases de implementación

Cada fase termina con su DoD (definition of done) y es un work unit commiteable.

### Fase 1 — Consolidar el servicio contra las convenciones

- `lib/outbox.ts` nuevo: `enqueueOutboxEvent(db, type, payload)` dentro de la
  transacción del upsert + `startOutboxDispatcher()` (mismo patrón que billing).
  Reescribir el bloque de outbox de `analytics.service.ts` (hoy `sent` directo).
- `lib/sources.ts`: limpiar TODOs, tipar `Decimal → Number`, documentar por qué
  `$queryRawUnsafe` (jamás migra ni escribe las DBs origen).
- Aplicar D5 (`.env.example` sin `DATABASE_URL_RATE` si se confirma).
- `prisma migrate dev --name init_analytics` sobre `analytics_db`.
- Tests: unit del ETL con réplicas mockeadas (upsert idempotente, fila outbox
  `pending` sin broker) + integración mínima de rutas (sin JWT → 401, rol GUEST →
  403, MANAGER → 200 con datos sembrados).

**DoD:** `npx tsc --noEmit` y `jest` verdes en el workspace; migración aplicada.

### Fase 2 — Infra local (docker compose)

- `analytics-db`: postgres:16-alpine, `5442:5432`, `analytics_dev`, volumen
  `analytics_data`, healthcheck (patrón payment/loyalty).
- `analytics-service`: build desde `services/analytics-service/Dockerfile`,
  `3011:3011`, env: `DATABASE_URL`, `DATABASE_URL_BOOKING` → `booking-db`,
  `DATABASE_URL_PROPERTY` → `property-db`, `AUTH_JWT_SECRET` idéntico al resto,
  `RABBITMQ_URL`; `depends_on` analytics-db + rabbitmq.
- `adminer`: sumar `analytics-db` a `depends_on`.

**DoD:** `docker compose up -d analytics-db` + `npm run migrate:analytics` sin
errores; el servicio arranca y `/health` responde.

### Fase 3 — ETL real + evento + scheduler

- Corrida manual contra datos locales reales:
  `npm run etl --workspace=services/analytics-service -- --from=... --to=...`.
- Sanity SQL manual (Adminer) para un hotel-día conocido: noches ocupadas = reservas
  confirmed que cubren esa noche; ADR = revenue/vendidas; RevPAR = revenue/físicas.
- Verificar `metrics.updated`: fila `pending` sin broker; con broker, `sent` y
  visible en la management UI de RabbitMQ.
- Aplicar D4: `setInterval` configurable (`ETL_INTERVAL_MS`) en `index.ts` con
  arranque diferido y log; el ETL corre con el rango `[hoy-N, ayer]`.

**DoD:** tablas agregadas cuadran contra SQL manual; evento verificado; corrida
programada activa sin romper el arranque sin broker.

### Fase 4 — Dashboard de revenue en el front

- `apps/front/next.config.js`: rewrite `/api/analytics/:path*` →
  `${NEXT_PUBLIC_ANALYTICS_API_URL || "http://localhost:3011/v1"}/:path*`.
- Nueva página `apps/front/src/app/admin/analytics/page.tsx` (reusa el guard de
  `/admin`), visible para MANAGER/SUPER_ADMIN, scoped por hotel.
- UI: selector de hotel y rango (default últimos 30 días); tarjetas de ocupación
  media, ADR y RevPAR; serie diaria de ocupación (aplicar D3); forecast 14 días;
  empty state claro ("sin datos: ejecutá el ETL") cuando las tablas estén vacías.
- Cliente: helper en `lib/api-client.ts` que pega a `/api/analytics/v1/...`
  (Bearer inyectado por el middleware existente del BFF).

**DoD:** con datos del ETL, el dashboard muestra KPIs del hotel elegido; tsc + jest
+ build del front verdes.

### Fase 5 — Verificación end-to-end + documentación

- E2E local: reserva confirmed → ETL → dashboard con KPIs > 0 (y 0 cuando no hay
  noches ocupadas).
- Docs: `README.md` (servicio, puerto, scripts `dev:analytics`/`etl`),
  `ARCHITECTURE.md` (sección Analytics + evento `metrics.updated`),
  `API.md` (contratos `/v1/occupancy|adr|revpar|forecast|dashboard`),
  `AGENTS.md` (línea de puertos y DB).

**DoD:** lint (`tsc --noEmit`) y tests verdes en todo el monorepo; docs al día.

### Fase 6 — Producción (opcional, patrón vigente)

- Split repo `iI3lue/hotelsync-analytics-service` (copiar el flujo de payment/loyalty).
- Render: web service + Neon analytics; env con credenciales **read-only** de
  booking/property; cron job de Render para `npm run etl` diario (D4).
- Vercel: `NEXT_PUBLIC_ANALYTICS_API_URL` (build-time → redeploy) + rewrite activo.

---

## 5. Riesgos y notas

- **Decimal en JSON:** Prisma serializa `Decimal` como objeto; el service ya
  convierte con `Number()` — mantener ese cuidado en cualquier endpoint nuevo.
- **Read-only real en prod:** sin rol read-only por DB origen no se despliega
  (el ETL usa `$queryRawUnsafe`; el permiso de escritura no debe existir).
- **Backfill:** el ETL agrega solo el rango pedido; la historia se carga corriendo
  rangos con `--from/--to` (el script ya lo soporta).
- **Re-corridas:** los upserts por `(hotel_id, date)` son idempotentes; cada corrida
  puede re-emitir `metrics.updated` para el mismo día (aceptable v1).
- **Zona horaria:** fechas normalizadas a mediodía UTC (ya en el scaffold) para
  evitar corrimientos de día.

---

## 6. Criterios de aceptación

- [ ] `analytics-service` en compose con DB propia (5442) y migración aplicada.
- [ ] ETL produce `occupancy_daily` y `kpi_by_property` que cuadran contra SQL manual.
- [ ] `metrics.updated` sale por outbox `pending → sent` (sin broker queda pending y
      el ETL no se rompe).
- [ ] Endpoints `/v1/*` responden con JWT staff (401/403 correctos), sin calcular
      sobre las réplicas en vivo.
- [ ] Dashboard en `/admin/analytics` con KPIs, serie y forecast; empty state.
- [ ] `tsc --noEmit` + jest verdes (servicio y front); build del front OK.
- [ ] Docs actualizados (README, ARCHITECTURE, API, AGENTS).
- [ ] (Fase 6) Split desplegado con lectura read-only real y cron diario.

---

## Referencias

- `docs/HotelSync_Arquitectura.docx` §4.9 (servicio) y §5.9 (modelo de datos)
- `docs/analytics-service-prd.md` (contratos, fórmulas, esquema)
- Scaffold: `services/analytics-service/` (PRD §3 "ETL" implementado con desviaciones en §2 de este plan)
- Convenciones vivas: `services/billing-service/src/lib/outbox.ts` (patrón outbox),
  `apps/front/next.config.js` (rewrites), `docker-compose.yml` (infra)
