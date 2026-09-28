-- Cada microservicio tiene su propia base de datos, siguiendo el principio
-- de "base de datos por servicio" descrito en el documento del proyecto.
-- PostgreSQL ejecuta este script conectado a la base por defecto (postgres).

-- Crear usuario de aplicacion si no existe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hotelsync_app') THEN
    CREATE USER hotelsync_app WITH PASSWORD 'hotelsync_app_pass';
  END IF;
END
$$;

ALTER USER hotelsync_app WITH PASSWORD 'hotelsync_app_pass';

-- Crear bases de datos si no existen, asignando al usuario de aplicacion.
SELECT 'CREATE DATABASE disponibilidad_tarifas_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'disponibilidad_tarifas_db')\gexec

SELECT 'CREATE DATABASE reservas_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reservas_db')\gexec

SELECT 'CREATE DATABASE propiedades_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'propiedades_db')\gexec

SELECT 'CREATE DATABASE channel_manager_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'channel_manager_db')\gexec

SELECT 'CREATE DATABASE facturacion_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'facturacion_db')\gexec

SELECT 'CREATE DATABASE fidelizacion_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fidelizacion_db')\gexec

SELECT 'CREATE DATABASE analytics_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'analytics_db')\gexec

SELECT 'CREATE DATABASE recepcion_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'recepcion_db')\gexec

SELECT 'CREATE DATABASE housekeeping_db OWNER hotelsync_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'housekeeping_db')\gexec

-- Asegurar permisos de conexion y creacion (el OWNER ya tiene privilegios sobre cada base).
ALTER USER hotelsync_app CREATEDB;
