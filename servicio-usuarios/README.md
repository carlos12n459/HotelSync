# servicio-usuarios

Microservicio de autenticacion y gestion de usuarios de HotelSync.

## Responsabilidad

- Registrar usuarios con roles: `admin`, `anfitrion`, `empleado`, `huesped`.
- Autenticar usuarios con email/password y devolver JWT.
- Proteger rutas con middleware JWT.
- Permitir a los administradores cambiar el rol de cualquier usuario.

## Variables de entorno

```bash
PORT=3011
DB_HOST=localhost
DB_PORT=5432
DB_USER=hotelsync_app
DB_PASSWORD=hotelsync_app_pass
DB_NAME=usuarios_db
JWT_SECRET=hotelsync_jwt_secret_para_dev
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=10
```

## Instalacion

```bash
cd servicio-usuarios
cp .env.example .env
npm install
npm start
```

## Endpoints

| Metodo | Ruta | Descripcion | Protegido |
|---|---|---|---|
| POST | `/api/auth/register` | Registro de usuario | No |
| POST | `/api/auth/login` | Login de usuario | No |
| GET | `/api/auth/perfil` | Perfil del usuario autenticado | Si |
| GET | `/api/usuarios/:id` | Obtener usuario por ID | Si |
| PATCH | `/api/usuarios/:id/rol` | Cambiar rol de usuario | Si (admin) |

## Estructura

```
servicio-usuarios/
├── src/
│   ├── config/
│   │   └── baseDeDatos.js     # Pool de conexiones a PostgreSQL
│   ├── controllers/
│   │   └── usuarioController.js # Logica de registro, login, perfiles y roles
│   ├── middleware/
│   │   └── auth.js              # Generacion y verificacion JWT
│   ├── routes/
│   │   └── usuarioRoutes.js     # Definicion de rutas
│   └── server.js                # Punto de entrada
├── .env.example
├── Dockerfile
└── package.json
```

## Usuario admin por defecto

El script `infraestructura/postgres-init/11-esquema-usuarios.sql` crea un admin inicial:

- Email: `admin@hotelsync.com`
- Password: `admin123`

> Cambiar en produccion.

## Notas

- El password nunca se almacena en texto plano; siempre se guarda con `bcryptjs`.
- El secreto JWT debe ser el mismo que usa `api-gateway` para verificar los tokens.
