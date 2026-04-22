<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ArticuloEstatusLogistica, ArticuloProyecto } from '~/types'
import { subtotalLineaUsd, yaImportadoLineaUsd } from '~/utils/proyectoCalculos'

const USelect = resolveComponent('USelect')
const UInput = resolveComponent('UInput')

const props = defineProps<{
  articulos: ArticuloProyecto[]
}>()

/** Copia por fila para que TanStack reinicie bien tras hidratar / refrescar Pinia. */
const tableData = computed(() => props.articulos.map(a => ({ ...a })))

const tableKey = computed(() =>
  props.articulos.length
    ? props.articulos.map(a => a.id || a.sg).join('|')
    : 'empty'
)

const emit = defineEmits<{
  'estatus-change': [articulo: ArticuloProyecto, value: ArticuloEstatusLogistica]
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

const columns: TableColumn<ArticuloProyecto>[] = [
  {
    accessorKey: 'sg',
    header: 'SG',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-sm' }, row.original.sg)
  },
  {
    id: 'refLogistica',
    header: 'Ref. logística',
    cell: ({ row }) => {
      const art = row.original
      return h(
        'div',
        {
          class: 'min-w-[8.5rem]',
          onClick: (e: Event) => e.stopPropagation()
        },
        h(UInput, {
          'modelValue': art.referenciaLogistica ?? '',
          'placeholder': 'SG/17958Y64',
          'size': 'sm',
          'class': 'w-full font-mono text-xs',
          'onUpdate:modelValue': (v: string) => {
            art.referenciaLogistica = v
          }
        })
      )
    }
  },
  {
    id: 'imagen',
    header: '',
    cell: ({ row }) =>
      h('img', {
        src: row.original.imagenUrl,
        alt: row.original.descripcion,
        class: 'size-11 rounded-md object-cover ring ring-default bg-elevated'
      })
  },
  {
    accessorKey: 'descripcion',
    header: 'Descripción',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-highlighted max-w-[min(280px,40vw)] truncate block' }, row.original.descripcion)
  },
  {
    id: 'cantidad',
    header: 'Cantidad',
    cell: ({ row }) => {
      const a = row.original
      return h('div', { class: 'text-sm tabular-nums' }, [
        h('span', { class: 'text-highlighted font-medium' }, `${a.cantidadRecibida}`),
        h('span', { class: 'text-muted' }, ` / ${a.cantidadTotal}`)
      ])
    }
  },
  {
    accessorKey: 'precioUnitario',
    header: () => h('div', { class: 'text-end' }, 'Precio unit.'),
    cell: ({ row }) =>
      h('div', { class: 'text-end tabular-nums text-sm' }, formatUsd(row.original.precioUnitario))
  },
  {
    id: 'subtotal',
    header: () => h('div', { class: 'text-end' }, 'Subtotal USD'),
    cell: ({ row }) =>
      h('div', { class: 'text-end tabular-nums font-medium' }, formatUsd(subtotalLineaUsd(row.original)))
  },
  {
    id: 'yaImportado',
    header: () => h('div', { class: 'text-end' }, 'Ya importado'),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-end tabular-nums text-sm font-medium' },
        formatUsd(yaImportadoLineaUsd(row.original))
      )
  },
  {
    id: 'estatus',
    header: 'Estatus',
    cell: ({ row }) => {
      const art = row.original
      return h(
        'div',
        {
          class: 'min-w-[9.5rem]',
          onClick: (e: Event) => e.stopPropagation()
        },
        h(USelect, {
          'modelValue': art.estatus,
          'items': estatusItems,
          'valueKey': 'value',
          'labelKey': 'label',
          'size': 'sm',
          'class': 'w-full',
          'onUpdate:modelValue': (v: ArticuloEstatusLogistica) =>
            emit('estatus-change', art, v)
        })
      )
    }
  }
]
</script>

<template>
  <UTable
    :key="tableKey"
    :data="tableData"
    :columns="columns"
    :get-row-id="(row: ArticuloProyecto) => row.id || row.sg"
    class="shrink-0"
    :ui="{
      base: 'table-fixed border-separate border-spacing-0',
      thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
      tbody: '[&>tr]:last:[&>td]:border-b-0',
      th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
      td: 'border-b border-default align-middle',
      separator: 'h-0'
    }"
  />
</template>
