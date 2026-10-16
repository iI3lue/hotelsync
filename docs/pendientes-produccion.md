# Pendientes — Producción HotelSync

> Generado 2026-10-14 después del sync del rediseño a prod. Marcar con `[x]` al completar.

## 1. Verificar deploy del front en Render

- [ ] Confirmar en el dashboard que el deploy de `33bdb4e` (`feat(front): portar rediseno Casa de piedra`) terminó en verde.
- [ ] Abrir la URL de producción y verificar: home con hero, `/buscar` con resultados, fonts Jost + Gilda cargadas (sin FOUT).
- [ ] Verificar `/api/loyalty/levels` en producción → 200 (el rewrite ya viaja en este push).

## 2. Loyalty en producción (Render + Neon) — HECHO 2026-10-14 ✅

- [x] Proyecto Neon `hotelsync-loyalty-db` (`snowy-lab-08903666`, `loyalty_db`, us-west-2).
- [x] Repo `iI3lue/hotelsync-loyalty-service` con split verificado.
- [x] Servicio Render `hotelsync-loyalty-service` (free, oregon, auto-deploy): deploy `live`, `/health` 200, `/v1/levels` 200 con los 3 niveles.
- [x] Env vars seteadas con valores dev (decisión del usuario): `DATABASE_URL` (Neon pooler), `AUTH_JWT_SECRET` (= user-service), `BOOKING/USER_SERVICE_URL` (onrender), `BOOKING/USER_SERVICE_KEY`.
- [x] Agregar `RABBITMQ_URL` de producción (seteado 2026-10-14 vía MCP en loyalty + payment; redesplegaron solos).
- [ ] En el front de prod (Vercel): setear `NEXT_PUBLIC_LOYALTY_API_URL=https://hotelsync-loyalty-service.onrender.com/v1` y **redeploy** (es build-time). Sin esto, la `LoyaltyCard` falla en producción.
  - **Verificado 2026-10-15**: el rewrite `/api/loyalty/*` devuelve 404 `DNS_HOSTNAME_RESOLVED_PRIVATE` (Vercel) → el env faltaba al build y cae a `http://localhost:3009/v1`. Por eso NINGÚN request a loyalty (incluido el ping del WarmUp) llega al servicio. Bloqueante hasta setear el env + redeploy.
- [x] WarmUp del front: despertaba 6 servicios, faltaban users/loyalty/payments. Agregados (9 en total), commit monorepo `bede5ac` + prod `56dc892` (2026-10-15). Loyalty no despertará hasta resolver el env de arriba.

## 3. Limpieza del clon trampa

- [ ] Borrar `C:\Users\juand\AppData\Local\Temp\opencode\hotelsync-split\hotelsync-front` (varado al 29-sep, parcial, con borrados locales; pushear desde ahí pisaría producción). El clon válido es `front-sync`.

## 4. Analytics (código listo, sin commitear)

- [ ] Commitear en el monorepo: `docs/analytics-service-prd.md` + `services/analytics-service/` + scripts `dev:analytics`/`migrate:analytics` + lock.
- [ ] Seguir el orden del PRD: ETL manual → endpoints → réplicas read-only + cron → dashboard admin.
- [ ] A su tiempo: repo `hotelsync-analytics-service` + Render (`:3011`) + Neon (`analytics_db`) + rewrite `/api/analytics/:path*` en el front.

## 5. Payment (integrado local 2026-10-14, commit 6b19ece)

- [x] Reintegrado desde `payment-service-kit-completo`: payment (src+tests+prisma+configs), booking (9 mod + 3 nuevos + migración `payment_status`), front (5 nuevos + 13 mod + rewrite `/api/payments`).
- [x] Verificado: tsc limpio en los 3, jest 38/38 payment + 75/75 booking + 52/52 front, `next build` OK, smoke (`/health` 200, 401s correctos, checkout→404 contra booking nuevo, 502 mapeado contra booking viejo).
- [x] Pusheado el desarrollado al repo `hotelsync-payment-service` (estaba vacío; split verificado: tsc + 38/38 tests).
- [x] Proyecto Neon `hotelsync-payment-db` (`empty-sea-60322637`, `payment_db`, us-west-2).
- [x] Servicio Render `hotelsync-payment-service` (free, oregon, auto-deploy): `/health` 200, checkout sin auth 401.
- [x] Env vars con valores dev: `DATABASE_URL` (Neon pooler), `AUTH_JWT_SECRET` (= user-service), `BOOKING_SERVICE_URL` (onrender), `BOOKING_SERVICE_KEY`, `PAYMENT_CURRENCY=COP`.
- [x] Agregar `RABBITMQ_URL` de producción (mismo que loyalty).
- [x] **Booking de prod actualizado** (2026-10-14): split sincronizado (payment + `has-active` que le faltaba desde el 11-oct + helper JWT local para tests standalone), pusheado, `PAYMENT_SERVICE_KEY` seteada, deploy `live` verificado. Cadena prod `payment→booking` verificada (checkout→404, antes 502).
- [x] En el front de prod (Vercel): `NEXT_PUBLIC_PAYMENT_API_URL=https://hotelsync-payment-service.onrender.com/v1` + redeploy (build-time).
- [x] Sync front→prod con la pasarela (2026-10-14, commit `db16da4` en `hotelsync-front`): 5 nuevos + 13 mod + rewrite payments; `api-client` del monorepo + bloque compat preservado (verificado completo); tsc + 47/47 + `next build` OK. Vercel redespliega solo.
- [ ] Próximo sync front→prod: preservar el bloque compat de `api-client.ts` en front-sync (solo existe ahí) al traer estos 13 archivos modificados.

## 6. Próximo PRD (decisión abierta)

- [ ] Elegir: **notification-service** (mailer hoy es un stub con `console.log`; lo necesitan recuperación de contraseña, confirmación de reserva y recibos de pago) o **reviews-service** (el rediseño eliminó ratings inventados y no hay prueba social real).
