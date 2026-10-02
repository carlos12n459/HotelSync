/**
 * auth.js
 * Logica compartida de autenticacion: login, registro y sesion.
 */

async function iniciarSesion(email, password){
  const resp = await apiLogin(email, password);
  if(!resp.token) throw new Error("Respuesta invalida del servidor");

  guardarToken(resp.token);
  guardarUsuario(resp.usuario);
  return resp.usuario;
}

async function registrarUsuario(nombre, email, password, rol){
  const resp = await apiRegister(nombre, email, password, rol);
  if(!resp.token) throw new Error("Respuesta invalida del servidor");

  guardarToken(resp.token);
  guardarUsuario(resp.usuario);
  return resp.usuario;
}

// Verifica si el token almacenado sigue siendo valido consultando el perfil.
async function validarSesion(){
  const token = obtenerToken();
  if(!token) return null;

  try {
    const usuario = await apiPerfil();
    guardarUsuario(usuario);
    return usuario;
  } catch(error){
    eliminarToken();
    return null;
  }
}

function manejarAuthRedirect(){
  const usuario = obtenerUsuario();
  const token = obtenerToken();
  if(usuario && token){
    redirigirPorRol(usuario.rol);
  }
}
