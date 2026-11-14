# T0 — Línea base del BFF (oráculo de regresión)

**Fecha:** 2026-11-01
**Alcance:** comportamiento actual del BFF antes de introducir el API Gateway.
**Oráculo ejecutable:** `node scripts/t0-baseline.mjs --with-flows`
**Salida cruda:** `docs/api-gateway-baseline.json`

## 1. Inventario de rutas

El BFF expone los servicios por rewrite de `apps/front/next.config.js` y por el
Route Handler del simulador. Todos comparten el mismo contrato: método, status,
body y headers pasan sin transformación; el middleware solo inyecta el Bearer.

| Prefijo público | Ruta interna del gateway | Env del upstream | Endpoint de humo | Esperado |
|---|---|---|---|---|
| `/api/property/*` | `/property/*` | `PROPERTY_SERVICE_URL` | `GET /api/property/hotels` | 200 |
| `/api/rate/*` | `/rate/*` | `RATE_AVAILABILITY_SERVICE_URL` | `GET /api/rate/rates?room_type_id=…` | 200 |
| `/api/users/*` | `/users/*` | `USER_SERVICE_URL` | `GET /api/users/staff` | 200 / 401 sin sesión |
| `/api/booking/*` | `/booking/*` | `BOOKING_SERVICE_URL` | `GET /api/booking/bookings?hotel_id=…` | 200 |
| `/api/front-desk/*` | `/front-desk/*` | `FRONT_DESK_SERVICE_URL` | `GET /api/front-desk/arrivals?hotel_id=…&date=…` | 200 |
| `/api/housekeeping/*` | `/housekeeping/*` | `HOUSEKEEPING_SERVICE_URL` | `GET /api/housekeeping/tasks?hotel_id=…` | 200 |
| `/api/billing/*` | `/billing/*` | `BILLING_SERVICE_URL` | `GET /api/billing/folios?hotel_id=…` | 200 |
| `/api/loyalty/*` | `/loyalty/*` | `LOYALTY_SERVICE_URL` | `GET /api/loyalty/levels` | 200 |
| `/api/payments/*` | `/payments/*` | `PAYMENTS_SERVICE_URL` | `GET /api/payments/checkout/:bookingId` | 404 si no existe |
| `/api/analytics/*` | `/analytics/*` | `ANALYTICS_SERVICE_URL` | `GET /api/analytics/dashboard/:hotelId?from=&to=` | 200 |
| `/api/simulator/*` | `/channel-manager/*` | `CHANNEL_MANAGER_SERVICE_URL` | `POST /api/simulator/reservations` sin sesión | 403 |

Notas del inventario:

- `/api/users/*` no mapea 1:1 a `/v1/users/*`: el rewrite apunta a la raíz
  `/v1`, por eso el prefijo sirve tanto a `/v1/staff` como a `/v1/hotels/:id/staff`.
  El gateway debe preservar esa semántica (strip del prefijo, no reescritura de
  segmentos).
- `/api/simulator/*` **no** es un rewrite: es un Route Handler de Next que
  valida sesión `SUPER_ADMIN`, inyecta `x-provider-key` y llama a
  `channel-manager /v1/simulator/*`. En el gateway se expondrá como
  `/channel-manager/*` y el BFF seguirá siendo el dueño de la clave.
- `/api/payments/checkout/:bookingId` devuelve 404 para un UUID inexistente; es
  el caso estable para el humo sin crear pagos.
- Prefijos fuera del gateway: `/api/auth/*`, `/api/rates`, `/api/warmup`.
  `/api/rates` es un Route Handler de Next, distinto de `/api/rate/*` (rewrite).

## 2. Resultado de la línea base (local)

Ejecutado contra `http://localhost:3000` con los 11 servicios de `docker compose`
arriba. **22/22 checks en verde.**

