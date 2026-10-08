/**
 * js/excel-handler.js
 * Gestión de lectura Drag & Drop y descarga en formato Excel con SheetJS
 */

const ExcelHandler = {
  /**
   * Procesa el archivo binario cargado y devuelve un arreglo de eventos normalizados
   */
  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Tomamos la primera hoja
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convertimos a JSON en crudo
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!rawRows || rawRows.length === 0) {
            throw new Error("El archivo Excel está vacío.");
          }

          // Normalizar encabezados (quitar acentos, mayúsculas)
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
              orden: index + 1
            };
          });

          // Aplicar recálculo en cascada para garantizar coherencia
          const eventosConCascada = TimeCalc.recalculateCascade(eventosNormalizados);
          resolve(eventosConCascada);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Genera y descarga un archivo .xlsx listo para compartir
   */
  exportAgendaToExcel(diaNombre, eventos) {
    if (!eventos || eventos.length === 0) {
      alert("No hay actividades para exportar.");
      return;
    }

    // Estructurar filas con los nombres de columna solicitados
    const rows = eventos.map(ev => ({
      'INICIO': ev.hora_inicio,
      'DURACIÓN': `${ev.duracion_minutos} min`,
      'FINAL': ev.hora_fin,
      'TEMA': ev.tema,
      'DETALLE': ev.detalle || '',
      'RESPONSABLE': ev.responsable || '',
      'NOTAS': ev.notas || ''
    }));

    // Crear libro y hoja
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Ajustar anchos de columnas
    worksheet['!cols'] = [
      { wch: 10 }, // INICIO
      { wch: 12 }, // DURACIÓN
      { wch: 10 }, // FINAL
      { wch: 30 }, // TEMA
      { wch: 35 }, // DETALLE
      { wch: 22 }, // RESPONSABLE
      { wch: 25 }, // NOTAS
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, diaNombre || 'Agenda');

    const fileName = `Agenda_${(diaNombre || 'Evento').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
};