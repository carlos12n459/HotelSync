# HotelSync — Plataforma de gestión hotelera multi-propiedad

Proyecto completo de microservicios que cubre toda la cadena operativa de una cadena hotelera: catálogo de propiedades, disponibilidad y tarifas, reservas, channel manager, recepción (front desk), housekeeping, facturación, fidelización y analytics.

## Microservicios incluidos

| Servicio | Puerto | Descripción |
|---|---|---|
| `servicio-disponibilidad-tarifas` | 3001 | Inventario por fecha, precios, bloqueo síncrono anti-sobreventa. |
| `servicio-reservas` | 3002 | Ciclo de vida de reservas, huéspedes, outbox de eventos. |
| `servicio-recepcion` | 3003 | Check-in, check-out, asignación de habitaciones, incidencias. |
| `servicio-housekeeping` | 3004 | Estado de limpieza de habitaciones físicas. |
| `servicio-propiedades` | 3005 | Catálogo maestro de hoteles, tipos de habitación y habitaciones físicas. |
| `servicio-channel-manager` | 3006 | Webhooks de OTAs (Booking, Expedia, Airbnb) y sincronización de disponibilidad. |
| `servicio-facturacion` | 3007 | Folios, cargos, pagos y facturación final. |
| `servicio-fidelizacion` | 3008 | Acumulación y canje de puntos por huésped. |
| `servicio-analytics` | 3009 | KPIs de revenue management: ocupación, ADR, RevPAR. |
| `api-gateway` | 3010 | Punto de entrada único que enruta a cada microservicio. |

## Comunicación entre servicios

- **Síncrona (REST):** usada cuando se necesita una respuesta inmediata (bloqueo de inventario, validación de reserva, estado de limpieza, consulta de tarifas).
- **Asíncrona (outbox + polling HTTP):** reemplaza a RabbitMQ para desacoplar operaciones no críticas en el tiempo:
  - `booking.created` → recepción
  - `booking.cancelled` → disponibilidad-tarifas
  - `checkout.completed` → housekeeping y facturación
  - `booking.completed` → fidelización
  - `availability.updated` → channel manager

## Requisitos

- Node.js 18+
- MySQL 8 (local o Docker)
- Docker Desktop (opcional, recomendado para levantar todo de una vez)

## Ejecutar con Docker (recomendado)

```bash
cd HotelSync
docker compose up --build
```

Eso levanta MySQL con las bases de datos y datos semilla, y todos los microservicios.

### Probar el flujo completo

Abre `demo.html` en el navegador mientras los servicios corren. También puedes usar los `curl` de abajo.

## Ejecutar sin Docker

### 1. Crear bases de datos

Desde tu cliente MySQL, ejecuta en orden los scripts de `infraestructura/mysql-init/`:

```sql
SOURCE infraestructura/mysql-init/01-crear-bases-de-datos.sql;
SOURCE infraestructura/mysql-init/02-esquema-disponibilidad-tarifas.sql;
SOURCE infraestructura/mysql-init/03-esquema-reservas.sql;
SOURCE infraestructura/mysql-init/04-esquema-propiedades.sql;
SOURCE infraestructura/mysql-init/05-esquema-recepcion.sql;
SOURCE infraestructura/mysql-init/06-esquema-housekeeping.sql;
SOURCE infraestructura/mysql-init/07-esquema-channel-manager.sql;
SOURCE infraestructura/mysql-init/08-esquema-facturacion.sql;
SOURCE infraestructura/mysql-init/09-esquema-fidelizacion.sql;
SOURCE infraestructura/mysql-init/10-esquema-analytics.sql;
```

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

## Flujo de prueba con curl (a través del API Gateway)

