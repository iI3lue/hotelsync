# PRD inicial — HotelSync

**Product Requirements Document**

| Campo | Detalle |
| --- | --- |
| Producto | HotelSync |
| Tipo | Plataforma de gestión hotelera multi-propiedad |
| Estado | Borrador inicial v0.1 — requiere validación |
| Autor | Equipo HotelSync |
| Fuente principal | `docs/HotelSync_Arquitectura.docx` |
| Documentos relacionados | `docs/HotelSync_Informacion_Extraida.txt`, `ARCHITECTURE.md`, `API.md` |

Este borrador convierte la arquitectura existente en necesidades y resultados de producto. Las metas numéricas, los flujos distribuidos y las decisiones marcadas al final son provisionales: no deben tratarse como requisitos aprobados hasta validarlos.

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
| O1 | Evitar sobreventas originadas por asignar más inventario interno del disponible y reducir desajustes entre canales | Cero confirmaciones internas por encima del inventario vendible; incidentes de sincronización externa medidos por separado |
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
| RTA-2 | Aplicar reglas de tarifas dinámicas (temporada alta/baja, ocupación proyectada, eventos locales) | Un cambio de regla actualiza la tarifa consultable y queda disponible para sincronización; objetivo de latencia por definir |
| RTA-3 | Soporte de bloqueo manual (mantenimiento) | El bloqueo reduce el inventario vendible una sola vez y genera un cambio trazable para los canales |
| RTA-4 | Consistencia estricta bajo alta concurrencia | En picos (ej. black friday) no se confirman dos reservas sobre el mismo inventario (bloqueo optimista) |
| RTA-5 | Exponer disponibilidad consolidada al Channel Manager | Los cambios de inventario se publican de forma durable para sincronización; latencia objetivo por definir |

### 5.3 Channel Manager Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| CM-1 | Sincronizar disponibilidad y tarifas con los canales habilitados | Cada cambio se procesa de forma trazable para los canales configurados; proveedores y latencia objetivo por definir |
| CM-2 | Mapear tipos de habitación internos a IDs externos por canal | `channel_mappings` permite traducir inventario por canal |
| CM-3 | Recibir reservas entrantes de OTAs vía webhook | Una notificación válida se registra una sola vez y se incorpora al flujo interno de reservas |
| CM-4 | Recuperarse de fallos de red o del proveedor | Los cambios pendientes se reintentan y los fallos persistentes quedan visibles para resolución operativa |
| CM-5 | Registrar historial de sincronización | Cada intento queda en `sync_log` con resultado y timestamp |

### 5.4 Booking Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| BK-1 | Gestionar reservas directas (web propia) | Reserva directa confirma habitación sin sobreventa |
| BK-2 | Gestionar reservas por central telefónica | Reserva telefónica ingresa y se integra al inventario |
| BK-3 | Gestionar reservas de canales externos (via CM) | Reserva OTA traducida se incorpora como reserva de canal |
| BK-4 | Bloqueo optimista al confirmar habitación | Dos intentos simultáneos: solo uno confirma, el otro rechaza o espera |
| BK-5 | Informar cambios relevantes del ciclo de vida | Creación, confirmación, cancelación y finalización se reflejan de forma consistente para los consumidores; estado y evento exactos por definir |

### 5.5 Front Desk Service

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| FD-1 | Preparar lista de llegadas del día | La lista presenta las reservas válidas que el hotel debe atender, sin tratar una solicitud pendiente como una reserva confirmada |
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
| **Rendimiento** | Consultas de disponibilidad de baja latencia y sincronización oportuna con canales; percentiles y objetivos numéricos por definir |
| **Entrega de eventos** | Los cambios pendientes de sincronización se conservan, procesan idempotentemente, reintentan y exponen cuando fallan; la confirmación de entrega de una OTA depende de cada proveedor |
| **Seguridad** | Cifrado de datos personales de huéspedes; pasarela de pago PCI-DSS sin almacenar datos completos de tarjeta |
| **Disponibilidad** | Rolling updates en Render; sin downtime en despliegues |
| **Observabilidad** | Métricas Prometheus, dashboards Grafana, logs centralizados con trazabilidad por `booking_id` |
| **Escalabilidad** | Diseño de microservicios que permita escalar el Rate & Availability Service de forma independiente |

---

## 7. Flujos Clave

### 7.1 Reserva directa (web propia)

1. Huésped consulta disponibilidad → Rate & Availability Service (con caché Redis).
2. Huésped solicita una reserva → Booking Service valida y asegura inventario antes de presentarla como confirmada.
3. La reserva confirmada actualiza la disponibilidad vendible.
4. Los canales habilitados reciben la actualización y Front Desk puede preparar la llegada.

### 7.2 Reserva entrante de OTA (webhook)

1. OTA envía una notificación de reserva → Channel Manager Service.
2. Channel Manager valida el origen, evita duplicados y traduce los datos al formato interno.
3. La reserva se incorpora al registro canónico de Booking y el inventario se actualiza una sola vez.
4. Si HotelSync no puede aceptar o reconciliar la reserva, el caso queda trazado y visible para resolución operativa; la política de compensación está pendiente de definición.

### 7.3 Ciclo de estancia completo

```
reserva confirmada → check-in (asignación habitación física) → checkout
  → housekeeping (tarea automática) y billing (cierre del folio)
  → estancia completada → loyalty (acumulación de puntos)
```

### 7.4 Saga de sincronización con canales externos

- Cada reserva confirmada en una OTA debe reflejarse de forma consistente en el inventario interno.
- Si la sincronización falla, se reintenta y se alerta al equipo responsable. La solución para conflictos que el proveedor ya confirmó requiere una política de negocio explícita; el sistema no puede garantizar por sí solo que una OTA externa revierta una venta.

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

