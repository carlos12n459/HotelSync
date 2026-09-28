const pool = require("../config/baseDeDatos");
const { listarReservasConfirmadas } = require("../clientes/reservasClient");
const { listarHoteles, listarHabitaciones } = require("../clientes/propiedadesClient");

const DIAS_VENTANA = 7;

function generarVentanaFechas(dias) {
  const hoy = new Date();
  const fechas = [];
  for (let i = 0; i < dias; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    fechas.push(fecha.toISOString().slice(0, 10));
  }
  return fechas;
}

async function guardarKPI(kpi) {
  const {
    hotel_id,
    fecha,
    habitaciones_disponibles,
    habitaciones_ocupadas,
    habitaciones_bloqueadas,
    occupancy,
    adr,
    revpar,
    total_revenue
  } = kpi;

  await pool.query(
    `INSERT INTO kpis_diarios
      (hotel_id, fecha, habitaciones_disponibles, habitaciones_ocupadas, habitaciones_bloqueadas,
       occupancy, adr, revpar, total_revenue)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (hotel_id, fecha) DO UPDATE SET
       habitaciones_disponibles = EXCLUDED.habitaciones_disponibles,
       habitaciones_ocupadas = EXCLUDED.habitaciones_ocupadas,
       habitaciones_bloqueadas = EXCLUDED.habitaciones_bloqueadas,
       occupancy = EXCLUDED.occupancy,
       adr = EXCLUDED.adr,
       revpar = EXCLUDED.revpar,
       total_revenue = EXCLUDED.total_revenue,
       actualizado_en = CURRENT_TIMESTAMP`,
    [
      hotel_id,
      fecha,
      habitaciones_disponibles,
      habitaciones_ocupadas,
      habitaciones_bloqueadas,
      occupancy,
      adr,
      revpar,
      total_revenue
    ]
  );
}

async function registrarLogETL(registros, estado, detalle) {
  await pool.query(
    "INSERT INTO etl_log (registros, estado, detalle) VALUES ($1, $2, $3)",
    [registros, estado, detalle]
  );
}

async function calcularKPIs() {
  let registros = 0;
  let estado = "exitoso";
  let detalle = "";

  try {
    const [hoteles, reservasConfirmadas] = await Promise.all([
      listarHoteles(),
      listarReservasConfirmadas()
    ]);

    const fechas = generarVentanaFechas(DIAS_VENTANA);

    for (const hotel of hoteles) {
      const habitaciones = await listarHabitaciones(hotel.id);
      const habitacionesDisponibles = habitaciones.length;

      for (const fecha of fechas) {
        const reservasDelDia = reservasConfirmadas.filter(
          (reserva) =>
            Number(reserva.hotel_id) === Number(hotel.id) &&
            reserva.fecha_checkin === fecha
        );

        const habitacionesOcupadas = reservasDelDia.length;
        const habitacionesBloqueadas = 0;
        const totalRevenue = reservasDelDia.reduce(
          (acumulado, reserva) => acumulado + Number(reserva.monto_total || 0),
          0
        );

        const occupancy =
          habitacionesDisponibles > 0
            ? (habitacionesOcupadas / habitacionesDisponibles) * 100
            : 0;
        const adr = habitacionesOcupadas > 0 ? totalRevenue / habitacionesOcupadas : 0;
        const revpar =
          habitacionesDisponibles > 0 ? totalRevenue / habitacionesDisponibles : 0;

        await guardarKPI({
          hotel_id: hotel.id,
          fecha,
          habitaciones_disponibles: habitacionesDisponibles,
          habitaciones_ocupadas: habitacionesOcupadas,
          habitaciones_bloqueadas: habitacionesBloqueadas,
          occupancy: Number(occupancy.toFixed(2)),
          adr: Number(adr.toFixed(2)),
          revpar: Number(revpar.toFixed(2)),
          total_revenue: Number(totalRevenue.toFixed(2))
        });

        registros++;
      }
    }

    detalle = `Calculados ${registros} registros hotel-fecha`;
  } catch (error) {
    estado = "error";
    detalle = error.message;
    console.error("[analytics] Error durante el proceso ETL:", error.message);
  }

  try {
    await registrarLogETL(registros, estado, detalle);
  } catch (errorLog) {
    console.error("[analytics] Error al registrar log ETL:", errorLog.message);
  }

  return { estado, registros, detalle };
}

module.exports = { calcularKPIs, generarVentanaFechas };
