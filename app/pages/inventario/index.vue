<script setup lang="ts">
import type { ArticuloInventarioLibre, ArticuloProyecto, ArticuloEstatusLogistica } from '~/types'

const store = useInventarioStore()
const entregasStore = useEntregasStore()
const toast = useToast()

try {
  await Promise.all([store.refreshFromApi(), entregasStore.refreshFromApi()])
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

// ─── IDs de artículos entregados (desde entregas) ────────────────────────────
const entregadosIds = computed<Set<string>>(() => {
  const ids = new Set<string>()
  for (const e of entregasStore.entregas) {
    for (const a of e.articulos) {
      if (a.entregado) ids.add(a.idArticulo)
    }
  }
  return ids
})

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
  entregado: boolean
  articuloProyecto?: ArticuloProyecto
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
        referencia: a.referenciaLogistica,
        entregado: entregadosIds.value.has(a.id),
        articuloProyecto: a
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
    referencia: a.referenciaLogistica,
    entregado: entregadosIds.value.has(a.id)
  }))
)

// ─── Filtros ─────────────────────────────────────────────────────────────────
const busqueda = ref('')
const filtroEstatus = ref<ArticuloEstatusLogistica | ''>('')
const filtroFuente = ref<'todos' | 'proyecto' | 'libre'>('todos')
const filtroProyecto = ref('')
const filtroEntregado = ref<'todos' | 'pendiente' | 'entregado'>('todos')

