\c housekeeping_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Estado de limpieza de cada habitacion fisica (sucia, en limpieza, lista,
-- en mantenimiento), tal como lo pide el documento. Se actualiza tanto
-- automaticamente (evento checkout.completed) como manualmente (personal
-- de limpieza marcando su avance via REST).
CREATE TABLE IF NOT EXISTS estado_habitaciones (
  numero_habitacion VARCHAR(10) PRIMARY KEY,
  hotel_id          INTEGER NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'lista' CHECK (estado IN ('sucia', 'en_limpieza', 'lista', 'mantenimiento')),
  asignado_a        VARCHAR(100) NULL,
  actualizado_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Historial de cambios de estado, util para auditoria y para la demo.
CREATE TABLE IF NOT EXISTS historial_limpieza (
  id                SERIAL PRIMARY KEY,
  numero_habitacion VARCHAR(10) NOT NULL,
  estado_anterior   VARCHAR(20) NULL,
  estado_nuevo      VARCHAR(20) NOT NULL,
  origen            VARCHAR(20) NOT NULL CHECK (origen IN ('evento_async', 'actualizacion_manual')),
  cambiado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_habitacion ON historial_limpieza (numero_habitacion);

-- Datos semilla: algunas habitaciones ya registradas como "lista" para que
-- el check-in funcione de inmediato en la demo sin depender de un checkout
-- previo.
INSERT INTO estado_habitaciones (numero_habitacion, hotel_id, estado) VALUES
  ('101', 1, 'lista'),
  ('102', 1, 'lista'),
  ('201', 1, 'lista')
ON CONFLICT (numero_habitacion) DO UPDATE SET estado = EXCLUDED.estado;
