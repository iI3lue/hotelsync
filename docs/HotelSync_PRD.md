N# PRD — HotelSync

**Product Requirements Document**

| Campo | Detalle |
| --- | --- |
| Producto | HotelSync |
| Tipo | Plataforma de gestión hotelera multi-propiedad |
| Estado | Borrador v1.0 |
| Autor | Equipo HotelSync |
| Documentos relacionados | `HotelSync_Informacion_Extraida.txt` |

---

## 1. Resumen Ejecutivo

HotelSync es una plataforma unificada de gestión hotelera para una cadena con múltiples propiedades distribuidas en distintas ciudades. Reemplaza los sistemas de gestión de propiedades (PMS) aislados que cada hotel opera de forma independiente y centraliza **disponibilidad, tarifas, reservas y operación diaria** (check-in/check-out, housekeeping, mantenimiento) en un único ecosistema de microservicios.

El objetivo estratégico es permitir a la central optimizar el *revenue management* entre propiedades y ofrecer una experiencia de huésped consistente sin importar el hotel en el que se aloje.

### 1.1 Problema

- Cada propiedad opera un PMS independiente sin visión consolidada de la cadena.
- Sin inventario compartido sincronizado, la misma habitación puede venderse por dos canales simultáneamente (**sobreventa**), generando costos de reubicación y penalizaciones contractuales.
- No existe una política de tarifas unificada ni *revenue management* a nivel cadena.
- La experiencia del huésped varía según el hotel y no hay un programa de fidelización transversal.

### 1.2 Solución

HotelSync centraliza la operación en microservicios y sincroniza en tiempo real la disponibilidad y tarifas con canales externos (Booking.com, Expedia, Airbnb) mediante un patrón de **channel manager**, evitando la sobreventa de habitaciones.

---

## 2. Objetivos del Producto

| # | Objetivo | Métrica de éxito |
| --- | --- | --- |
| O1 | Eliminar la sobreventa por desincronización de canales | 0 reservas sobrevendidas por conflicto de inventario |
| O2 | Centralizar disponibilidad, tarifas y reservas de la cadena | 100% de propiedades operando en HotelSync |
| O3 | Optimizar *revenue management* entre propiedades | Aumento sostenido de ADR y RevPAR |
| O4 | Experiencia de huésped consistente en toda la cadena | NPS de huéspedes recurrente sin degradación por propiedad |
| O5 | Automatizar el ciclo operativo del hotel | Reducción de tareas manuales en front desk y housekeeping |

### 2.1 Objetivos no relacionados a éxito financiero directo

- Garantizar trazabilidad completa de cada reserva (`booking_id`) entre servicios.
- Cumplimiento fiscal multi-país en facturación y cifrado de datos personales.

---

## 3. Alcance

### 3.1 In-scope

- **Microservicios**: Property, Rate & Availability, Channel Manager, Booking, Front Desk, Housekeeping, Billing, Loyalty, Analytics.
- **API Gateway**: enrutamiento para paneles de recepción, web pública de reservas y Channel Manager.
- **Web pública de reservas** con renderizado SSR (SEO por ciudad y propiedad).
- **Panel de recepción** (front desk) por hotel.
- **Módulo de Revenue Management** (analytics).
- **Sincronización en tiempo real con OTAs** (Booking.com, Expedia, Airbnb).
- **Programa de fidelización** transversal a la cadena.

### 3.2 Out-of-scope (fases posteriores)

- Procesamiento de pagos completo (solo integración con pasarela PCI-DSS, sin almacenar datos completos de tarjeta).
- Aplicaciones móviles nativas para huéspedes y personal.
- Distribución por canales offline (agencias de viaje físicas, call centers externos).
- Gestión de eventos corporativos y salones.
- Integración con proveedores de amenidades de terceros (spa, restaurante: solo registro de cargos).

---

## 4. Usuarios y Roles

