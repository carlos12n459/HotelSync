USE fidelizacion_db;

-- Cuentas de fidelización por huésped.
CREATE TABLE IF NOT EXISTS cuentas_fidelizacion (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  guest_id        INT NOT NULL UNIQUE,
  nombre_huesped  VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  nivel           ENUM('plata', 'oro', 'platino') NOT NULL DEFAULT 'plata',
  puntos          INT NOT NULL DEFAULT 0,
  puntos_canjeados INT NOT NULL DEFAULT 0,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Transacciones de puntos (acumulación o canje).
CREATE TABLE IF NOT EXISTS transacciones_puntos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id       INT NOT NULL,
  reserva_id      INT NULL,
  tipo            ENUM('acumulacion', 'canje', 'ajuste') NOT NULL,
  puntos          INT NOT NULL,
  descripcion     VARCHAR(255) NOT NULL,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_transacciones_cuenta
    FOREIGN KEY (cuenta_id) REFERENCES cuentas_fidelizacion(id)
    ON DELETE CASCADE
);

-- Tabla de eventos entrantes procesados (idempotencia) para booking.completed.
CREATE TABLE IF NOT EXISTS eventos_procesados (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  evento_id       VARCHAR(100) NOT NULL UNIQUE,
  tipo            VARCHAR(50) NOT NULL,
  reserva_id      INT NOT NULL,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Datos semilla.
INSERT INTO cuentas_fidelizacion (guest_id, nombre_huesped, email, nivel, puntos) VALUES
  (1, 'María Pérez', 'maria@example.com', 'oro', 500),
  (2, 'Carlos Rodríguez', 'carlos@example.com', 'plata', 120)
ON DUPLICATE KEY UPDATE nombre_huesped = VALUES(nombre_huesped);
