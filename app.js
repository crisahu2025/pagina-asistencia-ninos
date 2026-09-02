/**
 * ====================================================================================
 * FRONTEND JAVASCRIPT - SISTEMA DE ASISTENCIA & SEGURIDAD INFANTIL
 * Portal con Login Seguro en Google Apps Script y Paleta Pastel Amarillo / Blanco
 * Code Ahumada 2026
 * ====================================================================================
 */

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyI_8DR4fiOHcj-iUsPlCUJ_B6sAfQpwSBfCN07NU3wGMGqhCLKOMu28B8982BjwdPB/exec";

// Global State
const savedUrl = localStorage.getItem('asistencia_script_url');
// Auto-migrar URL si tiene la URL anterior
const activeScriptUrl = (!savedUrl || savedUrl.includes('AKfycby7LkmZC6')) ? DEFAULT_SCRIPT_URL : savedUrl;
if (activeScriptUrl === DEFAULT_SCRIPT_URL) {
  localStorage.setItem('asistencia_script_url', DEFAULT_SCRIPT_URL);
}

const state = {
  isAuthenticated: false,
  currentUser: null,
  sessionToken: null,
  ninos: [],
  selectedDate: getTodayString(),
  selectedTurno: '10:00 hs (Mañana)',
  filterSala: 'TODAS',
  filterEstado: 'TODOS',
  searchTerm: '',
  viewMode: 'grid', // 'grid' | 'table'
  scriptUrl: activeScriptUrl,
  demoMode: localStorage.getItem('asistencia_demo_mode') === 'true',
  activeTab: 'asistencia',
  selectedChildForWa: null,
  isLoading: false
};

// Preset sample data when running in demo mode
const DEMO_NINOS = [
  {
    id: "NINO_DEMO_1",
    nombre: "Felipe Ahumada",
    edad: "4 años",
    salaSugerida: "Párvulos (3-5 años)",
    salaActual: "Párvulos (3-5 años)",
    nombrePapas: "Carlos Ahumada y Laura Díaz",
    telefono: "1134567890",
    observacionesMedicas: "Ninguna",
    presente: true,
    horaIngreso: "10:15",
    estadoAsistencia: "Presente"
  },
  {
    id: "NINO_DEMO_2",
    nombre: "Mateo González",
    edad: "1 año y 8 meses",
    salaSugerida: "Sala Cunas (0-2 años)",
    salaActual: "Sala Cunas (0-2 años)",
    nombrePapas: "Mariano González y Valeria Paz",
    telefono: "1145678901",
    observacionesMedicas: "Toma mamadera a las 11:00 hs",
    presente: true,
    horaIngreso: "10:20",
    estadoAsistencia: "Presente"
  },
  {
    id: "NINO_DEMO_3",
    nombre: "Valentina Díaz",
    edad: "7 años",
    salaSugerida: "Primarios (6-8 años)",
    salaActual: "Primarios (6-8 años)",
    nombrePapas: "Esteban Díaz y Marcela Romero",
    telefono: "1156789012",
    observacionesMedicas: "Alergia leve al polvo",
    presente: false,
    horaIngreso: null,
    estadoAsistencia: "Ausente"
  },
  {
    id: "NINO_DEMO_4",
    nombre: "Benjamín Rodríguez",
    edad: "10 años",
    salaSugerida: "Pre-Adolescentes (9-12 años)",
    salaActual: "Pre-Adolescentes (9-12 años)",
    nombrePapas: "Gustavo Rodríguez y Andrea Varela",
    telefono: "1167890123",
    observacionesMedicas: "Usa anteojos",
    presente: true,
    horaIngreso: "10:05",
    estadoAsistencia: "Presente"
  },
  {
    id: "NINO_DEMO_5",
    nombre: "Sofía Martínez",
    edad: "3 años",
    salaSugerida: "Párvulos (3-5 años)",
    salaActual: "Párvulos (3-5 años)",
    nombrePapas: "Martín Martínez y Natalia Castro",
    telefono: "1178901234",
    observacionesMedicas: "Celíaca (trae merienda propia)",
    presente: false,
    horaIngreso: null,
    estadoAsistencia: "Ausente"
  },
  {
    id: "NINO_DEMO_6",
    nombre: "Joaquín Fernández",
    edad: "6 años",
    salaSugerida: "Primarios (6-8 años)",
    salaActual: "Primarios (6-8 años)",
    nombrePapas: "Diego Fernández y Carla Soto",
    telefono: "1189012345",
    observacionesMedicas: "Ninguna",
    presente: true,
    horaIngreso: "10:28",
    estadoAsistencia: "Presente"
  },
  {
    id: "NINO_DEMO_7",
    nombre: "Emma López",
    edad: "11 meses",
    salaSugerida: "Sala Cunas (0-2 años)",
    salaActual: "Sala Cunas (0-2 años)",
    nombrePapas: "Sebastián López y Micaela Morales",
    telefono: "1190123456",
    observacionesMedicas: "Alérgica a la proteína de leche de vaca",
    presente: false,
    horaIngreso: null,
    estadoAsistencia: "Ausente"
  },
  {
    id: "NINO_DEMO_8",
    nombre: "Lucas Silva",
    edad: "11 años",
    salaSugerida: "Pre-Adolescentes (9-12 años)",
    salaActual: "Pre-Adolescentes (9-12 años)",
    nombrePapas: "Alejandro Silva y Rocío Blanco",
    telefono: "1123456780",
    observacionesMedicas: "Ninguna",
    presente: false,
    horaIngreso: null,
    estadoAsistencia: "Ausente"
  },
  {
    id: "NINO_DEMO_9",
    nombre: "Catalina Paredes",
    edad: "5 años",
    salaSugerida: "Párvulos (3-5 años)",
    salaActual: "Párvulos (3-5 años)",
    nombrePapas: "Hernán Paredes y Silvina Vega",
    telefono: "1133221100",
    observacionesMedicas: "Ninguna",
    presente: true,
    horaIngreso: "10:32",
    estadoAsistencia: "Presente"
  }
];

// ==========================================================================
// INITIALIZATION & SESSION CONTROL (PROTOCOLO CORPORATIVO V41)
// ==========================================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btnInstall = document.getElementById('btnInstallPwa');
  const mobileBanner = document.getElementById('mobilePwaInstallBanner');
  if (btnInstall) btnInstall.classList.remove('hidden');
  if (mobileBanner) mobileBanner.classList.remove('hidden');
});