| Rol | Descripción | Necesidades principales |
| --- | --- | --- |
| **Central de Revenue Management** | Equipo corporativo que define tarifas y estrategia | Dashboards de ocupación, ADR, RevPAR, previsión de demanda, ajuste de tarifas |
| **Recepcionista / Front Desk** | Personal por hotel | Lista de llegadas del día, check-in/check-out, asignación de habitación física, incidencias |
| **Personal de Housekeeping** | Encargado de limpieza y mantenimiento | Cola de tareas por habitación, estados de limpieza |
| **Administración / Finanzas** | Cierre contable y facturación por hotel | Factura final consolidada, cargos, multi-moneda, cumplimiento fiscal |
| **Huésped** | Cliente final | Reserva directa, confirmación, beneficios de fidelización |
| **OTAs (Booking.com, Expedia, Airbnb)** | Canales de distribución externos | Disponibilidad y tarifas sincronizadas, reservas entrantes vía webhook |

### 4.1 Personas de ejemplo

- **María (Revenue Manager central)**: ajusta tarifas por propiedad según ocupación proyectada y eventos locales; depende del Analytics Service.
- **Carlos (Recepcionista)**: arranca el turno consultando reservas del día; necesita estados de habitación actualizados.
- **Lucía (Housekeeping)**: recibe tareas automáticas tras cada checkout y marca habitaciones listas.
- **Tomás (Huésped frecuente)**: reserva por la web directa y acumula puntos en todas las propiedades de la cadena.

---

## 5. Requerimientos Funcionales

Organizados por módulo. Cada requisito incluye criterios de aceptación verificables.

### 5.1 Property Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| PRP-1 | Mantener catálogo de hoteles (nombre, ciudad, país, zona horaria) | CRUD de propiedades refleja cambios sin afectar servicios en ejecución |
| PRP-2 | Gestionar tipos de habitación con capacidad, tarifa base y servicios asociados (vista al mar, balcón, accesibilidad) | Un tipo de habitación incluye capacidad, tarifa base y amenities editables |
| PRP-3 | Definir políticas de cancelación por propiedad | Cada propiedad expone su política de cancelación vigente |

### 5.2 Rate & Availability Service (núcleo transaccional)

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| RTA-1 | Gestionar inventario por tipo de habitación y fecha | Consulta de disponibilidad devuelve `available_count` correcto para cualquier fecha |
| RTA-2 | Aplicar reglas de tarifas dinámicas (temporada alta/baja, ocupación proyectada, eventos locales) | Un cambio de regla actualiza la tarifa publicada en tiempo real |
| RTA-3 | Soporte de bloqueo manual (mantenimiento) | Bloquear inventario reduce `available_count` y publica `availability.updated` |
| RTA-4 | Consistencia estricta bajo alta concurrencia | En picos (ej. black friday) no se confirman dos reservas sobre el mismo inventario (bloqueo optimista) |
| RTA-5 | Exponer disponibilidad consolidada al Channel Manager | Cambio de inventario dispara evento `availability.updated` en < 1 s |

### 5.3 Channel Manager Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| CM-1 | Sincronizar disponibilidad y tarifas con OTAs en tiempo real | Todo `availability.updated` interno se propaga a Booking.com, Expedia y Airbnb |
| CM-2 | Mapear tipos de habitación internos a IDs externos por canal | `channel_mappings` permite traducir inventario por canal |
| CM-3 | Recibir reservas entrantes de OTAs vía webhook | Una reserva OTA se traduce al formato interno y publica `booking.created` |
| CM-4 | Garantía de entrega ante fallos de red | Desincronización detectada se reintenta y alerta antes de causar sobreventa |
| CM-5 | Registrar historial de sincronización | Cada intento queda en `sync_log` con resultado y timestamp |

### 5.4 Booking Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| BK-1 | Gestionar reservas directas (web propia) | Reserva directa confirma habitación sin sobreventa |
| BK-2 | Gestionar reservas por central telefónica | Reserva telefónica ingresa y se integra al inventario |
| BK-3 | Gestionar reservas de canales externos (via CM) | Reserva OTA traducida se incorpora como reserva de canal |
| BK-4 | Bloqueo optimista al confirmar habitación | Dos intentos simultáneos: solo uno confirma, el otro rechaza o espera |
| BK-5 | Publicar eventos del ciclo de vida | Publica `booking.created` y `booking.cancelled`; cancela libera inventario |

### 5.5 Front Desk Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| FD-1 | Preparar lista de llegadas del día | Consume `booking.created` y lista llegadas esperadas |
| FD-2 | Check-in con asignación de habitación física concreta | La habitación física asignada puede diferir del tipo reservado |
| FD-3 | Check-out registrado | Completa la estancia y publica `checkout.completed` |
| FD-4 | Registrar solicitudes especiales del huésped | Solicitud queda asociada al booking y visible en front desk |
| FD-5 | Registrar incidencias durante la estancia | Incidencia queda en `guest_incidents` con trazabilidad |

