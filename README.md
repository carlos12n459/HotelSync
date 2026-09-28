# HotelSync — Plataforma de gestion hotelera multi-propiedad

Proyecto completo de microservicios que cubre toda la cadena operativa de una cadena hotelera: catalogo de propiedades, disponibilidad y tarifas, reservas, channel manager, recepcion (front desk), housekeeping, facturacion, fidelizacion y analytics.

> **Nota academica:** el stack propuesto en el documento del proyecto contemplaba NestJS + PostgreSQL + RabbitMQ + Redis. Esta implementacion mantiene **Express.js** como framework de los microservicios (para preservar la entrega funcional existente) y migra la infraestructura a **PostgreSQL**, **RabbitMQ** y **Redis**.

## Microservicios incluidos

| Servicio | Puerto | Descripcion |
|---|---|---|
| `servicio-disponibilidad-tarifas` | 3001 | Inventario por fecha, precios, bloqueo sincrono anti-sobreventa. Cache de disponibilidad con Redis. |
| `servicio-reservas` | 3002 | Ciclo de vida de reservas, huespedes; publica eventos de reserva. |
| `servicio-recepcion` | 3003 | Check-in, check-out, asignacion de habitaciones, incidencias. |
| `servicio-housekeeping` | 3004 | Estado de limpieza de habitaciones fisicas. |
| `servicio-propiedades` | 3005 | Catalogo maestro de hoteles, tipos de habitacion y habitaciones fisicas. |
| `servicio-channel-manager` | 3006 | Webhooks de OTAs (Booking, Expedia, Airbnb) y sincronizacion de disponibilidad. |
| `servicio-facturacion` | 3007 | Folios, cargos, pagos y facturacion final. |
| `servicio-fidelizacion` | 3008 | Acumulacion y canje de puntos por huesped. |
| `servicio-analytics` | 3009 | KPIs de revenue management: ocupacion, ADR, RevPAR. |
| `api-gateway` | 3010 | Punto de entrada unico que enruta a cada microservicio. |

## Infraestructura

| Servicio | Imagen | Puerto | Uso |
|---|---|---|---|
| PostgreSQL | `postgres:15` | 5432 | Base de datos por microservicio. |
| RabbitMQ | `rabbitmq:3-management` | 5672 / 15672 | Broker de eventos asincronos. |
| Redis | `redis:7` | 6379 | Cache de disponibilidad. |

## Comunicacion entre servicios

- **Sincrona (REST):** usada cuando se necesita una respuesta inmediata (bloqueo de inventario, validacion de reserva, estado de limpieza, consulta de tarifas).
- **Asincrona (RabbitMQ):** desacopla operaciones no criticas en el tiempo:
  - `booking.created` → recepcion, channel-manager
  - `booking.cancelled` → disponibilidad-tarifas
  - `checkout.completed` → housekeeping, facturacion
  - `booking.completed` → fidelizacion
  - `availability.updated` → channel-manager

## Requisitos

- Node.js 18+
- Docker Desktop (recomendado para levantar toda la infraestructura de una vez)
- O bien PostgreSQL 15, RabbitMQ 3 y Redis 7 instalados localmente

## Ejecutar con Docker (recomendado)

```bash
cd HotelSync
docker compose up --build
```

Eso levanta PostgreSQL con las bases de datos y datos semilla, RabbitMQ, Redis y todos los microservicios.

### Probar el flujo completo

Abre `demo.html` en el navegador mientras los servicios corren. Tambien puedes usar los `curl` de abajo.

La consola de administracion de RabbitMQ esta disponible en http://localhost:15672 (usuario `hotelsync`, password `hotelsync_pass`).

## Ejecutar sin Docker

### 1. Crear bases de datos

Asegurate de tener PostgreSQL corriendo y un usuario `hotelsync_app` / `hotelsync_app_pass` con permisos para crear bases. Luego ejecuta los scripts de `infraestructura/postgres-init/` en orden:

```bash
psql -U hotelsync_app -h localhost -d postgres -f infraestructura/postgres-init/01-crear-bases-de-datos.sql
psql -U hotelsync_app -h localhost -d disponibilidad_tarifas_db -f infraestructura/postgres-init/02-esquema-disponibilidad-tarifas.sql
psql -U hotelsync_app -h localhost -d reservas_db -f infraestructura/postgres-init/03-esquema-reservas.sql
psql -U hotelsync_app -h localhost -d propiedades_db -f infraestructura/postgres-init/04-esquema-propiedades.sql
psql -U hotelsync_app -h localhost -d recepcion_db -f infraestructura/postgres-init/05-esquema-recepcion.sql
psql -U hotelsync_app -h localhost -d housekeeping_db -f infraestructura/postgres-init/06-esquema-housekeeping.sql
psql -U hotelsync_app -h localhost -d channel_manager_db -f infraestructura/postgres-init/07-esquema-channel-manager.sql
psql -U hotelsync_app -h localhost -d facturacion_db -f infraestructura/postgres-init/08-esquema-facturacion.sql
psql -U hotelsync_app -h localhost -d fidelizacion_db -f infraestructura/postgres-init/09-esquema-fidelizacion.sql
psql -U hotelsync_app -h localhost -d analytics_db -f infraestructura/postgres-init/10-esquema-analytics.sql
```

