# Arquitectura de HotelSync

Este documento describe la arquitectura actual de HotelSync despues de la migracion hacia un producto tipo Booking/Airbnb. Mantiene los 10 microservicios originales y agrega 2 nuevos: **usuarios** y **archivos**.

## Vision general

```
                              +------------------+
                              |   Navegador      |
                              | (frontend SPA)   |
                              +--------+---------+
                                       |
                                       v
                              +--------+---------+
                              |   API Gateway    |  (puerto 3010)
                              |  Express + JWT   |
                              +--------+---------+
                                       |
        +----------------+-------------+-------------+----------------+
        |                |             |             |                |
        v                v             v             v                v
 +-------------+ +-------------+ +---------+ +-------------+ +-------------+
 |  usuarios   | |  archivos   | |propiedades| |  reservas   | | disponibilidad |
 |   (3011)    | |   (3012)    | | (3005)  | |   (3002)    | |  tarifas (3001)|
 +-------------+ +-------------+ +---------+ +-------------+ +-------------+
        |                |             |             |                |
        v                v             v             v                v
   usuarios_db      uploads/    propiedades_db   reservas_db   disponibilidad_tarifas_db


Otros servicios conectados al gateway:
- recepcion (3003)
- housekeeping (3004)
- channel-manager (3006)
- facturacion (3007)
- fidelizacion (3008)
- analytics (3009)

Infraestructura compartida:
- PostgreSQL (5432)
- RabbitMQ (5672 / 15672)
- Redis (6379)
```

## Nuevos microservicios

### servicio-usuarios (3011)

Responsable de:

- Registro de usuarios con roles: `admin`, `gerente`, `empleado`, `cliente`.
- Login con email/password devolviendo JWT.
- Verificacion del token para rutas protegidas.
- Cambio de rol (solo admin).

Base de datos: `usuarios_db`, tabla `users`.

Librerias: `bcryptjs`, `jsonwebtoken`, `pg`, `express`.

Endpoints expuestos a traves del gateway:

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/usuarios/auth/register` | Registro publico |
| POST | `/usuarios/auth/login` | Login publico |
| GET | `/usuarios/auth/perfil` | Perfil del usuario autenticado |
| GET | `/usuarios/:id` | Obtener usuario por ID |
| PATCH | `/usuarios/:id/rol` | Cambiar rol (admin) |

### servicio-archivos (3012)

Responsable de:

- Subida de imagenes con multer.
- Almacenamiento local en `uploads/`.
- Servir archivos estaticos bajo `/archivos/:nombre`.

Endpoints:

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/archivos/subir` | Subir imagen (campo `archivo`) |
| GET | `/archivos/:nombre` | Informacion del archivo |
| GET | `/archivos/:nombre` | Descargar/ver archivo (estatico) |

En Docker se usa un volumen llamado `hotelsync_uploads` compartido entre el contenedor de archivos y el host.

## Cambios en servicios existentes

### api-gateway (3010)

Se agregaron:

- Dependencia `jsonwebtoken`.
- Variables de entorno `URL_SERVICIO_USUARIOS`, `URL_SERVICIO_ARCHIVOS` y `JWT_SECRET`.
- Middleware opcional `verificarJwtOpcional`:
  - Rutas publicas: `/usuarios/auth/login` y `/usuarios/auth/register` pasan sin token.
  - Rutas protegidas: si el token es valido, se adjunta `req.user` y se reenvian los headers `x-user-id`, `x-user-rol`, `x-user-email` al servicio destino.
  - Si no hay token o es invalido, se permite el paso con `req.user = null` para no romper el flujo de demo.

### servicio-propiedades (3005)

Se agregaron:

- Campo `owner_id` en `hoteles` para asociar un hotel con su gerente (o admin).
- Campo `imagen_url` en `hoteles` y `tipos_habitacion`.
- Endpoint `GET /propiedades/hoteles/mios` para listar hoteles del gerente autenticado (admin ve todos).
- Endpoint `PATCH /propiedades/hoteles/:id` para editar un hotel (solo dueno o admin).
- El servicio lee los headers `x-user-*` enviados por el gateway para autorizar y asignar owner_id.

