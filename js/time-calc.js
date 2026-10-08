/**
 * js/time-calc.js
 * Utilidades matemáticas con soporte para duraciones Excel (0:30, 1:40, etc.)
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
    let normalized = Math.round(totalMinutes) % 1440;
    if (normalized < 0) normalized += 1440;
    const hours = Math.floor(normalized / 60);
    const mins = Math.floor(normalized % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  /**
   * Parsea duraciones de Excel: "0:30" (30 min), "1:00" (60 min), "1:40" (100 min), o decimales
   */
  parseDurationToMinutes(val) {
    if (val === null || val === undefined || val === '') return 30;

    // Si viene como número decimal de Excel (ej: 0.020833 = 30 min)
    if (typeof val === 'number') {
      if (val > 0 && val < 1) {
        return Math.round(val * 24 * 60);
      }
      return Math.round(val);
    }

    const str = val.toString().trim();

    // Si viene como "H:MM" o "HH:MM" (ej: "0:30", "1:00", "1:40")
    if (str.includes(':')) {
      const parts = str.split(':');
      const hrs = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      return (hrs * 60) + mins;
    }

    // Si viene como "45 min" o "30"
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : 30;
  },

  /**
   * Recálculo en cascada cuando el Administrador cambia una duración
   */
  recalculateCascade(eventosList) {
    if (!eventosList || eventosList.length === 0) return [];
    const list = [...eventosList];

    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const esSimultaneo = prev && (prev._originalInicio === current._originalInicio);

      if (i === 0) {
        const startMin = this.timeToMinutes(current.hora_inicio || "07:00");
        current.hora_inicio = this.minutesToTime(startMin);
        current.hora_fin = this.minutesToTime(startMin + current.duracion_minutos);
      } else if (esSimultaneo) {
        current.hora_inicio = prev.hora_inicio;
        const startMin = this.timeToMinutes(current.hora_inicio);
        current.hora_fin = this.minutesToTime(startMin + current.duracion_minutos);
      } else {
        // Inicia cuando termina el bloque anterior
        current.hora_inicio = prev.hora_fin;
        const startMin = this.timeToMinutes(current.hora_inicio);
        current.hora_fin = this.minutesToTime(startMin + current.duracion_minutos);
      }
    }
    return list;
  },

  shiftAll(eventosList, deltaMin) {
    if (!eventosList || eventosList.length === 0) return [];
    const list = [...eventosList];
    const primerInicio = this.timeToMinutes(list[0].hora_inicio) + deltaMin;
    list[0].hora_inicio = this.minutesToTime(primerInicio);
    return this.recalculateCascade(list);
  },

  isNowInRange(horaInicioStr, horaFinStr) {
    const now = new Date();
    const currentMin = (now.getHours() * 60) + now.getMinutes();
    const startMin = this.timeToMinutes(horaInicioStr);
    const endMin = this.timeToMinutes(horaFinStr);
    return currentMin >= startMin && currentMin < endMin;
  }
};