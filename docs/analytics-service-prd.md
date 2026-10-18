# PRD: Analytics Service (Revenue Management)

> Responsabilidad única: calcular ocupación, ADR y RevPAR por propiedad, ejecutar
> previsiones de demanda y alimentar los dashboards de revenue management mediante
> ETL sobre réplicas de solo lectura.

## 1. Justificación de separación

Los procesos analíticos y ETL agregan volúmenes de lectura que no deben degradar el
rendimiento transaccional. Este servicio opera sobre **réplicas de solo lectura**
de las bases de booking, property y rate-availability: consulta y analiza sin
interferir con la operación en vivo. Nunca escribe en esas bases.

## 2. Contratos del servicio

Base: `http://localhost:3011/v1` (DB propia `analytics_db` en `:5442`).

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/occupancy?hotel_id&from&to` | Bearer staff | % ocupación del rango (noches ocupadas / noches disponibles) |
| GET | `/adr?hotel_id&from&to` | Bearer staff | Tarifa diaria promedio (ingreso / habitaciones vendidas) |
| GET | `/revpar?hotel_id&from&to` | Bearer staff | Ingreso por habitación disponible (ADR × ocupación) |
| GET | `/forecast?hotel_id&horizon` | Bearer staff | Previsión de demanda (media móvil v1) |
| GET | `/dashboard/:hotelId` | Bearer staff | Agregado para el dashboard (ocupación + ADR + RevPAR + forecast) |

Evento emitido: `metrics.updated` `{ hotel_id, date, occupancy, adr, revpar }`.

### Definiciones (única fuente de verdad)

- `occupancy = occupied_room_nights / available_room_nights` (rango 0–1).
- `adr = room_revenue / rooms_sold` (COP; 0 si no hubo ventas).
- `revpar = room_revenue / available_rooms = adr × occupancy`.
- `forecast` v1 = media móvil de ocupación de los últimos N días × ADR actual.
  (TODO documentado: modelo estacional cuando haya 12+ meses de historia.)

## 3. ETL (núcleo del servicio)

- El job `etl.service` corre periódico (cron/intervalo configurable) y lee
  **solo** de `DATABASE_URL_BOOKING`, `DATABASE_URL_PROPERTY`, `DATABASE_URL_RATE`
  (usuarios de DB con permiso de lectura).
- Agrega por día y propiedad en tablas propias: `occupancy_daily`,
  `adr_by_property`, `revpar_by_property`.
- Los endpoints **nunca** calculan sobre las réplicas en vivo: leen los agregados.
  Así un dashboard pesado jamás toca la operación.
- Cada corrida exitosa emite `metrics.updated` vía outbox (`pending` → `sent`).

## 4. Reglas inviolables (heredadas del monorepo)

- Flujo Route → Controller → Service. Zod en el borde (query params inclusive).
  Errores `{error}` con `AppError(status)`. Sin detalles internos.
- DB por servicio. Sin FKs entre servicios: `hotel_id`/`booking_id` son UUID lógicos.
- `AUTH_JWT_SECRET` **idéntico** al de user-service.
- Roles de lectura: `MANAGER`, `SUPER_ADMIN` (dashboard); ETL sin auth (proceso interno).
- Sin `RABBITMQ_URL` el ETL sigue agregando y el outbox queda `pending`.
- Decimales con `Decimal(12,2)`; el JSON serializa montos como string si Prisma los
  devuelve como objeto Decimal (mismo cuidado que `total_amount` en booking).

## 5. Esquema base (`prisma/schema.prisma`)

```prisma
model OccupancyDaily {
  hotel_id           String   @db.Uuid
  date               DateTime @db.Date
  available_nights   Int
  occupied_nights    Int
  occupancy          Decimal  @db.Decimal(5, 4) // 0–1
  @@id([hotel_id, date])
  @@map("occupancy_daily")
}

model KpiByProperty {
  hotel_id   String   @db.Uuid
  date       DateTime @db.Date
  adr        Decimal  @db.Decimal(12, 2)
  revpar     Decimal  @db.Decimal(12, 2)
  rooms_sold Int
  revenue    Decimal  @db.Decimal(12, 2)
  @@id([hotel_id, date])
  @@map("kpi_by_property") // ADR + RevPAR juntos: siempre se leen juntos
}
```

> Nota: `adr_by_property` y `revpar_by_property` del plan original se fusionan en
> `kpi_by_property` (misma granularidad hotel+día, se consultan juntos; evita joins).

## 6. Cambios en el monorepo existente

- **Infra:** `docker-compose.yml` → `analytics-db` (`5442:5432`) + `analytics-service`
  (`3011:3011`) + volumen `analytics_data`. Réplicas de lectura de booking/property/rate
  (compose `depends_on` + usuarios read-only).
- **Front:** rewrite `/api/analytics/:path*` → `:3011/v1/:path*`; dashboard en
  `admin/` (nueva página que consume `GET /dashboard/:hotelId`).
- **Booking/Property/Rate:** sin cambios de código (solo acceso de lectura a sus DBs).
- **Raíz:** scripts `dev:analytics`, `migrate:analytics`.

## 7. Orden de construcción

1. Cascarón analytics-service en Node + Docker + DB propia.
2. ETL manual (una corrida) + tablas agregadas verificadas contra datos reales.
3. Endpoints de lectura sobre agregados + `metrics.updated`.
4. Réplicas read-only en compose + cron del ETL.
5. Dashboard en el front admin.
6. Verificación: `tsc --noEmit`, `jest`, flujo ETL → dashboard de punta a punta.
