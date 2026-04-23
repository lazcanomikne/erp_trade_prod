<script setup lang="ts">
import { totalProyectoConCargosUsd, valorTotalProyectoDesdeArticulos } from '~/utils/proyectoCalculos'

useHead({ title: 'Cuentas por Cobrar' })

const store = useInventarioStore()
try { await store.refreshFromApi() } catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos.' })
}

type Vista = 'general' | 'cliente'
const vista = ref<Vista>('general')
const filtroCliente = ref('')
const soloConSaldo = ref(false)

interface FilaCuenta {
  idProyecto: string
  nombre: string
  cliente: string
  estatus: string
  subtotalArticulos: number
  totalProyecto: number
  anticipoUsd: number
  pagosUsd: number
  totalPagado: number
  saldo: number
}

const filas = computed<FilaCuenta[]>(() => {
  const out: FilaCuenta[] = []
  for (const p of store.listaProyectos()) {
    const det = store.detalle(p.idProyecto)
    const extras = {
      maniobrasUsd: det.maniobrasUsd, fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
      fleteNacionalUsd: det.fleteNacionalUsd, fletesExtra: det.fletesExtra,
      otrosExtras: det.otrosExtras, igiPct: det.igiPct,
      wireTransferUsd: det.wireTransferUsd, comercializadoraPct: det.comercializadoraPct
    }
    const subtotalArticulos = valorTotalProyectoDesdeArticulos(det.articulos) || p.valorTotalUsd
    const totalProyecto = totalProyectoConCargosUsd(det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd, extras)
    const pagosUsd = det.pagos.reduce((s, pg) => s + pg.montoUsd, 0)
    const totalPagado = pagosUsd + det.anticipoUsd
    const saldo = totalProyecto - totalPagado
    out.push({
      idProyecto: p.idProyecto,
      nombre: p.nombre,
      cliente: p.cliente,
      estatus: p.estatus,
      subtotalArticulos,
      totalProyecto,
      anticipoUsd: det.anticipoUsd,
      pagosUsd,
      totalPagado,
      saldo
    })
  }
  return out
})

const filtradas = computed(() => {
  let lista = filas.value
  if (soloConSaldo.value) lista = lista.filter(f => f.saldo > 0.01)
  const q = filtroCliente.value.trim().toLowerCase()
  if (q) lista = lista.filter(f => f.cliente.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q))
  return lista
})

const totales = computed(() => ({
  totalProyecto: filtradas.value.reduce((s, f) => s + f.totalProyecto, 0),
  totalPagado: filtradas.value.reduce((s, f) => s + f.totalPagado, 0),
  saldo: filtradas.value.reduce((s, f) => s + f.saldo, 0)
}))

interface GrupoCliente {
  cliente: string
  filas: FilaCuenta[]
  totalProyecto: number
  totalPagado: number
  saldo: number
}

const porCliente = computed<GrupoCliente[]>(() => {
  const map = new Map<string, FilaCuenta[]>()
  for (const f of filtradas.value) {
    if (!map.has(f.cliente)) map.set(f.cliente, [])
    map.get(f.cliente)!.push(f)
  }
  return Array.from(map.entries()).map(([cliente, filas]) => ({
    cliente,
    filas,
    totalProyecto: filas.reduce((s, f) => s + f.totalProyecto, 0),
    totalPagado: filas.reduce((s, f) => s + f.totalPagado, 0),
    saldo: filas.reduce((s, f) => s + f.saldo, 0)
  })).sort((a, b) => b.saldo - a.saldo)
})

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function estatusColor(e: string) {
  if (e === 'Completado') return 'success'
  if (e === 'En Proceso') return 'warning'
  return 'error'
}

const fechaReporte = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
</script>

