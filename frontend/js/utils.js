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

// ---------------------------------------------------------------------------
// Renderizado visual de respuestas (reemplaza JSON crudo).
// ---------------------------------------------------------------------------

function escaparHtml(texto){
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}

function etiquetaClave(clave){
  const mapa = {
    id: "ID",
    nombre: "Nombre",
    ciudad: "Ciudad",
    pais: "País",
    direccion: "Dirección",
    activo: "Activo",
    activa: "Activa",
    estado: "Estado",
    numero: "Número",
    piso: "Piso",
    capacidad: "Capacidad",
    tarifa_base: "Tarifa base",
    amenities: "Comodidades",
    politica_cancelacion: "Política de cancelación",
    imagen_url: "Imagen",
    hotel_id: "Hotel ID",
    tipo_habitacion_id: "Tipo habitación ID",
    usuario_id: "Usuario ID",
    guest_id: "Cliente ID",
    huesped_id: "Cliente ID",
    nombre_huesped: "Nombre cliente",
    email_huesped: "Email cliente",
    fecha_checkin: "Check-in",
    fecha_checkout: "Check-out",
    monto_total: "Total",
    canal: "Canal",
    creado_en: "Creado",
    actualizado_en: "Actualizado",
    email: "Email",
    rol: "Rol",
    password_hash: "Hash"
  };
  return mapa[clave] || clave.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

function formatearValor(clave, valor){
  if(valor === null || valor === undefined) return "-";
  if(typeof valor === "boolean"){
    return valor
      ? '<span class="badge badge-ok">Sí</span>'
      : '<span class="badge">No</span>';
  }
  if(typeof valor === "string" && (clave.includes("fecha") || clave.includes("_en"))){
    return escaparHtml(formatearFecha(valor));
  }
  if(typeof valor === "number" && (clave.includes("precio") || clave.includes("tarifa") || clave.includes("monto") || clave.includes("total") || clave === "adr" || clave === "revpar")){
    return escaparHtml(formatearPrecio(valor));
  }
  if(Array.isArray(valor)){
    return valor.length === 0 ? "-" : valor.map(v => escaparHtml(v)).join(", ");
  }
  if(typeof valor === "object"){
    return escaparHtml(JSON.stringify(valor));
  }
  return escaparHtml(String(valor));
}

function esVistaTarjeta(item){
  if(!item || typeof item !== "object") return false;
  return !!(item.imagen_url || item.numero ||
    (item.nombre && (item.ciudad !== undefined || item.capacidad !== undefined || item.tarifa_base !== undefined)));
}

function tarjetaTitulo(item){
  if(item.nombre) return escaparHtml(item.nombre);
  if(item.numero) return `Habitación ${escaparHtml(item.numero)}`;
  if(item.id !== undefined) return `Registro #${escaparHtml(item.id)}`;
  return "Registro";
}

function renderCards(items){
  return `<div class="card-grid">${items.map(item => {
    const titulo = tarjetaTitulo(item);
    const img = item.imagen_url
      ? `<div class="card-img"><img src="${API_BASE}${item.imagen_url}" alt="${titulo}" onerror="this.style.display='none'"></div>`
      : "";
    const campos = Object.keys(item)
      .filter(k => k !== "imagen_url" && k !== "nombre" && k !== "id")
      .map(k => `<div class="card-text"><strong>${etiquetaClave(k)}:</strong> ${formatearValor(k, item[k])}</div>`)
      .join("");
    return `<div class="card">${img}<div class="card-body"><div class="card-title">${titulo}</div>${campos}</div></div>`;
  }).join("")}</div>`;
}

function renderTable(items){
  const keys = Object.keys(items[0]).filter(k => k !== "imagen_url");
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${keys.map(k => `<th>${etiquetaClave(k)}</th>`).join("")}</tr></thead><tbody>${items.map(item => `<tr>${keys.map(k => {
    if(k === "imagen_url" && item[k]){
      return `<td><img src="${API_BASE}${item[k]}" class="thumb" alt=""></td>`;
    }
    return `<td>${formatearValor(k, item[k])}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderKeyValue(obj){
  const entries = Object.entries(obj).filter(([_, v]) => v !== undefined);
  return `<dl class="kv-list">${entries.map(([k, v]) => {
    if(k === "imagen_url" && v){
      return `<div class="kv-row"><dt>${etiquetaClave(k)}</dt><dd><img src="${API_BASE}${v}" class="thumb" alt=""></dd></div>`;
    }
    return `<div class="kv-row"><dt>${etiquetaClave(k)}</dt><dd>${formatearValor(k, v)}</dd></div>`;
  }).join("")}</dl>`;
}

function renderList(items){
  return `<ul class="render-list">${items.map(i => `<li>${formatearValor("", i)}</li>`).join("")}</ul>`;
}

/**
 * Renderiza datos de forma visual en el contenedor indicado.
 * Detecta arrays, objetos, errores, strings, etc.
 * Opciones:
 *   - setClass: false => no cambia la clase del contenedor (util para grids principales).
 *   - emptyMessage: mensaje cuando no hay registros.
 */
function renderData(containerId, data, options = {}){
  const el = $(containerId);
  if(!el) return;
  el.classList.remove("hidden");
  if(options.setClass !== false) el.className = "result rendered";

  if(data === null || data === undefined){
    el.innerHTML = `<p class="render-empty">Sin respuesta</p>`;
    return;
  }

  if(data instanceof Error){
    renderError(containerId, data.message, options);
    return;
  }

  if(typeof data === "string"){
    el.innerHTML = `<p>${escaparHtml(data)}</p>`;
    return;
  }

  if(typeof data === "number" || typeof data === "boolean"){
    el.innerHTML = `<p>${String(data)}</p>`;
    return;
  }

  if(Array.isArray(data)){
    if(data.length === 0){
      el.innerHTML = `<p class="render-empty">${options.emptyMessage || "No hay registros."}</p>`;
      return;
    }
    const primer = data[0];
    if(primer && typeof primer === "object"){
      el.innerHTML = esVistaTarjeta(primer) ? renderCards(data) : renderTable(data);
    } else {
      el.innerHTML = renderList(data);
    }
    return;
  }

  if(typeof data === "object"){
    if(data.error){
      renderError(containerId, data.error, options);
      return;
    }
    el.innerHTML = renderKeyValue(data);
  }
}

/**
 * Muestra un mensaje de error como alerta dentro del contenedor.
 */
function renderError(containerId, mensaje, options = {}){
  const el = $(containerId);
  if(!el) return;
  el.classList.remove("hidden");
  if(options.setClass !== false) el.className = "result error";
  el.innerHTML = `<div class="alert-error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><div><strong>Error</strong><p>${escaparHtml(mensaje)}</p></div></div>`;
}

function renderLoading(containerId, mensaje = "Cargando...", options = {}){
  const el = $(containerId);
  if(!el) return;
  el.classList.remove("hidden");
  if(options.setClass !== false) el.className = "result loading";
  el.textContent = mensaje;
}

function redirigirPorRol(rol){
  switch(rol){
    case "admin": location.href = "admin/dashboard.html"; break;
    case "gerente": location.href = "gerente/dashboard.html"; break;
    case "empleado": location.href = "empleado/dashboard.html"; break;
    case "cliente":
    default: location.href = "cliente/dashboard.html"; break;
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
