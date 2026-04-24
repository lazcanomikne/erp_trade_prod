<script setup lang="ts">
import type { ArticuloProyecto } from '~/types'
import { generarDescripcionGenerica } from '~/utils/descripcionGenerica'

type FilaLogistica = {
  idProyecto: string
  nombreProyecto: string
  cliente: string
  articulo: ArticuloProyecto
  rowKey: string
}

const toast = useToast()
const store = useInventarioStore()

// ─── Datos base ───────────────────────────────────────────────────────────────
const filas = computed<FilaLogistica[]>(() => {
  const out: FilaLogistica[] = []
  for (const p of store.listaProyectos()) {
    const d = store.detalle(p.idProyecto)
    for (const a of d.articulos) {
      if (a.estatus === 'Laredo') {
        out.push({
          idProyecto: p.idProyecto,
          nombreProyecto: p.nombre,
          cliente: p.cliente,
          articulo: a,
          rowKey: `${p.idProyecto}::${a.id}`
        })
      }
    }
  }
  return out
})

// ─── Estado editable por fila ─────────────────────────────────────────────────
type Edicion = { desc: string; qty: number; precio: number }
const ediciones = reactive(new Map<string, Edicion>())

watch(filas, (nuevas) => {
  for (const f of nuevas) {
    if (!ediciones.has(f.rowKey)) {
      ediciones.set(f.rowKey, {
        desc: generarDescripcionGenerica(f.articulo.descripcion),
        qty: f.articulo.cantidadTotal,
        precio: parseFloat((f.articulo.precioUnitario * 0.2).toFixed(2))
      })
    }
  }
}, { immediate: true })

