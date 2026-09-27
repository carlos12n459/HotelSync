USE facturacion_db;

-- Folio: cuenta maestra de una estadía/reserva.
CREATE TABLE IF NOT EXISTS folios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id      INT NOT NULL,
  hotel_id        INT NOT NULL,
  huesped_id      INT NULL,
  moneda          VARCHAR(3) NOT NULL DEFAULT 'COP',
  estado          ENUM('abierto', 'cerrado', 'cancelado') NOT NULL DEFAULT 'abierto',
  total_cargos    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_impuestos DECIMAL(12,2) NOT NULL DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL DEFAULT 0,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en      DATETIME NULL,

  UNIQUE KEY unico_reserva (reserva_id)
);

-- Cargos individuales del folio (habitación, minibar, spa, restaurante, etc.).
CREATE TABLE IF NOT EXISTS cargos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  folio_id        INT NOT NULL,
  concepto        VARCHAR(150) NOT NULL,
  cantidad        INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,2) NOT NULL,
  total           DECIMAL(12,2) NOT NULL,
  agregado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cargos_folio
    FOREIGN KEY (folio_id) REFERENCES folios(id)
    ON DELETE CASCADE
);

-- Pagos realizados sobre un folio.
CREATE TABLE IF NOT EXISTS pagos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  folio_id        INT NOT NULL,
  monto           DECIMAL(12,2) NOT NULL,
  metodo          VARCHAR(50) NOT NULL,
  referencia      VARCHAR(100) NULL,
  pagado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pagos_folio
    FOREIGN KEY (folio_id) REFERENCES folios(id)
    ON DELETE CASCADE
);

-- Facturas finales emitidas al cerrar un folio.
CREATE TABLE IF NOT EXISTS facturas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  folio_id        INT NOT NULL,
  numero          VARCHAR(50) NOT NULL UNIQUE,
  reserva_id      INT NOT NULL,
  total           DECIMAL(12,2) NOT NULL,
  moneda          VARCHAR(3) NOT NULL DEFAULT 'COP',
  emitida_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_facturas_folio
    FOREIGN KEY (folio_id) REFERENCES folios(id)
    ON DELETE CASCADE
);

-- Tabla de eventos salientes (outbox) para notificar pagos/cierres.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tipo          VARCHAR(50) NOT NULL,
  payload       JSON NOT NULL,
  procesado     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en  DATETIME NULL
);