const proyectosOptions = computed(() => {
  const opts = [{ label: 'Todos los proyectos', value: '' }]
  for (const p of store.listaProyectos()) {
    opts.push({ label: p.nombre, value: p.idProyecto })
  }
  return opts
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

const entregadoOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Entregados', value: 'entregado' }
]

const todos = computed(() => [...articulosProyecto.value, ...articulosLibresFila.value])

const filtrados = computed(() => {
  let lista = todos.value
  if (filtroFuente.value !== 'todos') lista = lista.filter(a => a.fuente === filtroFuente.value)
  if (filtroEstatus.value) lista = lista.filter(a => a.estatus === filtroEstatus.value)
  if (filtroProyecto.value) lista = lista.filter(a => a.idProyecto === filtroProyecto.value)
  if (filtroEntregado.value === 'entregado') lista = lista.filter(a => a.entregado)
  if (filtroEntregado.value === 'pendiente') lista = lista.filter(a => !a.entregado)
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

const estatusSelectItems = [
  { label: 'Laredo', value: 'Laredo' },
  { label: 'En Aduana', value: 'En Aduana' },
  { label: 'Monterrey', value: 'Monterrey' }
]

function estatusColor(e: ArticuloEstatusLogistica) {
  if (e === 'Monterrey') return 'success'
  if (e === 'En Aduana') return 'warning'
  return 'neutral'
}

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v)
}

// ─── Editar estatus inline ────────────────────────────────────────────────────
async function onEstatusChange(fila: ArticuloFila, estatus: ArticuloEstatusLogistica) {
  if (!fila.idProyecto) return
  try {
    await store.patchArticuloEstatus(fila.idProyecto, fila.id, estatus)
  } catch {
    toast.add({ title: 'No se pudo actualizar el estatus', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

// ─── Agregar artículo libre ───────────────────────────────────────────────────
const modalNuevo = ref(false)
const saving = ref(false)
const nuevoLibre = reactive({
  sg: '', descripcion: '', marca: '', bultos: '', numeroRack: '',
  cantidad: '1', precio: '0', estatus: 'Monterrey' as ArticuloEstatusLogistica,
  referencia: '', notas: '', archivo: null as File | null
})

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

// ─── Editar artículo ──────────────────────────────────────────────────────────
const modalEditar = ref(false)
const savingEdicion = ref(false)
const filaEditando = ref<ArticuloFila | null>(null)
const editForm = reactive({
  sg: '', descripcion: '', marca: '', bultos: '', numeroRack: '',
  cantidad: '', precio: '', estatus: 'Laredo' as ArticuloEstatusLogistica,
  referencia: ''
})

function abrirEdicion(fila: ArticuloFila) {
  filaEditando.value = fila
  editForm.sg = fila.sg
  editForm.descripcion = fila.descripcion
  editForm.marca = fila.marca ?? ''
  editForm.bultos = fila.bultos != null ? String(fila.bultos) : ''
  editForm.numeroRack = fila.numeroRack ?? ''
  editForm.cantidad = String(fila.cantidad)
  editForm.precio = String(fila.precio)
  editForm.estatus = fila.estatus
  editForm.referencia = fila.referencia ?? ''
  modalEditar.value = true
}

async function guardarEdicion() {
  const fila = filaEditando.value
  if (!fila || !fila.idProyecto) return
  const sg = editForm.sg.trim()
  const descripcion = editForm.descripcion.trim()
  if (!sg || !descripcion) {
    toast.add({ title: 'SG y descripción son requeridos', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingEdicion.value = true
  try {
    await store.editarArticulo(fila.idProyecto, fila.id, {
      sg,
      descripcion,
      marca: editForm.marca.trim() || null,
      bultos: editForm.bultos ? Number(editForm.bultos) : null,
      numeroRack: editForm.numeroRack.trim() || null,
      cantidadTotal: Math.max(1, Number(editForm.cantidad) || 1),
      precioUnitario: Math.max(0, Number(editForm.precio) || 0),
      estatus: editForm.estatus,
      referenciaLogistica: editForm.referencia.trim() || null
    })
    modalEditar.value = false
    toast.add({ title: 'Artículo actualizado', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: 'No se guardaron los cambios', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEdicion.value = false
  }
}

// ─── Eliminar artículo ────────────────────────────────────────────────────────
const modalEliminar = ref(false)
const savingEliminacion = ref(false)
const filaAEliminar = ref<ArticuloFila | null>(null)
const comentarioEliminacion = ref('')

function abrirEliminar(fila: ArticuloFila) {
  filaAEliminar.value = fila
  comentarioEliminacion.value = ''
  modalEliminar.value = true
}

async function confirmarEliminacion() {
  const fila = filaAEliminar.value
  if (!fila || !fila.idProyecto) return
  const comentario = comentarioEliminacion.value.trim()
  if (!comentario) {
    toast.add({ title: 'Debes indicar el motivo de eliminación', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingEliminacion.value = true
  try {
    await store.eliminarArticulo(fila.idProyecto, fila.id, comentario)
    modalEliminar.value = false
    toast.add({ title: 'Artículo eliminado', color: 'success', icon: 'i-lucide-trash-2' })
  } catch {
    toast.add({ title: 'No se pudo eliminar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEliminacion.value = false
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
        <div class="mb-3 flex flex-col gap-3 lg:shrink-0">
          <div class="flex flex-wrap gap-2 items-center">
            <UInput
              v-model="busqueda"
              icon="i-lucide-search"
              placeholder="Buscar SG, descripción, marca, rack…"
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
            <USelect
              v-model="filtroProyecto"
              :items="proyectosOptions"
              value-key="value"
              class="w-48"
            />
            <USelect
              v-model="filtroEntregado"
              :items="entregadoOptions"
              value-key="value"
              class="w-36"
            />
            <p class="ml-auto shrink-0 text-sm text-muted">{{ filtrados.length }} artículo(s)</p>
          </div>
        </div>

        <!-- Tabla -->
        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div class="w-full min-w-0 overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th class="w-16 px-3 py-2.5 text-start font-medium border-y border-l border-default bg-elevated/50 rounded-tl-lg">Img</th>
                  <th class="px-3 py-2.5 text-start font-medium border-y border-default bg-elevated/50">Descripción</th>
                  <th class="w-28 px-3 py-2.5 text-start font-medium border-y border-default bg-elevated/50">Marca</th>
                  <th class="w-16 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">Bultos</th>
                  <th class="w-20 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">Rack</th>
                  <th class="w-16 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">Cant.</th>
                  <th class="w-24 px-3 py-2.5 text-end font-medium border-y border-default bg-elevated/50">Precio</th>
                  <th class="w-36 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">Estatus</th>
                  <th class="w-20 px-3 py-2.5 text-center font-medium border-y border-default bg-elevated/50">Entregado</th>
                  <th class="w-32 px-3 py-2.5 text-start font-medium border-y border-default bg-elevated/50">Proyecto</th>
                  <th class="w-20 px-3 py-2.5 text-center font-medium border-y border-r border-default bg-elevated/50 rounded-tr-lg" />
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filtrados.length">
                  <td colspan="11" class="py-16 text-center text-sm text-muted">
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
                  :class="a.entregado ? 'bg-success/5' : ''"
                >
                  <td class="px-3 py-2 align-middle border-b border-default">
                    <img :src="a.imagenUrl" :alt="a.descripcion" class="size-10 rounded object-cover" loading="lazy" />
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default">
                    <p class="font-medium text-highlighted truncate max-w-64" :class="a.entregado ? 'line-through text-muted' : ''">{{ a.descripcion }}</p>
                    <p class="text-xs text-muted font-mono">{{ a.sg }}</p>
                    <p v-if="a.referencia" class="text-xs text-muted truncate">{{ a.referencia }}</p>
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-sm text-muted">{{ a.marca || '—' }}</td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center text-sm">{{ a.bultos ?? '—' }}</td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center text-sm font-mono">{{ a.numeroRack || '—' }}</td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center font-medium">{{ a.cantidad }}</td>
                  <td class="px-3 py-2 align-middle border-b border-default text-end tabular-nums text-sm text-muted">{{ formatUsd(a.precio) }}</td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center">
                    <template v-if="a.fuente === 'proyecto' && a.idProyecto">
                      <USelect
                        :model-value="a.estatus"
                        :items="estatusSelectItems"
                        value-key="value"
                        size="sm"
                        class="w-full"
                        @update:model-value="(v: ArticuloEstatusLogistica) => onEstatusChange(a, v)"
                      />
                    </template>
                    <template v-else>
                      <UBadge :color="estatusColor(a.estatus)" variant="subtle" size="sm">{{ a.estatus }}</UBadge>
                    </template>
                  </td>
                  <td class="px-3 py-2 align-middle border-b border-default text-center">
                    <UIcon
                      :name="a.entregado ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                      :class="a.entregado ? 'text-success size-5' : 'text-muted/40 size-5'"
                    />
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
                  <td class="px-3 py-2 align-middle border-b border-default text-center">
                    <template v-if="a.fuente === 'proyecto'">
                      <div class="flex items-center justify-center gap-1">
                        <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" square @click="abrirEdicion(a)" />
                        <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" square @click="abrirEliminar(a)" />
                      </div>
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

      <!-- Modal editar artículo -->
      <UModal v-model:open="modalEditar" title="Editar artículo" description="Modifica los datos del artículo de proyecto.">
        <template #body>
          <div class="max-h-[min(80vh,600px)] space-y-4 overflow-y-auto pr-1">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="SG / Código" name="e-sg" required>
                <UInput v-model="editForm.sg" placeholder="SG-00000" class="w-full font-mono" />
              </UFormField>
              <UFormField label="Marca" name="e-marca">
                <UInput v-model="editForm.marca" placeholder="Ej. Herman Miller" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Descripción" name="e-desc" required>
              <UInput v-model="editForm.descripcion" placeholder="Nombre del producto" class="w-full" />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Cantidad" name="e-cant">
                <UInput v-model="editForm.cantidad" type="number" min="1" step="1" class="w-full" />
              </UFormField>
              <UFormField label="Bultos" name="e-bultos">
                <UInput v-model="editForm.bultos" type="number" min="0" step="1" placeholder="0" class="w-full" />
              </UFormField>
              <UFormField label="No. Rack" name="e-rack">
                <UInput v-model="editForm.numeroRack" placeholder="R-01" class="w-full font-mono" />
              </UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Precio unitario (USD)" name="e-precio">
                <UInput v-model="editForm.precio" type="number" min="0" step="0.01" icon="i-lucide-dollar-sign" class="w-full" />
              </UFormField>
              <UFormField label="Estatus" name="e-estatus">
                <USelect v-model="editForm.estatus" :items="estatusSelectItems" value-key="value" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Referencia logística" name="e-ref">
              <UInput v-model="editForm.referencia" placeholder="SG/17958Y64" class="w-full font-mono" />
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="savingEdicion" @click="modalEditar = false" />
              <UButton label="Guardar cambios" icon="i-lucide-check" color="primary" :loading="savingEdicion" @click="guardarEdicion" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Modal eliminar artículo -->
      <UModal v-model:open="modalEliminar" title="Eliminar artículo" description="El artículo se moverá a Productos eliminados y puede restaurarse.">
        <template #body>
          <div class="space-y-4">
            <div v-if="filaAEliminar" class="rounded-lg border border-default bg-elevated/30 p-3 text-sm">
              <p class="font-medium text-highlighted">{{ filaAEliminar.descripcion }}</p>
              <p class="text-xs text-muted font-mono">{{ filaAEliminar.sg }}</p>
              <p v-if="filaAEliminar.proyecto" class="text-xs text-muted mt-1">{{ filaAEliminar.proyecto }}</p>
            </div>
            <UFormField label="Motivo de eliminación" name="motivo" required description="Este comentario quedará registrado en el historial.">
              <UInput v-model="comentarioEliminacion" placeholder="Ej. Duplicado, producto incorrecto, devolución…" class="w-full" />
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="savingEliminacion" @click="modalEliminar = false" />
              <UButton label="Eliminar" icon="i-lucide-trash-2" color="error" :loading="savingEliminacion" @click="confirmarEliminacion" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
