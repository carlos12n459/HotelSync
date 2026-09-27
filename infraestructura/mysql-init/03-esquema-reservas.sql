USE reservas_db;

-- Huéspedes registrados en el sistema. Permite integrar con fidelización.
CREATE TABLE IF NOT EXISTS huespedes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  telefono      VARCHAR(50) NULL,
  documento     VARCHAR(50) NULL,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guest_id INT NULL,
  nombre_huesped VARCHAR(150) NOT NULL,
  email_huesped VARCHAR(150) NOT NULL,
  hotel_id INT NOT NULL,
  tipo_habitacion_id INT NOT NULL,
  fecha_checkin DATE NOT NULL,
  fecha_checkout DATE NOT NULL,
  canal VARCHAR(50) NOT NULL DEFAULT 'directo',
  monto_total DECIMAL(10,2) NOT NULL,
  estado ENUM('confirmada', 'cancelada') NOT NULL DEFAULT 'confirmada',
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_reservas_huesped
    FOREIGN KEY (guest_id) REFERENCES huespedes(id)
    ON DELETE SET NULL
);

-- Datos semilla de huéspedes para pruebas.
INSERT INTO huespedes (id, nombre, email) VALUES
  (1, 'María Pérez', 'maria@example.com'),
  (2, 'Carlos Rodríguez', 'carlos@example.com')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Tabla de eventos salientes (patrón "outbox"). Reemplaza a RabbitMQ como
-- mecanismo de comunicación ASÍNCRONA entre los dos microservicios: en vez
-- de publicar en un broker externo, el servicio de reservas simplemente
-- deja "anotado" el evento aquí, y el servicio de disponibilidad lo
-- recoge periódicamente (polling) sin que reservas tenga que esperarlo.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  payload JSON NOT NULL,
  procesado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en DATETIME NULL
);
