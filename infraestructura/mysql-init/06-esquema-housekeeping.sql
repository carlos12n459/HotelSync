USE housekeeping_db;

-- Estado de limpieza de cada habitación física (sucia, en limpieza, lista,
-- en mantenimiento), tal como lo pide el documento. Se actualiza tanto
-- automáticamente (evento checkout.completed) como manualmente (personal
-- de limpieza marcando su avance vía REST).
CREATE TABLE IF NOT EXISTS estado_habitaciones (
  numero_habitacion VARCHAR(10) PRIMARY KEY,
  hotel_id          INT NOT NULL,
  estado            ENUM('sucia', 'en_limpieza', 'lista', 'mantenimiento') NOT NULL DEFAULT 'lista',
  asignado_a        VARCHAR(100) NULL,
  actualizado_en    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Historial de cambios de estado, útil para auditoría y para la demo.
CREATE TABLE IF NOT EXISTS historial_limpieza (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  numero_habitacion VARCHAR(10) NOT NULL,
  estado_anterior   VARCHAR(20) NULL,
  estado_nuevo      VARCHAR(20) NOT NULL,
  origen            ENUM('evento_async', 'actualizacion_manual') NOT NULL,
  cambiado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_habitacion (numero_habitacion)
);

-- Datos semilla: algunas habitaciones ya registradas como "lista" para que
-- el check-in funcione de inmediato en la demo sin depender de un checkout
-- previo.
INSERT INTO estado_habitaciones (numero_habitacion, hotel_id, estado) VALUES
  ('101', 1, 'lista'),
  ('102', 1, 'lista'),
  ('201', 1, 'lista')
ON DUPLICATE KEY UPDATE estado = VALUES(estado);
