/**
 * js/excel-handler.js
 * Importación Drag & Drop con SheetJS y Exportación Estilizada con ExcelJS
 */

const ExcelHandler = {
  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!rawRows || rawRows.length === 0) throw new Error("El archivo está vacío.");

          const eventosNormalizados = rawRows.map((row, index) => {
            const getCol = (keyMatch) => {
              const foundKey = Object.keys(row).find(k => 
                k.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === keyMatch
              );
              return foundKey ? row[foundKey] : '';
            };

            const inicio = (getCol('INICIO') || '09:00').toString();
            const duracion = TimeCalc.parseDurationToMinutes(getCol('DURACION') || 30);
            const fin = (getCol('FINAL') || TimeCalc.minutesToTime(TimeCalc.timeToMinutes(inicio) + duracion)).toString();
            const tema = (getCol('TEMA') || `Actividad ${index + 1}`).toString();
            const detalle = (getCol('DETALLE') || '').toString();
            const responsable = (getCol('RESPONSABLE') || '').toString();
            const notas = (getCol('NOTAS') || '').toString();

            // Auto-detectar categoría según palabras clave
            let categoria = 'normal';
            const t = tema.toUpperCase();
            if (t.includes('VIDEO') || t.includes('MUSICA') || t.includes('AUDIO')) categoria = 'video';
            else if (duracion >= 60 || t.includes('TALLER') || t.includes('CH.C')) categoria = 'especial';
            else if (t.includes('COFFEE') || t.includes('ALMUERZO')) categoria = 'receso';

            return {
              id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              hora_inicio: inicio,
              _originalInicio: inicio,
              duracion_minutos: duracion,
              hora_fin: fin,
              tema: tema,
              detalle: detalle,
              responsable: responsable,
              notas: notas,
              categoria: categoria,
              orden: index + 1
            };
          });

          resolve(TimeCalc.recalculateCascade(eventosNormalizados));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
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

  async exportAgendaToExcel(diaNombre, eventos) {
    if (!eventos || eventos.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(diaNombre || 'Dia 1', { views: [{ showGridLines: true }] });

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

    const AZUL_ENCABEZADO = '13547A';
    const TEXTO_BLANCO = 'FFFFFF';
    const BORDE_GRIS = 'D9D9D9';
    const COLORES = {
      video: 'E2EFDA',     // Verde suave
      especial: 'FCE4D6',  // Melocotón suave
      receso: 'D9E1F2',    // Azul pastel
      tecnico: 'FCE8E6',   // Rojo tenue
      normal: null
    };

    // Título superior
    sheet.mergeCells('C2:D4');
    const cHorario = sheet.getCell('C2');
    cHorario.value = 'Horario';
    cHorario.font = { name: 'Arial', size: 16, bold: true, color: { argb: TEXTO_BLANCO } };
    cHorario.alignment = { vertical: 'middle', horizontal: 'center' };
    cHorario.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

    sheet.mergeCells('E2:I2');
    const cTit = sheet.getCell('E2');
    cTit.value = 'FSL - Agenda Oficial 2026';
    cTit.font = { name: 'Arial', size: 12, bold: true, color: { argb: TEXTO_BLANCO } };
    cTit.alignment = { vertical: 'middle', horizontal: 'center' };
    cTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

    sheet.mergeCells('E3:I3');
    const cSub = sheet.getCell('E3');
    cSub.value = `${diaNombre} - Sesión General`;
    cSub.font = { name: 'Arial', size: 11, bold: true, color: { argb: TEXTO_BLANCO } };
    cSub.alignment = { vertical: 'middle', horizontal: 'center' };
    cSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

    sheet.mergeCells('E4:I4');
    const cFecha = sheet.getCell('E4');
    cFecha.value = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    cFecha.font = { name: 'Arial', size: 10, bold: true, color: { argb: TEXTO_BLANCO } };
    cFecha.alignment = { vertical: 'middle', horizontal: 'center' };
    cFecha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };

    // Encabezados
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

    // Filas
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

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Agenda_${(diaNombre || 'Dia_1').replace(/\s+/g, '_')}_FSL.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};