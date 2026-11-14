# Cutover y rollback — API Gateway

Runbook de T9. Aplica al gateway interno detrás del BFF (`services/api-gateway`, Render
`https://hotelsync-api-gateway-tu1c.onrender.com`) y al BFF (`iI3lue/hotelsync-front` en Vercel).

**Estado al 2026-11-02 02:18 UTC:** los 10 grupos del BFF ya están activos en producción
(`property,rate,booking,front-desk,housekeeping,billing,loyalty,payments,analytics,channel-manager`).
`/api/users/*` queda fuera del alcance. El drill de rollback cronometrado está pendiente.

## 1. Arquitectura en una línea

```
navegador → Vercel (apps/front) → /api/<servicio>/* → rewrite a GATEWAY_URL/<servicio>/*
          → gateway (secreto compartido) → servicio en Render
```

El BFF sigue siendo el único punto público y el dueño de Auth0. El gateway no maneja cookies
ni sesiones: solo reenvía `Authorization` y descarta cabeceras internas.

## 2. Pre-flight (antes de tocar tráfico)

- [ ] `/health` del gateway responde `{"status":"ok"}`.
- [ ] El secreto del gateway en Render coincide con `GATEWAY_SHARED_SECRET` de Vercel.
- [ ] Las 12 variables `*_SERVICE_URL` apuntan al servicio correcto (incluida
      `CHANNEL_MANAGER_SERVICE_URL` terminada en `/v1/simulator`).
- [ ] `UPSTREAM_TIMEOUT_MS=45000` (los servicios free duermen; con 10 s se cortaba en frío).
- [ ] Baseline local en verde: `node scripts/t0-baseline.mjs --with-flows` → 22/22.

## 3. Activación progresiva

`GATEWAY_SERVICES` es una lista separada por comas. **El middleware de Next inlina esa
variable en el build**: cambiarla sin redeploy no tiene efecto (verificado en T7).

Procedimiento por grupo (repetible para cada uno):

1. Agregar el grupo a `GATEWAY_SERVICES` en Vercel (scope **Production**).
2. Deployments → último → **Redeploy** (sin "Use existing build cache").
3. Verificar que la respuesta trae `x-request-id` y que ese mismo `request_id` aparece en el
   log de Render del gateway con el path sin `/api`.
4. Si algo falla: quitar el grupo y redeploy (vuelve a destino directo en ~2 min).

Orden recomendado si hay que rehacer el cutover desde cero:

| Paso | Grupos | Riesgo |
| --- | --- | --- |
| 1 | `property,rate` | lecturas públicas |
| 2 | `loyalty,payments,analytics` | lecturas con sesión |
| 3 | `booking,front-desk` | escrituras del flujo de reserva |
| 4 | `housekeeping,billing` | operación diaria |
| 5 | `channel-manager` | simulador (solo SUPER_ADMIN) |

## 4. Checklist de cutover

- [ ] `GATEWAY_SERVICES` con la lista completa y redeploy en Production.
- [ ] Rutas públicas: `property`, `rate`, `loyalty` responden 200 con `x-request-id`.
- [ ] Flujo de reserva con sesión real: reserva → confirmar → check-in → folio → checkout.
- [ ] `/admin/analytics` carga con MANAGER/SUPER_ADMIN.
- [ ] Simulador: `POST /api/simulator/reservations` responde 201.
- [ ] Login, logout y redirect post-logout (`/cuenta/entrar?returnTo=/admin`) intactos.
- [ ] Sin errores en el log del gateway durante la ventana del cutover.

Comandos de verificación (PowerShell):

```powershell
# salud del gateway
(Invoke-WebRequest https://hotelsync-api-gateway-tu1c.onrender.com/health -UseBasicParsing).Content

# smoke público: la respuesta debe traer x-request-id
$r = Invoke-WebRequest https://hotelsync-front.vercel.app/api/property/hotels -UseBasicParsing
$r.Headers["x-request-id"]
```

Para confirmar que un request pasó por el gateway, buscar ese `x-request-id` en los logs de
Render del servicio `hotelsync-api-gateway` (Dashboard → Logs, o `render_list_logs` por
`resource=srv-dbju8cvb9u1s73f32jag`).

## 5. Rollback

| Alcance | Acción | Efecto |
| --- | --- | --- |
| Total | `GATEWAY_SERVICES=""` + redeploy | todo el BFF vuelve a destinos directos |
| Por grupo | quitar el grupo de la lista + redeploy | ese grupo vuelve a directo, el resto sigue por el gateway |
| Gateway | dejar el servicio Render encendido sin tráfico | rollback de tráfico ya lo aísla |

No se tocan cookies, callbacks ni reglas de Auth0: el rollback no afecta sesiones activas.
El gateway puede quedar encendido; sin tráfico no consume.

## 6. Drill de rollback (aceptación: < 10 min)

1. Anotar hora de inicio.
2. Vercel → `GATEWAY_SERVICES=""` → **Redeploy**.
3. Verificar que `/api/rate/rates` ya **no** trae `x-request-id` y que no aparecen líneas
   nuevas en el log del gateway.