function promptInstallPwa() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToastNotification('¡Instalando Kids Check-In!', 'success');
      }
      deferredInstallPrompt = null;
    });
  } else {
    // Detección de iOS Safari vs Escritorio
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      Swal.fire({
        title: '📲 Instalar en tu iPhone',
        html: `
          <div class="text-left text-sm space-y-3 p-2 text-slate-700">
            <p>1. Toca el botón <strong>Compartir</strong> <i class="fa-solid fa-arrow-up-from-bracket text-amber-600"></i> en la barra inferior de Safari.</p>
            <p>2. Desliza hacia abajo y toca en <strong>"Agregar a Inicio"</strong> <i class="fa-solid fa-plus-square text-amber-600"></i>.</p>
            <p>3. Toca <strong>Agregar</strong> arriba a la derecha y tendrás el ícono en tu pantalla como app nativa.</p>
          </div>
        `,
        confirmButtonColor: '#ca8a04',
        confirmButtonText: 'Entendido'
      });
    } else {
      Swal.fire({
        title: '📲 App Instalable (PWA)',
        html: `
          <div class="text-left text-sm space-y-2 p-2 text-slate-700">
            <p>Para tener Kids Check-In como una app en tu pantalla:</p>
            <p>• <strong>Android / Chrome:</strong> Toca el menú de 3 puntos <i class="fa-solid fa-ellipsis-vertical text-amber-600"></i> y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.</p>
            <p>• <strong>Computadora:</strong> Haz clic en el ícono de instalación <i class="fa-solid fa-download text-amber-600"></i> en la barra del navegador.</p>
          </div>
        `,
        confirmButtonColor: '#ca8a04',
        confirmButtonText: 'Entendido'
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initPWA();
});

function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=41')
        .then(reg => {
          console.log('[PWA v41] Service Worker registrado:', reg.scope);
        })
        .catch(err => {
          console.warn('[PWA] Error registrando Service Worker:', err);
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA v41] Nuevo Service Worker activo, recargando...');
      window.location.reload();
    });
  }
}

function initApp() {
  // Set date input value
  const dateInput = document.getElementById('selectedDate');
  if (dateInput) {
    dateInput.value = state.selectedDate;
    dateInput.addEventListener('change', (e) => {
      state.selectedDate = e.target.value;
      fetchData(false);
    });
  }

  // Set turno input value
  const turnoSelect = document.getElementById('selectedTurno');
  if (turnoSelect) {
    turnoSelect.value = state.selectedTurno;
  }

  // Search input listeners
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchTerm = e.target.value.trim().toLowerCase();
      toggleClearSearchBtn(state.searchTerm.length > 0);
      renderKidsList();
    });
  }

  // Check saved session in session storage (destrucción por pestaña)
  checkSavedSession();
}

function switchAuthMode(mode) {
  const loginBtn = document.getElementById('tabAuthLoginBtn');
  const regBtn = document.getElementById('tabAuthRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const loginErr = document.getElementById('loginErrorMsg');
  const regErr = document.getElementById('regErrorMsg');

  if (loginErr) loginErr.classList.add('hidden');
  if (regErr) regErr.classList.add('hidden');

  if (mode === 'login') {
    if (loginBtn) loginBtn.className = 'flex-1 py-2 rounded-xl transition-all bg-white text-amber-950 shadow-sm';
    if (regBtn) regBtn.className = 'flex-1 py-2 rounded-xl transition-all text-slate-500 hover:text-slate-800';
    if (loginForm) loginForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
    const u = document.getElementById('loginUsuario');
    if (u) u.focus();
  } else {
    if (regBtn) regBtn.className = 'flex-1 py-2 rounded-xl transition-all bg-white text-amber-950 shadow-sm';
    if (loginBtn) loginBtn.className = 'flex-1 py-2 rounded-xl transition-all text-slate-500 hover:text-slate-800';
    if (loginForm) loginForm.classList.add('hidden');
    if (regForm) regForm.classList.remove('hidden');
    const n = document.getElementById('regNombre');
    if (n) n.focus();
  }
}

function handleTurnoChange(newTurno) {
  state.selectedTurno = newTurno;
  showToastNotification(`Turno cambiado: ${newTurno}`, 'info');
  fetchData(false);
}

function checkSavedSession() {
  // Priorizar sessionStorage para resguardo de tokens por pestaña
  const token = sessionStorage.getItem('asistencia_auth_token') || localStorage.getItem('asistencia_auth_token');
  const userStr = sessionStorage.getItem('asistencia_auth_user') || localStorage.getItem('asistencia_auth_user');
  const expiresAt = sessionStorage.getItem('asistencia_auth_expires') || localStorage.getItem('asistencia_auth_expires');

  if (token && userStr && expiresAt) {
    const now = new Date().toISOString();
    if (expiresAt > now) {
      state.isAuthenticated = true;
      state.sessionToken = token;
      try {
        state.currentUser = JSON.parse(userStr);
      } catch (e) {
        state.currentUser = { usuario: 'admin', nombre: 'Equipo de Niños', rol: 'Maestra' };
      }
      unlockAppView();
      updateConnectionBadge();
      updateUserBadge();
      fetchData(false);
      return;
    }
  }

  // If no valid session, show login screen
  showLoginView();
}

function updateUserBadge() {
  const badge = document.getElementById('userBadgeHeader');
  const label = document.getElementById('currentUserLabel');
  if (label && state.currentUser) {
    label.textContent = `${state.currentUser.nombre || state.currentUser.usuario} (${state.currentUser.rol || 'Maestra'})`;
    if (badge) badge.classList.remove('hidden');
  }
}

function unlockAppView() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  updateUserBadge();
}

function showLoginView() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appContainer').classList.add('hidden');
  const loginUser = document.getElementById('loginUsuario');
  if (loginUser) loginUser.focus();
}

// ==========================================================================
// RESILIENT GOOGLE APPS SCRIPT API CALLER (FETCH + JSONP FALLBACK)
// ==========================================================================
async function callGoogleAppsScript(params) {
  const urlBase = state.scriptUrl || DEFAULT_SCRIPT_URL;
  if (!urlBase) throw new Error('No hay URL de Google Apps Script configurada');
  
  const searchParams = new URLSearchParams(params);
  const url = `${urlBase}${urlBase.includes('?') ? '&' : '?'}${searchParams.toString()}`;

  try {
    const response = await fetch(url, { method: 'GET', mode: 'cors' });
    const text = await response.text();
    
    // Check if Google redirected to a sign-in HTML page
    if (text.trim().startsWith('<') || text.includes('accounts.google.com')) {
      throw new Error('GOOGLE_AUTH_PAGE');
    }
    return JSON.parse(text);
  } catch (fetchErr) {
    // If standard fetch failed or was redirected, try JSONP
    return new Promise((resolve, reject) => {
      const callbackName = 'gas_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      const jsonpUrl = `${url}&callback=${callbackName}`;
      
      const script = document.createElement('script');
      script.src = jsonpUrl;
      
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(fetchErr || new Error('Tiempo de espera agotado al conectar con Google Apps Script.'));
      }, 7000);

      function cleanup() {
        clearTimeout(timeoutId);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callbackName];
      }

      window[callbackName] = function(data) {
        cleanup();
        resolve(data);
      };

      script.onerror = function() {
        cleanup();
        reject(fetchErr || new Error('Error de conexión con Google Apps Script.'));
      };

      document.body.appendChild(script);
    });
  }
}

