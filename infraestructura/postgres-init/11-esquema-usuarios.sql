\c usuarios_db
GRANT ALL ON SCHEMA public TO hotelsync_app;
SET ROLE hotelsync_app;

-- Tabla de usuarios del sistema. Almacena credenciales y roles.
-- Los passwords se guardan hasheados con bcrypt; nunca en texto plano.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(20) NOT NULL DEFAULT 'cliente'
                CHECK (rol IN ('admin', 'gerente', 'empleado', 'cliente')),
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Usuario admin semilla para que el equipo pueda empezar a probar.
-- Password: admin123 (cambiar en produccion).
-- El hash fue generado con bcryptjs a 10 rondas.
INSERT INTO users (id, nombre, email, password_hash, rol) VALUES
  (1, 'Administrador HotelSync', 'admin@hotelsync.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  rol = EXCLUDED.rol;

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
