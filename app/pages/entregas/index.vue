<script setup lang="ts">
import type { Entrega, EntregaEstatus, ArticuloProyecto } from '~/types'

const store = useInventarioStore()
const entregasStore = useEntregasStore()
const toast = useToast()

try {
  await Promise.all([store.refreshFromApi(), entregasStore.refreshFromApi()])
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos.' })
}

function estatusColor(e: EntregaEstatus) {
  if (e === 'Entregado') return 'success'
  if (e === 'En Ruta') return 'info'
  if (e === 'Parcial') return 'warning'
  return 'neutral'
}

const busqueda = ref('')
const filtradas = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return entregasStore.entregas
  return entregasStore.entregas.filter(e =>
    e.descripcion.toLowerCase().includes(q) ||
    e.chofer.toLowerCase().includes(q) ||
    e.destinos.some(d => d.cliente.toLowerCase().includes(q))
  )
})

// ─── Nueva entrega ────────────────────────────────────────────────────────────
const modalNuevo = ref(false)
const saving = ref(false)
const paso = ref<1 | 2>(1)

const nuevaEntrega = reactive({
  descripcion: '',
  fechaProgramada: '',
  chofer: '',
  origen: '',
  notas: ''
})

const destinos = ref<{ cliente: string; direccion: string }[]>([{ cliente: '', direccion: '' }])

function agregarDestino() { destinos.value.push({ cliente: '', direccion: '' }) }
function quitarDestino(i: number) { if (destinos.value.length > 1) destinos.value.splice(i, 1) }

interface ArticuloSeleccion {
  idProyecto: string
  idArticulo: string
  descripcion: string
  sg: string
  cliente: string
  cantidad: number
  cantidadDisponible: number
  checked: boolean
}

const articulosSeleccion = computed<ArticuloSeleccion[]>(() => {
  const filas: ArticuloSeleccion[] = []
  for (const p of store.listaProyectos()) {
    const det = store.detalle(p.idProyecto)
    for (const a of det.articulos) {
      filas.push({
        idProyecto: p.idProyecto,
        idArticulo: a.id,
        descripcion: a.descripcion,
        sg: a.sg,
        cliente: p.cliente,
        cantidad: 1,
        cantidadDisponible: a.cantidadTotal,
        checked: false
      })
    }
  }
  return filas
})

const seleccionados = ref<ArticuloSeleccion[]>([])

function toggleArticulo(a: ArticuloSeleccion) {
  const idx = seleccionados.value.findIndex(s => s.idArticulo === a.idArticulo && s.idProyecto === a.idProyecto)
  if (idx !== -1) {
    seleccionados.value.splice(idx, 1)
  } else {
    seleccionados.value.push({ ...a, cantidad: 1, checked: true })
  }
}

function isSeleccionado(a: ArticuloSeleccion) {
  return seleccionados.value.some(s => s.idArticulo === a.idArticulo && s.idProyecto === a.idProyecto)
}

const busquedaArticulos = ref('')
const articulosFiltrados = computed(() => {
  const q = busquedaArticulos.value.trim().toLowerCase()
  if (!q) return articulosSeleccion.value
  return articulosSeleccion.value.filter(a =>
    a.sg.toLowerCase().includes(q) ||
    a.descripcion.toLowerCase().includes(q) ||
    a.cliente.toLowerCase().includes(q)
  )
})

function abrirNuevo() {
  Object.assign(nuevaEntrega, { descripcion: '', fechaProgramada: '', chofer: '', origen: '', notas: '' })
  destinos.value = [{ cliente: '', direccion: '' }]
  seleccionados.value = []
  busquedaArticulos.value = ''
  paso.value = 1
  modalNuevo.value = true
}

