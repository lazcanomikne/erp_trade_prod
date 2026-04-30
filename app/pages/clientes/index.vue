<script setup lang="ts">
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import {
  totalProyectoConCargosUsd,
  valorDevengadoArticulosTotal,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

const store = useInventarioStore()
const router = useRouter()

try {
  await store.refreshFromApi()
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos del ERP.' })
}

interface ClienteResumen {
  nombre: string
  totalProyectos: number
  proyectosActivos: number
  proyectosPendientePago: number
  proyectosCompletados: number
  /** Proyectos donde aparece como clienteFinal (a través de un intermediario) */
  proyectosComoClienteFinal: number
  // Totales sobre todos los proyectos (para la tabla)
  totalProyectoUsd: number
  devengadoUsd: number
  pagadoUsd: number
  anticiposUsd: number
  saldoUsd: number
  // Totales solo proyectos no completados (para KPIs)
  carteraActivaUsd: number
  devengadoActivoUsd: number
  pagadoActivoUsd: number
  saldoActivoUsd: number
}

const busqueda = ref('')

function ensureCliente(map: Map<string, ClienteResumen>, nombre: string) {
  if (!map.has(nombre)) {
    map.set(nombre, {
      nombre,
      totalProyectos: 0, proyectosActivos: 0,
      proyectosPendientePago: 0, proyectosCompletados: 0,
      proyectosComoClienteFinal: 0,
      totalProyectoUsd: 0, devengadoUsd: 0, pagadoUsd: 0, anticiposUsd: 0, saldoUsd: 0,
      carteraActivaUsd: 0, devengadoActivoUsd: 0, pagadoActivoUsd: 0, saldoActivoUsd: 0
    })
  }
}

const clientes = computed<ClienteResumen[]>(() => {
  const map = new Map<string, ClienteResumen>()

  for (const p of store.listaProyectos()) {
    const det = store.detalle(p.idProyecto)
    const esActivo = p.estatus !== 'Completado'
    const totalP = totalProyectoConCargosUsd(
      det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd,
      {
        maniobrasUsd: det.maniobrasUsd, fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
        fleteNacionalUsd: det.fleteNacionalUsd, fletesExtra: det.fletesExtra,
        otrosExtras: det.otrosExtras, igiPct: det.igiPct,
        wireTransferUsd: det.wireTransferUsd, comercializadoraPct: det.comercializadoraPct,
        despachoAduanalDivisor: det.despachoAduanalDivisor, fleteLogisticaDivisor: det.fleteLogisticaDivisor
      },
      p.compradoPorTrade
    )
    const baseP = valorTotalProyectoDesdeArticulos(det.articulos)
    const pctP = baseP > 0 ? valorDevengadoArticulosTotal(det.articulos) / baseP : 0
    const devengadoP = pctP * totalP
    const pagosP = det.pagos.reduce((s, pg) => s + pg.montoUsd, 0)
    const anticipoP = det.anticipoUsd

    // Count stats under the billing client only (never double-count intermediario projects)
    ensureCliente(map, p.cliente)
    const c = map.get(p.cliente)!
    c.totalProyectos++
    if (p.estatus === 'En Proceso') c.proyectosActivos++
    else if (p.estatus === 'Pendiente de Pago') c.proyectosPendientePago++
    else if (p.estatus === 'Completado') c.proyectosCompletados++

    c.totalProyectoUsd += totalP
    c.devengadoUsd += devengadoP
    c.pagadoUsd += pagosP
    c.anticiposUsd += anticipoP

    if (esActivo) {
      c.carteraActivaUsd += totalP
      c.devengadoActivoUsd += devengadoP
      c.pagadoActivoUsd += pagosP + anticipoP
    }

    // If this project has a clienteFinal, ensure they appear in the list (for navigation)
    // and track the reference count — but don't duplicate financial stats
    if (p.intermediario && p.clienteFinal && p.clienteFinal !== p.cliente) {
      ensureCliente(map, p.clienteFinal)
      map.get(p.clienteFinal)!.proyectosComoClienteFinal++
    }
  }

  for (const c of map.values()) {
    c.saldoUsd = c.devengadoUsd - c.pagadoUsd - c.anticiposUsd
    c.saldoActivoUsd = c.devengadoActivoUsd - c.pagadoActivoUsd
  }

  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
})

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return clientes.value
  return clientes.value.filter(c => c.nombre.toLowerCase().includes(q))
})

