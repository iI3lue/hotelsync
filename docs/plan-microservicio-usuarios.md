# Plan: usuarios, habitaciones físicas y Housekeeping

## Objetivo

Agregar identidad y autorización para el personal de HotelSync, permitir reservas sin obligar al huésped a crear una cuenta y registrar las habitaciones físicas del hotel. La creación de una unidad activa debe aumentar la disponibilidad en Rate & Availability (R&A) durante un horizonte móvil de 365 días.

Este documento conserva el plan acordado. La implementación debe seguir el ciclo SDD; no reemplaza sus artefactos de propuesta, especificación, diseño y tareas.

## Decisiones acordadas

- Se permite reservar sin cuenta. El huésped puede registrarse opcionalmente.
- El servicio de usuarios administra cuentas, roles y asignaciones por hotel; no administra reservas ni estados operativos de habitaciones.
- El catálogo de unidades físicas pertenece a Property Service. No se crea un microservicio independiente de habitaciones.
- Al crear una habitación activa, Property publica un evento confiable y R&A incorpora esa unidad al inventario diario durante los próximos 365 días.
- Housekeeping conserva las tareas y estados de limpieza. El personal de limpieza tiene cuentas con rol propio.
- El commit `0285314` es el único checkpoint previo. No crear otro commit hasta recibir orden explícita del usuario.
- Antes de modificar código, revisar el pronóstico de tamaño SDD. Con la estrategia `Ask me`, detenerse y preguntar si el cambio supera 400 líneas.

## Límites de dominio

| Servicio | Datos y responsabilidad propios |
|---|---|
| `user-service` | Cuentas, credenciales, roles, sesiones e invitaciones. `hotel_id` es un UUID externo, sin FK a Property. |
| Property Service | Hoteles, tipos de habitación y catálogo estable de unidades físicas. |
| R&A Service | Tarifas e inventario vendible agregado por tipo de habitación y fecha. No administra números de habitación. |
| Booking Service | Reservas y datos de contacto del huésped asociados a cada reserva. |
| Front Desk Service | Check-in/out y asignación de una unidad física a una reserva. |
| Housekeeping Service | Estado sucia/limpia, tareas de limpieza, asignación y registro de finalización. |

Los servicios mantienen bases separadas. Las referencias entre bases son UUID, nunca claves foráneas ni joins entre servicios.

## Roles y permisos

| Rol | Alcance |
|---|---|
| `SUPER_ADMIN` | Global; crea y administra managers y sus asignaciones a hoteles. |
| `MANAGER` | Un hotel; administra catálogo físico, tipos, servicios del hotel, tarifas, disponibilidad y personal del hotel. |
| `RECEPTIONIST` | Un hotel; consulta llegadas y opera check-in/check-out. |
| `HOUSEKEEPER` | Un hotel; consulta y completa tareas de limpieza asignadas. |
| `GUEST` | Cuenta opcional; consulta sus propias reservas. No hace falta cuenta para buscar o reservar. |

Cada servicio valida los permisos en el backend y compara el hotel del recurso con el alcance del token. El frontend no es una frontera de autorización.

## Endpoints propuestos

### `user-service`

| Método y ruta | Acceso y uso |
|---|---|
| `POST /v1/auth/register` | Público; registro opcional de cuenta `GUEST`. |
| `POST /v1/auth/login` | Autentica una cuenta activa. |
| `POST /v1/auth/refresh` / `POST /v1/auth/logout` | Rotación y revocación de sesión. |
| `POST /v1/auth/password/forgot` / `POST /v1/auth/password/reset` | Recuperación sin revelar si un correo está registrado. |
| `GET /v1/users/me` / `PATCH /v1/users/me` | Consulta y edición del perfil propio; no permite cambiar rol u hotel. |
| `POST /v1/admin/managers` | `SUPER_ADMIN` crea/invita un manager y lo asigna a un hotel existente. |
| `GET /v1/admin/managers?hotel_id=...` | `SUPER_ADMIN` lista managers. |
| `PATCH /v1/admin/managers/:id` | `SUPER_ADMIN` modifica o desactiva un manager. |
| `POST /v1/hotels/:hotelId/staff` | `MANAGER` del hotel o `SUPER_ADMIN` invita recepcionistas o Housekeepers. |
| `GET /v1/hotels/:hotelId/staff?role=...` | Lista personal autorizado del hotel. |
| `PATCH /v1/hotels/:hotelId/staff/:userId` | Activa o desactiva una cuenta del hotel. |
| `GET /.well-known/jwks.json` / `GET /health` | Claves públicas para validar JWT y health check. |

