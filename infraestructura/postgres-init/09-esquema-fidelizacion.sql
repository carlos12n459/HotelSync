\c fidelizacion_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Cuentas de fidelizacion por huesped.
CREATE TABLE IF NOT EXISTS cuentas_fidelizacion (
  id              SERIAL PRIMARY KEY,
  guest_id        INTEGER NOT NULL UNIQUE,
  nombre_huesped  VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  nivel           VARCHAR(20) NOT NULL DEFAULT 'plata' CHECK (nivel IN ('plata', 'oro', 'platino')),
  puntos          INTEGER NOT NULL DEFAULT 0,
  puntos_canjeados INTEGER NOT NULL DEFAULT 0,
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Transacciones de puntos (acumulacion o canje).
CREATE TABLE IF NOT EXISTS transacciones_puntos (
  id              SERIAL PRIMARY KEY,
  cuenta_id       INTEGER NOT NULL,
  reserva_id      INTEGER NULL,
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('acumulacion', 'canje', 'ajuste')),
  puntos          INTEGER NOT NULL,
  descripcion     VARCHAR(255) NOT NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_transacciones_cuenta
    FOREIGN KEY (cuenta_id) REFERENCES cuentas_fidelizacion(id)
    ON DELETE CASCADE
);

-- Tabla de eventos entrantes procesados (idempotencia) para booking.completed.
CREATE TABLE IF NOT EXISTS eventos_procesados (
  id              SERIAL PRIMARY KEY,
  evento_id       VARCHAR(100) NOT NULL UNIQUE,
  tipo            VARCHAR(50) NOT NULL,
  reserva_id      INTEGER NOT NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Datos semilla.
INSERT INTO cuentas_fidelizacion (guest_id, nombre_huesped, email, nivel, puntos) VALUES
  (1, 'Maria Perez', 'maria@example.com', 'oro', 500),
  (2, 'Carlos Rodriguez', 'carlos@example.com', 'plata', 120)
ON CONFLICT (guest_id) DO UPDATE SET nombre_huesped = EXCLUDED.nombre_huesped;

SELECT setval(pg_get_serial_sequence('cuentas_fidelizacion', 'id'), COALESCE((SELECT MAX(id) FROM cuentas_fidelizacion), 1));
