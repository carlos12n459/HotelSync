/**
 * api.js
 * Cliente HTTP para consumir el API Gateway de HotelSync.
 * Todas las peticiones protegidas incluyen el token JWT en el header Authorization.
 */

async function apiRequest(ruta, opciones = {}){
  const token = obtenerToken();
  const headers = {
    "Accept": "application/json",
    ...(opciones.headers || {})
  };

  if(token){
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Si el body es FormData, no sobreescribimos Content-Type (el navegador lo pone con boundary).
  if(!(opciones.body instanceof FormData)){
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(`${API_BASE}${ruta}`, { ...opciones, headers });
  const text = await resp.text();
  let datos = null;
  try { datos = text ? JSON.parse(text) : null; } catch(e){ datos = text; }

  if(!resp.ok){
    const mensaje = datos && datos.error ? datos.error : `Error HTTP ${resp.status}`;
    throw new Error(mensaje);
  }

  return datos;
}

function apiGet(ruta){ return apiRequest(ruta, { method: "GET" }); }
function apiPost(ruta, body){ return apiRequest(ruta, { method: "POST", body: JSON.stringify(body) }); }
function apiPatch(ruta, body){ return apiRequest(ruta, { method: "PATCH", body: JSON.stringify(body) }); }

// Autenticacion
function apiLogin(email, password){ return apiPost("/usuarios/auth/login", { email, password }); }
function apiRegister(nombre, email, password, rol){ return apiPost("/usuarios/auth/register", { nombre, email, password, rol }); }
function apiPerfil(){ return apiGet("/usuarios/auth/perfil"); }

// Propiedades
function apiListarHoteles(){ return apiGet("/propiedades/hoteles"); }
function apiListarHotelesMios(){ return apiGet("/propiedades/hoteles/mios"); }
function apiObtenerHotel(id){ return apiGet(`/propiedades/hoteles/${id}`); }
function apiCrearHotel(body){ return apiPost("/propiedades/hoteles", body); }
function apiActualizarHotel(id, body){ return apiPatch(`/propiedades/hoteles/${id}`, body); }
function apiListarTiposHabitacion(hotelId){ return apiGet(`/propiedades/hoteles/${hotelId}/tipos-habitacion`); }
function apiCrearTipoHabitacion(hotelId, body){ return apiPost(`/propiedades/hoteles/${hotelId}/tipos-habitacion`, body); }
function apiListarHabitaciones(hotelId){ return apiGet(`/propiedades/hoteles/${hotelId}/habitaciones`); }
function apiCrearHabitacion(hotelId, body){ return apiPost(`/propiedades/hoteles/${hotelId}/habitaciones`, body); }

// Reservas
function apiCrearReserva(body){ return apiPost("/reservas/reservas", body); }
function apiListarReservas(){ return apiGet("/reservas/reservas"); }
function apiMisReservas(){ return apiGet("/reservas/mis-reservas"); }
function apiCancelarReserva(id){ return apiPatch(`/reservas/reservas/${id}/cancelar`, {}); }

// Recepcion
function apiIniciarTurno(body){ return apiPost("/recepcion/recepcion/iniciar-turno", body); }
function apiCheckin(body){ return apiPost("/recepcion/recepcion/checkin", body); }
function apiCheckout(body){ return apiPost("/recepcion/recepcion/checkout", body); }
function apiLlegadas(hotelId, fecha){ return apiGet(`/recepcion/recepcion/llegadas?hotel_id=${hotelId}&fecha_checkin=${fecha}`); }

// Housekeeping
function apiListarHabitacionesLimpieza(){ return apiGet("/housekeeping/housekeeping/habitaciones"); }
function apiEstadoHabitacion(numero){ return apiGet(`/housekeeping/housekeeping/habitaciones/${numero}/estado`); }
function apiActualizarEstadoHabitacion(numero, estado){ return apiPatch(`/housekeeping/housekeeping/habitaciones/${numero}/estado`, { estado }); }

// Archivos
function apiSubirArchivo(formData){ return apiRequest("/archivos/subir", { method: "POST", body: formData }); }

// Disponibilidad
function apiConsultarDisponibilidad(tipoHabitacionId, checkin, checkout){
  return apiGet(`/disponibilidad/disponibilidad?tipo_habitacion_id=${tipoHabitacionId}&checkin=${checkin}&checkout=${checkout}`);
}

// Facturacion
function apiListarFolios(){ return apiGet("/facturacion/facturacion/folios"); }
function apiListarFacturas(){ return apiGet("/facturacion/facturacion/facturas"); }

// Fidelizacion
function apiCuentaFidelizacion(guestId){ return apiGet(`/fidelizacion/fidelizacion/cuentas/${guestId}`); }

// Analytics
function apiEjecutarETL(){ return apiPost("/analytics/analytics/etl", {}); }
function apiListarKPIs(){ return apiGet("/analytics/analytics/kpis"); }
