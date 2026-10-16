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

// LISTA DE TURNOS DOMINICALES ESTÁNDAR
const TURNOS_VALIDOS = [
  "10:00 hs (Mañana)",
  "18:00 hs (Tarde)",
  "20:00 hs (Noche)"
];
const TURNO_DEFAULT = "10:00 hs (Mañana)";

// CREDENCIALES DE ACCESO GENERAL PROTEGIDAS EN EL SERVIDOR
// Puedes configurar APP_USER, APP_PASSWORD y SPREADSHEET_ID en PropertiesService.getScriptProperties()
const AUTH_CONFIG = {
  usuarioMaster: "igrkids2026",          // Usuario general por defecto
  passwordMaster: "IgrKids*2026!Seguro", // Contraseña segura generada
  nombreUsuario: "Equipo IGR KIDS",      // Nombre que se mostrará al ingresar
  rol: "Administrador / Recepción",
  sessionExpiryHours: 24,                // Duración de la sesión activa en horas
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
    const action = params.action || "getDatos";
    let responseData = { success: false, message: "Acción no reconocida" };

    // --- ACCIÓN DE AUTENTICACIÓN / LOGIN ---
    if (action === "login") {
      responseData = autenticarUsuario(
        params.usuario, 
        params.password, 
        params.userAgent, 
        params.turno
      );
    } else if (action === "crearUsuario" || action === "registroUsuario") {
      responseData = registrarNuevoUsuario(params);
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
    } else if (action === "registrarAvisoWhatsApp" || action === "registroWhatsApp" || action === "logWhatsApp") {
      responseData = registrarAvisoWhatsApp(params);
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
        if (estadoFila.toLowerCase() === "inactivo") {
          return { success: false, message: "Tu usuario se encuentra inactivo. Consulta con la coordinación." };
        }

        if (pFila === pass) {
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

  return {
    success: true,
    fecha: fechaConsulta,
    turno: turnoConsulta,
    turnosDisponibles: TURNOS_VALIDOS,
    totalNinos: ninos.length,
    totalPresentes: asistencias.length,
    ninos: ninosConEstado,
    asistenciasHoy: asistencias
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
          personasAutorizadas: notasGenerales
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
    const nombrePapas = String(datos.nombrePapas || "").trim();
    const telefono = String(datos.telefono || "").trim();
    const observaciones = String(datos.observaciones || "").trim();
    const personasAutorizadas = String(datos.personasAutorizadas || "").trim();

    if (!nombreNino1) {
      return { success: false, message: "El nombre del niño es requerido" };
    }

    const alergiaLimpia = limpiarAlergiaBackend(observaciones);

    const nuevaFila = [
      timestamp,                             // Col A (0): Timestamp
      sanitizarFormula(nombreNino1),         // Col B (1): Nombre Niño 1
      sanitizarFormula(edadNino1),           // Col C (2): Edad 1
      sanitizarFormula(observaciones),       // Col D (3): Alergias / Observaciones Médicas Niño 1
      "",                                    // Col E (4): Niño 2
      "",                                    // Col F (5): Edad 2
      "",                                    // Col G (6): Alergias Niño 2
      "",                                    // Col H (7): Niño 3
      "",                                    // Col I (8): Edad 3
      "",                                    // Col J (9): Alergias Niño 3
      "",                                    // Col K (10): Niño 4
      "",                                    // Col L (11): Edad 4
      "",                                    // Col M (12): Alergias Niño 4
      sanitizarFormula(nombrePapas),         // Col N (13): Papás
      "",                                    // Col O (14): Mail/Otro
      sanitizarFormula(telefono),            // Col P (15): Teléfono
      sanitizarFormula(personasAutorizadas)  // Col Q (16): Personas autorizadas a retirar
    ];

    sheet.appendRow(nuevaFila);
    SpreadsheetApp.flush();

    return {
      success: true,
      message: `Niño ${nombreNino1} agregado exitosamente al registro`,
      nuevoNino: {
        nombre: nombreNino1,
        edad: edadNino1,
        sala: salaNino1,
        nombrePapas: nombrePapas,
        telefono: telefono,
        observacionesMedicas: alergiaLimpia,
        extra: alergiaLimpia
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
 * Registra un nuevo usuario en la hoja Usuarios con LockService
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
      "Activo",
      ""
    ];

    sheet.appendRow(nuevaFila);
    SpreadsheetApp.flush();

    // Registrar en auditoría
    registrarLogAcceso(usuarioLimpio, nombre, rol, userAgent, turno, "Cuenta Creada");

    const expiresAt = new Date(Date.now() + AUTH_CONFIG.sessionExpiryHours * 60 * 60 * 1000).toISOString();
    const token = generarTokenSesion(usuarioLimpio, expiresAt);

    return {
      success: true,
      message: `¡Usuario ${nombre} creado con éxito!`,
      token: token,
      expiresAt: expiresAt,
      user: {
        usuario: usuarioLimpio,
        nombre: nombre,
        rol: rol,
        sala: sala
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