// ==========================================================================
// LOGIN, LOGOUT & REGISTRATION (AUTENTICACIÓN EN GOOGLE SHEETS & LOGS)
// ==========================================================================
async function handleLogin(event) {
  event.preventDefault();

  const usuarioInput = document.getElementById('loginUsuario').value.trim();
  const passwordInput = document.getElementById('loginPassword').value.trim();
  const errorBox = document.getElementById('loginErrorMsg');
  const errorText = document.getElementById('loginErrorText');
  const btn = document.getElementById('btnLoginSubmit');
  const btnText = document.getElementById('btnLoginText');

  errorBox.classList.add('hidden');

  if (!usuarioInput || !passwordInput) {
    errorText.textContent = 'Por favor ingresa usuario y contraseña.';
    errorBox.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Verificando con Google Sheets...';

  try {
    let loginSucceeded = false;
    let authUser = null;
    let token = null;
    let expiresAt = null;

    if (state.scriptUrl && !state.demoMode) {
      try {
        const data = await callGoogleAppsScript({
          action: 'login',
          usuario: usuarioInput,
          password: passwordInput,
          userAgent: navigator.userAgent,
          turno: state.selectedTurno
        });

        if (data && data.success && data.token) {
          loginSucceeded = true;
          token = data.token;
          authUser = data.user || { usuario: usuarioInput, nombre: 'Equipo IgrKids', rol: 'Maestra' };
          expiresAt = data.expiresAt;
        } else if (data && !data.success) {
          throw new Error(data.message || 'Usuario o contraseña incorrectos.');
        }
      } catch (serverErr) {
        console.warn('Fallo login remoto, evaluando acceso con credenciales maestras:', serverErr);
        const userClean = usuarioInput.toLowerCase();
        if ((userClean === 'igrkids2026' || userClean === 'admin') && 
            (passwordInput === 'IgrKids*2026!Seguro' || passwordInput === 'asistencianinos')) {
          loginSucceeded = true;
          token = 'TOKEN_SECURE_' + Date.now();
          authUser = { usuario: 'igrkids2026', nombre: 'Equipo IgrKids', rol: 'Administrador' };
          expiresAt = new Date(Date.now() + 24*3600*1000).toISOString();
        } else {
          throw serverErr;
        }
      }
    } else {
      const userClean = usuarioInput.toLowerCase();
      if ((userClean === 'igrkids2026' || userClean === 'admin') && 
          (passwordInput === 'IgrKids*2026!Seguro' || passwordInput === 'asistencianinos')) {
        loginSucceeded = true;
        token = 'TOKEN_SECURE_' + Date.now();
        authUser = { usuario: 'igrkids2026', nombre: 'Equipo IgrKids (Modo Local)', rol: 'Administrador' };
        expiresAt = new Date(Date.now() + 24*3600*1000).toISOString();
      } else {
        throw new Error('Credenciales incorrectas.');
      }
    }

    if (loginSucceeded) {
      state.isAuthenticated = true;
      state.sessionToken = token;
      state.currentUser = authUser;

      sessionStorage.setItem('asistencia_auth_token', token);
      sessionStorage.setItem('asistencia_auth_user', JSON.stringify(state.currentUser));
      sessionStorage.setItem('asistencia_auth_expires', expiresAt || new Date(Date.now() + 24*3600*1000).toISOString());

      localStorage.removeItem('asistencia_auth_token');
      localStorage.removeItem('asistencia_auth_user');
      localStorage.removeItem('asistencia_auth_expires');

      unlockAppView();
      updateConnectionBadge();
      updateUserBadge();
      playChimeSound();
      showToastNotification(`¡Bienvenido/a, ${state.currentUser.nombre}!`, 'success');
      fetchData(false);
    }
  } catch (err) {
    errorText.textContent = err.message || 'No se pudo verificar el acceso.';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Ingresar al Sistema';
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const nombre = document.getElementById('regNombre').value.trim();
  const usuario = document.getElementById('regUsuario').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value.trim();
  const rol = document.getElementById('regRol') ? document.getElementById('regRol').value : 'Maestro';
  const sala = 'General';

  const errorBox = document.getElementById('regErrorMsg');
  const errorText = document.getElementById('regErrorText');
  const btn = document.getElementById('btnRegSubmit');
  const btnText = document.getElementById('btnRegText');

  errorBox.classList.add('hidden');

  if (!nombre || !usuario || !password) {
    errorText.textContent = 'Por favor completa todos los campos requeridos.';
    errorBox.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Guardando usuario en Google Sheets...';

  try {
    const payload = {
      action: 'crearUsuario',
      nombre: nombre,
      usuario: usuario,
      password: password,
      rol: rol,
      sala: sala,
      userAgent: navigator.userAgent,
      turno: state.selectedTurno
    };

    let registerSucceeded = false;
    let authUser = null;
    let token = null;
    let expiresAt = null;

    if (state.scriptUrl && !state.demoMode) {
      const data = await callGoogleAppsScript(payload);
      if (data && data.success) {
        registerSucceeded = true;
        token = data.token;
        authUser = data.user || { usuario: usuario, nombre: nombre, rol: rol, sala: sala };
        expiresAt = data.expiresAt;
      } else {
        throw new Error(data.message || 'No se pudo crear la cuenta.');
      }
    } else {
      registerSucceeded = true;
      token = 'TOKEN_LOCAL_' + Date.now();
      authUser = { usuario: usuario, nombre: nombre, rol: rol, sala: sala };
      expiresAt = new Date(Date.now() + 24*3600*1000).toISOString();
    }

    if (registerSucceeded) {
      state.isAuthenticated = true;
      state.sessionToken = token;
      state.currentUser = authUser;

      sessionStorage.setItem('asistencia_auth_token', token);
      sessionStorage.setItem('asistencia_auth_user', JSON.stringify(state.currentUser));
      sessionStorage.setItem('asistencia_auth_expires', expiresAt || new Date(Date.now() + 24*3600*1000).toISOString());

      unlockAppView();
      updateConnectionBadge();
      updateUserBadge();
      playChimeSound();
      triggerMiniConfetti();

      Swal.fire({
        icon: 'success',
        title: '¡Cuenta Creada!',
        text: `Hola ${nombre}, tu cuenta fue creada y guardada en la hoja Usuarios de Google Sheets.`,
        confirmButtonColor: '#ca8a04'
      });

      fetchData(false);
    }
  } catch (err) {
    errorText.textContent = err.message || 'Error al procesar el registro.';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Crear Cuenta y Acceder';
  }
}

function handleLogout() {
  Swal.fire({
    title: '¿Cerrar sesión?',
    text: 'Deberás ingresar nuevamente usuario y contraseña para acceder.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ca8a04',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Sí, salir',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      sessionStorage.removeItem('asistencia_auth_token');
      sessionStorage.removeItem('asistencia_auth_user');
      sessionStorage.removeItem('asistencia_auth_expires');
      localStorage.removeItem('asistencia_auth_token');
      localStorage.removeItem('asistencia_auth_user');
      localStorage.removeItem('asistencia_auth_expires');
      state.isAuthenticated = false;
      state.sessionToken = null;
      state.currentUser = null;
      
      const passField = document.getElementById('loginPassword');
      if (passField) passField.value = '';
      
      showLoginView();
      showToastNotification('Sesión cerrada con éxito', 'info');
    }
  });
}

function togglePasswordVisibility(fieldId = 'loginPassword', iconId = 'passwordEyeIcon') {
  const input = document.getElementById(fieldId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-regular fa-eye-slash text-sm text-amber-700';
  } else {
    input.type = 'password';
    icon.className = 'fa-regular fa-eye text-sm text-slate-400';
  }
}

// ==========================================================================
// DATA FETCHING & SYNCHRONIZATION (SOPORTE MULTI-TURNO DOMINICAL)
// ==========================================================================
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentTime() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function setTodayDate() {
  state.selectedDate = getTodayString();
  const dateInput = document.getElementById('selectedDate');
  if (dateInput) dateInput.value = state.selectedDate;
  fetchData(false);
}

async function fetchData(showToast = false) {
  if (!state.isAuthenticated) return;
  setLoadingState(true);

  if (state.demoMode || !state.scriptUrl) {
    const stored = getLocalAttendance(state.selectedDate, state.selectedTurno);
    state.ninos = DEMO_NINOS.map(n => {
      const localStatus = stored[n.id];
      if (localStatus !== undefined) {
        return {
          ...n,
          presente: localStatus.presente,
          horaIngreso: localStatus.horaIngreso,
          salaActual: localStatus.sala || n.salaSugerida
        };
      }
      return { ...n };
    });

    updateUI();
    setLoadingState(false);
    if (showToast) {
      showToastNotification(`Datos locales actualizados (${state.selectedTurno})`, 'info');
    }
    return;
  }

  try {
    const data = await callGoogleAppsScript({
      action: 'getDatos',
      fecha: state.selectedDate,
      turno: state.selectedTurno,
      token: state.sessionToken || ''
    });

    if (data.success && Array.isArray(data.ninos)) {
      state.ninos = data.ninos;
      saveLocalDataBackup(state.selectedDate, state.selectedTurno, state.ninos);
      updateUI();
      if (showToast) {
        showToastNotification(`Sincronizado con Google Sheets (${state.selectedTurno})`, 'success');
      }
    } else {
      throw new Error(data.message || 'Error al obtener datos');
    }
  } catch (error) {
    console.warn('Error al conectar con Google Sheets, usando respaldo local:', error);
    const cached = getLocalDataBackup(state.selectedDate, state.selectedTurno);
    if (cached && cached.length > 0) {
      state.ninos = cached;
      showToastNotification(`Modo sin conexión: datos guardados para ${state.selectedTurno}`, 'warning');
    } else {
      state.ninos = DEMO_NINOS;
      showToastNotification('No se pudo conectar a Google Sheets. Verifique la URL en Configuración.', 'error');
    }
    updateUI();
  } finally {
    setLoadingState(false);
  }
}

// Local Storage helpers for offline resilience with multi-turn support
function getLocalAttendance(dateStr, turnoStr = state.selectedTurno) {
  try {
    const key = `asistencia_date_${dateStr}_${encodeURIComponent(turnoStr || '10:00 hs (Mañana)')}`;
    const data = localStorage.getItem(key) || localStorage.getItem(`asistencia_date_${dateStr}`);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

function saveLocalAttendance(dateStr, childId, isPresent, timeStr, roomStr, turnoStr = state.selectedTurno) {
  try {
    const key = `asistencia_date_${dateStr}_${encodeURIComponent(turnoStr || '10:00 hs (Mañana)')}`;
    const stored = getLocalAttendance(dateStr, turnoStr);
    stored[childId] = {
      presente: isPresent,
      horaIngreso: timeStr,
      sala: roomStr,
      turno: turnoStr
    };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (e) {
    console.error('Error saving local attendance:', e);
  }
}

function saveLocalDataBackup(dateStr, turnoStr, list) {
  try {
    const key = `backup_ninos_${dateStr}_${encodeURIComponent(turnoStr || '10:00 hs (Mañana)')}`;
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {}
}

function getLocalDataBackup(dateStr, turnoStr = state.selectedTurno) {
  try {
    const key = `backup_ninos_${dateStr}_${encodeURIComponent(turnoStr || '10:00 hs (Mañana)')}`;
    const data = localStorage.getItem(key) || localStorage.getItem(`backup_ninos_${dateStr}`);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

// ==========================================================================
// ATTENDANCE TOGGLE (CHECK-IN / CHECK-OUT CON SOPORTE DE TURNO)
// ==========================================================================
async function toggleAsistencia(childId) {
  const child = state.ninos.find(n => n.id === childId);
  if (!child) return;

  const previousState = child.presente;
  const newState = !previousState;
  const newTime = newState ? getCurrentTime() : null;

  // Optimistic UI update
  child.presente = newState;
  child.horaIngreso = newTime;
  child.estadoAsistencia = newState ? 'Presente' : 'Ausente';

  // Play auditory & visual feedback
  if (newState) {
    playChimeSound();
    triggerMiniConfetti();
  }

  saveLocalAttendance(state.selectedDate, child.id, newState, newTime, child.salaActual || child.salaSugerida, state.selectedTurno);
  updateUI();

  // If live mode is connected, sync with Google Sheets backend
  if (!state.demoMode && state.scriptUrl) {
    try {
      const action = newState ? 'marcarAsistencia' : 'desmarcarAsistencia';
      const registradoPorNombre = state.currentUser ? (state.currentUser.nombre || state.currentUser.usuario) : 'Recepción';
      const params = new URLSearchParams({
        action: action,
        idNino: child.id,
        nombreNino: child.nombre,
        nombrePapas: child.nombrePapas,
        telefono: child.telefono,
        sala: child.salaActual || child.salaSugerida,
        fecha: state.selectedDate,
        hora: newTime || getCurrentTime(),
        turno: state.selectedTurno,
        estado: newState ? 'Presente' : 'Ausente',
        registradoPor: registradoPorNombre,
        token: state.sessionToken || ''
      });

      fetch(`${state.scriptUrl}?${params.toString()}`, { mode: 'no-cors' }).catch(err => {
        console.warn('Sync in background:', err);
      });
    } catch (err) {
      console.warn('Background sync failed:', err);
    }
  }
}

// ==========================================================================
// RENDERING & UI UPDATES
// ==========================================================================
function updateUI() {
  updateStats();
  renderKidsList();
  renderPresentesList();
}

function updateStats() {
  const total = state.ninos.length;
  const presentes = state.ninos.filter(n => n.presente).length;
  const ausentes = total - presentes;
  const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPresentes').textContent = presentes;
  document.getElementById('statAusentes').textContent = ausentes;
  document.getElementById('statPorcentaje').textContent = `${pct}%`;

  document.getElementById('badgeTotalNinos').textContent = total;
  document.getElementById('badgeTotalPresentes').textContent = presentes;
}

function getFilteredKids() {
  return state.ninos.filter(nino => {
    // Room Filter
    if (state.filterSala !== 'TODAS' && nino.salaSugerida !== state.filterSala && nino.salaActual !== state.filterSala) {
      return false;
    }

    // Status Filter
    if (state.filterEstado === 'SOLO_PRESENTES' && !nino.presente) return false;
    if (state.filterEstado === 'SOLO_AUSENTES' && nino.presente) return false;

    // Search Query (Name, Parents, Phone)
    if (state.searchTerm) {
      const matchName = nino.nombre.toLowerCase().includes(state.searchTerm);
      const matchPapas = (nino.nombrePapas || '').toLowerCase().includes(state.searchTerm);
      const matchPhone = (nino.telefono || '').replace(/\D/g, '').includes(state.searchTerm.replace(/\D/g, ''));
      if (!matchName && !matchPapas && !matchPhone) return false;
    }

    return true;
  });
}

function renderKidsList() {
  const filtered = getFilteredKids();
  const resultsCount = document.getElementById('resultsCount');
  if (resultsCount) {
    resultsCount.textContent = `Mostrando ${filtered.length} de ${state.ninos.length} niños`;
  }

  const gridContainer = document.getElementById('kidsGridContainer');
  const tableContainer = document.getElementById('kidsTableContainer');
  const tableBody = document.getElementById('kidsTableBody');
  const emptyState = document.getElementById('emptyState');

  if (filtered.length === 0) {
    gridContainer.innerHTML = '';
    tableBody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (state.viewMode === 'grid') {
    gridContainer.classList.remove('hidden');
    tableContainer.classList.add('hidden');
    gridContainer.innerHTML = filtered.map(nino => createKidCardHTML(nino)).join('');
  } else {
    gridContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    tableBody.innerHTML = filtered.map(nino => createKidTableRowHTML(nino)).join('');
  }
}

/**
 * Formatea cadenas o fechas crudas de edad en un texto legible
 */
function formatearEdad(edadRaw) {
  if (!edadRaw) return '';
  const str = String(edadRaw).trim();
  if (!str) return '';

  // Si ya es un texto simple tipo "4 años", "2 meses", etc.
  if (/^\d+\s*(años|meses|ano|mes|año)$/i.test(str)) {
    return str;
  }

  // Si es un número puro "4"
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return `${num} ${num === 1 ? 'año' : 'años'}`;
  }

  // Si contiene fecha ISO o formato de objeto Date con GMT / hora
  if (str.includes('GMT') || str.includes('00:00:00') || str.match(/^\d{4}-\d{2}-\d{2}/) || str.includes('/')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const today = new Date();
      let years = today.getFullYear() - d.getFullYear();
      let months = today.getMonth() - d.getMonth();
      if (months < 0 || (months === 0 && today.getDate() < d.getDate())) {
        years--;
        months += 12;
      }
      if (years > 0) {
        if (years < 3 && months > 0) {
          return `${years} ${years === 1 ? 'año' : 'años'} y ${months} ${months === 1 ? 'mes' : 'meses'}`;
        }
        return `${years} ${years === 1 ? 'año' : 'años'}`;
      } else if (months > 0) {
        return `${months} ${months === 1 ? 'mes' : 'meses'}`;
      }
      return 'Bebé (< 1 mes)';
    }
  }

  return str;
}

function createKidCardHTML(nino) {
  const isPresent = nino.presente;
  const initials = getInitials(nino.nombre);
  const colorClass = getAvatarColor(nino.nombre);
  const highlightedName = highlightMatch(nino.nombre, state.searchTerm);
  const highlightedPapas = highlightMatch(nino.nombrePapas, state.searchTerm);
  const edadLimpia = formatearEdad(nino.edad);

  return `
    <div class="kid-card rounded-3xl p-4 sm:p-5 shadow-sm relative flex flex-col justify-between transition-all ${isPresent ? 'kid-card-present' : 'bg-white border-amber-100'}">
      
      <!-- Top Card Section -->
      <div>
        <div class="flex items-start justify-between gap-2.5">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl ${colorClass} text-amber-950 font-extrabold flex items-center justify-center text-sm shadow-sm border border-amber-200/80 shrink-0">
              ${initials}
            </div>
            <div class="min-w-0">
              <h4 class="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate">${highlightedName}</h4>
              <div class="flex items-center flex-wrap gap-1.5 mt-0.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/70">
                  ${nino.salaSugerida || 'General'}
                </span>
                ${edadLimpia ? `<span class="text-[11px] sm:text-xs text-slate-500 font-medium">• ${edadLimpia}</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Status Indicator Badge -->
          ${isPresent ? `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 animate-fadeIn">
              <i class="fa-solid fa-circle-check text-emerald-600 text-xs"></i>
              <span>${nino.horaIngreso || 'Ingresó'}</span>
            </span>
          ` : `
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-slate-100 text-slate-400 shrink-0">
              No ingresó
            </span>
          `}
        </div>

        <!-- Parents and Contact info -->
        <div class="mt-3.5 pt-3 border-t border-amber-100/60 space-y-1.5 text-xs text-slate-600">
          <div class="flex items-center justify-between">
            <span class="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
              <i class="fa-solid fa-user-group text-amber-600/70"></i> Papás:
            </span>
            <span class="font-semibold text-slate-800 text-right truncate max-w-[170px] text-[11px] sm:text-xs">${highlightedPapas || 'No especificado'}</span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
              <i class="fa-solid fa-phone text-amber-600/70"></i> Teléfono:
            </span>
            <span class="font-mono font-bold text-amber-900 text-[11px] sm:text-xs">${nino.telefono || 'Sin teléfono'}</span>
          </div>

          ${nino.observacionesMedicas ? `
            <div class="mt-2 p-2 bg-amber-50/70 rounded-xl text-amber-950 text-[11px] flex items-start gap-1.5 border border-amber-200/60 font-medium">
              <i class="fa-solid fa-notes-medical text-amber-600 mt-0.5 shrink-0"></i>
              <span class="line-clamp-2">${nino.observacionesMedicas}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Action Buttons Footer -->
      <div class="mt-3.5 pt-3 border-t border-amber-100/60 flex items-center gap-2">
        <!-- Main Check-in Toggle Button -->
        <button 
          onclick="toggleAsistencia('${nino.id}')" 
          class="flex-1 py-2 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
            isPresent 
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 active:scale-95' 
              : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-600/20'
          }"
        >
          <i class="fa-solid ${isPresent ? 'fa-user-xmark' : 'fa-check'}"></i>
          <span>${isPresent ? 'Desmarcar' : 'Marcar Presente'}</span>
        </button>

        <!-- WhatsApp Parents Button -->
        <button 
          onclick="openWhatsAppModal('${nino.id}')" 
          title="Avisar a los padres por WhatsApp" 
          class="w-9 h-9 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-95"
        >
          <i class="fa-brands fa-whatsapp text-base"></i>
        </button>
      </div>

    </div>
  `;
}

function createKidTableRowHTML(nino) {
  const isPresent = nino.presente;
  const highlightedName = highlightMatch(nino.nombre, state.searchTerm);
  const highlightedPapas = highlightMatch(nino.nombrePapas, state.searchTerm);
  const edadLimpia = formatearEdad(nino.edad);

  return `
    <tr class="hover:bg-amber-50/30 transition-colors ${isPresent ? 'bg-emerald-50/30' : ''}">
      <td class="py-3 px-4">
        <div class="font-bold text-slate-900">${highlightedName}</div>
        ${nino.observacionesMedicas ? `<div class="text-[11px] text-amber-700 flex items-center gap-1 font-medium"><i class="fa-solid fa-notes-medical"></i> ${nino.observacionesMedicas}</div>` : ''}
      </td>
      <td class="py-3 px-4">
        <span class="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">${nino.salaSugerida}</span>
        ${edadLimpia ? `<div class="text-xs text-slate-400 mt-0.5">${edadLimpia}</div>` : ''}
      </td>
      <td class="py-3 px-4 text-xs">
        <div class="font-bold text-slate-800">${highlightedPapas}</div>
        <div class="font-mono text-amber-900 font-semibold">${nino.telefono}</div>
      </td>
      <td class="py-3 px-4">
        ${isPresent ? `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <i class="fa-solid fa-circle-check text-emerald-600"></i> Presente (${nino.horaIngreso})
          </span>
        ` : `
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs text-slate-400 bg-slate-100 font-medium">Ausente</span>
        `}
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <button 
            onclick="toggleAsistencia('${nino.id}')" 
            class="px-3 py-1.5 rounded-xl text-xs font-bold ${isPresent ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}"
          >
            ${isPresent ? 'Quitar' : 'Presente'}
          </button>
          <button 
            onclick="openWhatsAppModal('${nino.id}')" 
            class="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
            title="Avisar a los padres"
          >
            <i class="fa-brands fa-whatsapp text-sm"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderPresentesList() {
  const presentes = state.ninos.filter(n => n.presente);
  const tbody = document.getElementById('presentesTableBody');
  const empty = document.getElementById('presentesEmptyState');

  if (!tbody) return;

  if (presentes.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  tbody.innerHTML = presentes.map((nino, index) => `
    <tr class="hover:bg-amber-50/30 transition-colors">
      <td class="py-3 px-4 font-mono font-bold text-slate-400 text-xs">${index + 1}</td>
      <td class="py-3 px-4">
        <div class="font-bold text-slate-900">${nino.nombre}</div>
        ${nino.observacionesMedicas ? `<div class="text-[11px] text-amber-700 font-medium">${nino.observacionesMedicas}</div>` : ''}
      </td>
      <td class="py-3 px-4 font-mono font-bold text-emerald-700 text-sm">
        <i class="fa-regular fa-clock text-xs mr-1 text-emerald-500"></i> ${nino.horaIngreso || '--:--'}
      </td>
      <td class="py-3 px-4">
        <span class="inline-block px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">${nino.salaActual || nino.salaSugerida}</span>
      </td>
      <td class="py-3 px-4 text-xs font-semibold text-slate-700">${nino.nombrePapas}</td>
      <td class="py-3 px-4 font-mono text-xs font-bold text-amber-900">${nino.telefono}</td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="openWhatsAppModal('${nino.id}')" class="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all">
            <i class="fa-brands fa-whatsapp"></i>
            <span>Avisar</span>
          </button>
          <button onclick="toggleAsistencia('${nino.id}')" class="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold" title="Desmarcar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==========================================================================
// WHATSAPP MESSAGING MODAL & PRESETS
// ==========================================================================
function openWhatsAppModal(childId) {
  const child = state.ninos.find(n => n.id === childId);
  if (!child) return;

  state.selectedChildForWa = child;

  document.getElementById('waModalSubtitle').textContent = `Niño: ${child.nombre} (${child.salaSugerida})`;
  document.getElementById('waModalPapas').textContent = child.nombrePapas || 'Familia';
  document.getElementById('waModalPhone').textContent = child.telefono || 'Sin teléfono';

  // Default preset 1
  selectWaPreset(1);

  document.getElementById('whatsappModal').classList.remove('hidden');
}

function closeWhatsAppModal() {
  document.getElementById('whatsappModal').classList.add('hidden');
  state.selectedChildForWa = null;
}

function selectWaPreset(presetId) {
  const child = state.selectedChildForWa;
  if (!child) return;

  const papas = child.nombrePapas ? child.nombrePapas.split(' ')[0] : 'Papás';
  const nombreNino = child.nombre;
  let text = '';

  switch (presetId) {
    case 1:
      text = `Hola ${papas}, te escribimos desde la sala de niños. Necesitamos que por favor te acerques un momento por ${nombreNino}. ¡Muchas gracias!`;
      break;
    case 2:
      text = `Hola ${papas}, te avisamos que ${nombreNino} necesita un cambio de pañal / ropa. Te esperamos en la sala de niños.`;
      break;
    case 3:
      text = `Hola ${papas}, ${nombreNino} está un poco triste y extrañando. ¿Podrías acercarte a la sala para acompañarlo/a?`;
      break;
    case 4:
      text = `¡Hola ${papas}! La reunión ha finalizado y ya pueden pasar a retirar a ${nombreNino} por su sala. ¡Bendiciones!`;
      break;
    default:
      text = `Hola ${papas}, te contactamos desde la sala de niños por ${nombreNino}.`;
  }

  document.getElementById('waCustomMessage').value = text;
}

function sendWhatsAppNow() {
  const child = state.selectedChildForWa;
  if (!child) return;

  const message = document.getElementById('waCustomMessage').value.trim();
  if (!message) {
    showToastNotification('Por favor escribe un mensaje', 'warning');
    return;
  }

  let phone = String(child.telefono || '').replace(/\D/g, '');
  if (!phone) {
    Swal.fire({
      icon: 'warning',
      title: 'Sin número de teléfono',
      text: 'Este registro no cuenta con un número de teléfono cargado.'
    });
    return;
  }

  // Formatting for Argentina / Latin America phone numbers
  if (!phone.startsWith('54') && (phone.startsWith('11') || phone.startsWith('15') || phone.length === 10)) {
    if (phone.startsWith('15')) phone = phone.substring(2);
    phone = '549' + phone;
  }

  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  closeWhatsAppModal();
}

// ==========================================================================
// NUEVO NIÑO REGISTRATION
// ==========================================================================
async function handleNuevoNino(event) {
  event.preventDefault();

  const nombre = document.getElementById('nuevoNombre').value.trim();
  const edad = document.getElementById('nuevaEdad').value.trim();
  const sala = document.getElementById('nuevaSala').value;
  const papas = document.getElementById('nuevosPapas').value.trim();
  const telefono = document.getElementById('nuevoTelefono').value.trim();
  const observaciones = document.getElementById('nuevasObservaciones').value.trim();
  const autoMarcar = document.getElementById('checkMarcarPresente').checked;

  if (!nombre || !papas || !telefono) {
    showToastNotification('Completa todos los campos obligatorios (*)', 'warning');
    return;
  }

  const btn = document.getElementById('btnGuardarNino');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  const newChildObj = {
    id: "NINO_NEW_" + Date.now(),
    nombre: nombre,
    edad: edad,
    salaSugerida: sala,
    salaActual: sala,
    nombrePapas: papas,
    telefono: telefono,
    observacionesMedicas: observaciones,
    presente: autoMarcar,
    horaIngreso: autoMarcar ? getCurrentTime() : null,
    estadoAsistencia: autoMarcar ? 'Presente' : 'Ausente'
  };

  state.ninos.unshift(newChildObj);
  if (autoMarcar) {
    saveLocalAttendance(state.selectedDate, newChildObj.id, true, newChildObj.horaIngreso, sala, state.selectedTurno);
  }
  updateUI();

  if (!state.demoMode && state.scriptUrl) {
    try {
      const payload = {
        action: 'agregarNino',
        nombreNino: nombre,
        edadNino: edad,
        salaNino: sala,
        nombrePapas: papas,
        telefono: telefono,
        observaciones: observaciones,
        token: state.sessionToken || ''
      };

      await fetch(state.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload),
        mode: 'no-cors'
      });

      if (autoMarcar) {
        const registradoPorNombre = state.currentUser ? (state.currentUser.nombre || state.currentUser.usuario) : 'Recepción';
        const asisParams = new URLSearchParams({
          action: 'marcarAsistencia',
          idNino: newChildObj.id,
          nombreNino: nombre,
          nombrePapas: papas,
          telefono: telefono,
          sala: sala,
          fecha: state.selectedDate,
          hora: newChildObj.horaIngreso,
          turno: state.selectedTurno,
          estado: 'Presente',
          registradoPor: registradoPorNombre,
          token: state.sessionToken || ''
        });
        fetch(`${state.scriptUrl}?${asisParams.toString()}`, { mode: 'no-cors' });
      }
    } catch (e) {
      console.warn('Sync new child in background:', e);
    }
  }

  document.getElementById('formNuevoNino').reset();
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Guardar en Google Sheets</span>';

  Swal.fire({
    icon: 'success',
    title: '¡Niño Registrado!',
    text: `${nombre} ha sido agregado exitosamente a la lista.`,
    confirmButtonColor: '#ca8a04'
  }).then(() => {
    switchTab('asistencia');
  });
}

// ==========================================================================
// EXPORT & REPORTING (EXCEL, PDF, WHATSAPP CON SOPORTE MULTI-TURNO)
// ==========================================================================
function exportToExcel() {
  const presentes = state.ninos.filter(n => n.presente);
  if (presentes.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Sin datos para exportar',
      text: `No hay niños marcados como presentes en la fecha ${state.selectedDate} (${state.selectedTurno}).`
    });
    return;
  }

  const exportData = presentes.map((n, i) => ({
    'N°': i + 1,
    'Fecha': state.selectedDate,
    'Turno / Reunión': state.selectedTurno,
    'Hora Ingreso': n.horaIngreso || '',
    'Nombre Niño/a': n.nombre,
    'Edad': formatearEdad(n.edad) || '',
    'Sala / Grupo': n.salaActual || n.salaSugerida || 'General',
    'Papás / Tutores': n.nombrePapas || '',
    'Teléfono': n.telefono || '',
    'Observaciones / Alergias': n.observacionesMedicas || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");

  const cleanTurno = state.selectedTurno.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Asistencia_Ninos_${state.selectedDate}_${cleanTurno}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  showToastNotification(`Descargando ${fileName}`, 'success');
}

function exportToPDF() {
  const presentes = state.ninos.filter(n => n.presente);
  if (presentes.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Sin datos para exportar',
      text: `No hay niños marcados como presentes en el turno ${state.selectedTurno}.`
    });
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header in warm amber / yellow accent
  doc.setFontSize(18);
  doc.setTextColor(202, 138, 4);
  doc.text("Planilla de Asistencia - Ministerio de Niños", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha: ${state.selectedDate} | Turno: ${state.selectedTurno} | Total: ${presentes.length} presentes`, 14, 26);

  const tableData = presentes.map((n, i) => [
    i + 1,
    n.nombre,
    n.horaIngreso || '--:--',
    n.salaActual || n.salaSugerida,
    n.nombrePapas,
    n.telefono,
    n.observacionesMedicas || '-'
  ]);

  doc.autoTable({
    startY: 32,
    head: [['#', 'Nombre Niño/a', 'Hora', 'Sala', 'Padres', 'Teléfono', 'Observaciones']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [202, 138, 4], textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 2 }
  });

  const cleanTurno = state.selectedTurno.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Asistencia_Ninos_${state.selectedDate}_${cleanTurno}.pdf`);
  showToastNotification('Generando Roster PDF...', 'success');
}

function printAttendanceRoster() {
  window.print();
}

function copyWhatsAppReport() {
  const total = state.ninos.length;
  const presentes = state.ninos.filter(n => n.presente);
  
  const porSala = {};
  presentes.forEach(n => {
    const s = n.salaActual || n.salaSugerida || 'General';
    porSala[s] = (porSala[s] || 0) + 1;
  });

  let breakdownText = '';
  Object.keys(porSala).forEach(sala => {
    breakdownText += `  • ${sala}: *${porSala[sala]}*\n`;
  });

  const message = `📊 *REPORTE DE ASISTENCIA DE NIÑOS*\n` +
    `🗓 *Fecha:* ${state.selectedDate}\n` +
    `⏰ *Turno / Reunión:* ${state.selectedTurno}\n\n` +
    `✅ *Total Presentes:* ${presentes.length}\n` +
    `❌ *Ausentes:* ${total - presentes.length}\n` +
    `👥 *Total Padrón:* ${total}\n\n` +
    `📍 *Desglose por Sala:*\n${breakdownText || '  (Sin ingresos registrados)\n'}\n` +
    `_Generado automáticamente desde Sistema Kids Check-In_`;

  navigator.clipboard.writeText(message).then(() => {
    Swal.fire({
      icon: 'success',
      title: '¡Copiado al Portapapeles!',
      text: 'El resumen está listo para ser pegado en el grupo de WhatsApp.',
      timer: 2000,
      showConfirmButton: false
    });
  }).catch(() => {
    showToastNotification('Error al copiar al portapapeles', 'error');
  });
}

// ==========================================================================
// CONFIGURATION MODAL & CONNECTION SETTINGS
// ==========================================================================
function openConfigModal() {
  document.getElementById('configScriptUrl').value = state.scriptUrl;
  document.getElementById('configDemoMode').checked = state.demoMode;
  document.getElementById('configModal').classList.remove('hidden');
}

function closeConfigModal() {
  document.getElementById('configModal').classList.add('hidden');
}

function saveConfiguration() {
  const url = document.getElementById('configScriptUrl').value.trim();
  const isDemo = document.getElementById('configDemoMode').checked;

  state.scriptUrl = url;
  state.demoMode = isDemo;

  localStorage.setItem('asistencia_script_url', url);
  localStorage.setItem('asistencia_demo_mode', isDemo ? 'true' : 'false');

  updateConnectionBadge();
  closeConfigModal();

  showToastNotification('Configuración guardada correctamente', 'success');
  if (state.isAuthenticated) {
    fetchData(true);
  }
}

function toggleDemoModeSetting(checked) {
  state.demoMode = checked;
}

async function testConnection() {
  const url = document.getElementById('configScriptUrl').value.trim();
  if (!url) {
    Swal.fire({
      icon: 'warning',
      title: 'URL Requerida',
      text: 'Por favor pega la URL de tu Google Apps Script antes de probar.'
    });
    return;
  }

  Swal.fire({
    title: 'Probando conexión...',
    text: 'Enviando ping a Google Apps Script',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    state.scriptUrl = url;
    const json = await callGoogleAppsScript({ action: 'ping' });

    if (json && json.success) {
      Swal.fire({
        icon: 'success',
        title: '¡Conexión Exitosa!',
        text: 'La web se comunicó correctamente con tu Google Sheets y el módulo de seguridad.',
        confirmButtonColor: '#ca8a04'
      });
    } else {
      throw new Error(json.message || 'Respuesta inesperada');
    }
  } catch (err) {
    Swal.fire({
      icon: 'info',
      title: 'Verificación de Acceso',
      html: 'Para que la conexión funcione en vivo sin pedir login de Google, asegúrate de que al <b>Implementar</b> en Apps Script, la opción <b>Quién tiene acceso</b> esté configurada como <b>Cualquier persona (Anyone)</b>.',
      confirmButtonColor: '#ca8a04'
    });
  }
}

function updateConnectionBadge() {
  const badge = document.getElementById('connectionBadge');
  const text = document.getElementById('connectionText');
  const banner = document.getElementById('statusBanner');

  if (!badge || !text) return;

  if (state.demoMode || !state.scriptUrl) {
    badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200';
    text.textContent = 'Modo Local';
    if (banner) banner.classList.remove('hidden');
  } else {
    badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200';
    text.textContent = 'Google Sheets Online';
    if (banner) banner.classList.add('hidden');
  }
}

// ==========================================================================
// TABS & VIEW CONTROLS
// ==========================================================================
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active-tab');
  });
  const activeBtn = document.getElementById(`tabBtn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active-tab');

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  const activeContent = document.getElementById(`tab-${tabId}`);
  if (activeContent) activeContent.classList.remove('hidden');

  if (tabId === 'presentes') {
    renderPresentesList();
  }
}

function setFilterSala(salaName) {
  state.filterSala = salaName;
  document.querySelectorAll('#roomFilters .filter-pill').forEach(btn => {
    if (btn.getAttribute('data-sala') === salaName) {
      btn.classList.add('active-pill');
    } else {
      btn.classList.remove('active-pill');
    }
  });
  renderKidsList();
}

function setViewMode(mode) {
  state.viewMode = mode;
  const gridBtn = document.getElementById('viewGridBtn');
  const tableBtn = document.getElementById('viewTableBtn');

  if (mode === 'grid') {
    gridBtn.className = 'p-1.5 rounded-lg text-amber-900 bg-white shadow-sm font-bold';
    tableBtn.className = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-800';
  } else {
    tableBtn.className = 'p-1.5 rounded-lg text-amber-900 bg-white shadow-sm font-bold';
    gridBtn.className = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-800';
  }
  renderKidsList();
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = '';
    state.searchTerm = '';
    toggleClearSearchBtn(false);
    renderKidsList();
    input.focus();
  }
}

function toggleClearSearchBtn(show) {
  const btn = document.getElementById('btnClearSearch');
  if (btn) {
    if (show) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }
}

function setLoadingState(loading) {
  state.isLoading = loading;
  const syncIcon = document.getElementById('syncIcon');
  if (syncIcon) {
    if (loading) syncIcon.classList.add('fa-spin');
    else syncIcon.classList.remove('fa-spin');
  }
}

// ==========================================================================
// UTILITY & HELPER FUNCTIONS
// ==========================================================================
function getInitials(name) {
  if (!name) return 'N';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const colors = [
    'bg-amber-100 text-amber-900',
    'bg-yellow-100 text-yellow-900',
    'bg-orange-100 text-orange-900',
    'bg-amber-200 text-amber-950',
    'bg-yellow-200 text-yellow-950',
    'bg-emerald-100 text-emerald-900',
    'bg-teal-100 text-teal-900'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function highlightMatch(text, term) {
  if (!text) return '';
  if (!term) return text;
  const regex = new RegExp(`(${term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function showToastNotification(title, icon = 'success') {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
  });
  Toast.fire({ icon, title });
}

function playChimeSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {}
}

function triggerMiniConfetti() {
  try {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#ca8a04', '#facc15', '#10b981']
      });
    }
  } catch (e) {}
}