Las metas de esta tabla son propuestas iniciales. Antes de usarlas como compromisos hay que acordar definiciones, período de medición, línea base y responsables. La arquitectura fuente no fija umbrales de latencia ni disponibilidad.

| Métrica | Meta |
| --- | --- |
| Confirmaciones internas por encima del inventario vendible | 0; incidentes de desincronización externa se miden por separado |
| Latencia de sincronización con OTAs | Por definir por proveedor y percentil |
| Ocupación promedio | Mejora sostenida por propiedad |
| ADR (tarifa promedio diaria) | Aumento sostenido |
| RevPAR (ingreso por habitación disponible) | Aumento sostenido |
| Tiempo de operación de check-in/check-out | Reducción vs. proceso manual |
| Diferencias entre inventario interno y cada canal | Medir por proveedor; umbral de tolerancia por definir |
| Disponibilidad del servicio en picos de venta | Objetivo y ventana de medición por definir |

---

## 10. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Desincronización con una OTA | Sobreventa, penalizaciones contractuales | Outbox, confirmación del broker, consumidor idempotente, reintentos y conciliación/alertas; la confirmación final depende de la API del proveedor |
| API, credenciales o certificación de una OTA no disponibles | Integración real bloqueada o incompleta | Confirmar proveedor piloto, acceso de pruebas y condiciones de integración antes de comprometer fechas |
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
- Channel Manager Service con el proveedor piloto que se confirme; el orden y alcance de Booking.com, Expedia y Airbnb están pendientes.
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

1. Los requisitos priorizados y las decisiones abiertas de la sección 13 fueron aprobados y cumplen criterios verificables.
2. Las pruebas de concurrencia no permiten confirmar más inventario del que HotelSync considera vendible.
3. Las integraciones habilitadas registran resultado, reintentos y fallos recuperables.
4. El ciclo priorizado de reserva, estancia y checkout opera de punta a punta.
5. Las métricas aprobadas tienen definiciones y resultados verificables.

---

## 13. Decisiones pendientes antes de comprometer implementación

Estas preguntas no invalidan el borrador. Determinan límites del producto, prioridad y criterios de aceptación. Se resolverán de forma iterativa antes de convertir los requisitos afectados en compromisos.

| Prioridad | Decisión pendiente | Supuesto provisional / recomendación | Por qué importa |
| --- | --- | --- | --- |
| P0 | ¿HotelSync atenderá a una sola cadena hotelera o será un producto SaaS para varias cadenas independientes? | El documento fuente describe una cadena con varias propiedades. Mantener ese supuesto hasta confirmación. | Cambia el modelo de cliente, aislamiento de datos, administración, roles y reportes. |
| P0 | ¿Qué OTA se integrará primero y hay acceso a ambiente de pruebas? | Empezar con un proveedor piloto y una interfaz de conector común; no prometer las tres integraciones en la primera entrega. | Cada proveedor tiene contratos, credenciales y procesos de habilitación distintos. |
| P0 | ¿Quién crea y confirma la reserva OTA dentro de HotelSync? | Recomendación: Channel Manager valida y normaliza la notificación; Booking conserva el registro canónico y coordina la reserva de inventario. | La arquitectura fuente asigna `booking.created` tanto al Channel Manager para reservas OTA como a Booking para el ciclo interno, sin precisar el dueño del registro ni prevenir duplicados. |
| P0 | ¿Cómo se define el inventario vendible frente a habitaciones ocupadas y bloqueadas por mantenimiento? | Definir una única fórmula de capacidad antes de fijar el esquema y los criterios de disponibilidad. | La fuente describe el bloqueo como reducción de disponibilidad y aumento de `blocked_count`, pero también calcula disponibilidad restando ese contador; esas reglas podrían descontar dos veces. |
| P1 | ¿El huésped debe crear una cuenta para reservar? | El repositorio actual permite reservas sin cuenta y cuentas opcionales; confirmar que ese comportamiento es el esperado para el producto. | Afecta el flujo de reserva, recuperación/cancelación y datos personales requeridos. |
| P1 | ¿Qué incluye Billing: registro de cargos y factura, o también cobro en línea? ¿En qué países y monedas opera? | Mantener fuera del alcance el almacenamiento de datos completos de tarjeta; definir después proveedor de pagos, países e impuestos. | Cambia cumplimiento, manejo de datos, integraciones y aceptación de facturas. |
| P1 | ¿Qué significan exactamente ocupación, ADR, RevPAR y “previsión de demanda”? | Acordar fórmula, zona horaria, fuente de datos y período para cada indicador antes de validar Analytics. | Sin definiciones compartidas, los paneles pueden mostrar cifras distintas para el mismo hotel. |
| P1 | ¿API Gateway será un servicio independiente o la entrada actual del frontend/BFF? | La arquitectura fuente propone gateway independiente; el repositorio ya usa BFF/rewrite y autenticación en los servicios. | Evita presupuestar dos capas de entrada sin una necesidad de producto clara. |

## 14. Estado de referencia del repositorio

La arquitectura objetivo enumera nueve dominios de negocio: Property, Rate & Availability, Channel Manager, Booking, Front Desk, Housekeeping, Billing, Loyalty y Analytics. El repositorio ya contiene Property, Rate & Availability, Booking, Front Desk, Housekeeping y Billing, además de `user-service` como servicio de identidad. Channel Manager, Loyalty y Analytics no aparecen como servicios implementados en el monorepo inspeccionado. Rate & Availability tampoco publica actualmente los eventos de inventario y tarifa requeridos por Channel Manager. Esta lista describe el punto de partida, no modifica el alcance objetivo.
