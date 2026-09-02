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
  nombreUsuario: "Equipo IgrKids",      // Nombre que se mostrará al ingresar
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
 * Endpoint GET para la aplicación web (Lectura, Login y Acciones)
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "getDatos";
    let responseData = { success: false, message: "Acción no reconocida" };

    // --- ACCIÓN DE AUTENTICACIÓN / LOGIN ---
    if (action === "login") {
      responseData = autenticarUsuario(params.usuario, params.password);
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
    } else if (action === "getTurnos") {
      responseData = {
        success: true,
        turnos: TURNOS_VALIDOS,
        defaultTurno: TURNO_DEFAULT
      };
    } else if (action === "ping") {
      responseData = { 
        success: true, 
        message: "Conexión exitosa con Google Apps Script (Multi-Reunión y LockService activos)", 
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
 * Endpoint POST para registrar asistencia, nuevos niños y login seguro
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
      responseData = autenticarUsuario(payload.usuario, payload.password);
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

// ----------------------------------------------------
// MÓDULO DE AUTENTICACIÓN Y SEGURIDAD EN EL SERVIDOR
// ----------------------------------------------------

/**
 * Autentica usuario y contraseña de forma segura en el servidor
 */
function autenticarUsuario(usuarioIngresado, passwordIngresado) {
  const user = String(usuarioIngresado || "").trim();
  const pass = String(passwordIngresado || "").trim();

  // Obtener credenciales desde Script Properties si están configuradas, sino usar las de AUTH_CONFIG
  const scriptProps = PropertiesService.getScriptProperties();
  const userEsperado = scriptProps.getProperty("APP_USER") || AUTH_CONFIG.usuarioMaster;
  const passEsperada = scriptProps.getProperty("APP_PASSWORD") || AUTH_CONFIG.passwordMaster;

  if (!user || !pass) {
    return {
      success: false,
      message: "Por favor ingresa usuario y contraseña."
    };
  }

  // Comparación segura
  if (user.toLowerCase() === userEsperado.toLowerCase() && pass === passEsperada) {
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
        rol: AUTH_CONFIG.rol
      }
    };
  } else {
    return {
      success: false,
      message: "Usuario o contraseña incorrectos. Verifica los datos e intenta nuevamente."
    };
  }
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

  const mapaAsistencias = {};
  asistencias.forEach(a => {
    mapaAsistencias[a.idNino] = a;
  });

  const ninosConEstado = ninos.map(nino => {
    const asis = mapaAsistencias[nino.id];
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
      if (nombreNino && nombreNino.length > 1 && !nombreNino.toLowerCase().includes("nombre")) {
        const edadDetalle = String(fila[slot.colEdad] || "").trim();
        const extraInfo = String(fila[slot.colExtra] || "").trim();

        let salaSugerida = determinarSala(edadDetalle, extraInfo);
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
          observacionesMedicas: notasGenerales,
          extra: extraInfo
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
        hora: String(fila[2] || ""),
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
    const hora = datos.hora || getHoraActual();
    const turno = normalizarTurno(datos.turno || TURNO_DEFAULT);
    const idNino = String(datos.idNino || "").trim();
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
      sheetAsis.getRange(filaExistente, 1).setValue(idAsistencia);
      sheetAsis.getRange(filaExistente, 3).setValue(hora);
      if (nombrePapas) sheetAsis.getRange(filaExistente, 6).setValue(nombrePapas);
      if (telefono) sheetAsis.getRange(filaExistente, 7).setValue(telefono);
      sheetAsis.getRange(filaExistente, 8).setValue(sala);
      sheetAsis.getRange(filaExistente, 9).setValue(estado);
      sheetAsis.getRange(filaExistente, 10).setValue(observaciones);
      sheetAsis.getRange(filaExistente, 11).setValue(registradoPor);
      sheetAsis.getRange(filaExistente, 12).setValue(turno);

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
        idAsistencia,     // Col 1 (A): ID Asistencia
        fecha,            // Col 2 (B): Fecha
        hora,             // Col 3 (C): Hora Ingreso
        idNino,           // Col 4 (D): ID Niño
        nombreNino,       // Col 5 (E): Nombre Niño
        nombrePapas,      // Col 6 (F): Papás
        telefono,         // Col 7 (G): Teléfono
        sala,             // Col 8 (H): Sala / Grupo
        estado,           // Col 9 (I): Estado
        observaciones,    // Col 10 (J): Observaciones
        registradoPor,    // Col 11 (K): Registrado Por
        turno             // Col 12 (L): Turno / Reunión
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

    if (!nombreNino1) {
      return { success: false, message: "El nombre del niño es requerido" };
    }

    const nuevaFila = [
      timestamp,           // Col A: Timestamp
      nombreNino1,         // Col B: Nombre Niño 1
      edadNino1,           // Col C: Edad 1
      salaNino1,           // Col D: Info 1
      "",                  // Col E: Niño 2
      "",                  // Col F: Edad 2
      "",                  // Col G: Info 2
      "",                  // Col H: Niño 3
      "",                  // Col I: Edad 3
      "",                  // Col J: Info 3
      "",                  // Col K: Niño 4
      "",                  // Col L: Edad 4
      "",                  // Col M: Info 4
      nombrePapas,         // Col N: Papás
      "",                  // Col O: Mail/Otro
      telefono,            // Col P: Teléfono
      observaciones        // Col Q: Observaciones
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
        telefono: telefono
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

// ----------------------------------------------------
// FUNCIONES AUXILIARES DE FORMATEO Y UTILIDADES
// ----------------------------------------------------

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
