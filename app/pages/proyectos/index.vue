<script setup lang="ts">
import type { ProyectoEstatus } from '~/types'
import {
  totalProyectoConCargosUsd,
  valorDevengadoArticulosTotal,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

const router = useRouter()
const toast = useToast()
const store = useInventarioStore()

const search = ref('')
const modalOpen = ref(false)

const nuevoProyecto = reactive({
  cliente: '',
  nombre: '',
  folioPropuesta: '',
  tarifaImportacionPct: '20',
  despachoAduanal: '',
  fleteLogistica: '',
  anticipo: '',
  maniobras: '',
  fleteLaredoMty: '',
  fleteNacional: '',
  igiPct: '0',
  wireTransfer: '',
  comercializadoraPct: '0'
})

const fletesExtraNuevo = ref<{ label: string; monto: string }[]>([])

function agregarFleteNuevo() {
  if (fletesExtraNuevo.value.length < 3) {
    fletesExtraNuevo.value.push({ label: '', monto: '' })
  }
}

function quitarFleteNuevo(i: number) {
  fletesExtraNuevo.value.splice(i, 1)
}

interface ProyectoFila {
  idProyecto: string
  folioPropuesta?: string
  cliente: string
  nombre: string
  estatus: ProyectoEstatus
  totalProyectoUsd: number
  devengadoUsd: number
  cantidadArticulos: number
  pctLaredo: number
  pctAduana: number
  pctMonterrey: number
  totalPagado: number
  saldo: number
}

const proyectosFila = computed<ProyectoFila[]>(() =>
  store.listaProyectos().map(p => {
    const det = store.detalle(p.idProyecto)
    const extras = {
      maniobrasUsd: det.maniobrasUsd, fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
      fleteNacionalUsd: det.fleteNacionalUsd, fletesExtra: det.fletesExtra,
      otrosExtras: det.otrosExtras, igiPct: det.igiPct,
      wireTransferUsd: det.wireTransferUsd, comercializadoraPct: det.comercializadoraPct
    }
    const totalProyectoUsd = totalProyectoConCargosUsd(det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd, extras, p.compradoPorTrade)
    const cantTotal = det.articulos.reduce((s, a) => s + a.cantidadTotal, 0)
    const cantLaredo = det.articulos.filter(a => a.estatus === 'Laredo').reduce((s, a) => s + a.cantidadTotal, 0)
    const cantAduana = det.articulos.filter(a => a.estatus === 'En Aduana').reduce((s, a) => s + a.cantidadTotal, 0)
    const cantMty = det.articulos.filter(a => a.estatus === 'Monterrey').reduce((s, a) => s + a.cantidadTotal, 0)
    const pctLaredo = cantTotal > 0 ? Math.round((cantLaredo / cantTotal) * 100) : 0
    const pctAduana = cantTotal > 0 ? Math.round((cantAduana / cantTotal) * 100) : 0
    const pctMonterrey = cantTotal > 0 ? Math.round((cantMty / cantTotal) * 100) : 0
    const base = valorTotalProyectoDesdeArticulos(det.articulos)
    const pct = base > 0 ? valorDevengadoArticulosTotal(det.articulos) / base : 0
    const devengadoUsd = pct * totalProyectoUsd
    const totalPagado = det.pagos.reduce((s, pg) => s + pg.montoUsd, 0) + det.anticipoUsd
    return {
      idProyecto: p.idProyecto, folioPropuesta: p.folioPropuesta,
      cliente: p.cliente, nombre: p.nombre, estatus: p.estatus,
      totalProyectoUsd, devengadoUsd, cantidadArticulos: cantTotal,
      pctLaredo, pctAduana, pctMonterrey,
      totalPagado, saldo: devengadoUsd - totalPagado
    }
  })
)

const proyectosFiltrados = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return proyectosFila.value
  return proyectosFila.value.filter(p =>
    p.nombre.toLowerCase().includes(q) ||
    p.cliente.toLowerCase().includes(q) ||
    p.idProyecto.toLowerCase().includes(q) ||
    (p.folioPropuesta?.toLowerCase().includes(q) ?? false)
  )
})

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function getStatusColor(status: ProyectoEstatus): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  switch (status) {
    case 'Cotización':
      return 'info'
    case 'Completado':
      return 'success'
    case 'En Proceso':
      return 'warning'
    case 'Pendiente de Pago':
      return 'error'
    default:
      return 'neutral'
  }
}

