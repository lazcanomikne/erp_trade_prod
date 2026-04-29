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
  totalProyectoConCargosUsd,
  valorDevengadoArticulosTotal,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

const route = useRoute()
const toast = useToast()
const store = useInventarioStore()
const entregasStore = useEntregasStore()

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
const modalPagos = ref(false)
const modalEditarProyecto = ref(false)
const savingArticulo = ref(false)
const savingProyecto = ref(false)

const nuevoArticulo = reactive({
  nombre: '',
  sg: '',
  cantidad: '',
  precio: '',
  marca: '',
  bultos: '',
  numeroRack: '',
  archivo: null as File | null,
  estatusInicial: 'Laredo' as ArticuloEstatusLogistica
})

const estatusItems = [
  { label: 'Laredo', value: 'Laredo' },
  { label: 'En Aduana', value: 'En Aduana' },
  { label: 'Monterrey', value: 'Monterrey' }
]

const compradoPorTrade = ref(proyecto.value?.compradoPorTrade ?? true)

watch(() => proyecto.value?.compradoPorTrade, (val) => {
  if (val !== undefined) compradoPorTrade.value = val
})

const valorTotalProyecto = computed(() => {
  const p = proyecto.value
  const det = d.value
  if (!p) {
    return 0
  }
  if (!det.articulos.length) {
    return p.valorTotalUsd
  }
  return compradoPorTrade.value ? valorTotalProyectoDesdeArticulos(det.articulos) : 0
})

const valorDevengadoTotal = computed(() =>
  valorDevengadoArticulosTotal(d.value.articulos)
)

const totalPagado = computed(() =>
  d.value.pagos.reduce((s, p) => s + p.montoUsd, 0)
)

const totalPagadoConAnticipo = computed(() => totalPagado.value + d.value.anticipoUsd)

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
    extrasDetalle.value,
    compradoPorTrade.value
  )
)

const totalProyecto = computed(() =>
  totalProyectoConCargosUsd(
    d.value.articulos,
    d.value.tarifaImportacionPct,
    d.value.aduanaUsd,
    d.value.fleteUsd,
    extrasDetalle.value,
    compradoPorTrade.value
  )
)

const saldoTotalCuentas = computed(() =>
  totalProyecto.value - totalPagadoConAnticipo.value
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
  { label: 'Cotización', value: 'Cotización' as ProyectoEstatus },
  { label: 'En Proceso', value: 'En Proceso' as ProyectoEstatus },
  { label: 'Completado', value: 'Completado' as ProyectoEstatus },
  { label: 'Pendiente de Pago', value: 'Pendiente de Pago' as ProyectoEstatus }
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
    title: 'Subtotal artículos',
    icon: 'i-lucide-package',
    value: formatUsd(valorTotalProyecto.value),
    tone: 'primary'
  },
  {
    title: 'Valor devengado',
    icon: 'i-lucide-trending-up',
    value: formatUsd(valorDevengadoTotal.value),
    tone: 'info'
  },
  {
    title: 'Total proyecto',
    icon: 'i-lucide-circle-dollar-sign',
    value: formatUsd(totalProyecto.value),
    tone: 'warning'
  },
  {
    title: 'Total pagado',
    icon: 'i-lucide-wallet',
    value: formatUsd(totalPagadoConAnticipo.value),
    tone: 'success'
  },
  {
    title: 'Saldo pendiente',
    icon: 'i-lucide-scale',
    value: formatUsd(Math.max(0, saldoTotalCuentas.value)),
    tone: saldoTotalCuentas.value > 0 ? 'warning' : 'success'
  }
])

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
  nuevoArticulo.marca = ''
  nuevoArticulo.bultos = ''
  nuevoArticulo.numeroRack = ''
  nuevoArticulo.archivo = null
  nuevoArticulo.estatusInicial = 'Laredo'
  modalArticulo.value = true
}

