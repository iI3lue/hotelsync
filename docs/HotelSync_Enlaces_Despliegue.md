---
title: "HotelSync — Enlaces de Despliegue y Repositorios"
subtitle: "Entrega — Parte C: Enlaces de despliegue"
date: "18 de octubre de 2026"
lang: es
---

**Proyecto:** HotelSync — Plataforma de gestión hotelera multi-propiedad
**Integrantes:** Juan Diego Diaz · Juan Pablo Hernandez · Maria Angel Correa · Marleidys Bautista
**Fecha:** 18 de octubre de 2026

## 1. Resumen

HotelSync es una plataforma de microservicios. Cada microservicio tiene su propio
repositorio Git, su propia base de datos PostgreSQL (un proyecto independiente en Neon)
y su propio despliegue público, conectado a su base de datos mediante **variables de
entorno configuradas en la plataforma** (nunca en el código).

- **Backends:** 11 microservicios desplegados en Render (`*.onrender.com`, región Oregon).
- **Frontend:** Next.js desplegado en Vercel (sitio público + panel `/admin`).
- **Bases de datos:** 11 proyectos en Neon (PostgreSQL, `aws-us-west-2`), uno por servicio.
- **Mensajería:** RabbitMQ gestionado en CloudAMQP (exchange `hotelsync.events`).
- **Autenticación externa:** Auth0 (con proveedor Google).

Todos los repositorios de microservicios son **públicos**, de modo que el docente puede
revisarlos sin solicitar acceso. El código fuente equivalente también existe en un
monorepo privado de desarrollo; la entrega se realiza sobre los repositorios por servicio.

## 2. Repositorios y enlaces de despliegue

