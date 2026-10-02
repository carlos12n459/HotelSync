\c propiedades_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Catalogo maestro de hoteles de la cadena.
-- owner_id: referencia al usuario gerente/admin que administra el hotel.
-- imagen_url: URL de la imagen principal del hotel.
CREATE TABLE IF NOT EXISTS hoteles (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NULL,
  nombre      VARCHAR(150) NOT NULL,
  ciudad      VARCHAR(100) NOT NULL,
  pais        VARCHAR(100) NOT NULL,
  timezone    VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  direccion   VARCHAR(255) NULL,
  imagen_url  VARCHAR(500) NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tipos de habitacion por hotel (catalogo maestro).
-- imagen_url: URL de la imagen representativa del tipo de habitacion.
CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id            SERIAL PRIMARY KEY,
  hotel_id      INTEGER NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  capacidad     INTEGER NOT NULL DEFAULT 2,
  tarifa_base   DECIMAL(10,2) NOT NULL,
  amenities     JSONB NULL,
  politica_cancelacion TEXT NULL,
  imagen_url    VARCHAR(500) NULL,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tipos_habitacion_hotel
    FOREIGN KEY (hotel_id) REFERENCES hoteles(id)
    ON DELETE CASCADE,

  CONSTRAINT unico_hotel_tipo_nombre UNIQUE (hotel_id, nombre)
);

-- Habitaciones fisicas de cada hotel.
CREATE TABLE IF NOT EXISTS habitaciones (
  id                SERIAL PRIMARY KEY,
  hotel_id          INTEGER NOT NULL,
  numero            VARCHAR(10) NOT NULL,
  tipo_habitacion_id INTEGER NOT NULL,
  piso              VARCHAR(10) NULL,
  activa            BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_habitaciones_hotel
    FOREIGN KEY (hotel_id) REFERENCES hoteles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_habitaciones_tipo
    FOREIGN KEY (tipo_habitacion_id) REFERENCES tipos_habitacion(id)
    ON DELETE CASCADE,

  CONSTRAINT unico_hotel_numero UNIQUE (hotel_id, numero)
);

-- Datos semilla: se asignan al admin/usuario demo con owner_id = 1.
INSERT INTO hoteles (id, owner_id, nombre, ciudad, pais, timezone, imagen_url) VALUES
  (1, 1, 'HotelSync Centro', 'Bogota', 'Colombia', 'America/Bogota', '/archivos/hotel-centro.jpg'),
  (2, 1, 'HotelSync Playa', 'Cartagena', 'Colombia', 'America/Bogota', '/archivos/hotel-playa.jpg')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  owner_id = EXCLUDED.owner_id,
  imagen_url = EXCLUDED.imagen_url;

SELECT setval(pg_get_serial_sequence('hoteles', 'id'), COALESCE((SELECT MAX(id) FROM hoteles), 1));

INSERT INTO tipos_habitacion (id, hotel_id, nombre, capacidad, tarifa_base, amenities, imagen_url) VALUES
  (1, 1, 'Habitacion Estandar', 2, 180000.00, '["wifi", "tv", "desayuno"]'::jsonb, '/archivos/habitacion-estandar.jpg'),
  (2, 1, 'Habitacion Doble Vista al Mar', 2, 260000.00, '["wifi", "tv", "balcon"]'::jsonb, '/archivos/habitacion-doble.jpg'),
  (3, 2, 'Suite Junior', 3, 350000.00, '["wifi", "tv", "minibar", "jacuzzi"]'::jsonb, '/archivos/suite-junior.jpg')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  imagen_url = EXCLUDED.imagen_url;

SELECT setval(pg_get_serial_sequence('tipos_habitacion', 'id'), COALESCE((SELECT MAX(id) FROM tipos_habitacion), 1));

INSERT INTO habitaciones (hotel_id, numero, tipo_habitacion_id, piso) VALUES
  (1, '101', 1, '1'),
  (1, '102', 1, '1'),
  (1, '201', 2, '2'),
  (2, '301', 3, '3')
ON CONFLICT (hotel_id, numero) DO UPDATE SET tipo_habitacion_id = EXCLUDED.tipo_habitacion_id;

SELECT setval(pg_get_serial_sequence('habitaciones', 'id'), COALESCE((SELECT MAX(id) FROM habitaciones), 1));
