/**
 * js/excel-handler.js
 * Importación Multi-Hoja (Dia 1, Dia 2, Dia 3) y Exportación Multi-Pestaña con ExcelJS
 */

const ExcelHandler = {
  /**
   * Normaliza textos quitando tildes y espacios extras
   */
  normalizeText(txt) {
    return (txt || '').toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  },

  /**
   * Lee un archivo Excel analizando todas sus hojas de cálculo (Dia 1, Dia 2, Dia 3...)
   */
  async parseExcelWorkbook(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("El archivo no contiene hojas de cálculo.");
          }

          // Filtramos las hojas que correspondan a "Dia X" o "Día X"
          const hojasDias = workbook.SheetNames.filter(name => {
            const norm = this.normalizeText(name);
            return norm.startsWith("DIA ") || norm === "DIA1" || norm === "DIA2" || norm === "DIA3";
          });

          // Si no encuentra hojas con nombre "Dia X", toma todas las hojas disponibles o la primera
          const hojasAProcesar = hojasDias.length > 0 ? hojasDias : [workbook.SheetNames[0]];

          const resultadoPorDia = {}; // { 'Dia 1': [...eventos], 'Dia 2': [...eventos] }

          hojasAProcesar.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            // Leemos como matriz bidimensional (fila por fila) para encontrar dónde están los encabezados reales
            const rowsMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (!rowsMatrix || rowsMatrix.length === 0) return;

            // 1. Encontrar la fila donde están 'INICIO' y 'TEMA' (en tu plantilla suele ser la Fila 5)
            let headerRowIndex = -1;
            let colIndexMap = { inicio: -1, duracion: -1, final: -1, tema: -1, detalle: -1, responsable: -1, notas: -1 };

            for (let r = 0; r < Math.min(15, rowsMatrix.length); r++) {
              const row = rowsMatrix[r];
              const normalizedCells = row.map(c => this.normalizeText(c));

              const idxInicio = normalizedCells.findIndex(c => c === 'INICIO');
              const idxTema = normalizedCells.findIndex(c => c === 'TEMA');

              if (idxInicio !== -1 && idxTema !== -1) {
                headerRowIndex = r;
                colIndexMap.inicio = idxInicio;
                colIndexMap.duracion = normalizedCells.findIndex(c => c.includes('DURAC'));
                colIndexMap.final = normalizedCells.findIndex(c => c.includes('FINAL') || c.includes('FIN'));
                colIndexMap.tema = idxTema;
                colIndexMap.detalle = normalizedCells.findIndex(c => c.includes('DETALLE'));
                colIndexMap.responsable = normalizedCells.findIndex(c => c.includes('RESPONSABLE'));
                colIndexMap.notas = normalizedCells.findIndex(c => c.includes('NOTA'));
                break;
              }
            }

            // Si no encontró cabecera con ese formato, saltamos esa hoja
            if (headerRowIndex === -1) return;

            // 2. Extraer actividades a partir de la fila siguiente
            const eventosHoja = [];
            for (let r = headerRowIndex + 1; r < rowsMatrix.length; r++) {
              const row = rowsMatrix[r];
              if (!row || row.length === 0) continue;

              const valInicio = row[colIndexMap.inicio];
              const valTema = row[colIndexMap.tema];

              // Si la fila no tiene inicio ni tema, suele ser una fila en blanco o de cierre
              if (!valInicio && !valTema) continue;

              const inicioStr = this.formatExcelTimeValue(valInicio);
              const duracion = TimeCalc.parseDurationToMinutes(row[colIndexMap.duracion] || 30);
              const finCalculado = TimeCalc.minutesToTime(TimeCalc.timeToMinutes(inicioStr) + duracion);
              const finStr = colIndexMap.final !== -1 && row[colIndexMap.final] ? this.formatExcelTimeValue(row[colIndexMap.final]) : finCalculado;
              const temaStr = (valTema || '').toString().trim();
              const detalleStr = colIndexMap.detalle !== -1 ? (row[colIndexMap.detalle] || '').toString().trim() : '';
              const respStr = colIndexMap.responsable !== -1 ? (row[colIndexMap.responsable] || '').toString().trim() : '';
              const notasStr = colIndexMap.notas !== -1 ? (row[colIndexMap.notas] || '').toString().trim() : '';

              // Clasificar categoría para color
              let categoria = 'normal';
              const t = temaStr.toUpperCase();
              if (t.includes('VIDEO') || t.includes('MUSICA') || t.includes('AUDIO') || t.includes('ROTATIVO')) categoria = 'video';
              else if (duracion >= 50 || t.includes('TALLER') || t.includes('CH.C') || t.includes('SESION')) categoria = 'especial';
              else if (t.includes('COFFEE') || t.includes('ALMUERZO') || t.includes('RECESO')) categoria = 'receso';
              else if (t.includes('PRUEBA') || t.includes('INSTALACION') || t.includes('VOZ EN OFF')) categoria = 'tecnico';

              eventosHoja.push({
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                hora_inicio: inicioStr,
                _originalInicio: inicioStr,
                duracion_minutos: duracion,
                hora_fin: finStr,
                tema: temaStr,
                detalle: detalleStr,
                responsable: respStr,
                notas: notasStr,
                categoria: categoria,
                orden: eventosHoja.length + 1
              });
            }

            if (eventosHoja.length > 0) {
              resultadoPorDia[sheetName] = TimeCalc.recalculateCascade(eventosHoja);
            }
          });

          resolve(resultadoPorDia);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Convierte valores de hora de Excel (fechas seriales, "7:00 a. m." o "07:30") a "HH:MM"
   */
  formatExcelTimeValue(val) {
    if (!val) return "08:00";
    if (typeof val === 'number') {
      // Excel guarda horas como fracción de día (ej: 0.5 = 12:00)
      const totalMinutes = Math.round(val * 24 * 60);
      return TimeCalc.minutesToTime(totalMinutes);
    }
    const str = val.toString().trim().toLowerCase();
    
    // Si viene como "7:00 a. m." o "07:30 pm"
    if (str.includes('m.')) {
      const isPm = str.includes('p');
      const timePart = str.replace(/[^\d:]/g, '');
      const parts = timePart.split(':');
      let hours = parseInt(parts[0], 10) || 0;
      const mins = parts[1] || '00';
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${mins}`;
    }

    if (str.includes(':')) {
      const parts = str.split(':');
      const hh = parts[0].padStart(2, '0');
      const mm = (parts[1] || '00').substring(0, 2);
      return `${hh}:${mm}`;
    }

    return "08:00";
  },

  formatMinutesToStr(min) {
    const hrs = Math.floor(min / 60);
    const mins = min % 60;
    return `${hrs}:${mins.toString().padStart(2, '0')}`;
  },

  formatTimeToAmPm(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  },

  /**
   * EXPORTACIÓN DE TODAS LAS PESTAÑAS (Dia 1, Dia 2, Dia 3) EN UN SOLO ARCHIVO EXCEL
   */
  async exportAllDaysToExcel(diasList, eventosPorDiaMap) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Agenda Master';
    workbook.created = new Date();

    const AZUL_ENCABEZADO = '13547A';
    const TEXTO_BLANCO = 'FFFFFF';
    const BORDE_GRIS = 'D9D9D9';
    const COLORES = {
      video: 'E2EFDA',
      especial: 'FCE4D6',
      receso: 'D9E1F2',
      tecnico: 'FCE8E6',
      normal: null
    };

    diasList.forEach(dia => {
      const eventos = eventosPorDiaMap[dia.id] || [];
      if (eventos.length === 0) return;

      const sheetName = (dia.nombre || 'Dia').replace(/[/\\?*[\]]/g, '').slice(0, 31);
      const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

      sheet.columns = [
        { key: 'colA', width: 4 },
        { key: 'colB', width: 4 },
        { key: 'inicio', width: 14 },
        { key: 'duracion', width: 12 },
        { key: 'fin', width: 14 },
        { key: 'tema', width: 34 },
        { key: 'detalle', width: 45 },
        { key: 'responsable', width: 22 },
        { key: 'notas', width: 25 },
      ];

      // Bloque superior idéntico a tu modelo
      sheet.mergeCells('C2:D4');
      const cHorario = sheet.getCell('C2');
      cHorario.value = 'Horario';
      cHorario.font = { name: 'Arial', size: 16, bold: true, color: { argb: TEXTO_BLANCO } };
      cHorario.alignment = { vertical: 'middle', horizontal: 'center' };
      cHorario.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

      sheet.mergeCells('E2:I2');
      const cTit = sheet.getCell('E2');
      cTit.value = 'FSL - Caracas OCT 2026';
      cTit.font = { name: 'Arial', size: 12, bold: true, color: { argb: TEXTO_BLANCO } };
      cTit.alignment = { vertical: 'middle', horizontal: 'center' };
      cTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

      sheet.mergeCells('E3:I3');
      const cSub = sheet.getCell('E3');
      cSub.value = `${dia.nombre} - Sesión Oficial`;
      cSub.font = { name: 'Arial', size: 11, bold: true, color: { argb: TEXTO_BLANCO } };
      cSub.alignment = { vertical: 'middle', horizontal: 'center' };
      cSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

      sheet.mergeCells('E4:I4');
      const cFecha = sheet.getCell('E4');
      cFecha.value = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      cFecha.font = { name: 'Arial', size: 10, bold: true, color: { argb: TEXTO_BLANCO } };
      cFecha.alignment = { vertical: 'middle', horizontal: 'center' };
      cFecha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

      // Encabezados en fila 5
      const headers = ['INICIO', 'DURACIÓN', 'FINAL', 'TEMA', 'DETALLE', 'RESPONSABLE', 'NOTAS'];
      const row5 = sheet.getRow(5);
      headers.forEach((h, idx) => {
        const cell = row5.getCell(idx + 3);
        cell.value = h;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: TEXTO_BLANCO } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };
      });
      row5.height = 24;

      // Filas de datos
      eventos.forEach((ev, idx) => {
        const row = sheet.getRow(6 + idx);
        row.getCell(3).value = this.formatTimeToAmPm(ev.hora_inicio);
        row.getCell(4).value = this.formatMinutesToStr(ev.duracion_minutos);
        row.getCell(5).value = this.formatTimeToAmPm(ev.hora_fin);
        row.getCell(6).value = ev.tema || '';
        row.getCell(7).value = ev.detalle || '';
        row.getCell(8).value = ev.responsable || '';
        row.getCell(9).value = ev.notas || '';

        const bg = COLORES[ev.categoria] || null;

        for (let c = 3; c <= 9; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Arial', size: 9 };
          if (c >= 3 && c <= 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font.bold = true;
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          }
          if (bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = {
            top: { style: 'thin', color: { argb: BORDE_GRIS } },
            bottom: { style: 'thin', color: { argb: BORDE_GRIS } },
            left: { style: 'thin', color: { argb: BORDE_GRIS } },
            right: { style: 'thin', color: { argb: BORDE_GRIS } }
          };
        }
        row.height = 22;
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Agenda_Completa_FSL_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};