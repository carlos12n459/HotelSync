const pool = require("../config/baseDeDatos");

// Lee el usuario autenticado que el gateway envia por headers.
function obtenerUsuarioHeaders(req) {
  return {
    id: req.headers["x-user-id"] ? Number(req.headers["x-user-id"]) : null,
    rol: req.headers["x-user-rol"] || null,
    email: req.headers["x-user-email"] || null
  };
}

/** GET /api/hoteles */
async function listarHoteles(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM hoteles ORDER BY id");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar hoteles", detalle: error.message });
  }
}

/** GET /api/hoteles/mios
 * Lista los hoteles del gerente/admin autenticado.
 * - admin: ve todos los hoteles.
 * - gerente: ve solo los hoteles donde es owner.
 */
async function listarHotelesMios(req, res) {
  const usuario = obtenerUsuarioHeaders(req);

  if (!usuario.id) {
    return res.status(401).json({ error: "Se requiere autenticacion para ver tus hoteles" });
  }

  try {
    let rows;
    if (usuario.rol === "admin") {
      ({ rows } = await pool.query("SELECT * FROM hoteles ORDER BY id"));
    } else {
      ({ rows } = await pool.query(
        "SELECT * FROM hoteles WHERE owner_id = $1 ORDER BY id",
        [usuario.id]
      ));
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar tus hoteles", detalle: error.message });
  }
}

/** GET /api/hoteles/:id */
async function obtenerHotel(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM hoteles WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Hotel no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener hotel", detalle: error.message });
  }
}

/** POST /api/hoteles
 * Crea un hotel. Se puede especificar owner_id e imagen_url.
 * Si el usuario esta autenticado como gerente, se asigna automaticamente.
 */
