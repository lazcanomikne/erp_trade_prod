<script setup lang="ts">
import type { Proyecto, ProyectoEstatus } from '~/types'
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import {
  totalProyectoConCargosUsd,
  valorDevengadoArticulosTotal,
  valorTotalProyectoDesdeArticulos,
  subtotalLineasMonterreyCompletasUsd
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
  store.listaProyectos().filter(p =>
    p.cliente === clienteNombre || (p.intermediario && p.clienteFinal === clienteNombre)
  )
)

if (!proyectosCliente.value.length) {
  throw createError({ statusCode: 404, statusMessage: 'Cliente no encontrado' })
}

function detProyecto(p: Proyecto) {
  return store.detalle(p.idProyecto)
}

function extrasProyecto(det: ReturnType<typeof detProyecto>) {
  return {
    maniobrasUsd: det.maniobrasUsd,
    fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
    fleteNacionalUsd: det.fleteNacionalUsd,
    fletesExtra: det.fletesExtra,
    otrosExtras: det.otrosExtras,
    igiPct: det.igiPct,
    wireTransferUsd: det.wireTransferUsd,
    comercializadoraPct: det.comercializadoraPct,
    despachoAduanalDivisor: det.despachoAduanalDivisor,
    fleteLogisticaDivisor: det.fleteLogisticaDivisor
  }
}

function proyectoTotalProyecto(p: Proyecto): number {
  const det = detProyecto(p)
  return totalProyectoConCargosUsd(det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd, extrasProyecto(det), p.compradoPorTrade)
}

function proyectoPagado(p: Proyecto): number {
  const det = detProyecto(p)
  return det.pagos.reduce((s, pg) => s + pg.montoUsd, 0) + det.anticipoUsd
}

function proyectoDevengado(p: Proyecto): number {
  const det = detProyecto(p)
  const base = valorTotalProyectoDesdeArticulos(det.articulos)
  if (base === 0) return 0
  const pct = valorDevengadoArticulosTotal(det.articulos) / base
  return pct * proyectoTotalProyecto(p)
}

function proyectoSaldo(p: Proyecto): number {
  return proyectoDevengado(p) - proyectoPagado(p)
}

function proyectoArticulos(p: Proyecto): number {
  return detProyecto(p).articulos.length
}

const financiales = computed(() => {
  let valorCartera = 0
  let totalProyecto = 0
  let valorDevengado = 0
  let pagado = 0
  let anticipos = 0

  for (const p of proyectosCliente.value) {
    const det = detProyecto(p)
    const va = valorTotalProyectoDesdeArticulos(det.articulos)
    valorCartera += va > 0 ? va : p.valorTotalUsd
    const totalP = totalProyectoConCargosUsd(
      det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd, extrasProyecto(det), p.compradoPorTrade
    )
    totalProyecto += totalP
    const baseP = valorTotalProyectoDesdeArticulos(det.articulos)
    const pctP = baseP > 0 ? valorDevengadoArticulosTotal(det.articulos) / baseP : 0
    valorDevengado += pctP * totalP
    pagado += det.pagos.reduce((s, pg) => s + pg.montoUsd, 0)
    anticipos += det.anticipoUsd
  }

  const totalPagado = pagado + anticipos
  const saldo = valorDevengado - totalPagado
  const pagoPct = valorDevengado > 0 ? Math.min(100, Math.round((totalPagado / valorDevengado) * 100)) : 0

  return { valorCartera, totalProyecto, valorDevengado, totalPagado, saldo, pagoPct }
})

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function valorMonterreyProyecto(p: Proyecto): number {
  return subtotalLineasMonterreyCompletasUsd(detProyecto(p).articulos)
}

interface PagoFila {
  key: string
  idProyecto: string
  nombreProyecto: string
  folio?: string
  tipo: 'Anticipo' | 'Pago'
  monto: number
  fecha: string
  referencia?: string
  formaPago?: string
  nota?: string
}

const todosPagos = computed<PagoFila[]>(() => {
  const result: PagoFila[] = []
  for (const p of proyectosOrdenados.value) {
    const det = detProyecto(p)
    if (det.anticipoUsd > 0) {
      result.push({
        key: `${p.idProyecto}-anticipo`,
        idProyecto: p.idProyecto,
        nombreProyecto: p.nombre,
        folio: p.folioPropuesta,
        tipo: 'Anticipo',
        monto: det.anticipoUsd,
        fecha: p.createdAt
      })
    }
    for (const pg of det.pagos) {
      result.push({
        key: pg.id,
        idProyecto: p.idProyecto,
        nombreProyecto: p.nombre,
        folio: p.folioPropuesta,
        tipo: 'Pago',
        monto: pg.montoUsd,
        fecha: pg.fecha,
        referencia: pg.referencia,
        formaPago: pg.formaPago,
        nota: pg.nota
      })
    }
  }
  return result.sort((a, b) => b.fecha.localeCompare(a.fecha))
})

