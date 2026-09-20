# Modelos Relacionales de HotelSync — Diagramas ER con cardinalidades

Documento con los **9 diagramas entidad-relación** (uno por microservicio), en el formato de cajas con **cardinalidades explícitas (1:N, N:1, 1:1)** y su **descripción de relaciones**, fieles a la sección 5 del documento `HotelSync_Arquitectura.docx`.

> **Nota importante (microservicios):** dentro de cada base de datos las relaciones se dibujan de forma **local** (1:N, 1:1). Las referencias a entidades de **otros** microservicios (ej. `booking_id`, `room_type_id`, `guest_id`, `property_id`, `hotel_id`) son **referencias externas UUID**: no se dibujan como relación dentro del diagrama, pero se listan en la tabla de relaciones marcándolas como *(externa)*.

---

## 5.1 — Property

```
                          +------------------+
                          |     HOTELS       |
                          +------------------+
                          | hotel_id      PK |
                          | name             |
                          | city             |
                          | country          |
                          | timezone         |
                          +------------------+
                              |           |
                              | 1:N       | 1:N
                              v           v
        +-----------------------+       +-------------------------------+
        |     ROOM_TYPES        |       |   CANCELLATION_POLICIES       |
        +-----------------------+       +-------------------------------+
        | room_type_id   PK     |       | policy_id       PK            |
        | hotel_id       FK     |       | hotel_id        FK            |
        | name                  |       | name                          |
        | capacity              |       | description                   |
        | base_rate             |       +-------------------------------+
        | amenities             |
        +-----------------------+
```

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Hotels** | 1 : N | **Room_types** | Un hotel puede tener N tipos de habitación. |
| **Hotels** | 1 : N | **Cancellation_policies** | Un hotel puede tener N políticas de cancelación. |

---

## 5.2 — Rate & Availability

```
        +---------------------+          +---------------------+
        |      INVENTORY      |          |        RATES        |
        +---------------------+          +---------------------+
        | inventory_id     PK |          | rate_id          PK |
        | room_type_id (ext)  |          | room_type_id (ext)  |
        | report_date    FK   |          | report_date         |
        | available_count     |          | price               |
        | blocked_count       |          +---------------------+
        +---------------------+

        +---------------------+
        |     RATE_RULES      |
        +---------------------+
        | rule_id          PK |
        | room_type_id (ext)  |
        | multiplier          |
        | min_stay            |
        +---------------------+
```

> Las tres tablas guardan `room_type_id` como **referencia externa UUID** al Property Service (no hay relación local dibujada).
> El bloqueo manual por mantenimiento se modela con el campo `blocked_count` de `inventory`.

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Inventory** | N : 1 | **Property.Room_types** | *(externa)* Cada fila de inventario corresponde a un tipo de habitación del Property Service. |
| **Rates** | N : 1 | **Property.Room_types** | *(externa)* Cada tarifa corresponde a un tipo de habitación. |
| **Rate_rules** | N : 1 | **Property.Room_types** | *(externa)* Cada regla de tarifa aplica a un tipo de habitación. |

---

## 5.3 — Channel Manager

```
        +---------------------+
        |  CHANNEL_MAPPINGS   |
        +---------------------+
        | mapping_id       PK |
        | room_type_id (ext)  |
        | channel_name        |
        | external_room_id    |
        +---------------------+

        +---------------------+
        |      SYNC_LOG       |
        +---------------------+
        | log_id           PK |
        | sync_date           |
        | result              |
        +---------------------+
```

> `room_type_id` es **referencia externa UUID** al Property Service. No hay relaciones locales entre `channel_mappings` y `sync_log`.

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Channel_mappings** | N : 1 | **Property.Room_types** | *(externa)* Cada mapeo asocia un tipo de habitación interno con un canal (OTA). |
| **Sync_log** | N : 1 | — | Registra el historial de sincronización; resultado `success | failure | retry`. |

---

## 5.4 — Booking

```
        +---------------------+
        |      BOOKINGS       |
        +---------------------+
        | booking_id       PK |
        | guest_id      (ext) |
        | hotel_id      (ext) |
        | room_type_id  (ext) |
        | check_in           |
        | check_out          |
        | status             |
        | channel            |
        | total_amount       |
        +---------------------+
```

> `guest_id`, `hotel_id` y `room_type_id` son **referencias externas UUID** a los microservicios de Loyalty/Property. No hay tablas `guests` ni `booking_items`.

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Bookings** | N : 1 | **Property.Hotels** | *(externa)* Cada reserva pertenece a un hotel. |
| **Bookings** | N : 1 | **Property.Room_types** | *(externa)* Cada reserva es de un tipo de habitación. |
| **Bookings** | N : 1 | **Loyalty.Guests** | *(externa)* Cada reserva corresponde a un huésped. |

---

## 5.5 — Front Desk

