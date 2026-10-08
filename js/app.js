/**
 * js/app.js
 * Controlador Maestro de Agenda, Días Dinámicos, Categorías, Búsqueda y En Vivo
 */

const AppDialog = {
  confirm({ title = "¿Confirmar acción?", message = "", confirmText = "Confirmar", cancelText = "Cancelar", type = "danger" }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('custom-dialog-modal');
      const card = document.getElementById('custom-dialog-card');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const btnConfirm = document.getElementById('dialog-btn-confirm');
      const btnCancel = document.getElementById('dialog-btn-cancel');
      const iconBox = document.getElementById('dialog-icon-box');
      const icon = document.getElementById('dialog-icon');

      titleEl.innerText = title;
      msgEl.innerText = message;
      btnConfirm.innerText = confirmText;
      btnCancel.innerText = cancelText;

      if (type === 'danger') {
        iconBox.className = "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-rose-100 text-rose-600";
        icon.setAttribute('data-lucide', 'trash-2');
        btnConfirm.className = "px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm";
      } else {
        iconBox.className = "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-100 text-indigo-600";
        icon.setAttribute('data-lucide', 'help-circle');
        btnConfirm.className = "px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm";
      }

      if (window.lucide) lucide.createIcons();

      btnCancel.style.display = 'inline-block';
      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
        card.classList.remove('scale-95');
      }, 10);

      const closeDialog = (result) => {
        modal.classList.add('opacity-0');
        card.classList.add('scale-95');
        setTimeout(() => {
          modal.classList.add('hidden');
          resolve(result);
        }, 200);
      };

      btnConfirm.onclick = () => closeDialog(true);
      btnCancel.onclick = () => closeDialog(false);
    });
  },

  alert({ title = "Aviso", message = "", buttonText = "Entendido", type = "info" }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('custom-dialog-modal');
      const card = document.getElementById('custom-dialog-card');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const btnConfirm = document.getElementById('dialog-btn-confirm');
      const btnCancel = document.getElementById('dialog-btn-cancel');
      const iconBox = document.getElementById('dialog-icon-box');
      const icon = document.getElementById('dialog-icon');

      titleEl.innerText = title;
      msgEl.innerText = message;
      btnConfirm.innerText = buttonText;
      btnCancel.style.display = 'none';

      iconBox.className = type === 'error' 
        ? "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-rose-100 text-rose-600"
        : "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-100 text-indigo-600";
      icon.setAttribute('data-lucide', type === 'error' ? 'alert-circle' : 'info');
      btnConfirm.className = type === 'error'
        ? "px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition"
        : "px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition";

      if (window.lucide) lucide.createIcons();

      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
        card.classList.remove('scale-95');
      }, 10);

      btnConfirm.onclick = () => {
        modal.classList.add('opacity-0');
        card.classList.add('scale-95');
        setTimeout(() => {
          modal.classList.add('hidden');
          resolve(true);
        }, 200);
      };
    });
  }
};

