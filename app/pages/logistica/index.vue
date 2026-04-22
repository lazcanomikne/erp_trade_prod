<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ArticuloProyecto } from '~/types'

type FilaLogistica = {
  idProyecto: string
  nombreProyecto: string
  cliente: string
  articulo: ArticuloProyecto
  rowKey: string
}

const UCheckbox = resolveComponent('UCheckbox')
const toast = useToast()
const store = useInventarioStore()

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

const seleccion = ref<Set<string>>(new Set())

function toggleRow(key: string, checked: boolean) {
  const next = new Set(seleccion.value)
  if (checked) {
    next.add(key)
  } else {
    next.delete(key)
  }
  seleccion.value = next
}

function toggleTodos(checked: boolean) {
  if (checked) {
    seleccion.value = new Set(filas.value.map(f => f.rowKey))
  } else {
    seleccion.value = new Set()
  }
}

const todosSeleccionados = computed(
  () => filas.value.length > 0 && seleccion.value.size === filas.value.length
)

const modalCorte = ref(false)
const modalManifiesto = ref(false)

async function confirmarCorte() {
  const keys = [...seleccion.value]
  if (!keys.length) {
    toast.add({
      title: 'Selecciona artículos',
      description: 'Marca al menos una línea en Laredo.',
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  const payload: { idProyecto: string, idArticulo: string }[] = []
  for (const k of keys) {
    const [idProyecto, idArticulo] = k.split('::')
    if (idProyecto && idArticulo) {
      payload.push({ idProyecto, idArticulo })
    }
  }
  try {
    await store.bulkCorteLaredoAAduana(payload)
  } catch {
    toast.add({
      title: 'No se aplicó el corte',
      description: 'Revisa MySQL e intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  seleccion.value = new Set()
  modalCorte.value = false
  toast.add({
    title: 'Corte de importación aplicado',
    description: `${payload.length} artículo(s) pasaron a En Aduana.`,
    color: 'success',
    icon: 'i-lucide-check'
  })
}

const filasManifiesto = computed(() =>
  filas.value.filter(f => seleccion.value.has(f.rowKey))
)

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function imprimirManifiesto() {
  window.print()
}

const columns = computed<TableColumn<FilaLogistica>[]>(() => [
  {
    id: 'sel',
    header: () =>
      h(UCheckbox, {
        'modelValue': todosSeleccionados.value,
        'onUpdate:modelValue': (v: boolean) => toggleTodos(!!v),
        'aria-label': 'Seleccionar todos'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        'modelValue': seleccion.value.has(row.original.rowKey),
        'onUpdate:modelValue': (v: boolean) => toggleRow(row.original.rowKey, !!v),
        'aria-label': 'Seleccionar fila'
      })
  },
  {
    id: 'proyecto',
    header: 'Proyecto',
    cell: ({ row }) =>
      h('div', { class: 'min-w-[8rem]' }, [
        h('div', { class: 'font-medium text-highlighted' }, row.original.nombreProyecto),
        h('div', { class: 'text-xs text-muted font-mono' }, row.original.idProyecto)
      ])
  },
  {
    accessorKey: 'cliente',
    header: 'Cliente',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.cliente)
  },
  {
    id: 'sg',
    header: 'SG',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-sm' }, row.original.articulo.sg)
  },
  {
    id: 'desc',
    header: 'Descripción',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm max-w-[min(320px,45vw)] truncate block' },
        row.original.articulo.descripcion
      )
  },
  {
    id: 'qty',
    header: () => h('div', { class: 'text-end' }, 'Cant.'),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-end tabular-nums text-sm' },
        `${row.original.articulo.cantidadRecibida} / ${row.original.articulo.cantidadTotal}`
      )
  },
  {
    id: 'precio',
    header: () => h('div', { class: 'text-end' }, 'P. unit.'),
    cell: ({ row }) =>
      h('div', { class: 'text-end tabular-nums text-sm' }, formatUsd(row.original.articulo.precioUnitario))
  }
])
</script>

<template>
  <UDashboardPanel id="logistica">
    <template #header>
      <UDashboardNavbar title="Logística — Cortes (Laredo → Monterrey)">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              label="Manifiesto"
              icon="i-lucide-file-text"
              color="neutral"
              variant="outline"
              :disabled="!filasManifiesto.length"
              @click="modalManifiesto = true"
            />
            <UButton
              label="Corte de importación"
              icon="i-lucide-truck"
              color="primary"
              :disabled="!seleccion.size"
              @click="modalCorte = true"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between max-w-3xl">
        <p class="text-muted">
          Listado de todas las líneas en estatus <strong>Laredo</strong>. Selecciona lo que envías en el camión y confirma el corte; el estatus pasa a <strong>En Aduana</strong>. Usa el manifiesto para chofer o despacho.
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

      <div
        v-if="!filas.length"
        class="rounded-lg border border-dashed border-default px-4 py-12 text-center text-muted"
      >
        No hay artículos en Laredo en ningún proyecto.
      </div>

      <UTable
        v-else
        :data="filas"
        :columns="columns"
        :get-row-id="(row: FilaLogistica) => row.rowKey"
        class="shrink-0 print:hidden"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default align-middle',
          separator: 'h-0'
        }"
      />

      <UModal
        v-model:open="modalCorte"
        title="Confirmar corte de importación"
        description="Los artículos seleccionados dejarán Laredo y quedarán en aduana."
      >
        <template #body>
          <p class="text-sm text-muted">
            Se actualizarán <strong>{{ seleccion.size }}</strong> línea(s) a estatus <strong>En Aduana</strong>.
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="subtle"
              @click="modalCorte = false"
            />
            <UButton
              label="Confirmar corte"
              color="primary"
              icon="i-lucide-check"
              @click="confirmarCorte"
            />
          </div>
        </template>
      </UModal>

      <UModal
        v-model:open="modalManifiesto"
        title="Manifiesto — envío a Monterrey"
        :ui="{ content: 'w-full sm:max-w-2xl' }"
      >
        <template #body>
          <div class="manifiesto-print space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-3">
              <div>
                <p class="text-lg font-semibold text-highlighted">
                  Sergio Logística
                </p>
                <p class="text-sm text-muted">
                  Manifiesto de carga (referencia operativa)
                </p>
              </div>
              <p class="text-sm text-muted tabular-nums">
                {{ new Date().toLocaleString('es-MX') }}
              </p>
            </div>

            <div
              v-if="!filasManifiesto.length"
              class="text-sm text-muted"
            >
              Selecciona líneas en la tabla para armar el manifiesto.
            </div>

            <table
              v-else
              class="w-full text-sm border-collapse"
            >
              <thead>
                <tr class="border-b border-default text-left text-muted">
                  <th class="py-2 pr-2">
                    Proyecto
                  </th>
                  <th class="py-2 pr-2">
                    SG
                  </th>
                  <th class="py-2 pr-2">
                    Descripción
                  </th>
                  <th class="py-2 text-end">
                    Cant.
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="f in filasManifiesto"
                  :key="f.rowKey"
                  class="border-b border-default/60"
                >
                  <td class="py-2 pr-2 align-top">
                    {{ f.nombreProyecto }}
                  </td>
                  <td class="py-2 pr-2 align-top font-mono">
                    {{ f.articulo.sg }}
                  </td>
                  <td class="py-2 pr-2 align-top">
                    {{ f.articulo.descripcion }}
                  </td>
                  <td class="py-2 text-end tabular-nums align-top">
                    {{ f.articulo.cantidadTotal }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="flex justify-end gap-2 print:hidden">
              <UButton
                label="Cerrar"
                color="neutral"
                variant="subtle"
                @click="modalManifiesto = false"
              />
              <UButton
                label="Imprimir / PDF"
                icon="i-lucide-printer"
                color="primary"
                :disabled="!filasManifiesto.length"
                @click="imprimirManifiesto"
              />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
@media print {
  :global(body) {
    background: white !important;
  }
  .manifiesto-print {
    print-color-adjust: exact;
  }
}
</style>
