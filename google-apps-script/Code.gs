/**
 * ====================================================================================
 * BACKEND GOOGLE APPS SCRIPT - SISTEMA DE ASISTENCIA Y CONTROL DE NIÑOS
 * ====================================================================================
 * 
 * ID Hoja de Cálculo: 19XrXo04KUeNyiYnizL_ehYV_ODnnFlv3br6AlRBXjLg
 * Hoja de Datos de Niños: "Registro de NIÑOS"
 * Hoja de Asistencias: "Asistencias" (Se crea / actualiza automáticamente con soporte Multi-Turno)
 * 
 * TURNOS / REUNIONES DOMINICALES SOPORTADOS:
 * - 10:00 hs (Mañana) [Por defecto]
 * - 18:00 hs (Tarde)
 * - 20:00 hs (Noche)
 * 
 * SEGURIDAD, CREDENCIALES Y CONCURRENCIA:
 * - Tokens y propiedades privadas respaldadas en PropertiesService.getScriptProperties().
 * - Escrituras concurrentes protegidas con LockService.getScriptLock().
 * - CORS y compatibilidad JSONP / REST.
 * ====================================================================================
 */

const SPREADSHEET_ID_DEFAULT = "19XrXo04KUeNyiYnizL_ehYV_ODnnFlv3br6AlRBXjLg";
const SHEET_REGISTRO_NINOS = "Registro de NIÑOS";
const SHEET_ASISTENCIAS = "Asistencias";
const SHEET_USUARIOS = "Usuarios";
const SHEET_REGISTRO_ACCESOS = "Registro_Accesos";
const SHEET_AVISOS_WHATSAPP = "Avisos WhatsApp";
const SHEET_HISTORIAL_TELEFONOS = "Historial_Telefonos";

// LISTA DE TURNOS DOMINICALES ESTÁNDAR
const TURNOS_VALIDOS = [
  "10:00 hs (Mañana)",
  "18:00 hs (Tarde)",
  "20:00 hs (Noche)"
];
const TURNO_DEFAULT = "10:00 hs (Mañana)";

// CREDENCIALES DE ACCESO GENERAL PROTEGIDAS EN EL SERVIDOR
// Puedes configurar APP_USER, APP_PASSWORD y SPREADSHEET_ID en PropertiesService.getScriptProperties()
const ADMIN_EMAIL = "cris.ahu777@gmail.com";
const APP_PUBLIC_URL = "https://igrkids.iglesiagranrey.com";

const AUTH_CONFIG = {
  usuarioMaster: "igrkids2026",          // Usuario general por defecto
  passwordMaster: "IgrKids*2026!Seguro", // Contraseña segura generada
  nombreUsuario: "Equipo IGR KIDS",      // Nombre que se mostrará al ingresar
  rol: "Administrador / Recepción",
  sessionExpiryHours: 8760,              // Duración de la sesión activa en horas (1 año / permanente según mandato Cristian)
  secretSalt: "SECURE_KIDS_ACCESS_2026_CODE_AHUMADA"
};

/**
 * Obtiene el ID de la hoja de cálculo desde ScriptProperties o constante por defecto
 */
function getSpreadsheetId() {
  const scriptProps = PropertiesService.getScriptProperties();
  return scriptProps.getProperty("SPREADSHEET_ID") || SPREADSHEET_ID_DEFAULT;
}

/**
 * Obtiene la instancia de SpreadsheetApp activa
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(getSpreadsheetId());
}

/**
 * Endpoint GET para la aplicación web (Lectura, Login, Registro de Usuarios y Acciones)
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    let action = params.action || "";
    if (!action) {
      if (params.autorizarUsuario) action = "autorizarUsuario";
      else if (params.rechazarUsuario) action = "rechazarUsuario";
      else action = "getDatos";
    }
    let responseData = { success: false, message: "Acción no reconocida" };

    // --- ACCIÓN DE AUTENTICACIÓN / LOGIN / AUTORIZACIÓN ---
    if (action === "login") {
      responseData = autenticarUsuario(
        params.usuario, 
        params.password, 
        params.userAgent, 
        params.turno
      );
    } else if (action === "crearUsuario" || action === "registroUsuario") {
      responseData = registrarNuevoUsuario(params);
    } else if (action === "autorizarUsuario" || action === "rechazarUsuario") {
      const targetUser = params.usuario || params.autorizarUsuario || params.rechazarUsuario || "";
      responseData = procesarAutorizacionUsuario(targetUser, params.sig, action);
      if (!params.callback && params.format !== "json") {
        return crearRespuestaHTMLAutorizacion(responseData, action);
      }
    } else if (action === "verificarToken") {
      responseData = validarToken(params.token);
    } 
    // --- OBTENCIÓN DE DATOS Y ASISTENCIAS (MULTI-TURNO) ---
    else if (action === "getDatos" || action === "getNiños") {
      const fecha = params.fecha || getFechaActual();
      const turno = params.turno || TURNO_DEFAULT;
      responseData = obtenerDatosCompletos(fecha, turno);
    } else if (action === "getAsistencias") {
      const fecha = params.fecha || getFechaActual();
      const turno = params.turno || "";
      const asistencias = obtenerAsistenciasPorFecha(fecha, turno);
      responseData = {
        success: true,
        fecha: fecha,
        turno: turno || "Todos",
        totalPresentes: asistencias.length,
        asistencias: asistencias
      };
    } else if (action === "marcarAsistencia") {
      responseData = registrarAsistencia({
        idNino: params.idNino,
        nombreNino: params.nombreNino,
        nombrePapas: params.nombrePapas,
        telefono: params.telefono,
        sala: params.sala || "General",
        fecha: params.fecha || getFechaActual(),
        hora: params.hora || getHoraActual(),
        turno: params.turno || TURNO_DEFAULT,
        observaciones: params.observaciones || "",
        estado: params.estado || "Presente",
        registradoPor: params.registradoPor || "Recepción"
      });
    } else if (action === "desmarcarAsistencia") {
      responseData = eliminarAsistencia(
        params.idNino, 
        params.fecha || getFechaActual(), 
        params.turno || TURNO_DEFAULT
      );
    } else if (action === "agregarNino") {
      responseData = agregarNuevoNino(params);
    } else if (action === "registrarAvisoWhatsApp" || action === "registroWhatsApp" || action === "logWhatsApp") {
      responseData = registrarAvisoWhatsApp(params);
    } else if (action === "modificarTelefono" || action === "editarTelefono") {
      responseData = modificarTelefono(params);
    } else if (action === "getHistorialTelefonos") {
      responseData = {
        success: true,
        historial: obtenerHistorialTelefonos(params.limite)
      };
    } else if (action === "getTurnos") {
      responseData = {
        success: true,
        turnos: TURNOS_VALIDOS,
        defaultTurno: TURNO_DEFAULT
      };
    } else if (action === "ping") {
      responseData = { 
        success: true, 
        message: "Conexión exitosa con Google Apps Script (Usuarios en Sheet, Multi-Reunión y LockService activos)", 
        authRequired: true,
        turnos: TURNOS_VALIDOS,
        defaultTurno: TURNO_DEFAULT,
        timestamp: new Date().toISOString() 
      };
    }

    return crearRespuestaJSON(responseData, params.callback);
  } catch (err) {
    return crearRespuestaJSON({
      success: false,
      error: err.toString(),
      stack: err.stack
    }, e ? e.parameter.callback : null);
  }
}

/**
 * Endpoint POST para registrar asistencia, nuevos niños, login y creación de usuarios
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (ex) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "marcarAsistencia";
    let responseData = { success: false, message: "Acción no reconocida" };

    if (action === "login") {
      responseData = autenticarUsuario(
        payload.usuario, 
        payload.password, 
        payload.userAgent, 
        payload.turno
      );
    } else if (action === "crearUsuario" || action === "registroUsuario") {
      responseData = registrarNuevoUsuario(payload);
    } else if (action === "autorizarUsuario" || action === "rechazarUsuario") {
      const targetUser = payload.usuario || payload.autorizarUsuario || payload.rechazarUsuario || "";
      responseData = procesarAutorizacionUsuario(targetUser, payload.sig, action);
    } else if (action === "marcarAsistencia") {
      responseData = registrarAsistencia(payload);
    } else if (action === "desmarcarAsistencia") {
      responseData = eliminarAsistencia(
        payload.idNino, 
        payload.fecha || getFechaActual(), 
        payload.turno || TURNO_DEFAULT
      );
    } else if (action === "agregarNino") {
      responseData = agregarNuevoNino(payload);
    } else if (action === "registrarAvisoWhatsApp" || action === "registroWhatsApp" || action === "logWhatsApp") {
      responseData = registrarAvisoWhatsApp(payload);
    } else if (action === "modificarTelefono" || action === "editarTelefono") {
      responseData = modificarTelefono(payload);
    }

    return crearRespuestaJSON(responseData);
  } catch (err) {
    return crearRespuestaJSON({
      success: false,
      error: err.toString(),
      stack: err.stack
    });
  }
}

/**
 * Autentica usuario y contraseña de forma segura en el servidor
 * Consulta primero la hoja "Usuarios" y luego fallback de contingencia Master
 */
