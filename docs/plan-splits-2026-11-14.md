# Plan de restauración de splits y consolidación del monitoreo — 2026-11-14

Documento operativo derivado de `docs/splits-estado-2026-11-14.md`, verificado contra el disco.
Objetivo: dejar los 14 repos de splits en estado sano y alineado, commitear el trabajo pendiente del
monolito (bloqueo para mover de PC) y preparar la instrumentación de métricas sin tocar producción.

Alcance: **solo local**. No se hace push a GitHub en esta ronda porque Render auto-deploya al pushear
y la producción quedó diferida.

---

## 1. Estado verificado (antes de tocar nada)

### Splits en `C:\Workspaces\hotelsync-splits`

| Repo | HEAD | origin/main | Adelante | Atrás | Árbol | `package.json` |
|---|---|---|---|---|---|---|
| `front-sync` | `8f22a2f` | `8f22a2f` | 0 | 0 | 171 borrados, 0 untracked | ausente |
| `hotelsync-api-gateway` | `40467fd` | `40467fd` | 0 | 0 | 12 borrados | ausente |
| `hotelsync-property-service` | `efc2a4c` | `c96ceaa` | 0 | 1 | 44 borrados | ausente |
| `hotelsync-rate-availability-service` | `19ac861` | `f17b5dc` | 0 | 1 | 53 borrados | ausente |
| `hotelsync-booking-service` | `2fd0fa2` | `06a692b` | 0 | 6 | 41 borrados + 1 untracked (`.gitignore`) | ausente |
| `hotelsync-analytics-service` | `2635925` | `c0eabc0` | 0 | 6 | 36 borrados | ausente |
| `hotelsync-loyalty-service` | `f2a25ad` | `661cd3d` | 0 | 4 | 38 borrados | ausente |
| `hotelsync-payment-service` | `0f57227` | `d1a9061` | 0 | 6 | 34 borrados + 1 untracked (`.gitignore`) | ausente |
| `hotelsync-billing-service` | `5ed1105` | = | 0 | 0 | limpio | presente |
| `hotelsync-channel-manager` | `1d0ddf8` | = | 0 | 0 | limpio | presente |
| `hotelsync-front` | `8f22a2f` | = | 0 | 0 | limpio | presente |
| `hotelsync-front-desk-service` | `3e68577` | = | 0 | 0 | limpio | presente |
| `hotelsync-housekeeping-service` | `09cd52c` | = | 0 | 0 | limpio | presente |
| `hotelsync-user-service` | `364bcdc` | = | 0 | 0 | limpio | presente |

Conclusión: los 8 repos vaciados **no tienen contenido propio que rescatar** (solo borrados y ningún
commit por delante). Los 2 `.gitignore` sueltos no aportan nada y `git reset --hard` los sobrescribe.

### Monolito (`C:\Workspaces\UCC\Arquitectuta de plataformas tecnologicas\HOTELSYNC`)

- 76 archivos modificados + ~40 sin trackear, todo sin commitear (HEAD `a06b7f4`).
- `services/api-gateway/` está **enteramente sin trackear**: el servicio no existe en git.
- Instrumentación `prom-client` en **6** servicios: `api-gateway`, `property`, `rate-availability`,
  `booking`, `front-desk`, `user`.
- `analytics-service/src/lib/metrics.ts` existe pero es el módulo de métricas **de negocio**
  (ADR/RevPAR), sin prom-client: no cuenta como instrumentación de infraestructura.
- Stack de monitoreo local corriendo (`monitoring/`): Prometheus 9090, Grafana 3030, blackbox 9115.
- Stack local de servicios corriendo en Docker (`docker compose up -d`), con property y gateway
  reconstruidos con la instrumentación.

---

## 2. Correcciones al documento de estado

1. **`_legacy\gateway` no está vacío**: tiene 253 archivos (230 `.ts`, código de los 11 servicios).
   Verificado por hash de blob: es **byte-idéntico a `origin/main`** de cada repo. Es un snapshot
   redundante de lo desplegado. Se puede borrar, pero por ser redundante, no por estar vacío.
2. **No son cinco servicios instrumentados, son seis** (el documento omite `api-gateway`).
3. `_legacy\hotelsync-front` tiene 1 archivo (`.gitignore`); `Temp\opencode\hotelsync-split` está vacío.
4. Los `.env.example` citan `ROLLOUT-GATEWAY.md`, que **no existe**; el documento real es
   `docs/api-gateway-cutover.md`.