> Tambien levanta RabbitMQ y Redis localmente y actualiza las URLs en los `.env`.

### 2. Iniciar cada servicio

En cada carpeta de servicio:

```bash
cp .env.example .env
npm install
npm start
```

El orden recomendado es:
1. `servicio-propiedades` (3005)
2. `servicio-disponibilidad-tarifas` (3001)
3. `servicio-reservas` (3002)
4. `servicio-recepcion` (3003)
5. `servicio-housekeeping` (3004)
6. `servicio-channel-manager` (3006)
7. `servicio-facturacion` (3007)
8. `servicio-fidelizacion` (3008)
9. `servicio-analytics` (3009)
10. `api-gateway` (3010)

## Flujo de prueba con curl (a traves del API Gateway)

```bash
# 1. Catalogo de propiedades
curl http://localhost:3010/propiedades/hoteles

# 2. Disponibilidad
curl "http://localhost:3010/disponibilidad/disponibilidad?tipo_habitacion_id=1&checkin=2026-09-28&checkout=2026-09-30"

# 3. Crear reserva directa
curl -X POST http://localhost:3010/reservas/reservas -H "Content-Type: application/json" -d "{\"nombre_huesped\":\"Maria Perez\",\"email_huesped\":\"maria@example.com\",\"hotel_id\":1,\"tipo_habitacion_id\":1,\"fecha_checkin\":\"2026-09-28\",\"fecha_checkout\":\"2026-09-30\",\"monto_total\":360000}"

# 4. Iniciar turno en recepcion (sincrono)
curl -X POST http://localhost:3010/recepcion/recepcion/iniciar-turno -H "Content-Type: application/json" -d "{\"hotel_id\":1,\"fecha\":\"2026-09-28\"}"

# 5. Check-in
curl -X POST http://localhost:3010/recepcion/recepcion/checkin -H "Content-Type: application/json" -d "{\"reserva_id\":1,\"numero_habitacion\":\"101\"}"

# 6. Checkout
curl -X POST http://localhost:3010/recepcion/recepcion/checkout -H "Content-Type: application/json" -d "{\"reserva_id\":1}"

# 7. Ver tarea de limpieza generada automaticamente
curl http://localhost:3010/housekeeping/housekeeping/habitaciones/101/estado

# 8. Marcar habitacion lista
curl -X PATCH http://localhost:3010/housekeeping/housekeeping/habitaciones/101/estado -H "Content-Type: application/json" -d "{\"estado\":\"lista\"}"

# 9. Ver folio y factura creados automaticamente
curl http://localhost:3010/facturacion/facturacion/folios
curl http://localhost:3010/facturacion/facturacion/facturas

# 10. Ver puntos acumulados en fidelizacion
curl http://localhost:3010/fidelizacion/fidelizacion/cuentas/1

# 11. Ejecutar ETL de analytics
curl -X POST http://localhost:3010/analytics/analytics/etl
```

## Webhook de OTA (Channel Manager)

Simula una reserva entrante desde Booking.com:

```bash
curl -X POST http://localhost:3010/channel/channel/webhook/booking -H "Content-Type: application/json" -d "{\"external_id\":\"BOOK-123\",\"nombre_huesped\":\"Juan Viajero\",\"email_huesped\":\"juan@example.com\",\"hotel_id\":1,\"tipo_habitacion_id\":1,\"fecha_checkin\":\"2026-10-05\",\"fecha_checkout\":\"2026-10-07\",\"monto_total\":400000}"
```

## Estructura del proyecto

```
HotelSync/
├── api-gateway/
├── docker-compose.yml
├── demo.html
├── infraestructura/postgres-init/
├── servicio-analytics/
├── servicio-channel-manager/
├── servicio-disponibilidad-tarifas/
├── servicio-facturacion/
├── servicio-fidelizacion/
├── servicio-housekeeping/
├── servicio-propiedades/
├── servicio-recepcion/
└── servicio-reservas/
```

## CI / GitHub Actions

El archivo `.github/workflows/ci.yml` ejecuta:

1. Checkout del repositorio.
2. Instalacion de dependencias de cada servicio.
3. Verificacion de sintaxis JS con `node --check`.
4. Ejecucion de tests con `npm test`.

## Puntos clave de la arquitectura

- **Base de datos por servicio:** cada microservicio tiene su propia base PostgreSQL.
- **Anti-sobreventa:** el bloqueo de inventario usa `SELECT ... FOR UPDATE` dentro de una transaccion.
- **Eventos asincronos:** RabbitMQ reemplaza el mecanismo anterior de outbox + polling HTTP.
- **Cache:** Redis cachea consultas de disponibilidad e invalida el cache al modificar inventario.
- **Eventos clave:** `booking.created`, `booking.cancelled`, `checkout.completed`, `booking.completed`, `availability.updated`.
- **API Gateway:** punto unico de entrada para el frontend y pruebas.

## Autores

Sebastian Ortiz Lopez, Carlos Rodriguez, Jesus Fuentes, Yesid Anicharico.