Las invitaciones y recuperación requieren una integración de correo; proveedor y configuración quedan por definir durante diseño.

### Property Service — unidades físicas

| Método y ruta | Acceso y uso |
|---|---|
| `POST /v1/hotels/:hotelId/rooms` | `MANAGER` del hotel crea una unidad activa e indica tipo y fecha de disponibilidad. |
| `GET /v1/hotels/:hotelId/rooms` | Lista el catálogo del hotel. |
| `PATCH /v1/hotels/:hotelId/rooms/:roomId` | Actualiza datos del catálogo. Los cambios que reduzcan capacidad quedan sujetos a una política segura para reservas futuras. |

`PhysicalRoom` debe tener UUID, `hotel_id`, `room_type_id`, `room_number`, `available_from` y estado activo. El número es único dentro del hotel. Las relaciones con hotel y tipo de habitación son FK locales a Property.

El catálogo de servicios/amenities que el manager puede ofrecer también pertenece a Property, no a `user-service`. El schema actual no tiene una entidad independiente de servicios del hotel; el diseño debe decidir si reutiliza amenities de `RoomType` o agrega `HotelService` con nombre, descripción, categoría y estado activo.

Endpoints candidatos si se confirma el catálogo de servicios independiente:

- `GET /v1/hotels/:hotelId/services`
- `POST /v1/hotels/:hotelId/services`
- `PATCH /v1/hotels/:hotelId/services/:serviceId`

### Booking Service — huésped sin cuenta

- `POST /v1/bookings` acepta fechas, hotel, tipo de habitación y los datos de contacto requeridos del huésped (`name`, `email`, `phone`); no exige token ni recibe un `guest_id` elegido por el navegador.
- Booking genera el identificador del huésped del lado servidor. Si quien reserva inició sesión, registra además `booked_by_user_id` opcional; quien reserva puede ser distinto de quien se aloja.
- Agregar `GET /v1/bookings/me` para cuentas autenticadas.
- El acceso/cancelación de reservas anónimas debe validarse con enlace firmado de un solo uso u OTP por correo; el UUID de reserva no es autorización.
- `booking.created` comparte con Front Desk solo los datos mínimos necesarios para mostrar la llegada. Nunca contiene credenciales ni tokens.

### Housekeeping

- Mantener `GET /v1/tasks?hotel_id=&status=` para la vista del manager.
- Agregar `GET /v1/tasks/mine`, filtrado por el usuario del JWT.
- La asignación guarda `assigned_to_user_id` UUID, no un nombre libre. Solo se asigna personal activo del mismo hotel.
- `PUT /v1/tasks/:id/complete` permite al Housekeeper asignado (o manager autorizado) completar la tarea. En una transacción marca la tarea `done`, cambia la habitación a `clean` y guarda `completed_by_user_id` y `completed_at`.
- Para el MVP, completar una tarea asignada es una sola acción. El estado adicional `in_progress` puede agregarse después si se requiere medir quién inició la limpieza.

## Esquema de datos propuesto

### Base aislada de `user-service`

- `users`: UUID, email normalizado único, `password_hash`, nombre, teléfono, estado (`INVITED`, `ACTIVE`, `LOCKED`, `DISABLED`), verificación y timestamps.
- `role_assignments`: FK local a `users`, rol, `hotel_id` nullable, actor que asignó, estado y fecha. `MANAGER`, `RECEPTIONIST` y `HOUSEKEEPER` requieren hotel; `SUPER_ADMIN` y `GUEST` son globales.
- `refresh_sessions`: hash del refresh token, usuario, expiración, revocación y rotación. No guardar tokens en texto plano.
- `auth_tokens`: hashes de invitación, verificación y recuperación con expiración y fecha de uso.
- `audit_log`: actor, acción, usuario/hotel afectado y fecha; nunca almacenar contraseñas ni tokens.

El access token será de corta duración y firmado asimétricamente; los servicios validan la firma usando JWKS cacheado, sin consultar `user-service` en cada request. El refresh token se rota y se almacena hasheado. La sesión del frontend se mantiene mediante cookie `HttpOnly`, `Secure` en producción y `SameSite` apropiado.

### Property Service

Agregar `PhysicalRoom` con FK locales a `Hotel` y `RoomType`. Validar en la capa de servicio que `room_type_id` pertenezca al `hotel_id` indicado. Limpieza y ocupación no son columnas operativas de esta tabla.

### R&A Service

El evento de alta aumenta `available_count` por cada fecha desde `available_from` hasta el fin del horizonte móvil de 365 días; crea filas faltantes con disponibilidad inicial de una unidad e invalida las claves Redis afectadas. Una tabla local de eventos aplicados con `event_id` único hace idempotente el consumidor.