function autenticarUsuario(usuarioIngresado, passwordIngresado, userAgent, turno) {
  const user = String(usuarioIngresado || "").trim().toLowerCase();
  const pass = String(passwordIngresado || "").trim();

  if (!user || !pass) {
    return {
      success: false,
      message: "Por favor ingresa usuario y contraseña."
    };
  }

  // 1. Buscar en la hoja Usuarios de Google Sheets
  try {
    const sheet = asegurarHojaUsuarios();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const uFila = String(data[i][2] || "").trim().toLowerCase();
      const pFila = String(data[i][3] || "").trim();
      const nombreFila = String(data[i][4] || "").trim() || "Maestra/o";
      const rolFila = String(data[i][5] || "").trim() || "Maestra";
      const salaFila = String(data[i][6] || "").trim() || "Todas";
      const estadoFila = String(data[i][7] || "Activo").trim();

      if (uFila === user) {
        if (pFila === pass) {
          const estadoLower = estadoFila.toLowerCase();
          if (estadoLower === "pendiente") {
            return {
              success: false,
              pendingApproval: true,
              message: "⏳ Falta la autorización del administrador. Tu usuario ya fue creado pero aún debe ser aprobado por el administrador para poder ingresar."
            };
          }
          if (estadoLower === "inactivo" || estadoLower === "rechazado") {
            return {
              success: false,
              message: "🚫 Tu usuario se encuentra sin autorización o inactivo. Consultá con el administrador."
            };
          }

          // Actualizar último acceso (Columna I / índice 9)
          try {
            sheet.getRange(i + 1, 9).setValue(new Date());
          } catch (e) {}

          // Registrar en auditoría de accesos
          registrarLogAcceso(user, nombreFila, rolFila, userAgent, turno, "Inicio de Sesión");

          const expiresAt = new Date(Date.now() + AUTH_CONFIG.sessionExpiryHours * 60 * 60 * 1000).toISOString();
          const token = generarTokenSesion(user, expiresAt);

          return {
            success: true,
            message: "Autenticación exitosa",
            token: token,
            expiresAt: expiresAt,
            user: {
              usuario: user,
              nombre: nombreFila,
              rol: rolFila,
              sala: salaFila
            }
          };
        } else {
          return { success: false, message: "Contraseña incorrecta. Verifica los datos e intenta nuevamente." };
        }
      }
    }
  } catch (err) {
    console.warn("Error leyendo hoja Usuarios:", err);
  }

  // 2. Fallback con credenciales maestras
  const scriptProps = PropertiesService.getScriptProperties();
  const userEsperado = scriptProps.getProperty("APP_USER") || AUTH_CONFIG.usuarioMaster;
  const passEsperada = scriptProps.getProperty("APP_PASSWORD") || AUTH_CONFIG.passwordMaster;

  if (user === userEsperado.toLowerCase() && pass === passEsperada) {
    registrarLogAcceso(userEsperado, AUTH_CONFIG.nombreUsuario, AUTH_CONFIG.rol, userAgent, turno, "Inicio de Sesión (Master)");

    const expiresAt = new Date(Date.now() + AUTH_CONFIG.sessionExpiryHours * 60 * 60 * 1000).toISOString();
    const token = generarTokenSesion(user, expiresAt);

    return {
      success: true,
      message: "Autenticación exitosa",
      token: token,
      expiresAt: expiresAt,
      user: {
        usuario: userEsperado,
        nombre: AUTH_CONFIG.nombreUsuario,
        rol: AUTH_CONFIG.rol,
        sala: "Todas"
      }
    };
  }

  return {
    success: false,
    message: "Usuario o contraseña incorrectos. Verifica los datos e intenta nuevamente."
  };
}

/**
 * Genera una firma criptográfica determinística (SHA-256) para autorizar o rechazar un usuario por link
 */
function generarFirmaAutorizacion(usuario) {
  const userClean = String(usuario || "").trim().toLowerCase();
  const raw = userClean + "|APPROVE_USER|" + AUTH_CONFIG.secretSalt;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return Utilities.base64EncodeWebSafe(digest).replace(/[^a-zA-Z0-9]/g, "").substring(0, 20);
}

/**
 * Procesa la autorización o rechazo de un usuario mediante link firmado del administrador
 */
function procesarAutorizacionUsuario(usuario, sig, accion) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    return { success: false, message: "El servidor está ocupado. Intentá de nuevo en unos segundos." };
  }

  try {
    const usuarioLimpio = String(usuario || "").trim().toLowerCase();
    const firmaRecibida = String(sig || "").trim();

    if (!usuarioLimpio || !firmaRecibida) {
      return { success: false, message: "Parámetros de autorización incompletos." };
    }

    const firmaEsperada = generarFirmaAutorizacion(usuarioLimpio);
    if (firmaRecibida !== firmaEsperada) {
      return { success: false, message: "Firma de autorización inválida." };
    }

    const sheet = asegurarHojaUsuarios();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const uFila = String(data[i][2] || "").trim().toLowerCase();
      if (uFila === usuarioLimpio) {
        const nombreFila = String(data[i][4] || "").trim() || usuarioLimpio;
        const rolFila = String(data[i][5] || "").trim() || "Maestro";
        const salaFila = String(data[i][6] || "").trim() || "General";

        const esAutorizar = (accion === "autorizarUsuario");
        const nuevoEstado = esAutorizar ? "Activo" : "Rechazado";

        sheet.getRange(i + 1, 8).setValue(nuevoEstado);
        SpreadsheetApp.flush();

        registrarLogAcceso(
          uFila,
          nombreFila,
          rolFila,
          "Admin Approval Link",
          TURNO_DEFAULT,
          esAutorizar ? "Usuario Autorizado por Admin" : "Usuario Rechazado por Admin"
        );

        return {
          success: true,
          estado: nuevoEstado,
          usuario: uFila,
          nombre: nombreFila,
          rol: rolFila,
          sala: salaFila,
          message: esAutorizar
            ? "✅ El usuario @" + uFila + " (" + nombreFila + ") fue AUTORIZADO exitosamente y ya puede ingresar al sistema."
            : "🚫 El usuario @" + uFila + " (" + nombreFila + ") fue RECHAZADO y no podrá ingresar al sistema."
        };
      }
    }

    return {
      success: false,
      message: "No se encontró el usuario @" + usuarioLimpio + " en la base de datos."
    };
  } catch (err) {
    return {
      success: false,
      message: "Error al procesar la autorización: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Genera una tarjeta HTML cuando el administrador abre el enlace directamente en el navegador
 */
function crearRespuestaHTMLAutorizacion(res, accion) {
  const esExito = !!res.success;
  const esAutorizado = res.estado === "Activo" || accion === "autorizarUsuario";
  const colorHeader = !esExito ? "#DC2626" : (esAutorizado ? "#059669" : "#D97706");
  const icono = !esExito ? "⚠️" : (esAutorizado ? "✅" : "🚫");
  const titulo = !esExito
    ? "No se pudo completar la acción"
    : (esAutorizado ? "¡Usuario Autorizado con Éxito!" : "Solicitud de Usuario Rechazada");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Control de Acceso — IGR KIDS</title>
  <style>
    body { margin: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
    .card { max-width: 460px; width: 100%; background: #1e293b; border-radius: 20px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center; }
    .banner { background: ${colorHeader}; padding: 28px 20px; }
    .icon { font-size: 48px; margin-bottom: 8px; }
    h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; }
    .content { padding: 28px 24px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px; }
    .badge { display: inline-block; padding: 8px 16px; border-radius: 999px; font-weight: 700; font-size: 13px; background: #0f172a; color: #38bdf8; border: 1px solid #334155; margin-bottom: 24px; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; padding: 14px 20px; background: linear-gradient(135deg, #ca8a04, #eab308); color: #0f172a; font-weight: 800; text-decoration: none; border-radius: 12px; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="banner">
      <div class="icon">${icono}</div>
      <h1>${titulo}</h1>
    </div>
    <div class="content">
      ${res.usuario ? `<div class="badge">@${res.usuario} · ${res.rol || "Maestro"} (${res.sala || "General"})</div>` : ""}
      <p>${res.message || ""}</p>
      <a href="${APP_PUBLIC_URL}" class="btn">Ir a IGR KIDS</a>
    </div>
  </div>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setTitle("Autorización de Usuario — IGR KIDS");
}

/**
 * Genera un token firmado con expiración
 */
function generarTokenSesion(usuario, expiresAt) {
  const payloadStr = usuario + "|" + expiresAt + "|" + AUTH_CONFIG.secretSalt;
  const signature = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payloadStr));
  const tokenData = {
    u: usuario,
    exp: expiresAt,
    sig: signature.substring(0, 24)
  };
  return Utilities.base64Encode(JSON.stringify(tokenData));
}

/**
 * Valida si un token es auténtico y no ha expirado
 */
function validarToken(token) {
  if (!token) return { success: false, message: "Token requerido" };

  try {
    const decodedStr = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const tokenData = JSON.parse(decodedStr);

    const now = new Date().toISOString();
    if (tokenData.exp < now) {
      return { success: false, message: "La sesión ha expirado. Por favor ingresa de nuevo." };
    }

    // Verificar firma
    const payloadStr = tokenData.u + "|" + tokenData.exp + "|" + AUTH_CONFIG.secretSalt;
    const signatureEsperada = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payloadStr)).substring(0, 24);

    if (tokenData.sig === signatureEsperada) {
      return {
        success: true,
        user: {
          usuario: tokenData.u,
          nombre: AUTH_CONFIG.nombreUsuario,
          rol: AUTH_CONFIG.rol
        }
      };
    } else {
      return { success: false, message: "Token no válido o alterado." };
    }
  } catch (e) {
    return { success: false, message: "Error al validar la sesión." };
  }
}

