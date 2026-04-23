<script setup lang="ts">
import type { ArticuloInventarioLibre, ArticuloProyecto, ArticuloEstatusLogistica } from '~/types'

const store = useInventarioStore()
const toast = useToast()

try {
  await store.refreshFromApi()
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos del ERP.' })
}

const articulosLibres = ref<ArticuloInventarioLibre[]>([])

async function cargarLibres() {
  try {
    articulosLibres.value = await $fetch<ArticuloInventarioLibre[]>('/api/erp/inventario')
  } catch {
    articulosLibres.value = []
  }
}
await cargarLibres()

interface ArticuloFila {
  id: string
  fuente: 'proyecto' | 'libre'
  proyecto?: string
  idProyecto?: string
  sg: string
  descripcion: string
  imagenUrl: string
  marca?: string
  bultos?: number
  numeroRack?: string
  cantidad: number
  precio: number
  estatus: ArticuloEstatusLogistica
  referencia?: string
}

const articulosProyecto = computed<ArticuloFila[]>(() => {
  const filas: ArticuloFila[] = []
  for (const p of store.listaProyectos()) {
    const det = store.detalle(p.idProyecto)
    for (const a of det.articulos) {
      filas.push({
        id: a.id,
        fuente: 'proyecto',
        proyecto: p.nombre,
        idProyecto: p.idProyecto,
        sg: a.sg,
        descripcion: a.descripcion,
        imagenUrl: a.imagenUrl,
        marca: a.marca,
        bultos: a.bultos,
        numeroRack: a.numeroRack,
        cantidad: a.cantidadTotal,
        precio: a.precioUnitario,
        estatus: a.estatus,
        referencia: a.referenciaLogistica
      })
    }
  }
  return filas
})

const articulosLibresFila = computed<ArticuloFila[]>(() =>
  articulosLibres.value.map(a => ({
    id: a.id,
    fuente: 'libre' as const,
    sg: a.sg,
    descripcion: a.descripcion,
    imagenUrl: a.imagenUrl,
    marca: a.marca,
    bultos: a.bultos,
    numeroRack: a.numeroRack,
    cantidad: a.cantidadTotal,
    precio: a.precioUnitario,
    estatus: a.estatus,
    referencia: a.referenciaLogistica
  }))
)

const busqueda = ref('')
const filtroEstatus = ref<ArticuloEstatusLogistica | ''>('')
const filtroFuente = ref<'todos' | 'proyecto' | 'libre'>('todos')

const todos = computed(() => [...articulosProyecto.value, ...articulosLibresFila.value])

const filtrados = computed(() => {
  let lista = todos.value
  if (filtroFuente.value !== 'todos') lista = lista.filter(a => a.fuente === filtroFuente.value)
  if (filtroEstatus.value) lista = lista.filter(a => a.estatus === filtroEstatus.value)
  const q = busqueda.value.trim().toLowerCase()
  if (q) lista = lista.filter(a =>
    a.sg.toLowerCase().includes(q) ||
    a.descripcion.toLowerCase().includes(q) ||
    (a.marca ?? '').toLowerCase().includes(q) ||
    (a.proyecto ?? '').toLowerCase().includes(q) ||
    (a.referencia ?? '').toLowerCase().includes(q) ||
    (a.numeroRack ?? '').toLowerCase().includes(q)
  )
  return lista
})

const estatusOptions = [
  { label: 'Todos los estatus', value: '' },
  { label: 'Laredo', value: 'Laredo' },
  { label: 'En Aduana', value: 'En Aduana' },
  { label: 'Monterrey', value: 'Monterrey' }
]

const fuenteOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Proyectos', value: 'proyecto' },
  { label: 'Inventario libre', value: 'libre' }
]

function estatusColor(e: ArticuloEstatusLogistica) {
  if (e === 'Monterrey') return 'success'
  if (e === 'En Aduana') return 'warning'
  return 'neutral'
}

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v)
}

// ─── Agregar artículo libre ──────────────────────────────────────────────────
const modalNuevo = ref(false)
const saving = ref(false)
const nuevoLibre = reactive({
  sg: '', descripcion: '', marca: '', bultos: '', numeroRack: '',
  cantidad: '1', precio: '0', estatus: 'Monterrey' as ArticuloEstatusLogistica,
  referencia: '', notas: '', archivo: null as File | null
})

