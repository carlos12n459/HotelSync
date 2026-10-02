# HotelSync — Plataforma de gestion hotelera multi-propiedad

Proyecto completo de microservicios que cubre toda la cadena operativa de una cadena hotelera: catalogo de propiedades, disponibilidad y tarifas, reservas, channel manager, recepcion (front desk), housekeeping, facturacion, fidelizacion, analytics, **autenticacion de usuarios** y **gestion de archivos**.

> **Nota academica:** el stack propuesto en el documento del proyecto contemplaba NestJS + PostgreSQL + RabbitMQ + Redis. Esta implementacion mantiene **Express.js** como framework de los microservicios (para preservar la entrega funcional existente) y migra la infraestructura a **PostgreSQL**, **RabbitMQ** y **Redis**.

## Microservicios incluidos

| Servicio | Puerto | Descripcion |
|---|---|---|
| `servicio-disponibilidad-tarifas` | 3001 | Inventario por fecha, precios, bloqueo sincrono anti-sobreventa. Cache de disponibilidad con Redis. |
| `servicio-reservas` | 3002 | Ciclo de vida de reservas, clientes y usuarios autenticados; publica eventos de reserva. |
| `servicio-recepcion` | 3003 | Check-in, check-out, asignacion de habitaciones, incidencias. |
| `servicio-housekeeping` | 3004 | Estado de limpieza de habitaciones fisicas. |
| `servicio-propiedades` | 3005 | Catalogo maestro de hoteles, tipos de habitacion y habitaciones fisicas. Soporta owner_id e imagen_url. |
| `servicio-channel-manager` | 3006 | Webhooks de OTAs (Booking, Expedia, Airbnb) y sincronizacion de disponibilidad. |
| `servicio-facturacion` | 3007 | Folios, cargos, pagos y facturacion final. |
| `servicio-fidelizacion` | 3008 | Acumulacion y canje de puntos por cliente. |
| `servicio-analytics` | 3009 | KPIs de revenue management: ocupacion, ADR, RevPAR. |
| `api-gateway` | 3010 | Punto de entrada unico que enruta a cada microservicio y aplica verificacion JWT opcional. |
| `servicio-usuarios` | 3011 | Registro, login y gestion de usuarios con roles (admin, gerente, empleado, cliente). |
| `servicio-archivos` | 3012 | Subida y servicio de imagenes con multer. |

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

Abre `frontend/login.html` en el navegador mientras los servicios corren. Tambien puedes usar los `curl` de abajo o el archivo `demo.html` para pruebas tecnicas.

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
psql -U hotelsync_app -h localhost -d usuarios_db -f infraestructura/postgres-init/11-esquema-usuarios.sql
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
1. `servicio-usuarios` (3011)
2. `servicio-archivos` (3012)
3. `servicio-propiedades` (3005)
4. `servicio-disponibilidad-tarifas` (3001)
5. `servicio-reservas` (3002)
6. `servicio-recepcion` (3003)
7. `servicio-housekeeping` (3004)
8. `servicio-channel-manager` (3006)
9. `servicio-facturacion` (3007)
10. `servicio-fidelizacion` (3008)
11. `servicio-analytics` (3009)
12. `api-gateway` (3010)

## Frontend

La carpeta `frontend/` contiene la interfaz web organizada por roles:

- `index.html` — Landing / busqueda de hoteles (publica).
- `login.html` — Login y registro.
- `cliente/dashboard.html` — Buscar y reservar hoteles.
- `cliente/reservas.html` — Mis reservas.
- `gerente/dashboard.html` — Mis hoteles.
- `gerente/hoteles.html` — Crear hoteles con subida de imagen.
- `gerente/habitaciones.html` — Gestionar tipos de habitacion y habitaciones fisicas.
- `empleado/dashboard.html` — Check-in, check-out, housekeeping.
- `admin/dashboard.html` — Gestion de usuarios y vista global.

Para usar el frontend abre `frontend/login.html` en el navegador con los servicios corriendo.

## Credenciales de prueba

El script `11-esquema-usuarios.sql` crea un usuario admin por defecto:

- **Email:** `admin@hotelsync.com`
- **Password:** `admin123`

Tambien puedes registrar nuevos usuarios desde `frontend/login.html` con los roles de cliente, gerente o empleado.

## Flujo de prueba con curl (a traves del API Gateway)

### Autenticacion

```bash
# Registro
curl -X POST http://localhost:3010/usuarios/auth/register -H "Content-Type: application/json" -d "{\"nombre\":\"Ana Gomez\",\"email\":\"ana@example.com\",\"password\":\"ana123\",\"rol\":\"cliente\"}"

# Login
curl -X POST http://localhost:3010/usuarios/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@hotelsync.com\",\"password\":\"admin123\"}"
```

### Propiedades

```bash
curl http://localhost:3010/propiedades/hoteles

# Requiere token (reemplazar <TOKEN>)
curl http://localhost:3010/propiedades/hoteles/mios -H "Authorization: Bearer <TOKEN>"
```

### Reservas

```bash
curl -X POST http://localhost:3010/reservas/reservas -H "Content-Type: application/json" -d "{\"nombre_huesped\":\"Maria Perez\",\"email_huesped\":\"maria@example.com\",\"hotel_id\":1,\"tipo_habitacion_id\":1,\"fecha_checkin\":\"2026-09-28\",\"fecha_checkout\":\"2026-09-30\",\"monto_total\":360000}"
```

Ver `demo.html` para el flujo operativo completo (recepcion, housekeeping, facturacion, fidelizacion, analytics).

## Estructura del proyecto

```
HotelSync/
├── api-gateway/
├── docker-compose.yml
├── demo.html
├── frontend/
├── infraestructura/postgres-init/
├── servicio-analytics/
├── servicio-archivos/
├── servicio-channel-manager/
├── servicio-disponibilidad-tarifas/
├── servicio-facturacion/
├── servicio-fidelizacion/
├── servicio-housekeeping/
├── servicio-propiedades/
├── servicio-recepcion/
├── servicio-reservas/
└── servicio-usuarios/
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
- **Autenticacion:** JWT compartido entre `servicio-usuarios` y `api-gateway`. El gateway reenvia los headers `x-user-*` a los microservicios.
- **Eventos clave:** `booking.created`, `booking.cancelled`, `checkout.completed`, `booking.completed`, `availability.updated`.
- **API Gateway:** punto unico de entrada para el frontend y pruebas.

## Documentacion adicional

- `ARCHITECTURE.md` — Diagrama y explicacion detallada de la nueva arquitectura.
- `servicio-usuarios/README.md` — Guia del servicio de autenticacion.
- `servicio-archivos/README.md` — Guia del servicio de archivos.

## Autores

Sebastian Ortiz Lopez, Carlos Rodriguez, Jesus Fuentes, Yesid Anicharico.
