/**
 * ====================================================================================
 * FRONTEND JAVASCRIPT - SISTEMA DE ASISTENCIA & SEGURIDAD INFANTIL
 * Portal con Login Seguro en Google Apps Script y Paleta Pastel Amarillo / Blanco
 * Code Ahumada 2026
 * ====================================================================================
 */

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzl8hch0DOszgJSZYHTV5KY705LJuOSyZKSZZiCfKWJGHvTqVqYppsd4A7q3uSDSaQ/exec";

// Global State - Forzar migración a la URL oficial actual
localStorage.setItem('asistencia_script_url', DEFAULT_SCRIPT_URL);
const activeScriptUrl = DEFAULT_SCRIPT_URL;

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
  presentesSearchTerm: '',
  presentesViewMode: localStorage.getItem('igr_presentes_view_mode') || 'grid',
  viewMode: 'grid', // 'grid' | 'table'
  kidsRenderLimit: 36,
  scriptUrl: activeScriptUrl,
  demoMode: localStorage.getItem('asistencia_demo_mode') === 'true',
  activeTab: 'asistencia',
  selectedChildForWa: null,
  selectedWaPresetTitle: 'Acercarse a la sala',
  isWaCustomModified: false,
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
// INITIALIZATION & SESSION CONTROL (PROTOCOLO CORPORATIVO V54)
// ==========================================================================
let deferredInstallPrompt = null;

// Escuchar evento de instalación PWA de navegadores Chromium
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btnInstall = document.getElementById('btnInstallPwa');
  if (btnInstall) btnInstall.classList.remove('hidden');

  // Si no fue descartado en esta sesión, mostramos el cartel
  if (!sessionStorage.getItem('pwa_banner_dismissed')) {
    showPwaInstallModal();
  }
});

// Detectar si la app ya está corriendo instalada en modo standalone
function isPwaStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Mostrar modal flotante / bottom sheet de instalación
function showPwaInstallModal() {
  if (isPwaStandalone()) return;
  if (sessionStorage.getItem('pwa_banner_dismissed')) return;

  const modal = document.getElementById('pwaInstallModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Ocultar modal de instalación y opcionalmente guardar en sessionStorage
function dismissPwaModal(saveDismissed = true) {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  if (saveDismissed) {
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  }
}

// Handler de click en el botón principal del modal "📲 Instalar App Ahora"
function handlePwaInstallClick() {
  dismissPwaModal(false);
  promptInstallPwa();
}

// Disparador principal de instalación de PWA (botón header o modal)
function promptInstallPwa() {
  // 1. Si el navegador soporta prompt nativo interactivo (Chrome/Edge en Android y PC)
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('¡Gracias por instalar IGR KIDS!', 'success');
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
        dismissPwaModal(true);
      }
      deferredInstallPrompt = null;
    });
    return;
  }

  // 2. Detección de plataforma para guiar al usuario según su dispositivo
  const isIos = (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent))) && !window.MSStream;
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isIos) {
    Swal.fire({
      title: '<span class="font-[\'Outfit\'] font-extrabold text-slate-900 text-xl sm:text-2xl">📲 Instalar en tu iPhone</span>',
      html: `
        <div class="text-left text-sm space-y-3.5 p-3 sm:p-4 text-slate-700 bg-amber-50/60 rounded-3xl border border-amber-200/80">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-2xl bg-amber-200/80 text-amber-950 font-black flex items-center justify-center shrink-0 text-xs shadow-sm border border-amber-300">1</div>
            <p class="leading-snug pt-1">Tocar el botón <strong>Compartir</strong> <i class="fa-solid fa-arrow-up-from-bracket text-amber-600 ml-1"></i> (en la barra inferior o superior de Safari).</p>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-2xl bg-amber-200/80 text-amber-950 font-black flex items-center justify-center shrink-0 text-xs shadow-sm border border-amber-300">2</div>
            <p class="leading-snug pt-1">Deslizar hacia abajo y tocar <strong>"Agregar a Inicio"</strong> <i class="fa-solid fa-square-plus text-amber-600 ml-1"></i>.</p>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-2xl bg-amber-200/80 text-amber-950 font-black flex items-center justify-center shrink-0 text-xs shadow-sm border border-amber-300">3</div>
            <p class="leading-snug pt-1">Tocar <strong>"Agregar"</strong> arriba a la derecha para tenerla como app en tu celular.</p>
          </div>
        </div>
      `,
      confirmButtonColor: '#ca8a04',
      confirmButtonText: '¡Entendido!',
      customClass: {
        popup: 'rounded-3xl border border-amber-200 shadow-2xl',
        confirmButton: 'rounded-2xl font-bold px-6 py-2.5 shadow-md shadow-amber-400/30 text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-300'
      }
    });
  } else if (isAndroid) {
    Swal.fire({
      title: '<span class="font-[\'Outfit\'] font-extrabold text-slate-900 text-xl sm:text-2xl">📲 Instalar en tu Android</span>',
      html: `
        <div class="text-left text-sm space-y-3.5 p-3 sm:p-4 text-slate-700 bg-amber-50/60 rounded-3xl border border-amber-200/80">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-2xl bg-amber-200/80 text-amber-950 font-black flex items-center justify-center shrink-0 text-xs shadow-sm border border-amber-300">1</div>
            <p class="leading-snug pt-1">Tocar el menú de opciones <i class="fa-solid fa-ellipsis-vertical text-amber-600 ml-1"></i> (arriba a la derecha en Chrome).</p>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-2xl bg-amber-200/80 text-amber-950 font-black flex items-center justify-center shrink-0 text-xs shadow-sm border border-amber-300">2</div>
            <p class="leading-snug pt-1">Seleccionar <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong> <i class="fa-solid fa-mobile-screen-button text-amber-600 ml-1"></i>.</p>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-2xl bg-amber-200/80 text-amber-950 font-black flex items-center justify-center shrink-0 text-xs shadow-sm border border-amber-300">3</div>
            <p class="leading-snug pt-1">Confirmar tocando <strong>"Instalar"</strong> para abrirla con un solo toque.</p>
          </div>
        </div>
      `,
      confirmButtonColor: '#ca8a04',
      confirmButtonText: '¡Entendido!',
      customClass: {
        popup: 'rounded-3xl border border-amber-200 shadow-2xl',
        confirmButton: 'rounded-2xl font-bold px-6 py-2.5 shadow-md shadow-amber-400/30 text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-300'
      }
    });
  } else {
    Swal.fire({
      title: '<span class="font-[\'Outfit\'] font-extrabold text-slate-900 text-xl sm:text-2xl">💻 Instalar IGR KIDS</span>',
      html: `
        <div class="text-left text-sm space-y-2.5 p-3 sm:p-4 text-slate-700 bg-amber-50/60 rounded-3xl border border-amber-200/80">
          <p>Para tener IGR KIDS en tu computadora como una aplicación de escritorio:</p>
          <p class="mt-2">• Haz clic en el ícono de instalación <i class="fa-solid fa-download text-amber-600"></i> en la barra superior de direcciones (Chrome, Edge o Brave).</p>
          <p>• O despliega el menú del navegador y elige <strong>"Instalar IGR KIDS..."</strong>.</p>
        </div>
      `,
      confirmButtonColor: '#ca8a04',
      confirmButtonText: '¡Entendido!',
      customClass: {
        popup: 'rounded-3xl border border-amber-200 shadow-2xl',
        confirmButton: 'rounded-2xl font-bold px-6 py-2.5 shadow-md shadow-amber-400/30 text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-300'
      }
    });
  }
}