function imprimirInforme() {
  window.print()
}

const statsItems = computed<ProjectStatItem[]>(() => [
  {
    title: 'Cartera total',
    icon: 'i-lucide-package',
    value: formatUsd(financiales.value.valorCartera),
    tone: 'primary'
  },
  {
    title: 'Valor devengado',
    icon: 'i-lucide-trending-up',
    value: formatUsd(financiales.value.valorDevengado),
    tone: 'info'
  },
  {
    title: 'Total proyectos',
    icon: 'i-lucide-circle-dollar-sign',
    value: formatUsd(financiales.value.totalProyecto),
    tone: 'warning'
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

function getStatusColor(status: ProyectoEstatus): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  switch (status) {
    case 'Cotización': return 'info'
    case 'Completado': return 'success'
    case 'En Proceso': return 'warning'
    case 'Pendiente de Pago': return 'error'
    default: return 'neutral'
  }
}

const proyectosOrdenados = computed(() =>
  [...proyectosCliente.value].sort((a, b) => {
    const orden: Record<ProyectoEstatus, number> = {
      'Pendiente de Pago': 0,
      'En Proceso': 1,
      'Cotización': 2,
      'Completado': 3
    }
    return (orden[a.estatus] ?? 4) - (orden[b.estatus] ?? 4)
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
            <UButton
              icon="i-lucide-printer"
              color="neutral"
              variant="subtle"
              size="sm"
              label="Imprimir"
              class="hidden sm:flex"
              @click="imprimirInforme"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- ══ PRINT REPORT (hidden in normal view) ══════════════════════════════ -->
      <div class="hidden print:block text-black px-2 py-4 font-sans text-[11px]">
        <PrintHeader
          :titulo="`Estado de cuenta — ${clienteNombre}`"
          :subtitulo="`${proyectosCliente.length} proyecto(s) · Generado el ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`"
        />

        <!-- Summary table -->
        <h2 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#374151;margin:16px 0 6px">
          Resumen de proyectos
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          <thead>
            <tr style="background:#1e3a2f;print-color-adjust:exact;color:#fff">
              <th style="padding:5px 8px;border:1px solid #d1fae5;text-align:left">Propuesta</th>
              <th style="padding:5px 8px;border:1px solid #d1fae5;text-align:right">Valor del proyecto</th>
              <th style="padding:5px 8px;border:1px solid #d1fae5;text-align:right">Valor devengado</th>
              <th style="padding:5px 8px;border:1px solid #d1fae5;text-align:right">Anticipos y pagos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, idx) in proyectosOrdenados" :key="p.idProyecto" :style="idx % 2 === 1 ? 'background:#f9fafb' : ''">
              <td style="padding:4px 8px;border:1px solid #e5e7eb">
                <span style="font-weight:600">{{ p.folioPropuesta ? `Proposal ${p.folioPropuesta}` : p.nombre }}</span>
                <span v-if="p.folioPropuesta" style="color:#6b7280;margin-left:6px;font-size:9.5px">{{ p.nombre }}</span>
              </td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums">{{ formatUsd(proyectoTotalProyecto(p)) }}</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums">{{ formatUsd(proyectoDevengado(p)) }}</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums">{{ formatUsd(proyectoPagado(p)) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background:#ecfdf5;print-color-adjust:exact;font-weight:700">
              <td style="padding:5px 8px;border:1px solid #d1fae5">Total</td>
              <td style="padding:5px 8px;border:1px solid #d1fae5;text-align:right;font-variant-numeric:tabular-nums">{{ formatUsd(financiales.totalProyecto) }}</td>
              <td style="padding:5px 8px;border:1px solid #d1fae5;text-align:right;font-variant-numeric:tabular-nums">{{ formatUsd(financiales.valorDevengado) }}</td>
              <td style="padding:5px 8px;border:1px solid #d1fae5;text-align:right;font-variant-numeric:tabular-nums">{{ formatUsd(financiales.totalPagado) }}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Detailed breakdown per project -->
        <div v-for="p in proyectosOrdenados" :key="`det-${p.idProyecto}`" style="margin-top:20px;page-break-inside:avoid">
          <h3 style="font-size:11px;font-weight:700;color:#1e3a2f;border-bottom:2px solid #1e3a2f;padding-bottom:3px;margin-bottom:6px">
            {{ p.folioPropuesta ? `Proposal ${p.folioPropuesta}` : p.nombre }}
            <span style="font-weight:400;color:#6b7280;font-size:10px;margin-left:8px">{{ p.nombre }}</span>
            <span style="font-weight:400;color:#6b7280;font-size:10px;margin-left:8px">· {{ p.estatus }}</span>
          </h3>
          <table style="width:100%;border-collapse:collapse;font-size:10px">
            <tbody>
              <tr style="background:#f3f4f6;print-color-adjust:exact">
                <td style="padding:4px 8px;border:1px solid #e5e7eb;font-weight:600">Valor del proyecto</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">{{ formatUsd(proyectoTotalProyecto(p)) }}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;border:1px solid #e5e7eb;color:#374151">Valor en Monterrey (recibido)</td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums">{{ formatUsd(valorMonterreyProyecto(p)) }}</td>
              </tr>
              <tr v-if="detProyecto(p).anticipoUsd > 0">
                <td style="padding:4px 8px;border:1px solid #e5e7eb;color:#374151">
                  Anticipo
                  <span style="color:#9ca3af;font-size:9.5px;margin-left:6px">{{ formatFecha(p.createdAt) }}</span>
                </td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums;color:#15803d">{{ formatUsd(detProyecto(p).anticipoUsd) }}</td>
              </tr>
              <tr v-for="pg in detProyecto(p).pagos" :key="pg.id">
                <td style="padding:4px 8px;border:1px solid #e5e7eb;color:#374151">
                  Pago
                  <span style="color:#9ca3af;font-size:9.5px;margin-left:6px">{{ formatFecha(pg.fecha) }}</span>
                  <span v-if="pg.referencia" style="color:#9ca3af;font-size:9.5px;margin-left:6px">· Ref. {{ pg.referencia }}</span>
                  <span v-if="pg.formaPago" style="color:#9ca3af;font-size:9.5px;margin-left:6px">· {{ pg.formaPago }}</span>
                  <span v-if="pg.nota" style="color:#9ca3af;font-size:9.5px;margin-left:6px">· {{ pg.nota }}</span>
                </td>
                <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums;color:#15803d">{{ formatUsd(pg.montoUsd) }}</td>
              </tr>
              <tr v-if="detProyecto(p).anticipoUsd > 0 || detProyecto(p).pagos.length > 0" style="background:#ecfdf5;print-color-adjust:exact;font-weight:600">
                <td style="padding:4px 8px;border:1px solid #d1fae5">Total recibido</td>
                <td style="padding:4px 8px;border:1px solid #d1fae5;text-align:right;font-variant-numeric:tabular-nums;color:#15803d">{{ formatUsd(proyectoPagado(p)) }}</td>
              </tr>
              <tr style="background:#fef3c7;print-color-adjust:exact;font-weight:600">
                <td style="padding:4px 8px;border:1px solid #fde68a">Saldo pendiente</td>
                <td style="padding:4px 8px;border:1px solid #fde68a;text-align:right;font-variant-numeric:tabular-nums;color:#b45309">{{ formatUsd(Math.max(0, proyectoSaldo(p))) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Print footer -->
        <p style="margin-top:24px;font-size:9px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:8px">
          Trade ERP · Estado de cuenta generado el {{ new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) }} · {{ clienteNombre }}
        </p>
      </div>

      <!-- ══ NORMAL VIEW (hidden when printing) ════════════════════════════════ -->
      <div class="lg:flex lg:h-full lg:flex-col print:hidden">
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
                  <th class="w-[13%] px-3 py-2.5 text-start font-medium border-y border-l border-default bg-elevated/50 rounded-tl-lg">
                    ID
                  </th>
                  <th class="w-[19%] px-3 py-2.5 text-start font-medium border-y border-default bg-elevated/50">
                    Nombre
                  </th>
                  <th class="w-[13%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Total proyecto
                  </th>
                  <th class="w-[13%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Devengado
                  </th>
                  <th class="w-[11%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Pagado
                  </th>
                  <th class="w-[11%] px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Saldo
                  </th>
                  <th class="w-[8%] px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">
                    Artículos
                  </th>
                  <th class="w-[12%] px-3 py-2.5 text-start font-medium border-y border-r border-default bg-elevated/50 rounded-tr-lg">
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
                    <div class="flex items-center gap-1.5">
                      <p class="font-medium text-highlighted truncate">{{ p.nombre }}</p>
                      <UBadge v-if="p.intermediario && p.clienteFinal !== clienteNombre" color="info" variant="soft" size="xs">Int.</UBadge>
                    </div>
                    <p v-if="p.folioPropuesta" class="text-xs text-muted">Folio {{ p.folioPropuesta }}</p>
                    <p v-if="p.intermediario && p.clienteFinal" class="text-xs text-muted">
                      {{ p.clienteFinal === clienteNombre ? `Intermediario: ${p.cliente}` : `Final: ${p.clienteFinal}` }}
                    </p>
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-medium">
                    {{ formatUsd(proyectoTotalProyecto(p)) }}
                  </td>
                  <td class="px-3 py-3 align-middle border-b border-default text-end tabular-nums font-medium text-info">
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

        <!-- Pagos y anticipos -->
        <div v-if="todosPagos.length > 0" class="mt-4 lg:shrink-0">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-highlighted">Pagos y anticipos</h2>
            <span class="text-sm text-muted">{{ todosPagos.length }} movimiento{{ todosPagos.length > 1 ? 's' : '' }}</span>
          </div>
          <div class="w-full overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">Proyecto</th>
                  <th class="w-24 px-3 py-2.5 text-center border-b border-default font-medium">Tipo</th>
                  <th class="w-32 px-3 py-2.5 text-end border-b border-default font-medium">Monto</th>
                  <th class="w-32 px-3 py-2.5 text-start border-b border-default font-medium">Fecha</th>
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">Referencia / Forma de pago</th>
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="pf in todosPagos"
                  :key="pf.key"
                  class="cursor-pointer transition-colors hover:bg-elevated/40"
                  @click="router.push(`/proyectos/${encodeURIComponent(pf.idProyecto)}`)"
                >
                  <td class="px-3 py-2.5 align-middle border-b border-default">
                    <p class="font-medium text-highlighted truncate max-w-[220px]">{{ pf.nombreProyecto }}</p>
                    <p v-if="pf.folio" class="text-xs text-muted">Folio {{ pf.folio }}</p>
                  </td>
                  <td class="px-3 py-2.5 align-middle border-b border-default text-center">
                    <UBadge :color="pf.tipo === 'Anticipo' ? 'info' : 'success'" variant="subtle" size="sm">
                      {{ pf.tipo }}
                    </UBadge>
                  </td>
                  <td class="px-3 py-2.5 align-middle border-b border-default text-end tabular-nums font-semibold text-success">
                    {{ formatUsd(pf.monto) }}
                  </td>
                  <td class="px-3 py-2.5 align-middle border-b border-default text-muted text-xs">
                    {{ formatFecha(pf.fecha) }}
                  </td>
                  <td class="px-3 py-2.5 align-middle border-b border-default text-xs text-muted">
                    <span v-if="pf.referencia">Ref. {{ pf.referencia }}</span>
                    <span v-if="pf.referencia && pf.formaPago"> · </span>
                    <span v-if="pf.formaPago">{{ pf.formaPago }}</span>
                    <span v-if="!pf.referencia && !pf.formaPago">—</span>
                  </td>
                  <td class="px-3 py-2.5 align-middle border-b border-default text-xs text-muted">
                    {{ pf.nota || '—' }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="bg-elevated/50 font-semibold">
                  <td colspan="2" class="px-3 py-2.5 text-sm text-highlighted border-t border-default">Total recibido</td>
                  <td class="px-3 py-2.5 text-end tabular-nums text-success border-t border-default">
                    {{ formatUsd(todosPagos.reduce((s, pf) => s + pf.monto, 0)) }}
                  </td>
                  <td colspan="3" class="border-t border-default" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Resumen financiero al fondo -->
        <div class="mt-4 lg:shrink-0 rounded-lg border border-default bg-elevated/30 p-4">
          <div class="mb-3 flex items-center gap-2 text-highlighted">
            <UIcon name="i-lucide-file-spreadsheet" class="size-5 text-primary" />
            <span class="font-semibold">Resumen financiero del cliente</span>
          </div>
          <dl class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-5">
            <div class="flex flex-col gap-0.5">
              <dt class="text-xs text-muted uppercase tracking-wide">Cartera total</dt>
              <dd class="tabular-nums font-semibold text-highlighted">{{ formatUsd(financiales.valorCartera) }}</dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-xs text-muted uppercase tracking-wide">Valor devengado</dt>
              <dd class="tabular-nums font-semibold text-info">{{ formatUsd(financiales.valorDevengado) }}</dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-xs text-muted uppercase tracking-wide">Total proyectos</dt>
              <dd class="tabular-nums font-semibold text-highlighted">{{ formatUsd(financiales.totalProyecto) }}</dd>
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
            Total proyectos = artículos + comisión + despacho + fletes + extras, sumado de todos los proyectos del cliente.
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