// ----------------------------------------------------
// GESTIÓN DE DATOS Y ASISTENCIAS (MULTI-TURNO & LOCKSERVICE)
// ----------------------------------------------------

/**
 * Crea la respuesta en formato JSON con soporte para CORS y JSONP
 */
function crearRespuestaJSON(data, callback) {
  const jsonString = JSON.stringify(data);
  let output;

  if (callback) {
    output = ContentService.createTextOutput(callback + "(" + jsonString + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output = ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);
  }

  return output;
}

/**
 * Obtiene la lista de todos los niños del Registro + Asistencias filtradas por Fecha y Turno
 */
function obtenerDatosCompletos(fecha, turno) {
  const fechaConsulta = normalizarFecha(fecha || getFechaActual());
  const turnoConsulta = normalizarTurno(turno || TURNO_DEFAULT);
  const ninos = obtenerTodosLosNinos();
  const asistencias = obtenerAsistenciasPorFecha(fechaConsulta, turnoConsulta);

  // 1. Indexar niños actuales por ID para búsqueda rápida
  const mapaNinosPorId = {};
  ninos.forEach(nino => {
    mapaNinosPorId[nino.id] = nino;
  });

  const mapaAsistenciasFinal = {};
  const asistenciasPendientes = [];

  // 2. Emparejamiento directo por ID (solo si el niño con ese ID exacto existe en el padrón actual)
  asistencias.forEach(a => {
    if (a.idNino && mapaNinosPorId[a.idNino]) {
      mapaAsistenciasFinal[a.idNino] = a;
    } else {
      // ID provisorio (NINO_NEW_) o fila corrida por inserción de datos en Sheets
      asistenciasPendientes.push(a);
    }
  });

  // 3. Emparejar asistencias pendientes de forma resiliente a corrimiento de filas
  let huboCorreccionEnHoja = false;
  let sheetAsis = null;

  asistenciasPendientes.forEach(a => {
    const nomSanA = sanitizarId(a.nombreNino);
    const telA = normalizarTelefono(a.telefono);
    const primerNombreA = nomSanA.split("_")[0];

    // Extraer slug y fila anterior del idNino si venía en formato NINO_R..._S..._slug
    let slugA = "";
    let filaAnterior = 0;
    if (a.idNino) {
      const matchSlug = String(a.idNino).match(/^NINO_R\d+_S\d+_(.+)$/);
      if (matchSlug) slugA = matchSlug[1];
      const matchFila = String(a.idNino).match(/^NINO_R(\d+)_/);
      if (matchFila) filaAnterior = parseInt(matchFila[1], 10);
    }

    // Buscar candidatos no asignados todavía
    const candidatos = ninos.filter(n => {
      if (mapaAsistenciasFinal[n.id]) return false;
      const nomSanN = sanitizarId(n.nombre);
      const telN = normalizarTelefono(n.telefono);
      const primerNombreN = nomSanN.split("_")[0];

      // 1. Coincidencia por slug del ID anterior (resiliente a corrimiento de filas)
      if (slugA && nomSanN === slugA) return true;
      // 2. Coincidencia exacta por nombre sanitizado
      if (nomSanN === nomSanA) return true;
      // 3. Coincidencia por teléfono idéntico + primer nombre idéntico (ej: "Xiomara" vs "Xiomara Otranto")
      if (telA && telN && telA === telN && primerNombreA === primerNombreN) return true;
      // 4. Coincidencia si el nombre del niño empieza por el nombre registrado
      if (primerNombreA && nomSanN.startsWith(nomSanA)) return true;
      return false;
    });

    if (candidatos.length > 0) {
      // Priorizar candidatos con teléfono coincidente y cercanía a la fila anterior
      candidatos.sort((x, y) => {
        const telXMatch = (telA && normalizarTelefono(x.telefono) === telA) ? 0 : 1;
        const telYMatch = (telA && normalizarTelefono(y.telefono) === telA) ? 0 : 1;
        if (telXMatch !== telYMatch) return telXMatch - telYMatch;

        if (filaAnterior > 0) {
          const distX = Math.abs((x.filaOriginal || 0) - filaAnterior);
          const distY = Math.abs((y.filaOriginal || 0) - filaAnterior);
          return distX - distY;
        }
        return (y.filaOriginal || 0) - (x.filaOriginal || 0);
      });

      const elegido = candidatos[0];
      mapaAsistenciasFinal[elegido.id] = a;

      // Actualizar en caliente la celda en la hoja Asistencias para que quede sanado en la BD
      if (a.filaAsistencia && a.filaAsistencia > 1) {
        try {
          if (!sheetAsis) sheetAsis = asegurarHojaAsistencias();
          sheetAsis.getRange(a.filaAsistencia, 4).setValue(elegido.id);
          huboCorreccionEnHoja = true;
        } catch (e) {
          // No interrumpir lectura si falla la auto-curación de celda
        }
      }
    }
  });

  if (huboCorreccionEnHoja) {
    try {
      SpreadsheetApp.flush();
    } catch (e) {}
  }

  const ninosConEstado = ninos.map(nino => {
    const asis = mapaAsistenciasFinal[nino.id];
    return {
      ...nino,
      presente: !!asis,
      horaIngreso: asis ? asis.hora : null,
      salaActual: asis ? asis.sala : nino.salaSugerida,
      observacionesIngreso: asis ? asis.observaciones : "",
      estadoAsistencia: asis ? asis.estado : "Ausente",
      turno: turnoConsulta
    };
  });

  // 4. Estadísticas automáticas para el Reporte de WhatsApp del día
  const todasAsistenciasDia = obtenerAsistenciasPorFecha(fechaConsulta, "Todos");
  let manana = 0;
  let tarde = 0;
  let noche = 0;
  const setNinosUnicos = {};

  todasAsistenciasDia.forEach(a => {
    const tNorm = normalizarTurno(a.turno);
    if (tNorm === "10:00 hs (Mañana)") manana++;
    else if (tNorm === "18:00 hs (Tarde)") tarde++;
    else if (tNorm === "20:00 hs (Noche)") noche++;

    const claveUnica = a.idNino || sanitizarId(a.nombreNino);
    if (claveUnica) setNinosUnicos[claveUnica] = true;
  });

  const totalGeneral = manana + tarde + noche;
  const ninosUnicosDia = Object.keys(setNinosUnicos).length;

  const ninosNuevosHoy = ninosConEstado
    .filter(n => n.fechaRegistro === fechaConsulta)
    .map(n => ({
      id: n.id,
      nombre: n.nombre,
      sala: n.salaActual || n.salaSugerida,
      presente: !!mapaAsistenciasFinal[n.id]
    }));

  const avisosWhatsAppHoy = obtenerAvisosWhatsAppPorFechaYTurno(fechaConsulta, turnoConsulta);

  return {
    success: true,
    fecha: fechaConsulta,
    turno: turnoConsulta,
    turnosDisponibles: TURNOS_VALIDOS,
    totalNinos: ninos.length,
    totalPresentes: asistencias.length,
    ninos: ninosConEstado,
    asistenciasHoy: asistencias,
    conteoReuniones: {
      manana: manana,
      tarde: tarde,
      noche: noche,
      totalGeneral: totalGeneral,
      ninosUnicosDia: ninosUnicosDia
    },
    avisosWhatsAppHoy: avisosWhatsAppHoy,
    ninosNuevosHoy: ninosNuevosHoy
  };
}

/**
 * Lee la hoja "Registro de NIÑOS" y extrae individualmente a cada niño
 */