const estatusSelectItems = [
  { label: 'Laredo', value: 'Laredo' },
  { label: 'En Aduana', value: 'En Aduana' },
  { label: 'Monterrey', value: 'Monterrey' }
]

function abrirNuevo() {
  Object.assign(nuevoLibre, {
    sg: '', descripcion: '', marca: '', bultos: '', numeroRack: '',
    cantidad: '1', precio: '0', estatus: 'Monterrey',
    referencia: '', notas: '', archivo: null
  })
  modalNuevo.value = true
}

async function guardarLibre() {
  if (!nuevoLibre.sg.trim() || !nuevoLibre.descripcion.trim()) {
    toast.add({ title: 'SG y descripción son requeridos', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  saving.value = true
  let imagenUrl = `https://picsum.photos/seed/${encodeURIComponent(nuevoLibre.sg)}/96/96`
  if (nuevoLibre.archivo) {
    try {
      const fd = new FormData()
      fd.append('file', nuevoLibre.archivo)
      const up = await $fetch<{ url: string }>('/api/articulos/upload', { method: 'POST', body: fd })
      imagenUrl = up.url
    } catch { /* usa placeholder */ }
  }
  try {
    await $fetch('/api/erp/inventario', {
      method: 'POST',
      body: {
        sg: nuevoLibre.sg, descripcion: nuevoLibre.descripcion, imagenUrl,
        marca: nuevoLibre.marca || undefined,
        bultos: nuevoLibre.bultos ? Number(nuevoLibre.bultos) : undefined,
        numeroRack: nuevoLibre.numeroRack || undefined,
        cantidadTotal: Math.max(1, Number(nuevoLibre.cantidad) || 1),
        precioUnitario: Number(nuevoLibre.precio) || 0,
        estatus: nuevoLibre.estatus,
        referenciaLogistica: nuevoLibre.referencia || undefined,
        notas: nuevoLibre.notas || undefined
      }
    })
    await cargarLibres()
    modalNuevo.value = false
    toast.add({ title: 'Artículo agregado al inventario', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: 'No se pudo guardar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="inventario">
    <template #header>
      <UDashboardNavbar title="Inventario">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Agregar artículo"
            icon="i-lucide-plus"
            color="primary"
            @click="abrirNuevo"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col">
        <!-- Filtros -->
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:shrink-0">
          <div class="flex flex-wrap gap-2">
            <UInput
              v-model="busqueda"
              icon="i-lucide-search"
              placeholder="Buscar SG, descripción, marca…"
              class="w-full max-w-xs"
            />
            <USelect
              v-model="filtroEstatus"
              :items="estatusOptions"
              value-key="value"
              class="w-36"
            />
            <USelect
              v-model="filtroFuente"
              :items="fuenteOptions"
              value-key="value"
              class="w-36"
            />
          </div>
          <p class="shrink-0 text-sm text-muted">{{ filtrados.length }} artículo(s)</p>
        </div>

        <!-- Tabla -->
        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div class="w-full min-w-0 overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th class="w-16 px-3 py-2.5 text-start font-medium border-y border-l border-default bg-elevated/50 rounded-tl-lg">
                    Img
                  </th>
                  <th class="px-3 py-2.5 text-start font-medium border-y border-default bg-elevated/50">
                    Descripción
                  </th>
                  <th class="w-28 px-3 py-2.5 text-start font-medium border-y border-default bg-elevated/50">
                    Marca
                  </th>
                  <th class="w-20 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">
                    Bultos
                  </th>
                  <th class="w-20 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">
                    Rack
                  </th>
                  <th class="w-20 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">
                    Cant.
                  </th>
                  <th class="w-24 px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">
                    Precio
                  </th>
                  <th class="w-24 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">
                    Estatus
                  </th>
                  <th class="w-32 px-3 py-2.5 text-start font-medium border-y border-r border-default bg-elevated/50 rounded-tr-lg">
                    Proyecto
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filtrados.length">
                  <td colspan="9" class="py-16 text-center text-sm text-muted">
                    <div class="flex flex-col items-center gap-2">
                      <UIcon name="i-lucide-box" class="size-8 text-muted/50" />
                      <span>Sin artículos que coincidan.</span>
                    </div>
                  </td>
                </tr>
                <tr
                  v-for="a in filtrados"
                  :key="a.id"
                  class="transition-colors hover:bg-elevated/40"
                >
                  <td class="px-3 py-2 align-middle border-b border-default">
                    <img
                      :src="a.imagenUrl"
                      :alt="a.descripcion"
                      class="size-10 rounded object-cover"
                      loading="lazy"
                    />
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default">
                    <p class="font-medium text-highlighted truncate max-w-64">{{ a.descripcion }}</p>
                    <p class="text-xs text-muted font-mono">{{ a.sg }}</p>
                    <p v-if="a.referencia" class="text-xs text-muted truncate">{{ a.referencia }}</p>
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-sm text-muted">
                    {{ a.marca || '—' }}
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center text-sm">
                    {{ a.bultos ?? '—' }}
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center text-sm font-mono">
                    {{ a.numeroRack || '—' }}
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center font-medium">
                    {{ a.cantidad }}
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-end tabular-nums text-sm text-muted">
                    {{ formatUsd(a.precio) }}
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center">
                    <UBadge :color="estatusColor(a.estatus)" variant="subtle" size="sm">
                      {{ a.estatus }}
                    </UBadge>
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default">
                    <template v-if="a.fuente === 'proyecto'">
                      <NuxtLink
                        :to="`/proyectos/${encodeURIComponent(a.idProyecto!)}`"
                        class="text-xs text-primary hover:underline truncate block max-w-32"
                      >
                        {{ a.proyecto }}
                      </NuxtLink>
                    </template>
                    <template v-else>
                      <UBadge color="neutral" variant="soft" size="sm">Libre</UBadge>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal nuevo artículo libre -->
      <UModal v-model:open="modalNuevo" title="Agregar artículo al inventario" description="Artículo no asociado a ningún proyecto.">
        <template #body>
          <div class="max-h-[min(76vh,600px)] space-y-4 overflow-y-auto pr-1">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="SG / Código" name="sg" required>
                <UInput v-model="nuevoLibre.sg" placeholder="SG-00000" class="w-full font-mono" />
              </UFormField>
              <UFormField label="Marca" name="marca">
                <UInput v-model="nuevoLibre.marca" placeholder="Ej. Herman Miller" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Descripción" name="desc" required>
              <UInput v-model="nuevoLibre.descripcion" placeholder="Nombre del producto" icon="i-lucide-text" class="w-full" />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Cantidad" name="cant">
                <UInput v-model="nuevoLibre.cantidad" type="number" min="1" step="1" class="w-full" />
              </UFormField>
              <UFormField label="Bultos" name="bultos">
                <UInput v-model="nuevoLibre.bultos" type="number" min="0" step="1" placeholder="0" class="w-full" />
              </UFormField>
              <UFormField label="No. Rack" name="rack">
                <UInput v-model="nuevoLibre.numeroRack" placeholder="R-01" class="w-full font-mono" />
              </UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Precio unitario (USD)" name="precio">
                <UInput v-model="nuevoLibre.precio" type="number" min="0" step="0.01" icon="i-lucide-dollar-sign" class="w-full" />
              </UFormField>
              <UFormField label="Estatus" name="estatus">
                <USelect v-model="nuevoLibre.estatus" :items="estatusSelectItems" value-key="value" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Referencia logística" name="ref">
              <UInput v-model="nuevoLibre.referencia" placeholder="SG/00000" class="w-full font-mono" />
            </UFormField>
            <UFormField label="Notas" name="notas">
              <UInput v-model="nuevoLibre.notas" placeholder="Observaciones adicionales" class="w-full" />
            </UFormField>
            <UFormField label="Imagen" name="img" description="Sube una foto del producto.">
              <UFileUpload
                v-model="nuevoLibre.archivo"
                accept="image/*"
                :interactive="true"
                variant="area"
                icon="i-lucide-image-plus"
                label="Arrastra o elige imagen"
                description="PNG, JPG o WEBP"
              />
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="saving" @click="modalNuevo = false" />
              <UButton label="Guardar" color="primary" icon="i-lucide-check" :loading="saving" :disabled="saving" @click="guardarLibre" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
