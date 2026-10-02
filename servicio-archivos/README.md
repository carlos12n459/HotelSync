# servicio-archivos

Microservicio de gestion de archivos e imagenes de HotelSync.

## Responsabilidad

- Recibir imagenes subidas por los usuarios mediante `multer`.
- Almacenar las imagenes localmente en la carpeta `uploads/`.
- Servir las imagenes como archivos estaticos para que el frontend las pueda mostrar.

## Variables de entorno

```bash
PORT=3012
UPLOAD_DIR=uploads
```

## Instalacion

```bash
cd servicio-archivos
cp .env.example .env
npm install
npm start
```

## Endpoints

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/subir` | Subir una imagen (campo del formulario: `archivo`) |
| GET | `/api/:nombre` | Informacion del archivo almacenado |
| GET | `/archivos/:nombre` | Ver/descargar el archivo (servicio estatico) |

## Formatos soportados

- JPEG
- PNG
- WEBP
- GIF

Tamano maximo: 5 MB.

## Estructura

```
servicio-archivos/
├── src/
│   ├── config/
│   │   └── multer.js          # Configuracion de multer
│   ├── controllers/
│   │   └── archivoController.js # Logica de subida y consulta
│   ├── routes/
│   │   └── archivoRoutes.js     # Definicion de rutas
│   └── server.js                # Punto de entrada
├── uploads/                     # Carpeta donde se guardan los archivos
├── .env.example
├── Dockerfile
└── package.json
```

## Docker

En `docker-compose.yml` se monta un volumen llamado `hotelsync_uploads` en `/app/uploads`. Esto permite que los archivos persistan incluso si el contenedor se reinicia.

## Notas

- La carpeta `uploads/` se crea automaticamente si no existe.
- El nombre del archivo guardado incluye un timestamp y un numero aleatorio para evitar colisiones.
- Para produccion se recomienda migrar el almacenamiento a un servicio cloud (S3, Azure Blob, etc.).
