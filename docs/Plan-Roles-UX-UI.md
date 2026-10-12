# HotelSync — Plan de Vistas por Rol y Rediseño UX/UI (Punto 5)

## 1. Objetivos y Alcance

Garantizar que cada rol operativo cuente con una interfaz enfocada exclusivamente en su propósito de negocio, sin distracciones ni accesos indebidos, elevando sustancialmente el estándar visual y la ergonomía de uso del sistema.

### Matriz de Roles y Vistas

| Rol | Destino Predeterminado | Alcance Permitido | Acceso a Portal Público / Reservas |
| :--- | :--- | :--- | :--- |
| **RECEPTIONIST** | `/admin/recepcion` | Únicamente Check-in, Check-out y consulta de llegadas del hotel seleccionado. | **Bloqueado** (redirige a `/admin/recepcion`). No reserva ni navega catálogo público. |
| **HOUSEKEEPING** | `/admin/housekeeping` | Tablero de tareas de limpieza (asignar, iniciar, completar). | **Bloqueado** (redirige a `/admin/housekeeping`). No navega catálogo ni otras zonas admin. |
| **MANAGER** | `/admin` | Panel de gestión, métricas, administración de hoteles, habitaciones e inventario. | **Permitido** (modo auditoría/huésped accesible mediante switch en navbar). |
| **SUPER_ADMIN** | `/admin` | Acceso global a todas las funciones + selector de simulación "Ver como...". | **Permitido** en todas las vistas. Al activar "Ver como...", redirige de inmediato a la vista del rol seleccionado. |

---

## 2. Flujo de Navegación y Redirección

1. **Post-Login y Redirección Automática**:
   - Actualizar `postLoginDest` en `apps/front/src/app/cuenta/entrar/form.tsx`:
     - `RECEPTIONIST` → `/admin/recepcion`
     - `HOUSEKEEPING` → `/admin/housekeeping`
     - `MANAGER` / `SUPER_ADMIN` → `/admin`
     - `GUEST` → `/mis-reservas` (o `returnTo`)
2. **Navegación Reactiva en Simulación ("Ver como...")**:
   - En `useViewAs` / `ViewAsSelector`, al seleccionar un rol en modo simulación:
     - Si se elige `RECEPTIONIST`, navegar de inmediato a `/admin/recepcion`.
     - Si se elige `HOUSEKEEPING`, navegar de inmediato a `/admin/housekeeping`.
     - Si se elige `MANAGER`, navegar a `/admin`.
     - Si se elige `GUEST`, navegar a `/`.
     - Si se restaura `SUPER_ADMIN`, volver a `/admin`.
3. **Guard / Protección de Rutas en Cliente**:
   - Implementar control en layout/páginas administrativas y públicas:
     - Bloquear acceso a recepcionistas y limpieza fuera de su panel operativo.
     - Ocultar del navbar enlaces irrelevantes para roles operativos.

---

## 3. Rediseño y Elevación UX/UI

### A. Barra de Navegación y Entorno de Trabajo Operativo
- Sustituir la barra administrativa genérica por un encabezado de estación de trabajo moderno:
  - Indicador de rol activo con badge de alta legibilidad.
  - Accesos directos a selección de hotel y fecha en recepción/limpieza con componentes unificados.
  - Switch fluido para el Manager entre "Gestión" y "Vista Huésped".

### B. Tablero de Recepción (`/admin/recepcion`)
- Rediseñar `ReceptionBoard`:
  - Tarjetas de llegadas con microinteracciones y jerarquía visual refinada.
  - Asignación de habitación física con autocompletado y validación visual inmediata.
  - Botones de acción (Check-in / Check-out) con estados de carga claros y mensajes de éxito no intrusivos.
  - Estados vacíos con iconografía representativa y contexto de ayuda.

### C. Tablero de Limpieza (`/admin/housekeeping`)
- Rediseñar la gestión de tareas:
  - Estados representados con código visual intuitivo (Pendiente, En progreso, Completada).
  - Acciones rápidas de 1 clic para camaristas.
  - Formulario de asignación estilizado sin romper el flujo de trabajo táctil.

### D. Panel de Control y Métricas del Manager / Super Admin (`/admin`)
- Transformar las tarjetas simples en un panel ejecutivo con tarjetas de resumen visual (KPIs, ocupación, llegadas y alertas).
- Acceso directo a administración de inventario y configuración de hoteles.

---

## 4. Pasos de Implementación

- [ ] **Fase 1**: Refactorizar lógica de redirección y permisos en `lib/view-as.ts`, `form.tsx` y `NavbarClient.tsx`.
- [ ] **Fase 2**: Implementar layout operativo y protección de rutas en `/admin/layout.tsx`.
- [ ] **Fase 3**: Rediseñar la interfaz de Recepción (`ReceptionBoard.tsx` y `/admin/recepcion/page.tsx`).
- [ ] **Fase 4**: Rediseñar la interfaz de Housekeeping (`board.tsx` y `/admin/housekeeping/page.tsx`).
- [ ] **Fase 5**: Rediseñar el dashboard principal `/admin/page.tsx` para Manager y Super Admin.
- [ ] **Fase 6**: Validar compilación (`npm run build`) y verificar flujos de usuario por rol.
