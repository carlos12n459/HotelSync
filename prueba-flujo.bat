@echo off
setlocal EnableDelayedExpansion

echo === Propiedades ===
curl -s http://localhost:3010/propiedades/hoteles
echo.

echo === Disponibilidad ===
curl -s "http://localhost:3010/disponibilidad/disponibilidad?tipo_habitacion_id=1&checkin=2026-09-28&checkout=2026-09-30"
echo.

echo === Crear reserva ===
curl -s -X POST http://localhost:3010/reservas/reservas -H "Content-Type: application/json" -d "{\"nombre_huesped\":\"Ana Gomez\",\"email_huesped\":\"ana@example.com\",\"hotel_id\":1,\"tipo_habitacion_id\":1,\"fecha_checkin\":\"2026-09-28\",\"fecha_checkout\":\"2026-09-30\",\"monto_total\":360000}"
echo.

echo === Llegadas ===
curl -s "http://localhost:3010/recepcion/recepcion/llegadas?hotel_id=1&fecha_checkin=2026-09-28"
echo.

echo === Check-in ===
curl -s -X POST http://localhost:3010/recepcion/recepcion/checkin -H "Content-Type: application/json" -d "{\"reserva_id\":1,\"numero_habitacion\":\"101\"}"
echo.

echo === Checkout ===
curl -s -X POST http://localhost:3010/recepcion/recepcion/checkout -H "Content-Type: application/json" -d "{\"reserva_id\":1}"
echo.

echo === Estado habitacion 101 ===
curl -s http://localhost:3010/housekeeping/housekeeping/habitaciones/101/estado
echo.

echo === Folios ===
curl -s http://localhost:3010/facturacion/facturacion/folios
echo.

echo === Cuenta fidelizacion ===
curl -s http://localhost:3010/fidelizacion/fidelizacion/cuentas/1
echo.

echo === ETL ===
curl -s -X POST http://localhost:3010/analytics/analytics/etl
echo.

echo === KPIs ===
curl -s "http://localhost:3010/analytics/analytics/kpis?hotel_id=1&fecha=2026-09-28"
echo.
