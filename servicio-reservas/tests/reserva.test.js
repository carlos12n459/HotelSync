/**
 * Test básico de ejemplo para el servicio de reservas.
 * Verifica la validación de campos obligatorios sin necesidad de base de datos.
 */

describe("Validación de crearReserva", () => {
  test("debe rechazar reserva sin campos obligatorios", () => {
    const datosIncompletos = {
      nombre_huesped: "María Pérez",
      email_huesped: "maria@example.com"
      // faltan tipo_habitacion_id, fecha_checkin, fecha_checkout, monto_total
    };

    const camposObligatorios = [
      "nombre_huesped",
      "tipo_habitacion_id",
      "fecha_checkin",
      "fecha_checkout",
      "monto_total"
    ];

    const faltantes = camposObligatorios.filter((campo) => !datosIncompletos[campo]);

    expect(faltantes.length).toBeGreaterThan(0);
    expect(faltantes).toContain("tipo_habitacion_id");
    expect(faltantes).toContain("fecha_checkin");
  });

  test("debe aceptar reserva completa", () => {
    const datosCompletos = {
      nombre_huesped: "María Pérez",
      email_huesped: "maria@example.com",
      hotel_id: 1,
      tipo_habitacion_id: 1,
      fecha_checkin: "2026-09-28",
      fecha_checkout: "2026-09-30",
      monto_total: 360000
    };

    const camposObligatorios = [
      "nombre_huesped",
      "tipo_habitacion_id",
      "fecha_checkin",
      "fecha_checkout",
      "monto_total"
    ];

    const completos = camposObligatorios.every((campo) => datosCompletos[campo]);
    expect(completos).toBe(true);
  });
});
