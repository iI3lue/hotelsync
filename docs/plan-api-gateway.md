# Plan: API Gateway detrás del BFF

**Estado:** planificación cerrada. Sin código de gateway todavía.
**Fecha:** 2026-11-01
**Alcance:** fases 1–3. El BFF se conserva como entrada pública y el gateway queda detrás.
**Fuera de alcance:** rate limiting distribuido con Redis y observabilidad con Prometheus/Grafana. No se implementan todavía.

## 1. Decisión de arquitectura

- El BFF de Next.js sigue siendo el único entrypoint público y el dueño de Auth0.
- El gateway es un servicio interno de enrutamiento hacia los microservicios.
- No se elimina el BFF ni se migra a OAuth de SPA.
- `/api/auth/*`, `/api/rates`, `/api/warmup` y `/api/simulator/*` siguen en Next.
- El gateway no decide roles ni valida identidad en esta etapa: solo enruta y aplica secreto compartido.
- El gateway es un punto único de fallo; en Render free agrega cold start. Para producción estable necesita instancia siempre activa.

## 2. Contrato de rutas

| Prefijo público (BFF) | Ruta interna del gateway | Destino |
|---|---|---|
| `/api/property/*` | `/property/*` | `PROPERTY_SERVICE_URL` |
| `/api/rate/*` | `/rate/*` | `RATE_AVAILABILITY_SERVICE_URL` |
| `/api/users/*` | `/users/*` | `USER_SERVICE_URL` |
| `/api/booking/*` | `/booking/*` | `BOOKING_SERVICE_URL` |
| `/api/front-desk/*` | `/front-desk/*` | `FRONT_DESK_SERVICE_URL` |
| `/api/housekeeping/*` | `/housekeeping/*` | `HOUSEKEEPING_SERVICE_URL` |
| `/api/billing/*` | `/billing/*` | `BILLING_SERVICE_URL` |
| `/api/loyalty/*` | `/loyalty/*` | `LOYALTY_SERVICE_URL` |
| `/api/payments/*` | `/payments/*` | `PAYMENTS_SERVICE_URL` |
| `/api/analytics/*` | `/analytics/*` | `ANALYTICS_SERVICE_URL` |
| `/api/simulator/*` | `/channel-manager/*` | `CHANNEL_MANAGER_SERVICE_URL` |

Rutas que no pasan por el gateway: `/api/auth/*`, `/api/rates`, `/api/warmup`.

## 3. Reglas de ejecución

- Una tarea equivale a un cambio pequeño, revisable y desplegable por separado.
- No se empieza una tarea hasta cerrar la anterior.
- Cada tarea debe dejar build, lint y tests en verde.
- Cada tarea debe tener demo reproducible y rollback claro.
- Los cambios de tráfico se activan por grupos, nunca todos juntos.
- No se agregan reintentos automáticos en POST/PUT/PATCH.
- No se cachea nada en el gateway.
- No se sincroniza producción en local para planificar. Se evalúa antes de T6 y T9, y solo si hay drift real con los splits.

## 4. Checklist de ejecución

### T0 — Línea base y contrato de rutas

- [ ] Inventariar las 10 rutas del BFF y sus respuestas esperadas.
- [ ] Ejecutar smoke tests: login local, login Google, reserva, check-in, checkout y analytics.
- [ ] Registrar estados HTTP y latencias actuales como oráculo de regresión.

**Entregable:** checklist de comportamiento actual verificable.
**Aceptación:** existe una referencia concreta para comparar después de cada cambio.
**Estimación:** 0,5 día.

### T1 — Esqueleto del gateway

- [ ] Crear `services/api-gateway` con TypeScript y Express.
- [ ] Agregar `GET /health` sin dependencias externas.
- [ ] Validar configuración con Zod.
- [ ] Agregar logs JSON básicos con `request_id`.
- [ ] Agregar script `dev:gateway` en la raíz.
- [ ] Agregar build y tests a `.github/workflows/ci.yml`.

