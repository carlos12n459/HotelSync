const pool = require("../config/baseDeDatos");

const FACTORES_PUNTOS = {
  plata: 1,
  oro: 2,
  platino: 3
};

function calcularPuntos(monto, nivel) {
  const factor = FACTORES_PUNTOS[nivel] || FACTORES_PUNTOS.plata;
  return Math.floor(monto / 1000) * factor;
}

/** GET /api/fidelizacion/cuentas */
async function listarCuentas(req, res) {
  try {
    const [filas] = await pool.query("SELECT * FROM cuentas_fidelizacion ORDER BY creado_en DESC");
    res.json(filas);
  } catch (error) {
    console.error("[fidelizacion] Error al listar cuentas:", error.message);
    res.status(500).json({ error: "No se pudieron listar las cuentas", detalle: error.message });
  }
}

/** GET /api/fidelizacion/cuentas/:guest_id */
async function obtenerCuenta(req, res) {
  try {
    const [filas] = await pool.query("SELECT * FROM cuentas_fidelizacion WHERE guest_id = ?", [req.params.guest_id]);
    if (filas.length === 0) {
      return res.status(404).json({ error: "Cuenta de fidelización no encontrada" });
    }
    res.json(filas[0]);
  } catch (error) {
    console.error("[fidelizacion] Error al obtener cuenta:", error.message);
    res.status(500).json({ error: "No se pudo obtener la cuenta", detalle: error.message });
  }
}

/** GET /api/fidelizacion/cuentas/:guest_id/transacciones */
async function listarTransacciones(req, res) {
  try {
    const [cuentas] = await pool.query("SELECT id FROM cuentas_fidelizacion WHERE guest_id = ?", [req.params.guest_id]);
    if (cuentas.length === 0) {
      return res.status(404).json({ error: "Cuenta de fidelización no encontrada" });
    }

    const [filas] = await pool.query(
      "SELECT * FROM transacciones_puntos WHERE cuenta_id = ? ORDER BY creado_en DESC",
      [cuentas[0].id]
    );
    res.json(filas);
  } catch (error) {
    console.error("[fidelizacion] Error al listar transacciones:", error.message);
    res.status(500).json({ error: "No se pudieron listar las transacciones", detalle: error.message });
  }
}

/** POST /api/fidelizacion/cuentas/:guest_id/canjear */
async function canjearPuntos(req, res) {
  const { puntos, descripcion } = req.body;

  if (!puntos || puntos <= 0 || !Number.isInteger(Number(puntos))) {
    return res.status(400).json({ error: "El campo 'puntos' es obligatorio y debe ser un entero positivo" });
  }
  if (!descripcion || descripcion.trim().length === 0) {
    return res.status(400).json({ error: "El campo 'descripcion' es obligatorio" });
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [cuentas] = await conexion.query("SELECT * FROM cuentas_fidelizacion WHERE guest_id = ? FOR UPDATE", [req.params.guest_id]);
    if (cuentas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ error: "Cuenta de fidelización no encontrada" });
    }

    const cuenta = cuentas[0];
    if (cuenta.puntos < puntos) {
      await conexion.rollback();
      return res.status(400).json({ error: "Puntos insuficientes", puntos_disponibles: cuenta.puntos });
    }

    await conexion.query(
      "UPDATE cuentas_fidelizacion SET puntos = puntos - ?, puntos_canjeados = puntos_canjeados + ? WHERE id = ?",
      [puntos, puntos, cuenta.id]
    );

    await conexion.query(
      "INSERT INTO transacciones_puntos (cuenta_id, tipo, puntos, descripcion) VALUES (?, 'canje', ?, ?)",
      [cuenta.id, puntos, descripcion]
    );

    await conexion.commit();

    const [actualizada] = await pool.query("SELECT * FROM cuentas_fidelizacion WHERE id = ?", [cuenta.id]);
    res.json({ mensaje: "Canje realizado exitosamente", cuenta: actualizada[0] });
  } catch (error) {
    await conexion.rollback();
    console.error("[fidelizacion] Error al canjear puntos:", error.message);
    res.status(500).json({ error: "No se pudo realizar el canje", detalle: error.message });
  } finally {
    conexion.release();
  }
}

/**
 * Procesa un evento booking.completed acumulando puntos al huésped.
 * Se usa desde el poller. Si el huésped no existe, lo crea automáticamente
 * consultando los datos de la reserva a servicio-reservas.
 */
async function acumularPuntosPorReserva(reserva) {
  const { reserva_id, monto_total } = reserva;
  const monto = Number(monto_total);

  if (!reserva_id || isNaN(monto)) {
    throw new Error("Payload de booking.completed inválido: faltan reserva_id o monto_total");
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    let [cuentas] = await conexion.query("SELECT * FROM cuentas_fidelizacion WHERE guest_id = ? FOR UPDATE", [reserva.guest_id]);

    let cuenta;
    if (cuentas.length === 0) {
      const [resultado] = await conexion.query(
        "INSERT INTO cuentas_fidelizacion (guest_id, nombre_huesped, email, nivel, puntos) VALUES (?, ?, ?, 'plata', 0)",
        [reserva.guest_id, reserva.nombre_huesped, reserva.email_huesped]
      );
      const [nueva] = await conexion.query("SELECT * FROM cuentas_fidelizacion WHERE id = ?", [resultado.insertId]);
      cuenta = nueva[0];
    } else {
      cuenta = cuentas[0];
    }

    const puntos = calcularPuntos(monto, cuenta.nivel);

    await conexion.query(
      "UPDATE cuentas_fidelizacion SET puntos = puntos + ? WHERE id = ?",
      [puntos, cuenta.id]
    );

    await conexion.query(
      "INSERT INTO transacciones_puntos (cuenta_id, reserva_id, tipo, puntos, descripcion) VALUES (?, ?, 'acumulacion', ?, ?)",
      [cuenta.id, reserva_id, puntos, `Puntos acumulados por reserva #${reserva_id} (nivel ${cuenta.nivel})`]
    );

    await conexion.commit();

    console.log(`[fidelizacion] +${puntos} puntos al huésped ${cuenta.guest_id} por reserva #${reserva_id}`);
    return { cuenta_id: cuenta.id, puntos_acumulados: puntos };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = {
  listarCuentas,
  obtenerCuenta,
  listarTransacciones,
  canjearPuntos,
  acumularPuntosPorReserva
};