<template>
  <UDashboardPanel id="reporte-cxc">
    <template #header>
      <UDashboardNavbar title="Cuentas por Cobrar">
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <UButton to="/reportes" icon="i-lucide-arrow-left" color="neutral" variant="ghost" square />
          </div>
        </template>
        <template #right>
          <UButton icon="i-lucide-printer" label="Imprimir" color="neutral" variant="outline" class="print:hidden" @click="window.print()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Encabezado de impresión -->
      <PrintHeader titulo="Cuentas por Cobrar" :subtitulo="`${filtradas.length} proyecto(s) · ${fechaReporte}`" />

      <!-- Controles (solo pantalla) -->
      <div class="mb-4 flex flex-wrap gap-3 items-center print:hidden">
        <UInput v-model="filtroCliente" icon="i-lucide-search" placeholder="Filtrar cliente o proyecto…" class="w-full max-w-xs" />
        <UToggle v-model="soloConSaldo" />
        <span class="text-sm text-muted">Solo con saldo pendiente</span>
        <div class="ml-auto flex gap-1 bg-elevated/50 rounded-lg p-1">
          <UButton :color="vista === 'general' ? 'primary' : 'neutral'" :variant="vista === 'general' ? 'solid' : 'ghost'" size="sm" label="General" @click="vista = 'general'" />
          <UButton :color="vista === 'cliente' ? 'primary' : 'neutral'" :variant="vista === 'cliente' ? 'solid' : 'ghost'" size="sm" label="Por cliente" @click="vista = 'cliente'" />
        </div>
      </div>

      <!-- Totales globales -->
      <div class="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-default bg-elevated/30 p-3 text-sm">
        <div class="text-center">
          <p class="text-xs text-muted mb-0.5">Total proyectos</p>
          <p class="font-bold text-highlighted tabular-nums">{{ fmt(totales.totalProyecto) }}</p>
        </div>
        <div class="text-center border-x border-default/50">
          <p class="text-xs text-muted mb-0.5">Total pagado</p>
          <p class="font-bold text-success tabular-nums">{{ fmt(totales.totalPagado) }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-muted mb-0.5">Saldo pendiente</p>
          <p class="font-bold tabular-nums" :class="totales.saldo > 0 ? 'text-warning' : 'text-success'">
            {{ fmt(Math.max(0, totales.saldo)) }}
          </p>
        </div>
      </div>

      <!-- Vista: General -->
      <template v-if="vista === 'general'">
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                <th class="px-3 py-2.5 text-start border-b border-default font-medium">Proyecto</th>
                <th class="px-3 py-2.5 text-start border-b border-default font-medium">Cliente</th>
                <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Total proyecto</th>
                <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Anticipo</th>
                <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Pagos</th>
                <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Total pagado</th>
                <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Saldo</th>
                <th class="w-24 px-3 py-2.5 text-center border-b border-default font-medium print:hidden">Estatus</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtradas.length">
                <td colspan="8" class="py-12 text-center text-muted text-sm">Sin resultados.</td>
              </tr>
              <tr v-for="f in filtradas" :key="f.idProyecto" class="hover:bg-elevated/30 transition-colors">
                <td class="px-3 py-2.5 border-b border-default">
                  <NuxtLink :to="`/proyectos/${encodeURIComponent(f.idProyecto)}`" class="font-medium text-primary hover:underline print:text-gray-900 print:no-underline">
                    {{ f.nombre }}
                  </NuxtLink>
                  <p class="text-xs text-muted font-mono">{{ f.idProyecto }}</p>
                </td>
                <td class="px-3 py-2.5 border-b border-default text-muted">{{ f.cliente }}</td>
                <td class="px-3 py-2.5 border-b border-default text-end tabular-nums font-medium">{{ fmt(f.totalProyecto) }}</td>
                <td class="px-3 py-2.5 border-b border-default text-end tabular-nums text-muted">{{ fmt(f.anticipoUsd) }}</td>
                <td class="px-3 py-2.5 border-b border-default text-end tabular-nums text-muted">{{ fmt(f.pagosUsd) }}</td>
                <td class="px-3 py-2.5 border-b border-default text-end tabular-nums text-success font-medium">{{ fmt(f.totalPagado) }}</td>
                <td class="px-3 py-2.5 border-b border-default text-end tabular-nums font-semibold" :class="f.saldo > 0 ? 'text-warning' : 'text-success'">
                  {{ fmt(Math.max(0, f.saldo)) }}
                </td>
                <td class="px-3 py-2.5 border-b border-default text-center print:hidden">
                  <UBadge :color="estatusColor(f.estatus)" variant="subtle" size="sm">{{ f.estatus }}</UBadge>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-elevated/50 font-semibold">
              <tr>
                <td colspan="2" class="px-3 py-2.5 text-muted border-t border-default">TOTALES ({{ filtradas.length }})</td>
                <td class="px-3 py-2.5 text-end tabular-nums border-t border-default">{{ fmt(totales.totalProyecto) }}</td>
                <td class="px-3 py-2.5 border-t border-default" />
                <td class="px-3 py-2.5 border-t border-default" />
                <td class="px-3 py-2.5 text-end tabular-nums text-success border-t border-default">{{ fmt(totales.totalPagado) }}</td>
                <td class="px-3 py-2.5 text-end tabular-nums border-t border-default" :class="totales.saldo > 0 ? 'text-warning' : 'text-success'">
                  {{ fmt(Math.max(0, totales.saldo)) }}
                </td>
                <td class="border-t border-default print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      </template>

      <!-- Vista: Por cliente -->
      <template v-else>
        <div v-for="g in porCliente" :key="g.cliente" class="mb-6">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="font-semibold text-highlighted flex items-center gap-2">
              <UIcon name="i-lucide-building-2" class="size-4 text-muted" />
              {{ g.cliente }}
            </h3>
            <span class="text-sm tabular-nums" :class="g.saldo > 0 ? 'text-warning font-semibold' : 'text-success'">
              Saldo: {{ fmt(Math.max(0, g.saldo)) }}
            </span>
          </div>
          <div class="overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs">
                  <th class="px-3 py-2 text-start border-b border-default font-medium">Proyecto</th>
                  <th class="w-28 px-3 py-2 text-end border-b border-default font-medium">Total proyecto</th>
                  <th class="w-28 px-3 py-2 text-end border-b border-default font-medium">Total pagado</th>
                  <th class="w-28 px-3 py-2 text-end border-b border-default font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in g.filas" :key="f.idProyecto" class="hover:bg-elevated/30">
                  <td class="px-3 py-2 border-b border-default">
                    <p class="font-medium text-highlighted">{{ f.nombre }}</p>
                    <p class="text-xs text-muted font-mono">{{ f.idProyecto }}</p>
                  </td>
                  <td class="px-3 py-2 border-b border-default text-end tabular-nums">{{ fmt(f.totalProyecto) }}</td>
                  <td class="px-3 py-2 border-b border-default text-end tabular-nums text-success">{{ fmt(f.totalPagado) }}</td>
                  <td class="px-3 py-2 border-b border-default text-end tabular-nums font-semibold" :class="f.saldo > 0 ? 'text-warning' : 'text-success'">
                    {{ fmt(Math.max(0, f.saldo)) }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-elevated/30 text-xs font-semibold">
                <tr>
                  <td class="px-3 py-2 border-t border-default text-muted">Subtotal</td>
                  <td class="px-3 py-2 border-t border-default text-end tabular-nums">{{ fmt(g.totalProyecto) }}</td>
                  <td class="px-3 py-2 border-t border-default text-end tabular-nums text-success">{{ fmt(g.totalPagado) }}</td>
                  <td class="px-3 py-2 border-t border-default text-end tabular-nums" :class="g.saldo > 0 ? 'text-warning' : 'text-success'">{{ fmt(Math.max(0, g.saldo)) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </template>

      <p class="mt-4 text-xs text-muted print:text-gray-500">
        Reporte generado el {{ fechaReporte }} · Logística Internacional — Transportación & Estancias Especiales
      </p>
    </template>
  </UDashboardPanel>
</template>

<style>
@media print {
  aside, nav, header { display: none !important; }
}
</style>
