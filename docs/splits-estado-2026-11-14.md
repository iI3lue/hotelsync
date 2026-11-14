# Estado de los splits tras la migración (2026-11-14)

Ruta estable: `C:\Workspaces\hotelsync-splits`
Origen anterior: `C:\Users\juand\AppData\Local\Temp\opencode\hotelsync-split`

## Hallazgo principal

Los repos que se movieron desde `Temp` **tenían el árbol de trabajo vaciado**: conservan `.git`,
las carpetas (`src/`, `prisma/`, `tests/`, `node_modules/`) pero **sin archivos dentro**, y sin
`package.json`. Los "archivos modificados" que reportaba `git status` son en realidad **borrados**
(` D`), no ediciones.

Consecuencia: **no hay código local en los splits que rescatar**. Tras `git fetch`, ningún repo
tiene commits por delante de `origin/main`; todo el historial ya está en GitHub. El único código
real del proyecto vive en el monolito (`C:\Workspaces\...\HOTELSYNC`).

## Estado por repositorio

| Repo | HEAD | origin/main | Atrás | Adelante | Árbol de trabajo |
|---|---|---|---|---|---|
| `front-sync` | `8f22a2f` 11-02 | `8f22a2f` 11-02 | 0 | 0 | vaciado (171 borrados) |
| `hotelsync-api-gateway` | `40467fd` 11-02 | `40467fd` 11-02 | 0 | 0 | vaciado (12 borrados) |
| `hotelsync-property-service` | `efc2a4c` 11-01 | `c96ceaa` 11-02 | 1 | 0 | vaciado (44 borrados) |
| `hotelsync-rate-availability-service` | `19ac861` 11-01 | `f17b5dc` 11-02 | 1 | 0 | vaciado (53 borrados) |
| `hotelsync-booking-service` | `2fd0fa2` 10-14 | `06a692b` 11-02 | 6 | 0 | vaciado (41 borrados) |
| `hotelsync-analytics-service` | `2635925` 10-17 | `c0eabc0` 11-02 | 6 | 0 | vaciado (36 borrados) |
| `hotelsync-loyalty-service` | `f2a25ad` 10-18 | `661cd3d` 11-02 | 4 | 0 | vaciado (38 borrados) |
| `hotelsync-payment-service` | `0f57227` 10-14 | `d1a9061` 11-02 | 6 | 0 | vaciado (34 borrados) |

Clones nuevos (sanos, alineados con GitHub, sin cambios):

| Repo | HEAD |
|---|---|
| `hotelsync-billing-service` | `5ed1105` 11-02 |
| `hotelsync-front-desk-service` | `3e68577` 11-02 |
| `hotelsync-housekeeping-service` | `09cd52c` 11-02 |
| `hotelsync-channel-manager` | `1d0ddf8` 11-02 |
| `hotelsync-front` | `8f22a2f` 11-02 |
| `hotelsync-user-service` | `364bcdc` 11-02 |

## `_legacy`

`_legacy` **no estaba vacío**: contiene `gateway`, un snapshot con **253 archivos** de los 11
servicios (código de `src/`, `prisma/`, `tests/`, `Dockerfile`, etc.), byte-idéntico a `origin/main`
de cada repo en el momento del snapshot. Verificación previa al borrado: **ningún archivo existía
solo en `_legacy`**; los 14 repos vivos son superconjunto del snapshot. También había
1 archivo en `_legacy\hotelsync-front` (`.gitignore`, mismo contenido que el del split) y el resto
de las carpetas estaban vacías. Se borró junto con `Temp\opencode\hotelsync-split` (vacío).

Nota de encoding: algunos archivos de los splits tienen comentarios con mojibake
(p. ej. `loyalty-service/src/lib/consumer.ts`). No se normalizaron en esta ronda para no ensuciar
los diffs.

## Estado tras la ejecución (2026-11-14, tarde)

- **Monolito**: 11 commits locales (10 de la fase 2 + 1 de corrección de este documento), árbol
  limpio; sigue **sin push**.
- **Splits**: los 14 repos alineados con `origin/main` antes de la fase 3.
- **Métricas**: sincronizadas y commiteadas **localmente** en 6 splits (`api-gateway`, `property`,
  `rate-availability`, `booking`, `front-desk`, `user`) con `prom-client` y `/metrics` antes del
  middleware de secreto; `lint`, `test` y `build` en verde en cada uno.
- **Pendiente**: push (difiere deploys de Render). El clon duplicado `front-sync` se **conserva**
  por decisión explícita.

## Acciones recomendadas (actualizado)

1. ~~Restaurar los 8 árboles vaciados~~: hecho con `git reset --hard origin/main`; nada se perdió.
2. ~~Sincronizar el monitoreo en los cinco splits~~: hecho en **seis** splits (se omitía
   `api-gateway`). Ver `docs/api-gateway-cutover.md`; `ROLLOUT-GATEWAY.md` no existe.
3. ~~Borrar `_legacy` y la carpeta vieja de `Temp`~~: hecho, tras verificar que no había archivos
   únicos.
4. ~~Borrar `front-sync`~~: se decidió **conservarlo** (clon vaciado con el mismo remoto). Queda
   pendiente definir cuándo se hace push a los splits.
