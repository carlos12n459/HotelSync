USE analytics_db;

-- KPIs diarios por hotel, calculados por un proceso ETL periódico.
CREATE TABLE IF NOT EXISTS kpis_diarios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id        INT NOT NULL,
  fecha           DATE NOT NULL,
  habitaciones_disponibles INT NOT NULL DEFAULT 0,
  habitaciones_ocupadas    INT NOT NULL DEFAULT 0,
  habitaciones_bloqueadas  INT NOT NULL DEFAULT 0,
  occupancy       DECIMAL(5,2) NOT NULL DEFAULT 0,  -- porcentaje 0-100
  adr             DECIMAL(12,2) NOT NULL DEFAULT 0, -- average daily rate
  revpar          DECIMAL(12,2) NOT NULL DEFAULT 0, -- revenue per available room
  total_revenue   DECIMAL(12,2) NOT NULL DEFAULT 0,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unico_hotel_fecha (hotel_id, fecha)
);

-- Log de ejecuciones del proceso ETL.
CREATE TABLE IF NOT EXISTS etl_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  ejecutado_en    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registros       INT NOT NULL DEFAULT 0,
  estado          VARCHAR(20) NOT NULL,
  detalle         TEXT NULL
);
