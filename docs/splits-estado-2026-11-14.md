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

Siete carpetas (`hotelsync-billing-service`, `hotelsync-front-desk-service`,
`hotelsync-housekeeping-service`, `hotelsync-front`, `hotelsync-booking-service-old-nogit`,
`gateway`, `user-service-repo`): **cero archivos de `src/`, `prisma/` o `tests/`**; solo el interior
de `.git` y directorios vacíos. No hay nada que rescatar; se pueden borrar junto con
`Temp\opencode\hotelsync-split`.

## Acciones recomendadas

1. Restaurar los 8 árboles vaciados y alinearlos con GitHub:
   `git -C <repo> reset --hard origin/main`
   (no se pierde nada: no hay contenido local propio).
2. Recién entonces sincronizar el monitoreo (`src/lib/metrics.ts` + cableado en `index.ts` +
   `prom-client`) en los cinco splits ya instrumentados en el monolito.
3. Borrar `_legacy` y la carpeta vieja de `Temp` cuando el punto 1 esté verificado.
4. Recordatorio: el monolito sigue con el trabajo de monitoreo **sin commitear**; es el bloqueo
   pendiente para mover todo a otro PC.