function obtenerTodosLosNinos() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_REGISTRO_NINOS);
  if (!sheet) {
    throw new Error("No se encontró la hoja: " + SHEET_REGISTRO_NINOS);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const listaNinos = [];

  const slotsNinos = [
    { colNombre: 1, colEdad: 2, colExtra: 3, slot: 1 },
    { colNombre: 4, colEdad: 5, colExtra: 6, slot: 2 },
    { colNombre: 7, colEdad: 8, colExtra: 9, slot: 3 },
    { colNombre: 10, colEdad: 11, colExtra: 12, slot: 4 }
  ];

  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    const fechaRegistroFila = fila[0] ? normalizarFecha(fila[0]) : "";
    const nombrePapas = String(fila[13] || fila[14] || "").trim();
    const telefono = String(fila[15] || fila[16] || "").trim();
    const notasGenerales = String(fila[16] || fila[17] || "").trim();

    slotsNinos.forEach(slot => {
      const nombreNino = String(fila[slot.colNombre] || "").trim();
      if (esNombreNinoValido(nombreNino)) {
        const edadRaw = fila[slot.colEdad];
        const edadDetalle = formatearEdadBackend(edadRaw);
        const alergiaLimpia = limpiarAlergiaBackend(fila[slot.colExtra]);

        let salaSugerida = determinarSala(edadDetalle, alergiaLimpia);
        const idUnico = "NINO_R" + (i + 1) + "_S" + slot.slot + "_" + sanitizarId(nombreNino);

        listaNinos.push({
          id: idUnico,
          filaOriginal: i + 1,
          slot: slot.slot,
          nombre: nombreNino,
          edad: edadDetalle,
          salaSugerida: salaSugerida,
          nombrePapas: nombrePapas || "No especificado",
          telefono: normalizarTelefono(telefono),
          telefonoRaw: telefono,
          observacionesMedicas: alergiaLimpia,
          extra: alergiaLimpia,
          personasAutorizadas: notasGenerales,
          fechaRegistro: fechaRegistroFila
        });
      }
    });
  }

  listaNinos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return listaNinos;
}

/**
 * Obtiene las asistencias para una fecha específica (YYYY-MM-DD) y opcionalmente un turno
 */
function obtenerAsistenciasPorFecha(fecha, turno) {
  const sheetAsis = asegurarHojaAsistencias();
  const data = sheetAsis.getDataRange().getValues();
  if (data.length <= 1) return [];

  const asistencias = [];
  const fechaBuscada = normalizarFecha(fecha);
  const turnoBuscado = (turno && String(turno).trim() !== "" && String(turno).toLowerCase() !== "todos") 
    ? normalizarTurno(turno) 
    : null;

  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    const fechaFila = normalizarFecha(fila[1]);
    const turnoFila = fila.length > 11 && fila[11] ? normalizarTurno(fila[11]) : TURNO_DEFAULT;
    
    const matchFecha = (fechaFila === fechaBuscada);
    const matchTurno = !turnoBuscado || (turnoFila === turnoBuscado);

    if (matchFecha && matchTurno) {
      asistencias.push({
        filaAsistencia: i + 1,
        idAsistencia: String(fila[0] || ""),
        fecha: fechaFila,
        hora: formatearHoraBackend(fila[2]),
        idNino: String(fila[3] || ""),
        nombreNino: String(fila[4] || ""),
        nombrePapas: String(fila[5] || ""),
        telefono: String(fila[6] || ""),
        sala: String(fila[7] || "General"),
        estado: String(fila[8] || "Presente"),
        observaciones: String(fila[9] || ""),
        registradoPor: String(fila[10] || "Recepción"),
        turno: turnoFila
      });
    }
  }

  return asistencias;
}

/**
 * Registra o actualiza la asistencia de un niño con soporte Multi-Turno y LockService
 */