| # | Microservicio | Repositorio (GitHub) | Enlace de despliegue | Base de datos (Neon) |
| --- | --- | --- | --- | --- |
| 1 | Property (3001) | `iI3lue/hotelsync-property-service` | [hotelsync-property-service.onrender.com](https://hotelsync-property-service.onrender.com) | `hotelsync-property-db` |
| 2 | Rate & Availability (3002) | `iI3lue/hotelsync-rate-availability-service` | [hotelsync-rate-availability-service.onrender.com](https://hotelsync-rate-availability-service.onrender.com) | `hotelsync-rate-availability-db` |
| 3 | User (3003) | `iI3lue/hotelsync-user-service` | [hotelsync-user-service.onrender.com](https://hotelsync-user-service.onrender.com) | `hotelsync-user-db` |
| 4 | Booking (3004) | `iI3lue/hotelsync-booking-service` | [hotelsync-booking-service.onrender.com](https://hotelsync-booking-service.onrender.com) | `hotelsync-booking-db` |
| 5 | Front Desk (3005) | `iI3lue/hotelsync-front-desk-service` | [hotelsync-front-desk-service.onrender.com](https://hotelsync-front-desk-service.onrender.com) | `hotelsync-front-desk-db` |
| 6 | Housekeeping (3006) | `iI3lue/hotelsync-housekeeping-service` | [hotelsync-housekeeping-service.onrender.com](https://hotelsync-housekeeping-service.onrender.com) | `hotelsync-housekeeping-db` |
| 7 | Billing (3007) | `iI3lue/hotelsync-billing-service` | [hotelsync-billing-service.onrender.com](https://hotelsync-billing-service.onrender.com) | `hotelsync-billing-db` |
| 8 | Channel Manager (3008) | `iI3lue/hotelsync-channel-manager` | [hotelsync-channel-manager.onrender.com](https://hotelsync-channel-manager.onrender.com) | `hotelsync-channel-manager-db` |
| 9 | Loyalty (3009) | `iI3lue/hotelsync-loyalty-service` | [hotelsync-loyalty-service.onrender.com](https://hotelsync-loyalty-service.onrender.com) | `hotelsync-loyalty-db` |
| 10 | Payment (3010) | `iI3lue/hotelsync-payment-service` | [hotelsync-payment-service.onrender.com](https://hotelsync-payment-service.onrender.com) | `hotelsync-payment-db` |
| 11 | Analytics (3011) | `iI3lue/hotelsync-analytics-service` | [hotelsync-analytics-service.onrender.com](https://hotelsync-analytics-service.onrender.com) | `hotelsync-analytics-db` |
| — | Frontend (público + /admin) | `iI3lue/hotelsync-front` | [hotelsync-front.vercel.app](https://hotelsync-front.vercel.app) | — (sin base de datos) |

## 3. Ficha por microservicio

Cada servicio expone `GET /health`. La base de datos se inyecta con la variable de
entorno `DATABASE_URL` (y `DIRECT_URL` para las migraciones cuando aplica). Las listas de
variables son las **principales**; el detalle completo está en el `.env.example` de cada
repositorio.

### 3.1 Property Service — puerto local 3001

- **Repositorio:** https://github.com/iI3lue/hotelsync-property-service
- **Despliegue:** https://hotelsync-property-service.onrender.com
- **Health:** https://hotelsync-property-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-property-db` (base `property_db`)
- **Variables principales:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_JWT_SECRET`, `NODE_ENV`, `PORT`

### 3.2 Rate & Availability Service — puerto local 3002

- **Repositorio:** https://github.com/iI3lue/hotelsync-rate-availability-service
- **Despliegue:** https://hotelsync-rate-availability-service.onrender.com
- **Health:** https://hotelsync-rate-availability-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-rate-availability-db` (base `rate_availability_db`)
- **Variables principales:** `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL` (opcional), `RATE_CACHE_AVAIL_TTL`, `RATE_CACHE_RATES_TTL`, `AUTH_JWT_SECRET`, `SERVICE_API_KEY`

### 3.3 User Service — puerto local 3003

- **Repositorio:** https://github.com/iI3lue/hotelsync-user-service
- **Despliegue:** https://hotelsync-user-service.onrender.com
- **Health:** https://hotelsync-user-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-user-db` (base `user_db`)
- **Variables principales:** `DATABASE_URL`, `AUTH_JWT_SECRET`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `PASSWORD_RESET_BASE_URL`, `MAILER_PROVIDER`, `PASSWORD_RESET_DEMO_CODE`, `BOOKING_SERVICE_URL`, `BOOKING_SERVICE_KEY`, `LOYALTY_SERVICE_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`

### 3.4 Booking Service — puerto local 3004

- **Repositorio:** https://github.com/iI3lue/hotelsync-booking-service
- **Despliegue:** https://hotelsync-booking-service.onrender.com
- **Health:** https://hotelsync-booking-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-booking-db` (base `booking_db`)
- **Variables principales:** `DATABASE_URL`, `AUTH_JWT_SECRET`, `RATE_SERVICE_URL`, `PAYMENT_SERVICE_KEY`, `USER_SERVICE_KEY`, `LOYALTY_SERVICE_KEY`, `CHANNEL_MANAGER_SERVICE_KEY`, `CHANNEL_MANAGER_MANAGE_TOKEN_SECRET`, `SERVICE_API_KEY`, `RABBITMQ_URL`

### 3.5 Front Desk Service — puerto local 3005

- **Repositorio:** https://github.com/iI3lue/hotelsync-front-desk-service
- **Despliegue:** https://hotelsync-front-desk-service.onrender.com
- **Health:** https://hotelsync-front-desk-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-front-desk-db` (base `front_desk_db`)
- **Variables principales:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_JWT_SECRET`, `BOOKING_SERVICE_URL`, `BOOKING_SERVICE_KEY`, `RABBITMQ_URL`

### 3.6 Housekeeping Service — puerto local 3006

- **Repositorio:** https://github.com/iI3lue/hotelsync-housekeeping-service
- **Despliegue:** https://hotelsync-housekeeping-service.onrender.com
- **Health:** https://hotelsync-housekeeping-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-housekeeping-db` (base `housekeeping_db`)
- **Variables principales:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_JWT_SECRET`, `BOOKING_SERVICE_URL`, `BOOKING_SERVICE_KEY`, `USER_SERVICE_URL`, `RABBITMQ_URL`
- **Seed opcional:** `SEED_HOTEL_ID`, `SEED_ROOM_NUMBERS`

### 3.7 Billing Service — puerto local 3007

- **Repositorio:** https://github.com/iI3lue/hotelsync-billing-service
- **Despliegue:** https://hotelsync-billing-service.onrender.com
- **Health:** https://hotelsync-billing-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-billing-db` (base `billing_db`)
- **Variables principales:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_JWT_SECRET`, `BOOKING_SERVICE_URL`, `BOOKING_SERVICE_KEY`, `PROPERTY_SERVICE_URL`, `DEFAULT_CURRENCY`, `RABBITMQ_URL`

### 3.8 Channel Manager Service — puerto local 3008

- **Repositorio:** https://github.com/iI3lue/hotelsync-channel-manager
- **Despliegue:** https://hotelsync-channel-manager.onrender.com
- **Health:** https://hotelsync-channel-manager.onrender.com/health
- **Base de datos:** Neon `hotelsync-channel-manager-db` (base `channel_manager_db`)
- **Variables principales:** `DATABASE_URL`, `BOOKING_SERVICE_URL`, `RATE_SERVICE_URL`, `CHANNEL_MANAGER_SERVICE_KEY`, `CHANNEL_MANAGER_SIMULATOR_KEY`, `RABBITMQ_URL`

### 3.9 Loyalty Service — puerto local 3009

- **Repositorio:** https://github.com/iI3lue/hotelsync-loyalty-service
- **Despliegue:** https://hotelsync-loyalty-service.onrender.com
- **Health:** https://hotelsync-loyalty-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-loyalty-db` (base `loyalty_db`)
- **Variables principales:** `DATABASE_URL`, `AUTH_JWT_SECRET`, `BOOKING_SERVICE_URL`, `USER_SERVICE_URL`, `LOYALTY_SERVICE_KEY`, `RABBITMQ_URL`

### 3.10 Payment Service — puerto local 3010

- **Repositorio:** https://github.com/iI3lue/hotelsync-payment-service
- **Despliegue:** https://hotelsync-payment-service.onrender.com
- **Health:** https://hotelsync-payment-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-payment-db` (base `payment_db`)
- **Variables principales:** `DATABASE_URL`, `AUTH_JWT_SECRET`, `BOOKING_SERVICE_URL`, `BOOKING_SERVICE_KEY`, `PAYMENT_CURRENCY`, `RABBITMQ_URL`

### 3.11 Analytics Service — puerto local 3011

- **Repositorio:** https://github.com/iI3lue/hotelsync-analytics-service
- **Despliegue:** https://hotelsync-analytics-service.onrender.com
- **Health:** https://hotelsync-analytics-service.onrender.com/health
- **Base de datos:** Neon `hotelsync-analytics-db` (base `analytics_db`)
- **Réplicas de solo lectura:** `DATABASE_URL_BOOKING`, `DATABASE_URL_PROPERTY`
- **Variables principales:** `DATABASE_URL`, `DATABASE_URL_BOOKING`, `DATABASE_URL_PROPERTY`, `AUTH_JWT_SECRET`, `RABBITMQ_URL`, `ETL_LOOKBACK_DAYS`

### 3.12 Frontend — Next.js en Vercel

- **Repositorio:** https://github.com/iI3lue/hotelsync-front
- **Despliegue:** https://hotelsync-front.vercel.app
- **Variables principales:** `NEXT_PUBLIC_PROPERTY_API_URL`, `NEXT_PUBLIC_RATE_API_URL`, `NEXT_PUBLIC_USER_API_URL`, `NEXT_PUBLIC_BOOKING_API_URL`, `NEXT_PUBLIC_FRONT_DESK_API_URL`, `NEXT_PUBLIC_HOUSEKEEPING_API_URL`, `NEXT_PUBLIC_BILLING_API_URL`, `NEXT_PUBLIC_LOYALTY_API_URL`, `NEXT_PUBLIC_PAYMENT_API_URL`, `NEXT_PUBLIC_ANALYTICS_API_URL`, `CHANNEL_MANAGER_API_URL`, `CHANNEL_MANAGER_SIMULATOR_KEY`, `APP_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
- **Nota:** las variables `NEXT_PUBLIC_*` son de tiempo de compilación; un cambio exige nuevo despliegue.

## 4. Infraestructura compartida y servicios externos

| Componente | Proveedor | Detalle |
| --- | --- | --- |
| Backends (11) | Render | Plan free, región Oregon, autodeploy desde `main` |
| Frontend | Vercel | Next.js, sitio público + panel `/admin` |
| Bases de datos (11) | Neon | PostgreSQL, `aws-us-west-2`, un proyecto por servicio |
| Mensajería | CloudAMQP | RabbitMQ gestionado; exchange `hotelsync.events` |
| Autenticación externa | Auth0 | Login con Google; JWT HS256 compartido entre servicios |
| Correo (reset de contraseña) | Proveedor SMTP configurable | `MAILER_PROVIDER`; en demo puede usar modo log |
| Caché | Redis | `REDIS_URL` opcional; si falta, el servicio opera contra la base de datos |

**Integración de pagos:** el cobro es **simulado** dentro de `payment-service` (no se integra
una pasarela real). El front ofrece tarjetas de prueba para el flujo de checkout. No se
almacenan números de tarjeta ni CVV.

## 5. Cumplimiento de la guía

**Parte A — Microservicios implementados.** Los microservicios están implementados y se
comunican entre sí por REST y mensajería (RabbitMQ), de modo que los procesos funcionan
de extremo a extremo (reserva → pago → check-in → housekeeping → facturación → analítica).

**Parte B — Repositorios Git con sus bases de datos.**

- Un repositorio Git por microservicio, público.
- Esquema de base de datos mediante migraciones de Prisma (`prisma/migrations`).
- Datos de ejemplo: scripts de *seed* idempotentes donde aplica.
- Copia de respaldo: procedimiento `pg_dump` / `pg_restore` documentado en cada README.
- `.env.example` y `.gitignore` en cada repositorio (sin credenciales versionadas).
- Historial de commits con mensajes descriptivos.

**Parte C — Enlaces de despliegue.**

- Enlace público, activo y accesible por cada microservicio (sección 2 y 6).
- Cada servicio conectado a su base de datos con las credenciales inyectadas como
  variables de entorno en la plataforma (Render / Vercel), no en el código.
- Integraciones externas: RabbitMQ (CloudAMQP), Auth0 (OAuth con Google), Neon y Vercel.

**Parte D — Criterios de validación.** Ver sección 6 (cómo probar).

## 6. Verificación

Verificación en vivo el **18 de octubre de 2026, 14:45–14:49 (UTC−05:00)**. Todos los
servicios respondieron `HTTP 200`.

| Servicio | Health | Resultado |
| --- | --- | --- |
| Property | [/health](https://hotelsync-property-service.onrender.com/health) | 200 |
| Rate & Availability | [/health](https://hotelsync-rate-availability-service.onrender.com/health) | 200 |
| User | [/health](https://hotelsync-user-service.onrender.com/health) | 200 |
| Booking | [/health](https://hotelsync-booking-service.onrender.com/health) | 200 |
| Front Desk | [/health](https://hotelsync-front-desk-service.onrender.com/health) | 200 |
| Housekeeping | [/health](https://hotelsync-housekeeping-service.onrender.com/health) | 200 |
| Billing | [/health](https://hotelsync-billing-service.onrender.com/health) | 200 |
| Channel Manager | [/health](https://hotelsync-channel-manager.onrender.com/health) | 200 |
| Loyalty | [/health](https://hotelsync-loyalty-service.onrender.com/health) | 200 |
| Payment | [/health](https://hotelsync-payment-service.onrender.com/health) | 200 |
| Analytics | [/health](https://hotelsync-analytics-service.onrender.com/health) | 200 |
| Frontend | [hotelsync-front.vercel.app](https://hotelsync-front.vercel.app) | 200 |

> **Nota sobre el plan free de Render:** tras 15 minutos de inactividad el servicio se
> suspende; el primer request puede tardar entre 30 y 90 segundos (arranque en frío) y
> luego responde con normalidad. Al momento de la revisión todos los enlaces estaban
> activos.

### Cómo probar

```bash
# Estado de cualquier servicio
curl https://hotelsync-payment-service.onrender.com/health

# Requieren JWT (rol MANAGER / SUPER_ADMIN); el front inyecta el Bearer:
#   GET /api/property/*  /api/booking/*  /api/analytics/*  ...
```

## 7. Anexo — puertos locales

| Puerto | Servicio | Puerto | Servicio |
| --- | --- | --- | --- |
| 3001 | property | 3007 | billing |
| 3002 | rate-availability | 3008 | channel-manager |
| 3003 | user | 3009 | loyalty |
| 3004 | booking | 3010 | payment |
| 3005 | front-desk | 3011 | analytics |
| 3006 | housekeeping | 3000 | frontend |

**Infraestructura local (Docker Compose):** PostgreSQL 16 en los puertos 5432–5442 (uno
por servicio), RabbitMQ 5672 / consola 15672, Redis 6379, Adminer 8080.
