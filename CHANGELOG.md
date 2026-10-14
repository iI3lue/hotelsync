# Changelog

Todos los cambios notables en HotelSync. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [2026-10-05] — Cierre de ciclo (producción)

### Added
- Split por microservicio: 1 repo + 1 Render + 1 Neon por servicio
  (`iI3lue/hotelsync-{property,rate-availability,booking,front-desk,housekeeping,billing,user-service,front}`),
  todos desplegados y en `live` con `prisma migrate deploy` en arranque
- Hardening de seguridad: `requireAuth`/`requireRole` en rutas sensibles,
  alcance por hotel (`hotel_id`/`scope`), claims HS256 (`iss=hotelsync`,
  `aud=hotelsync-api`, `email_verified`, `alg` fijo), refresh con rotación
  atómica, nonce obligatorio en `/auth/federated`, `x-service-key` y claves
  por servicio entre Booking ↔ Front Desk/Housekeeping/Billing
- Migraciones nuevas: `applied_keys` (R&A), `guest_incidents.hotel_id`
  (Front Desk), `anonymous_booking` + `manage_token_expiry` (Booking),
  `unit_uuids` (Front Desk), `task_identity` + `unit_uuid` (Housekeeping),
  `physical_room_catalog` (Property), `processed_events` (R&A)
- Login con Google funcionando en prod (Auth0 + PKCE S256 + nonce en
  cookies HttpOnly, verificación JWKS en user-service)
- `GET /api/rates` (front): cotización COP en vivo (open.er-api.com, cache
  server 30 min, fallback con `live:false`) + polling cada 10 min y 8
  monedas visibles (COP, USD, EUR, MXN, BRL, CLP, PEN, ARS)
- `AccountNav` (email + Salir) y redirect post-login por rol (staff → `/admin`)
- `docs/HotelSync-User-Service-Auth.docx`: documento técnico de user-service
  (JWT/HS256, Auth0, roles, endpoints, glosario, decisiones)

### Fixed
- BFF: el middleware solo inyecta el Bearer; no rota sesión (las cookies
  seteadas sobre `NextResponse.next()` se pierden en rewrites externos y
  dejaban la sesión colgada). La renovación vive en `/api/auth/refresh`,
  `/api/auth/me` y el retry con single-flight del cliente
- Endpoints que el monorepo había perdido y el front usa: preservados y
  asegurados con auth + scope (`GET /v1/folios/by-booking/:bookingId`,
  `GET /v1/check-in/:bookingId`)
- `AUTH0_CLIENT_ID` alineado en Render user-service con la app del front
- Cookie de access a 15 min (estaba en 8h en el front)

### Verified
- Smoke en prod: register → login → `/v1/users/me` con claims nuevos;
  reserva anónima create → confirm → cancel con reserve/release cruzado
  (disponibilidad 10 → 9 → 10); 401 en rutas antes públicas; rastros del
  smoke eliminados vía SQL

## [Unreleased]

### Added
- Loyalty Service (3009, `loyalty_db` 5440): cuentas con tier
  (silver/gold/platinum) y saldo único transversal; acreditación idempotente de
  puntos por `booking.completed` (`points = floor(total_amount × multiplicador
  del tier vigente)`), ascenso automático de tier sin descenso, y canje con
  validación de saldo; consumer RabbitMQ (`loyalty.points`) que verifica reserva
  (Booking) y   cuenta activa (User) vía REST antes de acreditar; endpoints
  `GET /v1/me`, `POST /v1/me/redeem`, `GET /v1/levels` y
  admin `GET /v1/admin/users/:id/loyalty` / `POST /v1/admin/points`
  (montaje directo bajo `/v1`, como el resto de servicios)
- Front: `LoyaltyCard` en `/cuenta/perfil` (tier, saldo, progreso al siguiente
  nivel y últimas transacciones) vía rewrite `/api/loyalty`
- Infra: `loyalty-db` + `loyalty-service` en `docker-compose.yml`, scripts
  `dev:loyalty`/`migrate:loyalty`/`seed:loyalty` y vars en `.env.example`
- Docs: `docs/plan-loyalty-service.md` (plan aprobado del servicio)
- RN-1/RN-2 del PRD: confirmar reserva decrementa inventario y cancelar lo
  libera, vía REST síncrono Booking → Rate & Availability
  (`POST /v1/availability/reserve` y `/release`) con transacción + `version`
  (bloqueo optimista) y compensación si hay conflicto; `RATE_SERVICE_URL`
  (default `http://localhost:3002/v1`) y `depends_on` en docker-compose
- 89 tests totales (18 property + 24 rate + 27 booking + 20 front-desk),
  endpoints `reserve`/`release` documentados en `API.md`
- Booking Service (3004, `booking_db` 5434): reservas con `status`/`channel`/`version`,
  confirmar con bloqueo optimista anti-sobreventa (409 si conflicto), cancelar,
  eventos `booking.created`/`booking.cancelled` como stub con log (RabbitMQ en Fase 2)
- Front Desk Service (3005, `front_desk_db` 5435): llegadas del día vía REST a Booking,
  check-in con habitación física (solo `confirmed`, sin doble check-in),
  check-out con `checkout.completed`, incidencias del huésped
- Web `/reservas/nueva` real (antes placeholder): `BookingForm` crea/confirma/cancela
  contra Booking vía rewrite `/api/booking`
