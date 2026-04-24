const REGLAS: [RegExp, string][] = [
  [/sill[aó]|chair|asiento/i, 'Asiento ergonómico'],
  [/escritorio|desk/i, 'Mesa de trabajo'],
  [/monitor|pantalla|display/i, 'Monitor de computadora'],
  [/teclado|keyboard/i, 'Periférico de entrada'],
  [/rack|estante|shelf|shelv/i, 'Sistema de almacenamiento'],
  [/l[aá]mpar|lamp|light|iluminac/i, 'Accesorio de iluminación'],
  [/archiv|gabinete|cabinet/i, 'Mueble archivero'],
  [/sof[aá]|sill[oó]n|couch/i, 'Mueble de descanso'],
  [/mesa|table/i, 'Mueble de superficie'],
  [/caj[oó]n|drawer/i, 'Accesorio de almacenamiento'],
  [/impresora|printer/i, 'Equipo de impresión'],
  [/alfombr|tapete|rug|carpet/i, 'Cubierta de piso textil'],
  [/cort[ií]n|persiana|blind/i, 'Accesorio textil decorativo'],
  [/panel|partici[oó]n|divid/i, 'Panel divisorio'],
  [/pizarr|whiteboard|pizarrón/i, 'Pizarrón de escritura'],
  [/locker|casillero/i, 'Casillero de almacenamiento'],
  [/bancada|banca|bench/i, 'Bancada de uso múltiple'],
]

export function generarDescripcionGenerica(descripcion: string): string {
  for (const [re, resultado] of REGLAS) {
    if (re.test(descripcion)) return resultado
  }
  return 'Artículo de mobiliario e instalación'
}
