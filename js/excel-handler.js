/**
 * js/excel-handler.js
 * Lector robusto multi-hoja para Día 1, Día 2 y Día 3
 * Soporta mayúsculas, minúsculas, tildes, formatos de hora a.m./p.m. y duraciones H:MM
 */

const ExcelHandler = {
  // Normaliza cualquier texto: quita tildes, pasa a mayúsculas y quita espacios en los bordes
  normalizeText(txt) {
    return (txt || '')
      .toString()
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  // Detecta si una hoja corresponde al Día 1, 2 o 3 (sin importar mayúsculas, tildes, guiones o espacios)
  detectDayNumber(sheetName) {
    const clean = (sheetName || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, ""); // Ej: "Día 1 " -> "dia1"

    const match = clean.match(/^dia0*([1-3])$/) || clean.match(/dia0*([1-3])/);
    return match ? parseInt(match[1], 10) : null;
  },

  // Convierte texto de duración como "1:40", "0:30", "1:12", "45", etc., a minutos exactos
  parseDurationToMinutes(val) {
    if (!val && val !== 0) return 30;
    
    // Si viene como número decimal de Excel (fracción de día, ej: 0.0416667 = 1 hora)
    if (typeof val === 'number') {
      if (val < 1) {
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

  // Convierte "7:00 a. m.", "1:31 p. m.", "13:45", etc., a formato estándar "HH:MM" de 24h
  convertExcelTimeToHHMM(val) {
    if (!val && val !== 0) return null;

    // Si Excel lo entrega como fracción de día
    if (typeof val === 'number') {
      const totalMinutes = Math.round((val % 1) * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    const str = val.toString().trim().toLowerCase();

    // Detección de AM / PM (ej: "7:00 a. m." o "1:31 p. m.")
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

    // Formato con dos puntos directo (ej: "13:30" o "08:00")
    if (str.includes(':')) {
      const parts = str.split(':');
      const hh = (parseInt(parts[0], 10) || 0).toString().padStart(2, '0');
      const mm = (parts[1] || '00').substring(0, 2).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    return null;
  },

  async parseExcelWorkbook(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: false });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("El archivo Excel no tiene hojas.");
          }

          // 1. Filtrar ESTRICTAMENTE las hojas que corresponden a Día 1, Día 2 y Día 3
          const hojasFiltradas = [];
          workbook.SheetNames.forEach(sheetName => {
            const dayNum = this.detectDayNumber(sheetName);
            if (dayNum !== null && dayNum >= 1 && dayNum <= 3) {
              hojasFiltradas.push({ originalName: sheetName, dayNum: dayNum });
            }
          });

          if (hojasFiltradas.length === 0) {
            throw new Error("No se encontraron hojas para Día 1, Día 2 o Día 3 en el archivo.");
          }

          // 2. Ordenar numéricamente: Día 1 -> Día 2 -> Día 3
          hojasFiltradas.sort((a, b) => a.dayNum - b.dayNum);

          const resultadoPorDia = {};

          hojasFiltradas.forEach(({ originalName, dayNum }) => {
            const worksheet = workbook.Sheets[originalName];
            if (!worksheet) return;

            // EXPANDIR RANGO COMPLETO: Asegura que empiece en A1 (col 0, row 0) y cubra hasta la última celda real
            if (worksheet['!ref']) {
              const range = XLSX.utils.decode_range(worksheet['!ref']);
              range.s.r = 0; // Siempre empezar en fila 1 (índice 0)
              range.s.c = 0; // Siempre empezar en col A (índice 0)

              Object.keys(worksheet).forEach(cellKey => {
                if (cellKey[0] === '!') return;
                try {
                  const decoded = XLSX.utils.decode_cell(cellKey);
                  if (decoded.r > range.e.r) range.e.r = decoded.r;
                  if (decoded.c > range.e.c) range.e.c = decoded.c;
                } catch (err) {}
              });
              worksheet['!ref'] = XLSX.utils.encode_range(range);
            }

            const rowsMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
            if (!rowsMatrix || rowsMatrix.length === 0) return;

            // 3. Detectar fila de encabezados buscando coincidencias clave
            let headerRowIndex = -1;
            let colMap = { inicio: 2, duracion: 3, final: 4, tema: 5, detalle: 6, responsable: 7, notas: 8 };

            for (let r = 0; r < Math.min(25, rowsMatrix.length); r++) {
              const row = rowsMatrix[r];
              if (!row || row.length === 0) continue;

              const normCells = row.map(c => this.normalizeText(c));
              const idxInicio = normCells.findIndex(c => c.includes('INICIO') || c === 'HORA' || c.includes('DESDE'));
              const idxTema = normCells.findIndex(c => c.includes('TEMA') || c.includes('ACTIVIDAD') || c.includes('TITULO') || c.includes('DESCRIPCION'));

              // Para considerar que es el encabezado real, debe coincidir al menos INICIO o TEMA
              if (idxInicio !== -1 && (idxTema !== -1 || normCells.some(c => c.includes('DURAC') || c.includes('FINAL')))) {
                headerRowIndex = r;
                colMap.inicio = idxInicio;
                colMap.duracion = normCells.findIndex(c => c.includes('DURAC') || c.includes('MIN') || c.includes('TIEMPO'));
                colMap.final = normCells.findIndex(c => c.includes('FINAL') || c.includes('FIN') || c.includes('HASTA'));
                colMap.tema = idxTema !== -1 ? idxTema : colMap.inicio + 3;
                colMap.detalle = normCells.findIndex(c => c.includes('DETALLE') || c.includes('CONTENIDO'));
                colMap.responsable = normCells.findIndex(c => c.includes('RESPONSABLE') || c.includes('ORADOR') || c.includes('ENCARGADO'));
                colMap.notas = normCells.findIndex(c => c.includes('NOTA') || c.includes('LUGAR') || c.includes('SALA'));
                break;
              }
            }

            // Fallback si la fila no se detectó por nombres: estructura estándar (C=2, D=3, E=4, F=5, G=6, H=7, I=8)
            if (headerRowIndex === -1) {
              headerRowIndex = 4;
              colMap = { inicio: 2, duracion: 3, final: 4, tema: 5, detalle: 6, responsable: 7, notas: 8 };
            } else {
              if (colMap.duracion === -1) colMap.duracion = colMap.inicio + 1;
              if (colMap.final === -1) colMap.final = colMap.inicio + 2;
              if (colMap.tema === -1) colMap.tema = colMap.inicio + 3;
              if (colMap.detalle === -1) colMap.detalle = colMap.inicio + 4;
              if (colMap.responsable === -1) colMap.responsable = colMap.inicio + 5;
              if (colMap.notas === -1) colMap.notas = colMap.inicio + 6;
            }

            // 4. Extraer TODAS las filas de actividades sin omitir ninguna
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

              // Si toda la fila está vacía en los campos principales, la ignoramos
              if (!rawInicio && !rawDuracion && !rawFin && !rawTema && !rawDetalle && !rawResp && !rawNotas) {
                continue;
              }

              // Procesar Hora de Inicio
              let parsedInicio = this.convertExcelTimeToHHMM(rawInicio);
              if (parsedInicio) {
                ultimoInicioValido = parsedInicio;
              } else {
                parsedInicio = ultimoInicioValido;
              }

              // Procesar Duración
              let duracionMin = this.parseDurationToMinutes(rawDuracion);
              if (duracionMin > 0) {
                ultimaDuracionValida = duracionMin;
              } else {
                duracionMin = ultimaDuracionValida;
              }

              // Procesar Hora Fin (Usa la columna FINAL si está presente; si no, la calcula)
              let parsedFin = this.convertExcelTimeToHHMM(rawFin);
              if (!parsedFin) {
                const [h, m] = parsedInicio.split(':').map(Number);
                const totalFinMins = (h * 60) + m + duracionMin;
                const finH = Math.floor(totalFinMins / 60) % 24;
                const finM = totalFinMins % 60;
                parsedFin = `${finH.toString().padStart(2, '0')}:${finM.toString().padStart(2, '0')}`;
              }

              // Procesar Tema / Actividad
              let temaStr = (rawTema || '').toString().trim();
              let detalleStr = (rawDetalle || '').toString().trim();

              if (!temaStr) {
                if (detalleStr || rawResp || rawNotas) {
                  temaStr = detalleStr || (rawResp || rawNotas).toString().trim();
                  detalleStr = '';
                } else {
                  temaStr = "Actividad General";
                }
              }

              // Categorización visual automática
              let categoria = 'normal';
              const textoCompleto = (temaStr + ' ' + detalleStr).toUpperCase();
              if (textoCompleto.includes('VIDEO') || textoCompleto.includes('MUSICA') || textoCompleto.includes('AUDIO') || textoCompleto.includes('ROTATIVO')) {
                categoria = 'video';
              } else if (duracionMin >= 50 || textoCompleto.includes('TALLER') || textoCompleto.includes('CH.C') || textoCompleto.includes('SESION') || textoCompleto.includes('LIDERAZGO')) {
                categoria = 'especial';
              } else if (textoCompleto.includes('COFFEE') || textoCompleto.includes('ALMUERZO') || textoCompleto.includes('RECESO') || textoCompleto.includes('CENA') || textoCompleto.includes('COCTEL')) {
                categoria = 'receso';
              } else if (textoCompleto.includes('PRUEBA') || textoCompleto.includes('INSTALACION') || textoCompleto.includes('VOZ EN OFF') || textoCompleto.includes('SISTEMAS')) {
                categoria = 'tecnico';
              }

              eventosHoja.push({
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                dia_numero: dayNum,
                hora_inicio: parsedInicio,
                _originalInicio: parsedInicio,
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
              // Guardamos bajo el nombre original, bajo "Día X" con tilde y bajo "Dia X" sin tilde
              // para garantizar que app.js lo encuentre sin importar cómo lo busque
              resultadoPorDia[originalName] = eventosHoja;
              resultadoPorDia[`Día ${dayNum}`] = eventosHoja;
              resultadoPorDia[`Dia ${dayNum}`] = eventosHoja;
              resultadoPorDia[dayNum] = eventosHoja;
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
      const eventos = eventosPorDiaMap[dia.id] || eventosPorDiaMap[dia.nombre] || [];
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