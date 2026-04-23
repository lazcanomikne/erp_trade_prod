<script setup lang="ts">
import type {
  ArticuloEstatusLogistica,
  ArticuloProyecto,
  ProyectoEstatus
} from '~/types'
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import {
  saldoPorCobrarZambranoUsd,
  subtotalCargosZambranoUsd,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

const route = useRoute()
const toast = useToast()
const store = useInventarioStore()

const id = decodeURIComponent(route.params.id as string)

try {
  /** Siempre sincronizar con MySQL al abrir detalle (evita store/TanStack desalineados tras SSR o caché). */
  await store.refreshFromApi()
} catch {
  throw createError({
    statusCode: 503,
    statusMessage: 'No se pudieron cargar los datos del ERP (MySQL / red).'
  })
}

if (!store.getProyectoById(id)) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Proyecto no encontrado'
  })
}

/** Tras cada refreshFromApi Pinia reemplaza el estado; computed evita detalle obsoleto (tabla vacía con "N líneas"). */
const proyecto = computed(() => store.getProyectoById(id))
const d = computed(() => store.detalle(id))

const modalArticulo = ref(false)
const modalPago = ref(false)
const modalEditarProyecto = ref(false)
const savingArticulo = ref(false)
const savingProyecto = ref(false)

const nuevoArticulo = reactive({
  nombre: '',
  sg: '',
  cantidad: '',
  precio: '',
  archivo: null as File | null,
  estatusInicial: 'Laredo' as ArticuloEstatusLogistica
})

const estatusItems = [
  { label: 'Laredo', value: 'Laredo' },
  { label: 'En Aduana', value: 'En Aduana' },
  { label: 'Monterrey', value: 'Monterrey' }
]

const valorTotalProyecto = computed(() => {
  const p = proyecto.value
  const det = d.value
  if (!p) {
    return 0
  }
  if (!det.articulos.length) {
    return p.valorTotalUsd
  }
  return valorTotalProyectoDesdeArticulos(det.articulos)
})

const totalPagado = computed(() =>
  d.value.pagos.reduce((s, p) => s + p.montoUsd, 0)
)

const extrasDetalle = computed(() => ({
  maniobrasUsd: d.value.maniobrasUsd,
  fleteLaredoMtyUsd: d.value.fleteLaredoMtyUsd,
  fleteNacionalUsd: d.value.fleteNacionalUsd,
  fletesExtra: d.value.fletesExtra,
  otrosExtras: d.value.otrosExtras,
  igiPct: d.value.igiPct,
  wireTransferUsd: d.value.wireTransferUsd,
  comercializadoraPct: d.value.comercializadoraPct
}))

const valorDevengadoCuentas = computed(() =>
  subtotalCargosZambranoUsd(
    d.value.articulos,
    d.value.tarifaImportacionPct,
    d.value.aduanaUsd,
    d.value.fleteUsd,
    extrasDetalle.value
  )
)

