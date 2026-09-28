\c channel_manager_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Mapeo de tipos de habitacion contra IDs externos de cada OTA.
CREATE TABLE IF NOT EXISTS channel_mappings (
  id              SERIAL PRIMARY KEY,
  room_type_id    INTEGER NOT NULL,
  channel_name    VARCHAR(50) NOT NULL,
  external_room_id VARCHAR(100) NOT NULL,
  hotel_id        INTEGER NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unico_room_channel UNIQUE (room_type_id, channel_name)
);

-- Registro de reservas entrantes por webhooks de OTAs.
CREATE TABLE IF NOT EXISTS reservas_externas (
  id              SERIAL PRIMARY KEY,
  channel_name    VARCHAR(50) NOT NULL,
  external_id     VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesada', 'rechazada')),
  reserva_id      INTEGER NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en    TIMESTAMP NULL,

  CONSTRAINT unico_channel_external UNIQUE (channel_name, external_id)
);

-- Log de sincronizacion de disponibilidad hacia canales externos.
CREATE TABLE IF NOT EXISTS sync_log (
  id              SERIAL PRIMARY KEY,
  channel_name    VARCHAR(50) NOT NULL,
  room_type_id    INTEGER NOT NULL,
  fecha           DATE NOT NULL,
  disponible      INTEGER NOT NULL,
  estado          VARCHAR(20) NOT NULL,
  respuesta       TEXT NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Datos semilla de mapeo.
INSERT INTO channel_mappings (room_type_id, channel_name, external_room_id, hotel_id) VALUES
  (1, 'booking', 'BOOK-STD-01', 1),
  (2, 'booking', 'BOOK-Vista-01', 1),
  (3, 'expedia', 'EXP-SUITE-301', 2)
ON CONFLICT (room_type_id, channel_name) DO UPDATE SET external_room_id = EXCLUDED.external_room_id;

SELECT setval(pg_get_serial_sequence('channel_mappings', 'id'), COALESCE((SELECT MAX(id) FROM channel_mappings), 1));