El seed actual define cupos de ejemplo para siete días y `available_count` disminuye al confirmar reservas. Antes de activar el consumidor hay que reconciliar esos datos con el catálogo físico para evitar duplicar capacidad. Una baja/cambio de tipo no debe reducir disponibilidad de fechas con reservas confirmadas; su política se deja fuera de esta primera entrega.

### Housekeeping y Front Desk

Ambos guardan `physical_room_id` como UUID externo en vez de depender solo de `room_number`. Housekeeping reemplaza el `assigned_to` de texto por `assigned_to_user_id` UUID. No hay FK entre estas bases y Property.

## Comunicación entre servicios

```text
Next.js/BFF ──HTTPS──> user-service (login, sesión, perfil, invitaciones)
    │
    └──JWT──> Property / R&A / Booking / Front Desk / Housekeeping
                 validación local con JWKS cacheado

Manager ──> Property: crear PhysicalRoom + outbox en una transacción
Property ──RabbitMQ──> R&A: physical-room.created (idempotente)
Property ──RabbitMQ──> Housekeeping: proyección de unidad si el panel necesita todas las habitaciones
Front Desk ──RabbitMQ──> Housekeeping: checkout.completed → tarea pendiente + habitación sucia
Booking ──REST interno──> R&A: reservar/liberar inventario, con identidad de servicio
```

Una falla de RabbitMQ deja el evento de Property en estado pendiente para reintento. La creación puede reflejarse en disponibilidad con retraso breve; inicialmente eso puede causar subventa temporal, pero no debe duplicar cupos.

## Fases SDD e implementación

1. Inicializar SDD y crear proposal/spec/design/tasks; revisar capacidades y contratos antes del código.
2. `user-service`: esquema, migraciones, cuentas, sesiones, roles, invitaciones, endpoints y pruebas.
3. Autorización: middleware JWT/JWKS y control de hotel en servicios existentes; mantener búsquedas públicas anónimas.
4. Property: catálogo `PhysicalRoom`, endpoints manager-scoped, definición del catálogo `HotelService` y outbox `physical-room.created`.
5. R&A: consumidor idempotente, horizonte de 365 días, invalidación Redis y reconciliación del seed.
6. Booking: datos de huésped para checkout anónimo, ID generado en servidor, gestión segura por email y cambio del evento/proyección de llegadas.
7. Housekeeping/Front Desk/frontend: UUID de unidad, rol Housekeeper, panel de tareas y acción única de completar.
8. Docker Compose, variables de entorno, scripts raíz, CI y documentación; pruebas de contrato y flujos integrados.

## Criterios de aceptación

- Un manager no puede leer ni modificar datos de otro hotel, aun enviando otro `hotel_id` manualmente.
- Un huésped puede reservar sin cuenta; el backend genera el identificador y limita el acceso a esa reserva mediante verificación segura.
- La creación de una unidad activa suma exactamente una habitación a cada fecha futura del horizonte configurado; reentregar el evento no duplica inventario y las cachés quedan invalidadas.
- El seed inicial queda alineado con el catálogo físico, sin cupos duplicados.
- Un Housekeeper ve sus tareas asignadas y solo puede completar las propias; completar deja tarea y habitación consistentes en una transacción.
- Los servicios conservan sus propias bases; no se agregan FK entre servicios.

## Cómo retomar el protocolo SDD

La sesión anterior dejó creado el checkpoint `0285314`, pero la inicialización SDD quedó bloqueada: no se generaron proposal/spec/design/tasks ni se modificó código del plan. El executor de `sdd-init` devolvió un resultado bloqueado (`sdd_task_result_malformed`), y el protocolo no permite reintentar fases SDD en esa misma sesión.

1. Abrí una sesión nueva en la raíz de HOTELSYNC.
2. Pegá este pedido:

   > Retomá el plan de `docs/plan-microservicio-usuarios.md`. El único commit previo es `0285314`; no hagas nuevos commits hasta que te lo ordene. Seguí SDD con preflight interactivo, artefactos en Engram y estrategia “Ask me”. Inicializá SDD en un executor funcional y prepará propuesta, especificaciones, diseño y tareas. No toques código de producto hasta que me muestres el pronóstico de tamaño y yo decida la estrategia de entrega.

3. Respondé el preflight SDD canónico con: **Interactive**, **Engram**, **Ask me**. Si el executor de inicialización vuelve a quedar bloqueado, detené el flujo y no intentes saltar a implementación.

No hay cambios de producto aplicados todavía. El árbol estaba limpio después del commit previo.