const saldoTotalCuentas = computed(() =>
  saldoPorCobrarZambranoUsd(
    d.value.articulos,
    d.value.tarifaImportacionPct,
    d.value.aduanaUsd,
    d.value.fleteUsd,
    d.value.anticipoUsd,
    totalPagado.value,
    extrasDetalle.value
  )
)

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function parseMoney(raw: string): number {
  const n = Number(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const proyectoEstatusSelect = [
  { label: 'En Proceso', value: 'En Proceso' as ProyectoEstatus },
  { label: 'Completado', value: 'Completado' },
  { label: 'Pendiente de Pago', value: 'Pendiente de Pago' }
]

const editProyecto = reactive({
  cliente: '',
  nombre: '',
  folioPropuesta: '',
  estatus: 'En Proceso' as ProyectoEstatus,
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

const fletesExtraEdit = ref<{ label: string; monto: string }[]>([])

function agregarFleteEdit() {
  if (fletesExtraEdit.value.length < 3) {
    fletesExtraEdit.value.push({ label: '', monto: '' })
  }
}

function quitarFleteEdit(i: number) {
  fletesExtraEdit.value.splice(i, 1)
}

function abrirEditarProyecto() {
  const p = proyecto.value
  if (!p) {
    return
  }
  const det = d.value
  editProyecto.cliente = p.cliente
  editProyecto.nombre = p.nombre
  editProyecto.folioPropuesta = p.folioPropuesta ?? ''
  editProyecto.estatus = p.estatus
  editProyecto.tarifaImportacionPct = String(det.tarifaImportacionPct)
  editProyecto.despachoAduanal = String(det.aduanaUsd)
  editProyecto.fleteLogistica = String(det.fleteUsd)
  editProyecto.anticipo = String(det.anticipoUsd)
  editProyecto.maniobras = String(det.maniobrasUsd)
  editProyecto.fleteLaredoMty = String(det.fleteLaredoMtyUsd)
  editProyecto.fleteNacional = String(det.fleteNacionalUsd)
  editProyecto.igiPct = String(det.igiPct)
  editProyecto.wireTransfer = String(det.wireTransferUsd)
  editProyecto.comercializadoraPct = String(det.comercializadoraPct)
  fletesExtraEdit.value = det.fletesExtra.map(f => ({
    label: f.label,
    monto: String(f.monto)
  }))
  modalEditarProyecto.value = true
}

async function guardarEdicionProyecto() {
  const p = proyecto.value
  if (!p) {
    return
  }
  let tarifa = Number(editProyecto.tarifaImportacionPct)
  if (!Number.isFinite(tarifa) || tarifa < 0) tarifa = d.value.tarifaImportacionPct
  let igi = Number(editProyecto.igiPct)
  if (!Number.isFinite(igi) || igi < 0) igi = 0
  let comercializadora = Number(editProyecto.comercializadoraPct)
  if (!Number.isFinite(comercializadora) || comercializadora < 0) comercializadora = 0

  savingProyecto.value = true
  try {
    await store.actualizarProyecto(p.idProyecto, {
      cliente: editProyecto.cliente.trim(),
      nombre: editProyecto.nombre.trim(),
      folioPropuesta: editProyecto.folioPropuesta.trim() || null,
      estatus: editProyecto.estatus,
      tarifaImportacionPct: tarifa,
      despachoAduanalUsd: parseMoney(editProyecto.despachoAduanal),
      fleteLogisticaUsd: parseMoney(editProyecto.fleteLogistica),
      anticipoUsd: parseMoney(editProyecto.anticipo),
      maniobrasUsd: parseMoney(editProyecto.maniobras),
      fleteLaredoMtyUsd: parseMoney(editProyecto.fleteLaredoMty),
      fleteNacionalUsd: parseMoney(editProyecto.fleteNacional),
      fletesExtra: fletesExtraEdit.value
        .filter(f => f.label.trim() || parseMoney(f.monto) > 0)
        .map(f => ({ label: f.label.trim(), monto: parseMoney(f.monto) })),
      igiPct: igi,
      wireTransferUsd: parseMoney(editProyecto.wireTransfer),
      comercializadoraPct: comercializadora
    })
  } catch {
    toast.add({
      title: 'No se guardó el proyecto',
      description: 'Revisa MySQL o los datos.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    return
  } finally {
    savingProyecto.value = false
  }
  toast.add({
    title: 'Proyecto actualizado',
    description: p.nombre,
    color: 'success',
    icon: 'i-lucide-check'
  })
  modalEditarProyecto.value = false
}

const statsItems = computed<ProjectStatItem[]>(() => [
  {
    title: 'Valor total proyecto',
    icon: 'i-lucide-circle-dollar-sign',
    value: formatUsd(valorTotalProyecto.value),
    tone: 'primary'
  },
  {
    title: 'Valor devengado (cuentas)',
    icon: 'i-lucide-truck',
    value: formatUsd(valorDevengadoCuentas.value),
    tone: 'success'
  },
  {
    title: 'Total pagado',
    icon: 'i-lucide-wallet',
    value: formatUsd(totalPagado.value),
    tone: 'info'
  },
  {
    title: 'Saldo total',
    icon: 'i-lucide-scale',
    value: formatUsd(saldoTotalCuentas.value),
    tone: 'warning'
  }
])

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

async function onEstatusArticulo(articulo: ArticuloProyecto, value: ArticuloEstatusLogistica) {
  try {
    await store.patchArticuloEstatus(proyecto.value!.idProyecto, articulo.id, value)
  } catch {
    toast.add({
      title: 'No se guardó el estatus',
      description: 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  }
}

function abrirModalArticulo() {
  nuevoArticulo.nombre = ''
  nuevoArticulo.sg = ''
  nuevoArticulo.cantidad = ''
  nuevoArticulo.precio = ''
  nuevoArticulo.archivo = null
  nuevoArticulo.estatusInicial = 'Laredo'
  modalArticulo.value = true
}

async function guardarArticulo() {
  const nombre = nuevoArticulo.nombre.trim()
  const sg = nuevoArticulo.sg.trim()
  const cant = Number(nuevoArticulo.cantidad)
  const precio = Number(nuevoArticulo.precio)
  if (!nombre || !sg || !Number.isFinite(cant) || cant <= 0 || !Number.isFinite(precio) || precio <= 0) {
    toast.add({
      title: 'Revisa los datos',
      description: 'Nombre, SG, cantidad y precio válidos son obligatorios.',
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }

  savingArticulo.value = true

  let imagenUrl = `https://picsum.photos/seed/${encodeURIComponent(sg)}/96/96`
  if (nuevoArticulo.archivo) {
    try {
      const fd = new FormData()
      fd.append('file', nuevoArticulo.archivo)
      const up = await $fetch<{ url: string }>('/api/articulos/upload', {
        method: 'POST',
        body: fd
      })
      imagenUrl = up.url
    } catch {
      toast.add({
        title: 'Falló la subida de imagen',
        description: 'Guardamos con imagen placeholder.',
        color: 'warning',
        icon: 'i-lucide-alert-circle'
      })
    }
  }

  const est = nuevoArticulo.estatusInicial

  try {
    await store.agregarArticulo(proyecto.value!.idProyecto, {
      sg,
      descripcion: nombre,
      imagenUrl,
      cantidadTotal: cant,
      precioUnitario: precio,
      estatus: est
    })
  } catch {
    toast.add({
      title: 'No se guardó el artículo',
      description: 'Revisa MySQL o intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    return
  } finally {
    savingArticulo.value = false
  }

  toast.add({
    title: 'Artículo añadido',
    description: `${sg} — ${nombre}`,
    color: 'success',
    icon: 'i-lucide-package-plus'
  })
  modalArticulo.value = false
}

async function onReferenciaArticulo(articulo: ArticuloProyecto, value: string) {
  try {
    await store.patchArticuloReferencia(
      proyecto.value!.idProyecto,
      articulo.id,
      value || null
    )
  } catch {
    toast.add({
      title: 'No se guardó la referencia',
      description: 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  }
}

const nuevoOtro = reactive({ descripcion: '', monto: '' })
const savingOtro = ref(false)
const editandoOtroId = ref<string | null>(null)
const editOtro = reactive({ descripcion: '', monto: '' })

async function agregarOtro() {
  const desc = nuevoOtro.descripcion.trim()
  const monto = parseMoney(nuevoOtro.monto)
  if (!desc) {
    toast.add({ title: 'Indica una descripción', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingOtro.value = true
  try {
    await store.agregarOtroCargo(proyecto.value!.idProyecto, desc, monto)
    nuevoOtro.descripcion = ''
    nuevoOtro.monto = ''
  } catch {
    toast.add({ title: 'No se guardó el cargo', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingOtro.value = false
  }
}

async function eliminarOtro(idOtro: string) {
  try {
    await store.eliminarOtroCargo(proyecto.value!.idProyecto, idOtro)
  } catch {
    toast.add({ title: 'No se eliminó el cargo', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

function iniciarEdicionOtro(id: string, descripcion: string, montoUsd: number) {
  editandoOtroId.value = id
  editOtro.descripcion = descripcion
  editOtro.monto = String(montoUsd)
}

function cancelarEdicionOtro() {
  editandoOtroId.value = null
}

async function guardarEdicionOtro(idOtro: string) {
  const desc = editOtro.descripcion.trim()
  if (!desc) return
  savingOtro.value = true
  try {
    await store.editarOtroCargo(proyecto.value!.idProyecto, idOtro, desc, parseMoney(editOtro.monto))
    editandoOtroId.value = null
  } catch {
    toast.add({ title: 'No se guardó el cambio', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingOtro.value = false
  }
}

async function guardarPago(m: number) {
  try {
    await store.registrarPago(proyecto.value!.idProyecto, m)
  } catch {
    toast.add({
      title: 'No se registró el pago',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  toast.add({
    title: 'Pago registrado',
    description: formatUsd(m),
    color: 'success',
    icon: 'i-lucide-banknote'
  })
}
</script>

<template>
  <UDashboardPanel v-if="proyecto" :id="`proyecto-${proyecto.idProyecto}`">
    <template #header>
      <UDashboardNavbar :title="proyecto.nombre">
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <UButton
              to="/proyectos"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              square
            />
          </div>
        </template>

        <template #right>
          <UBadge :color="getStatusColor(proyecto.estatus)" variant="soft">
            {{ proyecto.estatus }}
          </UBadge>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col">
        <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:shrink-0">
          <div>
            <p class="text-sm text-muted">
              <span class="font-medium text-highlighted">{{ proyecto.cliente }}</span>
              · {{ proyecto.idProyecto }}
              <span v-if="proyecto.folioPropuesta" class="text-muted"> · Folio {{ proyecto.folioPropuesta }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Editar proyecto"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              @click="abrirEditarProyecto"
            />
            <UButton
              label="Añadir artículo"
              icon="i-lucide-package-plus"
              color="primary"
              @click="abrirModalArticulo"
            />
            <UButton
              label="Registrar pago"
              icon="i-lucide-banknote"
              color="neutral"
              variant="outline"
              @click="modalPago = true"
            />
          </div>
        </div>

        <ProjectStats class="mb-4 lg:shrink-0" :items="statsItems" />

        <div class="mb-2 flex items-center justify-between gap-2 lg:shrink-0">
          <h2 class="text-lg font-semibold text-highlighted">
            Artículos
          </h2>
          <span class="text-sm text-muted">{{ d.articulos.length }} líneas</span>
        </div>

        <div class="max-lg:hidden lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <ProjectItemTable
            :articulos="d.articulos"
            @estatus-change="onEstatusArticulo"
            @referencia-change="onReferenciaArticulo"
          />
        </div>
        <ProjectItemInventoryMobile
          :articulos="d.articulos"
          @estatus-change="onEstatusArticulo"
          @referencia-change="onReferenciaArticulo"
        />

        <!-- Otros cargos -->
        <div class="mt-4 lg:shrink-0 rounded-lg border border-default bg-elevated/30 p-4">
          <div class="mb-3 flex items-center gap-2 text-highlighted">
            <UIcon name="i-lucide-plus-circle" class="size-5 text-primary" />
            <span class="font-semibold">Otros cargos</span>
            <span v-if="d.otrosExtras.length" class="ml-auto text-sm text-muted">{{ d.otrosExtras.length }} cargo(s)</span>
          </div>

          <!-- Lista de cargos existentes -->
          <div v-if="d.otrosExtras.length" class="mb-3 space-y-1">
            <div
              v-for="oc in d.otrosExtras"
              :key="oc.id"
              class="rounded-md border border-default/60"
            >
              <!-- Modo edición -->
              <div v-if="editandoOtroId === oc.id" class="flex items-center gap-2 p-2">
                <UInput
                  v-model="editOtro.descripcion"
                  placeholder="Descripción"
                  size="sm"
                  class="flex-1"
                />
                <UInput
                  v-model="editOtro.monto"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  size="sm"
                  class="w-28 shrink-0"
                />
                <UButton
                  icon="i-lucide-check"
                  size="sm"
                  color="primary"
                  :loading="savingOtro"
                  @click="guardarEdicionOtro(oc.id)"
                />
                <UButton
                  icon="i-lucide-x"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  @click="cancelarEdicionOtro"
                />
              </div>
              <!-- Modo lectura -->
              <div v-else class="flex items-center gap-3 px-3 py-2 text-sm">
                <span class="flex-1 text-highlighted">{{ oc.descripcion }}</span>
                <span class="tabular-nums font-medium text-highlighted">
                  ${{ oc.montoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </span>
                <UButton
                  icon="i-lucide-pencil"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  @click="iniciarEdicionOtro(oc.id, oc.descripcion, oc.montoUsd)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  square
                  @click="eliminarOtro(oc.id)"
                />
              </div>
            </div>
          </div>

          <!-- Agregar nuevo cargo -->
          <div class="flex items-center gap-2">
            <UInput
              v-model="nuevoOtro.descripcion"
              placeholder="Descripción del cargo (ej. Seguro, Almacenaje…)"
              size="sm"
              class="flex-1"
              :disabled="savingOtro"
              @keydown.enter="agregarOtro"
            />
            <UInput
              v-model="nuevoOtro.monto"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              size="sm"
              class="w-28 shrink-0"
              :disabled="savingOtro"
              @keydown.enter="agregarOtro"
            />
            <UButton
              label="Agregar"
              icon="i-lucide-plus"
              size="sm"
              color="primary"
              :loading="savingOtro"
              @click="agregarOtro"
            />
          </div>
        </div>

        <ProjectResumenCuentas
          class="mt-4 lg:shrink-0"
          :articulos="d.articulos"
          :tarifa-importacion-pct="d.tarifaImportacionPct"
          :despacho-aduanal-usd="d.aduanaUsd"
          :flete-logistica-usd="d.fleteUsd"
          :anticipo-usd="d.anticipoUsd"
          :total-pagos-usd="totalPagado"
          :maniobras-usd="d.maniobrasUsd"
          :flete-laredo-mty-usd="d.fleteLaredoMtyUsd"
          :flete-nacional-usd="d.fleteNacionalUsd"
          :fletes-extra="d.fletesExtra"
          :otros-extras="d.otrosExtras"
          :igi-pct="d.igiPct"
          :wire-transfer-usd="d.wireTransferUsd"
          :comercializadora-pct="d.comercializadoraPct"
        />
      </div>

      <ProjectPaymentModal v-model:open="modalPago" @submit="guardarPago" />

      <UModal
        v-model:open="modalEditarProyecto"
        title="Editar proyecto"
        description="Cliente, nombre, folio, estatus y parámetros financieros."
      >
        <template #body>
          <div class="max-h-[min(76vh,640px)] space-y-4 overflow-y-auto pr-1">
            <!-- Identificación -->
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">
              Identificación
            </p>
            <UFormField label="Cliente" name="e-cliente" required>
              <UInput v-model="editProyecto.cliente" class="w-full" icon="i-lucide-building-2" />
            </UFormField>
            <UFormField label="Nombre del proyecto" name="e-nombre" required>
              <UInput v-model="editProyecto.nombre" class="w-full" icon="i-lucide-layout-template" />
            </UFormField>
            <UFormField label="Folio de propuesta" name="e-folio">
              <UInput v-model="editProyecto.folioPropuesta" class="w-full font-mono" icon="i-lucide-hash" />
            </UFormField>
            <UFormField label="Estatus global" name="e-estatus">
              <USelect
                v-model="editProyecto.estatus"
                :items="proyectoEstatusSelect"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <USeparator />

            <!-- Importación base -->
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">
              Importación y logística base
            </p>
            <UFormField label="Tarifa importación (%)" name="e-tarifa">
              <UInput
                v-model="editProyecto.tarifaImportacionPct"
                type="number"
                min="0"
                step="0.1"
                class="w-full"
                icon="i-lucide-percent"
              />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Despacho aduanal (USD)" name="e-aduana">
                <UInput
                  v-model="editProyecto.despachoAduanal"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Flete / logística (USD)" name="e-flete">
                <UInput
                  v-model="editProyecto.fleteLogistica"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full"
                />
              </UFormField>
            </div>

            <USeparator />

            <!-- Logística adicional -->
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">
              Logística adicional
            </p>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Maniobras especiales (USD)" name="e-maniobras">
                <UInput
                  v-model="editProyecto.maniobras"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Flete Laredo → Mty (USD)" name="e-flete-laredo">
                <UInput
                  v-model="editProyecto.fleteLaredoMty"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Flete nacional (USD)" name="e-flete-nacional">
                <UInput
                  v-model="editProyecto.fleteNacional"
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
                v-for="(fe, i) in fletesExtraEdit"
                :key="i"
                class="flex items-end gap-2"
              >
                <UFormField :label="i === 0 ? 'Fletes adicionales' : ''" class="flex-1" :name="`efe-label-${i}`">
                  <UInput
                    v-model="fe.label"
                    placeholder="Etiqueta (ej. Flete especial)"
                    class="w-full"
                  />
                </UFormField>
                <UFormField :label="i === 0 ? 'Monto (USD)' : ''" class="w-32 shrink-0" :name="`efe-monto-${i}`">
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
                  @click="quitarFleteEdit(i)"
                />
              </div>
              <UButton
                v-if="fletesExtraEdit.length < 3"
                label="Agregar flete adicional"
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="agregarFleteEdit"
              />
            </div>

            <USeparator />

            <!-- Impuestos y financiero -->
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">
              Impuestos y financiero
            </p>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="IGI (%)" name="e-igi">
                <UInput
                  v-model="editProyecto.igiPct"
                  type="number"
                  min="0"
                  step="0.01"
                  icon="i-lucide-percent"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Wire transfer (USD)" name="e-wire">
                <UInput
                  v-model="editProyecto.wireTransfer"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Comercializadora (%)" name="e-comercializadora">
                <UInput
                  v-model="editProyecto.comercializadoraPct"
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
            <UFormField label="Anticipo (USD)" name="e-anticipo">
              <UInput
                v-model="editProyecto.anticipo"
                type="number"
                min="0"
                step="0.01"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2 pt-2">
              <UButton
                label="Cancelar"
                color="neutral"
                variant="subtle"
                :disabled="savingProyecto"
                @click="modalEditarProyecto = false"
              />
              <UButton
                label="Guardar cambios"
                color="primary"
                icon="i-lucide-check"
                :loading="savingProyecto"
                :disabled="savingProyecto"
                @click="guardarEdicionProyecto"
              />
            </div>
          </div>
        </template>
      </UModal>

      <UModal
        v-model:open="modalArticulo"
        title="Añadir artículo"
        description="Incluye foto para evitar confusiones entre modelos (ej. sillas)."
      >
        <template #body>
          <div class="space-y-4">
            <UFormField label="Nombre / descripción" name="nombre" required>
              <UInput
                v-model="nuevoArticulo.nombre"
                placeholder="Ej. Silla comedor roble"
                icon="i-lucide-text"
                class="w-full"
              />
            </UFormField>
            <UFormField label="SG (ID)" name="sg" required>
              <UInput
                v-model="nuevoArticulo.sg"
                placeholder="SG-00000"
                icon="i-lucide-hash"
                class="w-full font-mono"
              />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Cantidad" name="cantidad" required>
                <UInput
                  v-model="nuevoArticulo.cantidad"
                  type="number"
                  min="1"
                  step="1"
                  icon="i-lucide-hash"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Precio unitario (USD)" name="precio" required>
                <UInput
                  v-model="nuevoArticulo.precio"
                  type="number"
                  min="0"
                  step="0.01"
                  icon="i-lucide-dollar-sign"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField
              label="Imagen del producto"
              name="imagen"
              description="Sube una foto clara del modelo."
            >
              <UFileUpload
                v-model="nuevoArticulo.archivo"
                accept="image/*"
                :interactive="true"
                variant="area"
                icon="i-lucide-image-plus"
                label="Arrastra o elige imagen"
                description="PNG, JPG o WEBP"
              />
            </UFormField>
            <UFormField label="Estatus inicial" name="estatusInicial">
              <USelect
                v-model="nuevoArticulo.estatusInicial"
                :items="estatusItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton
                label="Cancelar"
                color="neutral"
                variant="subtle"
                :disabled="savingArticulo"
                @click="modalArticulo = false"
              />
              <UButton
                label="Guardar artículo"
                color="primary"
                icon="i-lucide-check"
                :loading="savingArticulo"
                :disabled="savingArticulo"
                @click="guardarArticulo"
              />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
