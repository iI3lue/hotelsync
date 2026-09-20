# Guía — Diagrama de Arquitectura General de HotelSync (Isoflow)

Documento de apoyo para armar **por tu cuenta** el diagrama de arquitectura general del sistema HotelSync en **Isoflow** (isoflow.io). El diagrama corresponde a la **sección 3** del documento `HotelSync_Arquitectura.docx`.

> Herramienta: [Isoflow](https://isoflow.io) — plan Hobby gratuito alcanza (1 proyecto, 5 viewers, exportación de imágenes).
> Estilo visual: cajas isométricas con conectores, pensado para diagramas de infraestructura/servicios.

---

## 1. Qué vas a representar

El resumen textual ya está escrito en la sección 3 del documento. El diagrama debe mostrar **el sistema completo de una sola vista**:

- El **cliente** (cuatro roles) que accede al sistema.
- El **Frontend React** desplegado en **Vercel**.
- El **API Gateway** como punto de entrada único (JWT + rate limiting + routing).
- Los **9 microservicios**, cada uno con **su propia base de datos PostgreSQL**.
- **Redis** como caché del Rate & Availability Service.
- **RabbitMQ** para la comunicación interna asíncrona.
- **Sistema de logs** centralizado + **Prometheus/Grafana** (observabilidad).
- El **pipeline CI/CD** con GitHub Actions (build Docker, tests, deploy a Vercel/Render).

---

## 2. Organización del lienzo (por capas)

Para que quede legible, organizá el lienzo en **capas horizontales**, de arriba hacia abajo:

| Capa | Contenido |
|------|-----------|
| **Usuarios / Cliente** | Huésped, Recepcionista, Housekeeping, Revenue Manager |
| **Presentación** | Frontend React (Vercel) |
| **Entrada** | API Gateway |
| **Lógica de negocio** | Los 9 microservicios |
| **Datos** | 9 BDs PostgreSQL + Redis |
| **Infraestructura / Mensajería** | RabbitMQ, Logs, Prometheus/Grafana |
| **Entrega** | GitHub Actions → Vercel / Render |

---

## 3. Inventario de nodos (qué poner)

### 3.1 Cliente (actores)
Usá el icono de persona / laptop de Isoflow, uno por rol:

- **Huésped** — reserva y hace check-in.
- **Recepcionista** — atiende front desk.
- **Housekeeping** — gestiona limpieza.
- **Revenue Manager** — consulta analytics.

### 3.2 Presentación
- **Frontend React (SSR)** — desplegado en **Vercel**.

### 3.3 Entrada
- **API Gateway** — nota sobre el nodo: *JWT, rate limiting, routing*.

### 3.4 Microservicios (9 cajas)
| # | Microservicio | Base de datos |
|---|---------------|---------------|
| 1 | **Property** | Property DB |
| 2 | **Rate & Availability** | Rate & Availability DB |
| 3 | **Channel Manager** | Channel Manager DB |
| 4 | **Booking** | Booking DB |
| 5 | **Front Desk** | Front Desk DB |
| 6 | **Housekeeping** | Housekeeping DB |
| 7 | **Billing** | Billing DB |
| 8 | **Loyalty** | Loyalty DB |
| 9 | **Analytics** | Analytics DB |

Cada microservicio es una **caja** con su **burbuja de base de datos** conectada debajo.

### 3.5 Infraestructura / datos compartidos
- **Redis** — caché, conectado a **Rate & Availability**.
- **RabbitMQ** — cola de mensajes (comunicación asíncrona).
- **Logs centralizado** — recibe logs JSON de todos los microservicios.
- **Prometheus + Grafana** — métricas y visualización.

### 3.6 Entrega / CI-CD
- **GitHub Actions** — pipeline de build + tests + Docker.
- Flechas de deploy hacia **Vercel** (frontend) y **Render** (backend).

---

## 4. Conexiones (qué flecha conecta qué)

| De | A | Tipo | Estilo de línea |
|----|---|------|-----------------|
| Cliente (cada rol) | Frontend React | Usuario → app | Sólida |
| Frontend React | API Gateway | HTTP/HTTPS | Sólida |
| API Gateway | Cada microservicio | REST síncrono | Sólida |
| Cada microservicio | Su PostgreSQL | Datos | Sólida |
| Rate & Availability | Redis | Caché (lectura/escritura) | Punteada |
| Cada microservicio | RabbitMQ | Eventos asíncronos | Punteada |
| Cada microservicio | RabbitMQ | Suscripción a eventos | Punteada |
| Cada microservicio | Logs | Logs JSON | Punteada fina |
| Cada microservicio | Prometheus | Métricas | Punteada fina |
| GitHub Actions | Vercel | Deploy | Sólida (distinta capa) |
| GitHub Actions | Render | Deploy | Sólida (distinta capa) |

**Convención sugerida de líneas:**
- **Sólida** = comunicación síncrona (REST / HTTP / despliegue).
- **Punteada** = comunicación asíncrona (eventos RabbitMQ) o accesoria (caché, logs, métricas).
- Destacá con color distinto las flechas de **deploy** para separar el eje de CI/CD del eje de datos.

---

## 5. Buenas prácticas para el resultado

1. **Agrupá por color** cada capa (clientes → gris, presentación → azul, microservicios → cyan, datos → verde, infra → ámbar, CI/CD → violeta). Creá una **leyenda**.
2. **Etiquetá los conectores** con el protocolo/tipo cuando aporte: `REST`, `HTTPS`, `event`, `cache`, `logs`, `metrics`, `deploy`.
3. **No cruces líneas** de más: llevá los 9 microservicios en dos filas (5 + 4) si es necesario.
4. Ubicá **RabbitMQ y Logs** en el centro inferior para minimizar cruces con las flechas de eventos.
5. Mantené la **perspectiva isométrica** por defecto de Isoflow; solo usá capas separadas en el eje vertical para las "categorías", no para simular altura de red.

---

## 6. Exportación e inserción en el documento

1. En Isoflow: **Export → Image (PNG)**. Elegí buena resolución (al menos 2x para que se lea en Word).
2. Guardá el PNG en el repo, por ejemplo:
   `docs/imagenes/arquitectura_general.png`
3. Abrí `HotelSync_Arquitectura.docx` en Word, andá a la **sección 3**, donde está `[DIAGRAMA: ...]`, y reemplazá ese texto por la **imagen insertada** (Insertar → Imágenes).
4. Agregá un **pie de figura** centrado, por ejemplo:
   > *Figura 1. Diagrama de arquitectura general del sistema HotelSync.*

---

## Checklist de verificación

- [ ] Están los 4 roles de cliente.
- [ ] Está el Frontend (Vercel) y el API Gateway.
- [ ] Están los **9 microservicios**, cada uno con su BD PostgreSQL.
- [ ] Está **Redis** conectado a Rate & Availability.
- [ ] Está **RabbitMQ** con sus flechas de eventos.
- [ ] Está el **sistema de logs** (+ Prometheus/Grafana).
- [ ] Está el pipeline **GitHub Actions → Vercel / Render**.
- [ ] Hay **leyenda** que distingue síncrono vs asíncrono vs deploy.
- [ ] Se exportó el **PNG** y se insertó en la sección 3 con pie de figura.