### servicio-reservas (3002)

Se agregaron:

- Campo `usuario_id` en `reservas` para vincular la reserva con el usuario autenticado.
- Endpoint `GET /reservas/mis-reservas` para listar reservas del usuario autenticado.
- El servicio respeta `usuario_id` si viene en el body, o usa el header `x-user-id` del gateway.

## Frontend

La interfaz se organiza en paginas estaticas dentro de `frontend/`:

- `index.html` — Landing publica con buscador de hoteles.
- `login.html` — Login y registro, guarda JWT en `localStorage`.
- `cliente/` — Dashboard y mis reservas.
- `gerente/` — Dashboard, gestion de hoteles y habitaciones.
- `empleado/` — Check-in, check-out, housekeeping.
- `admin/` — Gestion de usuarios y vista global.

Archivos compartidos:

- `css/main.css` — Estilos con paleta azul claro, responsive.
- `js/utils.js` — Utilidades (token, usuario, fechas, toast, renderizado visual de respuestas).
- `js/api.js` — Cliente HTTP para el API Gateway.
- `js/auth.js` — Logica de sesion.

## Seguridad y autenticacion

- Los passwords se almacenan hasheados con `bcryptjs`.
- Los tokens JWT se firman con un secreto compartido (`JWT_SECRET`) entre `servicio-usuarios` y `api-gateway`.
- La verificacion JWT en el gateway es **opcional**: no bloquea las peticiones sin token, pero las enriquece cuando el token es valido. Esto permite mantener funcionando el `demo.html` original y facilita pruebas graduales.
- Cada servicio puede usar los headers `x-user-id`, `x-user-rol` y `x-user-email` para autorizar acciones.

## Base de datos

Cada microservicio conserva su propia base de datos PostgreSQL:

- `disponibilidad_tarifas_db`
- `reservas_db`
- `propiedades_db`
- `recepcion_db`
- `housekeeping_db`
- `channel_manager_db`
- `facturacion_db`
- `fidelizacion_db`
- `analytics_db`
- `usuarios_db` (nueva)

El script `01-crear-bases-de-datos.sql` crea todas las bases y el usuario `hotelsync_app`.

## Eventos asincronos (RabbitMQ)

El flujo de eventos no cambio. Los eventos clave siguen siendo:

- `booking.created` → recepcion, channel-manager
- `booking.cancelled` → disponibilidad-tarifas
- `checkout.completed` → housekeeping, facturacion
- `booking.completed` → fidelizacion
- `availability.updated` → channel-manager

## Docker Compose

El archivo `docker-compose.yml` incluye:

- Todos los microservicios originales.
- `servicio-usuarios` y `servicio-archivos`.
- Volumen `hotelsync_uploads` para archivos.
- Variables de entorno `JWT_SECRET` compartidas.
- `depends_on` actualizado para reflejar las nuevas dependencias.

## Como extender

1. **Forzar autenticacion en el gateway:** cambiar `verificarJwtOpcional` para retornar 401 cuando no haya token en rutas protegidas.
2. **Validar roles en backend:** en lugar de solo usar headers, los servicios podrian llamar a `servicio-usuarios` para validar permisos.
3. **Subida a S3/Azure Blob:** reemplazar el almacenamiento local de `servicio-archivos` por un adaptador cloud.
4. **Frontend SPA:** migrar los HTML estaticos a React/Vue consumiendo el gateway.

## Notas para el equipo

- Los endpoints de usuarios publicos no requieren token.
- Los endpoints de propiedades y reservas aceptan peticiones sin token (modo demo), pero si se envia un token valido se comportan con autorizacion.
- La carpeta `uploads/` debe tener permisos de escritura para el usuario que ejecuta Node.js.
