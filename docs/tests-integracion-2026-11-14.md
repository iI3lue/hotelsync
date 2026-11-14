# Tests de integración — cierre del requisito (2026-11-14)

Requisito: **mínimo 2 tests unitarios + 1 de integración por microservicio** (Jest).

## Estado

- **Cumplimiento: 12/12 microservicios** con unitarios e integración.
- **Conteo real** (`npm test -- --runInBand`, raíz): **631 casos en los 12 servicios** + **105 en `apps/front`** = **736, 0 fallos**.
- Los conteos estáticos previos (~559 en servicios) eran un piso: Jest expande `it.each` e `it.each` de tablas.

| Servicio | Casos |
|---|---|
| analytics-service | 35 |
| api-gateway | 65 |
| billing-service | 33 |
| booking-service | 96 |
| channel-manager-service | 19 |
| front-desk-service | 42 |
| housekeeping-service | 41 |
| loyalty-service | 33 |
| payment-service | 57 |
| property-service | 48 |
| rate-availability-service | 71 |
| user-service | 91 |
| apps/front | 105 |

## Hueco que se cerró

Antes de este trabajo faltaba integración en **billing, housekeeping, loyalty y user**. Se agregaron 4 suites HTTP con 44 casos nuevos.

| Archivo nuevo | Casos | Qué cubre |
|---|---|---|
| `services/billing-service/tests/integration/folios.test.ts` | 11 | 401 sin token, 403 GUEST, 400 de Zod (monto negativo), 404 folio inexistente, 409 folio no `open`, 403 staff de otro hotel, 201 cargo + `folios.total` sincronizado, `by-booking` 404/403/200, cierre idempotente (no re-emite factura) y cierre con `invoice.create` + `folio.closed` en la misma transacción |
| `services/housekeeping-service/tests/integration/tasks.test.ts` | 12 | 401, `GET /mine` filtra por `sub` + `status`, 403 GUEST, 404, 403 housekeeper no asignado, 409 transición inválida, `start` → `in_progress` + habitación `cleaning`, `complete` → `done` + habitación `clean`, MANAGER del hotel vs otro hotel |
| `services/loyalty-service/tests/integration/loyalty.test.ts` | 12 | `GET /v1/levels` público, 401 sin token y con `sub` no UUID, `/v1/me` con cuenta existente y con auto-creación, redeem 400 por validación y por saldo insuficiente, redeem 200 (descuento de saldo), 404 sin cuenta, admin 403 GUEST y 200 MANAGER |
| `services/user-service/tests/integration/auth.test.ts` | 9 | register 400 sin `terms_accepted`, 409 email duplicado, 201 con sesión, login 401 password incorrecta, 403 sin rol activo, 200 con `assignment`, `/users/me` 401/200/404 |

Helpers nuevos (copia local del contrato de `user-service`, para que el split standalone corra sin el monorepo):

- `services/billing-service/tests/helpers/tokens.ts`
- `services/housekeeping-service/tests/helpers/tokens.ts`
- `services/loyalty-service/tests/helpers/tokens.ts`

Dependencia agregada: `supertest` + `@types/supertest` en `services/loyalty-service` (era el único servicio sin ellas).

## Patrón usado (igual al de los 124 casos de integración previos)

- `supertest` contra una app Express armada en el test (`express.json()` + solo los routers bajo prueba + `errorHandler`).
- `jest.mock` de Prisma y de clientes HTTP/RabbitMQ; **sin DB ni red**.
- Tokens firmados con el helper local (HS256, `iss hotelsync`, `aud hotelsync-api`).
- `beforeEach(jest.clearAllMocks)` y `$transaction` mockeado ejecutando el callback con un `tx` falso.

## Bug preexistente corregido de paso

`payment-service` estaba rojo: `'"@prisma/client"' has no exported member named 'PaymentTransaction'`.

Causa: en este monorepo el cliente Prisma es **compartido** (npm hoistea `@prisma/client` en la raíz). Los servicios sanos generan local con:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}
```

```json
"paths": { "@prisma/client": ["./node_modules/.prisma/client"] }
```

`payment-service` y `loyalty-service` no lo tenían. Al instalar una dependencia en un workspace, el `postinstall` regenera el cliente raíz con *ese* schema y rompe el typecheck de los demás.

Correcciones aplicadas:

- `services/payment-service/prisma/schema.prisma` + `tsconfig.json`
- `services/loyalty-service/prisma/schema.prisma` + `tsconfig.json`
- `npx prisma generate` en ambos (genera local).

Resultado: payment pasó de suite roja a **57 casos verdes**; loyalty quedó inmune a futuros `npm install` en otros workspaces.

## Cómo verificar

```powershell
# Todo el monorepo (Windows: --runInBand evita workers pesados)
npm test -- --runInBand

# Un servicio
npx jest --runInBand          # dentro de services/<servicio>

# Typecheck del código de producción (excluye tests/)
npx tsc --noEmit              # dentro de services/<servicio>
```

## Notas y pendientes

- `channel-manager-service` cumple con lo mínimo pero solo tiene 2 casos de integración (`simulator.test.ts`): conviene reforzarlo.
- `apps/front` tiene 105 casos pero sin carpeta `integration/`; no es microservicio, así que no aplica al requisito salvo pedido explícito.
- Cualquier servicio nuevo debe declarar `output` en el generator y el alias en `tsconfig.json`, o heredará el bug de Prisma compartido.
- `rate-availability-service` falló una vez en corrida completa y pasó aislado y en la corrida final: era flake por carga, no un test roto.
- Los tests se escribieron sin tocar código de producción; el único cambio de fuente fue el fix de Prisma (schema + tsconfig).
