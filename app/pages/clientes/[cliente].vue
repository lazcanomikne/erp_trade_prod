<script setup lang="ts">
import type { Proyecto, ProyectoEstatus } from '~/types'
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import {
  subtotalCargosZambranoUsd,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

const route = useRoute()
const router = useRouter()
const store = useInventarioStore()

const clienteNombre = decodeURIComponent(route.params.cliente as string)

try {
  await store.refreshFromApi()
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos del ERP.' })
}

const proyectosCliente = computed(() =>
  store.listaProyectos().filter(p => p.cliente === clienteNombre)
)

if (!proyectosCliente.value.length) {
  throw createError({ statusCode: 404, statusMessage: 'Cliente no encontrado' })
}

function detProyecto(p: Proyecto) {
  return store.detalle(p.idProyecto)
}

function proyectoDevengado(p: Proyecto): number {
  const det = detProyecto(p)
  return subtotalCargosZambranoUsd(det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd, {
    maniobrasUsd: det.maniobrasUsd,
    fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
    fleteNacionalUsd: det.fleteNacionalUsd,
    fletesExtra: det.fletesExtra,
    otrosExtras: det.otrosExtras,
    igiPct: det.igiPct,
    wireTransferUsd: det.wireTransferUsd,
    comercializadoraPct: det.comercializadoraPct
  })
}

function proyectoPagado(p: Proyecto): number {
  const det = detProyecto(p)
  return det.pagos.reduce((s, pg) => s + pg.montoUsd, 0) + det.anticipoUsd
}

function proyectoSaldo(p: Proyecto): number {
  return proyectoDevengado(p) - proyectoPagado(p)
}

function proyectoArticulos(p: Proyecto): number {
  return detProyecto(p).articulos.length
}

const financiales = computed(() => {
  let valorCartera = 0
  let devengado = 0
  let pagado = 0
  let anticipos = 0

  for (const p of proyectosCliente.value) {
    const det = detProyecto(p)
    const va = valorTotalProyectoDesdeArticulos(det.articulos)
    valorCartera += va > 0 ? va : p.valorTotalUsd
    devengado += subtotalCargosZambranoUsd(det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd, {
      maniobrasUsd: det.maniobrasUsd,
      fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
      fleteNacionalUsd: det.fleteNacionalUsd,
      fletesExtra: det.fletesExtra,
      igiPct: det.igiPct,
      wireTransferUsd: det.wireTransferUsd,
      comercializadoraPct: det.comercializadoraPct
    })
    pagado += det.pagos.reduce((s, pg) => s + pg.montoUsd, 0)
    anticipos += det.anticipoUsd
  }

  const totalPagado = pagado + anticipos
  const saldo = devengado - totalPagado
  const pagoPct = devengado > 0 ? Math.min(100, Math.round((totalPagado / devengado) * 100)) : 0

  return { valorCartera, devengado, totalPagado, saldo, pagoPct }
})

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

const statsItems = computed<ProjectStatItem[]>(() => [
  {
    title: 'Cartera total',
    icon: 'i-lucide-circle-dollar-sign',
    value: formatUsd(financiales.value.valorCartera),
    tone: 'primary'
  },
  {
    title: 'Devengado',
    icon: 'i-lucide-truck',
    value: formatUsd(financiales.value.devengado),
    tone: 'info'
  },
  {
    title: 'Total pagado',
    icon: 'i-lucide-wallet',
    value: formatUsd(financiales.value.totalPagado),
    tone: 'success'
  },
  {
    title: 'Saldo por cobrar',
    icon: 'i-lucide-scale',
    value: formatUsd(Math.max(0, financiales.value.saldo)),
    tone: financiales.value.saldo > 0 ? 'warning' : 'success'
  }
])

function getStatusColor(status: ProyectoEstatus): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'Completado': return 'success'
    case 'En Proceso': return 'warning'
    case 'Pendiente de Pago': return 'error'
    default: return 'neutral'
  }
}

const proyectosOrdenados = computed(() =>
  [...proyectosCliente.value].sort((a, b) => {
    const orden: Record<ProyectoEstatus, number> = { 'Pendiente de Pago': 0, 'En Proceso': 1, 'Completado': 2 }
    return (orden[a.estatus] ?? 3) - (orden[b.estatus] ?? 3)
  })
)
</script>

