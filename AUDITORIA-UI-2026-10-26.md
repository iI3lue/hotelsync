# Auditoría de interfaz — HotelSync (producción)

- **Fecha:** 26 de octubre de 2026
- **Entorno auditado:** https://hotelsync-front.vercel.app
- **Herramienta:** ego-browser (Citro Labs) + inspección del código del monorepo
- **Cuentas utilizadas:** SUPER_ADMIN, MANAGER (credenciales provistas por el responsable; no se registran en este documento)
- **Vista:** escritorio 1509 px y móvil 390×844
- **Alcance:** home público, buscador, login, panel admin, hoteles, habitaciones, inventario, personal, revenue, simulador OTA, recepción y limpieza

> No se ejecutaron escrituras destructivas en producción (crear/eliminar hoteles, check-in/out, pagos o cancelaciones). Las funciones de escritura se evaluaron por inspección de UI, validaciones visibles y lectura del código.

---

## 1. Resumen ejecutivo

| # | Severidad | Hallazgo | Estado |
|---|-----------|----------|--------|
| 1 | **Alta** | Un MANAGER puede consultar métricas de Revenue de hoteles que no le pertenecen | Confirmado end-to-end |
| 2 | **Alta** | `/admin/staff` no carga hoteles en producción (falla de CORS); la columna HOTEL queda vacía | Confirmado en navegador y código |
| 3 | Media | El dashboard del MANAGER muestra tarjetas de Recepción y Limpieza que redirigen al mismo panel | Confirmado en navegador |
| 4 | Media | El login muestra el error en inglés: “Invalid credentials” | Confirmado en navegador y código |
| 5 | Media | Error de hidratación de React (#418) en el home público en cada carga dura | Confirmado y reproducido |
| 6 | Baja | Casi todas las rutas de `/admin` comparten el mismo `<title>` genérico | Confirmado |
| 7 | Baja | Fecha del dashboard con capitalización incorrecta: “Martes, 27 De Octubre De 2026” | Confirmado |
| 8 | Baja | El KPI “Reservas pendientes” está acotado al día pero el rótulo sugiere total global | Confirmado en código |
| 9 | Baja | El footer público se renderiza dentro de todas las pantallas de admin | Confirmado |
| 10 | Baja | `/admin/analytics` quedó sin responder al cambiar de hotel durante la prueba | Confirmado (timeout de evaluación) |

**Resultado general:** la aplicación es navegable y las rutas principales responden. Los problemas más relevantes son de **aislamiento de datos entre hoteles** y de **gestión de personal en producción**; el resto son defectos de UX, accesibilidad y consistencia.

---

## 2. Hallazgos detallados

### H1 — Manager puede consultar Revenue de cualquier hotel (Alta)

**Qué ocurre**
En `/admin/analytics`, la cuenta MANAGER ve en el selector hoteles de toda la cadena, aunque su alcance real es 1 solo hotel. El servicio de analítica solo valida el rol, no el hotel solicitado.

**Evidencia**
- La cuenta MANAGER tiene `assignment.hotel_id = d68c107b-...` (Hotel Sync Centro).
- Con esa sesión, se consultaron **los 9 hoteles** vía el BFF: `GET /api/analytics/dashboard/<hotel_id>?from=2026-10-01&to=2026-10-26` devolvió **200 en los 9 casos**.
- Ejemplo con datos reales de otro hotel: **Almirante** devolvió `occupancy_avg: 0.5`, `adr_avg: 9500`, `revpar_avg: 4750`, pese a que el manager solo tiene asignado Centro.
- En la UI, el selector de Revenue lista hoteles que no pertenecen al manager.
- `services/analytics-service/src/routes/dashboard.ts:8` y `routes/metrics.ts:8` aplican únicamente `requireRole(["MANAGER", "SUPER_ADMIN"])`.
- `services/analytics-service/src/middleware/auth.ts:27` construye `req.user` solo con `userId` y `role`; no conserva `hotel_id`.
- El BFF (`apps/front/src/middleware.ts`) solo inyecta el Bearer para `/api/*`; no valida el hotel solicitado.
- `apps/front/src/app/admin/analytics/page.tsx:48` carga el catálogo completo con `fetchHotels()`.

**Impacto**
La cuenta MANAGER leyó métricas reales de otra propiedad (Almirante) sin autorización. Es una fuga de información entre tenants.

**Recomendación**
1. Incluir `hotel_id` en el JWT y validar en `analytics-service` que `req.user.hotel_id === hotel_id` salvo `SUPER_ADMIN` (403 en caso contrario).
2. Filtrar el selector de hoteles en el front según la sesión.
3. Agregar un test de autorización cruzada (manager del hotel A pidiendo el hotel B).

---

### H2 — `/admin/staff` no carga hoteles en producción (Alta)

**Qué ocurre**
Al abrir Personal, el navegador intenta `GET https://hotelsync-property-service.onrender.com/v1/hotels` y falla con `TypeError: Failed to fetch`. La columna HOTEL queda en “—” para todos los usuarios y el formulario de alta no puede preseleccionar un hotel.

**Evidencia**
- Error de red capturado en `/admin/staff` con SUPER_ADMIN y MANAGER.
- `apps/front/src/app/admin/staff/page.tsx:1` es `"use client"` y en la línea 4 importa `fetchHotels` desde `@/lib/api`.
- `apps/front/src/lib/api.ts:11-15` documenta que ese módulo es **solo servidor** y que importarlo en el browser rompe el bundle.
- `apps/front/src/lib/api.ts:39` usa `NEXT_PUBLIC_PROPERTY_API_URL` como URL absoluta y `api.ts:212` hace el fetch directo; en producción apunta a Render y el navegador bloquea la petición cross-origin.

**Impacto**
La gestión de personal queda degradada en producción: no se puede asociar el alta a un hotel ni ver el hotel del personal existente. Un MANAGER depende de que el backend reciba el `hotel_id` correcto.

**Recomendación**
- No importar `@/lib/api` desde Client Components. Cargar los hoteles en un Server Component y pasarlos como prop, o usar el helper de `@/lib/api-client` (`/api/property/hotels`), que pasa por el rewrite del BFF.
- Eliminar el `catch(() => [])` silencioso para que el error sea visible y no se muestre “—” como si fuera un dato válido.

---

### H3 — Dashboard del Manager con accesos muertos (Media)

**Qué ocurre**
El dashboard del MANAGER muestra las tarjetas “Recepción & Check-in” y “Limpieza & Estado”. Al hacer clic, el middleware redirige de vuelta a `/admin` porque el rol no tiene acceso a esas rutas.

**Evidencia**
- Navegación real del MANAGER: `Panel`, `Hoteles`, `Personal`, `Revenue`.
- `/admin/recepcion` y `/admin/housekeeping` responden con redirect a `/admin`.
- `apps/front/src/app/admin/page.tsx:198-272` renderiza las tarjetas sin condicionarlas por rol.
- `apps/front/src/lib/routes.ts:53-60` y `apps/front/src/middleware.ts` (`isAllowedAdminPath`) niegan esas rutas al MANAGER.

**Impacto**
El usuario percibe que la aplicación “no hace nada” al hacer clic. Genera soporte innecesario y desconfianza.

**Recomendación**
- Ocultar esas tarjetas para MANAGER, o permitirle un modo de solo lectura de recepción/limpieza si el negocio lo requiere.
- Centralizar la matriz rol → rutas en un único helper reutilizado por dashboard, nav y middleware.

---

### H4 — Error de login en inglés (Media)

**Qué ocurre**
Con credenciales inválidas, la interfaz en español muestra “Invalid credentials”.

**Evidencia**
- Reproducido en `/cuenta/entrar` con un correo inexistente.
- `services/user-service/src/services/auth.service.ts:117` devuelve el mensaje en inglés.
- `apps/front/src/app/cuenta/entrar/form.tsx:82-87` muestra `err.message` tal cual.

**Impacto**
Inconsistencia de idioma en un punto crítico (acceso). Además el mensaje no distingue entre correo inexistente y contraseña incorrecta, pero eso es una decisión de seguridad aceptable.

**Recomendación**
- Devolver un `code` estable desde el backend (`INVALID_CREDENTIALS`) y traducirlo en el front, o mapear el mensaje en el formulario.
- Revisar el resto de los mensajes de `AppError` expuestos al usuario.

---

### H5 — Error de hidratación React #418 en el home (Media)

**Qué ocurre**
En cada carga dura del home se registra:

```
Uncaught Error: Minified React error #418 ...
args[]=HTML
```

React #418 corresponde a un fallo de hidratación: el HTML del servidor no coincide con el primer render del cliente.

**Evidencia**
- Reproducido dos veces con recarga completa de `/`.
- `apps/front/src/app/layout.tsx:35` ya tiene `suppressHydrationWarning` en `<html>`, por lo que el conflicto está en otro nodo.
- Los candidatos naturales son los componentes que dependen de `localStorage`/tema: `ThemeProvider`, `NavbarClient`, `ThemeToggle`, `CurrencyProvider` y `ConsentGate` (`layout.tsx:45-65`).

**Impacto**
React descarta el HTML hidratado y vuelve a renderizar en cliente. Provoca parpadeo, coste extra y errores en consola; en el peor caso, diferencias visuales entre SSR y cliente.

**Recomendación**
- Ejecutar el build sin minificar en un entorno de staging para obtener el componente exacto.
- Revisar que todo valor leído de `localStorage` se renderice solo después del montaje (`useEffect` + estado inicial neutro).
- Verificar que el toggle de tema no imprima texto dependiente de `resolvedTheme` durante el SSR.

---

### H6 — Títulos de página genéricos en admin (Baja)

**Qué ocurre**
`/admin`, `/admin/hotels`, `/admin/hotels/new`, detalle de hotel, habitaciones, inventario, personal, analytics y simulador comparten el título “HotelSync — Hoteles en Colombia y Argentina”.

**Evidencia**
- Solo `admin/recepcion/page.tsx:9` y `admin/housekeeping/page.tsx:5` exportan `metadata`.
- El resto hereda el `title.default` de `apps/front/src/app/layout.tsx:17`.

**Impacto**
Pestañas, historial y marcadores resultan indistinguibles. Afecta también a la accesibilidad (lectores de pantalla anuncian el mismo título).

**Recomendación**
- Exportar `metadata` con `title` por ruta. Para rutas dinámicas, usar `generateMetadata` con el nombre del hotel.

---

### H7 — Capitalización incorrecta de la fecha (Baja)

**Qué ocurre**
El dashboard muestra “Martes, 27 De Octubre De 2026”.

**Evidencia**
- `apps/front/src/app/admin/page.tsx:83` aplica la clase `capitalize`, que capitaliza cada palabra.
- El formateo `es-CO` ya devuelve “martes, 27 de octubre de 2026”; la clase lo altera.

**Impacto**
Error ortográfico visible en la pantalla principal del admin.

**Recomendación**
- Quitar `capitalize` y usar `first-letter:uppercase` si se quiere capitalizar solo la primera letra.

---

### H8 — KPI “Reservas pendientes” ambiguo (Baja)

**Qué ocurre**
El dashboard muestra “RESERVAS PENDIENTES 0”, mientras Recepción lista decenas de reservas con estados `pending` de otras fechas.

**Evidencia**
- `apps/front/src/app/admin/page.tsx:53` consulta `fetchBookings({ hotel_id, status: "pending", date: today })`.
- El enlace “Revisar” agrega `date=<hoy>&tab=reservas`, por lo que el alcance real es “pendientes de hoy”.

**Impacto**
El operador puede interpretar que no hay pendientes en toda la operación.

**Recomendación**
- Rotular “Reservas pendientes (hoy)” o calcular el total sin filtro de fecha y ofrecer el desglose por día.

---

### H9 — Footer público dentro del admin (Baja)

**Qué ocurre**
Las pantallas de administración muestran el footer del sitio público (“PLANIFICAR UNA ESTANCIA”, “DESTINOS”, “EQUIPO”, legales).

**Evidencia**
- `apps/front/src/app/layout.tsx:62` renderiza `<SiteFooter />` para todo el árbol.
- `apps/front/src/app/admin/layout.tsx` no lo excluye.

**Impacto**
Ruido visual y enlaces que sacan al operador del flujo de trabajo.

**Recomendación**
- Mover el footer a un layout de la zona pública o condicionarlo por ruta.

---

### H10 — Revenue queda sin responder al cambiar de hotel (Baja)

**Qué ocurre**
Durante la prueba con MANAGER, al cambiar el hotel en `/admin/analytics`, la página dejó de responder y `page.evaluate` agotó 15 s. Se recuperó recargando.

**Evidencia**
- Timeout de evaluación reportado por ego-browser; el proceso quedó “unresponsive”.
- La API de analytics sí respondió 200 en las pruebas directas, por lo que el bloqueo es del cliente/render y no del servicio.
- La pantalla no muestra un estado de carga robusto ni cancela la request anterior.

**Impacto**
Sensación de congelamiento; el usuario puede cerrar la pestaña antes de que carguen las métricas.

**Recomendación**
- Mostrar skeleton/estado “cargando” con cancelación de la request anterior (`AbortController`).
- Agregar timeout y mensaje de reintento; evitar bloquear el hilo principal con el render del gráfico.

---

## 3. Observaciones adicionales

- **Responsive:** a 390 px no hay desborde horizontal en home, buscador ni login. Se detectaron 32–35 elementos clicables con menos de 32 px de alto/ancho y 35–53 nodos de texto por debajo de 12 px. Conviene revisar los tamaños táctiles y la legibilidad en móvil, especialmente en el buscador y el footer.
- **Recepción:** las reservas canceladas muestran solo el badge de estado, sin acciones destructivas (correcto). Los botones Confirmar/Cancelar aparecen solo para `pending` (`components/BookingsAutoTable.tsx:227`).
- **Housekeeping:** la asignación está restringida a MANAGER/SUPER_ADMIN en UI (`housekeeping/board.tsx:167`); el HOUSEKEEPER solo completa sus tareas. Coherente con el rol.
- **“Ver como”:** funciona para Manager, Recepcionista y Limpieza; el banner aclara que no cambia permisos reales. La simulación de Invitado no pudo completarse: la navegación devolvió `ERR_NAME_NOT_RESOLVED` en la prueba.
- **Navegación de roles:** Recepcionista y Limpieza quedan correctamente confinados a su área y redirigidos si intentan `/admin/staff`, `/admin/analytics` o `/admin/simulador`.
- **Datos:** el home muestra 9 hoteles y el buscador 9 tarjetas; no se detectaron imágenes rotas ni errores HTTP 4xx/5xx salvo los 401 esperados de `/api/auth/me` sin sesión.

---

## 4. Plan de acción sugerido

**Prioridad 0 (antes de una demo con clientes)**
1. Cerrar el acceso cruzado de Revenue (H1).
2. Corregir la carga de hoteles en Personal (H2).
3. Quitar o redirigir las tarjetas muertas del dashboard Manager (H3).

**Prioridad 1 (siguiente sprint)**
4. Traducir los errores de autenticación (H4).
5. Erradicar el error de hidratación (H5).
6. Títulos por ruta (H6).

**Prioridad 2 (pulido)**
7. Fecha, rótulo de pendientes, footer y robustez de Analytics (H7–H10).
8. Revisión de accesibilidad móvil (targets y tamaños de texto).

---

## 5. Limitaciones de esta auditoría

- No se ejecutaron altas, bajas, check-in/out, pagos ni cancelaciones reales en producción.
- La fuga de Revenue se confirmó con llamadas GET de solo lectura a través del BFF; no se modificó ningún dato.
- No se completaron logins reales de RECEPTIONIST y HOUSEKEEPER; su comportamiento se validó con el selector “Ver como”, que solo cambia la vista y no los permisos efectivos.
- No se probó el flujo completo de reserva y pago, ni la recuperación de contraseña.
- No se hizo revisión cross-browser (solo Chrome 156 provisto por ego-browser).

---

## 6. Anexo — Rutas relevadas

| Ruta | Rol | Resultado |
|------|-----|-----------|
| `/` | público | Renderiza; error de hidratación #418 en consola |
| `/buscar` | público | 9 hoteles; sin errores de consola ni desborde |
| `/cuenta/entrar` | público | Login OK; error inválido en inglés |
| `/admin` | SUPER_ADMIN | KPIs y módulos; fecha mal capitalizada |
| `/admin/hotels` | SUPER_ADMIN / MANAGER | Lista correcta; manager ve solo su hotel |
| `/admin/hotels/[id]` | SUPER_ADMIN | Detalle correcto; incluye footer público |
| `/admin/hotels/[id]/rooms` | SUPER_ADMIN | Tipos y habitaciones físicas; OK |
| `/admin/hotels/[id]/inventory` | SUPER_ADMIN | Formulario de inventario; OK |
| `/admin/staff` | SUPER_ADMIN / MANAGER | Falla el fetch de hoteles (CORS) |
| `/admin/analytics` | SUPER_ADMIN / MANAGER | Métricas OK (SUPER_ADMIN); manager ve todos los hoteles; se bloqueó al cambiar de hotel |
| `/admin/simulador` | SUPER_ADMIN | Formulario OK; solo SUPER_ADMIN |
| `/admin/recepcion` | SUPER_ADMIN | 39 reservas; acciones solo en `pending` |
| `/admin/housekeeping` | SUPER_ADMIN | 5 tareas pendientes; asignación restringida |
| `/admin/recepcion` | MANAGER | Redirige a `/admin` (esperado por rol) |
| `/admin/housekeeping` | MANAGER | Redirige a `/admin` (esperado por rol) |

---

## 7. Estado de correcciones (implementadas en el repo)

Las correcciones se implementaron en el monorepo y se verificaron con build de producción local y tests. **Producción seguirá mostrando los hallazgos hasta desplegar** el front y `analytics-service`.

| # | Corrección | Estado | Verificación |
|---|------------|--------|--------------|
| H1 | `analytics-service` valida `hotel_id` del JWT contra el hotel solicitado (403 si no coincide; `SUPER_ADMIN` exento). El selector de Revenue se filtra por sesión. | Implementado | Tests de integración: manager propio 200, ajeno 403, sin asignación 403, super admin 200 |
| H2 | `/admin/staff` carga hoteles vía `api-client` (BFF), no directo al servicio. | Implementado | Staff carga la columna HOTEL correctamente |
| H3 | Tarjetas y enlaces de Recepción/Limpieza ocultos para MANAGER; KPIs quedan en solo lectura. | Implementado | Dashboard manager muestra solo Hoteles y Personal |
| H4 | `"Invalid credentials"` se traduce a "Correo o contraseña incorrectos." | Implementado | Probado con contraseña inválida |
| H5 | Hidratación: el bloque flotante de destinos ya no se monta condicionalmente según `useReducedMotion`; el parallax se estabiliza hasta después del montaje. | Implementado | Build de producción + Chrome con `prefers-reduced-motion: reduce`: sin #418 |
| H6 | Títulos y descripciones por ruta de `/admin`. | Implementado | "Panel de control · HotelSync", "Analítica · HotelSync", "Personal · HotelSync" |
| H7 | Fecha sin `capitalize`. | Implementado | "lunes, 26 de octubre de 2026" |
| H8 | Rótulo "Hoy, por confirmar" en el KPI acotado al día. | Implementado | Visible en dashboard |
| H9 | Footer público oculto dentro de `/admin`. | Implementado | `footer` ausente en admin; presente en público |
| H10 | Controles de Analytics deshabilitados y contenedor `aria-busy` durante la carga. | Mitigado | Sin bloqueo reproducible; el origen del freeze no se confirmó |

**Pendiente de despliegue:** `services/analytics-service` (build + deploy) y `apps/front` (Vercel). Sin ese despliegue, la fuga de H1 continúa activa en producción.