### 5.6 Housekeeping Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| HK-1 | Gestionar estado de cada habitación física | Estados: sucia, en limpieza, lista, en mantenimiento |
| HK-2 | Generar tarea de limpieza automática tras checkout | `checkout.completed` genera tarea de limpieza sin intervención |
| HK-3 | Asignar tareas al personal de limpieza | Tarea queda asignada a un empleado con `assigned_to` |
| HK-4 | Sincronizar con ocupación del Front Desk | Cambios de ocupación actualizan estados sin conflictos |

### 5.7 Billing Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| BL-1 | Consolidar cargos de habitación y servicios adicionales (minibar, spa, restaurante) | Cargos acumulados durante la estancia se suman al folio |
| BL-2 | Generar factura final al checkout | `checkout.completed` dispara cierre de factura con todos los cargos |
| BL-3 | Soporte multi-moneda | Factura se emite y calcula en la moneda configurada |
| BL-4 | Cumplimiento fiscal por país | La factura respeta la normativa fiscal de cada país |

### 5.8 Loyalty Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| LY-1 | Acumular puntos por estancia | `booking.completed` (post-checkout) acredita puntos según nivel |
| LY-2 | Niveles de membresía: plata, oro, platino | Huésped asciende de nivel según reglas de la cadena |
| LY-3 | Puntos válidos entre todas las propiedades | El saldo del huésped es único y transversal |

### 5.9 Analytics / Revenue Management

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| AN-1 | Calcular ocupación por propiedad | Dashboard muestra ocupación diaria actualizada por ETL |
| AN-2 | Calcular ADR y RevPAR | Métricas disponibles por propiedad y por período |
| AN-3 | Previsión de demanda | Proyección alimenta decisiones de ajuste de tarifas |
| AN-4 | Ejecutar ETL periódico sobre réplicas de solo lectura | El ETL no degrada el rendimiento transaccional |

### 5.10 Plataforma transversal

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| PL-1 | API Gateway con enrutamiento | Panel de recepción, web pública y Channel Manager enrutan correctamente |
| PL-2 | Autenticación JWT con refresh tokens | Sesiones expiran y se renuevan de forma segura |
| PL-3 | Rate limiting en el Gateway | Peticiones abusivas se rechazan con 429 |
| PL-4 | Web pública de reservas SSR | SEO por ciudad y propiedad; reserva directa funcional |

---

## 6. Requerimientos No Funcionales

| Área | Requisito |
| --- | --- |
| **Concurrencia** | Rate & Availability debe mantener consistencia estricta en picos de venta simultánea (ej. black friday de viajes) |
| **Rendimiento** | Sincronización de inventario con OTAs en tiempo real; consultas de disponibilidad respondidas desde Redis con invalidación inmediata |
| **Entrega garantizada** | Comunicación asíncrona con RabbitMQ con garantías de entrega frente a canales externos |
| **Seguridad** | Cifrado de datos personales de huéspedes; pasarela de pago PCI-DSS sin almacenar datos completos de tarjeta |
| **Disponibilidad** | Rolling updates en Render; sin downtime en despliegues |
| **Observabilidad** | Métricas Prometheus, dashboards Grafana, logs centralizados con trazabilidad por `booking_id` |
| **Escalabilidad** | Diseño de microservicios que permita escalar el Rate & Availability Service de forma independiente |

---

## 7. Flujos Clave

### 7.1 Reserva directa (web propia)

1. Huésped consulta disponibilidad → Rate & Availability Service (con caché Redis).
2. Huésped confirma reserva → Booking Service aplica **bloqueo optimista**.
3. Booking Service publica `booking.created`.
4. Channel Manager propaga la reducción de inventario a las OTAs.
5. Front Desk consume `booking.created` y prepara la lista de llegadas.

### 7.2 Reserva entrante de OTA (webhook)

1. OTA envía reserva vía webhook → Channel Manager Service.
2. Channel Manager traduce al formato interno y publica `booking.created`.
3. El inventario interno se actualiza de forma consistente.
4. Ante conflicto de sobreventa detectado tras la sincronización → **compensación (saga)**: reubicar al huésped en habitación equivalente o notificar al equipo de revenue management.