function ed(key: string): Edicion {
  return ediciones.get(key) ?? { desc: '', qty: 0, precio: 0 }
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
const busqueda = ref('')
const filtroProy = ref('')
const filtroCliente = ref('')
const soloSeleccionados = ref(false)

const proyectosOpciones = computed(() => {
  const set = new Set(filas.value.map(f => f.idProyecto))
  return [...set].map(id => {
    const f = filas.value.find(x => x.idProyecto === id)!
    return { label: f.nombreProyecto, value: id }
  })
})

const clientesOpciones = computed(() => {
  const set = new Set(filas.value.map(f => f.cliente))
  return [...set].map(c => ({ label: c, value: c }))
})

const seleccion = ref(new Set<string>())

const filasFiltradas = computed(() => {
  const q = busqueda.value.toLowerCase()
  return filas.value.filter(f => {
    if (soloSeleccionados.value && !seleccion.value.has(f.rowKey)) return false
    if (filtroProy.value && f.idProyecto !== filtroProy.value) return false
    if (filtroCliente.value && f.cliente !== filtroCliente.value) return false
    if (q) {
      const edF = ed(f.rowKey)
      const haystack = [
        f.nombreProyecto, f.cliente, f.articulo.sg,
        f.articulo.descripcion, edF.desc
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
})

const todosSeleccionados = computed(
  () => filasFiltradas.value.length > 0 && filasFiltradas.value.every(f => seleccion.value.has(f.rowKey))
)

function toggleRow(key: string, v: boolean) {
  const s = new Set(seleccion.value)
  if (v) s.add(key); else s.delete(key)
  seleccion.value = s
}

function toggleTodos(v: boolean) {
  const s = new Set(seleccion.value)
  if (v) { filasFiltradas.value.forEach(f => s.add(f.rowKey)) }
  else { filasFiltradas.value.forEach(f => s.delete(f.rowKey)) }
  seleccion.value = s
}

function limpiarFiltros() {
  busqueda.value = ''
  filtroProy.value = ''
  filtroCliente.value = ''
  soloSeleccionados.value = false
}

// ─── Generar manifiesto ───────────────────────────────────────────────────────
const modalGenerar = ref(false)
const observaciones = ref('')
const generando = ref(false)

const filasSeleccionadas = computed(() =>
  filas.value.filter(f => seleccion.value.has(f.rowKey))
)

async function generarCorte() {
  if (!filasSeleccionadas.value.length) {
    toast.add({ title: 'Selecciona artículos', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  generando.value = true
  try {
    const lineas = filasSeleccionadas.value.map(f => {
      const e = ed(f.rowKey)
      return {
        idArticulo: f.articulo.id,
        idProyecto: f.idProyecto,
        sg: f.articulo.sg,
        descripcionOriginal: f.articulo.descripcion,
        descripcionGenerica: e.desc,
        cantidadCorte: e.qty,
        precioOriginal: f.articulo.precioUnitario,
        precioCorte: e.precio
      }
    })
    const result = await $fetch<{ id: string; folio: number }>('/api/erp/manifiestos', {
      method: 'POST',
      body: { lineas, observaciones: observaciones.value.trim() || undefined }
    })
    await store.refreshFromApi()
    seleccion.value = new Set()
    modalGenerar.value = false
    toast.add({
      title: `Manifiesto MF-${String(result.folio).padStart(4, '0')} generado`,
      description: `${lineas.length} artículo(s) pasaron a En Aduana.`,
      color: 'success',
      icon: 'i-lucide-file-check-2'
    })
    await navigateTo(`/logistica/manifiestos/${result.id}`)
  } catch {
    toast.add({ title: 'Error al generar el manifiesto', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    generando.value = false
  }
}

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
</script>

<template>
  <UDashboardPanel id="logistica">
    <template #header>
      <UDashboardNavbar title="Cortes Laredo → Aduana">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Generar corte de importación"
            icon="i-lucide-file-check-2"
            color="primary"
            :disabled="!seleccion.size"
            @click="modalGenerar = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Descripción + acceso a no identificados -->
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p class="max-w-2xl text-sm text-muted">
          Artículos en Laredo pendientes de corte. Edita descripción, cantidad y precio de declaración, selecciona los que envías y genera el manifiesto.
        </p>
        <UButton
          to="/logistica/arribos-no-identificados"
          label="Arribos no identificados"
          icon="i-heroicons-question-mark-circle"
          color="neutral"
          variant="outline"
          class="shrink-0"
        />
      </div>

      <!-- Barra de filtros -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <UInput
          v-model="busqueda"
          placeholder="Buscar proyecto, cliente, SG, descripción…"
          icon="i-lucide-search"
          class="w-64"
        />
        <USelect
          v-model="filtroProy"
          :items="[{ label: 'Todos los proyectos', value: '' }, ...proyectosOpciones]"
          class="w-52"
        />
        <USelect
          v-model="filtroCliente"
          :items="[{ label: 'Todos los clientes', value: '' }, ...clientesOpciones]"
          class="w-44"
        />
        <USwitch v-model="soloSeleccionados" label="Solo seleccionados" size="sm" />
        <UButton
          v-if="busqueda || filtroProy || filtroCliente || soloSeleccionados"
          label="Limpiar"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="limpiarFiltros"
        />
        <span class="ml-auto text-sm text-muted">
          {{ seleccion.size }} seleccionado(s) · {{ filasFiltradas.length }} visible(s)
        </span>
      </div>

      <!-- Estado vacío -->
      <div
        v-if="!filas.length"
        class="rounded-lg border border-dashed border-default px-4 py-12 text-center text-muted"
      >
        No hay artículos en Laredo en ningún proyecto.
      </div>

      <!-- Tabla editable -->
      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/50">
            <tr>
              <th class="w-10 border-b border-default px-3 py-2">
                <UCheckbox
                  :model-value="todosSeleccionados"
                  @update:model-value="v => toggleTodos(!!v)"
                />
              </th>
              <th class="border-b border-default px-3 py-2 text-left text-xs font-medium text-muted">
                Proyecto / Cliente
              </th>
              <th class="border-b border-default px-3 py-2 text-left text-xs font-medium text-muted">
                SG
              </th>
              <th class="border-b border-default px-3 py-2 text-left text-xs font-medium text-muted">
                Descripción de declaración
              </th>
              <th class="w-24 border-b border-default px-3 py-2 text-center text-xs font-medium text-muted">
                Cantidad
              </th>
              <th class="w-40 border-b border-default px-3 py-2 text-right text-xs font-medium text-muted">
                Precio corte
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="f in filasFiltradas"
              :key="f.rowKey"
              class="border-b border-default/60 transition-colors last:border-b-0"
              :class="seleccion.has(f.rowKey) ? 'bg-primary/5' : 'hover:bg-elevated/40'"
            >
              <!-- Checkbox -->
              <td class="px-3 py-2">
                <UCheckbox
                  :model-value="seleccion.has(f.rowKey)"
                  @update:model-value="v => toggleRow(f.rowKey, !!v)"
                />
              </td>

              <!-- Proyecto / Cliente -->
              <td class="px-3 py-2">
                <p class="font-medium text-highlighted">
                  {{ f.nombreProyecto }}
                </p>
                <p class="text-xs text-muted">
                  {{ f.cliente }}
                </p>
              </td>

              <!-- SG -->
              <td class="px-3 py-2 font-mono text-xs">
                {{ f.articulo.sg || '—' }}
              </td>

              <!-- Descripción editable -->
              <td class="px-3 py-2">
                <p class="mb-1 text-xs text-muted line-through">
                  {{ f.articulo.descripcion }}
                </p>
                <input
                  v-model="ed(f.rowKey).desc"
                  class="w-full min-w-[180px] rounded border border-default bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  placeholder="Descripción genérica"
                />
              </td>

              <!-- Cantidad editable -->
              <td class="px-3 py-2 text-center">
                <input
                  v-model.number="ed(f.rowKey).qty"
                  type="number"
                  min="1"
                  class="w-16 rounded border border-default bg-background px-2 py-1 text-center text-sm tabular-nums focus:border-primary focus:outline-none"
                />
              </td>

              <!-- Precio editable (original pequeño arriba, nuevo grande) -->
              <td class="px-3 py-2 text-right">
                <p class="text-xs text-muted line-through">
                  {{ formatUsd(f.articulo.precioUnitario) }}
                </p>
                <input
                  v-model.number="ed(f.rowKey).precio"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-28 rounded border border-default bg-background px-2 py-1 text-right text-sm font-semibold tabular-nums focus:border-primary focus:outline-none"
                />
              </td>
            </tr>

            <tr v-if="filasFiltradas.length === 0 && filas.length > 0">
              <td colspan="6" class="px-4 py-8 text-center text-muted">
                Ningún artículo coincide con los filtros.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal: generar corte -->
      <UModal
        v-model:open="modalGenerar"
        title="Generar corte de importación"
        :ui="{ width: 'sm:max-w-md' }"
      >
        <template #body>
          <div class="space-y-4">
            <p class="text-sm text-muted">
              Se generará un manifiesto con <strong>{{ filasSeleccionadas.length }}</strong> artículo(s).
              Los artículos pasarán a estatus <strong>En Aduana</strong>.
            </p>
            <UFormField label="Observaciones (opcional)">
              <UTextarea
                v-model="observaciones"
                placeholder="Número de camión, conductor, notas..."
                :rows="3"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" @click="modalGenerar = false" />
              <UButton
                label="Generar manifiesto"
                color="primary"
                icon="i-lucide-file-check-2"
                :loading="generando"
                @click="generarCorte"
              />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