const AppState = {
  dias: [
    { id: 'dia-1', nombre: 'Jueves 22 (Día 1)', orden: 1 },
    { id: 'dia-2', nombre: 'Viernes 23 (Día 2)', orden: 2 },
    { id: 'dia-3', nombre: 'Sábado 24 (Día 3)', orden: 3 },
  ],
  diaActivoId: 'dia-1',
  filtroTexto: '',
  eventosPorDia: {
    'dia-1': [
      { id: 'e1', dia_id: 'dia-1', hora_inicio: '07:00', duracion_minutos: 30, hora_fin: '07:30', tema: 'Apertura del Registro', detalle: 'Disponible de 12:00am a 4:00pm', responsable: 'Staff Herbalife', notas: 'Lugar Centro de Negocio', categoria: 'normal', orden: 1 },
      { id: 'e2', dia_id: 'dia-1', hora_inicio: '07:00', duracion_minutos: 30, hora_fin: '07:30', tema: 'Reunión de organizadores', detalle: 'Briefing con comité', responsable: 'Dirección', notas: 'Salón VIP', categoria: 'normal', orden: 2 },
      { id: 'e3', dia_id: 'dia-1', hora_inicio: '07:30', duracion_minutos: 60, hora_fin: '08:30', tema: 'Audiovisuales', detalle: 'Instalación y Pruebas técnicas', responsable: 'Sistemas', notas: 'Prueba de sonido', categoria: 'tecnico', orden: 3 },
      { id: 'e4', dia_id: 'dia-1', hora_inicio: '08:30', duracion_minutos: 5, hora_fin: '08:35', tema: 'Videos Rotativos', detalle: 'Proyección continua', responsable: 'Sistemas', notas: '', categoria: 'video', orden: 4 },
      { id: 'e5', dia_id: 'dia-1', hora_inicio: '08:35', duracion_minutos: 20, hora_fin: '08:55', tema: 'Apertura de puertas', detalle: 'Ingreso de miembros del Equipo del Presidente', responsable: 'Gregorio B / Juan F', notas: 'CDN Auditorio', categoria: 'especial', orden: 5 }
    ],
    'dia-2': [],
    'dia-3': []
  },
  isAdmin: false
};

// ESTILOS DE CATEGORÍAS
const CATEGORIA_STYLES = {
  normal: { bg: 'bg-white', border: 'border-slate-200', tag: 'General', badgeBg: 'bg-slate-100 text-slate-700' },
  video: { bg: 'bg-emerald-50/40', border: 'border-emerald-300', tag: 'Video / Música', badgeBg: 'bg-emerald-100 text-emerald-800' },
  especial: { bg: 'bg-orange-50/50', border: 'border-orange-300', tag: 'Orador / Taller', badgeBg: 'bg-orange-100 text-orange-800' },
  tecnico: { bg: 'bg-rose-50/50', border: 'border-rose-300', tag: 'Técnico / Prueba', badgeBg: 'bg-rose-100 text-rose-800' },
  receso: { bg: 'bg-blue-50/40', border: 'border-blue-300', tag: 'Receso / Coffee', badgeBg: 'bg-blue-100 text-blue-800' }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  iniciarRelojEnVivo();
  await AuthManager.init();
  AppState.isAdmin = AuthManager.isAdmin;
  actualizarModoUI();

  await cargarDatosDeSupabase();

  renderTabs();
  renderAgenda();
  setupEventListeners();
});

// RELOJ EN VIVO
function iniciarRelojEnVivo() {
  const clockEl = document.getElementById('live-clock');
  const updateClock = () => {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  updateClock();
  setInterval(updateClock, 1000);

  // Cada 30 segundos refrescar el indicador "EN CURSO"
  setInterval(() => {
    renderAgenda();
  }, 30000);
}

// SUPABASE
async function cargarDatosDeSupabase() {
  if (!supabaseClient) return;
  try {
    const { data: diasDb } = await supabaseClient.from('dias').select('*').order('orden', { ascending: true });
    if (diasDb && diasDb.length > 0) {
      AppState.dias = diasDb;
      AppState.diaActivoId = diasDb[0].id;
      const { data: eventosDb } = await supabaseClient.from('eventos').select('*').order('orden', { ascending: true });

      AppState.eventosPorDia = {};
      diasDb.forEach(d => AppState.eventosPorDia[d.id] = []);
      (eventosDb || []).forEach(ev => {
        if (!AppState.eventosPorDia[ev.dia_id]) AppState.eventosPorDia[ev.dia_id] = [];
        AppState.eventosPorDia[ev.dia_id].push({ ...ev, categoria: ev.categoria || 'normal' });
      });
    }
  } catch (err) {
    console.warn("Modo local activo:", err.message);
  }
}

async function guardarCambiosEnSupabase() {
  const eventosActuales = AppState.eventosPorDia[AppState.diaActivoId] || [];
  if (!supabaseClient) {
    showToast("Cambios guardados en memoria local", "success");
    return;
  }
  try {
    showToast("Sincronizando con Supabase...", "info");
    await supabaseClient.from('eventos').delete().eq('dia_id', AppState.diaActivoId);
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
        categoria: e.categoria || 'normal',
        orden: index + 1
      }));
      await supabaseClient.from('eventos').insert(inserts);
    }
    showToast("¡Agenda sincronizada exitosamente!", "success");
  } catch (err) {
    await AppDialog.alert({ title: "Error", message: err.message, type: "error" });
  }
}

