<script setup lang="ts">
import type { ArticuloEstatusLogistica, ArticuloProyecto } from '~/types'
import { subtotalLineaUsd, yaImportadoLineaUsd } from '~/utils/proyectoCalculos'

const props = defineProps<{
  articulos: ArticuloProyecto[]
}>()

const emit = defineEmits<{
  'estatus-change': [articulo: ArticuloProyecto, value: ArticuloEstatusLogistica]
  'referencia-change': [articulo: ArticuloProyecto, value: string]
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
</script>

<template>
  <div class="w-full min-w-0 overflow-x-auto rounded-lg border border-default">
    <table class="w-full min-w-[880px] table-fixed border-separate border-spacing-0 text-sm">
      <thead>
        <tr class="[&>th]:border-y [&>th]:border-default [&>th]:bg-elevated/50 [&>th]:py-2 [&>th:first-child]:rounded-tl-lg [&>th:first-child]:border-l [&>th:last-child]:rounded-tr-lg [&>th:last-child]:border-r">
          <th class="w-[7%] px-2 text-start font-medium">
            SG
          </th>
          <th class="w-[11%] px-2 text-start font-medium">
            Ref. logística
          </th>
          <th class="w-[4%] px-1" />
          <th class="w-[22%] px-2 text-start font-medium">
            Descripción
          </th>
          <th class="w-[9%] px-2 text-start font-medium">
            Cantidad
          </th>
          <th class="w-[10%] px-2 text-end font-medium">
            Precio unit.
          </th>
          <th class="w-[11%] px-2 text-end font-medium">
            Subtotal USD
          </th>
          <th class="w-[11%] px-2 text-end font-medium">
            Ya importado
          </th>
          <th class="w-[15%] px-2 text-start font-medium">
            Estatus
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!props.articulos.length">
          <td colspan="9" class="py-12 text-center text-sm text-muted border-b border-default">
            <div class="flex flex-col items-center gap-2">
              <UIcon name="i-lucide-package-open" class="size-8 text-muted/50" />
              <span>No hay artículos en este proyecto.</span>
              <span class="text-xs">Usa el botón "Añadir artículo" para agregar el primero.</span>
            </div>
          </td>
        </tr>
        <tr
          v-for="a in props.articulos"
          :key="rowKey(a)"
          class="border-b border-default [&>td]:align-middle [&>td]:py-2 [&>td]:px-2 last:[&>td]:border-b-0"
        >
          <td class="font-mono text-xs">
            {{ a.sg }}
          </td>
          <td class="min-w-[8.5rem]" @click.stop>
            <UInput
              :model-value="a.referenciaLogistica ?? ''"
              placeholder="SG/17958Y64"
              size="sm"
              class="w-full font-mono text-xs"
              @change="(e: Event) => emit('referencia-change', a, (e.target as HTMLInputElement).value)"
            />
          </td>
          <td class="px-1">
            <img
              :src="a.imagenUrl"
              :alt="a.descripcion"
              class="size-11 rounded-md object-cover ring ring-default bg-elevated"
            >
          </td>
          <td class="max-w-[min(280px,40vw)] truncate text-highlighted">
            {{ a.descripcion }}
          </td>
          <td class="tabular-nums">
            <span class="font-medium text-highlighted">{{ a.cantidadRecibida }}</span><span class="text-muted"> / {{ a.cantidadTotal }}</span>
          </td>
          <td class="text-end tabular-nums">
            {{ formatUsd(a.precioUnitario) }}
          </td>
          <td class="text-end tabular-nums font-medium">
            {{ formatUsd(subtotalLineaUsd(a)) }}
          </td>
          <td class="text-end tabular-nums font-medium">
            {{ formatUsd(yaImportadoLineaUsd(a)) }}
          </td>
          <td class="min-w-[9.5rem]" @click.stop>
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
        </tr>
      </tbody>
    </table>
  </div>
</template>
