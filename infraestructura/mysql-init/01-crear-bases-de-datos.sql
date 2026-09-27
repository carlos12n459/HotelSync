-- Cada microservicio tiene su propia base de datos, siguiendo el principio
-- de "base de datos por servicio" descrito en el documento del proyecto.

CREATE DATABASE IF NOT EXISTS disponibilidad_tarifas_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS reservas_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Bases de datos de los servicios adicionales del documento.
CREATE DATABASE IF NOT EXISTS propiedades_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS channel_manager_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS facturacion_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS fidelizacion_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS analytics_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS recepcion_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS housekeeping_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Usuario de aplicación con permisos sobre todas las bases (para simplificar el
-- entorno local; en un entorno real cada servicio tendría su propio usuario).
CREATE USER IF NOT EXISTS 'hotelsync_app'@'%' IDENTIFIED BY 'hotelsync_app_pass';
GRANT ALL PRIVILEGES ON disponibilidad_tarifas_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON reservas_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON propiedades_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON channel_manager_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON facturacion_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON fidelizacion_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON analytics_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON recepcion_db.* TO 'hotelsync_app'@'%';
GRANT ALL PRIVILEGES ON housekeeping_db.* TO 'hotelsync_app'@'%';
FLUSH PRIVILEGES;
