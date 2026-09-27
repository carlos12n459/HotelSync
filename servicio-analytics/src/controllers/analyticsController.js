const pool = require("../config/baseDeDatos");
const { calcularKPIs } = require("../etl/calcularKPIs");

async function listarKPIs(req, res) {
  try {
    const { hotel_id, fecha } = req.query;
    let consulta = "SELECT * FROM kpis_diarios WHERE 1=1";
    const parametros = [];

    if (hotel_id) {
      consulta += " AND hotel_id = ?";
      parametros.push(hotel_id);
    }

    if (fecha) {
      consulta += " AND fecha = ?";
      parametros.push(fecha);
    }

    consulta += " ORDER BY fecha DESC, hotel_id ASC";

    const [filas] = await pool.query(consulta, parametros);
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: "Error al listar KPIs", detalle: error.message });
  }
}

async function resumenGlobal(req, res) {
  try {
    const [[resumen]] = await pool.query(
      `SELECT
         COUNT(DISTINCT hotel_id) AS total_hoteles,
         COUNT(*) AS total_registros,
         SUM(habitaciones_disponibles) AS habitaciones_disponibles,
         SUM(habitaciones_ocupadas) AS habitaciones_ocupadas,
         SUM(habitaciones_bloqueadas) AS habitaciones_bloqueadas,
         AVG(occupancy) AS occupancy_promedio,
         SUM(total_revenue) AS total_revenue,
         AVG(adr) AS adr_promedio,
         AVG(revpar) AS revpar_promedio
       FROM kpis_diarios`
    );

    res.json({
      total_hoteles: Number(resumen.total_hoteles) || 0,
      total_registros: Number(resumen.total_registros) || 0,
      habitaciones_disponibles: Number(resumen.habitaciones_disponibles) || 0,
      habitaciones_ocupadas: Number(resumen.habitaciones_ocupadas) || 0,
      habitaciones_bloqueadas: Number(resumen.habitaciones_bloqueadas) || 0,
      occupancy_promedio: Number(Number(resumen.occupancy_promedio || 0).toFixed(2)),
      total_revenue: Number(Number(resumen.total_revenue || 0).toFixed(2)),
      adr_promedio: Number(Number(resumen.adr_promedio || 0).toFixed(2)),
      revpar_promedio: Number(Number(resumen.revpar_promedio || 0).toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ error: "Error al generar el resumen", detalle: error.message });
  }
}

async function ejecutarETLManual(req, res) {
  try {
    const resultado = await calcularKPIs();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Error al ejecutar el ETL", detalle: error.message });
  }
}

async function listarLogETL(req, res) {
  try {
    const [filas] = await pool.query(
      "SELECT * FROM etl_log ORDER BY ejecutado_en DESC LIMIT 50"
    );
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: "Error al listar log ETL", detalle: error.message });
  }
}

module.exports = {
  listarKPIs,
  resumenGlobal,
  ejecutarETLManual,
  listarLogETL
};
