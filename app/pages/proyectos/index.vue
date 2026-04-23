<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Proyecto, ProyectoEstatus } from '~/types'

const UBadge = resolveComponent('UBadge')
const UProgress = resolveComponent('UProgress')
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

const proyectosFiltrados = computed(() => {
  const q = search.value.trim().toLowerCase()
  const lista = store.listaProyectos()
  if (!q) {
    return lista
  }
  return lista.filter(
    p =>
      p.nombre.toLowerCase().includes(q)
      || p.cliente.toLowerCase().includes(q)
      || p.idProyecto.toLowerCase().includes(q)
      || (p.folioPropuesta?.toLowerCase().includes(q) ?? false)
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

function getStatusColor(status: ProyectoEstatus): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
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

function onRowSelect(_e: Event, row: { original: Proyecto }) {
  router.push(`/proyectos/${encodeURIComponent(row.original.idProyecto)}`)
}

const columns: TableColumn<Proyecto>[] = [
  {
    accessorKey: 'idProyecto',
    header: 'ID Proyecto',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-sm text-highlighted' }, row.original.idProyecto)
  },
  {
    accessorKey: 'folioPropuesta',
    header: 'Folio prop.',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-xs text-muted' }, row.original.folioPropuesta ?? '—')
  },
  {
    accessorKey: 'cliente',
    header: 'Cliente',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-highlighted' }, row.original.cliente)
  },
  {
    accessorKey: 'nombre',
    header: 'Nombre del proyecto',
    cell: ({ row }) => h('span', { class: 'text-default' }, row.original.nombre)
  },
  {
    accessorKey: 'valorTotalUsd',
    header: () => h('div', { class: 'text-end' }, 'Valor total USD'),
    cell: ({ row }) =>
      h('div', { class: 'text-end tabular-nums font-medium' }, formatUsd(row.original.valorTotalUsd))
  },
  {
    accessorKey: 'estatus',
    header: 'Estatus global',
    cell: ({ row }) => {
      const status = row.original.estatus
      return h(
        UBadge,
        {
          color: getStatusColor(status),
          variant: 'soft'
        },
        () => status
      )
    }
  },
  {
    id: 'progreso',
    header: 'Progreso devengado (Monterrey)',
    cell: ({ row }) => {
      const p = row.original
      const pct = Math.min(100, Math.max(0, p.progresoDevengadoPct))
      return h('div', { class: 'min-w-[168px] space-y-1.5' }, [
        h(UProgress, {
          modelValue: pct,
          max: 100,
          size: 'sm',
          color: 'primary'
        }),
        h(
          'p',
          { class: 'text-xs text-muted tabular-nums' },
          `${pct}% · ${formatUsd(p.montoMonterreyUsd)} / ${formatUsd(p.valorTotalUsd)}`
        )
      ])
    }
  }
]
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
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <UInput
          v-model="search"
          class="w-full max-w-md"
          icon="i-lucide-search"
          placeholder="Buscar por proyecto, cliente, folio o ID…"
          size="md"
        />
        <p class="text-sm text-muted">
          {{ proyectosFiltrados.length }} proyecto(s)
        </p>
      </div>

      <UTable
        :data="proyectosFiltrados"
        :columns="columns"
        :on-select="onRowSelect"
        :get-row-id="(row) => row.idProyecto"
        class="mt-4 shrink-0"
        :meta="{
          class: {
            tr: 'cursor-pointer transition-colors hover:bg-elevated/40'
          }
        }"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      />
    </template>
  </UDashboardPanel>
</template>