function registrarAsistencia(datos) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000); // Esperar hasta 30 segundos
  if (!hasLock) {
    return { 
      success: false, 
      message: "El servidor está ocupado procesando otra solicitud. Por favor intenta nuevamente en unos segundos." 
    };
  }

  try {
    const sheetAsis = asegurarHojaAsistencias();
    const fecha = normalizarFecha(datos.fecha || getFechaActual());
    const hora = formatearHoraBackend(datos.hora || getHoraActual());
    const turno = normalizarTurno(datos.turno || TURNO_DEFAULT);
    let idNino = String(datos.idNino || "").trim();
    const nombreNino = String(datos.nombreNino || "").trim();
    const nombrePapas = String(datos.nombrePapas || "").trim();
    const telefono = String(datos.telefono || "").trim();
    const sala = String(datos.sala || "General").trim();
    const estado = String(datos.estado || "Presente").trim();
    const observaciones = String(datos.observaciones || "").trim();
    const registradoPor = String(datos.registradoPor || "Recepción").trim();

    if (!nombreNino && !idNino) {
      return { success: false, message: "El nombre o ID del niño es requerido" };
    }

    // Resolver ID definitivo si es temporal (NINO_NEW_) o si sólo vino el nombre
    if ((!idNino || idNino.startsWith("NINO_NEW_")) && nombreNino) {
      try {
        const todosNinos = obtenerTodosLosNinos();
        const nomSan = sanitizarId(nombreNino);
        const telNorm = normalizarTelefono(telefono);
        const primerNom = nomSan.split("_")[0];

        const coincidente = todosNinos.slice().reverse().find(n => {
          const nSan = sanitizarId(n.nombre);
          const nTel = normalizarTelefono(n.telefono);
          if (nSan === nomSan) return true;
          if (telNorm && nTel === telNorm && nSan.startsWith(primerNom)) return true;
          if (primerNom && nSan.startsWith(nomSan)) return true;
          return false;
        });

        if (coincidente && coincidente.id) {
          idNino = coincidente.id;
        }
      } catch (errResolveId) {
        // Fallback: mantener idNino provisto
      }
    }

    const data = sheetAsis.getDataRange().getValues();
    let filaExistente = -1;

    for (let i = 1; i < data.length; i++) {
      const fechaFila = normalizarFecha(data[i][1]);
      const idFila = String(data[i][3] || "");
      const nombreFila = String(data[i][4] || "");
      const turnoFila = data[i].length > 11 && data[i][11] ? normalizarTurno(data[i][11]) : TURNO_DEFAULT;

      const coincideFecha = (fechaFila === fecha);
      const coincideTurno = (turnoFila === turno);
      const coincideNino = (idNino && idFila === idNino) || (!idNino && nombreFila.toLowerCase() === nombreNino.toLowerCase());

      if (coincideFecha && coincideTurno && coincideNino) {
        filaExistente = i + 1;
        break;
      }
    }

    const turnoClean = sanitizarId(turno);
    const idIdentificador = idNino || sanitizarId(nombreNino);
    const idAsistencia = "ASIS_" + fecha.replace(/-/g, "") + "_" + turnoClean + "_" + idIdentificador;

    if (filaExistente > 0) {
      // Actualizar registro existente para esa MISMA fecha Y ESE MISMO turno (Upsert)
      sheetAsis.getRange(filaExistente, 1).setValue(sanitizarFormula(idAsistencia));
      sheetAsis.getRange(filaExistente, 3).setValue(sanitizarFormula(hora));
      if (nombrePapas) sheetAsis.getRange(filaExistente, 6).setValue(sanitizarFormula(nombrePapas));
      if (telefono) sheetAsis.getRange(filaExistente, 7).setValue(sanitizarFormula(telefono));
      sheetAsis.getRange(filaExistente, 8).setValue(sanitizarFormula(sala));
      sheetAsis.getRange(filaExistente, 9).setValue(sanitizarFormula(estado));
      sheetAsis.getRange(filaExistente, 10).setValue(sanitizarFormula(observaciones));
      sheetAsis.getRange(filaExistente, 11).setValue(sanitizarFormula(registradoPor));
      sheetAsis.getRange(filaExistente, 12).setValue(sanitizarFormula(turno));

      SpreadsheetApp.flush();

      return {
        success: true,
        action: "actualizado",
        message: `Asistencia actualizada para ${nombreNino} (${turno})`,
        asistencia: {
          idAsistencia,
          fecha,
          hora,
          turno,
          idNino,
          nombreNino,
          sala,
          estado,
          observaciones,
          registradoPor
        }
      };
    } else {
      // Insertar nuevo registro con la columna de Turno
      sheetAsis.appendRow([
        sanitizarFormula(idAsistencia),  // Col 1 (A): ID Asistencia
        sanitizarFormula(fecha),         // Col 2 (B): Fecha
        sanitizarFormula(hora),          // Col 3 (C): Hora Ingreso
        sanitizarFormula(idNino),        // Col 4 (D): ID Niño
        sanitizarFormula(nombreNino),    // Col 5 (E): Nombre Niño
        sanitizarFormula(nombrePapas),   // Col 6 (F): Papás
        sanitizarFormula(telefono),      // Col 7 (G): Teléfono
        sanitizarFormula(sala),          // Col 8 (H): Sala / Grupo
        sanitizarFormula(estado),        // Col 9 (I): Estado
        sanitizarFormula(observaciones), // Col 10 (J): Observaciones
        sanitizarFormula(registradoPor), // Col 11 (K): Registrado Por
        sanitizarFormula(turno)          // Col 12 (L): Turno / Reunión
      ]);

      SpreadsheetApp.flush();

      return {
        success: true,
        action: "creado",
        message: `Asistencia registrada para ${nombreNino} (${turno})`,
        asistencia: {
          idAsistencia,
          fecha,
          hora,
          turno,
          idNino,
          nombreNino,
          sala,
          estado,
          observaciones,
          registradoPor
        }
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err.toString(),
      stack: err.stack
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina la asistencia de un niño únicamente para una fecha Y un turno específicos (con LockService)
 */
function eliminarAsistencia(idNino, fecha, turno) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    return { 
      success: false, 
      message: "El servidor está ocupado. Por favor intenta nuevamente en unos segundos." 
    };
  }

  try {
    const sheetAsis = asegurarHojaAsistencias();
    const fechaBuscada = normalizarFecha(fecha || getFechaActual());
    const turnoBuscado = normalizarTurno(turno || TURNO_DEFAULT);
    const idBuscado = String(idNino || "").trim();
    const data = sheetAsis.getDataRange().getValues();

    for (let i = data.length - 1; i >= 1; i--) {
      const fechaFila = normalizarFecha(data[i][1]);
      const idFila = String(data[i][3] || "");
      const turnoFila = data[i].length > 11 && data[i][11] ? normalizarTurno(data[i][11]) : TURNO_DEFAULT;

      if (fechaFila === fechaBuscada && idFila === idBuscado && turnoFila === turnoBuscado) {
        sheetAsis.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { 
          success: true, 
          message: `Asistencia desmarcada correctamente para el turno ${turnoBuscado}`, 
          idNino: idBuscado,
          fecha: fechaBuscada,
          turno: turnoBuscado
        };
      }
    }

    return { 
      success: false, 
      message: `No se encontró el registro para desmarcar en fecha ${fechaBuscada} y turno ${turnoBuscado}` 
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString(),
      stack: err.stack
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Agrega un nuevo niño / familia a la hoja principal "Registro de NIÑOS" (con LockService)
 */
function agregarNuevoNino(datos) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    return { 
      success: false, 
      message: "El servidor está ocupado. Por favor intenta nuevamente en unos segundos." 
    };
  }

  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_REGISTRO_NINOS);
    if (!sheet) throw new Error("No se encontró la hoja: " + SHEET_REGISTRO_NINOS);

    const timestamp = new Date();
    const nombreNino1 = String(datos.nombreNino || "").trim();
    const edadNino1 = String(datos.edadNino || "").trim();
    const salaNino1 = String(datos.salaNino || "").trim();
    const observaciones1 = String(datos.observaciones || "").trim();

    const nombreNino2 = String(datos.nombreNino2 || "").trim();
    const edadNino2 = String(datos.edadNino2 || "").trim();
    const salaNino2 = String(datos.salaNino2 || "").trim();
    const observaciones2 = String(datos.observaciones2 || "").trim();

    const nombreNino3 = String(datos.nombreNino3 || "").trim();
    const edadNino3 = String(datos.edadNino3 || "").trim();
    const salaNino3 = String(datos.salaNino3 || "").trim();
    const observaciones3 = String(datos.observaciones3 || "").trim();

    const nombreNino4 = String(datos.nombreNino4 || "").trim();
    const edadNino4 = String(datos.edadNino4 || "").trim();
    const salaNino4 = String(datos.salaNino4 || "").trim();
    const observaciones4 = String(datos.observaciones4 || "").trim();

    const nombrePapas = String(datos.nombrePapas || "").trim();
    const telefono = String(datos.telefono || "").trim();
    const personasAutorizadas = String(datos.personasAutorizadas || "").trim();

    if (!nombreNino1) {
      return { success: false, message: "El nombre del niño es requerido" };
    }

    const nuevaFila = [
      timestamp,                             // Col A (0): Timestamp
      sanitizarFormula(nombreNino1),         // Col B (1): Nombre Niño 1
      sanitizarFormula(edadNino1),           // Col C (2): Edad 1
      sanitizarFormula(observaciones1),      // Col D (3): Alergias / Observaciones Médicas Niño 1
      sanitizarFormula(nombreNino2),         // Col E (4): Niño 2
      sanitizarFormula(edadNino2),           // Col F (5): Edad 2
      sanitizarFormula(observaciones2),      // Col G (6): Alergias Niño 2
      sanitizarFormula(nombreNino3),         // Col H (7): Niño 3
      sanitizarFormula(edadNino3),           // Col I (8): Edad 3
      sanitizarFormula(observaciones3),      // Col J (9): Alergias Niño 3
      sanitizarFormula(nombreNino4),         // Col K (10): Niño 4
      sanitizarFormula(edadNino4),           // Col L (11): Edad 4
      sanitizarFormula(observaciones4),      // Col M (12): Alergias Niño 4
      sanitizarFormula(nombrePapas),         // Col N (13): Papás
      "",                                    // Col O (14): Mail/Otro
      sanitizarFormula(telefono),            // Col P (15): Teléfono
      sanitizarFormula(personasAutorizadas)  // Col Q (16): Personas autorizadas a retirar
    ];

    sheet.appendRow(nuevaFila);
    SpreadsheetApp.flush();

    const ninosAgregados = [{
      nombre: nombreNino1,
      edad: edadNino1,
      sala: salaNino1,
      nombrePapas: nombrePapas,
      telefono: telefono,
      observacionesMedicas: limpiarAlergiaBackend(observaciones1),
      extra: limpiarAlergiaBackend(observaciones1),
      fechaRegistro: getFechaActual()
    }];

    if (nombreNino2) {
      ninosAgregados.push({
        nombre: nombreNino2,
        edad: edadNino2,
        sala: salaNino2,
        nombrePapas: nombrePapas,
        telefono: telefono,
        observacionesMedicas: limpiarAlergiaBackend(observaciones2),
        extra: limpiarAlergiaBackend(observaciones2),
        fechaRegistro: getFechaActual()
      });
    }

    if (nombreNino3) {
      ninosAgregados.push({
        nombre: nombreNino3,
        edad: edadNino3,
        sala: salaNino3,
        nombrePapas: nombrePapas,
        telefono: telefono,
        observacionesMedicas: limpiarAlergiaBackend(observaciones3),
        extra: limpiarAlergiaBackend(observaciones3),
        fechaRegistro: getFechaActual()
      });
    }

    if (nombreNino4) {
      ninosAgregados.push({
        nombre: nombreNino4,
        edad: edadNino4,
        sala: salaNino4,
        nombrePapas: nombrePapas,
        telefono: telefono,
        observacionesMedicas: limpiarAlergiaBackend(observaciones4),
        extra: limpiarAlergiaBackend(observaciones4),
        fechaRegistro: getFechaActual()
      });
    }

    return {
      success: true,
      message: ninosAgregados.length > 1
        ? `${ninosAgregados.length} hermanitos agregados exitosamente al registro`
        : `Niño ${nombreNino1} agregado exitosamente al registro`,
      ninos: ninosAgregados,
      nuevoNino: ninosAgregados[0]
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString(),
      stack: err.stack
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Asegura que exista la hoja de Asistencias con sus encabezados (incluyendo Columna L: Turno / Reunión)
 */
function asegurarHojaAsistencias() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ASISTENCIAS);

  const headers = [
    "ID Asistencia",
    "Fecha (AAAA-MM-DD)",
    "Hora Ingreso",
    "ID Niño",
    "Nombre Niño",
    "Nombre Padres",
    "Teléfono Contacto",
    "Sala / Grupo",
    "Estado",
    "Observaciones",
    "Registrado Por",
    "Turno / Reunión"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ASISTENCIAS);
    sheet.appendRow(headers);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#CA8A04").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  } else {
    // Si la hoja ya existe, verificar si tiene la columna L de Turno
    const lastCol = sheet.getLastColumn();
    if (lastCol < 12) {
      const headerCell = sheet.getRange(1, 12);
      headerCell.setValue("Turno / Reunión");
      headerCell.setFontWeight("bold").setBackground("#CA8A04").setFontColor("#FFFFFF");
    }
  }

  return sheet;
}

/**
 * Asegura la existencia de la hoja Usuarios con credenciales seguras
 */
