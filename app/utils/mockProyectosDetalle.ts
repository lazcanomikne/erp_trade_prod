import type { ProyectoDetalleInicial } from '~/types'

const DETALLES: Record<string, Pick<ProyectoDetalleInicial, 'porcentajeServicio' | 'tarifaImportacionPct' | 'anticipoUsd' | 'fleteUsd' | 'aduanaUsd' | 'pagos' | 'articulos'>> = {
  'PRY-2025-014': {
    porcentajeServicio: 21,
    tarifaImportacionPct: 21,
    anticipoUsd: 10500,
    fleteUsd: 850,
    aduanaUsd: 420,
    pagos: [
      { id: 'p1', montoUsd: 8000, fecha: '2025-03-12', nota: 'Anticipo' },
      { id: 'p2', montoUsd: 2500, fecha: '2025-04-01', nota: 'Parcial' }
    ],
    articulos: [
      {
        id: 'a1',
        sg: 'SG-88421',
        referenciaLogistica: 'SG/88421A12',
        descripcion: 'Silla comedor modelo San Pedro (roble)',
        imagenUrl: 'https://picsum.photos/seed/silla88421/96/96',
        cantidadTotal: 8,
        cantidadRecibida: 2,
        precioUnitario: 425.5,
        estatus: 'Laredo'
      },
      {
        id: 'a2',
        sg: 'SG-88422',
        referenciaLogistica: 'SG/17958Y64',
        descripcion: 'Mesa auxiliar 1.2m (evitar confusión con mesa principal)',
        imagenUrl: 'https://picsum.photos/seed/mesa88422/96/96',
        cantidadTotal: 1,
        cantidadRecibida: 1,
        precioUnitario: 2800,
        estatus: 'Monterrey'
      },
      {
        id: 'a3',
        sg: 'SG-88423',
        descripcion: 'Lámparas colgantes set x3',
        imagenUrl: 'https://picsum.photos/seed/lamp88423/96/96',
        cantidadTotal: 12,
        cantidadRecibida: 5,
        precioUnitario: 189.25,
        estatus: 'En Aduana'
      },
      {
        id: 'a4',
        sg: 'SG-88424',
        descripcion: 'Persianas enrollables dormitorio',
        imagenUrl: 'https://picsum.photos/seed/pers88424/96/96',
        cantidadTotal: 14,
        cantidadRecibida: 0,
        precioUnitario: 312,
        estatus: 'Laredo'
      },
      {
        id: 'a5',
        sg: 'SG-88425',
        descripcion: 'Paquete acabados y herrajes (varios)',
        imagenUrl: 'https://picsum.photos/seed/varios88425/96/96',
        cantidadTotal: 1,
        cantidadRecibida: 0,
        precioUnitario: 20776,
        estatus: 'Laredo'
      }
    ]
  },
  'PRY-2025-008': {
    porcentajeServicio: 21,
    tarifaImportacionPct: 21,
    anticipoUsd: 45000,
    fleteUsd: 3200,
    aduanaUsd: 1800,
    pagos: [{ id: 'p1', montoUsd: 45000, fecha: '2025-02-20', nota: 'Transferencia' }],
    articulos: [
      {
        id: 'b1',
        sg: 'SG-77001',
        descripcion: 'Elevador carga 500kg',
        imagenUrl: 'https://picsum.photos/seed/elev77001/96/96',
        cantidadTotal: 2,
        cantidadRecibida: 1,
        precioUnitario: 24000,
        estatus: 'En Aduana'
      }
    ]
  }
}

const MOCK_DEFAULTS: Omit<ProyectoDetalleInicial, 'articulos' | 'pagos' | 'fleteUsd' | 'aduanaUsd' | 'porcentajeServicio' | 'tarifaImportacionPct' | 'anticipoUsd'> = {
  maniobrasUsd: 0,
  fleteLaredoMtyUsd: 0,
  fleteNacionalUsd: 0,
  fletesExtra: [],
  otrosExtras: [],
  igiPct: 0,
  wireTransferUsd: 0,
  comercializadoraPct: 0,
  despachoAduanalDivisor: 60000,
  fleteLogisticaDivisor: 60000
}

export function getProyectoDetalleInicial(id: string): ProyectoDetalleInicial {
  const seed = DETALLES[id]
  if (seed) {
    return {
      ...MOCK_DEFAULTS,
      articulos: seed.articulos.map(a => ({ ...a })),
      pagos: seed.pagos.map(p => ({ ...p })),
      fleteUsd: seed.fleteUsd,
      aduanaUsd: seed.aduanaUsd,
      porcentajeServicio: seed.porcentajeServicio,
      tarifaImportacionPct: seed.tarifaImportacionPct,
      anticipoUsd: seed.anticipoUsd
    }
  }
  return {
    ...MOCK_DEFAULTS,
    articulos: [],
    pagos: [],
    fleteUsd: 0,
    aduanaUsd: 0,
    porcentajeServicio: 21,
    tarifaImportacionPct: 20,
    anticipoUsd: 0
  }
}