### 7.3 Ciclo de estancia completo

```
booking.created → check-in (asignación habitación física) → checkout
  → checkout.completed → housekeeping (tarea automática)
  → checkout.completed → billing (cierre de factura)
  → booking.completed → loyalty (acumulación de puntos)
```

### 7.4 Saga de sincronización con canales externos

- Cada reserva confirmada en una OTA debe reflejarse de forma consistente en el inventario interno.
- Si la sincronización falla o se detecta conflicto, se dispara compensación con reintentos y alerta al revenue management antes de que ocurra una venta duplicada.

---

## 8. Reglas de Negocio

| ID | Regla |
| --- | --- |
| RN-1 | La confirmación de una reserva decrementa el inventario disponible del tipo de habitación para las fechas correspondientes |
| RN-2 | La cancelación de una reserva libera inventario y publica `booking.cancelled` |
| RN-3 | El bloqueo manual por mantenimiento reduce el inventario disponible sin reserva asociada |
| RN-4 | Las tarifas se calculan según reglas de temporada, ocupación proyectada y eventos locales, en orden de prioridad definido por Revenue Management |
| RN-5 | La asignación de habitación física en check-in puede diferir del tipo de habitación reservado |
| RN-6 | La acumulación de puntos de fidelización ocurre recién tras el checkout (`booking.completed`) |
| RN-7 | Los puntos son válidos en cualquier propiedad de la cadena |
| RN-8 | La factura final se cierra en el checkout incluyendo todos los cargos acumulados |

---

## 9. Métricas de Éxito

| Métrica | Meta |
| --- | --- |
| Reservas sobrevendidas por conflicto de inventario | 0 |
| Latencia de sincronización con OTAs | Tiempo real (< 1 s) |
| Ocupación promedio | Mejora sostenida por propiedad |
| ADR (tarifa promedio diaria) | Aumento sostenido |
| RevPAR (ingreso por habitación disponible) | Aumento sostenido |
| Tiempo de operación de check-in/check-out | Reducción vs. proceso manual |
| Exactitud del inventario reportado a canales | 100% sin discrepancias |
| Disponibilidad del servicio en picos de venta | ≥ 99.9% |

---

## 10. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Desincronización con una OTA | Sobreventa, penalizaciones contractuales | RabbitMQ con garantías de entrega, `sync_log`, alertas tempranas |
| Pico de concurrencia en ventas | Pérdida de reservas o doble venta | Bloqueo optimista, pruebas de carga k6, escalado independiente del servicio |
| Consistencia entre servicios | Datos de reserva inconsistentes | Eventos con trazabilidad por `booking_id` y patrón Saga |
| Cumplimiento fiscal multi-país | Multas y rechazo de facturas | Módulo de facturación configurable por país |
| Fuga de datos personales de huéspedes | Sanciones legales, pérdida de confianza | Cifrado, JWT con refresh tokens, rate limiting, pasarela PCI-DSS |

---

## 11. Roadmap por Fases

### Fase 1 — MVP (núcleo transaccional)
- Property Service, Rate & Availability Service, Booking Service, API Gateway.
- Web pública de reservas directas con SSR.
- Front Desk básico (check-in/check-out, asignación de habitación).

### Fase 2 — Canales y operación
- Channel Manager Service con sincronización a Booking.com, Expedia, Airbnb.
- Housekeeping Service y Billing Service.
- Eventos `checkout.completed` y `booking.completed`.

### Fase 3 — Estrategia y fidelización
- Analytics Service (ETL, dashboards de revenue management).
- Loyalty Service (puntos y niveles plata/oro/platino).
- Reglas de tarifas dinámicas avanzadas.

### Fase 4 — Expansión
- Out-of-scope: pagos extendidos, apps móviles, canales offline, eventos.

---

## 12. Criterios de Aceptación del Producto

El producto se considera listo cuando:

1. Las 9 funcionalidades clave (secciones 5.1–5.9) cumplen sus criterios de aceptación.
2. 0 sobreventas en pruebas de carga de picos de venta (k6).
3. La sincronización con OTAs es tiempo real y queda trazada en `sync_log`.
4. El ciclo completo reserva → checkout → facturación → fidelización opera sin intervención manual.
5. Las métricas de éxito (sección 9) se verifican contra el dashboard de Analytics.