function asegurarHojaUsuarios() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_USUARIOS);

  const headers = [
    "ID Usuario",
    "Fecha Registro",
    "Usuario",
    "Contraseña",
    "Nombre Completo",
    "Rol",
    "Sala Asignada",
    "Estado",
    "Último Acceso"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USUARIOS);
    sheet.appendRow(headers);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#CA8A04").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);

    // Usuario Master inicial por defecto
    const rowMaster = [
      "USR_MASTER",
      new Date(),
      AUTH_CONFIG.usuarioMaster.toLowerCase(),
      AUTH_CONFIG.passwordMaster,
      AUTH_CONFIG.nombreUsuario,
      AUTH_CONFIG.rol,
      "Todas",
      "Activo",
      ""
    ];
    sheet.appendRow(rowMaster);
  }

  return sheet;
}

/**
 * Asegura la existencia de la hoja Registro_Accesos para logs de auditoría
 */
function asegurarHojaAccesos() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_REGISTRO_ACCESOS);

  const headers = [
    "Timestamp",
    "Fecha (AAAA-MM-DD)",
    "Hora",
    "Usuario",
    "Nombre Completo",
    "Rol",
    "Dispositivo / Navegador",
    "Turno",
    "Acción"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_REGISTRO_ACCESOS);
    sheet.appendRow(headers);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#CA8A04").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Registra un evento de acceso / auditoría en la hoja Registro_Accesos
 */
function registrarLogAcceso(usuario, nombre, rol, userAgent, turno, accion) {
  try {
    const sheet = asegurarHojaAccesos();
    const fila = [
      new Date(),
      getFechaActual(),
      getHoraActual(),
      sanitizarFormula(String(usuario || "").trim()),
      sanitizarFormula(String(nombre || "").trim()),
      sanitizarFormula(String(rol || "").trim()),
      sanitizarFormula(String(userAgent || "Web App").substring(0, 150)),
      sanitizarFormula(normalizarTurno(turno || TURNO_DEFAULT)),
      sanitizarFormula(String(accion || "Inicio de Sesión"))
    ];
    sheet.appendRow(fila);
  } catch (err) {
    console.warn("No se pudo registrar log de acceso:", err);
  }
}

/**
 * Asegura la existencia de la hoja Avisos WhatsApp con sus encabezados y formato visual
 */
function asegurarHojaAvisosWhatsApp() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_AVISOS_WHATSAPP);

  const headers = [
    "Timestamp",
    "Fecha",
    "Hora",
    "Turno",
    "Maestro / Usuario",
    "ID Niño",
    "Niño / Niña",
    "Sala",
    "Padres / Familia",
    "Teléfono Destino",
    "Motivo del Aviso",
    "Mensaje Enviado"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_AVISOS_WHATSAPP);
    sheet.appendRow(headers);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#059669").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Obtiene los avisos de WhatsApp enviados a padres para una fecha y turno determinados
 */
function obtenerAvisosWhatsAppPorFechaYTurno(fecha, turno) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_AVISOS_WHATSAPP);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const fechaBuscada = normalizarFecha(fecha || getFechaActual());
    const turnoBuscado = (turno && String(turno).trim() !== "" && String(turno).toLowerCase() !== "todos")
      ? normalizarTurno(turno)
      : null;

    const avisos = [];
    for (let i = 1; i < data.length; i++) {
      const fila = data[i];
      const fechaFila = normalizarFecha(fila[1]);
      const turnoFila = normalizarTurno(fila[3]);

      const matchFecha = (fechaFila === fechaBuscada);
      const matchTurno = !turnoBuscado || (turnoFila === turnoBuscado);

      if (matchFecha && matchTurno) {
        avisos.push({
          hora: formatearHoraBackend(fila[2]),
          turno: String(fila[3] || ""),
          maestro: String(fila[4] || ""),
          idNino: String(fila[5] || ""),
          nombreNino: String(fila[6] || ""),
          sala: String(fila[7] || ""),
          nombrePapas: String(fila[8] || ""),
          motivo: String(fila[10] || "")
        });
      }
    }

    return avisos;
  } catch (err) {
    console.warn("Error leyendo hoja Avisos WhatsApp:", err);
    return [];
  }
}

/**
 * Registra un aviso de WhatsApp en la hoja de auditoría "Avisos WhatsApp" (con LockService)
 */