// GESTIÓN DINÁMICA DE DÍAS (Agregar, Renombrar, Eliminar)
function renderTabs() {
  const container = document.getElementById('tabs-container');
  container.innerHTML = '';

  AppState.dias.forEach(dia => {
    const isActive = dia.id === AppState.diaActivoId;
    const tabWrapper = document.createElement('div');
    tabWrapper.className = 'flex items-center';

    const btn = document.createElement('button');
    btn.className = `px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-1.5 ${
      isActive 
        ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' 
        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
    }`;
    btn.innerHTML = `<i data-lucide="calendar-days" class="w-3.5 h-3.5"></i><span>${escapeHtml(dia.nombre)}</span>`;
    btn.onclick = () => {
      AppState.diaActivoId = dia.id;
      renderTabs();
      renderAgenda();
    };

    tabWrapper.appendChild(btn);

    // Opciones de renombrar/eliminar día para Admin
    if (isActive && AppState.isAdmin) {
      const btnRename = document.createElement('button');
      btnRename.className = "ml-1 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100";
      btnRename.title = "Renombrar Día";
      btnRename.innerHTML = `<i data-lucide="edit-2" class="w-3 h-3"></i>`;
      btnRename.onclick = () => renombrarDia(dia.id);
      tabWrapper.appendChild(btnRename);

      if (AppState.dias.length > 1) {
        const btnDeleteDay = document.createElement('button');
        btnDeleteDay.className = "p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50";
        btnDeleteDay.title = "Eliminar Día";
        btnDeleteDay.innerHTML = `<i data-lucide="trash" class="w-3 h-3"></i>`;
        btnDeleteDay.onclick = () => eliminarDia(dia.id);
        tabWrapper.appendChild(btnDeleteDay);
      }
    }

    container.appendChild(tabWrapper);
  });

  // Botón "+" para agregar nuevo día (solo admin)
  if (AppState.isAdmin) {
    const btnAddDay = document.createElement('button');
    btnAddDay.className = "px-3 py-2 rounded-xl font-semibold text-xs text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition flex items-center gap-1";
    btnAddDay.innerHTML = `<i data-lucide="plus" class="w-3.5 h-3.5"></i><span>Día</span>`;
    btnAddDay.onclick = agregarNuevoDia;
    container.appendChild(btnAddDay);
  }

  if (window.lucide) lucide.createIcons();
}

async function agregarNuevoDia() {
  const num = AppState.dias.length + 1;
  const nuevoId = 'dia-' + Date.now();
  const nuevoDia = { id: nuevoId, nombre: `Día ${num}`, orden: num };

  AppState.dias.push(nuevoDia);
  AppState.eventosPorDia[nuevoId] = [];
  AppState.diaActivoId = nuevoId;

  if (supabaseClient) {
    try {
      await supabaseClient.from('dias').insert([nuevoDia]);
    } catch (e) { console.error(e); }
  }

  renderTabs();
  renderAgenda();
  showToast("Nuevo día creado", "success");
}

async function renombrarDia(diaId) {
  const dia = AppState.dias.find(d => d.id === diaId);
  const nuevoNombre = prompt("Escribe el nuevo nombre del día:", dia.nombre);
  if (nuevoNombre && nuevoNombre.trim() !== "") {
    dia.nombre = nuevoNombre.trim();
    if (supabaseClient) {
      await supabaseClient.from('dias').update({ nombre: dia.nombre }).eq('id', diaId);
    }
    renderTabs();
    showToast("Nombre del día actualizado", "success");
  }
}

