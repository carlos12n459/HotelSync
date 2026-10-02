\c reservas_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Huespedes registrados en el sistema. Permite integrar con fidelizacion.
CREATE TABLE IF NOT EXISTS huespedes (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  telefono      VARCHAR(50) NULL,
  documento     VARCHAR(50) NULL,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reservas del sistema.
-- usuario_id: referencia al usuario autenticado que realiza la reserva.
-- guest_id: referencia al huesped existente en el sistema (persiste para fidelizacion).
CREATE TABLE IF NOT EXISTS reservas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NULL,
  guest_id INTEGER NULL,
  nombre_huesped VARCHAR(150) NOT NULL,
  email_huesped VARCHAR(150) NOT NULL,
  hotel_id INTEGER NOT NULL,
  tipo_habitacion_id INTEGER NOT NULL,
  fecha_checkin DATE NOT NULL,
  fecha_checkout DATE NOT NULL,
  canal VARCHAR(50) NOT NULL DEFAULT 'directo',
  monto_total DECIMAL(10,2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'cancelada')),
  creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_reservas_huesped
    FOREIGN KEY (guest_id) REFERENCES huespedes(id)
    ON DELETE SET NULL
);

-- Datos semilla de huespedes para pruebas.
INSERT INTO huespedes (id, nombre, email) VALUES
  (1, 'Maria Perez', 'maria@example.com'),
  (2, 'Carlos Rodriguez', 'carlos@example.com')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

SELECT setval(pg_get_serial_sequence('huespedes', 'id'), COALESCE((SELECT MAX(id) FROM huespedes), 1));

-- Tabla de eventos salientes (patron "outbox"). Mantiene el respaldo
-- transaccional mientras RabbitMQ se usa como broker principal.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  procesado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en TIMESTAMP NULL
);
