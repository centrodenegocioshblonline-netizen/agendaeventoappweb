/**
 * js/excel-handler.js
 * Lector y Generador robusto multi-hoja para Día 1, Día 2 y Día 3.
 * Compatible con fórmulas nativas de Excel y detección universal de hojas/columnas.
 */

const ExcelHandler = {
  // Normaliza textos: remueve acentos, dobles espacios y pasa a mayúsculas
  normalizeText(txt) {
    return (txt || '')
      .toString()
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  // Identifica si una hoja corresponde al Día 1, 2 o 3 sin importar el formato del nombre
  detectDayNumber(sheetName) {
    const clean = (sheetName || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, ""); // Ej: "Día 1 - Mañana" -> "dia1manana"

    const match = clean.match(/dia0*([1-3])/);
    return match ? parseInt(match[1], 10) : null;
  },

  // Convierte duraciones ("1:40", "0:30", número serial de Excel o minutos puros) a enteros
  parseDurationToMinutes(val) {
    if (val === null || val === undefined || val === '') return 30;

    // Número decimal de Excel (fracción de día, ej: 0.020833 = 30 min)
    if (typeof val === 'number') {
      if (val > 0 && val < 1) {
        return Math.round(val * 24 * 60);
      }
      return Math.round(val);
    }

    const str = val.toString().trim();
    if (str.includes(':')) {
      const parts = str.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      return (hours * 60) + mins;
    }

    const numericOnly = parseInt(str.replace(/[^\d]/g, ''), 10);
    return isNaN(numericOnly) || numericOnly <= 0 ? 30 : numericOnly;
  },

  // Convierte cualquier formato de hora (AM/PM, 24h o serial de Excel) a "HH:MM"
  convertExcelTimeToHHMM(val) {
    if (val === null || val === undefined || val === '') return null;

    if (typeof val === 'number') {
      // Fracción decimal de día de Excel
      const dayFraction = val % 1;
      const totalMinutes = Math.round(dayFraction * 24 * 60);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    const str = val.toString().trim().toLowerCase();

    // Detección AM / PM (ej: "7:30 a. m." o "1:31 p.m.")
    if (str.includes('m.') || str.includes('am') || str.includes('pm')) {
      const isPm = str.includes('p');
      const cleanDigits = str.replace(/[^\d:]/g, '');
      const parts = cleanDigits.split(':');
      let hours = parseInt(parts[0], 10) || 0;
      const mins = parts[1] ? parts[1].substring(0, 2).padStart(2, '0') : '00';

      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;

      return `${hours.toString().padStart(2, '0')}:${mins}`;
    }

    // Formato 24 Horas directo (ej: "13:45" o "08:30")
    if (str.includes(':')) {
      const parts = str.split(':');
      const hh = (parseInt(parts[0], 10) || 0).toString().padStart(2, '0');
      const mm = (parts[1] || '00').replace(/[^\d]/g, '').substring(0, 2).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    return null;
  },

  // LECTURA DEL WORKBOOK COMPLETO
  async parseExcelWorkbook(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: false });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("El archivo Excel no contiene hojas de cálculo.");
          }

          // Filtrar y ordenar hojas que correspondan a Día 1, Día 2 y Día 3
          const hojasFiltradas = [];
          workbook.SheetNames.forEach(name => {
            const dayNum = this.detectDayNumber(name);
            if (dayNum !== null && dayNum >= 1 && dayNum <= 3) {
              hojasFiltradas.push({ originalName: name, dayNum: dayNum });
            }
          });

          if (hojasFiltradas.length === 0) {
            throw new Error("No se encontraron hojas válidas correspondientes a 'Día 1', 'Día 2' o 'Día 3'.");
          }

          hojasFiltradas.sort((a, b) => a.dayNum - b.dayNum);

          const resultadoPorDia = {};

          hojasFiltradas.forEach(({ originalName, dayNum }) => {
            const worksheet = workbook.Sheets[originalName];
            if (!worksheet) return;

            // Asegurar que el rango cubra todo desde A1
            if (worksheet['!ref']) {
              const range = XLSX.utils.decode_range(worksheet['!ref']);
              range.s.r = 0;
              range.s.c = 0;
              worksheet['!ref'] = XLSX.utils.encode_range(range);
            }

            const rowsMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
            if (!rowsMatrix || rowsMatrix.length === 0) return;

            // Escaneo dinámico de la fila de encabezados
            let headerRowIndex = -1;
            let colMap = { inicio: 1, duracion: 2, final: 3, tema: 4, detalle: 5, responsable: 6, notas: 7 };

            for (let r = 0; r < Math.min(15, rowsMatrix.length); r++) {
              const row = rowsMatrix[r];
              if (!row || row.length === 0) continue;

              const normCells = row.map(c => this.normalizeText(c));
              const idxInicio = normCells.findIndex(c => c.includes('INICIO') || c === 'HORA');
              const idxTema = normCells.findIndex(c => c.includes('TEMA') || c.includes('ACTIVIDAD'));

              if (idxInicio !== -1 && (idxTema !== -1 || normCells.some(c => c.includes('DURAC')))) {
                headerRowIndex = r;
                colMap.inicio = idxInicio;
                colMap.duracion = normCells.findIndex(c => c.includes('DURAC') || c.includes('MIN'));
                colMap.final = normCells.findIndex(c => c.includes('FINAL') || c.includes('FIN'));
                colMap.tema = idxTema !== -1 ? idxTema : colMap.inicio + 3;
                colMap.detalle = normCells.findIndex(c => c.includes('DETALLE'));
                colMap.responsable = normCells.findIndex(c => c.includes('RESPONSABLE') || c.includes('ORADOR'));
                colMap.notas = normCells.findIndex(c => c.includes('NOTA') || c.includes('SALA'));
                break;
              }
            }

            // Fallback según la plantilla estándar (Col B a H)
            if (headerRowIndex === -1) {
              headerRowIndex = 3; // Fila 4 indexada en 0
              colMap = { inicio: 1, duracion: 2, final: 3, tema: 4, detalle: 5, responsable: 6, notas: 7 };
            }

            const eventosHoja = [];
            let ultimoInicioValido = "07:00";
            let ultimaDuracionValida = 30;

            for (let r = headerRowIndex + 1; r < rowsMatrix.length; r++) {
              const row = rowsMatrix[r];
              if (!row || row.length === 0) continue;

              const rawInicio = row[colMap.inicio];
              const rawDuracion = row[colMap.duracion];
              const rawFin = colMap.final !== -1 ? row[colMap.final] : '';
              const rawTema = row[colMap.tema];
              const rawDetalle = colMap.detalle !== -1 ? row[colMap.detalle] : '';
              const rawResp = colMap.responsable !== -1 ? row[colMap.responsable] : '';
              const rawNotas = colMap.notas !== -1 ? row[colMap.notas] : '';

              // Ignorar filas totalmente vacías
              if (!rawInicio && !rawDuracion && !rawFin && !rawTema && !rawDetalle && !rawResp && !rawNotas) {
                continue;
              }

              let parsedInicio = this.convertExcelTimeToHHMM(rawInicio) || ultimoInicioValido;
              ultimoInicioValido = parsedInicio;

              let duracionMin = this.parseDurationToMinutes(rawDuracion) || ultimaDuracionValida;
              ultimaDuracionValida = duracionMin;

              let parsedFin = this.convertExcelTimeToHHMM(rawFin);
              if (!parsedFin) {
                const [h, m] = parsedInicio.split(':').map(Number);
                const totalFinMins = (h * 60) + m + duracionMin;
                const finH = Math.floor(totalFinMins / 60) % 24;
                const finM = totalFinMins % 60;
                parsedFin = `${finH.toString().padStart(2, '0')}:${finM.toString().padStart(2, '0')}`;
              }

              let temaStr = (rawTema || '').toString().trim();
              let detalleStr = (rawDetalle || '').toString().trim();

              if (!temaStr) {
                temaStr = detalleStr || (rawResp || rawNotas).toString().trim() || "Actividad";
                detalleStr = '';
              }

              // Categorización visual automática idéntica al diseño
              let categoria = 'normal';
              const fullText = `${temaStr} ${detalleStr}`.toUpperCase();
              if (fullText.includes('VIDEO') || fullText.includes('MUSICA') || fullText.includes('ROTATIVO')) {
                categoria = 'video';
              } else if (duracionMin >= 50 || fullText.includes('CH.C') || fullText.includes('SESION') || fullText.includes('TALLER')) {
                categoria = 'especial';
              } else if (fullText.includes('ALMUERZO') || fullText.includes('RECESO') || fullText.includes('COFFEE')) {
                categoria = 'receso';
              } else if (fullText.includes('AUDIOVISUAL') || fullText.includes('PRUEBA') || fullText.includes('VOZ EN OFF')) {
                categoria = 'tecnico';
              }

              eventosHoja.push({
                id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                dia_numero: dayNum,
                hora_inicio: parsedInicio,
                duracion_minutos: duracionMin,
                hora_fin: parsedFin,
                tema: temaStr,
                detalle: detalleStr,
                responsable: (rawResp || '').toString().trim(),
                notas: (rawNotas || '').toString().trim(),
                categoria: categoria,
                orden: eventosHoja.length + 1
              });
            }

            if (eventosHoja.length > 0) {
              resultadoPorDia[originalName] = eventosHoja;
              resultadoPorDia[`Dia ${dayNum}`] = eventosHoja;
              resultadoPorDia[`Día ${dayNum}`] = eventosHoja;
              resultadoPorDia[dayNum] = eventosHoja;
            }
          });

          resolve(resultadoPorDia);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // EXPORTACIÓN A EXCEL (Respeta columnas originales B a H y fórmulas minuto a minuto)
  async exportAllDaysToExcel(diasList, eventosPorDiaMap) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Agenda Master App';
    workbook.created = new Date();

    const COLOR_HEADER = '13547A';
    const COLOR_TEXT_BLANCO = 'FFFFFF';
    const BORDE_COLOR = 'D9D9D9';

    const COLORES_CATEGORIA = {
      video: 'E2EFDA',     // Verde suave
      especial: 'FCE4D6',  // Naranja suave
      receso: 'D9E1F2',    // Azul pastel
      tecnico: 'FCE8E6',   // Rosado técnico
      normal: 'FFFFFF'
    };

    diasList.forEach(dia => {
      const eventos = eventosPorDiaMap[dia.id] || eventosPorDiaMap[dia.nombre] || eventosPorDiaMap[dia.numero] || [];
      if (!eventos || eventos.length === 0) return;

      const sheetTitle = (dia.nombre || `Dia ${dia.numero || 1}`).replace(/[/\\?*[\]]/g, '').slice(0, 31);
      const sheet = workbook.addWorksheet(sheetTitle, { views: [{ showGridLines: true }] });

      // Anchos idénticos a la plantilla de Excel
      sheet.columns = [
        { key: 'colA', width: 4 },   // Margen
        { key: 'inicio', width: 14 }, // B
        { key: 'dur', width: 12 },    // C
        { key: 'fin', width: 14 },    // D
        { key: 'tema', width: 32 },   // E
        { key: 'det', width: 48 },    // F
        { key: 'resp', width: 22 },   // G
        { key: 'notas', width: 22 }   // H
      ];

      // Bloque superior izquierdo combinado (B2:D3)
      sheet.mergeCells('B2:D3');
      const cHorario = sheet.getCell('B2');
      cHorario.value = 'Horario';
      cHorario.font = { name: 'Arial', size: 16, bold: true, color: { argb: COLOR_TEXT_BLANCO } };
      cHorario.alignment = { vertical: 'middle', horizontal: 'center' };
      cHorario.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };

      // Encabezados descriptivos combinados (E1:H3)
      const titulos = [
        { cell: 'E1', merge: 'E1:H1', text: 'FSL - Caracas OCT 2026', size: 11, bold: true },
        { cell: 'E2', merge: 'E2:H2', text: `${dia.nombre || 'Día'} - Sesión Oficial`, size: 11, bold: true },
        { cell: 'E3', merge: 'E3:H3', text: 'Agenda Minuto a Minuto', size: 10, bold: false }
      ];

      titulos.forEach(t => {
        sheet.mergeCells(t.merge);
        const cell = sheet.getCell(t.cell);
        cell.value = t.text;
        cell.font = { name: 'Arial', size: t.size, bold: t.bold, color: { argb: COLOR_TEXT_BLANCO } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
      });

      // Fila 4: Nombres de columnas
      const headers = [
        { col: 2, label: 'INICIO' },
        { col: 3, label: 'DURACIÓN' },
        { col: 4, label: 'FINAL' },
        { col: 5, label: 'TEMA' },
        { col: 6, label: 'DETALLE' },
        { col: 7, label: 'RESPONSABLE' },
        { col: 8, label: 'NOTAS' }
      ];

      const row4 = sheet.getRow(4);
      row4.height = 24;
      headers.forEach(h => {
        const c = row4.getCell(h.col);
        c.value = h.label;
        c.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_TEXT_BLANCO } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
      });

      // Filas de actividades con FÓRMULAS VIVAS de Excel
      eventos.forEach((ev, idx) => {
        const rowIdx = 5 + idx;
        const row = sheet.getRow(rowIdx);
        row.height = 24;

      // B: HORA INICIO
        const cellInicio = row.getCell(2);
        if (idx === 0) {
          // Primera actividad: Hora base estática como fracción de día
          const [h, m] = (ev.hora_inicio || '07:00').split(':').map(Number);
          cellInicio.value = (h / 24) + (m / 1440);
        } else {
          // Filas siguientes: Fórmula encadenada al FINAL anterior
          cellInicio.value = { formula: `D${rowIdx - 1}` };
        }
        cellInicio.numFmt = 'hh:mm AM/PM';

        // C: DURACIÓN (Fracción de día = minutos / 1440)
        const cellDur = row.getCell(3);
        const mins = Number(ev.duracion_minutos) || 30;
        cellDur.value = mins / 1440;
        cellDur.numFmt = '[h]:mm';

        // D: HORA FINAL (Fórmula = INICIO + DURACIÓN)
        const cellFin = row.getCell(4);
        cellFin.value = { formula: `B${rowIdx}+C${rowIdx}` };
        cellFin.numFmt = 'hh:mm AM/PM';

        // E a H: Datos descriptivos
        row.getCell(5).value = ev.tema || '';
        row.getCell(6).value = ev.detalle || '';
        row.getCell(7).value = ev.responsable || '';
        row.getCell(8).value = ev.notas || '';

        // Estilos, bordes y colores por categoría
        const bgHex = COLORES_CATEGORIA[ev.categoria] || COLORES_CATEGORIA.normal;

        for (let col = 2; col <= 8; col++) {
          const c = row.getCell(col);
          c.font = { name: 'Arial', size: 9 };
          
          if (col >= 2 && col <= 4) {
            c.alignment = { vertical: 'middle', horizontal: 'center' };
            c.font.bold = true;
          } else {
            c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          }

          if (bgHex !== 'FFFFFF') {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
          }

          c.border = {
            top: { style: 'thin', color: { argb: BORDE_COLOR } },
            bottom: { style: 'thin', color: { argb: BORDE_COLOR } },
            left: { style: 'thin', color: { argb: BORDE_COLOR } },
            right: { style: 'thin', color: { argb: BORDE_COLOR } }
          };
        }
      });
    });

    // Generar buffer y descargar archivo
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