async function crearHotel(req, res) {
  const { nombre, ciudad, pais, timezone, direccion, owner_id, imagen_url } = req.body;
  const usuario = obtenerUsuarioHeaders(req);

  if (!nombre || !ciudad || !pais) {
    return res.status(400).json({ error: "nombre, ciudad y pais son obligatorios" });
  }

  // Si no se envia owner_id y hay un usuario autenticado, lo usamos como dueno.
  const ownerFinal = owner_id || usuario.id || null;

  try {
    const { rows: resultado } = await pool.query(
      "INSERT INTO hoteles (owner_id, nombre, ciudad, pais, timezone, direccion, imagen_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [ownerFinal, nombre, ciudad, pais, timezone || "America/Bogota", direccion || null, imagen_url || null]
    );
    const { rows } = await pool.query("SELECT * FROM hoteles WHERE id = $1", [resultado[0].id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al crear hotel", detalle: error.message });
  }
}

/** PATCH /api/hoteles/:id
 * Actualiza un hotel. Solo el dueno o un admin pueden hacerlo.
 */
async function actualizarHotel(req, res) {
  const usuario = obtenerUsuarioHeaders(req);
  const { nombre, ciudad, pais, timezone, direccion, imagen_url, activo } = req.body;

  try {
    const { rows: existente } = await pool.query("SELECT * FROM hoteles WHERE id = $1", [req.params.id]);
    if (existente.length === 0) {
      return res.status(404).json({ error: "Hotel no encontrado" });
    }

    const hotel = existente[0];

    // Solo dueno o admin pueden editar.
    if (usuario.rol !== "admin" && hotel.owner_id !== usuario.id) {
      return res.status(403).json({ error: "No tienes permiso para editar este hotel" });
    }

    const { rows } = await pool.query(
      `UPDATE hoteles SET
        nombre = COALESCE($1, nombre),
        ciudad = COALESCE($2, ciudad),
        pais = COALESCE($3, pais),
        timezone = COALESCE($4, timezone),
        direccion = COALESCE($5, direccion),
        imagen_url = COALESCE($6, imagen_url),
        activo = COALESCE($7, activo)
       WHERE id = $8
       RETURNING *`,
      [
        nombre || null,
        ciudad || null,
        pais || null,
        timezone || null,
        direccion || null,
        imagen_url || null,
        activo !== undefined ? activo : null,
        req.params.id
      ]
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar hotel", detalle: error.message });
  }
}

/** GET /api/hoteles/:hotel_id/tipos-habitacion */
async function listarTiposHabitacion(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tipos_habitacion WHERE hotel_id = $1 ORDER BY id",
      [req.params.hotel_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar tipos de habitacion", detalle: error.message });
  }
}

/** GET /api/tipos-habitacion/:id */
async function obtenerTipoHabitacion(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM tipos_habitacion WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Tipo de habitacion no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener tipo de habitacion", detalle: error.message });
  }
}

/** POST /api/hoteles/:hotel_id/tipos-habitacion */
async function crearTipoHabitacion(req, res) {
  const { hotel_id } = req.params;
  const { nombre, capacidad, tarifa_base, amenities, politica_cancelacion, imagen_url } = req.body;

  if (!nombre || tarifa_base === undefined) {
    return res.status(400).json({ error: "nombre y tarifa_base son obligatorios" });
  }

  try {
    const { rows: resultado } = await pool.query(
      "INSERT INTO tipos_habitacion (hotel_id, nombre, capacidad, tarifa_base, amenities, politica_cancelacion, imagen_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [hotel_id, nombre, capacidad || 2, tarifa_base, amenities ? JSON.stringify(amenities) : null, politica_cancelacion || null, imagen_url || null]
    );
    const tipo = resultado[0];

    // Inicializar inventario en el servicio de disponibilidad (mejor esfuerzo).
    try {
      const urlDisponibilidad = `${process.env.URL_SERVICIO_DISPONIBILIDAD || "http://localhost:3001"}/api/disponibilidad/inicializar`;
      console.log("[propiedades] Inicializando inventario en", urlDisponibilidad);
      const resp = await fetch(urlDisponibilidad, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_habitacion_id: tipo.id,
          hotel_id: Number(hotel_id),
          nombre,
          capacidad: capacidad || 2,
          tarifa_base
        })
      });
      const respText = await resp.text();
      console.log("[propiedades] Respuesta inventario", resp.status, respText);
    } catch (syncError) {
      console.error("[propiedades] No se pudo inicializar inventario:", syncError.message);
    }

    const { rows } = await pool.query("SELECT * FROM tipos_habitacion WHERE id = $1", [tipo.id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al crear tipo de habitacion", detalle: error.message });
  }
}

/** GET /api/hoteles/:hotel_id/habitaciones */
async function listarHabitaciones(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM habitaciones WHERE hotel_id = $1 ORDER BY numero",
      [req.params.hotel_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar habitaciones", detalle: error.message });
  }
}

/** POST /api/hoteles/:hotel_id/habitaciones */
async function crearHabitacion(req, res) {
  const { hotel_id } = req.params;
  const { numero, tipo_habitacion_id, piso } = req.body;

  if (!numero || !tipo_habitacion_id) {
    return res.status(400).json({ error: "numero y tipo_habitacion_id son obligatorios" });
  }

  try {
    const { rows: resultado } = await pool.query(
      "INSERT INTO habitaciones (hotel_id, numero, tipo_habitacion_id, piso) VALUES ($1, $2, $3, $4) RETURNING id",
      [hotel_id, numero, tipo_habitacion_id, piso || null]
    );
    const { rows } = await pool.query("SELECT * FROM habitaciones WHERE id = $1", [resultado[0].id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al crear habitacion", detalle: error.message });
  }
}

module.exports = {
  listarHoteles,
  listarHotelesMios,
  obtenerHotel,
  crearHotel,
  actualizarHotel,
  listarTiposHabitacion,
  obtenerTipoHabitacion,
  crearTipoHabitacion,
  listarHabitaciones,
  crearHabitacion
};
