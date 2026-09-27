USE disponibilidad_tarifas_db;

-- Tipos de habitación disponibles por hotel (catálogo mínimo).
CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  capacidad INT NOT NULL DEFAULT 2,
  tarifa_base DECIMAL(10,2) NOT NULL
);

-- Inventario de disponibilidad por tipo de habitación y por fecha.
-- Este es el núcleo transaccional: aquí se hace el bloqueo para evitar
-- sobreventas cuando dos reservas intentan tomar la misma habitación.
CREATE TABLE IF NOT EXISTS inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_habitacion_id INT NOT NULL,
  fecha DATE NOT NULL,
  cantidad_disponible INT NOT NULL,
  cantidad_bloqueada INT NOT NULL DEFAULT 0,
  UNIQUE KEY unico_tipo_fecha (tipo_habitacion_id, fecha),
  CONSTRAINT fk_inventario_tipo_habitacion
    FOREIGN KEY (tipo_habitacion_id) REFERENCES tipos_habitacion(id)
    ON DELETE CASCADE
);

-- Tabla de eventos salientes (patrón "outbox"): reemplaza a RabbitMQ.
-- Se usa para publicar availability.updated ante cualquier cambio de inventario.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tipo          VARCHAR(50) NOT NULL,
  payload       JSON NOT NULL,
  procesado     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en  DATETIME NULL
);

-- Datos semilla para poder probar el flujo de inmediato.
INSERT INTO tipos_habitacion (id, hotel_id, nombre, capacidad, tarifa_base) VALUES
  (1, 1, 'Habitación Estándar', 2, 180000.00),
  (2, 1, 'Habitación Doble Vista al Mar', 2, 260000.00),
  (3, 2, 'Suite Junior', 3, 350000.00)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Se generan 30 días de disponibilidad (5 habitaciones libres por día y por tipo)
-- a partir de la fecha actual, para cada tipo de habitación anterior.
INSERT INTO inventario (tipo_habitacion_id, fecha, cantidad_disponible, cantidad_bloqueada)
SELECT th.id, fechas.fecha, 5, 0
FROM tipos_habitacion th
CROSS JOIN (
  SELECT CURDATE() + INTERVAL n DAY AS fecha
  FROM (
    SELECT a.N + b.N * 10 AS n
    FROM (SELECT 0 N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
          UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a
    CROSS JOIN (SELECT 0 N UNION SELECT 1 UNION SELECT 2) b
    HAVING n < 30
  ) numeros
) fechas
ON DUPLICATE KEY UPDATE cantidad_disponible = cantidad_disponible;