function parseMoney(raw: string): number {
  const n = Number(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}

async function onNuevoProyectoSubmit() {
  if (!nuevoProyecto.cliente.trim() || !nuevoProyecto.nombre.trim()) {
    toast.add({
      title: 'Faltan datos',
      description: 'Indica cliente y nombre del proyecto.',
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  let tarifa = Number(nuevoProyecto.tarifaImportacionPct)
  if (!Number.isFinite(tarifa) || tarifa < 0) tarifa = 20
  let igi = Number(nuevoProyecto.igiPct)
  if (!Number.isFinite(igi) || igi < 0) igi = 0
  let comercializadora = Number(nuevoProyecto.comercializadoraPct)
  if (!Number.isFinite(comercializadora) || comercializadora < 0) comercializadora = 0

  let p
  try {
    p = await store.crearProyecto({
      cliente: nuevoProyecto.cliente,
      nombre: nuevoProyecto.nombre,
      folioPropuesta: nuevoProyecto.folioPropuesta,
      tarifaImportacionPct: tarifa,
      despachoAduanalUsd: parseMoney(nuevoProyecto.despachoAduanal),
      fleteLogisticaUsd: parseMoney(nuevoProyecto.fleteLogistica),
      anticipoUsd: parseMoney(nuevoProyecto.anticipo),
      maniobrasUsd: parseMoney(nuevoProyecto.maniobras),
      fleteLaredoMtyUsd: parseMoney(nuevoProyecto.fleteLaredoMty),
      fleteNacionalUsd: parseMoney(nuevoProyecto.fleteNacional),
      fletesExtra: fletesExtraNuevo.value
        .filter(f => f.label.trim() || parseMoney(f.monto) > 0)
        .map(f => ({ label: f.label.trim(), monto: parseMoney(f.monto) })),
      igiPct: igi,
      wireTransferUsd: parseMoney(nuevoProyecto.wireTransfer),
      comercializadoraPct: comercializadora
    })
  } catch {
    toast.add({
      title: 'No se pudo crear',
      description: 'Revisa la conexión a MySQL o los datos.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  toast.add({
    title: 'Proyecto creado',
    description: `${p.nombre} — ${p.cliente}`,
    color: 'success',
    icon: 'i-lucide-check'
  })
  nuevoProyecto.cliente = ''
  nuevoProyecto.nombre = ''
  nuevoProyecto.folioPropuesta = ''
  nuevoProyecto.tarifaImportacionPct = '20'
  nuevoProyecto.despachoAduanal = ''
  nuevoProyecto.fleteLogistica = ''
  nuevoProyecto.anticipo = ''
  nuevoProyecto.maniobras = ''
  nuevoProyecto.fleteLaredoMty = ''
  nuevoProyecto.fleteNacional = ''
  nuevoProyecto.igiPct = '0'
  nuevoProyecto.wireTransfer = ''
  nuevoProyecto.comercializadoraPct = '0'
  fletesExtraNuevo.value = []
  modalOpen.value = false
  router.push(`/proyectos/${encodeURIComponent(p.idProyecto)}`)
}

</script>

<template>
  <UDashboardPanel id="proyectos">
    <template #header>
      <UDashboardNavbar title="Proyectos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UModal
            v-model:open="modalOpen"
            title="Nuevo proyecto"
            description="Alta de proyecto con parámetros de importación, logística y financieros."
          >
            <UButton
              label="Nuevo proyecto"
              icon="i-lucide-plus"
              color="primary"
            />

            <template #body>
              <div class="max-h-[min(76vh,640px)] space-y-4 overflow-y-auto pr-1">
                <!-- Identificación -->
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                  Identificación
                </p>
                <UFormField label="Cliente" name="cliente" required>
                  <UInput
                    v-model="nuevoProyecto.cliente"
                    placeholder="Nombre del cliente"
                    icon="i-lucide-building-2"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Nombre del proyecto" name="nombre" required>
                  <UInput
                    v-model="nuevoProyecto.nombre"
                    placeholder="Ej. Casa San Pedro"
                    icon="i-lucide-layout-template"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Folio de propuesta"
                  name="folioPropuesta"
                  description="Identificador del documento comercial (ej. 102901)."
                >
                  <UInput
                    v-model="nuevoProyecto.folioPropuesta"
                    placeholder="102901"
                    icon="i-lucide-hash"
                    class="w-full font-mono"
                  />
                </UFormField>

                <USeparator />

                <!-- Importación -->
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                  Importación y logística base
                </p>
                <UFormField
                  label="Tarifa de importación (%)"
                  name="tarifaImportacionPct"
                  description="Aplicada al subtotal de líneas en Monterrey."
                >
                  <UInput
                    v-model="nuevoProyecto.tarifaImportacionPct"
                    type="number"
                    min="0"
                    step="0.1"
                    icon="i-lucide-percent"
                    class="w-full"
                  />
                </UFormField>
                <div class="grid gap-4 sm:grid-cols-2">
                  <UFormField label="Despacho aduanal (USD)" name="despachoAduanal">
                    <UInput
                      v-model="nuevoProyecto.despachoAduanal"
                      type="number"
                      min="0"
                      step="0.01"
                      icon="i-lucide-landmark"
                      placeholder="0.00"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Flete y logística (USD)" name="fleteLogistica">
                    <UInput
                      v-model="nuevoProyecto.fleteLogistica"
                      type="number"
                      min="0"
                      step="0.01"
                      icon="i-lucide-truck"
                      placeholder="0.00"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <USeparator />

                <!-- Costos adicionales de logística -->
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                  Logística adicional
                </p>
                <div class="grid gap-4 sm:grid-cols-3">
                  <UFormField label="Maniobras especiales (USD)" name="maniobras">
                    <UInput
                      v-model="nuevoProyecto.maniobras"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Flete Laredo → Mty (USD)" name="fleteLaredoMty">
                    <UInput
                      v-model="nuevoProyecto.fleteLaredoMty"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Flete nacional (USD)" name="fleteNacional">
                    <UInput
                      v-model="nuevoProyecto.fleteNacional"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <!-- Fletes adicionales dinámicos -->
                <div class="space-y-2">
                  <div
                    v-for="(fe, i) in fletesExtraNuevo"
                    :key="i"
                    class="flex items-end gap-2"
                  >
                    <UFormField :label="i === 0 ? 'Fletes adicionales' : ''" class="flex-1" :name="`fe-label-${i}`">
                      <UInput
                        v-model="fe.label"
                        placeholder="Etiqueta (ej. Flete especial)"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField :label="i === 0 ? 'Monto (USD)' : ''" class="w-32 shrink-0" :name="`fe-monto-${i}`">
                      <UInput
                        v-model="fe.monto"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        class="w-full"
                      />
                    </UFormField>
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      square
                      :class="i === 0 ? 'mb-0' : ''"
                      @click="quitarFleteNuevo(i)"
                    />
                  </div>
                  <UButton
                    v-if="fletesExtraNuevo.length < 3"
                    label="Agregar flete adicional"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    @click="agregarFleteNuevo"
                  />
                </div>

                <USeparator />

                <!-- Impuestos y financiero -->
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                  Impuestos y financiero
                </p>
                <div class="grid gap-4 sm:grid-cols-3">
                  <UFormField label="IGI (%)" name="igiPct" description="Base: subtotal Monterrey.">
                    <UInput
                      v-model="nuevoProyecto.igiPct"
                      type="number"
                      min="0"
                      step="0.01"
                      icon="i-lucide-percent"
                      placeholder="0"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Wire transfer (USD)" name="wireTransfer">
                    <UInput
                      v-model="nuevoProyecto.wireTransfer"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Comercializadora (%)" name="comercializadoraPct" description="Base: subtotal Monterrey.">
                    <UInput
                      v-model="nuevoProyecto.comercializadoraPct"
                      type="number"
                      min="0"
                      step="0.01"
                      icon="i-lucide-percent"
                      placeholder="0"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <USeparator />

                <!-- Anticipo -->
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                  Pagos iniciales
                </p>
                <UFormField
                  label="Anticipo (USD)"
                  name="anticipo"
                  description="Pagos iniciales antes del devengamiento."
                >
                  <UInput
                    v-model="nuevoProyecto.anticipo"
                    type="number"
                    min="0"
                    step="0.01"
                    icon="i-lucide-banknote"
                    placeholder="0.00"
                    class="w-full"
                  />
                </UFormField>

                <div class="flex justify-end gap-2 pt-2">
                  <UButton
                    label="Cancelar"
                    color="neutral"
                    variant="subtle"
                    @click="modalOpen = false"
                  />
                  <UButton
                    label="Crear proyecto"
                    color="primary"
                    icon="i-lucide-check"
                    @click="onNuevoProyectoSubmit"
                  />
                </div>
              </div>
            </template>
          </UModal>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:shrink-0">
          <UInput v-model="search" class="w-full max-w-md" icon="i-lucide-search" placeholder="Buscar por proyecto, cliente, folio o ID…" size="md" />
          <p class="shrink-0 text-sm text-muted">{{ proyectosFiltrados.length }} proyecto(s)</p>
        </div>

        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div class="overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">ID / Folio</th>
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">Cliente · Proyecto</th>
                  <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Total proyecto</th>
                  <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Devengado</th>
                  <th class="w-16 px-3 py-2.5 text-center border-b border-default font-medium">Artículos</th>
                  <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">% Laredo</th>
                  <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">% Aduana</th>
                  <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">% Mty</th>
                  <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Total pagado</th>
                  <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Pendiente</th>
                  <th class="w-28 px-3 py-2.5 text-center border-b border-default font-medium">Estatus</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!proyectosFiltrados.length">
                  <td colspan="11" class="py-16 text-center text-sm text-muted">
                    <div class="flex flex-col items-center gap-2">
                      <UIcon name="i-lucide-folder-kanban" class="size-8 text-muted/50" />
                      <span>No hay proyectos que coincidan.</span>
                    </div>
                  </td>
                </tr>
                <tr
                  v-for="p in proyectosFiltrados"
                  :key="p.idProyecto"
                  class="cursor-pointer transition-colors hover:bg-elevated/40"
                  @click="router.push(`/proyectos/${encodeURIComponent(p.idProyecto)}`)"
                >
                  <td class="px-3 py-2.5 border-b border-default">
                    <p class="font-mono text-xs text-highlighted">{{ p.idProyecto }}</p>
                    <p v-if="p.folioPropuesta" class="font-mono text-xs text-muted">{{ p.folioPropuesta }}</p>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default">
                    <p class="font-medium text-highlighted">{{ p.cliente }}</p>
                    <p class="text-xs text-muted">{{ p.nombre }}</p>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-end tabular-nums font-semibold text-highlighted">
                    {{ formatUsd(p.totalProyectoUsd) }}
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-end tabular-nums font-medium text-info">
                    {{ formatUsd(p.devengadoUsd) }}
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-center font-medium text-highlighted">
                    {{ p.cantidadArticulos }}
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-center">
                    <span v-if="p.pctLaredo > 0" class="text-xs font-medium text-neutral-500">{{ p.pctLaredo }}%</span>
                    <span v-else class="text-xs text-muted">—</span>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-center">
                    <span v-if="p.pctAduana > 0" class="text-xs font-medium text-warning">{{ p.pctAduana }}%</span>
                    <span v-else class="text-xs text-muted">—</span>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-center">
                    <span v-if="p.pctMonterrey > 0" class="text-xs font-medium text-success">{{ p.pctMonterrey }}%</span>
                    <span v-else class="text-xs text-muted">—</span>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-end tabular-nums text-success font-medium">
                    {{ formatUsd(p.totalPagado) }}
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-end tabular-nums font-semibold" :class="p.saldo > 0.01 ? 'text-warning' : 'text-success'">
                    {{ formatUsd(Math.max(0, p.saldo)) }}
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-center">
                    <UBadge :color="getStatusColor(p.estatus)" variant="soft" size="sm">{{ p.estatus }}</UBadge>
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
