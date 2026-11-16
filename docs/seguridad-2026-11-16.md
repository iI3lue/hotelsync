# Hardening de seguridad — 2026-11-16

Alcance: `api-gateway` y los 11 servicios (`property`, `rate-availability`,
`booking-service`, `front-desk-service`, `user`,
`housekeeping`, `billing`, `channel-manager`, `loyalty`, `payment`, `analytics`). Se implementó primero en el
monolito; este documento describe el comportamiento esperado también en los splits.

## Medidas aplicadas

| Área | Medida |
| --- | --- |
| Secretos | `assertProductionSecrets()` corta el arranque (`exit 1`) si detecta secretos de desarrollo en un servicio desplegado. |
| `/metrics` | `metricsGuard()`: con `METRICS_TOKEN` exige `Authorization: Bearer` o `x-metrics-token` (comparación timing-safe); desplegado sin token → 404; local/tests → abierto. |
| Cabeceras | `securityHeaders`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. |
| IP real | `app.set("trust proxy", 1)` + `clientIp()`, que solo confía en `x-client-ip` si `requireGateway` validó el secreto (`res.locals.gatewayAuthenticated`). |
| Login | Rate limit por IP (20/15 min) y por email (5/15 min); se limpia al login exitoso. |
| Registro | Rate limit por IP (5/hora). |
| Gateway | Rate limit global por minuto (default 600; exentos `/health` y `/metrics`). |
| Payloads | Body máximo `MAX_BODY_BYTES` (default 1 MiB) → 413; URL > 2048 → 414. |
| Errores | `entity.parse.failed` → 400, `entity.too.large` → 413 (sin filtrar detalles internos). |
| Timeouts | `server.requestTimeout=30s`, `headersTimeout=20s`, `keepAliveTimeout=5s`. |

## Variables de entorno

| Variable | Servicio | Default | Notas |
| --- | --- | --- | --- |
| `METRICS_TOKEN` | 11 servicios + gateway | vacío | Si está vacío en Render, `/metrics` devuelve 404. |
| `MAX_BODY_BYTES` | gateway | `1048576` | Subir solo si un endpoint legítimo lo necesita. |
| `RATE_LIMIT_PER_MINUTE` | gateway | `600` | Presupuesto por IP. |
| `GATEWAY_SHARED_SECRET` | gateway | — | Mínimo 32 caracteres. |
| `GATEWAY_SECRET` | servicios | — | En `enforce`, mínimo 32 caracteres. |
| `GATEWAY_SECRET_PREVIOUS` | servicios/gateway | — | Doble secreto durante la rotación. |
| `ENABLE_RATE_LIMITS_IN_TESTS` | user-service | `false` | Solo para tests explícitos. |

## Comportamiento por entorno

La detección de despliegue usa `RENDER === "true" || RENDER_SERVICE_ID`, **no**
`NODE_ENV`: `docker-compose.yml` levanta los servicios con `NODE_ENV=production` y
secretos locales, y con `NODE_ENV` el stack local quedaría inutilizable.

- Local/Docker/tests: no se validan secretos, `/metrics` abierto.
- Render: secretos obligatorios y fuertes, `/metrics` cerrado salvo token.

## Dependencias

- `express` fijado en `4.22.3` (arrastra `qs >= 6.16.1`, cierra la vulnerabilidad de
  `qs`). Se actualizó con `npm update express`; los manifests ya declaraban `^4.21.0`.
- Críticas: 0. Riesgo aceptado y documentado:
  - `zod < 4.6.6` (high): el fix es v4 (breaking). Mitigado con caps de body (1 MiB)
    y URL (2048) en el gateway.
  - `prisma`/`@prisma/config`/`deepmerge-ts` (high): afectan a la CLI en build, no al
    runtime; el fix requiere Prisma 7 (major).
  - `next`/`postcss` (moderate/high): pendiente de un patch de Next 14.

## Preflight antes de pushear

```bash
npm run security:preflight
```

Verifica: módulo de hardening presente, cableado de `metricsGuard` y
`securityHeaders`, fortaleza de `GATEWAY_SECRET`/`GATEWAY_SHARED_SECRET`, coherencia de
`GATEWAY_MODE=enforce` y `METRICS_TOKEN` no trivial. Sirve tanto en el monolito como
dentro de un split (detecta el layout automáticamente).

## Rotación de secretos (post-push)

1. Generar un secreto nuevo (`openssl rand -hex 32`).
2. En los 11 servicios de Render: `GATEWAY_SECRET_PREVIOUS=<actual>`, `GATEWAY_SECRET=<nuevo>`.
3. En gateway y BFF: `GATEWAY_SECRET_PREVIOUS=<actual>`, `GATEWAY_SHARED_SECRET=<nuevo>`.
4. Redeploy gateway + BFF + servicios.
5. Quitar `GATEWAY_SECRET_PREVIOUS` en una segunda pasada.

## Tests agregados

- `metricsGuard` (abierto local, 404 desplegado sin token, 401/200 con token) y
  `clientIp` en los 11 servicios.
- `/metrics` de prom-client (contador HTTP + gauges de outbox/broker) en los 11 servicios.
- Rate limit de login (429 + `Retry-After`) en `user-service`.
- Gateway: 413 por body, 414 por URL, 429 por presupuesto, `/metrics` por entorno.

## Pendientes

- Portado a los 12 splits (gateway + 11 servicios) con `security:preflight` OK; el
  push sigue congelado por decisión de alcance.
- Rebuild verificado en la segunda PC: los 12 targets de `hotelsync-metrics` en `up` y
  `hotelsync_http_requests_total` con series en los 11 servicios (Docker Desktop exige
  sesión interactiva; por SSH falla la resolución de credenciales del registry).
- Evaluar zod v4 y Prisma 7 en una ventana separada.