async function guardarEntrega() {
  const desc = nuevaEntrega.descripcion.trim()
  if (!desc) {
    toast.add({ title: 'Indica una descripción de la entrega', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  const destsValidos = destinos.value.filter(d => d.cliente.trim())
  if (!destsValidos.length) {
    toast.add({ title: 'Agrega al menos un destino con cliente', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  if (!seleccionados.value.length) {
    toast.add({ title: 'Selecciona al menos un artículo', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  saving.value = true
  try {
    const entrega = await entregasStore.crearEntrega({
      descripcion: desc,
      fechaProgramada: nuevaEntrega.fechaProgramada || null,
      chofer: nuevaEntrega.chofer,
      origen: nuevaEntrega.origen,
      notas: nuevaEntrega.notas,
      destinos: destsValidos,
      articulos: seleccionados.value.map(s => ({
        idProyecto: s.idProyecto,
        idArticulo: s.idArticulo,
        descripcion: s.descripcion,
        sg: s.sg,
        cliente: s.cliente,
        cantidad: Math.max(1, s.cantidad)
      }))
    })
    modalNuevo.value = false
    toast.add({ title: 'Entrega creada', description: entrega.descripcion, color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/entregas/${encodeURIComponent(entrega.id)}`)
  } catch {
    toast.add({ title: 'No se pudo crear la entrega', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="entregas">
    <template #header>
      <UDashboardNavbar title="Entregas de mercancía">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="Nueva entrega" icon="i-lucide-plus" color="primary" @click="abrirNuevo" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col">
        <div class="mb-3 flex items-center justify-between gap-3 lg:shrink-0">
          <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar entrega, chofer, cliente…" class="w-full max-w-sm" />
          <p class="shrink-0 text-sm text-muted">{{ filtradas.length }} entrega(s)</p>
        </div>

        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div v-if="!filtradas.length" class="flex flex-col items-center justify-center py-24 text-muted gap-3">
            <UIcon name="i-lucide-truck" class="size-10 text-muted/40" />
            <p class="text-sm">Sin entregas registradas. Crea la primera.</p>
          </div>

          <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NuxtLink
              v-for="e in filtradas"
              :key="e.id"
              :to="`/entregas/${encodeURIComponent(e.id)}`"
              class="rounded-lg border border-default bg-elevated/20 p-4 transition-colors hover:bg-elevated/50 block"
            >
              <div class="flex items-start justify-between gap-2 mb-2">
                <p class="font-semibold text-highlighted truncate">{{ e.descripcion }}</p>
                <UBadge :color="estatusColor(e.estatus)" variant="subtle" size="sm" class="shrink-0">
                  {{ e.estatus }}
                </UBadge>
              </div>
              <div class="space-y-1 text-xs text-muted">
                <p v-if="e.chofer" class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-user" class="size-3" /> {{ e.chofer }}
                </p>
                <p v-if="e.fechaProgramada" class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-calendar" class="size-3" /> {{ e.fechaProgramada }}
                </p>
                <p class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-map-pin" class="size-3" />
                  {{ e.destinos.map(d => d.cliente).join(' · ') || 'Sin destinos' }}
                </p>
                <p class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-package" class="size-3" />
                  {{ e.articulos.length }} artículo(s) ·
                  {{ e.articulos.filter(a => a.entregado).length }} entregado(s)
                </p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Modal nueva entrega -->
      <UModal v-model:open="modalNuevo" title="Nueva entrega" :description="paso === 1 ? 'Datos generales y destinos' : 'Seleccionar artículos'">
        <template #body>
          <div class="max-h-[min(80vh,680px)] overflow-y-auto pr-1 space-y-4">
            <!-- Paso 1: Datos + destinos -->
            <template v-if="paso === 1">
              <UFormField label="Descripción / referencia" name="desc" required>
                <UInput v-model="nuevaEntrega.descripcion" placeholder="Ej. Entrega Mty Norte 2025-04" icon="i-lucide-truck" class="w-full" />
              </UFormField>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Chofer" name="chofer">
                  <UInput v-model="nuevaEntrega.chofer" placeholder="Nombre del chofer" icon="i-lucide-user" class="w-full" />
                </UFormField>
                <UFormField label="Fecha programada" name="fecha">
                  <UInput v-model="nuevaEntrega.fechaProgramada" type="date" class="w-full" />
                </UFormField>
              </div>
              <UFormField label="Origen / almacén" name="origen">
                <UInput v-model="nuevaEntrega.origen" placeholder="Bodega Laredo, Almacén MTY…" class="w-full" />
              </UFormField>

              <USeparator />
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">Destinos</p>
              <div class="space-y-2">
                <div v-for="(d, i) in destinos" :key="i" class="flex gap-2 items-end">
                  <UFormField label="Cliente" :name="`dest-cliente-${i}`" class="flex-1" required>
                    <UInput v-model="d.cliente" placeholder="Nombre del cliente" class="w-full" />
                  </UFormField>
                  <UFormField label="Dirección" :name="`dest-dir-${i}`" class="flex-1">
                    <UInput v-model="d.direccion" placeholder="Dirección de entrega" class="w-full" />
                  </UFormField>
                  <UButton
                    v-if="destinos.length > 1"
                    icon="i-lucide-x"
                    color="error"
                    variant="ghost"
                    square
                    @click="quitarDestino(i)"
                  />
                </div>
                <UButton label="Agregar destino" icon="i-lucide-plus" color="neutral" variant="ghost" size="sm" @click="agregarDestino" />
              </div>

              <UFormField label="Notas" name="notas">
                <UInput v-model="nuevaEntrega.notas" placeholder="Observaciones del viaje" class="w-full" />
              </UFormField>

              <div class="flex justify-end gap-2 pt-2">
                <UButton label="Cancelar" color="neutral" variant="subtle" @click="modalNuevo = false" />
                <UButton label="Continuar → Artículos" icon="i-lucide-arrow-right" color="primary" @click="paso = 2" />
              </div>
            </template>

            <!-- Paso 2: Selección de artículos -->
            <template v-else>
              <div class="flex items-center gap-2">
                <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" square @click="paso = 1" />
                <UInput v-model="busquedaArticulos" icon="i-lucide-search" placeholder="Buscar artículo…" class="flex-1" />
              </div>
              <p class="text-sm text-muted">
                {{ seleccionados.length }} artículo(s) seleccionado(s)
              </p>

              <div class="space-y-1 max-h-72 overflow-y-auto">
                <div
                  v-for="a in articulosFiltrados"
                  :key="`${a.idProyecto}-${a.idArticulo}`"
                  class="flex items-center gap-3 rounded-md border border-default/60 px-3 py-2 cursor-pointer transition-colors"
                  :class="isSeleccionado(a) ? 'border-primary/40 bg-primary/5' : 'hover:bg-elevated/40'"
                  @click="toggleArticulo(a)"
                >
                  <UCheckbox :model-value="isSeleccionado(a)" @update:model-value="toggleArticulo(a)" />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-highlighted text-sm truncate">{{ a.descripcion }}</p>
                    <p class="text-xs text-muted font-mono">{{ a.sg }} · {{ a.cliente }}</p>
                  </div>
                  <div v-if="isSeleccionado(a)" class="shrink-0">
                    <UInput
                      :model-value="seleccionados.find(s => s.idArticulo === a.idArticulo)?.cantidad ?? 1"
                      type="number"
                      min="1"
                      :max="a.cantidadDisponible"
                      size="sm"
                      class="w-20"
                      @update:model-value="(v) => { const s = seleccionados.find(x => x.idArticulo === a.idArticulo); if(s) s.cantidad = Math.max(1, Number(v)) }"
                      @click.stop
                    />
                  </div>
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="saving" @click="modalNuevo = false" />
                <UButton
                  label="Crear entrega"
                  icon="i-lucide-check"
                  color="primary"
                  :loading="saving"
                  :disabled="saving || !seleccionados.length"
                  @click="guardarEntrega"
                />
              </div>
            </template>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
