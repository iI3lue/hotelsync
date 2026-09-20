# Tutorial — Diagramas Entidad-Relación de los microservicios de HotelSync (dbdiagram.io)

Guía para generar los **9 diagramas ER** (uno por microservicio) de HotelSync usando **dbdiagram.io**, una herramienta online pensada específicamente para diagramas entidad-relación: escribís el esquema en texto (DSL) y la herramienta genera el diagrama automáticamente, con PK, FK y cardinalidades.

> Herramienta: [dbdiagram.io](https://dbdiagram.io) — gratis, no requiere instalación, exporta a PNG.
> Corresponden a la **sección 5** del documento `HotelSync_Arquitectura.docx` (donde está el placeholder `[DIAGRAMA]`).

---

## 1. Concepto previo: son 9 diagramas, no uno

En una arquitectura de microservicios **cada servicio tiene su propia base de datos independiente** y **no se hacen joins entre bases de datos**. Por eso HotelSync tiene **9 diagramas ER separados**, uno por microservicio:

| Microservicio | Diagrama |
|---|---|
| 5.1 Property | Property DB |
| 5.2 Rate & Availability | Rate & Availability DB |
| 5.3 Channel Manager | Channel Manager DB |
| 5.4 Booking | Booking DB |
| 5.5 Front Desk | Front Desk DB |
| 5.6 Housekeeping | Housekeeping DB |
| 5.7 Billing | Billing DB |
| 5.8 Loyalty | Loyalty DB |
| 5.9 Analytics | Analytics DB |

**Nota importante de integridad (sección 5.10):** las referencias a entidades de *otros* microservicios (ej. `room_type_id`, `booking_id`, `guest_id`, `property_id`) se modelan como **referencias externas UUID** (atributos normales, no FK físicas), porque no se pueden crear llaves foráneas entre bases de datos distintas. En los diagramas, esas columnas van marcadas como **FK-externa** (solo documental), no como relación dibujada.

---

## 2. Cómo funciona dbdiagram.io

1. Entrá a **dbdiagram.io** → **New / Create new diagram**.
2. En el panel izquierdo pegás el **código DSL** (el que te doy abajo por microservicio).
3. A la derecha se genera **solo** el diagrama ER.
4. Opciones útiles:
   - Botón **🎨** para colores / agrupar por tabla (usá un color por microservicio si querés).
   - Menú de arriba → **Export → PNG** para bajarlo en alta resolución.
5. Guardás cada diagrama como archivo aparte o en un solo documento con páginas (pestaña **Pages**).

**Sintaxis mínima del DSL que vas a pegar:**
```dbml
Table nombre_tabla {
  columna  tipo  [convención]
}
Ref: tabla_hija.columna_fk > tabla_padre.columna_pk
```
- `[pk]` = llave primaria.
- `Ref:` = llave foránea (relación). Usá la **dirección many-to-one `>`**: `hija.fk > padre.pk`.
- El tipo de relación `1:N` se infiere de `>` (muchos a uno).

> ⚠️ **Regla para evitar errores:** definí **cada relación una sola vez**. NO combinés el ref inline `[ref: > tabla.columna]` dentro de la columna con una línea `Ref:` para el mismo par — dbdiagram rechaza las relaciones duplicadas. En este tutorial usamos siempre la forma `Ref:` suelta (recomendada por la documentación oficial).

---

## 3. Los 9 diagramas (código DSL)

### 5.1 — Property

Pegá esto en dbdiagram.io:

```dbml
// ============ 5.1 Property DB ============

Table hotels {
  hotel_id      uuid       [pk]
  name          varchar
  city          varchar    [not null]
  country       varchar
  timezone      varchar    [not null]
}

Table room_types {
  room_type_id  uuid        [pk]
  hotel_id      uuid        [not null]
  name          varchar
  capacity      int         [not null]
  base_rate     decimal     [not null]
  amenities     varchar[]   [not null]
}

Table cancellation_policies {
  policy_id     uuid        [pk]
  hotel_id      uuid        [not null]
  name          varchar
  description   text
}

Ref: room_types.hotel_id > hotels.hotel_id
Ref: cancellation_policies.hotel_id > hotels.hotel_id
```

**Relaciones:** `hotels` 1—N `room_types` · `hotels` 1—N `cancellation_policies`.

---

### 5.2 — Rate & Availability

```dbml
// ============ 5.2 Rate & Availability DB ============

Table inventory {
  inventory_id    uuid       [pk]
  room_type_id    uuid
  report_date     date
  available_count int        [not null, default: 0]
  blocked_count   int        [not null, default: 0]
  indexes {
    (room_type_id, report_date) [unique, name: 'idx_inventory_room_date']
  }
}

Table rates {
  rate_id       uuid    [pk]
  room_type_id  uuid
  report_date   date
  price         decimal [not null]
}

Table rate_rules {
  rule_id       uuid    [pk]
  room_type_id  uuid
  multiplier    decimal [not null]
  min_stay      int     [not null]
}
```

**Notas:**
- `room_type_id` en las tres tablas es **referencia externa UUID** al Property Service (no FK física).
- `rate_rules` usa `multiplier` (factor, `> 0`) y `min_stay` (noches mínimas, `>= 1`).
- El bloqueo manual por mantenimiento se modela con el campo `blocked_count` de `inventory` (NO existe tabla `blocks`).

---

### 5.3 — Channel Manager

```dbml
// ============ 5.3 Channel Manager DB ============

Table channel_mappings {
  mapping_id        uuid    [pk]
  room_type_id      uuid
  channel_name      varchar [not null]
  external_room_id  varchar [not null]
}

Table sync_log {
  log_id    uuid    [pk]
  sync_date timestamp
  result    varchar [note: 'success | failure | retry']
}
```

**Notas:**
- `room_type_id` es **referencia externa UUID** al Property Service.
- `result` usa un `CHECK` conceptual: `success`, `failure` o `retry`.
- No existe tabla `channels`: la identidad del canal está en `channel_mappings.channel_name`.

---

### 5.4 — Booking

```dbml
// ============ 5.4 Booking DB ============

Table bookings {
  booking_id    uuid      [pk]
  guest_id      uuid      // FK externa → Loyalty
  hotel_id      uuid      // FK externa → Property
  room_type_id  uuid      // FK externa → Property
  check_in      date      [not null]
  check_out     date      [not null]
  status        varchar   [not null, note: 'pending | confirmed | cancelled | completed']
  channel       varchar   [not null]
  total_amount  decimal   [not null, default: 0]
  indexes {
    check_in
    guest_id
    status
  }
}
```

**Nota:** `guest_id`, `hotel_id` y `room_type_id` son **referencias externas UUID** a otros microservicios (no se dibujan como FK locales). No hay tablas `guests` ni `booking_items`.

---

### 5.5 — Front Desk

```dbml
// ============ 5.5 Front Desk DB ============

Table room_assignments {
  assignment_id       uuid      [pk]
  booking_id          uuid      // FK externa → Booking
  physical_room_number varchar  [not null]
  checked_in_at       timestamp [not null]
  checked_out_at      timestamp
}

Table guest_incidents {
  incident_id  uuid    [pk]
  booking_id   uuid    // FK externa → Booking
  description  text    [not null]
  registered_at timestamp
}
```

**Nota:** `booking_id` es **referencia externa UUID** al Booking Service. No hay tablas `arrivals`, `stays`, `physical_rooms` ni `guest_requests`.

---

### 5.6 — Housekeeping

```dbml
// ============ 5.6 Housekeeping DB ============

Table room_status {
  room_status_id  uuid      [pk]
  room_id         uuid      // referencia externa a habitación física
  status          varchar   [not null, note: 'dirty | cleaning | clean | maintenance']
  assigned_to     varchar   [not null]
  updated_at      timestamp [not null]
}

Table cleaning_history {
  history_id  uuid      [pk]
  room_id     uuid      [not null]
  cleaned_at  timestamp
  notes       text
}

Ref: cleaning_history.room_id > room_status.room_id
```

**Relaciones:** `room_status` 1—N `cleaning_history`. No hay tablas `physical_rooms` ni `cleaning_tasks`.

---

### 5.7 — Billing

```dbml
// ============ 5.7 Billing DB ============

Table folios {
  folio_id    uuid    [pk]
  booking_id  uuid    // FK externa → Booking
  currency    varchar [not null]
  total       decimal [not null, default: 0]
}

Table charges {
  charge_id  uuid     [pk]
  folio_id   uuid     [not null]
  concept    varchar  [not null]
  amount     decimal  [not null]
  added_at   timestamp [not null]
}

Ref: charges.folio_id > folios.folio_id
```

**Relaciones:** `folios` 1—N `charges`. `booking_id` es **referencia externa UUID** al Booking Service. No existen tablas `invoices` ni `invoice_items` (se renombró el evento a `folio.closed`).

---

### 5.8 — Loyalty

```dbml
// ============ 5.8 Loyalty DB ============

Table loyalty_accounts {
  account_id      uuid    [pk]
  guest_id        uuid    // FK externa → huésped
  tier            varchar [not null]
  points_balance  int     [not null, default: 0]
}

Table points_transactions {
  transaction_id  uuid    [pk]
  guest_id        uuid    // FK externa → huésped
  type            varchar [not null, note: 'earn | redeem']
  points          int
  created_at      timestamp
}
```

**Nota:** `guest_id` es **referencia externa UUID**. No existen tablas `guests`, `point_balances` ni `membership_levels`.

---

### 5.9 — Analytics

```dbml
// ============ 5.9 Analytics DB ============

Table occupancy_daily {
  occupancy_id    uuid    [pk]
  property_id     uuid    // FK externa → Property
  report_date     date
  occupancy_pct   decimal [note: '0 a 100']
}

Table revpar_by_property {
  revpar_id   uuid    [pk]
  property_id uuid    // FK externa → Property
  report_date date
  revpar      decimal
}

Table adr_by_property {
  adr_id      uuid    [pk]
  property_id uuid    // FK externa → Property
  report_date date
  adr         decimal
}
```

**Nota:** `property_id` es **referencia externa UUID** al Property Service. Las métricas se derivan por ETL sobre réplicas de solo lectura. Se reemplazan las antiguas `occupancy_metrics`, `revpar_metrics` y `demand_forecast` por `occupancy_daily`, `revpar_by_property` y `adr_by_property`.

---

## 4. Buenas prácticas comunes

1. **Un color por microservicio** (ej. cyan todos los del diagrama Property, violeta los de Analytics) para diferenciar de un vistazo.
2. **Notación de PK/FK**: dbdiagram pinta la PK automáticamente (llave). Para las **referencias externas** escribí un comentario `// FK externa → ...` porque NO son relaciones reales.
3. **Una página por microservicio** en el mismo documento (pestaña Pages) para entregar un solo archivo con los 9, o exportá cada uno como PNG por separado.
4. **Convención de campos**: `*_id` para todas las claves; timestamps en `check_*_at`, `created_at`, `updated_at`, `registered_at`.
5. **No dibujes relaciones entre microservicios**: cada diagrama es autocontenido en su propia base.

---

## 5. Exportar e insertar en el documento

1. En dbdiagram.io → **Export → PNG** (alta resolución).
2. Guardá cada PNG en el repo, ej.:
   `docs/imagenes/er_property.png`, `docs/imagenes/er_rate_availability.png`, ... etc.
3. En `HotelSync_Arquitectura.docx`, sección 5, donde está el placeholder `[DIAGRAMA]`, insertá **cada PNG junto a su subsección** (5.1 → imagen de Property, 5.2 → imagen de R&A, etc.).
4. Agregá pie de figura a cada uno, por ejemplo:
   > *Figura 2. Diagrama entidad-relación del microservicio Property.*

---

## 6. Checklist de verificación

- [ ] Son **9 diagramas** (uno por microservicio), no uno solo.
- [ ] Cada diagrama tiene su **BD** y sus **tablas** exactas (fieles al fuente).
- [ ] PK y FK locales marcadas correctamente (dbdiagram las pinta).
- [ ] Referencias externas UUID documentadas como comentario `// FK externa`.
- [ ] No se dibujaron joins entre microservicios.
- [ ] Property no tiene tabla `blocks` (usa `blocked_count` en `inventory`).
- [ ] Channel Manager no tiene tabla `channels` (usa `channel_mappings`/`sync_log`).
- [ ] Booking no tiene `guests`/`booking_items`.
- [ ] Billing no tiene `invoices`/`invoice_items` (usa `folios`/`charges`).
- [ ] Loyalty no tiene `guests`/`point_balances`/`membership_levels`.
- [ ] Analytics usa `occupancy_daily`/`revpar_by_property`/`adr_by_property`.
- [ ] Se exportó cada PNG y se insertó en la sección 5 con su pie de figura.
