USE propiedades_db;

-- Catálogo maestro de hoteles de la cadena.
CREATE TABLE IF NOT EXISTS hoteles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  ciudad      VARCHAR(100) NOT NULL,
  pais        VARCHAR(100) NOT NULL,
  timezone    VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  direccion   VARCHAR(255) NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tipos de habitación por hotel (catálogo maestro).
CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id      INT NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  capacidad     INT NOT NULL DEFAULT 2,
  tarifa_base   DECIMAL(10,2) NOT NULL,
  amenities     JSON NULL,
  politica_cancelacion TEXT NULL,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tipos_habitacion_hotel
    FOREIGN KEY (hotel_id) REFERENCES hoteles(id)
    ON DELETE CASCADE,

  UNIQUE KEY unico_hotel_tipo_nombre (hotel_id, nombre)
);

-- Habitaciones físicas de cada hotel.
CREATE TABLE IF NOT EXISTS habitaciones (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id          INT NOT NULL,
  numero            VARCHAR(10) NOT NULL,
  tipo_habitacion_id INT NOT NULL,
  piso              VARCHAR(10) NULL,
  activa            BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_habitaciones_hotel
    FOREIGN KEY (hotel_id) REFERENCES hoteles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_habitaciones_tipo
    FOREIGN KEY (tipo_habitacion_id) REFERENCES tipos_habitacion(id)
    ON DELETE CASCADE,

  UNIQUE KEY unico_hotel_numero (hotel_id, numero)
);

-- Datos semilla.
INSERT INTO hoteles (id, nombre, ciudad, pais, timezone) VALUES
  (1, 'HotelSync Centro', 'Bogotá', 'Colombia', 'America/Bogota'),
  (2, 'HotelSync Playa', 'Cartagena', 'Colombia', 'America/Bogota')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO tipos_habitacion (id, hotel_id, nombre, capacidad, tarifa_base, amenities) VALUES
  (1, 1, 'Habitación Estándar', 2, 180000.00, '["wifi", "tv", "desayuno"]'),
  (2, 1, 'Habitación Doble Vista al Mar', 2, 260000.00, '["wifi", "tv", "balcón"]'),
  (3, 2, 'Suite Junior', 3, 350000.00, '["wifi", "tv", "minibar", "jacuzzi"]')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO habitaciones (hotel_id, numero, tipo_habitacion_id, piso) VALUES
  (1, '101', 1, '1'),
  (1, '102', 1, '1'),
  (1, '201', 2, '2'),
  (2, '301', 3, '3')
ON DUPLICATE KEY UPDATE tipo_habitacion_id = VALUES(tipo_habitacion_id);
