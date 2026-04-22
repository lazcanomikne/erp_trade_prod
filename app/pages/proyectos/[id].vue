<script setup lang="ts">
import type {
  ArticuloEstatusLogistica,
  ArticuloProyecto,
  ProyectoEstatus
} from '~/types'
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import {
  saldoPorCobrarZambranoUsd,
  valorDevengadoNetoZambranoUsd,
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

const proyectoRef = store.getProyectoById(id)

if (!proyectoRef) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Proyecto no encontrado'
  })
}

const proyecto = proyectoRef
const d = store.detalle(proyecto.idProyecto)

const modalArticulo = ref(false)
const modalPago = ref(false)

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
  if (!d.articulos.length) {
    return proyecto.valorTotalUsd
  }
  return valorTotalProyectoDesdeArticulos(d.articulos)
})

const totalPagado = computed(() =>
  d.pagos.reduce((s, p) => s + p.montoUsd, 0)
)

const valorDevengadoCuentas = computed(() =>
  valorDevengadoNetoZambranoUsd(
    d.articulos,
    d.tarifaImportacionPct,
    d.aduanaUsd,
    d.fleteUsd,
    d.anticipoUsd,
    totalPagado.value
  )
)

const saldoTotalCuentas = computed(() =>
  saldoPorCobrarZambranoUsd(
    d.articulos,
    d.tarifaImportacionPct,
    d.aduanaUsd,
    d.fleteUsd,
    d.anticipoUsd,
    totalPagado.value
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
    await store.patchArticuloEstatus(proyecto.idProyecto, articulo.id, value)
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
    await store.agregarArticulo(proyecto.idProyecto, {
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
  }

  toast.add({
    title: 'Artículo añadido',
    description: `${sg} — ${nombre}`,
    color: 'success',
    icon: 'i-lucide-package-plus'
  })
  modalArticulo.value = false
}

async function guardarPago(m: number) {
  try {
    await store.registrarPago(proyecto.idProyecto, m)
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
  <UDashboardPanel :id="`proyecto-${proyecto.idProyecto}`">
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
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-muted">
            <span class="font-medium text-highlighted">{{ proyecto.cliente }}</span>
            · {{ proyecto.idProyecto }}
            <span v-if="proyecto.folioPropuesta" class="text-muted"> · Folio {{ proyecto.folioPropuesta }}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
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

      <ProjectStats class="mb-8" :items="statsItems" />

      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="text-lg font-semibold text-highlighted">
          Artículos
        </h2>
        <span class="text-sm text-muted">{{ d.articulos.length }} líneas</span>
      </div>

      <div class="hidden min-w-0 overflow-x-auto lg:block">
        <ItemTable
          :articulos="d.articulos"
          @estatus-change="onEstatusArticulo"
        />
      </div>
      <ItemInventoryMobile
        :articulos="d.articulos"
        @estatus-change="onEstatusArticulo"
      />

      <ProjectResumenCuentas
        class="mt-6"
        :articulos="d.articulos"
        :tarifa-importacion-pct="d.tarifaImportacionPct"
        :despacho-aduanal-usd="d.aduanaUsd"
        :flete-logistica-usd="d.fleteUsd"
        :anticipo-usd="d.anticipoUsd"
        :total-pagos-usd="totalPagado"
      />

      <PaymentModal v-model:open="modalPago" @submit="guardarPago" />

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
                @click="modalArticulo = false"
              />
              <UButton
                label="Guardar artículo"
                color="primary"
                icon="i-lucide-check"
                @click="guardarArticulo"
              />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