<template>
  <UDashboardPanel :id="`cliente-${clienteNombre}`">
    <template #header>
      <UDashboardNavbar :title="clienteNombre">
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <UButton
              to="/clientes"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              square
            />
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-3">
            <div class="hidden sm:flex flex-col items-end gap-0.5">
              <p class="text-xs text-muted">Pagado del devengado</p>
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-24 overflow-hidden rounded-full bg-default">
                  <div
                    class="h-full rounded-full bg-success transition-all duration-500"
                    :style="{ width: `${financiales.pagoPct}%` }"
                  />
                </div>
                <span class="text-xs tabular-nums font-medium text-muted">{{ financiales.pagoPct }}%</span>
              </div>
            </div>
            <UBadge color="neutral" variant="soft">
              {{ proyectosCliente.length }} proyecto{{ proyectosCliente.length > 1 ? 's' : '' }}
            </UBadge>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col">
        <ProjectStats class="mb-4 lg:shrink-0" :items="statsItems" />

        <div class="mb-2 flex items-center justify-between gap-2 lg:shrink-0">
          <h2 class="text-lg font-semibold text-highlighted">
            Proyectos
          </h2>
          <span class="text-sm text-muted">{{ proyectosCliente.length }} proyecto{{ proyectosCliente.length > 1 ? 's' : '' }}</span>
        </div>

        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div class="w-full min-w-0 overflow-x-auto rounded-lg border border-default">
            <table class="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th class="w-[14%] px-3 py-2.5 text-start font-medium border-y border-l border-default bg-elevated/50 rounded-tl-lg">
                    ID
                  </th>
                  <th class="w-[22%] px-3 py-2.5 text-start font-medium border-y border-default bg-elevated/50">
                    Nombre
                  </th>
                  <th class="w-[14%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Devengado
                  </th>
                  <th class="w-[14%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Pagado
                  </th>
                  <th class="w-[14%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Saldo
                  </th>
                  <th class="w-[9%] px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">
                    Artículos
                  </th>
                  <th class="w-[13%] px-3 py-2.5 text-start font-medium border-y border-r border-default bg-elevated/50 rounded-tr-lg">
                    Estatus
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in proyectosOrdenados"
                  :key="p.idProyecto"
                  class="cursor-pointer transition-colors hover:bg-elevated/40"
                  @click="router.push(`/proyectos/${encodeURIComponent(p.idProyecto)}`)"
                >
                  <td class="px-3 py-3 align-middle border-b border-default font-mono text-xs text-muted">
                    {{ p.idProyecto }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default">
                    <p class="font-medium text-highlighted truncate">{{ p.nombre }}</p>
                    <p v-if="p.folioPropuesta" class="text-xs text-muted">Folio {{ p.folioPropuesta }}</p>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-medium">
                    {{ formatUsd(proyectoDevengado(p)) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums text-success">
                    {{ formatUsd(proyectoPagado(p)) }}
                  </td>
                  <td
                    class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-semibold"
                    :class="proyectoSaldo(p) > 0 ? 'text-warning' : 'text-success'"
                  >
                    {{ formatUsd(proyectoSaldo(p)) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-center text-muted">
                    {{ proyectoArticulos(p) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default">
                    <UBadge :color="getStatusColor(p.estatus)" variant="subtle" size="sm">
                      {{ p.estatus }}
                    </UBadge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Resumen financiero al fondo -->
        <div class="mt-4 lg:shrink-0 rounded-lg border border-default bg-elevated/30 p-4">
          <div class="mb-3 flex items-center gap-2 text-highlighted">
            <UIcon name="i-lucide-file-spreadsheet" class="size-5 text-primary" />
            <span class="font-semibold">Resumen financiero del cliente</span>
          </div>
          <dl class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <div class="flex flex-col gap-0.5">
              <dt class="text-xs text-muted uppercase tracking-wide">Cartera total</dt>
              <dd class="tabular-nums font-semibold text-highlighted">{{ formatUsd(financiales.valorCartera) }}</dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-xs text-muted uppercase tracking-wide">Devengado</dt>
              <dd class="tabular-nums font-semibold text-highlighted">{{ formatUsd(financiales.devengado) }}</dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-xs text-muted uppercase tracking-wide">Total pagado</dt>
              <dd class="tabular-nums font-semibold text-success">{{ formatUsd(financiales.totalPagado) }}</dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-xs text-muted uppercase tracking-wide">Saldo pendiente</dt>
              <dd
                class="tabular-nums font-semibold"
                :class="financiales.saldo > 0 ? 'text-warning' : 'text-success'"
              >
                {{ formatUsd(Math.max(0, financiales.saldo)) }}
              </dd>
            </div>
          </dl>
          <p class="mt-3 text-xs text-muted">
            Devengado = artículos en Monterrey + comisión + despacho + fletes, sumado de todos los proyectos del cliente.
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