- Admin `/recepcion`: llegadas por hotel+fecha, check-in/out con `ReceptionBoard`,
  tarjeta Recepción en dashboard, rewrites `/api/booking` y `/api/front-desk`
- Infra: `booking-db`/`front-desk-db` + servicios en `docker-compose.yml` y CI,
  scripts `dev`/`migrate`/`seed` nuevos, vars en `.env.example`
- Docs: secciones Booking + Front Desk en `API.md`, `ARCHITECTURE.md` y `README.md`
  (89 tests totales: 18 property + 24 rate + 27 booking + 20 front-desk)
- Modo oscuro seleccionable en web y admin (next-themes, default sistema, toggle Claro/Oscuro/Sistema con aria-label, persiste en localStorage, sin flash)
- UI 100% en español en ambas apps (lang="es", metadata, páginas, formularios, mensajes)
- `apps/admin/src/app/hotels/new/page.tsx` — el link "Agregar hotel" apuntaba a una ruta inexistente
- Labels asociados (htmlFor/id) y roles status/alert en feedback de formularios

### Added
- Nivel 1 Docker: `property-service` y `rate-availability-service` cableados en `docker-compose.yml`
  (build con contexto raíz, `depends_on` healthy, `restart: unless-stopped`)
- `.dockerignore` para builds rápidos (excluye node_modules, dist, apps, docs)
- `CMD` con `npx prisma migrate deploy && npm start` en ambos servicios
- Sección "Docker — Nivel 1" en README

### Fixed
- Crashloop `@prisma/client did not initialize yet` en Docker: el client generado
  (output custom en `services/*/node_modules/.prisma`) se copia también a
  `/app/node_modules/.prisma/client` en el runner, donde lo resuelve el runtime hoisted
- Dockerfiles reescritos para contexto raíz (antes `COPY tsconfig.base.json` fallaba)
- Removido `version: "3.8"` obsoleto de `docker-compose.yml`

## [1.0.0] — 2026-09-13

### Added

#### Monorepo
- Estructura de monorepo con npm workspaces
- `tsconfig.base.json` con configuración TypeScript compartida
- `docker-compose.yml` con 2× PostgreSQL 16 (property_db en 5432, rate_availability_db en 5433)
- `.env.example` con templates de variables de entorno
- `README.md` con instrucciones de setup

#### Property Service (puerto 3001)
- CRUD de hoteles (name, city, country, timezone)
- CRUD de tipos de habitación (name, capacity, base_rate, amenities)
- CRUD de políticas de cancelación (name, description)
- Validación con Zod en todos los endpoints
- Error handling centralizado con AppError
- 18 tests unitarios (hotel, room-type, cancellation-policy)
- Seed con 2 hoteles de prueba
- Dockerfile multi-stage

#### Rate & Availability Service (puerto 3002)
- Consulta de disponibilidad por room_type y fecha
- CRUD de tarifas (price por room_type y fecha)
- Reglas de tarifa con multiplicador y estadía mínima
- Bloqueo/desbloqueo de inventario (maintenance blocks)
- Compound unique constraint en inventory (room_type_id, date)
- Business rules: available_count >= 0, blocked_count >= 0, price >= 0, multiplier > 0, min_stay >= 1
- Disponibilidad real = available_count - blocked_count
- 15 tests unitarios (inventory, rate, rate-rule, block)
- Seed con inventory, rates y rate_rules de prueba
- Dockerfile multi-stage

#### Frontend — apps/web (puerto 3000)
- Next.js 15 App Router con TypeScript
- SSR para listado de hoteles
- Página de detalle de hotel con room_types y cancellation_policies
- Página de consulta de disponibilidad
- TailwindCSS para estilos

#### Frontend — apps/admin (puerto 3003)
- Next.js 15 App Router con TypeScript
- Panel de administración con sidebar
- CRUD de hoteles
- Gestión de tipos de habitación
- Gestión de inventario
- TailwindCSS para estilos

#### CI/CD
- `.github/workflows/ci.yml` — lint + test + build en cada push
- `.github/workflows/deploy.yml` — deploy pipeline (placeholder)

### Changed
- Puerto de admin cambiado de 3001 a 3003 (evitar conflicto con Property Service)
- RateRule schema: de `@db.TstzRange` a `start_date` + `end_date` (limitación de Prisma)
- Seed de inventory: de `create` a `upsert` (idempotente)
- `tsconfig.base.json`: removido `rootDir: "./src"` (causaba error en frontends)

### Fixed
- Error de seed en RateRule: campo `date_range` reemplazado por `start_date` + `end_date`
- Error de unique constraint en inventory seed: cambiado a `upsert`
- Error de TypeScript compilation en frontends: removido `rootDir` del base config
- Puerto de admin conflicto con Property Service: cambiado a 3003

---

## [0.1.0] — 2026-09-11

### Added
- Documentación inicial del proyecto
- `HotelSync_Informacion_Extraida.txt` — fuente del profesor
- `HotelSync_Arquitectura.docx` — documento de arquitectura
- `HotelSync_Tutorial_Diagramas_ER.md` — tutorial para dbdiagram.io
- `HotelSync_Diagrama_Arquitectura.md` — guía de diagrama Isoflow
- `HotelSync_Modelos_Relacionales_ER.md` — 9 diagramas ER en ASCII

### Changed
- Docx alineado con fuente del profesor (9 microservicios)
- Corregido error de cardinalidades en diagramas ER
- Sección de deployment strategy agregada (Blue-Green)
