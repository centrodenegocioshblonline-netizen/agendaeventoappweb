/**
 * js/time-calc.js
 * Utilidades matemáticas de tiempo y cálculo en cascada
 */

const TimeCalc = {
  /**
   * Convierte "HH:MM" o "HH:MM:SS" a minutos desde la medianoche
   */
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.toString().trim().split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return (hours * 60) + minutes;
  },

  /**
   * Convierte minutos desde la medianoche a formato "HH:MM"
   */
  minutesToTime(totalMinutes) {
    // Normalizar a 24 horas (1440 min)
    let normalized = totalMinutes % 1440;
    if (normalized < 0) normalized += 1440;

    const hours = Math.floor(normalized / 60);
    const mins = Math.floor(normalized % 60);

    const hh = hours.toString().padStart(2, '0');
    const mm = mins.toString().padStart(2, '0');
    return `${hh}:${mm}`;
  },

  /**
   * Parsea cadenas de duración variadas (ej. "30 min", "45", "00:30:00") a número entero de minutos
   */
  parseDurationToMinutes(val) {
    if (typeof val === 'number') return Math.round(val);
    if (!val) return 0;

    const str = val.toString().trim();
    // Si viene como "00:45:00" o "00:45"
    if (str.includes(':')) {
      const parts = str.split(':');
      if (parts.length >= 2) {
        return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
      }
    }
    // Si viene como "45 min" o "45"
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  },

  /**
   * LÓGICA EN CASCADA AUTOMÁTICA
   * Recorre la lista de eventos de un día y recalcula:
   * - hora_fin = hora_inicio + duracion_minutos
   * - Los eventos simultáneos comparten la misma hora_inicio.
   * - Los bloques siguientes inician al finalizar el bloque anterior (o el mayor de los simultáneos).
   */
  recalculateCascade(eventosList) {
    if (!eventosList || eventosList.length === 0) return [];

    // Clonamos para no mutar inesperadamente
    const list = [...eventosList];

    // Asegurar que el primer evento tenga hora fin
    let primerInicioMin = this.timeToMinutes(list[0].hora_inicio || "08:00");

    // Agrupamos actividades que pertenecen al mismo grupo secuencial
    // Si dos actividades consecutivas tenían originalmente la misma hora de inicio,
    // se mantienen simultáneas.
    let currentSlotStartMin = primerInicioMin;
    let maxSlotDurationMin = 0;

    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      const prev = i > 0 ? list[i - 1] : null;

      // Detectar si este evento es simultáneo con el anterior
      const esSimultaneo = prev && (prev._originalInicio === current._originalInicio || prev.hora_inicio === current.hora_inicio);

      if (i === 0) {
        current.hora_inicio = this.minutesToTime(currentSlotStartMin);
        const dur = this.parseDurationToMinutes(current.duracion_minutos);
        current.duracion_minutos = dur;
        current.hora_fin = this.minutesToTime(currentSlotStartMin + dur);
        maxSlotDurationMin = dur;
      } else if (esSimultaneo) {
        // Mismo inicio que el anterior
        current.hora_inicio = prev.hora_inicio;
        const dur = this.parseDurationToMinutes(current.duracion_minutos);
        current.duracion_minutos = dur;
        current.hora_fin = this.minutesToTime(this.timeToMinutes(current.hora_inicio) + dur);
        maxSlotDurationMin = Math.max(maxSlotDurationMin, dur);
      } else {
        // Bloque posterior: arranca justo cuando termina el slot anterior (el más largo)
        currentSlotStartMin = this.timeToMinutes(prev.hora_inicio) + maxSlotDurationMin;
        current.hora_inicio = this.minutesToTime(currentSlotStartMin);
        
        const dur = this.parseDurationToMinutes(current.duracion_minutos);
        current.duracion_minutos = dur;
        current.hora_fin = this.minutesToTime(currentSlotStartMin + dur);
        maxSlotDurationMin = dur;
      }
    }

    return list;
  }
};