5. Detalle de encoding: algunos archivos de los splits tienen comentarios con mojibake (p. ej.
   `loyalty-service/src/lib/consumer.ts`). No se corrige en esta ronda para no ensuciar los diffs.

---

## 3. Fase 1 — Restaurar los 8 splits

```powershell
$repos = @(
  "front-sync",
  "hotelsync-api-gateway",
  "hotelsync-property-service",
  "hotelsync-rate-availability-service",
  "hotelsync-booking-service",
  "hotelsync-analytics-service",
  "hotelsync-loyalty-service",
  "hotelsync-payment-service"
)
foreach ($r in $repos) {
  $p = Join-Path "C:\Workspaces\hotelsync-splits" $r
  git -C $p fetch --prune origin
  git -C $p reset --hard origin/main
  git -C $p status --short
}
```

Verificación por repo: `HEAD` coincide con la columna `origin/main` de la tabla, árbol limpio y
`package.json` presente.

---

## 4. Fase 2 — Commitear el monolito (10 unidades)

Cada commit debe compilar en su punto. Los mensajes siguen el estilo del repo (conventional commits,
en inglés). No se agregan trailers de IA.

| # | Mensaje | Contenido |
|---|---|---|
| A | `feat(gateway): add edge API gateway with shared secret and wake-up` | `services/api-gateway/**`; servicio `api-gateway` en `docker-compose.yml`; hunk `dev:gateway` de `package.json` (staging selectivo con `git add -p`); `npm run build --workspace=services/api-gateway` en `ci.yml` |
| B | `feat(services): verify edge secret and expose prom-client metrics` | `services/*/src/middleware/gateway.ts`; `services/*/src/lib/metrics.ts`; `isConnected` en `broker.ts` (property, rate, booking, front-desk); cableado en `index.ts`/`app.ts`; `gatewayHeaders()` en clientes salientes (billing, booking, front-desk, housekeeping, loyalty, payment, rate, channel-manager); `tests/unit/gateway.test.ts`; `.env.example` con `GATEWAY_*`; deps `prom-client` + `package-lock.json` |
| C | `feat(channel-manager): retry consumer deliveries and dead-letter failures` | `services/channel-manager-service/src/lib/broker.ts`; `tests/unit/broker.test.ts` |
| D | `fix(front): route API through gateway with auth headers and timeouts` | `apps/front/**` (BFF auth, `timeout-signal`, simulador, tests) |
| E | `feat(monitoring): add local Prometheus, Grafana and blackbox stack` | `monitoring/**`; scripts `monitoring:*` de `package.json` |
| F | `fix(property): enforce hotel scope when creating cancellation policies` | `cancellation-policy.{controller,service}.ts`, ruta, test de integración |
| G | `feat(rate): validate create-rate payload` | `validators/rates.ts`, `routes/rates.ts`, `tests/unit/create-rate-schema.test.ts` |
| I | `fix(prisma): generate a per-service client to stop workspace hoisting` | `payment` y `loyalty`: `prisma/schema.prisma` (`output`) + alias `paths` en `tsconfig.json` |
| J | `test(services): add HTTP integration coverage for billing, housekeeping, loyalty and user` | Suites `tests/integration/` nuevas + `tests/helpers/tokens.ts` + `supertest` de loyalty |
| H | `docs: document gateway cutover and update architecture notes` | `docs/**`, `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `scripts/t0-baseline.mjs` |

Notas de staging:
- B y C no se separan más porque `index.ts` comparte hunks entre verificación de secreto y métricas;
  no existe un estado intermedio compilable.
- A y E comparten `package.json` raíz: en A se stagea solo el hunk de `dev:gateway`; el bloque
  `monitoring:*` va en E.
- `ci.yml` va en A (no en H): el job de build debe conocer el workspace nuevo en el mismo commit.
- I y J se agregaron después de la primera versión de este plan (fix de Prisma y suites nuevas).
- `package-lock.json` se stagea completo en B; incluye las entradas de `supertest` que usa J.

Verificación antes de cerrar: `npm run lint` y `npm test` en la raíz (workspaces) + `npm run build`.

---

## 5. Fase 3 — Sincronizar el monitoreo a los 6 splits (sin push)

Regla: **parche quirúrgico**. Nunca copiar `Dockerfile`, `tsconfig.json`, `.env.example` ni
`package.json` completos: difieren por diseño entre monorepo y split (verificado en `api-gateway`:
4 archivos de infraestructura distintos). Solo se agrega lo nuevo y se tocan las líneas mínimas.

| Split | `src/lib/metrics.ts` | Cableado | `isConnected` en broker | Líneas a insertar |
|---|---|---|---|---|
| `hotelsync-api-gateway` | sí (sin prisma/broker) | `src/app.ts` | no | `app.use(httpMetrics)`, `app.get("/metrics", metricsHandler)` |
| `hotelsync-property-service` | sí (+outbox/broker) | `src/index.ts` | sí | `app.use(httpMetrics)`, `app.get("/metrics", …)`, `app.use(requireGateway)` ya existe |
| `hotelsync-rate-availability-service` | sí (+outbox/broker) | `src/index.ts` | sí | idem |
| `hotelsync-booking-service` | sí (+outbox/broker) | `src/index.ts` | sí | idem |
| `hotelsync-front-desk-service` | sí (+outbox/broker) | `src/index.ts` | sí | idem |
| `hotelsync-user-service` | sí (solo HTTP) | `src/index.ts` | no | idem |

Pasos por repo:

```powershell
# dentro de C:\Workspaces\hotelsync-splits\<repo>
npm install prom-client@^15.1.3
npx prisma generate            # obligatorio antes de tsc en splits
npm run lint                   # tsc --noEmit
npm test
npm run build
git add src package.json package-lock.json
git commit -m "feat(observability): expose prom-client metrics"
```

Criterios:
- `/metrics` montado **antes** del middleware de secreto (igual que `/health`), para que Prometheus
  pueda scrapear directo. Riesgo asumido y documentado: queda sin autenticar hasta definición de
  producción.
- El label de ruta se normaliza (`req.route.path` en servicios; UUID/numérico → `:id` en el gateway).
- `service` no se fija como default label en el registry: lo aporta el scrape config de Prometheus,
  evitando colisiones con `honor_labels: false`.
- Commits locales; **sin push**.

---

## 6. Fase 4 — Limpieza

1. Borrar `C:\Workspaces\hotelsync-splits\_legacy` (verificado redundante: hash idéntico a
   `origin/main`; `_legacy\hotelsync-front` solo tiene `.gitignore`).
2. Borrar `C:\Users\juand\AppData\Local\Temp\opencode\hotelsync-split` (vacío).
3. Clon del front duplicado: quedarse con `hotelsync-front` (sano) y eliminar `front-sync` (vaciado,
   mismo remoto, sin contenido propio). Confirmar antes de borrar.

---

## 7. Fase 5 — Actualizar `docs/splits-estado-2026-11-14.md`

Aplicar las correcciones de la sección 2 (motivo real de borrado de `_legacy`, seis servicios
instrumentados, referencia a `ROLLOUT-GATEWAY.md`).

---

## 8. Riesgos y decisiones abiertas

- **Push diferido**: cada push a un split dispara deploy en Render. Hasta que se decida, los cambios
  quedan solo en local.
- **`/metrics` sin auth**: aceptable en local; en producción requiere restricción (red privada,
  gateway o secreto) antes de exponerlo.
- **`index.ts` acoplado**: auth de borde y métricas comparten hunks; por eso van en un mismo commit.
- **Cliente front duplicado**: decisión de borrar `front-sync` requiere confirmación explícita.
- **Encoding de splits**: no normalizar comentarios en esta ronda.

## 9. Criterios de aceptación

- Los 14 repos de splits: árbol limpio (o con commits locales propios de la fase 3) y `HEAD` alineado
  con `origin/main` antes de la fase 3.
- Monolito: `git status` limpio, 10 commits, `lint` + `test` + `build` en verde.
  (`apps/front` no tiene configuración de ESLint y `loyalty-service` no define script `lint`; el gate
  real de lint son los 11 `tsc --noEmit` de servicios. CI no corre lint.)
- Splits instrumentados: `/metrics` responde 200 con `hotelsync_http_requests_total` y
  `hotelsync_process_*`; `lint`/`test`/`build` en verde.
- `_legacy` y el Temp viejo eliminados; documento de estado corregido.
