# HotelSync Front — Plan de mejoras UX/UI

## 0. Alcance confirmado

- Rango de fechas: se unifica en la **reserva** (`BookingForm` en `/reservas/nueva`); disponibilidad (`/hotels/[id]/availability`) sigue como consulta de una fecha.
- Perfil: se agrega **pantalla editable de perfil/completado** (no solo menú).
- RBAC: selector **"Ver como…"** solo para `SUPER_ADMIN`, solo simulación visual (el backend sigue mandando).

## 1. Refactorización de calendarios

- [x] Unificar los dos `AvailabilityCalendar` de `BookingForm` en un selector de rango (`RangeCalendar` con `mode="range"`, `min={1}`, `excludeDisabled`): clic fija llegada, segundo clic fija salida; en táctil, dos toques (sin hover — DayPicker v10 no previsualiza el rango al hover).
- [x] Sincronizar llegada/salida en el menú principal (`SearchBar`): `DatePickerButton` acepta `rangeFrom`/`rangeTo` (pintado solo visual) y `openSignal`; al abrir salida se ve la llegada marcada y el rango sombreado.
- [ ] Dar estilo a los desplegables de Año/Mes del calendario (coherentes con el tema claro/oscuro).
- [x] Excluir días sin stock del rango (`excludeDisabled`) y validar cada noche de la estadía vía `/api/rate/availability/range` antes de avanzar (el backend confirma con 409 de todos modos).

## 2. UI/UX y accesibilidad

- [x] Ampliar el hitbox de los campos Llegada/Salida: todo el contenedor abre el calendario (vía `openSignal`; el botón interno sigue alternando).
- [x] Renombrar navegación "Reservar" → **"Mis reservas"** (apunta a `/mis-reservas`).
- [x] Micro-interacciones: ya existían (hovers en botones/tarjetas/nav, `animate-scale-in` en popovers, sombras); kill-switch global de `prefers-reduced-motion` ya cubría las nuevas animaciones — sin cambios necesarios.

## 3. Temas claro/oscuro

- [x] Arreglar el toggle en Android: área táctil 44px (`h-11 w-11`), sin gestos propios (solo `onClick`), cierre de menú intacto.
- [x] Redefinir tokens del modo claro con contraste AA: override solo-modo-claro que oscurece `text-brand-gold` a `#7A5F1C` (~6:1 sobre blanco); dorado original solo en oscuro/decorativo.

## 4. Auth y perfil (Auth0/Google)

- [x] Toast "Inicio de sesión exitoso" con correo (login password), y "Sesión iniciada con Google" vía Google (callback agrega `?login=google`, lo consume `LoginToast` en el layout y lo limpia).
- [x] Sincronizar nombre, correo y foto desde los claims verificados del ID token (`federated.ts` extrae `picture`; user-service persiste `picture_url` — migración `20261012000000_add_picture_url` — y lo sincroniza en cada login federado; `publicProfile`/`getMe`/`updateMe` lo exponen).
- [x] Crear ruta de perfil editable `/cuenta/perfil`: muestra nombre/correo/foto, permite editar nombre y completar **teléfono** si falta (`PATCH /api/auth/me` → `PATCH /users/me`); **no pedir edad**. Email read-only.
- [x] Teléfono se sigue pidiendo en la reserva cuando sea necesario; sin fricción extra en el login.

## 5. Roles y vistas (RBAC — "Ver como…")

- [x] Selector de vista en la navbar **solo visible para `SUPER_ADMIN`** (`ViewAsSelector`): Guest / Receptionist / Housekeeping / Manager / (volver a Super Admin).
- [x] La vista simulada cambia **solo el renderizado** (`resolveViewedRole`: no-admin siempre se ve a sí mismo; `AdminNav` filtra secciones; link Administrar solo en vistas de personal); la sesión y los permisos reales contra la API siguen siendo los de super_admin.
- [x] Experiencia por rol: guest (buscar, reservar, mis reservas), receptionist (panel de check-in), housekeeping (tablero de limpieza), manager (hoteles e inventario), super_admin (todo + selector).
- [x] Indicador visible persistente de "Viendo como X" (`ViewingAsBanner`) con salida en un clic; la preferencia vive solo en el cliente (`hotelsync-view-as-v1`), nunca en cookie de sesión.
- [x] Nota: hoy el `admin/layout` no filtra por rol (zona académica, con TODO de middleware); este selector no reemplaza el gating real del backend.

## 6. Verificación

- `npm test -- --runInBand` y `npm run build` en `apps/front`.
- Manual en PC + Android: rango de fechas, toggle de tema, login correo/Google con toasts, perfil editable, y "Ver como…" por cada rol.