async function eliminarDia(diaId) {
  const dia = AppState.dias.find(d => d.id === diaId);
  const confirmar = await AppDialog.confirm({
    title: "¿Eliminar este día?",
    message: `Se eliminarán todas las actividades asociadas a "${dia.nombre}".`,
    confirmText: "Sí, eliminar",
    type: "danger"
  });

  if (confirmar) {
    AppState.dias = AppState.dias.filter(d => d.id !== diaId);
    delete AppState.eventosPorDia[diaId];
    AppState.diaActivoId = AppState.dias[0].id;
    if (supabaseClient) {
      await supabaseClient.from('dias').delete().eq('id', diaId);
    }
    renderTabs();
    renderAgenda();
    showToast("Día eliminado", "info");
  }
}

// RENDER DE LA AGENDA
function renderAgenda() {
  const container = document.getElementById('agenda-container');
  container.innerHTML = '';

  let eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];

  // FILTRADO EN VIVO
  if (AppState.filtroTexto.trim() !== '') {
    const q = AppState.filtroTexto.toLowerCase();
    eventos = eventos.filter(e => 
      (e.tema && e.tema.toLowerCase().includes(q)) ||
      (e.detalle && e.detalle.toLowerCase().includes(q)) ||
      (e.responsable && e.responsable.toLowerCase().includes(q)) ||
      (e.notas && e.notas.toLowerCase().includes(q))
    );
  }

  if (eventos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <i data-lucide="calendar-x" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
        <h4 class="text-base font-semibold text-slate-700">No se encontraron actividades</h4>
        <p class="text-xs text-slate-400 mt-1">Verifica el filtro de búsqueda o agrega un nuevo bloque.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Agrupar por hora de inicio (simultáneos)
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

    // Detectar si alguna actividad de este grupo está "EN CURSO" ahora mismo
    const algunoEnCurso = grupo.items.some(ev => TimeCalc.isNowInRange(ev.hora_inicio, ev.hora_fin));

    const rowEl = document.createElement('div');
    rowEl.className = `flex flex-col md:flex-row gap-4 items-start p-4 sm:p-5 rounded-2xl border transition shadow-sm ${
      algunoEnCurso 
        ? 'bg-indigo-50/40 border-indigo-400 ring-2 ring-indigo-400/20 shadow-md' 
        : 'bg-white border-slate-200/90 hover:border-slate-300'
    }`;

    // Columna Horario
    const timeCol = document.createElement('div');
    timeCol.className = 'w-full md:w-44 flex-shrink-0 flex items-center md:flex-col md:items-start justify-between border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4';
    timeCol.innerHTML = `
      <div class="flex items-center gap-1.5 text-slate-900 font-extrabold text-lg sm:text-xl">
        <i data-lucide="clock" class="w-4 h-4 text-brand-600"></i>
        <span>${grupo.hora_inicio}</span>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 mt-1">
        ${algunoEnCurso ? `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-white animate-pulse shadow-sm">
            ● AHORA
          </span>
        ` : ''}
        ${esSimultaneo ? `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <i data-lucide="layers" class="w-3 h-3"></i> Simultáneo (${grupo.items.length})
          </span>
        ` : `
          <span class="text-xs text-slate-400 font-medium">Hasta ${grupo.items[0].hora_fin}</span>
        `}
      </div>
    `;

    // Tarjetas
    const cardsGrid = document.createElement('div');
    cardsGrid.className = `w-full grid gap-4 ${esSimultaneo ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`;

    grupo.items.forEach(ev => {
      const catInfo = CATEGORIA_STYLES[ev.categoria || 'normal'] || CATEGORIA_STYLES.normal;
      const card = document.createElement('div');
      card.className = `p-4 rounded-xl border transition ${catInfo.bg} ${catInfo.border}`;

      if (AppState.isAdmin) {
        card.innerHTML = `
          <div class="flex items-start justify-between gap-2 mb-2">
            <input type="text" value="${escapeHtml(ev.tema)}" class="font-bold text-slate-900 text-sm sm:text-base bg-white border border-slate-300 rounded-lg px-2.5 py-1 w-full focus:ring-2 focus:ring-brand-500" onchange="actualizarCampo('${ev.id}', 'tema', this.value)" placeholder="Título del Tema">
            <button onclick="confirmarEliminarEvento('${ev.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50" title="Eliminar">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2 text-xs">
            <div class="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-slate-200">
              <span class="text-slate-500 font-semibold">Duración:</span>
              <input type="number" min="1" max="600" value="${ev.duracion_minutos}" class="w-14 font-bold text-brand-600 text-center bg-slate-100 rounded px-1 py-0.5" onchange="cambiarDuracionCascada('${ev.id}', this.value)">
              <span class="text-slate-400">min</span>
            </div>
            <div class="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-slate-200">
              <span class="text-slate-500 font-semibold">Fin:</span>
              <span class="font-bold text-slate-700">${ev.hora_fin}</span>
            </div>
            <!-- Selector de Categoría / Color -->
            <select class="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none" onchange="actualizarCampo('${ev.id}', 'categoria', this.value); renderAgenda();">
              <option value="normal" ${ev.categoria === 'normal' ? 'selected' : ''}>⚪ General</option>
              <option value="video" ${ev.categoria === 'video' ? 'selected' : ''}>🟢 Video / Audio</option>
              <option value="especial" ${ev.categoria === 'especial' ? 'selected' : ''}>🟠 Orador / Taller</option>
              <option value="tecnico" ${ev.categoria === 'tecnico' ? 'selected' : ''}>🔴 Técnico / Prueba</option>
              <option value="receso" ${ev.categoria === 'receso' ? 'selected' : ''}>🔵 Receso / Coffee</option>
            </select>
          </div>

          <textarea class="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-brand-500 mb-2" rows="2" placeholder="Detalles de la sesión..." onchange="actualizarCampo('${ev.id}', 'detalle', this.value)">${escapeHtml(ev.detalle || '')}</textarea>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <input type="text" value="${escapeHtml(ev.responsable || '')}" placeholder="Responsable / Orador" class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5" onchange="actualizarCampo('${ev.id}', 'responsable', this.value)">
            <input type="text" value="${escapeHtml(ev.notas || '')}" placeholder="Notas de Producción" class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-500" onchange="actualizarCampo('${ev.id}', 'notas', this.value)">
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${catInfo.badgeBg}">
                ${catInfo.tag}
              </span>
              <h3 class="font-bold text-slate-900 text-sm sm:text-base leading-snug">${escapeHtml(ev.tema)}</h3>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100 flex-shrink-0">
              ${ev.duracion_minutos} min
            </span>
          </div>

          ${ev.detalle ? `<p class="text-xs sm:text-sm text-slate-600 mb-3 leading-relaxed">${escapeHtml(ev.detalle)}</p>` : ''}

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

// DESPLAZAMIENTO DE EMERGENCIA (± MINUTOS)
window.desplazarTiempos = function(minutos) {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  if (eventos.length === 0) return;

  AppState.eventosPorDia[AppState.diaActivoId] = TimeCalc.shiftAll(eventos, minutos);
  renderAgenda();
  document.getElementById('modal-shift').classList.add('hidden');
  showToast(`Agenda ajustada: ${minutos > 0 ? '+' : ''}${minutos} minutos`, "info");
};

// CASCADA AL EDITAR DURACIÓN
window.cambiarDuracionCascada = function(eventoId, nuevaDuracion) {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  const evento = eventos.find(e => e.id === eventoId);
  if (!evento) return;

  evento.duracion_minutos = Math.max(1, parseInt(nuevaDuracion, 10) || 5);
  AppState.eventosPorDia[AppState.diaActivoId] = TimeCalc.recalculateCascade(eventos);
  renderAgenda();
  showToast("Horarios recalculados en cascada", "info");
};

window.actualizarCampo = function(eventoId, campo, valor) {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  const evento = eventos.find(e => e.id === eventoId);
  if (evento) evento[campo] = valor;
};

window.confirmarEliminarEvento = async function(eventoId) {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  const evento = eventos.find(e => e.id === eventoId);
  const nombre = evento ? `"${evento.tema}"` : "este bloque";

  const confirmado = await AppDialog.confirm({
    title: "Eliminar Actividad",
    message: `¿Estás seguro de que deseas eliminar ${nombre}? Los bloques siguientes se reajustarán automáticamente.`,
    confirmText: "Sí, eliminar",
    cancelText: "Conservar",
    type: "danger"
  });

  if (confirmado) {
    let actualizados = eventos.filter(e => e.id !== eventoId);
    AppState.eventosPorDia[AppState.diaActivoId] = TimeCalc.recalculateCascade(actualizados);
    renderAgenda();
    showToast("Bloque eliminado", "info");
  }
};

function agregarNuevoBloque() {
  const eventos = AppState.eventosPorDia[AppState.diaActivoId] || [];
  let horaInicio = eventos.length > 0 ? eventos[eventos.length - 1].hora_fin : "08:00";

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
    categoria: 'normal',
    orden: eventos.length + 1
  };

  eventos.push(nuevo);
  AppState.eventosPorDia[AppState.diaActivoId] = eventos;
  renderAgenda();
  showToast("Nuevo bloque agregado", "success");
}

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

function setupEventListeners() {
  const modalLogin = document.getElementById('modal-login');
  const btnAuthToggle = document.getElementById('btn-auth-toggle');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const formLogin = document.getElementById('form-login');
  const btnDemoLogin = document.getElementById('btn-login-demo');

  btnAuthToggle.onclick = async () => {
    if (AppState.isAdmin) {
      await AuthManager.logout();
      AppState.isAdmin = false;
      actualizarModoUI();
      renderTabs();
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
      renderTabs();
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
    renderTabs();
    renderAgenda();
    showToast("Modo Administrador activado", "success");
  };

  // Botón Emergencia de Ajuste
  const modalShift = document.getElementById('modal-shift');
  document.getElementById('btn-shift-time').onclick = () => modalShift.classList.remove('hidden');
  document.getElementById('btn-close-shift').onclick = () => modalShift.classList.add('hidden');

  // Buscador en Vivo
  const inputSearch = document.getElementById('input-search');
  const btnClearSearch = document.getElementById('btn-clear-search');
  inputSearch.addEventListener('input', (e) => {
    AppState.filtroTexto = e.target.value;
    if (AppState.filtroTexto) btnClearSearch.classList.remove('hidden');
    else btnClearSearch.classList.add('hidden');
    renderAgenda();
  });
  btnClearSearch.onclick = () => {
    inputSearch.value = '';
    AppState.filtroTexto = '';
    btnClearSearch.classList.add('hidden');
    renderAgenda();
  };

  document.getElementById('btn-add-row').onclick = agregarNuevoBloque;
  document.getElementById('btn-save-db').onclick = guardarCambiosEnSupabase;

  // EXPORTAR TODAS LAS PESTAÑAS (Dia 1, Dia 2, Dia 3) EN UN SOLO ARCHIVO EXCEL
  const triggerExport = async () => {
    showToast("Generando Excel completo con todas las pestañas...", "info");
    await ExcelHandler.exportAllDaysToExcel(AppState.dias, AppState.eventosPorDia);
    showToast("¡Archivo Excel descargado con éxito!", "success");
  };
  document.getElementById('btn-export-excel').onclick = triggerExport;

  // LÓGICA DE IMPORTACIÓN MULTI-HOJA (Dia 1, Dia 2, Dia 3)
  const procesarArchivoExcelMultiHoja = async (file) => {
    if (!file) return;
    try {
      showToast("Analizando hojas del archivo Excel...", "info");
      const hojasResultado = await ExcelHandler.parseExcelWorkbook(file);
      const nombresHojas = Object.keys(hojasResultado);

      if (nombresHojas.length === 0) {
        await AppDialog.alert({
          title: "Sin datos encontrados",
          message: "No se encontraron filas con encabezados 'INICIO' y 'TEMA' en las hojas Dia 1, Dia 2 o Dia 3.",
          type: "error"
        });
        return;
      }

      let resumen = [];

      // Vincular cada hoja encontrada con su día correspondiente en AppState
      nombresHojas.forEach(nombreHoja => {
        const eventosHoja = hojasResultado[nombreHoja];
        const numMatch = nombreHoja.match(/\d+/);
        const numeroDia = numMatch ? parseInt(numMatch[0], 10) : null;

        // Buscar día existente o crearlo
        let diaDestino = null;
        if (numeroDia) {
          diaDestino = AppState.dias.find(d => d.orden === numeroDia || d.nombre.includes(`${numeroDia}`));
        }

        if (!diaDestino) {
          // Si no existe, crear el día automáticamente
          const nuevoId = 'dia-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          diaDestino = {
            id: nuevoId,
            nombre: nombreHoja,
            orden: AppState.dias.length + 1
          };
          AppState.dias.push(diaDestino);
        }

        // Asignar los eventos de esa hoja al día
        eventosHoja.forEach(ev => ev.dia_id = diaDestino.id);
        AppState.eventosPorDia[diaDestino.id] = eventosHoja;

        resumen.push(`${diaDestino.nombre}: ${eventosHoja.length} actividades`);
      });

      // Posicionarse en el Día 1
      AppState.diaActivoId = AppState.dias[0].id;
      renderTabs();
      renderAgenda();

      await AppDialog.alert({
        title: "¡Importación Multi-Día Exitosa!",
        message: `Se cargaron correctamente las siguientes pestañas:\n\n• ${resumen.join('\n• ')}`,
        type: "info"
      });

    } catch (err) {
      console.error(err);
      await AppDialog.alert({
        title: "Error al leer Excel",
        message: err.message || "Ocurrió un error al procesar el archivo.",
        type: "error"
      });
    }
  };

  // Drag & Drop
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('excel-file-input');
  dropZone.onclick = () => fileInput.click();

  ['dragenter', 'dragover'].forEach(n => dropZone.addEventListener(n, (e) => { e.preventDefault(); dropZone.classList.add('border-indigo-600', 'bg-indigo-50/50'); }));
  ['dragleave', 'drop'].forEach(n => dropZone.addEventListener(n, (e) => { e.preventDefault(); dropZone.classList.remove('border-indigo-600', 'bg-indigo-50/50'); }));

  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    procesarArchivoExcelMultiHoja(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    procesarArchivoExcelMultiHoja(file);
    fileInput.value = '';
  });

function showToast(mensaje, tipo = "info") {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  const toastIcon = document.getElementById('toast-icon');
  toastText.innerText = mensaje;
  toastIcon.setAttribute('data-lucide', tipo === 'success' ? 'check-circle-2' : (tipo === 'error' ? 'alert-circle' : 'info'));
  toastIcon.className = `w-5 h-5 ${tipo === 'success' ? 'text-emerald-400' : (tipo === 'error' ? 'text-rose-400' : 'text-indigo-400')}`;
  if (window.lucide) lucide.createIcons();
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3500);
}

function escapeHtml(string) {
  const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(string).replace(/[&<>"']/g, s => entityMap[s]);
}