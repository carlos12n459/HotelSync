\c analytics_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- KPIs diarios por hotel, calculados por un proceso ETL periodico.
CREATE TABLE IF NOT EXISTS kpis_diarios (
  id              SERIAL PRIMARY KEY,
  hotel_id        INTEGER NOT NULL,
  fecha           DATE NOT NULL,
  habitaciones_disponibles INTEGER NOT NULL DEFAULT 0,
  habitaciones_ocupadas    INTEGER NOT NULL DEFAULT 0,
  habitaciones_bloqueadas  INTEGER NOT NULL DEFAULT 0,
  occupancy       DECIMAL(5,2) NOT NULL DEFAULT 0,
  adr             DECIMAL(12,2) NOT NULL DEFAULT 0,
  revpar          DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_revenue   DECIMAL(12,2) NOT NULL DEFAULT 0,
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unico_hotel_fecha UNIQUE (hotel_id, fecha)
);

-- Log de ejecuciones del proceso ETL.
CREATE TABLE IF NOT EXISTS etl_log (
  id              SERIAL PRIMARY KEY,
  ejecutado_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registros       INTEGER NOT NULL DEFAULT 0,
  estado          VARCHAR(20) NOT NULL,
  detalle         TEXT NULL
);
