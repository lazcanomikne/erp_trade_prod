<script setup lang="ts">
import type { ArticuloEstatusLogistica, ArticuloProyecto } from '~/types'
import { subtotalLineaUsd, yaImportadoLineaUsd } from '~/utils/proyectoCalculos'

const props = defineProps<{
  articulos: ArticuloProyecto[]
}>()

const emit = defineEmits<{
  'estatus-change': [articulo: ArticuloProyecto, value: ArticuloEstatusLogistica]
  'referencia-change': [articulo: ArticuloProyecto, value: string]
  'comprado-change': [articulo: ArticuloProyecto, value: boolean]
  'comprado-change-bulk': [value: boolean]
  'editar': [articulo: ArticuloProyecto]
  'eliminar': [articulo: ArticuloProyecto]
}>()

const estatusItems = [
  { label: 'Laredo', value: 'Laredo' },
  { label: 'En Aduana', value: 'En Aduana' },
  { label: 'Monterrey', value: 'Monterrey' }
]

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function rowKey(a: ArticuloProyecto) {
  return a.id || a.sg
}

const allComprado = computed(() =>
  props.articulos.length > 0 && props.articulos.every(a => a.compradoPorTrade !== false)
)
const someComprado = computed(() => props.articulos.some(a => a.compradoPorTrade !== false))

const headerCheckbox = ref<HTMLInputElement | null>(null)

watchEffect(() => {
  if (headerCheckbox.value) {
    headerCheckbox.value.indeterminate = someComprado.value && !allComprado.value
  }
})

function toggleAll() {
  emit('comprado-change-bulk', !allComprado.value)
}
</script>

<template>
  <div class="w-full min-w-0 overflow-x-auto rounded-lg border border-default">
    <table class="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr>
          <!-- Comprado por Trade -->
          <th class="w-[3%] px-2 py-2 text-center border-y border-l border-default bg-elevated/50 rounded-tl-lg" title="Comprado por Trade">
            <input
              ref="headerCheckbox"
              type="checkbox"
              :checked="allComprado"
              class="size-4 cursor-pointer accent-primary"
              title="Seleccionar / deseleccionar todos"
              @change="toggleAll"
            >
          </th>
          <th class="w-[7%] px-2 py-2 text-start font-medium border-y border-default bg-elevated/50">
            SG
          </th>
          <th class="w-[11%] px-2 py-2 text-start font-medium border-y border-default bg-elevated/50">
            Ref. logística
          </th>
          <th class="w-[4%] px-1 py-2 border-y border-default bg-elevated/50" />
          <th class="w-[21%] px-2 py-2 text-start font-medium border-y border-default bg-elevated/50">
            Descripción
          </th>
          <th class="w-[9%] px-2 py-2 text-start font-medium border-y border-default bg-elevated/50">
            Cantidad
          </th>
          <th class="w-[10%] px-2 py-2 text-end font-medium border-y border-default bg-elevated/50">
            Precio unit.
          </th>
          <th class="w-[11%] px-2 py-2 text-end font-medium border-y border-default bg-elevated/50">
            Subtotal USD
          </th>
          <th class="w-[11%] px-2 py-2 text-end font-medium border-y border-default bg-elevated/50">
            Ya importado
          </th>
          <th class="w-[15%] px-2 py-2 text-start font-medium border-y border-default bg-elevated/50">
            Estatus
          </th>
          <th class="w-[8%] px-2 py-2 text-center font-medium border-y border-r border-default bg-elevated/50 rounded-tr-lg" />
        </tr>
      </thead>
      <tbody>
        <tr v-if="!props.articulos.length">
          <td colspan="11" class="py-12 text-center text-sm text-muted">
            <div class="flex flex-col items-center gap-2">
              <UIcon name="i-lucide-package-open" class="size-8 text-muted/50" />
              <span>No hay artículos en este proyecto.</span>
              <span class="text-xs">Usa "Añadir artículo" para agregar el primero.</span>
            </div>
          </td>
        </tr>
        <tr
          v-for="a in props.articulos"
          :key="rowKey(a)"
          :class="a.compradoPorTrade === false ? 'opacity-50' : ''"
        >
          <!-- Checkbox comprado por Trade -->
          <td class="px-2 py-2 align-middle border-b border-default text-center" @click.stop>
            <input
              type="checkbox"
              :checked="a.compradoPorTrade !== false"
              class="size-4 cursor-pointer accent-primary"
              :title="a.compradoPorTrade !== false ? 'Comprado por Trade (click para excluir)' : 'No comprado por Trade (click para incluir)'"
              @change="emit('comprado-change', a, ($event.target as HTMLInputElement).checked)"
            >
          </td>
          <td class="px-2 py-2 align-middle border-b border-default font-mono text-xs">
            {{ a.sg }}
          </td>
          <td class="px-2 py-2 align-middle border-b border-default min-w-[8.5rem]" @click.stop>
            <UInput
              :model-value="a.referenciaLogistica ?? ''"
              placeholder="SG/17958Y64"
              size="sm"
              class="w-full font-mono text-xs"
              @change="(e: Event) => emit('referencia-change', a, (e.target as HTMLInputElement).value)"
            />
          </td>
          <td class="px-1 py-2 align-middle border-b border-default">
            <img
              v-if="a.imagenUrl"
              :src="a.imagenUrl"
              :alt="a.descripcion"
              class="size-11 rounded-md object-cover ring ring-default bg-elevated"
            >
            <div v-else class="flex size-11 items-center justify-center rounded-md bg-elevated ring ring-default">
              <UIcon name="i-lucide-package" class="size-5 text-muted" />
            </div>
          </td>
          <td class="px-2 py-2 align-middle border-b border-default max-w-[min(280px,40vw)] truncate text-highlighted">
            {{ a.descripcion }}
          </td>
          <td class="px-2 py-2 align-middle border-b border-default tabular-nums">
            <span class="font-medium text-highlighted">{{ a.cantidadRecibida }}</span><span class="text-muted"> / {{ a.cantidadTotal }}</span>
          </td>
          <td class="px-2 py-2 align-middle border-b border-default text-end tabular-nums">
            {{ formatUsd(a.precioUnitario) }}
          </td>
          <td class="px-2 py-2 align-middle border-b border-default text-end tabular-nums font-medium">
            <span :class="a.compradoPorTrade === false ? 'line-through text-muted' : ''">
              {{ formatUsd(subtotalLineaUsd(a)) }}
            </span>
          </td>
          <td class="px-2 py-2 align-middle border-b border-default text-end tabular-nums font-medium">
            {{ formatUsd(yaImportadoLineaUsd(a)) }}
          </td>
          <td class="px-2 py-2 align-middle border-b border-default min-w-[9.5rem]" @click.stop>
            <USelect
              :model-value="a.estatus"
              :items="estatusItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
              @update:model-value="(v: ArticuloEstatusLogistica) => emit('estatus-change', a, v)"
            />
          </td>
          <td class="px-2 py-2 align-middle border-b border-default text-center" @click.stop>
            <div class="flex items-center justify-center gap-1">
              <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" square @click="emit('editar', a)" />
              <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" square @click="emit('eliminar', a)" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