function registrarAvisoWhatsApp(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = asegurarHojaAvisosWhatsApp();
    const p = params || {};

    const timestamp = new Date();
    const fecha = p.fecha || getFechaActual();
    const hora = p.hora || getHoraActual();
    const turno = normalizarTurno(p.turno || TURNO_DEFAULT);
    const maestro = p.maestro || p.registradoPor || "Recepción";
    const idNino = p.idNino || "";
    const nombreNino = p.nombreNino || "";
    const sala = p.sala || "General";
    const nombrePapas = p.nombrePapas || "Familia";
    const telefono = p.telefono || "";
    const motivo = p.motivo || "Aviso General";
    const mensaje = p.mensaje || "";

    sheet.appendRow([
      timestamp,
      sanitizarFormula(fecha),
      sanitizarFormula(hora),
      sanitizarFormula(turno),
      sanitizarFormula(maestro),
      sanitizarFormula(idNino),
      sanitizarFormula(nombreNino),
      sanitizarFormula(sala),
      sanitizarFormula(nombrePapas),
      sanitizarFormula(telefono),
      sanitizarFormula(motivo),
      sanitizarFormula(mensaje)
    ]);
    SpreadsheetApp.flush();

    return {
      success: true,
      message: "Aviso de WhatsApp registrado exitosamente en la hoja Avisos WhatsApp"
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString(),
      stack: err.stack
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Garantiza que la hoja "Historial_Telefonos" exista con sus encabezados correspondientes
 */
function asegurarHojaHistorialTelefonos() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_HISTORIAL_TELEFONOS);

  const headers = [
    "Timestamp",
    "Fecha",
    "Hora",
    "ID Niño",
    "Niño / Niña",
    "Papás / Familia",
    "Teléfono Anterior",
    "Teléfono Nuevo",
    "Modificado Por",
    "Rol",
    "Motivo"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_HISTORIAL_TELEFONOS);
    sheet.appendRow(headers);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#D97706").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Modifica el número de teléfono de un niño/familia en la hoja "Registro de NIÑOS"
 * y guarda la auditoría de antes y después en "Historial_Telefonos".
 * REGLA DE SEGURIDAD (Zero-Trust): Solo maestros y administradores pueden modificar teléfonos.
 */
function modificarTelefono(datos) {
  // 1. Verificación de permisos server-side
  const rol = String(datos.rol || "").trim().toLowerCase();
  if (rol === "auxiliar") {
    return {
      success: false,
      message: "Acceso denegado: los auxiliares no tienen permisos para modificar números de teléfono."
    };
  }

  const idNino = String(datos.idNino || "").trim();
  const nombreNino = String(datos.nombreNino || "").trim();
  const nuevoTelefono = normalizarTelefono(String(datos.nuevoTelefono || "").trim());
  const modificadoPor = String(datos.modificadoPor || datos.maestro || "Maestro").trim();
  const motivo = String(datos.motivo || "Actualización desde App IGR KIDS").trim();

  if (!nuevoTelefono || nuevoTelefono.replace(/\D/g, '').length < 6) {
    return {
      success: false,
      message: "El nuevo número de teléfono no es válido (debe tener al menos 6 dígitos numéricos)."
    };
  }

  if (!idNino && !nombreNino) {
    return {
      success: false,
      message: "Se requiere el ID o nombre del niño para identificar el registro."
    };
  }

  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    return {
      success: false,
      message: "El servidor está ocupado procesando otra solicitud. Por favor intenta de nuevo en unos segundos."
    };
  }

  try {
    const ss = getSpreadsheet();
    const sheetNinos = ss.getSheetByName(SHEET_REGISTRO_NINOS);
    if (!sheetNinos) {
      throw new Error("No se encontró la hoja: " + SHEET_REGISTRO_NINOS);
    }

    const data = sheetNinos.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: false, message: "La base de datos de niños está vacía." };
    }

    // 2. Extraer fila candidata a partir del idNino (formato: NINO_R{fila}_S{slot}_slug)
    let filaEncontrada = -1;
    let slotEncontrado = -1;
    const matchFila = idNino.match(/^NINO_R(\d+)_S(\d+)_/);

    if (matchFila) {
      const filaCand = parseInt(matchFila[1], 10);
      const slotCand = parseInt(matchFila[2], 10);
      if (filaCand >= 2 && filaCand <= data.length) {
        const filaData = data[filaCand - 1];
        const colNombre = (slotCand === 1 ? 1 : slotCand === 2 ? 4 : slotCand === 3 ? 7 : 10);
        const nomEnFila = String(filaData[colNombre] || "").trim();
        if (nomEnFila && (!nombreNino || sanitizarId(nomEnFila) === sanitizarId(nombreNino) || nomEnFila.toLowerCase().includes(nombreNino.toLowerCase()))) {
          filaEncontrada = filaCand;
          slotEncontrado = slotCand;
        }
      }
    }

    // Si no se encontró por fila rápida, buscar exhaustivamente por nombre o ID en toda la hoja
    if (filaEncontrada === -1) {
      const slotsNinos = [
        { colNombre: 1, slot: 1 },
        { colNombre: 4, slot: 2 },
        { colNombre: 7, slot: 3 },
        { colNombre: 10, slot: 4 }
      ];

      const nomBuscadoSan = sanitizarId(nombreNino);

      for (let i = 1; i < data.length; i++) {
        const filaData = data[i];
        for (let s = 0; s < slotsNinos.length; s++) {
          const sl = slotsNinos[s];
          const nom = String(filaData[sl.colNombre] || "").trim();
          if (!nom) continue;
          const idGen = "NINO_R" + (i + 1) + "_S" + sl.slot + "_" + sanitizarId(nom);
          if (idNino && (idGen === idNino || idNino.includes(sanitizarId(nom)))) {
            filaEncontrada = i + 1;
            slotEncontrado = sl.slot;
            break;
          }
          if (nomBuscadoSan && sanitizarId(nom) === nomBuscadoSan) {
            filaEncontrada = i + 1;
            slotEncontrado = sl.slot;
            break;
          }
        }
        if (filaEncontrada !== -1) break;
      }
    }

    if (filaEncontrada === -1) {
      return {
        success: false,
        message: "No se encontró el registro del niño en la planilla para actualizar el teléfono."
      };
    }

    // Fila encontrada (1-indexed)
    const filaActual = data[filaEncontrada - 1];
    const nombreEnFila = nombreNino || String(filaActual[1] || "").trim();
    const papasEnFila = String(filaActual[13] || filaActual[14] || "").trim();
    const telAnterior = String(filaActual[15] || filaActual[16] || "").trim();

    // Actualizar Col P (16) en "Registro de NIÑOS"
    sheetNinos.getRange(filaEncontrada, 16).setValue(sanitizarFormula(nuevoTelefono));

    // Si el niño ya tenía asistencia hoy en la hoja "Asistencias", actualizar Col 7 (G) allí también
    try {
      const sheetAsis = ss.getSheetByName(SHEET_ASISTENCIAS);
      if (sheetAsis) {
        const asisData = sheetAsis.getDataRange().getValues();
        const fechaHoy = getFechaActual();
        for (let a = asisData.length - 1; a >= 1; a--) {
          const aFila = asisData[a];
          const aFecha = normalizarFecha(aFila[0]);
          const aId = String(aFila[3] || "");
          const aNom = String(aFila[4] || "");
          if (aFecha === fechaHoy && (aId === idNino || (nombreNino && aNom.toLowerCase() === nombreNino.toLowerCase()))) {
            sheetAsis.getRange(a + 1, 7).setValue(sanitizarFormula(nuevoTelefono));
          }
        }
      }
    } catch (errAsis) {
      // Ignorar si falla actualización secundaria en Asistencias
    }

    // 3. Registrar auditoría completa en "Historial_Telefonos" (antes y después)
    const sheetHistorial = asegurarHojaHistorialTelefonos();
    const timestamp = new Date();
    const fecha = getFechaActual();
    const tz = Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires";
    const hora = Utilities.formatDate(timestamp, tz, "HH:mm:ss");

    sheetHistorial.appendRow([
      timestamp,                                       // A: Timestamp
      sanitizarFormula(fecha),                         // B: Fecha
      sanitizarFormula(hora),                          // C: Hora
      sanitizarFormula(idNino),                        // D: ID Niño
      sanitizarFormula(nombreEnFila),                  // E: Niño / Niña
      sanitizarFormula(papasEnFila),                   // F: Papás / Familia
      sanitizarFormula(telAnterior || "Sin teléfono"), // G: Teléfono Anterior
      sanitizarFormula(nuevoTelefono),                 // H: Teléfono Nuevo
      sanitizarFormula(modificadoPor),                 // I: Modificado Por
      sanitizarFormula(rol || "Maestro"),              // J: Rol
      sanitizarFormula(motivo)                         // K: Motivo
    ]);

    SpreadsheetApp.flush();

    return {
      success: true,
      message: `Teléfono de ${nombreEnFila} actualizado con éxito.`,
      idNino: idNino,
      nombreNino: nombreEnFila,
      papas: papasEnFila,
      telefonoAnterior: telAnterior || "Sin teléfono",
      nuevoTelefono: nuevoTelefono,
      modificadoPor: modificadoPor,
      fecha: fecha,
      hora: hora
    };
  } catch (error) {
    return {
      success: false,
      message: "Error al actualizar teléfono: " + error.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Obtiene las modificaciones recientes de teléfonos desde "Historial_Telefonos"
 */
function obtenerHistorialTelefonos(limite) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_HISTORIAL_TELEFONOS);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const max = limite ? parseInt(limite, 10) : 50;
    const historial = [];
    const tz = Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires";

    for (let i = data.length - 1; i >= 1 && historial.length < max; i--) {
      const f = data[i];
      historial.push({
        timestamp: f[0],
        fecha: f[1] instanceof Date ? Utilities.formatDate(f[1], tz, "yyyy-MM-dd") : String(f[1] || ""),
        hora: String(f[2] || ""),
        idNino: String(f[3] || ""),
        nombreNino: String(f[4] || ""),
        nombrePapas: String(f[5] || ""),
        telefonoAnterior: String(f[6] || ""),
        telefonoNuevo: String(f[7] || ""),
        modificadoPor: String(f[8] || ""),
        rol: String(f[9] || ""),
        motivo: String(f[10] || "")
      });
    }
    return historial;
  } catch (e) {
    return [];
  }
}

/**
 * Registra un nuevo usuario en la hoja Usuarios en estado "Pendiente" de autorización por el administrador
 */