4. Restaurar la lista completa → **Redeploy**.
5. Verificar que `/api/rate/rates` vuelve a traer `x-request-id` con match en el log.
6. Anotar duración total (objetivo: menos de 10 minutos; con redeploy de Vercel ~2 min por
   ciclo, el drill completo debería cerrar en 4–6 min).

Registrar el resultado en la sección 9.

## 7. Observación 24–48 h

- Ventana iniciada: **2026-11-02 02:18 UTC**.
- Cada 6–8 h revisar:
  - `/health` del gateway (200).
  - Logs de Render del gateway filtrados por `level=error` y `proxy.upstream_timeout`.
  - `status=504` o `502` en el log: indican servicio dormido o caído.
- Umbral de acción: un 504/502 aislado en el primer request tras inactividad es esperable
  (cold start); dos seguidos sobre el mismo servicio es señal para revisar ese servicio.
- Buscar `wake.broadcast` en el log del gateway: confirma que el despertar de los 11 servicios
  corrió. `waking` = el edge devolvió 502/503/504, o sea el arranque se disparó y la instancia
  todavía estaba subiendo (lo normal tras inactividad); `failed` = error de red, timeout o status
  inesperado, eso sí requiere revisar ese servicio. `WAKE_ALL_INTERVAL_MS` (30 min por defecto)
  acota la frecuencia.
- Al cierre de la ventana: actualizar el estado en el plan (`docs/plan-api-gateway.md`).

## 8. Limitaciones conocidas

- El gateway es un punto único de fallo y agrega cold start en Render free.
- **502 de cold start:** con el servicio dormido, el edge de Render responde 502 en decenas de
  milisegundos y el gateway lo reenvía tal cual (no genera `proxy.upstream_unavailable`). No es un
  bug del gateway: el mismo request funciona apenas el servicio termina de arrancar (un `/health`
  directo lo confirma). Mitigación: el gateway despierta los 11 servicios en el primer request
  autenticado (`wake.broadcast`, ventana `WAKE_ALL_INTERVAL_MS` = 30 min) y el front reintenta
  GETs ante 502/503/504 (3 intentos: 1 s / 3 s / 7 s). Verificado en producción el 2026-11-02: el
  broadcast de 03:27:53 disparó el arranque de analytics (03:27:59) y housekeeping (03:28:06); los
  502 del edge no impiden el wake-up, solo lo reportan como pendiente (`waking`).
- El gateway es público: el secreto compartido evita uso casual, no es una frontera de red.
  Los servicios siguen siendo accesibles directamente.
- Sin Redis no hay rate limiting distribuido (T8 queda opcional).
- Sin Prometheus/Grafana no hay dashboards ni alertas: la observación es manual sobre logs.
- Los previews de Vercel están deshabilitados en `iI3lue/hotelsync-front`, así que la
  validación previa se hace en local + producción con `request_id`.

## 9. Registro de ejecución

| Fecha (UTC) | Acción | Resultado |
| --- | --- | --- |
| 2026-11-02 02:10 | Cutover completo (T7) | property/rate/loyalty 200 con `request_id` en el gateway |
| 2026-11-02 02:18 | Inicio de observación | `/health` ok, sin errores ni timeouts en la última hora |
| 2026-11-02 02:26 | Drill: rollback total (`GATEWAY_SERVICES=""` + redeploy) | property/rate/loyalty 200 **sin** `x-request-id`; cero tráfico en el log del gateway |
| 2026-11-02 02:28 | Drill: restauración de la lista completa + redeploy | los tres `request_id` (`957e8e7c`, `a432e8e3`, `5e997ce5`) aparecen en el log del gateway con 200 |
| 2026-11-02 02:55–02:57 | Uso real con credenciales de producción (login + `/admin`) | login OK; `/admin` cargó, pero analytics, housekeeping y el simulador OTA devolvieron **502** |
| 2026-11-02 03:00 | Diagnóstico del 502 | los 502 duran 40–140 ms y **no** hay `proxy.upstream_unavailable`: vienen del edge de Render con la instancia dormida. Tras `/health`, las mismas rutas responden 401/404 (upstream vivo) |
| 2026-11-02 03:20 | Mitigación implementada | wake broadcast en el gateway (30 min) + retry de GET ante 502/503/504 en `api-client` |
| 2026-11-02 03:27 | Despliegue del gateway con wake broadcast | `wake.broadcast` en Render con `targets=11`, `waking=9`; los 9 servicios arrancaron en 6-13 s (analytics 03:27:59, housekeeping 03:28:06) y los 11 `/health` quedaron en 200 a <1,2 s |
| 2026-11-02 03:35 | Semántica del log corregida | 502/503/504 del edge se cuentan como `waking` (el arranque ya se disparó) y solo red/timeout/otro status como `failed` |

Duración observada del ciclo de restauración: ~2,5 min (deployment Ready a verificación). El ciclo
de rollback fue verificado de punta a punta dentro de la misma ventana de 10 min. Los redeploys
manuales de Vercel no dejan registro en GitHub Deployments, así que la duración exacta se midió
con la hora de verificación, no con un cronómetro externo.
