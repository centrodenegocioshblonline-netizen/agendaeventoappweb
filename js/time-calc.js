/**
 * js/time-calc.js
 * Utilidades matemáticas de tiempo, cascada y detección en vivo
 */

const TimeCalc = {
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.toString().trim().split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return (hours * 60) + minutes;
  },

  minutesToTime(totalMinutes) {
    let normalized = totalMinutes % 1440;
    if (normalized < 0) normalized += 1440;
    const hours = Math.floor(normalized / 60);
    const mins = Math.floor(normalized % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  parseDurationToMinutes(val) {
    if (typeof val === 'number') return Math.round(val);
    if (!val) return 0;
    const str = val.toString().trim();
    if (str.includes(':')) {
      const parts = str.split(':');
      if (parts.length >= 2) return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
    }
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  },

  /**
   * Recálculo en Cascada automático
   */
  recalculateCascade(eventosList) {
    if (!eventosList || eventosList.length === 0) return [];
    const list = [...eventosList];
    let primerInicioMin = this.timeToMinutes(list[0].hora_inicio || "08:00");

    let currentSlotStartMin = primerInicioMin;
    let maxSlotDurationMin = 0;

    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const esSimultaneo = prev && (prev._originalInicio === current._originalInicio || prev.hora_inicio === current.hora_inicio);

      if (i === 0) {
        current.hora_inicio = this.minutesToTime(currentSlotStartMin);
        const dur = this.parseDurationToMinutes(current.duracion_minutos);
        current.duracion_minutos = dur;
        current.hora_fin = this.minutesToTime(currentSlotStartMin + dur);
        maxSlotDurationMin = dur;
      } else if (esSimultaneo) {
        current.hora_inicio = prev.hora_inicio;
        const dur = this.parseDurationToMinutes(current.duracion_minutos);
        current.duracion_minutos = dur;
        current.hora_fin = this.minutesToTime(this.timeToMinutes(current.hora_inicio) + dur);
        maxSlotDurationMin = Math.max(maxSlotDurationMin, dur);
      } else {
        currentSlotStartMin = this.timeToMinutes(prev.hora_inicio) + maxSlotDurationMin;
        current.hora_inicio = this.minutesToTime(currentSlotStartMin);
        const dur = this.parseDurationToMinutes(current.duracion_minutos);
        current.duracion_minutos = dur;
        current.hora_fin = this.minutesToTime(currentSlotStartMin + dur);
        maxSlotDurationMin = dur;
      }
    }
    return list;
  },

  /**
   * Desplazar toda la agenda (suma o resta minutos en bloque)
   */
  shiftAll(eventosList, deltaMin) {
    if (!eventosList || eventosList.length === 0) return [];
    const list = [...eventosList];
    const primerInicio = this.timeToMinutes(list[0].hora_inicio) + deltaMin;
    list[0].hora_inicio = this.minutesToTime(primerInicio);
    return this.recalculateCascade(list);
  },

  /**
   * Determina si la hora actual cae dentro del rango de una actividad
   */
  isNowInRange(horaInicioStr, horaFinStr) {
    const now = new Date();
    const currentMin = (now.getHours() * 60) + now.getMinutes();
    const startMin = this.timeToMinutes(horaInicioStr);
    const endMin = this.timeToMinutes(horaFinStr);
    return currentMin >= startMin && currentMin < endMin;
  }
};