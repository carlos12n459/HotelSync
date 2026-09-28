\c facturacion_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Folio: cuenta maestra de una estadia/reserva.
CREATE TABLE IF NOT EXISTS folios (
  id              SERIAL PRIMARY KEY,
  reserva_id      INTEGER NOT NULL,
  hotel_id        INTEGER NOT NULL,
  huesped_id      INTEGER NULL,
  moneda          VARCHAR(3) NOT NULL DEFAULT 'COP',
  estado          VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'cancelado')),
  total_cargos    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_impuestos DECIMAL(12,2) NOT NULL DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL DEFAULT 0,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en      TIMESTAMP NULL,

  CONSTRAINT unico_reserva UNIQUE (reserva_id)
);

-- Cargos individuales del folio (habitacion, minibar, spa, restaurante, etc.).
CREATE TABLE IF NOT EXISTS cargos (
  id              SERIAL PRIMARY KEY,
  folio_id        INTEGER NOT NULL,
  concepto        VARCHAR(150) NOT NULL,
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,2) NOT NULL,
  total           DECIMAL(12,2) NOT NULL,
  agregado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cargos_folio
    FOREIGN KEY (folio_id) REFERENCES folios(id)
    ON DELETE CASCADE
);

-- Pagos realizados sobre un folio.
CREATE TABLE IF NOT EXISTS pagos (
  id              SERIAL PRIMARY KEY,
  folio_id        INTEGER NOT NULL,
  monto           DECIMAL(12,2) NOT NULL,
  metodo          VARCHAR(50) NOT NULL,
  referencia      VARCHAR(100) NULL,
  pagado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pagos_folio
    FOREIGN KEY (folio_id) REFERENCES folios(id)
    ON DELETE CASCADE
);

-- Facturas finales emitidas al cerrar un folio.
CREATE TABLE IF NOT EXISTS facturas (
  id              SERIAL PRIMARY KEY,
  folio_id        INTEGER NOT NULL,
  numero          VARCHAR(50) NOT NULL UNIQUE,
  reserva_id      INTEGER NOT NULL,
  total           DECIMAL(12,2) NOT NULL,
  moneda          VARCHAR(3) NOT NULL DEFAULT 'COP',
  emitida_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_facturas_folio
    FOREIGN KEY (folio_id) REFERENCES folios(id)
    ON DELETE CASCADE
);

-- Tabla de eventos salientes (outbox) para notificar pagos/cierres.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id            SERIAL PRIMARY KEY,
  tipo          VARCHAR(50) NOT NULL,
  payload       JSONB NOT NULL,
  procesado     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en  TIMESTAMP NULL
);