| Check | Status | Latencia |
|---|---:|---:|
| `GET /api/warmup` | 200 | 685 ms |
| `POST /api/auth/login` (SUPER_ADMIN) | 200 | 1667 ms |
| `GET /api/auth/me` | 200 | 937 ms |
| `GET /api/auth/me` sin sesión | 401 | 877 ms |
| `GET /api/property/hotels` | 200 | 144 ms |
| `GET /api/rate/rates` | 200 | 38 ms |
| `GET /api/users/staff` | 200 | 30 ms |
| `GET /api/users/staff` sin sesión | 401 | 22 ms |
| `GET /api/booking/bookings` | 200 | 31 ms |
| `GET /api/front-desk/arrivals` | 200 | 28 ms |
| `GET /api/housekeeping/tasks` | 200 | 44 ms |
| `GET /api/billing/folios` | 200 | 48 ms |
| `GET /api/loyalty/levels` | 200 | 39 ms |
| `GET /api/payments/checkout/:id` inexistente | 404 | 92 ms |
| `GET /api/analytics/dashboard/:hotelId` | 200 | 65 ms |
| `POST /api/simulator/reservations` sin sesión | 403 | 681 ms |
| `GET /api/does-not-exist/probe` | 404 | 581 ms |
| `POST /api/booking/bookings` | 201 | 50 ms |
| `POST /api/booking/bookings/:id/confirm` | 200 | 119 ms |
| `POST /api/front-desk/check-in` | 201 | 48 ms |
| `GET /api/billing/folios/by-booking/:id` | 200 | 55 ms (8 intentos) |
| `POST /api/front-desk/check-out` | 200 | 92 ms |

Las latencias son de `next dev` con Turbopack y servicios en Docker local: sirven
como orden de magnitud, no como SLO. La comparación válida después de cada tarea
es **status + forma del body**, no el número exacto de milisegundos.

## 3. Smoke manual: login con Google

No es automatizable sin credenciales y consentimiento interactivo. Checklist:

1. Abrir `/cuenta/entrar` y elegir "Continuar con Google".
2. Completar el consentimiento de Auth0/Google.
3. Verificar redirect a `/api/auth/callback` y luego al `returnTo` original.
4. Confirmar que `/api/auth/me` responde 200 con `user` y `assignment`.
5. Verificar logout en `/api/auth/logout` y que `/api/auth/me` pase a 401.
6. Repetir contra el preview de Vercel antes de T6 y T9.

Criterio: mismo status y misma forma de respuesta que el login local; las cookies
`hs_access`/`hs_refresh` siguen siendo HttpOnly y el callback no cambia.

## 4. Cómo reproducir

```powershell
# 1. Stack local
docker compose up -d
npm run dev:front        # http://localhost:3000

# 2. Oráculo
node scripts/t0-baseline.mjs              # solo lectura
node scripts/t0-baseline.mjs --with-flows # incluye reserva/check-in/check-out
```

Variables opcionales: `BFF_URL`, `T0_ADMIN_EMAIL`, `T0_ADMIN_PASSWORD`.
El script escribe `docs/api-gateway-baseline.json` y sale con código 1 si algún
check no coincide con el status esperado.

## 5. Hallazgos de entorno (2026-11-01)

- El contenedor local de `billing-service` tenía un `dist/` del 2026-10-05 sin
  `GET /v1/folios/by-booking/:bookingId`, aunque el código fuente sí lo define.
  Se recompiló el servicio y se copió `dist/` al contenedor para que la línea
  base refleje el working tree. Un gateway contra el contenedor viejo habría
  dado 404 falsos.
- El folio de una reserva se abre por evento (`booking.confirmed` →
  billing consumer), no en la misma transacción: el humo espera hasta 10 s.
  Medido: ~3,5 s en local. El gateway no debe cachear ni reintentar este GET.
- El prefijo `/api/users/*` es un proxy a la raíz `/v1` del user-service, no a
  `/v1/users`. Es el caso que más fácil se rompe al implementar el strip de
  prefijos en T2/T3.

## 6. Uso como oráculo

Después de cada tarea del plan (T1–T9):

1. Ejecutar `node scripts/t0-baseline.mjs --with-flows`.
2. Comparar `summary.failed` contra este documento: debe seguir en 0.
3. Ante una diferencia, decidir si es regresión o cambio intencional; si es
   intencional, actualizar este documento y el JSON en el mismo commit.
