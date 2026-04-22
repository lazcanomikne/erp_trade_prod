<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SaldoVencidoRow } from '~/utils/reportesFinanzas'
import {
  balanceValuadoVsCobrado,
  saldosVencidosMonterrey,
  sumaCobradoGlobal,
  sumaValuadoGlobal,
  totalComisionesDevengadasUsd
} from '~/utils/reportesFinanzas'

const NuxtLink = resolveComponent('NuxtLink')

const comisionesTotal = computed(() => totalComisionesDevengadasUsd())
const balanceRows = computed(() => balanceValuadoVsCobrado())
const sumValuado = computed(() => sumaValuadoGlobal(balanceRows.value))
const sumCobrado = computed(() => sumaCobradoGlobal(balanceRows.value))
const vencidos = computed(() => saldosVencidosMonterrey())

const chartRows = computed(() => {
  const sorted = [...balanceRows.value].sort((a, b) => b.valuadoUsd - a.valuadoUsd).slice(0, 10)
  return sorted
})

function pctCobradoSobreValuado(row: { valuadoUsd: number, cobradoUsd: number }): number {
  if (row.valuadoUsd <= 0) {
    return 0
  }
  return Math.min(100, (row.cobradoUsd / row.valuadoUsd) * 100)
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const columnsVencidos: TableColumn<SaldoVencidoRow>[] = [
  {
    id: 'proyecto',
    header: 'Proyecto',
    cell: ({ row }) =>
      h(
        NuxtLink,
        {
          to: `/proyectos/${encodeURIComponent(row.original.idProyecto)}`,
          class: 'font-medium text-primary hover:underline'
        },
        () => row.original.nombre
      )
  },
  {
    accessorKey: 'cliente',
    header: 'Cliente'
  },
  {
    accessorKey: 'saldoUsd',
    header: () => h('div', { class: 'text-end' }, 'Saldo pendiente'),
    cell: ({ row }) =>
      h('div', { class: 'text-end tabular-nums font-medium text-warning' }, formatUsd(row.original.saldoUsd))
  },
  {
    id: 'dias',
    header: () => h('div', { class: 'text-end' }, 'Días sin pago'),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-end tabular-nums text-sm text-muted' },
        row.original.diasDesdeUltimoPago == null ? 'Sin pagos' : String(row.original.diasDesdeUltimoPago)
      )
  }
]
</script>

<template>
  <UDashboardPanel id="reportes">
    <template #header>
      <UDashboardNavbar title="Reportes financieros">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="mb-8 max-w-3xl text-muted">
        Vista global: comisiones devengadas (sobre valor en Monterrey), comparativa valuado vs. cobrado por proyecto, y cartera con mercancía en Monterrey y pago atrasado.
      </p>

      <div class="grid gap-6 lg:grid-cols-3 mb-10">
        <UCard>
          <p class="text-xs text-muted uppercase mb-1">
            Ingresos por comisiones
          </p>
          <p class="text-3xl font-semibold text-highlighted tabular-nums">
            {{ formatUsd(comisionesTotal) }}
          </p>
          <p class="mt-2 text-xs text-muted">
            Σ (valor devengado × % tarifa) sobre todas las líneas en Monterrey.
          </p>
        </UCard>
        <UCard>
          <p class="text-xs text-muted uppercase mb-1">
            Valuado (inventario)
          </p>
          <p class="text-3xl font-semibold text-highlighted tabular-nums">
            {{ formatUsd(sumValuado) }}
          </p>
          <p class="mt-2 text-xs text-muted">
            Σ precio × cantidad total por proyecto.
          </p>
        </UCard>
        <UCard>
          <p class="text-xs text-muted uppercase mb-1">
            Cobrado (pagos)
          </p>
          <p class="text-3xl font-semibold text-highlighted tabular-nums">
            {{ formatUsd(sumCobrado) }}
          </p>
          <p class="mt-2 text-xs text-muted">
            Suma de pagos registrados en todos los proyectos.
          </p>
        </UCard>
      </div>

      <UCard class="mb-10">
        <template #header>
          <div>
            <p class="text-sm font-semibold text-highlighted">
              Balance por proyecto (valuado vs. cobrado)
            </p>
            <p class="text-xs text-muted mt-1">
              Hasta 10 proyectos con mayor valuado. La barra muestra el % cobrado sobre el valuado del proyecto.
            </p>
          </div>
        </template>

        <div
          v-if="!chartRows.length"
          class="py-8 text-center text-muted text-sm"
        >
          Sin datos para mostrar.
        </div>
        <ul
          v-else
          class="space-y-5"
        >
          <li
            v-for="row in chartRows"
            :key="row.idProyecto"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
              <span class="text-sm font-medium text-highlighted truncate max-w-[min(100%,20rem)]">
                {{ row.nombre }}
              </span>
              <span class="text-xs text-muted tabular-nums shrink-0">
                Cobrado {{ formatUsd(row.cobradoUsd) }} · Valuado {{ formatUsd(row.valuadoUsd) }}
              </span>
            </div>
            <div class="h-3 w-full rounded-full bg-elevated ring-1 ring-inset ring-default/60 overflow-hidden">
              <div
                class="h-full rounded-full bg-primary transition-[width] duration-300"
                :style="{ width: `${pctCobradoSobreValuado(row)}%` }"
              />
            </div>
          </li>
        </ul>
      </UCard>

      <div class="mb-3 flex items-center gap-2">
        <UIcon name="i-lucide-alert-triangle" class="size-5 text-warning" />
        <h2 class="text-lg font-semibold text-highlighted">
          Saldos vencidos (Monterrey)
        </h2>
      </div>
      <p class="mb-4 text-sm text-muted max-w-3xl">
        Clientes con artículos recibidos en Monterrey, saldo por cobrar &gt; 0 y sin pago en más de 15 días (o sin pagos registrados).
      </p>

      <div
        v-if="!vencidos.length"
        class="rounded-lg border border-dashed border-default px-4 py-10 text-center text-muted text-sm"
      >
        No hay cuentas que cumplan el criterio en este momento.
      </div>
      <UTable
        v-else
        :data="vencidos"
        :columns="columnsVencidos"
        :get-row-id="(row: SaldoVencidoRow) => row.idProyecto"
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
  </UDashboardPanel>
</template>