**Entregable:** gateway mínimo que arranca y responde salud.
**Aceptación:** build, lint y tests pasan; `/health` responde 200 en local.
**Estimación:** 0,5–1 día.

### T2 — Proxy de una sola ruta

- [ ] Enrutar `/property/*` hacia `PROPERTY_SERVICE_URL`.
- [ ] Preservar método, status, body y headers permitidos.
- [ ] Propagar `x-request-id` y aplicar timeout configurable.
- [ ] Devolver `502/504` controlados si el upstream falla.
- [ ] Probar con upstream mock y sin reintentos en POST.

**Entregable:** proxy funcional para property.
**Aceptación:** `GET /property/hotels` devuelve lo mismo que ir directo; upstream caído no cuelga.
**Estimación:** 1 día.

### T3 — Tabla completa de rutas

- [ ] Declarar las 11 rutas en una sola tabla de configuración.
- [ ] Agregar `/channel-manager/*` para uso interno del BFF.
- [ ] Devolver `404` controlado para prefijos desconocidos.
- [ ] Escribir tests table-driven para todas las rutas.

**Entregable:** cobertura de todos los servicios sin lógica duplicada.
**Aceptación:** todas las rutas responden igual que en T0.
**Estimación:** 1 día.

### T4 — Endurecimiento del borde

- [ ] Exigir `x-gateway-secret` salvo en `/health`.
- [ ] Strippear `cookie`, `x-service-key`, `x-loyalty-key`, `x-provider-key` y `x-internal-*`.
- [ ] Sobrescribir `x-request-id` y `x-client-ip`.
- [ ] Pasar `Authorization` sin modificarlo.
- [ ] Cubrir spoofing y acceso sin secreto con tests.

**Entregable:** gateway no utilizable como proxy abierto.
**Aceptación:** sin secreto devuelve `401`; no se filtran claves internas.
**Nota:** la autorización sigue en los servicios; el gateway no valida JWT ni roles.
**Estimación:** 0,5–1 día.

### T5 — Despliegue del gateway sin tráfico

- [ ] Crear servicio en Render con build y start definidos.
- [ ] Configurar variables de entorno y health check.
- [ ] Publicar `/health` y verificar logs de arranque.
- [ ] Mantener el BFF apuntando directo a los servicios.

**Entregable:** gateway desplegado pero inactivo para usuarios.
**Aceptación:** `/health` público responde 200; no hay tráfico de negocio.
**Estimación:** 0,5 día.

### T6 — Integración del BFF: solo property

- [ ] Agregar `GATEWAY_URL`, `GATEWAY_SHARED_SECRET` y `GATEWAY_SERVICES` en Vercel.
- [ ] Hacer que `next.config.js` use el gateway solo para property.
- [ ] Inyectar `x-gateway-secret` y `x-client-ip` desde el middleware.
- [ ] Probar rollback con `GATEWAY_SERVICES=""` y redeploy.
- [ ] Verificar login local, login Google, callback, logout y `/admin`.

**Entregable:** canary de property a través del gateway.
**Aceptación:** property funciona por gateway; Auth0 no cambia.
**Estimación:** 1 día.

### T7 — Integración del BFF: resto y simulador

- [ ] Activar rate, booking/front-desk, housekeeping/billing y loyalty/payments/analytics por grupos.
- [ ] Apuntar el Route Handler del simulador a `/channel-manager/*`.
- [ ] Mantener `/api/auth/*`, `/api/rates` y `/api/warmup` en Next.
- [ ] Probar rollback por grupo.

**Entregable:** migración completa y reversible.
**Aceptación:** reserva, check-in, checkout y analytics funcionan; un grupo puede volver a destino directo.
**Estimación:** 0,5–1 día.

### T8 — Rate limiting en memoria (opcional)

- [ ] Limitar por ruta y por `sub` o `x-client-ip`.
- [ ] Configurar ventanas y máximos por entorno.
- [ ] Escribir tests de `429`.
- [ ] Documentar que no es distribuido y se reinicia con el proceso.