function registrarNuevoUsuario(datos) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    return { success: false, message: "El servidor está ocupado. Intenta de nuevo en unos segundos." };
  }

  try {
    const sheet = asegurarHojaUsuarios();
    const usuarioLimpio = String(datos.usuario || "").trim().toLowerCase();
    const password = String(datos.password || "").trim();
    const nombre = String(datos.nombre || "").trim();
    const rol = String(datos.rol || "Maestro").trim();
    const sala = String(datos.sala || "General").trim();
    const userAgent = String(datos.userAgent || "");
    const turno = String(datos.turno || TURNO_DEFAULT);

    if (!usuarioLimpio || usuarioLimpio.length < 3) {
      return { success: false, message: "El usuario debe tener al menos 3 caracteres." };
    }
    if (!password || password.length < 4) {
      return { success: false, message: "La contraseña debe tener al menos 4 caracteres." };
    }
    if (!nombre) {
      return { success: false, message: "El nombre completo es requerido." };
    }

    // Verificar si ya existe en la hoja Usuarios o es usuario Master
    if (usuarioLimpio === AUTH_CONFIG.usuarioMaster.toLowerCase()) {
      return { success: false, message: "Este nombre de usuario ya está reservado." };
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const uFila = String(data[i][2] || "").trim().toLowerCase();
      if (uFila === usuarioLimpio) {
        return { success: false, message: "El nombre de usuario '" + usuarioLimpio + "' ya está registrado. Elige otro." };
      }
    }

    const idUsuario = "USR_" + Date.now();
    const timestamp = new Date();
    const nuevaFila = [
      sanitizarFormula(idUsuario),
      timestamp,
      sanitizarFormula(usuarioLimpio),
      sanitizarFormula(password),
      sanitizarFormula(nombre),
      sanitizarFormula(rol),
      sanitizarFormula(sala),
      "Pendiente",
      ""
    ];

    sheet.appendRow(nuevaFila);
    SpreadsheetApp.flush();

    // Generar firma criptográfica y enlaces de autorización / rechazo
    const sig = generarFirmaAutorizacion(usuarioLimpio);
    const urlAutorizar = APP_PUBLIC_URL + "/?autorizarUsuario=" + encodeURIComponent(usuarioLimpio) + "&sig=" + encodeURIComponent(sig);
    const urlRechazar = APP_PUBLIC_URL + "/?rechazarUsuario=" + encodeURIComponent(usuarioLimpio) + "&sig=" + encodeURIComponent(sig);

    // Registrar en auditoría
    registrarLogAcceso(usuarioLimpio, nombre, rol, userAgent, turno, "Cuenta Creada (Pendiente Autorización)");

    // Intentar notificar por email al administrador
    try {
      const asuntoEmail = "🔐 [IGR KIDS] Solicitud de acceso: " + nombre + " (" + rol + ")";
      const cuerpoHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
          <div style="background: linear-gradient(135deg, #ca8a04, #eab308); padding: 20px 24px; color: #0f172a;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800;">🔐 Nueva Solicitud de Usuario — IGR KIDS</h2>
          </div>
          <div style="padding: 24px;">
            <p style="margin-top: 0; color: #cbd5e1; font-size: 15px;">Un nuevo servidor solicitó acceso al sistema de asistencia <strong>IGR KIDS</strong> y se encuentra en estado <strong>Pendiente</strong>:</p>
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.7;">
              <div><strong>👤 Nombre Completo:</strong> ${nombre}</div>
              <div><strong>🔑 Usuario:</strong> @${usuarioLimpio}</div>
              <div><strong>🎓 Rol:</strong> ${rol}</div>
              <div><strong>🏫 Sala Asignada:</strong> ${sala}</div>
              <div><strong>📅 Fecha:</strong> ${getFechaActual()} ${getHoraActual()} hs</div>
            </div>
            <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">Tocá uno de los siguientes botones para autorizar o rechazar el ingreso de este usuario:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${urlAutorizar}" style="display: inline-block; padding: 14px 24px; background: #059669; color: #ffffff; text-decoration: none; font-weight: 800; border-radius: 10px; font-size: 15px; margin: 6px;">✅ AUTORIZAR USUARIO</a>
              <a href="${urlRechazar}" style="display: inline-block; padding: 14px 24px; background: #dc2626; color: #ffffff; text-decoration: none; font-weight: 800; border-radius: 10px; font-size: 15px; margin: 6px;">🚫 RECHAZAR</a>
            </div>
          </div>
        </div>
      `;
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: asuntoEmail,
        htmlBody: cuerpoHtml
      });
    } catch (eMail) {
      console.warn("No se pudo enviar email directo con MailApp:", eMail);
    }

    return {
      success: true,
      pendingApproval: true,
      approvalUrl: urlAutorizar,
      rejectUrl: urlRechazar,
      adminEmail: ADMIN_EMAIL,
      message: "Tu cuenta fue creada y está pendiente de autorización del administrador. Recibirás acceso apenas sea aprobada.",
      user: {
        usuario: usuarioLimpio,
        nombre: nombre,
        rol: rol,
        sala: sala,
        estado: "Pendiente"
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString(),
      stack: err.stack
    };
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------
// FUNCIONES AUXILIARES DE FORMATEO, LIMPIEZA Y SEGURIDAD
// ----------------------------------------------------

/**
 * Previene ataques de CSV / Formula Injection al guardar datos en Google Sheets
 */
function sanitizarFormula(valor) {
  if (valor === null || valor === undefined) return "";
  const str = String(valor).trim();
  if (/^[=+\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/**
 * Limpia y filtra el campo de alergias médicas (Columnas D, G, J y M).
 * Devuelve "" si está vacío o si normalizado coincide con respuestas negativas o basura.
 */
function limpiarAlergiaBackend(valor) {
  if (valor === null || valor === undefined) return "";
  const textoLimpio = String(valor).trim();
  if (!textoLimpio) return "";

  // Si es únicamente un número (ej: "6")
  if (/^\d+$/.test(textoLimpio)) return "";

  const normalizado = textoLimpio
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizado) return "";
  if (/^\d+$/.test(normalizado)) return "";
  if (/^no+$/.test(normalizado)) return "";

  const respuestasNegativas = [
    "no",
    "noo",
    "nooo",
    "nada",
    "ninguna",
    "ninguno",
    "ningun",
    "no tiene",
    "no tiene ninguna",
    "no tiene alergia",
    "no tiene alergias",
    "no posee",
    "no posee alergia",
    "no posee alergias",
    "no registra",
    "no presenta",
    "no aplica",
    "ni una",
    "sin alergias",
    "sin alergia",
    "sin observaciones",
    "sin observacion",
    "ninguna alergia",
    "n a",
    "na",
    "s d",
    "sd",
    "m",
    "x"
  ];

  if (respuestasNegativas.indexOf(normalizado) !== -1) {
    return "";
  }

  return textoLimpio;
}

/**
 * Valida que el nombre de un niño en las columnas de Hijo 1/2/3/4 sea un nombre real
 * y no una respuesta negativa ("No", "Ninguno", "Nada", "-", etc.).
 */
function esNombreNinoValido(nombre) {
  if (!nombre) return false;
  const raw = String(nombre).trim();
  if (raw.length <= 1) return false;

  const norm = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!norm || norm.length <= 1) return false;
  if (/^\d+$/.test(norm)) return false;
  if (/^no+$/.test(norm)) return false;
  if (norm.includes("nombre")) return false;

  const nombresInvalidos = [
    "no",
    "noo",
    "nooo",
    "nada",
    "ninguno",
    "ninguna",
    "ningun",
    "no tiene",
    "no posee",
    "no aplica",
    "na",
    "n a",
    "s d",
    "sd",
    "sin hermanos",
    "hijo unico",
    "hija unica",
    "nadie",
    "no hay"
  ];

  if (nombresInvalidos.indexOf(norm) !== -1) {
    return false;
  }

  return true;
}

/**
 * Normaliza y valida el turno dominical recibido
 */
function normalizarTurno(turno) {
  if (!turno) return TURNO_DEFAULT;
  const t = String(turno).trim();
  if (t === "") return TURNO_DEFAULT;
  
  const tLower = t.toLowerCase();
  if (tLower.includes("10") || tLower.includes("manana") || tLower.includes("mañana")) {
    return "10:00 hs (Mañana)";
  }
  if (tLower.includes("18") || tLower.includes("tarde")) {
    return "18:00 hs (Tarde)";
  }
  if (tLower.includes("20") || tLower.includes("noche")) {
    return "20:00 hs (Noche)";
  }
  return t;
}

function getFechaActual() {
  const tz = Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires";
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
}

function getHoraActual() {
  const tz = Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires";
  return Utilities.formatDate(new Date(), tz, "HH:mm");
}

function normalizarFecha(fechaVal) {
  if (!fechaVal) return getFechaActual();
  if (fechaVal instanceof Date) {
    const tz = Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires";
    return Utilities.formatDate(fechaVal, tz, "yyyy-MM-dd");
  }
  const str = String(fechaVal).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    return str.substring(0, 10);
  }
  const matchDMY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (matchDMY) {
    const dd = matchDMY[1].length === 1 ? "0" + matchDMY[1] : matchDMY[1];
    const mm = matchDMY[2].length === 1 ? "0" + matchDMY[2] : matchDMY[2];
    const yyyy = matchDMY[3];
    return yyyy + "-" + mm + "-" + dd;
  }
  return str;
}

function normalizarTelefono(tel) {
  if (!tel) return "";
  let limpio = String(tel).replace(/[^0-9+]/g, "").trim();
  return limpio;
}

/**
 * Formatea valores u objetos Date de hora crudos (ej: Date 1899, HH:mm, etc.) a formato HH:mm
 */
function formatearHoraBackend(horaVal) {
  if (!horaVal) return "";
  if (horaVal instanceof Date) {
    const tz = Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires";
    return Utilities.formatDate(horaVal, tz, "HH:mm");
  }
  const str = String(horaVal).trim();
  if (!str) return "";
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hh = match[1].length === 1 ? "0" + match[1] : match[1];
    return hh + ":" + match[2];
  }
  return str;
}

/**
 * Formatea valores de edad o fechas de nacimiento en textos limpios de edad
 */
function formatearEdadBackend(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const today = new Date();
    let years = today.getFullYear() - val.getFullYear();
    let months = today.getMonth() - val.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < val.getDate())) {
      years--;
      months += 12;
    }
    if (years > 0) {
      if (years < 3 && months > 0) {
        return years + " años y " + months + " meses";
      }
      return years + " años";
    } else if (months > 0) {
      return months + " meses";
    }
    return "Bebé (< 1 mes)";
  }

  const str = String(val).trim();
  if (str.includes("GMT") || str.includes("00:00:00") || (str.match(/^\d{4}-\d{2}-\d{2}/) && !str.includes("años"))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return formatearEdadBackend(d);
    }
  }

  if (str.match(/^\d+$/)) {
    return str + " años";
  }

  return str;
}

function sanitizarId(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 30);
}

function determinarSala(edad, extra) {
  const texto = (edad + " " + extra).toLowerCase();
  if (texto.includes("cuna") || texto.includes("bebe") || texto.includes("0") || texto.includes("1") || texto.includes("2")) {
    return "Sala Cunas (0-2 años)";
  }
  if (texto.includes("parvulo") || texto.includes("3") || texto.includes("4") || texto.includes("5")) {
    return "Párvulos (3-5 años)";
  }
  if (texto.includes("primario") || texto.includes("6") || texto.includes("7") || texto.includes("8")) {
    return "Primarios (6-8 años)";
  }
  if (texto.includes("pre") || texto.includes("adolescente") || texto.includes("9") || texto.includes("10") || texto.includes("11") || texto.includes("12")) {
    return "Pre-Adolescentes (9-12 años)";
  }
  return "General";
}
