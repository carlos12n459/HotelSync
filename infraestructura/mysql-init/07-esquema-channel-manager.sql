USE channel_manager_db;

-- Mapeo de tipos de habitación contra IDs externos de cada OTA.
CREATE TABLE IF NOT EXISTS channel_mappings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  room_type_id    INT NOT NULL,
  channel_name    VARCHAR(50) NOT NULL,
  external_room_id VARCHAR(100) NOT NULL,
  hotel_id        INT NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unico_room_channel (room_type_id, channel_name)
);

-- Registro de reservas entrantes por webhooks de OTAs.
CREATE TABLE IF NOT EXISTS reservas_externas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  channel_name    VARCHAR(50) NOT NULL,
  external_id     VARCHAR(100) NOT NULL,
  payload         JSON NOT NULL,
  estado          ENUM('pendiente', 'procesada', 'rechazada') NOT NULL DEFAULT 'pendiente',
  reserva_id      INT NULL,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en    DATETIME NULL,

  UNIQUE KEY unico_channel_external (channel_name, external_id)
);

-- Log de sincronización de disponibilidad hacia canales externos.
CREATE TABLE IF NOT EXISTS sync_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  channel_name    VARCHAR(50) NOT NULL,
  room_type_id    INT NOT NULL,
  fecha           DATE NOT NULL,
  disponible      INT NOT NULL,
  estado          VARCHAR(20) NOT NULL,
  respuesta       TEXT NULL,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Datos semilla de mapeo.
INSERT INTO channel_mappings (room_type_id, channel_name, external_room_id, hotel_id) VALUES
  (1, 'booking', 'BOOK-STD-01', 1),
  (2, 'booking', 'BOOK-Vista-01', 1),
  (3, 'expedia', 'EXP-SUITE-301', 2)
ON DUPLICATE KEY UPDATE external_room_id = VALUES(external_room_id);
