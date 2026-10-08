/**
 * js/app.js
 * Controlador de Interfaz, Estado y Eventos
 */

// Estado global de la aplicación
const AppState = {
  dias: [
    { id: 'dia-1', nombre: 'Día 1', orden: 1 },
    { id: 'dia-2', nombre: 'Día 2', orden: 2 },
    { id: 'dia-3', nombre: 'Día 3', orden: 3 },
  ],
  diaActivoId: 'dia-1',
  // Memoria de eventos por día (dia_id => [eventos])
  eventosPorDia: {
    'dia-1': [
      { id: 'e1', dia_id: 'dia-1', hora_inicio: '08:30', duracion_minutos: 30, hora_fin: '09:00', tema: 'Registro y Acreditación', detalle: 'Entrega de credenciales', responsable: 'Staff', notas: 'Recepción A', orden: 1 },
      { id: 'e2', dia_id: 'dia-1', hora_inicio: '09:00', duracion_minutos: 45, hora_fin: '09:45', tema: 'Conferencia Inaugural', detalle: 'Apertura oficial del congreso', responsable: 'Dirección', notas: 'Auditorio Central', orden: 2 },
      { id: 'e3', dia_id: 'dia-1', hora_inicio: '09:45', duracion_minutos: 60, hora_fin: '10:45', tema: 'Track 1: Estrategia Digital', detalle: 'Panel de expertos en transformación', responsable: 'Ing. Carlos Pérez', notas: 'Sala Magna', orden: 3 },
      { id: 'e4', dia_id: 'dia-1', hora_inicio: '09:45', duracion_minutos: 60, hora_fin: '10:45', tema: 'Track 2: Taller de Liderazgo', detalle: 'Dinámicas ágiles para equipos', responsable: 'Lic. María González', notas: 'Sala B (Cupo limitado)', orden: 4 },
      { id: 'e5', dia_id: 'dia-1', hora_inicio: '10:45', duracion_minutos: 30, hora_fin: '11:15', tema: 'Coffee Break & Networking', detalle: 'Espacio de café y relacionamiento', responsable: 'Catering', notas: 'Terraza Principal', orden: 5 }
    ],
    'dia-2': [],
    'dia-3': []
  },
  isAdmin: false
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  await AuthManager.init();
  AppState.isAdmin = AuthManager.isAdmin;
  actualizarModoUI();

  // Intentar cargar datos desde Supabase
  await cargarDatosDeSupabase();

  // Renderizar vistas
  renderTabs();
  renderAgenda();
  setupEventListeners();
});

// CARGA DE DATOS DESDE SUPABASE (O FALLBACK LOCAL)
async function cargarDatosDeSupabase() {
  if (!supabaseClient) return;

  try {
    const { data: diasDb, error: diasErr } = await supabaseClient
      .from('dias')
      .select('*')
      .order('orden', { ascending: true });

    if (diasErr) throw diasErr;

    if (diasDb && diasDb.length > 0) {
      AppState.dias = diasDb;
      AppState.diaActivoId = diasDb[0].id;

      const { data: eventosDb, error: evErr } = await supabaseClient
        .from('eventos')
        .select('*')
        .order('orden', { ascending: true });

      if (evErr) throw evErr;

      // Agrupar por dia_id
      AppState.eventosPorDia = {};
      diasDb.forEach(d => AppState.eventosPorDia[d.id] = []);

      (eventosDb || []).forEach(ev => {
        if (!AppState.eventosPorDia[ev.dia_id]) {
          AppState.eventosPorDia[ev.dia_id] = [];
        }
        AppState.eventosPorDia[ev.dia_id].push(ev);
      });
    }
  } catch (error) {
    console.warn("No se pudieron cargar datos desde Supabase:", error.message);
    showToast("Usando datos locales de demostración", "info");
  }
}

// GUARDAR EN SUPABASE
async function guardarCambiosEnSupabase() {
  const eventosActuales = AppState.eventosPorDia[AppState.diaActivoId] || [];

  if (!supabaseClient) {
    showToast("Guardado localmente (Modo Demo sin Supabase)", "success");
    return;
  }

  try {
    showToast("Guardando en Supabase...", "info");

    // Borramos los eventos de este día y los volvemos a insertar con el orden y horarios nuevos
    const { error: delError } = await supabaseClient
      .from('eventos')
      .delete()
      .eq('dia_id', AppState.diaActivoId);

    if (delError) throw delError;

    if (eventosActuales.length > 0) {
      const inserts = eventosActuales.map((e, index) => ({
        dia_id: AppState.diaActivoId,
        hora_inicio: e.hora_inicio,
        duracion_minutos: e.duracion_minutos,
        hora_fin: e.hora_fin,
        tema: e.tema,
        detalle: e.detalle || '',
        responsable: e.responsable || '',
        notas: e.notas || '',
        orden: index + 1
      }));

      const { error: insError } = await supabaseClient.from('eventos').insert(inserts);
      if (insError) throw insError;
    }

    showToast("¡Agenda sincronizada exitosamente!", "success");
  } catch (err) {
    console.error("Error al guardar en Supabase:", err);
    showToast("Error al guardar: " + err.message, "error");
  }
}