// Escuchar evento cuando la app ya fue instalada
window.addEventListener('appinstalled', () => {
  console.log('[PWA v71] App IGR KIDS instalada con éxito en el dispositivo.');
  sessionStorage.setItem('pwa_banner_dismissed', 'true');
  dismissPwaModal(false);
  const btnInstall = document.getElementById('btnInstallPwa');
  if (btnInstall) btnInstall.classList.add('hidden');
});

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initPWA();
});

function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=71')
        .then(reg => {
          console.log('[PWA v71] Service Worker registrado:', reg.scope);
        })
        .catch(err => {
          console.warn('[PWA] Error registrando Service Worker:', err);
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA v71] Nuevo Service Worker activo, recargando...');
      window.location.reload();
    });
  }

  // Ocultar botón del header si ya se encuentra en standalone
  if (isPwaStandalone()) {
    const btnInstall = document.getElementById('btnInstallPwa');
    if (btnInstall) btnInstall.classList.add('hidden');
  }

  // Auto-disparo del modal flotante / cartel a los 1.5s si no está en standalone ni fue descartado
  setTimeout(() => {
    showPwaInstallModal();
  }, 1500);
}

function initApp() {
  // Listeners reactivos para estado de red en vivo (Online / Offline)
  window.addEventListener('online', updateConnectionBadge);
  window.addEventListener('offline', updateConnectionBadge);
  updateConnectionBadge();

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

  // Filter estado listener
  const filterEstadoSelect = document.getElementById('filterEstado');
  if (filterEstadoSelect) {
    filterEstadoSelect.addEventListener('change', (e) => {
      state.filterEstado = e.target.value;
      renderKidsList();
    });
  }

  // Search input listeners (debounced via handleSearchInput)
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleSearchInput(e.target.value);
    });
  }

  // Auto infinite scroll when scrolling down through kids list
  window.addEventListener('scroll', () => {
    if (state.activeTab !== 'asistencia') return;
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 400) {
      if (state.kidsRenderLimit < state.ninos.length) {
        loadMoreKids();
      }
    }
  }, { passive: true });

  // Inicializar modo de vista guardado en Presentes Hoy
  setPresentesViewMode(state.presentesViewMode);

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
// ULTRA-FAST GOOGLE APPS SCRIPT CALLER (DIRECT HIGH-SPEED JSONP)
// ==========================================================================
function callGoogleAppsScript(params, timeoutMs = 25000) {
  const urlBase = state.scriptUrl || DEFAULT_SCRIPT_URL;
  if (!urlBase) return Promise.reject(new Error('No hay URL de Google Apps Script configurada'));

  return new Promise((resolve, reject) => {
    const callbackName = 'gas_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const searchParams = new URLSearchParams(params);
    searchParams.set('callback', callbackName);
    
    const jsonpUrl = `${urlBase}${urlBase.includes('?') ? '&' : '?'}${searchParams.toString()}`;
    
    let isSettled = false;
    const script = document.createElement('script');
    script.src = jsonpUrl;
    script.async = true;

    const timeoutId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error('El servidor de Google Sheets tardó en responder. Por favor intente nuevamente.'));
      }
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeoutId);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    window[callbackName] = function(data) {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        resolve(data);
      }
    };

    script.onerror = function() {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error('Error de conexión con Google Apps Script.'));
      }
    };

    document.head.appendChild(script);
  });
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
  btnText.textContent = 'INGRESANDO...';

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
          authUser = data.user || { usuario: usuarioInput, nombre: 'Equipo IGR KIDS', rol: 'Maestra' };
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
          authUser = { usuario: 'igrkids2026', nombre: 'Equipo IGR KIDS', rol: 'Administrador' };
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
        authUser = { usuario: 'igrkids2026', nombre: 'Equipo IGR KIDS (Modo Local)', rol: 'Administrador' };
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
  btnText.textContent = 'INGRESANDO...';

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

// ==========================================================================
// PRE-INDEXED HIGH-SPEED SEARCH & INSTANT CACHE ENGINE
// ==========================================================================
function getAnyRecentBackup() {
  try {
    const master = localStorage.getItem('asistencia_padron_master');
    if (master) {
      const parsed = JSON.parse(master);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('backup_ninos_')) {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    }
  } catch (e) {}
  return null;
}

function prepareKidsIndex(ninos) {
  if (!Array.isArray(ninos)) return [];
  const storedLocal = getLocalAttendance(state.selectedDate, state.selectedTurno);

  return ninos.map(n => {
    if (storedLocal && storedLocal[n.id] !== undefined) {
      n.presente = storedLocal[n.id].presente;
      n.horaIngreso = storedLocal[n.id].horaIngreso;
      if (storedLocal[n.id].sala) n.salaActual = storedLocal[n.id].sala;
    }

    const normName = normalizarTexto(n.nombre || '');
    const normPapas = normalizarTexto(n.nombrePapas || '');
    const normSala = normalizarTexto(n.salaActual || n.salaSugerida || '');
    const digits = (n.telefono || '').replace(/\D/g, '');

    n._normName = normName;
    n._normPapas = normPapas;
    n._normSala = normSala;
    n._digits = digits;
    n._searchIndex = `${normName} ${normPapas} ${normSala} ${digits}`;
    n._edadLimpia = formatearEdad(n.edad);
    return n;
  });
}

