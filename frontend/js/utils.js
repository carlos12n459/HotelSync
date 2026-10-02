/**
 * utils.js
 * Funciones utilitarias compartidas por todas las paginas del frontend.
 */

const API_BASE = "http://localhost:3010";

function $(id){ return document.getElementById(id); }

function guardarToken(token){
  localStorage.setItem("hotelsync_token", token);
}

function obtenerToken(){
  return localStorage.getItem("hotelsync_token");
}

function eliminarToken(){
  localStorage.removeItem("hotelsync_token");
  localStorage.removeItem("hotelsync_user");
}

function guardarUsuario(usuario){
  localStorage.setItem("hotelsync_user", JSON.stringify(usuario));
}

function obtenerUsuario(){
  try {
    return JSON.parse(localStorage.getItem("hotelsync_user"));
  } catch(e){
    return null;
  }
}

function formatearFecha(fecha){
  if(!fecha) return "";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-CO");
}

function formatearPrecio(valor){
  if(valor === undefined || valor === null) return "$0";
  return "$" + Number(valor).toLocaleString("es-CO");
}

function mostrarToast(mensaje, tipo=""){
  const toast = document.getElementById("toast");
  if(!toast) return;
  document.getElementById("toastMsg").textContent = mensaje;
  toast.className = "toast " + tipo + " show";
  setTimeout(() => toast.classList.remove("show"), 3200);
}

function setResultado(id, datos, tipo=""){
  const el = $(id);
  if(!el) return;
  el.className = "result " + tipo;
  if(datos === undefined || datos === null){
    el.textContent = "Sin respuesta";
  } else if(typeof datos === "string"){
    el.textContent = datos;
  } else {
    el.textContent = JSON.stringify(datos, null, 2);
  }
}

function redirigirPorRol(rol){
  switch(rol){
    case "admin": location.href = "admin/dashboard.html"; break;
    case "anfitrion": location.href = "anfitrion/dashboard.html"; break;
    case "empleado": location.href = "empleado/dashboard.html"; break;
    case "huesped":
    default: location.href = "huesped/dashboard.html"; break;
  }
}

function protegerRol(rolesPermitidos){
  const usuario = obtenerUsuario();
  const token = obtenerToken();
  if(!usuario || !token){
    location.href = "../login.html";
    return;
  }
  if(!rolesPermitidos.includes(usuario.rol)){
    location.href = "../login.html";
    return;
  }
}

function renderizarUsuario(){
  const usuario = obtenerUsuario();
  const el = $("userPill");
  if(el && usuario){
    el.innerHTML = `<span>${usuario.nombre}</span><span style="text-transform:uppercase;font-size:0.7rem;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:12px;">${usuario.rol}</span>`;
  }
}

function logout(){
  eliminarToken();
  location.href = "../login.html";
}

// Fechas por defecto para formularios de reserva.
function fechasPorDefecto(){
  const hoy = new Date();
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
  const pasado = new Date(hoy); pasado.setDate(pasado.getDate() + 3);
  const fmt = d => d.toISOString().split("T")[0];
  return { entrada: fmt(manana), salida: fmt(pasado) };
}

// Inicializar fechas por defecto en inputs.
function inicializarFechas(idEntrada, idSalida){
  const fechas = fechasPorDefecto();
  const e = $(idEntrada), s = $(idSalida);
  if(e) e.value = fechas.entrada;
  if(s) s.value = fechas.salida;
}

// Decodificar JWT basico para extraer payload.
function decodificarJwt(token){
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch(e){
    return null;
  }
}