```bash
# 1. Catálogo de propiedades
curl http://localhost:3010/propiedades/hoteles

# 2. Disponibilidad
curl "http://localhost:3010/disponibilidad/disponibilidad?tipo_habitacion_id=1&checkin=2026-09-28&checkout=2026-09-30"

# 3. Crear reserva directa
curl -X POST http://localhost:3010/reservas/reservas -H "Content-Type: application/json" -d "{\"nombre_huesped\":\"Maria Perez\",\"email_huesped\":\"maria@example.com\",\"hotel_id\":1,\"tipo_habitacion_id\":1,\"fecha_checkin\":\"2026-09-28\",\"fecha_checkout\":\"2026-09-30\",\"monto_total\":360000}"

# 4. Iniciar turno en recepción (síncrono)
curl -X POST http://localhost:3010/recepcion/recepcion/iniciar-turno -H "Content-Type: application/json" -d "{\"hotel_id\":1,\"fecha\":\"2026-09-28\"}"

# 5. Check-in
curl -X POST http://localhost:3010/recepcion/recepcion/checkin -H "Content-Type: application/json" -d "{\"reserva_id\":1,\"numero_habitacion\":\"101\"}"

# 6. Checkout
curl -X POST http://localhost:3010/recepcion/recepcion/checkout -H "Content-Type: application/json" -d "{\"reserva_id\":1}"

# 7. Ver tarea de limpieza generada automáticamente
curl http://localhost:3010/housekeeping/housekeeping/habitaciones/101/estado

# 8. Marcar habitación lista
curl -X PATCH http://localhost:3010/housekeeping/housekeeping/habitaciones/101/estado -H "Content-Type: application/json" -d "{\"estado\":\"lista\"}"

# 9. Ver folio y factura creados automáticamente
curl http://localhost:3010/facturacion/facturacion/folios
curl http://localhost:3010/facturacion/facturacion/facturas

# 10. Ver puntos acumulados en fidelización
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
├── infraestructura/mysql-init/
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

## Cómo subir el proyecto a GitHub y compartir el link

1. Crea una cuenta en https://github.com (si no tienes).
2. Crea un nuevo repositorio público (botón verde **New**). Por ejemplo: `HotelSync`.
3. No inicialices el repo con README ni .gitignore (ya los tenemos en el proyecto).
4. GitHub te mostrará algo como:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/HotelSync.git
   git branch -M main
   git push -u origin main
   ```
5. Copia ese link (`https://github.com/TU_USUARIO/HotelSync`) y envíalo al profesor.

### Alternativa: subir a GitLab

Si prefieres GitLab (más permisivo con repos privados), el proceso es igual:

1. Crea el proyecto en https://gitlab.com.
2. Usa el link que te da GitLab, por ejemplo `https://gitlab.com/TU_USUARIO/hotelsync.git`.
3. En PowerShell:
   ```bash
   git remote add origin https://gitlab.com/TU_USUARIO/hotelsync.git
   git branch -M main
   git push -u origin main
   ```

### Si no tienes git configurado localmente

Abre PowerShell en la carpeta `HotelSync` y ejecuta:

```bash
git init
git add .
git commit -m "Entrega completa HotelSync: 10 microservicios + gateway"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/HotelSync.git
git push -u origin main
```

> Si usas GitLab, cambia la URL de GitHub por la de GitLab.

## Cómo desplegar (opcional)

- **Frontend/demo:** puedes subir `demo.html` a Vercel (arrastra la carpeta en https://vercel.com).
- **Backend:** Render (https://render.com) permite desplegar el `docker-compose.yml` o servicios individuales. Ten en cuenta que el plan gratuito duerme servicios inactivos.
- **Base de datos:** Render y Railway ofrecen MySQL/PostgreSQL gratuitos con límites.

Para una entrega académica, normalmente basta con el **link del repositorio de GitHub** y un video corto mostrando `docker compose up` y `demo.html` funcionando.

## Puntos clave de la arquitectura

- **Base de datos por servicio:** cada microservicio tiene su propia base MySQL.
- **Anti-sobreventa:** el bloqueo de inventario usa `SELECT ... FOR UPDATE` dentro de una transacción.
- **Outbox + polling:** reemplaza RabbitMQ manteniendo comunicación asíncrona desacoplada.
- **Eventos clave:** `booking.created`, `booking.cancelled`, `checkout.completed`, `booking.completed`, `availability.updated`.
- **API Gateway:** punto único de entrada para el frontend y pruebas.

## Autores

Sebastián Ortiz López, Carlos Rodríguez, Jesús Fuentes, Yesid Anicharico.