**Entregable:** protección básica contra abuso sin Redis.
**Aceptación:** los límites se aplican y no bloquean a todos los usuarios por compartir la IP de Vercel.
**Nota:** si no se quiere rate limiting todavía, esta tarea se salta.
**Estimación:** 0,5–1 día.

### T9 — Cutover y rollback

- [ ] Validar el gateway real desde preview de Vercel.
- [ ] Activar grupos de tráfico de forma progresiva.
- [ ] Ejecutar checklist de cutover y rollback.
- [ ] Observar logs y `/health` durante 24–48 h.

**Entregable:** producción usando el gateway con salida rápida.
**Aceptación:** todas las rutas pasan por el gateway; rollback completo en menos de 10 minutos.
**Estimación:** 0,5–1 día.

### T10 — Cierre documental y local

- [ ] Agregar el gateway a `docker-compose.yml` en el puerto 8080.
- [ ] Actualizar README y ARCHITECTURE: gateway interno detrás del BFF.
- [ ] Actualizar AS-BUILT: gateway implementado; Redis y observabilidad pendientes.
- [ ] Dejar CI del monorepo y del split en verde.

**Entregable:** repositorio y documentación coherentes.
**Aceptación:** `docker compose up` levanta el gateway; no se afirma que existan Redis o Prometheus en producción.
**Estimación:** 0,5 día.

## 5. Variables de entorno previstas

### BFF

- `GATEWAY_URL`
- `GATEWAY_SHARED_SECRET`
- `GATEWAY_SERVICES` — lista separada por comas; vacía = rollback total.
- `USE_GATEWAY` — flag global de conveniencia.

### Gateway

- `PORT`
- `GATEWAY_SHARED_SECRET`
- `PROPERTY_SERVICE_URL`
- `RATE_AVAILABILITY_SERVICE_URL`
- `USER_SERVICE_URL`
- `BOOKING_SERVICE_URL`
- `FRONT_DESK_SERVICE_URL`
- `HOUSEKEEPING_SERVICE_URL`
- `BILLING_SERVICE_URL`
- `LOYALTY_SERVICE_URL`
- `PAYMENTS_SERVICE_URL`
- `ANALYTICS_SERVICE_URL`
- `CHANNEL_MANAGER_SERVICE_URL`
- `UPSTREAM_TIMEOUT_MS`

Sin `REDIS_URL` y sin `METRICS_TOKEN` en esta etapa.

## 6. Rollback

- Rollback de tráfico: `GATEWAY_SERVICES=""` en Vercel y redeploy.
- Rollback por grupo: quitar el servicio de `GATEWAY_SERVICES` y redeploy.
- Rollback de gateway: el BFF vuelve a los destinos directos; el servicio Render puede quedar encendido sin tráfico.
- No se modifican cookies, callback ni reglas de Auth0, por lo que el rollback no afecta sesiones.

## 7. Riesgos de este alcance

- Sin Redis, el rate limiting es local, no distribuido y se reinicia con el proceso.
- Sin Prometheus/Grafana, el cutover se valida con logs de Render, `/health` y pruebas manuales; no hay dashboards ni alertas.
- El gateway es un punto único de fallo y en Render free agrega cold start.
- El gateway es público: el secreto compartido evita uso casual, pero no es una frontera de red. Los servicios siguen accesibles directamente hasta que se aborde red privada.
- Sin staging, la validación fuerte es local, preview de Vercel y canary por grupos.
- El monorepo local tiene cambios sin commitear; cualquier sincronización con producción debe ser quirúrgica y posterior a T0.

## 8. Sincronización producción → local

No se ejecuta en esta etapa. El plan no modifica código de servicios ni requiere el estado de producción. Antes de T6 y T9 se comparará el código local contra los splits desplegados; si hay drift real, se sincronizará archivo por archivo, nunca con copia ciega.

## 9. Primer paso

Ejecutar T0 y T1. T0 congela el comportamiento actual; T1 entrega el esqueleto del gateway con salud y CI. No se toca el BFF hasta que el proxy de una ruta (T2) esté probado.
