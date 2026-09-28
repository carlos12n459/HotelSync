\c disponibilidad_tarifas_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Tipos de habitacion disponibles por hotel (catalogo minimo).
CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  capacidad INTEGER NOT NULL DEFAULT 2,
  tarifa_base DECIMAL(10,2) NOT NULL
);

-- Inventario de disponibilidad por tipo de habitacion y por fecha.
-- Este es el nucleo transaccional: aqui se hace el bloqueo para evitar
-- sobreventas cuando dos reservas intentan tomar la misma habitacion.
CREATE TABLE IF NOT EXISTS inventario (
  id SERIAL PRIMARY KEY,
  tipo_habitacion_id INTEGER NOT NULL,
  fecha DATE NOT NULL,
  cantidad_disponible INTEGER NOT NULL,
  cantidad_bloqueada INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT unico_tipo_fecha UNIQUE (tipo_habitacion_id, fecha),
  CONSTRAINT fk_inventario_tipo_habitacion
    FOREIGN KEY (tipo_habitacion_id) REFERENCES tipos_habitacion(id)
    ON DELETE CASCADE
);

-- Tabla de eventos salientes (patron "outbox"): se mantiene como respaldo
-- aunque ahora la comunicacion asincrona principal usa RabbitMQ.
CREATE TABLE IF NOT EXISTS eventos_salientes (
  id            SERIAL PRIMARY KEY,
  tipo          VARCHAR(50) NOT NULL,
  payload       JSONB NOT NULL,
  procesado     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  procesado_en  TIMESTAMP NULL
);

-- Datos semilla para poder probar el flujo de inmediato.
INSERT INTO tipos_habitacion (id, hotel_id, nombre, capacidad, tarifa_base) VALUES
  (1, 1, 'Habitacion Estandar', 2, 180000.00),
  (2, 1, 'Habitacion Doble Vista al Mar', 2, 260000.00),
  (3, 2, 'Suite Junior', 3, 350000.00)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

SELECT setval(pg_get_serial_sequence('tipos_habitacion', 'id'), COALESCE((SELECT MAX(id) FROM tipos_habitacion), 1));

-- Se generan 30 dias de disponibilidad (5 habitaciones libres por dia y por tipo)
-- a partir de la fecha actual, para cada tipo de habitacion anterior.
INSERT INTO inventario (tipo_habitacion_id, fecha, cantidad_disponible, cantidad_bloqueada)
SELECT th.id, fechas.fecha::date, 5, 0
FROM tipos_habitacion th
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '29 days', INTERVAL '1 day') AS fechas(fecha)
ON CONFLICT (tipo_habitacion_id, fecha) DO NOTHING;

SELECT setval(pg_get_serial_sequence('inventario', 'id'), COALESCE((SELECT MAX(id) FROM inventario), 1));
