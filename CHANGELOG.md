# Changelog

Todos los cambios notables en HotelSync. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
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
