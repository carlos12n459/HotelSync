USE recepcion_db;

-- Copia local (de solo uso operativo) de las reservas relevantes para el
-- front desk. Se llena tanto por el evento asíncrono booking.created como
-- por la consulta síncrona al iniciar turno. La fuente de verdad de la
-- reserva sigue siendo servicio-reservas.
CREATE TABLE IF NOT EXISTS llegadas (
  reserva_id       INT PRIMARY KEY,
  nombre_huesped   VARCHAR(150) NOT NULL,
  hotel_id         INT NOT NULL,
  tipo_habitacion_id INT NOT NULL,
  fecha_checkin    DATE NOT NULL,
  fecha_checkout   DATE NOT NULL,
  canal            VARCHAR(50) NOT NULL DEFAULT 'directo',
  monto_total      DECIMAL(10,2) NOT NULL,
  estado_reserva   VARCHAR(20) NOT NULL DEFAULT 'confirmada',
  origen           ENUM('evento_async', 'consulta_sync') NOT NULL,
  recibido_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_hotel_checkin (hotel_id, fecha_checkin)
);

-- Asignación de la habitación física durante el check-in/check-out
-- (distinta del tipo de habitación reservado, tal como pide el documento).
CREATE TABLE IF NOT EXISTS asignaciones_habitacion (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id        INT NOT NULL,
  numero_habitacion VARCHAR(10) NOT NULL,
  checkin_en        DATETIME NULL,
  checkout_en       DATETIME NULL,
  creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_reserva (reserva_id)
);

-- Registro de solicitudes/incidencias del huésped durante la estancia.
CREATE TABLE IF NOT EXISTS incidencias_huesped (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id    INT NOT NULL,
  descripcion   VARCHAR(500) NOT NULL,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_reserva (reserva_id)
);

-- Tabla de eventos salientes (patrón "outbox", igual que en servicio-reservas):
-- aquí recepción anota checkout.completed y booking.completed para que otros
-- servicios los recojan por polling.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tipo          VARCHAR(50) NOT NULL,
  payload       JSON NOT NULL,
  procesado     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en  DATETIME NULL
);

-- Confirmaciones por consumidor: permite que varios servicios (facturación,
-- housekeeping, etc.) procesen el mismo evento sin que uno lo marque como
-- "procesado" antes de que los demás lo vean.
CREATE TABLE IF NOT EXISTS confirmaciones_eventos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  evento_id     INT NOT NULL,
  consumidor    VARCHAR(50) NOT NULL,
  confirmado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unico_evento_consumidor (evento_id, consumidor),
  CONSTRAINT fk_confirmaciones_evento
    FOREIGN KEY (evento_id) REFERENCES eventos_salientes(id)
    ON DELETE CASCADE
);