async function fetchData(showToast = false) {
  if (!state.isAuthenticated) return;

  // ⚡ 1. Renderizado INSTANTÁNEO (0 ms) desde Respaldo Local si la lista está vacía
  if (state.ninos.length === 0) {
    const cached = getLocalDataBackup(state.selectedDate, state.selectedTurno) || 
                   getLocalDataBackup(state.selectedDate) || 
                   getAnyRecentBackup();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log(`[Cache Ultra-Rápido] Cargando ${cached.length} niños desde memoria local`);
      state.ninos = prepareKidsIndex(cached);
      updateUI();
    }
  }

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

    state.ninos = prepareKidsIndex(state.ninos);
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

    if (data && data.success && Array.isArray(data.ninos)) {
      state.ninos = prepareKidsIndex(data.ninos);
      saveLocalDataBackup(state.selectedDate, state.selectedTurno, state.ninos);
      updateUI();
      if (showToast) {
        showToastNotification(`Sincronizado con Google Sheets (${state.selectedTurno})`, 'success');
      }
    } else {
      throw new Error(data ? data.message : 'Error al obtener datos');
    }
  } catch (error) {
    console.warn('Error al conectar con Google Sheets, usando respaldo local:', error);
    const cachedBackup = getLocalDataBackup(state.selectedDate, state.selectedTurno) || getAnyRecentBackup();
    if (cachedBackup && cachedBackup.length > 0) {
      state.ninos = prepareKidsIndex(cachedBackup);
      showToastNotification(`Modo sin conexión: datos cargados (${state.selectedTurno})`, 'warning');
    } else if (state.ninos.length === 0) {
      state.ninos = prepareKidsIndex(DEMO_NINOS);
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
    // Guardar también en padrón maestro permanente para arranque instantáneo (0ms)
    localStorage.setItem('asistencia_padron_master', JSON.stringify(list));
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

  // ⚡ ACTUALIZACIÓN ULTRA RÁPIDA (0.1ms) en el DOM sin re-renderizar los 519 niños:
  const cardElem = document.getElementById(`kid-card-${child.id}`);
  const rowElem = document.getElementById(`kid-row-${child.id}`);
  if (cardElem) {
    const temp = document.createElement('div');
    temp.innerHTML = createKidCardHTML(child);
    if (temp.firstElementChild) cardElem.replaceWith(temp.firstElementChild);
  } else if (rowElem) {
    const temp = document.createElement('tbody');
    temp.innerHTML = createKidTableRowHTML(child);
    if (temp.firstElementChild) rowElem.replaceWith(temp.firstElementChild);
  } else {
    renderKidsList();
  }

  // Actualizar contadores KPI inmediatamente (0ms)
  updateStats();

  // Si está en la pestaña Presentes Hoy, actualizar la lista
  if (state.activeTab === 'presentes') {
    renderPresentesList();
  }

  // Guardar en respaldo local en segundo plano
  saveLocalDataBackup(state.selectedDate, state.selectedTurno, state.ninos);

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

function normalizarTexto(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
const normalizeStr = normalizarTexto; // Retrocompatibilidad

/**
 * Calcula la relevancia de búsqueda priorizando el nombre del niño sobre el de los padres
 * 0-9: Coincidencia en el nombre del niño (Prioridad Máxima)
 * 10-19: Coincidencia en los datos de los padres (Prioridad Secundaria)
 * 20-29: Coincidencia en teléfono, sala u observaciones
 */
function getSearchScore(nino, normSearch, searchWords) {
  if (!normSearch) return 0;
  const name = nino._normName || normalizarTexto(nino.nombre || '');
  const papas = nino._normPapas || normalizarTexto(nino.nombrePapas || '');

  // 1. PRIORIDAD MÁXIMA: Coincidencia en el NOMBRE DEL NIÑO
  if (name === normSearch) return 0; // Nombre exacto
  if (name.startsWith(normSearch)) return 1; // Empieza con el texto buscado (ej: "Martin...")

  // Si alguna palabra del nombre del niño empieza con el texto (segundo nombre o apellido)
  const nameParts = name.split(/\s+/).filter(Boolean);
  if (nameParts.some(p => p.startsWith(normSearch))) return 2;

  // Si se ingresaron múltiples palabras y todas están en el nombre del niño
  if (searchWords && searchWords.length > 1 && searchWords.every(w => name.includes(w))) return 3;

  // Si el nombre del niño contiene el texto buscado
  if (name.includes(normSearch)) return 4;

  // Si al menos una palabra coincide en el nombre del niño
  if (searchWords && searchWords.length > 0 && searchWords.some(w => name.includes(w))) return 5;

  // 2. PRIORIDAD SECUNDARIA: Coincidencia en los PADRES
  if (papas === normSearch) return 10;
  if (papas.startsWith(normSearch)) return 11;

  const papasParts = papas.split(/\s+/).filter(Boolean);
  if (papasParts.some(p => p.startsWith(normSearch))) return 12;

  if (searchWords && searchWords.length > 1 && searchWords.every(w => papas.includes(w))) return 13;
  if (papas.includes(normSearch)) return 14;
  if (searchWords && searchWords.length > 0 && searchWords.some(w => papas.includes(w))) return 15;

  // 3. PRIORIDAD TERCIARIA: Coincidencia en teléfono o sala
  const digits = nino._digits || (nino.telefono || '').replace(/\D/g, '');
  const searchDigits = normSearch.replace(/\D/g, '');
  if (searchDigits && digits && digits.includes(searchDigits)) return 20;

  return 30;
}

function getFilteredKids() {
  const filterSelect = document.getElementById('filterEstado');
  if (filterSelect) {
    state.filterEstado = filterSelect.value;
  }

  const rawSearch = (state.searchTerm || '').trim();
  const normSearch = normalizarTexto(rawSearch);
  const searchWords = normSearch ? normSearch.split(/\s+/).filter(Boolean) : [];

  const results = state.ninos.filter(nino => {
    // Room Filter
    if (state.filterSala !== 'TODAS' && nino.salaSugerida !== state.filterSala && nino.salaActual !== state.filterSala) {
      return false;
    }

    // Status Filter
    if (state.filterEstado === 'SOLO_PRESENTES' && !nino.presente) return false;
    if (state.filterEstado === 'SOLO_AUSENTES' && nino.presente) return false;

    // ⚡ Instant Pre-Indexed Search (Sub-millisecond)
    if (normSearch) {
      if (!nino._searchIndex) {
        const normName = normalizarTexto(nino.nombre || '');
        const normPapas = normalizarTexto(nino.nombrePapas || '');
        const normSala = normalizarTexto(nino.salaActual || nino.salaSugerida || '');
        const digits = (nino.telefono || '').replace(/\D/g, '');
        nino._normName = normName;
        nino._normPapas = normPapas;
        nino._normSala = normSala;
        nino._digits = digits;
        nino._searchIndex = `${normName} ${normPapas} ${normSala} ${digits}`;
      }

      if (searchWords.length > 1) {
        for (let i = 0; i < searchWords.length; i++) {
          if (!nino._searchIndex.includes(searchWords[i])) return false;
        }
      } else {
        if (!nino._searchIndex.includes(normSearch)) return false;
      }
    }

    return true;
  });

  // 🎯 Priorización Inteligente de Resultados:
  // Si hay búsqueda activa, mostrar primero los que coinciden en el nombre del niño y luego en los padres
  if (normSearch && results.length > 1) {
    results.sort((a, b) => {
      const scoreA = getSearchScore(a, normSearch, searchWords);
      const scoreB = getSearchScore(b, normSearch, searchWords);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
  }

  return results;
}

function loadMoreKids() {
  state.kidsRenderLimit = (state.kidsRenderLimit || 36) + 36;
  renderKidsList();
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
    if (gridContainer) gridContainer.innerHTML = '';
    if (tableBody) tableBody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  // ⚡ Límite de renderizado incremental para evitar congelamiento de pantalla
  const limit = state.kidsRenderLimit || 36;
  const visibleKids = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  if (state.viewMode === 'grid') {
    if (gridContainer) {
      gridContainer.classList.remove('hidden');
      if (tableContainer) tableContainer.classList.add('hidden');

      let cardsHTML = visibleKids.map(nino => createKidCardHTML(nino)).join('');

      if (hasMore) {
        const remaining = filtered.length - limit;
        cardsHTML += `
          <div class="col-span-full py-6 flex flex-col items-center justify-center gap-2">
            <button onclick="loadMoreKids()" class="inline-flex items-center gap-2.5 px-6 py-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-950 font-black rounded-2xl shadow-md transition-all cursor-pointer text-sm">
              <i class="fa-solid fa-arrow-down animate-bounce"></i>
              <span>Cargar más niños (+${remaining > 36 ? 36 : remaining} de ${remaining} restantes)</span>
            </button>
            <p class="text-xs text-slate-400 font-medium">Tip: Escribe en el buscador para encontrar al instante.</p>
          </div>
        `;
      }

      gridContainer.innerHTML = cardsHTML;
    }
  } else {
    if (tableContainer && tableBody) {
      if (gridContainer) gridContainer.classList.add('hidden');
      tableContainer.classList.remove('hidden');

      let rowsHTML = visibleKids.map(nino => createKidTableRowHTML(nino)).join('');

      if (hasMore) {
        const remaining = filtered.length - limit;
        rowsHTML += `
          <tr>
            <td colspan="5" class="py-4 text-center bg-amber-50/50">
              <button onclick="loadMoreKids()" class="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-xl text-xs shadow-sm cursor-pointer">
                <i class="fa-solid fa-arrow-down"></i>
                <span>Cargar más (${remaining} restantes)</span>
              </button>
            </td>
          </tr>
        `;
      }

      tableBody.innerHTML = rowsHTML;
    }
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

/**
 * Formatea valores u objetos Date de hora crudos (ej: Date 1899, HH:mm, etc.) a texto legible "HH:mm hs"
 */
function formatearHora(horaRaw) {
  if (!horaRaw) return '';
  const str = String(horaRaw).trim();
  if (!str) return '';

  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    return `${hh}:${mm} hs`;
  }

  return str.includes('hs') ? str : `${str} hs`;
}

function createKidCardHTML(nino) {
  const isPresent = nino.presente;
  const initials = getInitials(nino.nombre);
  const colorClass = getAvatarColor(nino.nombre);
  const highlightedName = highlightMatch(nino.nombre, state.searchTerm);
  const highlightedPapas = highlightMatch(nino.nombrePapas, state.searchTerm);
  const edadLimpia = formatearEdad(nino.edad);
  const horaLimpia = formatearHora(nino.horaIngreso);

  return `
    <div id="kid-card-${nino.id}" class="kid-card rounded-3xl p-4 sm:p-5 shadow-sm relative flex flex-col justify-between transition-all ${isPresent ? 'kid-card-present' : 'bg-white border-amber-100'}">
      
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
              <span>Presente ${horaLimpia ? `(${horaLimpia})` : ''}</span>
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
  const horaLimpia = formatearHora(nino.horaIngreso);

  return `
    <tr id="kid-row-${nino.id}" class="hover:bg-amber-50/30 transition-colors ${isPresent ? 'bg-emerald-50/30' : ''}">
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
            <i class="fa-solid fa-circle-check text-emerald-600"></i> Presente ${horaLimpia ? `(${horaLimpia})` : ''}
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

function setPresentesViewMode(mode) {
  state.presentesViewMode = mode || 'grid';
  localStorage.setItem('igr_presentes_view_mode', state.presentesViewMode);
  
  const btnGrid = document.getElementById('btnPresentesViewGrid');
  const btnTable = document.getElementById('btnPresentesViewTable');

  if (btnGrid && btnTable) {
    if (state.presentesViewMode === 'grid') {
      btnGrid.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-amber-950 shadow-sm transition-all cursor-pointer font-bold';
      btnTable.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer font-medium';
    } else {
      btnGrid.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer font-medium';
      btnTable.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-amber-950 shadow-sm transition-all cursor-pointer font-bold';
    }
  }

  renderPresentesList();
}

function handleSearchPresentes(val) {
  state.presentesSearchTerm = (val || '').trim();
  const btnClear = document.getElementById('btnClearSearchPresentes');
  if (btnClear) {
    if (state.presentesSearchTerm) {
      btnClear.classList.remove('hidden');
    } else {
      btnClear.classList.add('hidden');
    }
  }
  renderPresentesList();
}

function clearSearchPresentes() {
  const input = document.getElementById('searchPresentesInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  handleSearchPresentes('');
}

function renderPresentesList() {
  const allPresentes = state.ninos.filter(n => n.presente);
  const term = normalizarTexto(state.presentesSearchTerm || '').toLowerCase();
  const cleanDigits = term.replace(/\D/g, '');

  const presentes = allPresentes.filter(n => {
    if (!term) return true;
    const nombre = normalizarTexto(n.nombre || '').toLowerCase();
    const papas = normalizarTexto(n.nombrePapas || '').toLowerCase();
    const telClean = (n.telefono || '').replace(/\D/g, '');
    const telRaw = (n.telefono || '').toLowerCase();
    const sala = normalizarTexto(n.salaActual || n.salaSugerida || '').toLowerCase();
    const obs = normalizarTexto(n.observacionesMedicas || '').toLowerCase();

    const matchPhone = cleanDigits.length >= 2 && telClean.includes(cleanDigits);
    return nombre.includes(term) || papas.includes(term) || matchPhone || telRaw.includes(term) || sala.includes(term) || obs.includes(term);
  });

  // 🎯 Priorización Inteligente en Presentes: niño primero, luego padres
  if (term && presentes.length > 1) {
    const searchWords = term.split(/\s+/).filter(Boolean);
    presentes.sort((a, b) => {
      const scoreA = getSearchScore(a, term, searchWords);
      const scoreB = getSearchScore(b, term, searchWords);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
  }

  const gridCont = document.getElementById('presentesGridContainer');
  const tableCont = document.getElementById('presentesTableContainer');
  const tbody = document.getElementById('presentesTableBody');
  const empty = document.getElementById('presentesEmptyState');
  const emptyTitle = document.getElementById('presentesEmptyTitle');
  const emptySub = document.getElementById('presentesEmptySubtitle');
  const badgeCount = document.getElementById('badgeCountPresentesFilter');

  if (badgeCount) {
    if (term && allPresentes.length > 0) {
      badgeCount.textContent = `${presentes.length} de ${allPresentes.length} presentes`;
    } else {
      badgeCount.textContent = `${allPresentes.length} ${allPresentes.length === 1 ? 'presente' : 'presentes'}`;
    }
  }

  if (presentes.length === 0) {
    if (gridCont) gridCont.classList.add('hidden');
    if (tableCont) tableCont.classList.add('hidden');
    if (empty) {
      empty.classList.remove('hidden');
      if (allPresentes.length > 0 && term) {
        if (emptyTitle) emptyTitle.textContent = `No se encontró a "${state.presentesSearchTerm}" en presentes`;
        if (emptySub) emptySub.textContent = 'Verifica que el nombre de los papás, niño o teléfono esté bien escrito.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'Aún no hay niños marcados como presentes hoy';
        if (emptySub) emptySub.textContent = 'Ve a la pestaña "Toma de Asistencia" para comenzar a marcar los ingresos del domingo.';
      }
    }
    return;
  }

  if (empty) empty.classList.add('hidden');

  if (state.presentesViewMode === 'table') {
    if (gridCont) gridCont.classList.add('hidden');
    if (tableCont) tableCont.classList.remove('hidden');
    if (tbody) {
      tbody.innerHTML = presentes.map((nino, index) => {
        const horaStr = formatearHora(nino.horaIngreso) || '--:--';
        const horaDisplay = horaStr.includes('hs') ? horaStr : `${horaStr} hs`;
        const salaStr = nino.salaActual || nino.salaSugerida || 'General';
        const papasStr = nino.nombrePapas || 'Familia';

        return `
          <tr class="hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4 font-mono font-bold text-slate-400 text-xs">${index + 1}</td>
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${highlightMatch(nino.nombre, state.presentesSearchTerm)}</div>
              ${nino.observacionesMedicas ? `<div class="text-[11px] text-amber-700 font-medium flex items-center gap-1"><i class="fa-solid fa-notes-medical"></i> ${nino.observacionesMedicas}</div>` : ''}
            </td>
            <td class="py-3 px-4 font-mono font-bold text-emerald-700 text-sm">
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs">
                <i class="fa-regular fa-clock text-xs text-emerald-600"></i> ${horaDisplay}
              </span>
            </td>
            <td class="py-3 px-4">
              <span class="inline-block px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">${salaStr}</span>
            </td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-700">${highlightMatch(papasStr, state.presentesSearchTerm)}</td>
            <td class="py-3 px-4 font-mono text-xs font-bold text-amber-900">${nino.telefono || 'Sin teléfono'}</td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center gap-2">
                <button onclick="openWhatsAppModal('${nino.id}')" class="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer" title="Contactar familia por WhatsApp">
                  <i class="fa-brands fa-whatsapp text-sm"></i>
                  <span>WhatsApp</span>
                </button>
                <button onclick="toggleAsistencia('${nino.id}')" class="px-2.5 py-2 text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 rounded-xl text-xs font-semibold transition-all cursor-pointer" title="Desmarcar / Anular Ingreso">
                  <i class="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } else {
    // Mode 'grid' (Recuadros / Tarjetas)
    if (tableCont) tableCont.classList.add('hidden');
    if (gridCont) {
      gridCont.classList.remove('hidden');
      gridCont.innerHTML = presentes.map((nino, index) => {
        const horaStr = formatearHora(nino.horaIngreso) || `${getCurrentTime()}`;
        const horaDisplay = horaStr.includes('hs') ? horaStr : `${horaStr} hs`;
        const salaStr = nino.salaActual || nino.salaSugerida || 'General';
        const papasStr = nino.nombrePapas || 'Familia';

        return `
          <div class="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group animate-fadeIn">
            <div>
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="w-12 h-12 rounded-2xl ${getAvatarColor(nino.nombre)} flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                    ${getInitials(nino.nombre)}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="font-black font-['Outfit'] text-base text-slate-900 leading-snug truncate">${highlightMatch(nino.nombre, state.presentesSearchTerm)}</h3>
                    <div class="flex items-center gap-1.5 flex-wrap mt-1">
                      <span class="inline-block px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">${salaStr}</span>
                      ${nino.edad ? `<span class="text-[11px] font-semibold text-slate-400">${formatearEdad(nino.edad)}</span>` : ''}
                    </div>
                  </div>
                </div>
                <!-- Hora de ingreso destacada -->
                <div class="text-right shrink-0">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                    <i class="fa-regular fa-clock text-xs text-emerald-600"></i>
                    <span>${horaDisplay}</span>
                  </span>
                  <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mt-1">Ingresó Hoy</div>
                </div>
              </div>

              ${nino.observacionesMedicas ? `
                <div class="mt-3.5 text-xs bg-amber-50/80 p-2.5 rounded-2xl border border-amber-200 text-amber-900 flex items-start gap-2">
                  <i class="fa-solid fa-notes-medical text-amber-600 mt-0.5 shrink-0 text-xs"></i>
                  <span><strong>Médico:</strong> ${nino.observacionesMedicas}</span>
                </div>
              ` : ''}

              <!-- Información de Papás y Contacto -->
              <div class="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
                    <i class="fa-solid fa-user-group text-emerald-600"></i> Papás:
                  </span>
                  <span class="font-bold text-slate-800 text-right truncate max-w-[180px] text-xs">
                    ${highlightMatch(papasStr, state.presentesSearchTerm)}
                  </span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
                    <i class="fa-solid fa-phone text-emerald-600"></i> Teléfono:
                  </span>
                  <span class="font-mono font-bold text-emerald-950 text-xs">${nino.telefono || 'Sin teléfono'}</span>
                </div>
              </div>
            </div>

            <!-- Botones de Acción: WhatsApp destacado y Desmarcar -->
            <div class="mt-5 pt-3.5 border-t border-slate-100 flex items-center gap-2">
              <button onclick="openWhatsAppModal('${nino.id}')" class="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] text-white font-black rounded-2xl shadow-md shadow-emerald-500/25 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer" title="Contactar a los padres por WhatsApp">
                <i class="fa-brands fa-whatsapp text-lg"></i>
                <span>WhatsApp Papás</span>
              </button>
              <button onclick="toggleAsistencia('${nino.id}')" class="py-3 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 active:scale-[0.98] rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5" title="Desmarcar / Anular Ingreso de hoy">
                <i class="fa-solid fa-user-xmark"></i>
                <span class="hidden sm:inline">Desmarcar</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// ==========================================================================
// WHATSAPP MESSAGING MODAL & PRESETS
// ==========================================================================
function openWhatsAppModal(childId) {
  const child = state.ninos.find(n => n.id === childId);
  if (!child) return;

  state.selectedChildForWa = child;
  state.selectedWaPresetTitle = 'Acercarse a la sala';
  state.isWaCustomModified = false;

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
      state.selectedWaPresetTitle = 'Acercarse a la sala';
      text = `Hola ${papas}, te escribimos desde IGR KIDS. Necesitamos que por favor te acerques un momento por ${nombreNino}. ¡Muchas gracias!`;
      break;
    case 2:
      state.selectedWaPresetTitle = 'Cambio de pañal / ropa';
      text = `Hola ${papas}, te avisamos desde IGR KIDS que ${nombreNino} necesita un cambio de pañal / ropa. Te esperamos en la sala.`;
      break;
    case 3:
      state.selectedWaPresetTitle = 'No se calma / Extraña';
      text = `Hola ${papas}, te escribimos desde IGR KIDS: ${nombreNino} está un poco triste y extrañando. ¿Podrías acercarte un momento a la sala para acompañarlo/a?`;
      break;
    case 4:
      state.selectedWaPresetTitle = 'Fin de la clase / Retiro';
      text = `¡Hola ${papas}! Te avisamos desde IGR KIDS que la reunión ha finalizado y ya pueden pasar a retirar a ${nombreNino} por su sala. ¡Muchas gracias!`;
      break;
    default:
      state.selectedWaPresetTitle = 'Acercarse a la sala';
      text = `Hola ${papas}, te contactamos desde IGR KIDS por ${nombreNino}.`;
  }

  state.isWaCustomModified = false;
  document.getElementById('waCustomMessage').value = text;
}

function registrarLogWhatsApp(data = {}) {
  try {
    const child = data.child || state.selectedChildForWa || {};
    const phone = data.telefono || data.phone || (child.telefono ? String(child.telefono).replace(/\D/g, '') : '');
    const message = data.mensaje || data.message || '';

    const motivo = data.motivo || (state.isWaCustomModified
      ? `${state.selectedWaPresetTitle || 'Personalizado'} (Editado)`
      : (state.selectedWaPresetTitle || 'Mensaje Personalizado'));

    const payload = {
      action: 'registrarAvisoWhatsApp',
      fecha: data.fecha || state.selectedDate || getTodayString(),
      hora: data.hora || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      turno: data.turno || state.selectedTurno || '10:00 hs (Mañana)',
      maestro: data.maestro || (state.currentUser ? (state.currentUser.nombre || state.currentUser.usuario) : 'Equipo IGR KIDS'),
      idNino: data.idNino || child.id || '',
      nombreNino: data.nombreNino || child.nombre || '',
      sala: data.sala || child.salaActual || child.salaSugerida || 'General',
      nombrePapas: data.nombrePapas || child.nombrePapas || 'Familia',
      telefono: phone,
      motivo: motivo,
      mensaje: message,
      token: state.sessionToken || ''
    };

    if (!state.scriptUrl) return;

    fetch(state.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
      mode: 'no-cors'
    }).catch(err => {
      console.warn('Sync WhatsApp log in background:', err);
    });
  } catch (err) {
    console.warn('Error registrarLogWhatsApp:', err);
  }
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

  // Registrar aviso en Google Sheets en segundo plano
  registrarLogWhatsApp({
    child,
    telefono: phone,
    mensaje: message,
    fecha: state.selectedDate || getTodayString(),
    hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    turno: state.selectedTurno || '10:00 hs (Mañana)',
    maestro: state.currentUser ? (state.currentUser.nombre || state.currentUser.usuario) : 'Equipo IGR KIDS',
    idNino: child.id,
    nombreNino: child.nombre,
    sala: child.salaActual || child.salaSugerida || 'General',
    nombrePapas: child.nombrePapas || 'Familia',
    motivo: state.isWaCustomModified ? `${state.selectedWaPresetTitle || 'Personalizado'} (Editado)` : (state.selectedWaPresetTitle || 'Mensaje Personalizado')
  });

  showToastNotification('Aviso registrado. Abriendo WhatsApp...', 'success');

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

  // Pre-indexar inmediatamente para que aparezca al instante en el buscador
  prepareKidsIndex([newChildObj]);
  state.ninos.unshift(newChildObj);

  if (autoMarcar) {
    saveLocalAttendance(state.selectedDate, newChildObj.id, true, newChildObj.horaIngreso, sala, state.selectedTurno);
  }

  saveLocalDataBackup(state.selectedDate, state.selectedTurno, state.ninos);
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
    'Hora Ingreso': formatearHora(n.horaIngreso) || '',
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
  const fileName = `Asistencia_IGR_KIDS_${state.selectedDate}_${cleanTurno}.xlsx`;
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
  doc.text("Planilla de Asistencia - IGR KIDS", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha: ${state.selectedDate} | Turno: ${state.selectedTurno} | Total: ${presentes.length} presentes`, 14, 26);

  const tableData = presentes.map((n, i) => [
    i + 1,
    n.nombre,
    formatearHora(n.horaIngreso) || '--:--',
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
  doc.save(`Asistencia_IGR_KIDS_${state.selectedDate}_${cleanTurno}.pdf`);
  showToastNotification('Generando Roster PDF...', 'success');
}

function printAttendanceRoster() {
  window.print();
}

function copyWhatsAppReport() {
  const presentes = state.ninos.filter(n => n.presente);
  
  let attendeesList = '';
  if (presentes.length === 0) {
    attendeesList = '_(Sin asistentes registrados)_';
  } else {
    attendeesList = presentes.map((n, idx) => {
      const sala = n.salaActual || n.salaSugerida || 'General';
      const hora = formatearHora(n.horaIngreso) || `${getCurrentTime()} hs`;
      return `${idx + 1}. *${n.nombre}* - ${sala} (${hora})`;
    }).join('\n');
  }

  const message = `📊 *REPORTE DE ASISTENCIA DE NIÑOS*\n` +
    `🗓 *Fecha:* ${state.selectedDate}\n` +
    `⏰ *Turno / Reunión:* ${state.selectedTurno}\n\n` +
    `✅ *Total Presentes:* ${presentes.length}\n\n` +
    `📍 *Asistentes:*\n${attendeesList}\n\n` +
    `_Generado automáticamente desde IGR KIDS_`;

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
// CONNECTION STATUS
// ==========================================================================
function updateConnectionBadge() {
  const dot = document.getElementById('connectionDot');
  const badge = document.getElementById('connectionBadge');
  const text = document.getElementById('connectionText');
  const banner = document.getElementById('statusBanner');

  const isOnline = Boolean(navigator.onLine);

  // Actualizar círculo indicador visual #connectionDot
  if (dot) {
    if (isOnline && !(state && state.demoMode)) {
      dot.className = 'w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40 animate-pulse inline-block transition-colors duration-300';
      dot.title = 'Conectado a Internet (Online)';
    } else if (!isOnline) {
      dot.className = 'w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/40 inline-block transition-colors duration-300';
      dot.title = 'Sin conexión a Internet (Offline)';
    } else {
      // En línea pero en modo demo/local
      dot.className = 'w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/40 inline-block transition-colors duration-300';
      dot.title = 'Modo Local / Demo';
    }
  }

  // Fallback de retrocompatibilidad si existiera el badge de texto
  if (badge && text) {
    if (!isOnline) {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-200';
      text.textContent = 'Offline';
    } else if (state && state.demoMode) {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200';
      text.textContent = 'Modo Local';
    } else {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200';
      text.textContent = 'Online';
    }
  }

  if (banner) {
    if ((state && state.demoMode) || !(state && state.scriptUrl) || !isOnline) {
      banner.classList.remove('hidden');
      const bannerText = document.getElementById('statusBannerText');
      if (bannerText) {
        if (!isOnline) {
          bannerText.textContent = 'Sin conexión a Internet. Las acciones se sincronizarán al reconectar.';
        } else if (state && state.demoMode) {
          bannerText.textContent = 'Modo de demostración activo con datos de prueba.';
        }
      }
    } else {
      banner.classList.add('hidden');
    }
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

// ==========================================================================
// FILTRO DESPLEGABLE DE EDADES / SALAS (PROTOCOLO CORPORATIVO V54)
// ==========================================================================

function toggleEdadesDropdown(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const menu = document.getElementById('edadesDropdownMenu');
  const chevron = document.getElementById('btnEdadesChevron');
  const btn = document.getElementById('btnEdadesFilter');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotate-180');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    menu.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

function closeEdadesDropdown() {
  const menu = document.getElementById('edadesDropdownMenu');
  const chevron = document.getElementById('btnEdadesChevron');
  const btn = document.getElementById('btnEdadesFilter');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

function selectEdadFilter(salaKey, label) {
  state.filterSala = salaKey;

  // Actualizar texto del botón principal "Edades"
  const btnText = document.getElementById('btnEdadesText');
  if (btnText) {
    if (salaKey === 'TODAS') {
      btnText.textContent = 'Edades';
    } else {
      btnText.textContent = `Edades: ${label}`;
    }
  }

  // Actualizar estilos e icono check en las opciones del menú
  document.querySelectorAll('#edadesDropdownMenu .edad-option-btn').forEach(btn => {
    const isSelected = btn.getAttribute('data-sala') === salaKey;
    const check = btn.querySelector('.check-indicator');
    if (isSelected) {
      btn.classList.add('bg-slate-800/80', 'text-amber-400');
      btn.classList.remove('text-slate-200');
      if (check) check.classList.remove('hidden');
    } else {
      btn.classList.remove('bg-slate-800/80', 'text-amber-400');
      btn.classList.add('text-slate-200');
      if (check) check.classList.add('hidden');
    }
  });

  // Compatibilidad con selectores de sala alternativos si existieran
  document.querySelectorAll('#roomFilters .filter-pill').forEach(btn => {
    if (btn.getAttribute('data-sala') === salaKey) {
      btn.classList.add('active-pill');
    } else {
      btn.classList.remove('active-pill');
    }
  });

  closeEdadesDropdown();
  renderKidsList();
}

function setFilterSala(salaName) {
  let label = 'Todas las Edades';
  if (salaName === 'Sala Cunas (0-2 años)') label = '0 a 2 años';
  else if (salaName === 'Párvulos (3-5 años)') label = '3 a 5 años';
  else if (salaName === 'Primarios (6-8 años)') label = '6 a 8 años';
  else if (salaName === 'Pre-Adolescentes (9-12 años)') label = '9 a 12 años';
  selectEdadFilter(salaName, label);
}

function setViewMode(mode) {
  state.viewMode = mode;
  const gridBtn = document.getElementById('viewGridBtn');
  const tableBtn = document.getElementById('viewTableBtn');

  if (gridBtn && tableBtn) {
    if (mode === 'grid') {
      gridBtn.className = 'p-1.5 rounded-lg text-amber-400 bg-slate-800 shadow-sm font-bold transition-all cursor-pointer';
      tableBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer';
    } else {
      tableBtn.className = 'p-1.5 rounded-lg text-amber-400 bg-slate-800 shadow-sm font-bold transition-all cursor-pointer';
      gridBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer';
    }
  }
  renderKidsList();
}

// Eventos globales para cierre del dropdown de Edades
document.addEventListener('click', (e) => {
  const container = document.getElementById('edadesDropdownContainer');
  if (container && !container.contains(e.target)) {
    closeEdadesDropdown();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEdadesDropdown();
  }
});

let searchDebounceTimer = null;

function handleSearchInput(val) {
  state.searchTerm = val || '';
  toggleClearSearchBtn(state.searchTerm.trim().length > 0);

  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    state.kidsRenderLimit = 36;
    renderKidsList();
  }, 90);
}

function handleFilterEstadoChange(val) {
  state.filterEstado = val || 'TODOS';
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
  if (!term || !term.trim()) return String(text);

  const termNorm = normalizarTexto(term);
  if (!termNorm) return String(text);

  try {
    const rawWords = termNorm.split(/\s+/).filter(w => w.length > 0);
    if (rawWords.length === 0) return String(text);

    const charMap = {
      'a': '[aáàäâã]',
      'e': '[eéèëê]',
      'i': '[iíìïî]',
      'o': '[oóòöôõ]',
      'u': '[uúùüû]',
      'n': '[nñ]',
      'c': '[cç]'
    };

    const patterns = rawWords.map(word => {
      return word.split('').map(ch => {
        return charMap[ch] || ch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      }).join('');
    });

    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    return String(text).replace(regex, '<mark class="search-highlight">$1</mark>');
  } catch (e) {
    return String(text);
  }
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

// ==========================================================================
// INTERACTIVE ESTADÍSTICAS TOGGLE
// ==========================================================================
function toggleEstadisticas() {
  const seccion = document.getElementById('seccionEstadisticas');
  const btn = document.getElementById('btnToggleEstadisticas');
  const chevron = document.getElementById('iconChevronEstadisticas');
  if (!seccion) return;

  const isHidden = seccion.classList.contains('hidden');
  if (isHidden) {
    seccion.classList.remove('hidden');
    if (btn) {
      btn.classList.add('bg-amber-100/80', 'border-amber-400', 'text-amber-950', 'ring-2', 'ring-amber-300/40');
      btn.classList.remove('bg-white');
    }
    if (chevron) {
      chevron.classList.remove('fa-chevron-down');
      chevron.classList.add('fa-chevron-up');
    }
  } else {
    seccion.classList.add('hidden');
    if (btn) {
      btn.classList.remove('bg-amber-100/80', 'border-amber-400', 'text-amber-950', 'ring-2', 'ring-amber-300/40');
      btn.classList.add('bg-white');
    }
    if (chevron) {
      chevron.classList.remove('fa-chevron-up');
      chevron.classList.add('fa-chevron-down');
    }
  }
}

// ==========================================================================
// MÓDULO REPORTE PASTORES (AUDITORÍA DE AUSENTISMO Y ASISTENCIAS)
// ==========================================================================
let auditoriaState = {
  desbloqueado: false,
  periodoTipo: 'mes',
  filtroValor: '2026-09',
  datos: {
    totalPadron: 0,
    totalPresentes: 0,
    totalAusentes: 0,
    presentes: [],
    ausentes: []
  },
  pestanaActiva: 'ausentes',
  filtroTexto: ''
};

function abrirModalAuditoriaPrivada() {
  if (auditoriaState.desbloqueado) {
    mostrarModalAuditoria();
    return;
  }

  Swal.fire({
    title: '🔒 REPORTE PASTORES',
    html: `
      <div class="text-left text-xs sm:text-sm text-slate-600 mb-2">
        <p>Módulo de auditoría confidencial para pastores y coordinadores de <strong>IGR KIDS</strong>.</p>
        <p class="mt-2 text-slate-500 font-semibold">Ingresá la contraseña de seguridad para acceder:</p>
      </div>
    `,
    input: 'password',
    inputPlaceholder: 'Ingresá la clave de acceso...',
    inputAttributes: {
      autocapitalize: 'off',
      autocorrect: 'off'
    },
    showCancelButton: true,
    confirmButtonColor: '#ca8a04',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-key mr-1"></i> Desbloquear',
    cancelButtonText: 'Cancelar',
    showLoaderOnConfirm: true,
    preConfirm: (pass) => {
      const p = (pass || '').trim();
      if (!p) {
        Swal.showValidationMessage('Debes ingresar la contraseña de seguridad.');
        return false;
      }
      if (p === 'IGRKIDSADMIN2026' || p === 'IARAHACKER26' || (state.currentUser && state.currentUser.rol && state.currentUser.rol.includes('Admin'))) {
        return true;
      }
      Swal.showValidationMessage('Contraseña de seguridad incorrecta.');
      return false;
    }
  }).then((result) => {
    if (result.isConfirmed) {
      auditoriaState.desbloqueado = true;
      showToastNotification('Acceso concedido a Reporte Pastores', 'success');
      mostrarModalAuditoria();
      ejecutarConsultaAuditoria();
    }
  });
}

function mostrarModalAuditoria() {
  const modal = document.getElementById('modalPanelAuditoria');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function cerrarModalAuditoria() {
  const modal = document.getElementById('modalPanelAuditoria');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function cambiarTipoPeriodoAuditoria(tipo) {
  auditoriaState.periodoTipo = tipo;
  const mesContainer = document.getElementById('containerAuditoriaMes');
  const anioContainer = document.getElementById('containerAuditoriaAnio');

  if (tipo === 'mes') {
    if (mesContainer) mesContainer.classList.remove('hidden');
    if (anioContainer) anioContainer.classList.add('hidden');
  } else {
    if (mesContainer) mesContainer.classList.add('hidden');
    if (anioContainer) anioContainer.classList.remove('hidden');
  }
}

async function ejecutarConsultaAuditoria() {
  const tipo = auditoriaState.periodoTipo;
  const mes = document.getElementById('auditoriaMesSelect')?.value || '2026-09';
  const anio = document.getElementById('auditoriaAnioSelect')?.value || '2026';
  const filtroValor = tipo === 'mes' ? mes : anio;
  auditoriaState.filtroValor = filtroValor;

  const periodoLabel = document.getElementById('kpiAuditoriaPeriodoNombre');
  if (periodoLabel) {
    if (tipo === 'mes') {
      const mesesMap = {
        '2026-01': 'Enero 2026', '2026-02': 'Febrero 2026', '2026-03': 'Marzo 2026',
        '2026-04': 'Abril 2026', '2026-05': 'Mayo 2026', '2026-06': 'Junio 2026',
        '2026-07': 'Julio 2026', '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026'
      };
      periodoLabel.textContent = mesesMap[mes] || mes;
    } else {
      periodoLabel.textContent = `Año ${anio}`;
    }
  }

  const todosLosNinos = (state.ninos && state.ninos.length > 0) ? state.ninos : DEMO_NINOS;
  const total = todosLosNinos.length;

  let ausentes = [];
  let presentes = [];

  try {
    if (state.scriptUrl && !state.demoMode) {
      const url = `${state.scriptUrl}?action=getAuditoriaPeriodo&periodo=${tipo}&mes=${mes}&anio=${anio}&password=IGRKIDSADMIN2026`;
      const res = await fetch(url).catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        if (json && json.success) {
          ausentes = json.ausentes || [];
          presentes = json.presentes || [];
        }
      }
    }
  } catch (err) {
    console.warn('Auditoría remota error:', err);
  }

  if (ausentes.length === 0 && presentes.length === 0) {
    todosLosNinos.forEach(n => {
      if (n.presente) {
        presentes.push({
          id: n.id,
          nombre: n.nombre,
          edad: n.edad,
          sala: n.salaActual || n.salaSugerida || 'General',
          nombrePapas: n.nombrePapas || 'Familia',
          telefono: n.telefono || ''
        });
      } else {
        ausentes.push({
          id: n.id,
          nombre: n.nombre,
          edad: n.edad,
          sala: n.salaActual || n.salaSugerida || 'General',
          nombrePapas: n.nombrePapas || 'Familia',
          telefono: n.telefono || ''
        });
      }
    });
  }

  auditoriaState.datos = {
    totalPadron: total,
    totalPresentes: presentes.length,
    totalAusentes: ausentes.length,
    presentes: presentes,
    ausentes: ausentes
  };

  actualizarVistaAuditoria();
}

function actualizarVistaAuditoria() {
  const d = auditoriaState.datos;
  const pctPres = d.totalPadron > 0 ? Math.round((d.totalPresentes / d.totalPadron) * 100) : 0;
  const pctAus = d.totalPadron > 0 ? Math.round((d.totalAusentes / d.totalPadron) * 100) : 0;

  const kpiTotal = document.getElementById('kpiAuditoriaTotal');
  const kpiPres = document.getElementById('kpiAuditoriaPresentes');
  const kpiPresPct = document.getElementById('kpiAuditoriaPresentesPct');
  const kpiAus = document.getElementById('kpiAuditoriaAusentes');
  const kpiAusPct = document.getElementById('kpiAuditoriaAusentesPct');
  const badgeAus = document.getElementById('badgeAuditoriaAusentes');
  const badgePres = document.getElementById('badgeAuditoriaPresentes');

  if (kpiTotal) kpiTotal.textContent = d.totalPadron;
  if (kpiPres) kpiPres.textContent = d.totalPresentes;
  if (kpiPresPct) kpiPresPct.textContent = `${pctPres}% de asistencia`;
  if (kpiAus) kpiAus.textContent = d.totalAusentes;
  if (kpiAusPct) kpiAusPct.textContent = `${pctAus}% de ausentismo`;
  if (badgeAus) badgeAus.textContent = d.totalAusentes;
  if (badgePres) badgePres.textContent = d.totalPresentes;

  renderTablaAuditoria();
}

function cambiarPestanaAuditoria(pestana) {
  auditoriaState.pestanaActiva = pestana;
  const btnAus = document.getElementById('btnTabAuditoriaAusentes');
  const btnPres = document.getElementById('btnTabAuditoriaPresentes');

  if (pestana === 'ausentes') {
    if (btnAus) {
      btnAus.className = 'px-4 py-2 border-b-2 border-rose-500 text-rose-700 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
    }
    if (btnPres) {
      btnPres.className = 'px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
    }
  } else {
    if (btnAus) {
      btnAus.className = 'px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
    }
    if (btnPres) {
      btnPres.className = 'px-4 py-2 border-b-2 border-emerald-500 text-emerald-700 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
    }
  }

  renderTablaAuditoria();
}

function filtrarListaAuditoria(val) {
  auditoriaState.filtroTexto = (val || '').trim();
  renderTablaAuditoria();
}

function renderTablaAuditoria() {
  const tbody = document.getElementById('tablaAuditoriaBody');
  const emptyState = document.getElementById('auditoriaEmptyState');
  if (!tbody) return;

  const lista = auditoriaState.pestanaActiva === 'ausentes' 
    ? auditoriaState.datos.ausentes 
    : auditoriaState.datos.presentes;

  const term = normalizarTexto(auditoriaState.filtroTexto);
  const filtrados = lista.filter(n => {
    if (!term) return true;
    const nName = normalizarTexto(n.nombre || '');
    const nPapas = normalizarTexto(n.nombrePapas || '');
    const nTel = (n.telefono || '').replace(/\D/g, '');
    return nName.includes(term) || nPapas.includes(term) || nTel.includes(term);
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  tbody.innerHTML = filtrados.map((n, i) => {
    const esAusente = auditoriaState.pestanaActiva === 'ausentes';
    const telDigits = (n.telefono || '').replace(/\D/g, '');
    const hasTel = telDigits.length >= 8;

    return `
      <tr class="hover:bg-amber-50/40 transition-colors">
        <td class="py-2.5 px-3 font-semibold text-slate-400 text-[11px]">${i + 1}</td>
        <td class="py-2.5 px-3">
          <span class="font-bold text-slate-900">${n.nombre}</span>
          ${esAusente ? '<span class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">Sin Asistencia</span>' : '<span class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Presente</span>'}
        </td>
        <td class="py-2.5 px-3 text-slate-600">${n.sala || 'General'}</td>
        <td class="py-2.5 px-3 text-slate-700">${n.nombrePapas || 'No registrado'}</td>
        <td class="py-2.5 px-3 text-slate-600 font-mono text-[11px]">${n.telefono || '--'}</td>
        <td class="py-2.5 px-3 text-center">
          ${hasTel ? `
            <button onclick="enviarWhatsAppPastoral('${telDigits}', '${n.nombre.replace(/'/g, "\\'")}', '${(n.nombrePapas || '').replace(/'/g, "\\'")}')" class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl shadow-sm transition-all cursor-pointer">
              <i class="fa-brands fa-whatsapp text-xs"></i>
              <span>Escribir WhatsApp</span>
            </button>
          ` : `
            <span class="text-[11px] text-slate-400 italic">Sin teléfono</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function enviarWhatsAppPastoral(telefono, nombreNino, nombrePapas) {
  let num = telefono.replace(/\D/g, '');
  if (!num.startsWith('54') && num.length === 10) num = '549' + num;
  else if (num.startsWith('54') && !num.startsWith('549')) num = '549' + num.substring(2);

  const papas = nombrePapas ? `Hola ${nombrePapas}` : '¡Hola familia!';
  const periodoNombre = document.getElementById('kpiAuditoriaPeriodoNombre')?.textContent || 'este mes';

  const mensaje = `${papas}, te escribimos con mucho cariño desde *IGR KIDS* ❤️.\n\n` +
    `Notamos que *${nombreNino}* no pudo asistir durante ${periodoNombre} a nuestras reuniones de niños. Queríamos saber cómo están y decirles que los extrañamos un montón.\n\n` +
    `¡Los esperamos con los brazos abiertos este domingo! 🙌✨\n\n` +
    `_Equipo Pastoral y Maestros de IGR KIDS_`;

  window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

function exportarAuditoriaExcel() {
  const d = auditoriaState.datos;
  const lista = auditoriaState.pestanaActiva === 'ausentes' ? d.ausentes : d.presentes;
  const nombrePestana = auditoriaState.pestanaActiva === 'ausentes' ? 'Ausentes' : 'Presentes';
  const periodo = auditoriaState.filtroValor;

  if (!lista || lista.length === 0) {
    showToastNotification('No hay datos para exportar.', 'info');
    return;
  }

  const exportData = lista.map((n, i) => ({
    'N°': i + 1,
    'Período': periodo,
    'Estado': auditoriaState.pestanaActiva === 'ausentes' ? 'Sin Asistencia' : 'Con Asistencia',
    'Nombre Niño/a': n.nombre,
    'Sala / Grupo': n.sala || 'General',
    'Papás / Tutores': n.nombrePapas || '',
    'Teléfono': n.telefono || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, nombrePestana);

  const fileName = `Reporte_Pastores_${nombrePestana}_${periodo}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  showToastNotification(`Descargando ${fileName}`, 'success');
}

