/**
 * js/events.js - Gestor de la Pantalla Inicial de Eventos (SPA)
 */

const EventsState = {
  eventsList: [],
  isAdmin: false
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (window.lucide) lucide.createIcons();

    if (window.AuthManager) {
      await AuthManager.init();
      EventsState.isAdmin = AuthManager.isAdmin;
    }

    actualizarUIEventosGlobal();
    setupEventsListenersGlobal();

    // Comprobar si ya había un evento abierto previamente en localStorage
    const savedEventId = localStorage.getItem('current_event_id');
    if (savedEventId) {
      abrirVistaAgenda(savedEventId);
    } else {
      await cargarEventosDeSupabase();
      renderEventosGrid();
    }
  } catch (error) {
    console.error("Error al inicializar la pantalla de eventos:", error);
  }
});

async function cargarEventosDeSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    EventsState.eventsList = data || [];
  } catch (err) {
    console.warn("Error cargando eventos:", err.message);
  }
}

function renderEventosGrid() {
  const container = document.getElementById('events-grid-container');
  if (!container) return;
  container.innerHTML = '';

  if (EventsState.eventsList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <i data-lucide="calendar-off" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
        <h4 class="text-base font-semibold text-slate-700">No hay eventos creados</h4>
        <p class="text-xs text-slate-400 mt-1">Inserta los eventos (STS, FSL, Evento Especial) desde el SQL Editor de Supabase.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  EventsState.eventsList.forEach(ev => {
    const card = document.createElement('div');
    card.className = "bg-white border border-slate-200/90 rounded-2xl p-6 hover:shadow-md transition flex flex-col justify-between group cursor-pointer";
    card.onclick = () => seleccionarEvento(ev.id);

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2 mb-3">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
            <i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${ev.date || 'Sin fecha'}
          </span>
          <div class="flex items-center gap-1">
            <!-- Botón para renombrar cualquier evento al vuelo -->
            <button onclick="event.stopPropagation(); renombrarEventoCustom('${ev.id}', '${escapeHtml(ev.name)}')" class="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition" title="Renombrar Evento">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            ${EventsState.isAdmin ? `
              <button onclick="event.stopPropagation(); confirmarEliminarEventoGlobal('${ev.id}')" class="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition" title="Eliminar Evento">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </div>
        <h3 class="font-bold text-slate-900 text-lg group-hover:text-brand-600 transition mb-1">${escapeHtml(ev.name)}</h3>
        <p class="text-xs text-slate-500 line-clamp-2">${escapeHtml(ev.description || 'Sin descripción detallada.')}</p>
      </div>
      <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-600">
        <span>Abrir Agenda Minuto a Minuto</span>
        <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

function seleccionarEvento(eventId) {
  localStorage.setItem('current_event_id', eventId);
  abrirVistaAgenda(eventId);
}

function abrirVistaAgenda(eventId) {
  const viewSelector = document.getElementById('view-events-selector');
  const viewAgenda = document.getElementById('view-agenda-detail');
  
  if (viewSelector) viewSelector.classList.add('hidden');
  if (viewAgenda) viewAgenda.classList.remove('hidden');

  const eventoActual = EventsState.eventsList.find(e => e.id == eventId);
  const titleEl = document.getElementById('current-event-title');
  if (titleEl && eventoActual) {
    titleEl.innerText = eventoActual.name;
  }

  if (typeof cargarDatosDeSupabase === 'function') {
    cargarDatosDeSupabase().then(() => {
      if (typeof renderTabs === 'function') renderTabs();
      if (typeof renderAgenda === 'function') renderAgenda();
    });
  }
}

function actualizarUIEventosGlobal() {
  const txtAuthBtnGlobal = document.getElementById('txt-auth-btn-global');
  if (txtAuthBtnGlobal) {
    txtAuthBtnGlobal.innerText = EventsState.isAdmin ? "Cerrar Sesión" : "Acceso Admin";
  }
}

window.renombrarEventoCustom = async function(eventId, nombreActual) {
  const nuevoNombre = prompt("Escribe el nuevo nombre para el evento:", nombreActual);
  if (!nuevoNombre || nuevoNombre.trim() === "") return;

  try {
    const { error } = await supabaseClient
      .from('events')
      .update({ name: nuevoNombre.trim() })
      .eq('id', eventId);

    if (error) throw error;
    if (typeof showToast === 'function') showToast("¡Evento renombrado con éxito!", "success");
    await cargarEventosDeSupabase();
    renderEventosGrid();
  } catch (err) {
    alert("Error al renombrar: " + err.message);
  }
};

window.confirmarEliminarEventoGlobal = async function(eventId) {
  if (!confirm("¿Estás seguro de eliminar este evento completo y todas sus agendas asociadas?")) return;
  try {
    const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
    if (error) throw error;
    if (typeof showToast === 'function') showToast("Evento eliminado", "info");
    await cargarEventosDeSupabase();
    renderEventosGrid();
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
};

function setupEventsListenersGlobal() {
  const btnBack = document.getElementById('btn-back-to-events');
  const btnAuthGlobal = document.getElementById('btn-auth-toggle-global');
  const modalLogin = document.getElementById('modal-login');

  if (btnBack) {
    btnBack.onclick = () => {
      localStorage.removeItem('current_event_id');
      document.getElementById('view-agenda-detail').classList.add('hidden');
      document.getElementById('view-events-selector').classList.remove('hidden');
      cargarEventosDeSupabase().then(() => renderEventosGrid());
    };
  }

  if (btnAuthGlobal) {
    btnAuthGlobal.onclick = async () => {
      if (EventsState.isAdmin) {
        if (window.AuthManager) await AuthManager.logout();
        EventsState.isAdmin = false;
        actualizarUIEventosGlobal();
        renderEventosGrid();
        if (typeof showToast === 'function') showToast("Sesión cerrada", "info");
      } else {
        if (modalLogin) modalLogin.classList.remove('hidden');
      }
    };
  }
}