// RENDER DE PESTAÑAS
function renderTabs() {
  const container = document.getElementById('tabs-container');
  container.innerHTML = '';

  AppState.dias.forEach(dia => {
    const isActive = dia.id === AppState.diaActivoId;
    const btn = document.createElement('button');
    btn.className = `px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
      isActive 
        ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' 
        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
    }`;
    btn.innerHTML = `
      <i data-lucide="calendar-days" class="w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}"></i>
      <span>${dia.nombre}</span>
    `;
    btn.onclick = () => {
      AppState.diaActivoId = dia.id;
      renderTabs();
      renderAgenda();
    };
    container.appendChild(btn);
  });

  if (window.lucide) lucide.createIcons();
}

// RENDER DE LA AGENDA (CON SOPORTE PARA ACTIVIDADES SIMULTÁNEAS)
function renderAgenda() {
  const container = document.getElementById('agenda-container');
  container.innerHTML = '';

  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];

  if (eventos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <i data-lucide="calendar-x" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
        <h4 class="text-base font-semibold text-slate-700">No hay actividades programadas</h4>
        <p class="text-xs text-slate-400 mt-1">Arrastra un archivo Excel o usa "Nuevo Bloque" para comenzar.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // AGRUPAR POR HORA DE INICIO PARA DETECTAR ACTIVIDADES PARALELAS / SIMULTÁNEAS
  const grupos = [];
  eventos.forEach(ev => {
    let grupo = grupos.find(g => g.hora_inicio === ev.hora_inicio);
    if (!grupo) {
      grupo = { hora_inicio: ev.hora_inicio, items: [] };
      grupos.push(grupo);
    }
    grupo.items.push(ev);
  });

  grupos.forEach(grupo => {
    const esSimultaneo = grupo.items.length > 1;

    // Fila horaria
    const rowEl = document.createElement('div');
    rowEl.className = 'flex flex-col md:flex-row gap-4 items-start bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-slate-300 transition';

    // Columna Izquierda: Bloque de Horario
    const timeCol = document.createElement('div');
    timeCol.className = 'w-full md:w-44 flex-shrink-0 flex items-center md:flex-col md:items-start justify-between border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4';
    timeCol.innerHTML = `
      <div class="flex items-center gap-1.5 text-slate-900 font-extrabold text-lg sm:text-xl">
        <i data-lucide="clock" class="w-4 h-4 text-brand-600"></i>
        <span>${grupo.hora_inicio}</span>
      </div>
      <div class="flex items-center gap-2 mt-1">
        ${esSimultaneo ? `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <i data-lucide="layers" class="w-3 h-3"></i> Simultáneo (${grupo.items.length})
          </span>
        ` : `
          <span class="text-xs text-slate-400 font-medium">Hasta ${grupo.items[0].hora_fin}</span>
        `}
      </div>
    `;

    // Columna Derecha: Tarjetas de actividades (Grid si son paralelas)
    const cardsGrid = document.createElement('div');
    cardsGrid.className = `w-full grid gap-4 ${esSimultaneo ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`;

    grupo.items.forEach(ev => {
      const card = document.createElement('div');
      card.className = `p-4 rounded-xl border transition ${
        esSimultaneo 
          ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300' 
          : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
      }`;

      // VISTA DE ADMIN VS VISTA PÚBLICA
      if (AppState.isAdmin) {
        // MODO ADMIN: Edición Inline y botón borrar
        card.innerHTML = `
          <div class="flex items-start justify-between gap-3 mb-2">
            <input type="text" value="${escapeHtml(ev.tema)}" class="font-bold text-slate-900 text-base bg-white border border-slate-300 rounded-lg px-2.5 py-1 w-full focus:ring-2 focus:ring-brand-500 focus:outline-none" onchange="actualizarCampo('${ev.id}', 'tema', this.value)" placeholder="Título del Tema">
            <button onclick="eliminarEvento('${ev.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition" title="Eliminar bloque">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-xs">
            <div class="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span class="font-semibold text-slate-500">Duración:</span>
              <input type="number" min="1" max="600" value="${ev.duracion_minutos}" class="w-16 font-bold text-brand-600 text-center bg-slate-100 rounded px-1 py-0.5" onchange="cambiarDuracionCascada('${ev.id}', this.value)">
              <span class="text-slate-400 font-medium">min</span>
            </div>
            <div class="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span class="font-semibold text-slate-500">Fin:</span>
              <span class="font-bold text-slate-700">${ev.hora_fin}</span>
            </div>
          </div>

          <textarea class="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-brand-500 focus:outline-none mb-2" rows="2" placeholder="Detalle o descripción..." onchange="actualizarCampo('${ev.id}', 'detalle', this.value)">${escapeHtml(ev.detalle || '')}</textarea>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <input type="text" value="${escapeHtml(ev.responsable || '')}" placeholder="Responsable / Orador" class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5" onchange="actualizarCampo('${ev.id}', 'responsable', this.value)">
            <input type="text" value="${escapeHtml(ev.notas || '')}" placeholder="Notas internas / Logística" class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-500" onchange="actualizarCampo('${ev.id}', 'notas', this.value)">
          </div>
        `;
      } else {
        // MODO PÚBLICO / ASISTENTES: Vista limpia y profesional
        card.innerHTML = `
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <h3 class="font-bold text-slate-900 text-base leading-snug">${escapeHtml(ev.tema)}</h3>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100 flex-shrink-0">
              ${ev.duracion_minutos} min
            </span>
          </div>

          ${ev.detalle ? `<p class="text-sm text-slate-600 mb-3 leading-relaxed">${escapeHtml(ev.detalle)}</p>` : ''}

          <div class="flex flex-wrap items-center gap-y-2 gap-x-4 pt-2 border-t border-slate-200/60 text-xs text-slate-500">
            ${ev.responsable ? `
              <div class="flex items-center gap-1.5 font-medium text-slate-700">
                <i data-lucide="user" class="w-3.5 h-3.5 text-brand-600"></i>
                <span>${escapeHtml(ev.responsable)}</span>
              </div>
            ` : ''}

            ${ev.notas ? `
              <div class="flex items-center gap-1.5 text-slate-400">
                <i data-lucide="info" class="w-3.5 h-3.5"></i>
                <span>${escapeHtml(ev.notas)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      cardsGrid.appendChild(card);
    });

    rowEl.appendChild(timeCol);
    rowEl.appendChild(cardsGrid);
    container.appendChild(rowEl);
  });

  if (window.lucide) lucide.createIcons();
}

// LÓGICA DE RECALCULAR EN CASCADA ANTE CAMBIO DE DURACIÓN
window.cambiarDuracionCascada = function(eventoId, nuevaDuracion) {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  const evento = eventos.find(e => e.id === eventoId);
  if (!evento) return;

  const min = Math.max(1, parseInt(nuevaDuracion, 10) || 5);
  evento.duracion_minutos = min;

  // Ejecutamos el recálculo en cascada
  AppState.eventosPorDia[AppState.diaActivoId] = TimeCalc.recalculateCascade(eventos);
  
  renderAgenda();
  showToast("Horarios recalculados en cascada", "info");
};

// ACTUALIZACIÓN DE CAMPOS INLINE
window.actualizarCampo = function(eventoId, campo, valor) {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  const evento = eventos.find(e => e.id === eventoId);
  if (evento) {
    evento[campo] = valor;
  }
};

// ELIMINAR EVENTO
window.eliminarEvento = function(eventoId) {
  if (!confirm("¿Deseas eliminar este bloque de la agenda?")) return;
  let eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  eventos = eventos.filter(e => e.id !== eventoId);
  AppState.eventosPorDia[AppState.diaActivoId] = TimeCalc.recalculateCascade(eventos);
  renderAgenda();
  showToast("Bloque eliminado", "info");
};

// AGREGAR NUEVO BLOQUE AL FINAL
function agregarNuevoBloque() {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  
  let horaInicio = "09:00";
  if (eventos.length > 0) {
    const ultimo = eventos[eventos.length - 1];
    horaInicio = ultimo.hora_fin;
  }

  const nuevo = {
    id: 'local_' + Date.now(),
    dia_id: AppState.diaActivoId,
    hora_inicio: horaInicio,
    duracion_minutos: 30,
    hora_fin: TimeCalc.minutesToTime(TimeCalc.timeToMinutes(horaInicio) + 30),
    tema: 'Nueva Actividad',
    detalle: '',
    responsable: '',
    notas: '',
    orden: eventos.length + 1
  };

  eventos.push(nuevo);
  AppState.eventosPorDia[AppState.diaActivoId] = eventos;
  renderAgenda();
  showToast("Nuevo bloque agregado", "success");
}

// TOGGLE ENTRE MODO ADMIN Y MODO LECTURA
function actualizarModoUI() {
  const badgeModo = document.getElementById('badge-modo');
  const panelAdmin = document.getElementById('panel-admin-tools');
  const txtAuthBtn = document.getElementById('txt-auth-btn');

  if (AppState.isAdmin) {
    badgeModo.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200";
    badgeModo.innerHTML = `<span class="w-2 h-2 rounded-full bg-indigo-600"></span> Modo Admin Activo`;
    panelAdmin.classList.remove('hidden');
    txtAuthBtn.innerText = "Cerrar Sesión";
  } else {
    badgeModo.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200";
    badgeModo.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Modo Lectura`;
    panelAdmin.classList.add('hidden');
    txtAuthBtn.innerText = "Acceso Admin";
  }
}

// CONFIGURAR LISTENERS Y DRAG & DROP
function setupEventListeners() {
  const modalLogin = document.getElementById('modal-login');
  const btnAuthToggle = document.getElementById('btn-auth-toggle');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const formLogin = document.getElementById('form-login');
  const btnDemoLogin = document.getElementById('btn-login-demo');

  // Login / Logout
  btnAuthToggle.onclick = async () => {
    if (AppState.isAdmin) {
      await AuthManager.logout();
      AppState.isAdmin = false;
      actualizarModoUI();
      renderAgenda();
      showToast("Sesión cerrada", "info");
    } else {
      modalLogin.classList.remove('hidden');
    }
  };

  btnCloseModal.onclick = () => modalLogin.classList.add('hidden');

  formLogin.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorBox = document.getElementById('login-error-msg');

    try {
      errorBox.classList.add('hidden');
      await AuthManager.login(email, pass);
      AppState.isAdmin = true;
      modalLogin.classList.add('hidden');
      actualizarModoUI();
      renderAgenda();
      showToast("¡Bienvenido, Administrador!", "success");
    } catch (err) {
      errorBox.innerText = err.message || "Credenciales incorrectas.";
      errorBox.classList.remove('hidden');
    }
  };

  btnDemoLogin.onclick = async () => {
    await AuthManager.login('demo@admin.com', '123456');
    AppState.isAdmin = true;
    modalLogin.classList.add('hidden');
    actualizarModoUI();
    renderAgenda();
    showToast("Modo Administrador Local activado", "success");
  };

  // Botón Nuevo Bloque
  document.getElementById('btn-add-row').onclick = agregarNuevoBloque;

  // Botón Guardar Servidor
  document.getElementById('btn-save-db').onclick = guardarCambiosEnSupabase;

  // Exportar Excel
  const triggerExport = () => {
    const diaActual = AppState.dias.find(d => d.id === AppState.diaActivoId);
    const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
    ExcelHandler.exportAgendaToExcel(diaActual ? diaActual.nombre : 'Agenda', eventos);
  };
  document.getElementById('btn-export-excel').onclick = triggerExport;
  document.getElementById('btn-export-excel-mobile').onclick = triggerExport;

  // DRAG & DROP DE EXCEL
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('excel-file-input');

  dropZone.onclick = () => fileInput.click();

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('border-indigo-600', 'bg-indigo-50/50');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-600', 'bg-indigo-50/50');
    });
  });

  const handleExcelImport = async (file) => {
    if (!file) return;
    try {
      showToast("Leyendo archivo Excel...", "info");
      const eventosCargados = await ExcelHandler.parseExcelFile(file);
      AppState.eventosPorDia[AppState.diaActivoId] = eventosCargados;
      renderAgenda();
      showToast(`¡Se importaron ${eventosCargados.length} actividades exitosamente!`, "success");
    } catch (err) {
      console.error(err);
      alert("Error al leer Excel: " + err.message);
    }
  };

  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleExcelImport(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleExcelImport(file);
    fileInput.value = '';
  });
}

// TOAST NOTIFICADOR
function showToast(mensaje, tipo = "info") {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  const toastIcon = document.getElementById('toast-icon');

  toastText.innerText = mensaje;

  if (tipo === 'success') {
    toastIcon.setAttribute('data-lucide', 'check-circle-2');
    toastIcon.className = 'w-5 h-5 text-emerald-400';
  } else if (tipo === 'error') {
    toastIcon.setAttribute('data-lucide', 'alert-circle');
    toastIcon.className = 'w-5 h-5 text-rose-400';
  } else {
    toastIcon.setAttribute('data-lucide', 'info');
    toastIcon.className = 'w-5 h-5 text-indigo-400';
  }

  if (window.lucide) lucide.createIcons();

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}

// ESCAPAR HTML PARA SEGURIDAD
function escapeHtml(string) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(string).replace(/[&<>"']/g, s => entityMap[s]);
}