async function guardarArticulo() {
  const nombre = nuevoArticulo.nombre.trim()
  const folio = nuevoArticulo.sg.trim()
  const sg = folio ? `SG/${folio}` : ''
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

  let imagenUrl = ''
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
        description: 'Se guardó sin imagen.',
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
      estatus: est,
      marca: nuevoArticulo.marca.trim() || undefined,
      bultos: nuevoArticulo.bultos ? Number(nuevoArticulo.bultos) : undefined,
      numeroRack: nuevoArticulo.numeroRack.trim() || undefined
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

async function onCompradoPorTradeChange(value: boolean) {
  const p = proyecto.value
  if (!p) {
    return
  }
  compradoPorTrade.value = value
  try {
    await store.actualizarProyecto(p.idProyecto, { compradoPorTrade: value })
  } catch {
    compradoPorTrade.value = !value
    toast.add({ title: 'No se pudo actualizar', color: 'error', icon: 'i-lucide-alert-circle' })
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

async function guardarPago(payload: { montoUsd: number; fecha: string; referencia?: string; formaPago?: string }) {
  try {
    await store.registrarPago(proyecto.value!.idProyecto, payload)
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
    description: formatUsd(payload.montoUsd),
    color: 'success',
    icon: 'i-lucide-banknote'
  })
}

// ─── Editar artículo ──────────────────────────────────────────────────────────
const modalEditarArticulo = ref(false)
const savingEdicion = ref(false)
const articuloEditando = ref<ArticuloProyecto | null>(null)
const editArticulo = reactive({
  sg: '', descripcion: '', marca: '', bultos: '', numeroRack: '',
  cantidad: '', precio: '', estatus: 'Laredo' as ArticuloEstatusLogistica,
  referencia: ''
})

function abrirEdicion(a: ArticuloProyecto) {
  articuloEditando.value = a
  editArticulo.sg = a.sg
  editArticulo.descripcion = a.descripcion
  editArticulo.marca = a.marca ?? ''
  editArticulo.bultos = a.bultos != null ? String(a.bultos) : ''
  editArticulo.numeroRack = a.numeroRack ?? ''
  editArticulo.cantidad = String(a.cantidadTotal)
  editArticulo.precio = String(a.precioUnitario)
  editArticulo.estatus = a.estatus
  editArticulo.referencia = a.referenciaLogistica ?? ''
  modalEditarArticulo.value = true
}

async function guardarEdicionArticulo() {
  if (!articuloEditando.value) return
  const sg = editArticulo.sg.trim()
  const descripcion = editArticulo.descripcion.trim()
  if (!sg || !descripcion) {
    toast.add({ title: 'SG y descripción son requeridos', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingEdicion.value = true
  try {
    await store.editarArticulo(proyecto.value!.idProyecto, articuloEditando.value.id, {
      sg,
      descripcion,
      marca: editArticulo.marca.trim() || null,
      bultos: editArticulo.bultos ? Number(editArticulo.bultos) : null,
      numeroRack: editArticulo.numeroRack.trim() || null,
      cantidadTotal: Math.max(1, Number(editArticulo.cantidad) || 1),
      precioUnitario: Math.max(0, Number(editArticulo.precio) || 0),
      estatus: editArticulo.estatus,
      referenciaLogistica: editArticulo.referencia.trim() || null
    })
    modalEditarArticulo.value = false
    toast.add({ title: 'Artículo actualizado', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: 'No se guardaron los cambios', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEdicion.value = false
  }
}

// ─── Eliminar artículo ────────────────────────────────────────────────────────
const modalEliminarArticulo = ref(false)
const articuloAEliminar = ref<ArticuloProyecto | null>(null)
const comentarioEliminacion = ref('')
const savingEliminacion = ref(false)

function abrirEliminar(a: ArticuloProyecto) {
  articuloAEliminar.value = a
  comentarioEliminacion.value = ''
  modalEliminarArticulo.value = true
}

async function confirmarEliminacion() {
  if (!articuloAEliminar.value) return
  const comentario = comentarioEliminacion.value.trim()
  if (!comentario) {
    toast.add({ title: 'Debes indicar el motivo de eliminación', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingEliminacion.value = true
  try {
    await store.eliminarArticulo(proyecto.value!.idProyecto, articuloAEliminar.value.id, comentario)
    modalEliminarArticulo.value = false
    toast.add({ title: 'Artículo eliminado', color: 'success', icon: 'i-lucide-trash-2' })
  } catch {
    toast.add({ title: 'No se pudo eliminar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEliminacion.value = false
  }
}

// ─── Nueva entrega desde el proyecto ─────────────────────────────────────────
const modalNuevaEntrega = ref(false)
const savingEntrega = ref(false)
const pasoEntrega = ref<1 | 2>(1)

const nuevaEntrega = reactive({
  descripcion: '',
  fechaProgramada: '',
  chofer: '',
  origen: '',
  notas: ''
})

const destinosEntrega = ref<{ cliente: string; direccion: string }[]>([])

function agregarDestinoEntrega() {
  destinosEntrega.value.push({ cliente: '', direccion: '' })
}
function quitarDestinoEntrega(i: number) {
  if (destinosEntrega.value.length > 1) destinosEntrega.value.splice(i, 1)
}

interface ArticuloEntregaSeleccion {
  idArticulo: string
  descripcion: string
  sg: string
  cantidad: number
  cantidadDisponible: number
}

const seleccionadosEntrega = ref<ArticuloEntregaSeleccion[]>([])

function toggleArticuloEntrega(a: ArticuloEntregaSeleccion) {
  const idx = seleccionadosEntrega.value.findIndex(s => s.idArticulo === a.idArticulo)
  if (idx !== -1) {
    seleccionadosEntrega.value.splice(idx, 1)
  } else {
    seleccionadosEntrega.value.push({ ...a, cantidad: a.cantidadDisponible })
  }
}

function isSeleccionadoEntrega(idArticulo: string) {
  return seleccionadosEntrega.value.some(s => s.idArticulo === idArticulo)
}

function abrirNuevaEntrega() {
  const p = proyecto.value
  if (!p) return
  Object.assign(nuevaEntrega, {
    descripcion: p.nombre,
    fechaProgramada: '',
    chofer: '',
    origen: '',
    notas: ''
  })
  destinosEntrega.value = [{ cliente: p.cliente, direccion: '' }]
  seleccionadosEntrega.value = []
  pasoEntrega.value = 1
  modalNuevaEntrega.value = true
}

async function guardarEntregaProyecto() {
  const desc = nuevaEntrega.descripcion.trim()
  if (!desc) {
    toast.add({ title: 'Indica una descripción de la entrega', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  const destsValidos = destinosEntrega.value.filter(d => d.cliente.trim())
  if (!destsValidos.length) {
    toast.add({ title: 'Agrega al menos un destino con cliente', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  if (!seleccionadosEntrega.value.length) {
    toast.add({ title: 'Selecciona al menos un artículo', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingEntrega.value = true
  try {
    const entrega = await entregasStore.crearEntrega({
      descripcion: desc,
      fechaProgramada: nuevaEntrega.fechaProgramada || null,
      chofer: nuevaEntrega.chofer,
      origen: nuevaEntrega.origen,
      notas: nuevaEntrega.notas,
      destinos: destsValidos,
      articulos: seleccionadosEntrega.value.map(s => ({
        idProyecto: proyecto.value!.idProyecto,
        idArticulo: s.idArticulo,
        descripcion: s.descripcion,
        sg: s.sg,
        cliente: proyecto.value!.cliente,
        cantidad: Math.max(1, s.cantidad)
      }))
    })
    modalNuevaEntrega.value = false
    toast.add({ title: 'Entrega creada', description: entrega.descripcion, color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/entregas/${encodeURIComponent(entrega.id)}`)
  } catch {
    toast.add({ title: 'No se pudo crear la entrega', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEntrega.value = false
  }
}

function imprimirPDF() {
  if (import.meta.client) window.print()
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
      <!-- ─── SECCIÓN SOLO IMPRESIÓN ──────────────────────────────────────────── -->
      <div class="hidden print:block text-black">
        <PrintHeader
          :titulo="`Resumen de Proyecto — ${proyecto?.nombre ?? ''}`"
          :subtitulo="`Cliente: ${proyecto?.cliente ?? ''} · ID: ${proyecto?.idProyecto ?? ''} · Fecha: ${new Date().toLocaleDateString('es-MX')}`"
        />

        <!-- Meta -->
        <table class="w-full mb-4 text-[11px]" style="border-collapse:collapse">
          <tr>
            <td style="padding:3px 8px;border:1px solid #e5e7eb" class="text-gray-500">Folio propuesta</td>
            <td style="padding:3px 8px;border:1px solid #e5e7eb" class="font-semibold">{{ proyecto?.folioPropuesta || '—' }}</td>
            <td style="padding:3px 8px;border:1px solid #e5e7eb" class="text-gray-500">Artículos</td>
            <td style="padding:3px 8px;border:1px solid #e5e7eb" class="font-semibold">{{ d.articulos.length }}</td>
          </tr>
        </table>

        <!-- Tabla artículos -->
        <h3 class="font-bold text-[11px] mb-1.5 mt-5 uppercase tracking-wide text-gray-600">Artículos del proyecto</h3>
        <table class="w-full text-[10px]" style="border-collapse:collapse">
          <thead>
            <tr style="background:#f3f4f6;print-color-adjust:exact">
              <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left">SG</th>
              <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left">Descripción</th>
              <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left">Marca</th>
              <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center">Cant.</th>
              <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right">P. unit.</th>
              <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right">Total</th>
              <th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center">Estatus</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in d.articulos" :key="a.id">
              <td style="padding:3px 6px;border:1px solid #e5e7eb" class="font-mono">{{ a.sg }}</td>
              <td style="padding:3px 6px;border:1px solid #e5e7eb">{{ a.descripcion }}</td>
              <td style="padding:3px 6px;border:1px solid #e5e7eb">{{ a.marca || '—' }}</td>
              <td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:center">{{ a.cantidadTotal }}</td>
              <td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(a.precioUnitario) }}</td>
              <td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(a.precioUnitario * a.cantidadTotal) }}</td>
              <td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:center">{{ a.estatus }}</td>
            </tr>
            <tr style="background:#f9fafb;print-color-adjust:exact;font-weight:600">
              <td colspan="5" style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right">Subtotal artículos</td>
              <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(valorTotalProyecto) }}</td>
              <td style="border:1px solid #e5e7eb" />
            </tr>
          </tbody>
        </table>

        <!-- Resumen financiero -->
        <h3 class="font-bold text-[11px] mb-1.5 mt-6 uppercase tracking-wide text-gray-600">Resumen financiero</h3>
        <table class="w-full text-[10px]" style="border-collapse:collapse">
          <tbody>
            <tr v-if="d.fleteUsd">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">Flete internacional</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(d.fleteUsd) }}</td>
            </tr>
            <tr v-if="d.aduanaUsd">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">Despacho aduanal</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(d.aduanaUsd) }}</td>
            </tr>
            <tr v-if="d.tarifaImportacionPct">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">% Importación y pago de impuestos aduanales ({{ d.tarifaImportacionPct }}%)</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(valorTotalProyecto * d.tarifaImportacionPct / 100) }}</td>
            </tr>
            <tr v-if="d.igiPct">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">IGI ({{ d.igiPct }}%)</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(valorTotalProyecto * d.igiPct / 100) }}</td>
            </tr>
            <tr v-if="d.comercializadoraPct">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">Comercializadora ({{ d.comercializadoraPct }}%)</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(valorTotalProyecto * d.comercializadoraPct / 100) }}</td>
            </tr>
            <tr v-if="d.maniobrasUsd">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">Maniobras</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(d.maniobrasUsd) }}</td>
            </tr>
            <tr v-if="d.fleteLaredoMtyUsd">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">Flete Laredo → Monterrey</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(d.fleteLaredoMtyUsd) }}</td>
            </tr>
            <tr v-if="d.fleteNacionalUsd">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">Flete nacional</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(d.fleteNacionalUsd) }}</td>
            </tr>
            <tr v-for="fe in d.fletesExtra" :key="fe.label">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">{{ fe.label }}</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(fe.montoUsd) }}</td>
            </tr>
            <tr v-for="oc in d.otrosExtras" :key="oc.id">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">{{ oc.descripcion }}</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(oc.montoUsd) }}</td>
            </tr>
            <tr v-if="d.wireTransferUsd">
              <td style="padding:3px 8px;border:1px solid #e5e7eb">Wire transfer</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right" class="font-mono">{{ formatUsd(d.wireTransferUsd) }}</td>
            </tr>
            <!-- Total proyecto -->
            <tr style="background:#f3f4f6;print-color-adjust:exact;font-weight:700">
              <td style="padding:5px 8px;border:1px solid #d1d5db">Total del proyecto con cargos</td>
              <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:right" class="font-mono">{{ formatUsd(totalProyecto) }}</td>
            </tr>
            <!-- Pagos -->
            <tr>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;color:#64748b">Anticipo inicial ({{ proyecto?.createdAt }})</td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right;color:#16a34a" class="font-mono">−{{ formatUsd(d.anticipoUsd) }}</td>
            </tr>
            <tr v-for="pg in d.pagos" :key="pg.id">
              <td style="padding:3px 8px;border:1px solid #e5e7eb;color:#64748b">
                Pago — {{ pg.fecha }}<span v-if="pg.formaPago"> ({{ pg.formaPago }})</span><span v-if="pg.referencia"> · {{ pg.referencia }}</span>
              </td>
              <td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:right;color:#16a34a" class="font-mono">−{{ formatUsd(pg.montoUsd) }}</td>
            </tr>
            <!-- Saldo -->
            <tr style="background:#fef2f2;print-color-adjust:exact;font-weight:700;font-size:11px">
              <td style="padding:6px 8px;border:2px solid #fca5a5">Saldo pendiente</td>
              <td style="padding:6px 8px;border:2px solid #fca5a5;text-align:right;color:#dc2626" class="font-mono">{{ formatUsd(saldoTotalCuentas) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- ──────────────────────────────────────────────────────────────────────── -->

      <div class="print:hidden">
        <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
            <UButton
              label="Nueva entrega"
              icon="i-lucide-truck"
              color="teal"
              variant="outline"
              @click="abrirNuevaEntrega"
            />
            <UButton
              label="Manifiestos"
              icon="i-lucide-file-check-2"
              color="neutral"
              variant="outline"
              :to="`/logistica/manifiestos?proyecto=${encodeURIComponent(proyecto.nombre)}`"
            />
            <UButton
              label="Imprimir PDF"
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
              @click="imprimirPDF"
            />
          </div>
        </div>

        <ProjectStats class="mb-4 lg:shrink-0" :items="statsItems" />

        <div class="mb-2 flex items-center justify-between gap-2 lg:shrink-0">
          <h2 class="text-lg font-semibold text-highlighted">
            Artículos
          </h2>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-1.5">
              <UIcon name="i-lucide-shopping-cart" class="size-4 text-muted shrink-0" />
              <span class="text-sm text-muted whitespace-nowrap">Trade compra los productos</span>
              <div class="flex gap-1 ml-1">
                <UButton
                  label="Sí"
                  size="xs"
                  :color="compradoPorTrade ? 'primary' : 'neutral'"
                  :variant="compradoPorTrade ? 'solid' : 'outline'"
                  @click="onCompradoPorTradeChange(true)"
                />
                <UButton
                  label="No"
                  size="xs"
                  :color="!compradoPorTrade ? 'error' : 'neutral'"
                  :variant="!compradoPorTrade ? 'solid' : 'outline'"
                  @click="onCompradoPorTradeChange(false)"
                />
              </div>
            </div>
            <span class="text-sm text-muted">{{ d.articulos.length }} líneas</span>
          </div>
        </div>

        <div class="max-lg:hidden overflow-y-auto" style="max-height: min(50vh, 520px)">
          <ProjectItemTable
            :articulos="d.articulos"
            @estatus-change="onEstatusArticulo"
            @referencia-change="onReferenciaArticulo"
            @editar="abrirEdicion"
            @eliminar="abrirEliminar"
          />
        </div>
        <ProjectItemInventoryMobile
          :articulos="d.articulos"
          @estatus-change="onEstatusArticulo"
          @referencia-change="onReferenciaArticulo"
        />

        <div class="mt-4 space-y-4">
        <!-- Otros cargos -->
        <div class="rounded-lg border border-default bg-elevated/30 p-4">
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
          :articulos="d.articulos"
          :tarifa-importacion-pct="d.tarifaImportacionPct"
          :despacho-aduanal-usd="d.aduanaUsd"
          :flete-logistica-usd="d.fleteUsd"
          :anticipo-usd="d.anticipoUsd"
          :total-pagos-usd="totalPagado"
          :pagos="d.pagos"
          :maniobras-usd="d.maniobrasUsd"
          :flete-laredo-mty-usd="d.fleteLaredoMtyUsd"
          :flete-nacional-usd="d.fleteNacionalUsd"
          :fletes-extra="d.fletesExtra"
          :otros-extras="d.otrosExtras"
          :comprado-por-trade="compradoPorTrade"
          :igi-pct="d.igiPct"
          :wire-transfer-usd="d.wireTransferUsd"
          :comercializadora-pct="d.comercializadoraPct"
          @ver-pagos="modalPagos = true"
        />
        </div>
      </div><!-- /print:hidden -->

      <ProjectPaymentModal v-model:open="modalPago" @submit="guardarPago" />

      <ProjectPagosModal
        v-if="proyecto"
        v-model:open="modalPagos"
        :id-proyecto="proyecto.idProyecto"
        :pagos="d.pagos"
        :anticipo-usd="d.anticipoUsd"
        :created-at="proyecto.createdAt"
      />

      <!-- Modal: Editar artículo -->
      <UModal v-model:open="modalEditarArticulo" title="Editar artículo" description="Modifica los datos del artículo.">
        <template #body>
          <div class="max-h-[min(80vh,600px)] space-y-4 overflow-y-auto pr-1">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="SG / Código" name="e-sg" required>
                <UInput v-model="editArticulo.sg" placeholder="SG-00000" class="w-full font-mono" />
              </UFormField>
              <UFormField label="Marca" name="e-marca">
                <UInput v-model="editArticulo.marca" placeholder="Ej. Herman Miller" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Descripción" name="e-desc" required>
              <UInput v-model="editArticulo.descripcion" placeholder="Nombre del producto" class="w-full" />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Cantidad" name="e-cant">
                <UInput v-model="editArticulo.cantidad" type="number" min="1" step="1" class="w-full" />
              </UFormField>
              <UFormField label="Bultos" name="e-bultos">
                <UInput v-model="editArticulo.bultos" type="number" min="0" step="1" placeholder="0" class="w-full" />
              </UFormField>
              <UFormField label="No. Rack" name="e-rack">
                <UInput v-model="editArticulo.numeroRack" placeholder="R-01" class="w-full font-mono" />
              </UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Precio unitario (USD)" name="e-precio">
                <UInput v-model="editArticulo.precio" type="number" min="0" step="0.01" icon="i-lucide-dollar-sign" class="w-full" />
              </UFormField>
              <UFormField label="Estatus" name="e-estatus">
                <USelect v-model="editArticulo.estatus" :items="estatusItems" value-key="value" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Referencia logística" name="e-ref">
              <UInput v-model="editArticulo.referencia" placeholder="SG/17958Y64" class="w-full font-mono" />
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="savingEdicion" @click="modalEditarArticulo = false" />
              <UButton label="Guardar cambios" icon="i-lucide-check" color="primary" :loading="savingEdicion" @click="guardarEdicionArticulo" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Modal: Eliminar artículo -->
      <UModal v-model:open="modalEliminarArticulo" title="Eliminar artículo" description="El artículo se moverá a Productos eliminados y puede restaurarse.">
        <template #body>
          <div class="space-y-4">
            <div v-if="articuloAEliminar" class="rounded-lg border border-default bg-elevated/30 p-3 text-sm">
              <p class="font-medium text-highlighted">{{ articuloAEliminar.descripcion }}</p>
              <p class="text-xs text-muted font-mono">{{ articuloAEliminar.sg }}</p>
            </div>
            <UFormField label="Motivo de eliminación" name="motivo" required description="Este comentario quedará registrado en el historial.">
              <UInput v-model="comentarioEliminacion" placeholder="Ej. Duplicado, producto incorrecto, devolución…" class="w-full" />
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="savingEliminacion" @click="modalEliminarArticulo = false" />
              <UButton label="Eliminar" icon="i-lucide-trash-2" color="error" :loading="savingEliminacion" @click="confirmarEliminacion" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Modal: Nueva entrega desde el proyecto -->
      <UModal
        v-model:open="modalNuevaEntrega"
        title="Nueva entrega"
        :description="pasoEntrega === 1 ? 'Datos generales y destinos' : 'Seleccionar artículos del proyecto'"
      >
        <template #body>
          <div class="max-h-[min(80vh,680px)] overflow-y-auto pr-1 space-y-4">
            <!-- Paso 1: Datos generales + destinos -->
            <template v-if="pasoEntrega === 1">
              <UFormField label="Descripción / referencia" name="ent-desc" required>
                <UInput v-model="nuevaEntrega.descripcion" icon="i-lucide-truck" class="w-full" />
              </UFormField>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Chofer" name="ent-chofer">
                  <UInput v-model="nuevaEntrega.chofer" placeholder="Nombre del chofer" icon="i-lucide-user" class="w-full" />
                </UFormField>
                <UFormField label="Fecha programada" name="ent-fecha">
                  <UInput v-model="nuevaEntrega.fechaProgramada" type="date" class="w-full" />
                </UFormField>
              </div>
              <UFormField label="Origen / almacén" name="ent-origen">
                <UInput v-model="nuevaEntrega.origen" placeholder="Bodega Laredo, Almacén MTY…" class="w-full" />
              </UFormField>

              <USeparator />
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">Destinos</p>
              <div class="space-y-2">
                <div v-for="(d, i) in destinosEntrega" :key="i" class="flex gap-2 items-end">
                  <UFormField label="Cliente" :name="`ent-dest-cli-${i}`" class="flex-1" required>
                    <UInput v-model="d.cliente" placeholder="Nombre del cliente" class="w-full" />
                  </UFormField>
                  <UFormField label="Dirección" :name="`ent-dest-dir-${i}`" class="flex-1">
                    <UInput v-model="d.direccion" placeholder="Dirección de entrega" class="w-full" />
                  </UFormField>
                  <UButton
                    v-if="destinosEntrega.length > 1"
                    icon="i-lucide-x"
                    color="error"
                    variant="ghost"
                    square
                    @click="quitarDestinoEntrega(i)"
                  />
                </div>
                <UButton label="Agregar destino" icon="i-lucide-plus" color="neutral" variant="ghost" size="sm" @click="agregarDestinoEntrega" />
              </div>

              <UFormField label="Notas" name="ent-notas">
                <UInput v-model="nuevaEntrega.notas" placeholder="Observaciones del viaje" class="w-full" />
              </UFormField>

              <div class="flex justify-end gap-2 pt-2">
                <UButton label="Cancelar" color="neutral" variant="subtle" @click="modalNuevaEntrega = false" />
                <UButton label="Continuar → Artículos" icon="i-lucide-arrow-right" color="primary" @click="pasoEntrega = 2" />
              </div>
            </template>

            <!-- Paso 2: Selección de artículos del proyecto -->
            <template v-else>
              <div class="flex items-center gap-2">
                <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" square @click="pasoEntrega = 1" />
                <p class="text-sm text-muted flex-1">{{ seleccionadosEntrega.length }} artículo(s) seleccionado(s)</p>
              </div>

              <div class="space-y-1 max-h-80 overflow-y-auto">
                <div
                  v-for="a in d.articulos"
                  :key="a.id"
                  class="flex items-center gap-3 rounded-md border border-default/60 px-3 py-2 cursor-pointer transition-colors"
                  :class="isSeleccionadoEntrega(a.id) ? 'border-primary/40 bg-primary/5' : 'hover:bg-elevated/40'"
                  @click="toggleArticuloEntrega({ idArticulo: a.id, descripcion: a.descripcion, sg: a.sg, cantidad: a.cantidadTotal, cantidadDisponible: a.cantidadTotal })"
                >
                  <UCheckbox :model-value="isSeleccionadoEntrega(a.id)" @update:model-value="toggleArticuloEntrega({ idArticulo: a.id, descripcion: a.descripcion, sg: a.sg, cantidad: a.cantidadTotal, cantidadDisponible: a.cantidadTotal })" />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-highlighted text-sm truncate">{{ a.descripcion }}</p>
                    <p class="text-xs text-muted font-mono">{{ a.sg }} · {{ a.cantidadTotal }} pzas · {{ a.estatus }}</p>
                  </div>
                  <div v-if="isSeleccionadoEntrega(a.id)" class="shrink-0" @click.stop>
                    <UInput
                      :model-value="seleccionadosEntrega.find(s => s.idArticulo === a.id)?.cantidad ?? a.cantidadTotal"
                      @update:model-value="(v) => { const s = seleccionadosEntrega.find(x => x.idArticulo === a.id); if (s) s.cantidad = Math.max(1, Number(v)) }"
                      type="number"
                      min="1"
                      :max="a.cantidadTotal"
                      size="sm"
                      class="w-20"
                    />
                  </div>
                </div>
                <div v-if="!d.articulos.length" class="py-8 text-center text-sm text-muted">
                  Este proyecto no tiene artículos cargados.
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="savingEntrega" @click="modalNuevaEntrega = false" />
                <UButton
                  label="Crear entrega"
                  icon="i-lucide-check"
                  color="primary"
                  :loading="savingEntrega"
                  :disabled="savingEntrega || !seleccionadosEntrega.length"
                  @click="guardarEntregaProyecto"
                />
              </div>
            </template>
          </div>
        </template>
      </UModal>

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
                placeholder="12345"
                class="w-full font-mono"
              >
                <template #leading>
                  <span class="select-none font-mono text-sm text-muted">SG/</span>
                </template>
              </UInput>
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
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Marca" name="marca">
                <UInput
                  v-model="nuevoArticulo.marca"
                  placeholder="Ej. Herman Miller"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Bultos" name="bultos">
                <UInput
                  v-model="nuevoArticulo.bultos"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="No. Rack" name="rack">
                <UInput
                  v-model="nuevoArticulo.numeroRack"
                  placeholder="Ej. R-01"
                  class="w-full font-mono"
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

<style>
@media print {
  /* Ocultar navegación y UI interactiva */
  [data-slot="sidebar"],
  [data-slot="sidebar-header"],
  [data-slot="sidebar-footer"],
  [data-slot="navbar"],
  [data-slot="panel-header"],
  .print\:hidden { display: none !important; }

  /* Remover restricciones de overflow en contenedores del dashboard */
  html, body,
  [data-slot="panel"],
  [data-slot="panel-body"],
  [data-slot="group"] {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* El div con max-height de artículos no debe recortar en print */
  .overflow-y-auto {
    overflow: visible !important;
    max-height: none !important;
  }

  body { background: white !important; color: black !important; }

  @page {
    margin: 18mm 14mm;
    size: A4 portrait;
  }
}
</style>