```
        +---------------------+
        |  ROOM_ASSIGNMENTS   |
        +---------------------+
        | assignment_id    PK |
        | booking_id    (ext) |
        | physical_room_number|
        | checked_in_at       |
        | checked_out_at      |
        +---------------------+

        +---------------------+
        |   GUEST_INCIDENTS   |
        +---------------------+
        | incident_id      PK |
        | booking_id    (ext) |
        | description         |
        | registered_at       |
        +---------------------+
```

> `booking_id` es **referencia externa UUID** al Booking Service. No hay relaciones locales entre ambas tablas.

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Room_assignments** | N : 1 | **Booking.Bookings** | *(externa)* Cada asignación de habitación pertenece a una reserva. |
| **Guest_incidents** | N : 1 | **Booking.Bookings** | *(externa)* Cada incidencia se registra sobre una reserva. |

---

## 5.6 — Housekeeping

```
        +---------------------+
        |     ROOM_STATUS     |
        +---------------------+
        | room_status_id   PK |
        | room_id            |
        | status             |
        | assigned_to        |
        | updated_at         |
        +---------------------+
              |
              | 1:N
              v
        +---------------------+
        |   CLEANING_HISTORY  |
        +---------------------+
        | history_id       PK |
        | room_id        FK   |
        | cleaned_at         |
        | notes              |
        +---------------------+
```

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Room_status** | 1 : N | **Cleaning_history** | Una habitación puede tener N registros de limpieza (historial). |

---

## 5.7 — Billing

```
        +---------------------+
        |       FOLIOS        |
        +---------------------+
        | folio_id        PK  |
        | booking_id   (ext)  |
        | currency           |
        | total              |
        +---------------------+
              |
              | 1:N
              v
        +---------------------+
        |      CHARGES        |
        +---------------------+
        | charge_id       PK  |
        | folio_id       FK   |
        | concept            |
        | amount             |
        | added_at           |
        +---------------------+
```

> `booking_id` es **referencia externa UUID** al Booking Service. No existen tablas `invoices` ni `invoice_items`.

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Folios** | 1 : N | **Charges** | Un folio puede tener N cargos asociados. |
| **Folios** | 1 : 1 | **Booking.Bookings** | *(externa)* Cada reserva cierra su factura en un folio. |

---

## 5.8 — Loyalty

```
        +---------------------+
        |  LOYALTY_ACCOUNTS   |
        +---------------------+
        | account_id      PK  |
        | guest_id    (ext)   |
        | tier               |
        | points_balance     |
        +---------------------+

        +---------------------+
        | POINTS_TRANSACTIONS |
        +---------------------+
        | transaction_id  PK  |
        | guest_id    (ext)   |
        | type               |
        | points             |
        | created_at         |
        +---------------------+
```

> `guest_id` es **referencia externa UUID** al huésped. No existen tablas `guests`, `point_balances` ni `membership_levels`.

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Loyalty_accounts** | N : 1 | **Loyalty.Guests** | *(externa)* Cada cuenta de fidelidad pertenece a un huésped. |
| **Points_transactions** | N : 1 | **Loyalty.Guests** | *(externa)* Cada transacción de puntos pertenece a un huésped. |

---

## 5.9 — Analytics

```
        +---------------------+
        |   OCCUPANCY_DAILY   |
        +---------------------+
        | occupancy_id    PK  |
        | property_id  (ext)  |
        | report_date        |
        | occupancy_pct      |
        +---------------------+

        +---------------------+
        | REVPAR_BY_PROPERTY  |
        +---------------------+
        | revpar_id       PK  |
        | property_id   (ext) |
        | report_date        |
        | revpar             |
        +---------------------+

        +---------------------+
        |   ADR_BY_PROPERTY   |
        +---------------------+
        | adr_id         PK   |
        | property_id   (ext) |
        | report_date        |
        | adr                |
        +---------------------+
```

> `property_id` es **referencia externa UUID** al Property Service. No existen tablas `occupancy_metrics`, `revpar_metrics` ni `demand_forecast`.

### Descripción de relaciones
| Entidad A | Cardinalidad | Entidad B | Descripción |
|---|---|---|---|
| **Occupancy_daily** | N : 1 | **Property.Hotels** | *(externa)* Cada métrica de ocupación pertenece a una propiedad. |
| **Revpar_by_property** | N : 1 | **Property.Hotels** | *(externa)* El RevPAR se calcula por propiedad. |
| **Adr_by_property** | N : 1 | **Property.Hotels** | *(externa)* El ADR se calcula por propiedad. |

---

## Resumen global de cardinalidades

| Tipo | Dónde aparece |
|---|---|
| **1 : N** (local) | Hotels→Room_types, Hotels→Cancellation_policies, Room_status→Cleaning_history, Folios→Charges |
| **1 : 1** (conceptual) | Folios→Booking.Bookings (una reserva = un folio) |
| **N : 1** (referencia externa) | R&A, Channel Manager, Booking, Front Desk, Loyalty, Analytics hacia Property/Booking/Loyalty |
| **M : N** | **No hay.** En un esquema 3FN bien normalizado las relaciones muchos-a-muchos siempre se resuelven con tablas puente; en HotelSync todas son 1:N o referencias externas. |
