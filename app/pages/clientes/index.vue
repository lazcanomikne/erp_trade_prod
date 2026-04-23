<script setup lang="ts">
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import {
  subtotalCargosZambranoUsd,
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
  valorCarteraUsd: number
  devengadoUsd: number
  pagadoUsd: number
  anticiposUsd: number
  saldoUsd: number
}

const busqueda = ref('')

const clientes = computed<ClienteResumen[]>(() => {
  const map = new Map<string, ClienteResumen>()

  for (const p of store.listaProyectos()) {
    if (!map.has(p.cliente)) {
      map.set(p.cliente, {
        nombre: p.cliente,
        totalProyectos: 0,
        proyectosActivos: 0,
        proyectosPendientePago: 0,
        proyectosCompletados: 0,
        valorCarteraUsd: 0,
        devengadoUsd: 0,
        pagadoUsd: 0,
        anticiposUsd: 0,
        saldoUsd: 0
      })
    }
    const c = map.get(p.cliente)!
    const det = store.detalle(p.idProyecto)

    c.totalProyectos++
    if (p.estatus === 'En Proceso') c.proyectosActivos++
    else if (p.estatus === 'Pendiente de Pago') c.proyectosPendientePago++
    else if (p.estatus === 'Completado') c.proyectosCompletados++

    const va = valorTotalProyectoDesdeArticulos(det.articulos)
    c.valorCarteraUsd += va > 0 ? va : p.valorTotalUsd
    c.devengadoUsd += subtotalCargosZambranoUsd(
      det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd,
      {
        maniobrasUsd: det.maniobrasUsd,
        fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
        fleteNacionalUsd: det.fleteNacionalUsd,
        fletesExtra: det.fletesExtra,
        otrosExtras: det.otrosExtras,
        igiPct: det.igiPct,
        wireTransferUsd: det.wireTransferUsd,
        comercializadoraPct: det.comercializadoraPct
      }
    )
    c.pagadoUsd += det.pagos.reduce((s, pg) => s + pg.montoUsd, 0)
    c.anticiposUsd += det.anticipoUsd
  }

  for (const c of map.values()) {
    c.saldoUsd = c.devengadoUsd - c.pagadoUsd - c.anticiposUsd
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
    value: String(clientes.value.length),
    tone: 'primary'
  },
  {
    title: 'Proyectos activos',
    icon: 'i-lucide-folder-kanban',
    value: String(clientes.value.reduce((s, c) => s + c.proyectosActivos, 0)),
    tone: 'info'
  },
  {
    title: 'Cartera total',
    icon: 'i-lucide-circle-dollar-sign',
    value: formatUsd(clientes.value.reduce((s, c) => s + c.valorCarteraUsd, 0)),
    tone: 'success'
  },
  {
    title: 'Por cobrar (total)',
    icon: 'i-lucide-scale',
    value: formatUsd(clientes.value.reduce((s, c) => s + Math.max(0, c.saldoUsd), 0)),
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
  if (c.devengadoUsd <= 0) return 0
  return Math.min(100, Math.round(((c.pagadoUsd + c.anticiposUsd) / c.devengadoUsd) * 100))
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
            <table class="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th class="w-[22%] px-3 py-2.5 text-start font-medium border-y border-l border-default bg-elevated/50 rounded-tl-lg">
                    Cliente
                  </th>
                  <th class="w-[9%] px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">
                    Proyectos
                  </th>
                  <th class="w-[14%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Cartera
                  </th>
                  <th class="w-[14%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Devengado
                  </th>
                  <th class="w-[16%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Pagado
                  </th>
                  <th class="w-[14%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Saldo
                  </th>
                  <th class="w-[11%] px-3 py-2.5 text-start font-medium border-y border-r border-default bg-elevated/50 rounded-tr-lg">
                    Estatus
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!clientesFiltrados.length">
                  <td colspan="7" class="py-16 text-center text-sm text-muted">
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
                      <span class="truncate font-medium text-highlighted">{{ c.nombre }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-center">
                    <span class="font-medium text-highlighted">{{ c.totalProyectos }}</span>
                    <span v-if="c.proyectosActivos" class="ml-1 text-xs text-muted">({{ c.proyectosActivos }} activo{{ c.proyectosActivos > 1 ? 's' : '' }})</span>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums text-muted">
                    {{ formatUsd(c.valorCarteraUsd) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-medium text-highlighted">
                    {{ formatUsd(c.devengadoUsd) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end">
                    <div class="flex flex-col items-end gap-1.5">
                      <span class="tabular-nums text-success font-medium">
                        {{ formatUsd(c.pagadoUsd + c.anticiposUsd) }}
                      </span>
                      <div class="h-1 w-20 overflow-hidden rounded-full bg-default">
                        <div
                          class="h-full rounded-full bg-success transition-all duration-500"
                          :style="{ width: `${pagoPct(c)}%` }"
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-semibold"
                    :class="c.saldoUsd > 0 ? 'text-warning' : 'text-success'"
                  >
                    {{ formatUsd(c.saldoUsd) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default">
                    <UBadge :color="statusColor(c)" variant="subtle" size="sm">
                      {{ statusLabel(c) }}
                    </UBadge>
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
