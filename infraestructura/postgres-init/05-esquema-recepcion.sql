\c recepcion_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Copia local (de solo uso operativo) de las reservas relevantes para el
-- front desk. Se llena tanto por el evento asincrono booking.created como
-- por la consulta sincrona al iniciar turno. La fuente de verdad de la
-- reserva sigue siendo servicio-reservas.
CREATE TABLE IF NOT EXISTS llegadas (
  reserva_id       INTEGER PRIMARY KEY,
  nombre_huesped   VARCHAR(150) NOT NULL,
  hotel_id         INTEGER NOT NULL,
  tipo_habitacion_id INTEGER NOT NULL,
  fecha_checkin    DATE NOT NULL,
  fecha_checkout   DATE NOT NULL,
  canal            VARCHAR(50) NOT NULL DEFAULT 'directo',
  monto_total      DECIMAL(10,2) NOT NULL,
  estado_reserva   VARCHAR(20) NOT NULL DEFAULT 'confirmada',
  origen           VARCHAR(20) NOT NULL CHECK (origen IN ('evento_async', 'consulta_sync')),
  recibido_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hotel_checkin ON llegadas (hotel_id, fecha_checkin);

-- Asignacion de la habitacion fisica durante el check-in/check-out
-- (distinta del tipo de habitacion reservado, tal como pide el documento).
CREATE TABLE IF NOT EXISTS asignaciones_habitacion (
  id                SERIAL PRIMARY KEY,
  reserva_id        INTEGER NOT NULL,
  numero_habitacion VARCHAR(10) NOT NULL,
  checkin_en        TIMESTAMP NULL,
  checkout_en       TIMESTAMP NULL,
  creado_en         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reserva ON asignaciones_habitacion (reserva_id);

-- Registro de solicitudes/incidencias del huesped durante la estancia.
CREATE TABLE IF NOT EXISTS incidencias_huesped (
  id            SERIAL PRIMARY KEY,
  reserva_id    INTEGER NOT NULL,
  descripcion   VARCHAR(500) NOT NULL,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reserva_incidencias ON incidencias_huesped (reserva_id);

-- Tabla de eventos salientes (patron "outbox", igual que en servicio-reservas):
-- aqui recepcion anota checkout.completed y booking.completed como respaldo
-- transaccional, aunque el broker principal ahora es RabbitMQ.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id            SERIAL PRIMARY KEY,
  tipo          VARCHAR(50) NOT NULL,
  payload       JSONB NOT NULL,
  procesado     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en  TIMESTAMP NULL
);

-- Confirmaciones por consumidor: permite que varios servicios (facturacion,
-- housekeeping, etc.) procesen el mismo evento sin que uno lo marque como
-- "procesado" antes de que los demas lo vean.
CREATE TABLE IF NOT EXISTS confirmaciones_eventos (
  id            SERIAL PRIMARY KEY,
  evento_id     INTEGER NOT NULL,
  consumidor    VARCHAR(50) NOT NULL,
  confirmado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unico_evento_consumidor UNIQUE (evento_id, consumidor),
  CONSTRAINT fk_confirmaciones_evento
    FOREIGN KEY (evento_id) REFERENCES eventos_salientes(id)
    ON DELETE CASCADE
);