const statsGlobales = computed<ProjectStatItem[]>(() => [
  {
    title: 'Clientes',
    icon: 'i-lucide-users',
    value: String(clientes.value.filter(c => c.totalProyectos > 0).length),
    tone: 'primary'
  },
  {
    title: 'Proyectos activos',
    icon: 'i-lucide-folder-kanban',
    value: String(clientes.value.reduce((s, c) => s + c.proyectosActivos + c.proyectosPendientePago, 0)),
    tone: 'info'
  },
  {
    title: 'Cartera activa',
    icon: 'i-lucide-circle-dollar-sign',
    value: formatUsd(clientes.value.reduce((s, c) => s + c.carteraActivaUsd, 0)),
    tone: 'success'
  },
  {
    title: 'Valor devengado',
    icon: 'i-lucide-trending-up',
    value: formatUsd(clientes.value.reduce((s, c) => s + c.devengadoActivoUsd, 0)),
    tone: 'info'
  },
  {
    title: 'Total pagado (activos)',
    icon: 'i-lucide-wallet',
    value: formatUsd(clientes.value.reduce((s, c) => s + c.pagadoActivoUsd, 0)),
    tone: 'success'
  },
  {
    title: 'Pendiente de pago',
    icon: 'i-lucide-scale',
    value: formatUsd(clientes.value.reduce((s, c) => s + Math.max(0, c.saldoActivoUsd), 0)),
    tone: 'warning'
  }
])

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function statusColor(c: ClienteResumen): 'error' | 'warning' | 'success' {
  if (c.proyectosPendientePago > 0) return 'error'
  if (c.proyectosActivos > 0) return 'warning'
  return 'success'
}

function statusLabel(c: ClienteResumen): string {
  if (c.proyectosPendientePago > 0) return 'Pendiente pago'
  if (c.proyectosActivos > 0) return 'En proceso'
  return 'Completado'
}

function pagoPct(c: ClienteResumen): number {
  if (c.totalProyectoUsd <= 0) return 0
  return Math.min(100, Math.round(((c.pagadoUsd + c.anticiposUsd) / c.totalProyectoUsd) * 100))
}

function irACliente(nombre: string) {
  router.push(`/clientes/${encodeURIComponent(nombre)}`)
}
</script>

<template>
  <UDashboardPanel id="clientes">
    <template #header>
      <UDashboardNavbar title="Clientes">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col">
        <ProjectStats class="mb-4 lg:shrink-0" :items="statsGlobales" />

        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:shrink-0">
          <UInput
            v-model="busqueda"
            class="w-full max-w-sm"
            icon="i-lucide-search"
            placeholder="Buscar cliente…"
            size="md"
          />
          <p class="shrink-0 text-sm text-muted">
            {{ clientesFiltrados.length }} cliente(s)
          </p>
        </div>

        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div class="w-full min-w-0 overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">Cliente</th>
                  <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">Total proyectos</th>
                  <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">Proyectos activos</th>
                  <th class="w-32 px-3 py-2.5 text-end border-b border-default font-medium">Total proyecto</th>
                  <th class="w-32 px-3 py-2.5 text-end border-b border-default font-medium">Devengado</th>
                  <th class="w-32 px-3 py-2.5 text-end border-b border-default font-medium">Total pagado</th>
                  <th class="w-32 px-3 py-2.5 text-end border-b border-default font-medium">Pendiente de pago</th>
                  <th class="w-24 px-3 py-2.5 text-center border-b border-default font-medium">Estatus</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!clientesFiltrados.length">
                  <td colspan="8" class="py-16 text-center text-sm text-muted">
                    <div class="flex flex-col items-center gap-2">
                      <UIcon name="i-lucide-users" class="size-8 text-muted/50" />
                      <span v-if="busqueda">Sin resultados para "{{ busqueda }}".</span>
                      <span v-else>No hay clientes registrados. Crea un proyecto para comenzar.</span>
                    </div>
                  </td>
                </tr>
                <tr
                  v-for="c in clientesFiltrados"
                  :key="c.nombre"
                  class="cursor-pointer transition-colors hover:bg-elevated/40"
                  @click="irACliente(c.nombre)"
                >
                  <td class="px-3 py-3 align-middle border-b border-default">
                    <div class="flex items-center gap-2.5">
                      <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary select-none">
                        {{ c.nombre.charAt(0).toUpperCase() }}
                      </span>
                      <div class="min-w-0">
                        <span class="truncate font-medium text-highlighted">{{ c.nombre }}</span>
                        <p v-if="c.proyectosComoClienteFinal > 0" class="text-xs text-muted">
                          Cliente final en {{ c.proyectosComoClienteFinal }} proyecto{{ c.proyectosComoClienteFinal > 1 ? 's' : '' }} via tercero
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-center">
                    <span v-if="c.totalProyectos > 0" class="font-medium text-highlighted">{{ c.totalProyectos }}</span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-center">
                    <span v-if="c.proyectosActivos + c.proyectosPendientePago > 0" class="font-semibold text-warning">
                      {{ c.proyectosActivos + c.proyectosPendientePago }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-semibold text-highlighted">
                    {{ formatUsd(c.totalProyectoUsd) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-medium text-info">
                    {{ formatUsd(c.devengadoUsd) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end">
                    <div class="flex flex-col items-end gap-1.5">
                      <span class="tabular-nums text-success font-medium">{{ formatUsd(c.pagadoUsd + c.anticiposUsd) }}</span>
                      <div class="h-1 w-20 overflow-hidden rounded-full bg-default">
                        <div class="h-full rounded-full bg-success transition-all duration-500" :style="{ width: `${pagoPct(c)}%` }" />
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-semibold" :class="c.saldoUsd > 0 ? 'text-warning' : 'text-success'">
                    {{ formatUsd(Math.max(0, c.saldoUsd)) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-center">
                    <UBadge v-if="c.totalProyectos > 0" :color="statusColor(c)" variant="subtle" size="sm">{{ statusLabel(c) }}</UBadge>
                    <span v-else class="text-xs text-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
