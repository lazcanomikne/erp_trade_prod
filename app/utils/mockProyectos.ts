import type { Proyecto } from '~/types'

export const mockProyectos: Proyecto[] = [
  {
    idProyecto: 'PRY-2025-014',
    folioPropuesta: '102901',
    cliente: 'Catalina Zambrano',
    nombre: 'Casa San Pedro',
    valorTotalUsd: 33619,
    estatus: 'En Proceso',
    progresoDevengadoPct: 18,
    montoMonterreyUsd: 6051
  },
  {
    idProyecto: 'PRY-2025-008',
    folioPropuesta: '102803',
    cliente: 'Sergio Méndez',
    nombre: 'Residencial Vista Norte',
    valorTotalUsd: 128400,
    estatus: 'En Proceso',
    progresoDevengadoPct: 62,
    montoMonterreyUsd: 79608
  },
  {
    idProyecto: 'PRY-2024-221',
    cliente: 'Importadora del Golfo',
    nombre: 'Almacén Monterrey Fase 2',
    valorTotalUsd: 89250,
    estatus: 'Completado',
    progresoDevengadoPct: 100,
    montoMonterreyUsd: 89250
  },
  {
    idProyecto: 'PRY-2025-003',
    cliente: 'María Elena Ríos',
    nombre: 'Departamento Polanco',
    valorTotalUsd: 22400,
    estatus: 'Pendiente de Pago',
    progresoDevengadoPct: 0,
    montoMonterreyUsd: 0
  },
  {
    idProyecto: 'PRY-2025-019',
    cliente: 'Grupo Constructor MTY',
    nombre: 'Torre Corporativa Valle',
    valorTotalUsd: 512000,
    estatus: 'En Proceso',
    progresoDevengadoPct: 41,
    montoMonterreyUsd: 209920
  },
  {
    idProyecto: 'PRY-2024-180',
    cliente: 'Lucía Fernández',
    nombre: 'Remodelación Cocina & Family',
    valorTotalUsd: 18750,
    estatus: 'Completado',
    progresoDevengadoPct: 100,
    montoMonterreyUsd: 18750
  }
]
