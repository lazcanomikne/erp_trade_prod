<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CuentaPorCobrarFila } from '~/types'
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import { listarCuentasPorCobrar } from '~/utils/cuentasPorCobrar'

const NuxtLink = resolveComponent('NuxtLink')
const toast = useToast()
const inv = useInventarioStore()

const filasBase = computed(() => {
  void inv.porProyecto
  return listarCuentasPorCobrar()
})

const soloSaldoPendiente = ref(true)

const filas = computed(() => {
  const base = filasBase.value
  if (!soloSaldoPendiente.value) {
    return base
  }
  return base.filter(f => f.saldoPorCobrarUsd > 0)
})

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function formatFecha(iso: string | null) {
  if (!iso) {
    return '—'
  }
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return iso
  }
}

const statsCartera = computed<ProjectStatItem[]>(() => {
  const rows = filas.value
  const sumDev = rows.reduce((s, r) => s + r.montoDevengadoUsd, 0)
  const sumPag = rows.reduce((s, r) => s + r.pagosRecibidosUsd, 0)
  const sumSal = rows.reduce((s, r) => s + r.saldoPorCobrarUsd, 0)
  const conSaldo = rows.filter(r => r.saldoPorCobrarUsd > 0).length
  return [
    {
      title: 'Devengado (vista)',
      icon: 'i-lucide-trending-up',
      value: formatUsd(sumDev),
      tone: 'primary'
    },
    {
      title: 'Pagos acumulados',
      icon: 'i-lucide-banknote',
      value: formatUsd(sumPag),
      tone: 'success'
    },
    {
      title: 'Saldo por cobrar',
      icon: 'i-lucide-scale',
      value: formatUsd(sumSal),
      tone: 'warning'
    },
    {
      title: 'Proyectos con saldo > 0',
      icon: 'i-lucide-folder-open',
      value: String(conSaldo),
      tone: 'info'
    }
  ]
})

const columns: TableColumn<CuentaPorCobrarFila>[] = [
  {
    id: 'proyecto',
    header: 'Proyecto',
    cell: ({ row }) =>
      h(
        NuxtLink,
        {
          to: `/proyectos/${encodeURIComponent(row.original.idProyecto)}`,
          class:
            'font-medium text-primary hover:underline underline-offset-2'
        },
        () => row.original.nombre
      )
  },
  {
    accessorKey: 'cliente',
    header: 'Cliente'
  },
  {
    accessorKey: 'montoDevengadoUsd',
    header: () => h('div', { class: 'text-end' }, 'Monto devengado'),
    cell: ({ row }) =>
      h('div', { class: 'text-end tabular-nums' }, formatUsd(row.original.montoDevengadoUsd))
  },
  {
    accessorKey: 'pagosRecibidosUsd',
    header: () => h('div', { class: 'text-end' }, 'Pagos recibidos'),
    cell: ({ row }) =>
      h('div', { class: 'text-end tabular-nums' }, formatUsd(row.original.pagosRecibidosUsd))
  },
  {
    accessorKey: 'saldoPorCobrarUsd',
    header: () => h('div', { class: 'text-end' }, 'Saldo por cobrar'),
    cell: ({ row }) =>
      h(
        'div',
        {
          class: [
            'text-end tabular-nums font-medium',
            row.original.saldoPorCobrarUsd > 0 ? 'text-warning' : ''
          ]
        },
        formatUsd(row.original.saldoPorCobrarUsd)
      )
  },
  {
    id: 'ultimo',
    header: 'Último pago',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted' }, formatFecha(row.original.ultimoPagoFecha))
  }
]

function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function exportarExcel() {
  const rows = filas.value
  const headers = [
    'Proyecto', 'Cliente',
    'Monto devengado (USD)', 'Pagos recibidos (USD)', 'Saldo por cobrar (USD)',
    'Último pago (fecha)'
  ]
  const csvRows = [
    headers.map(csvEscape).join(','),
    ...rows.map(r => [
      csvEscape(r.nombre),
      csvEscape(r.cliente),
      (Math.round(r.montoDevengadoUsd * 100) / 100).toFixed(2),
      (Math.round(r.pagosRecibidosUsd * 100) / 100).toFixed(2),
      (Math.round(r.saldoPorCobrarUsd * 100) / 100).toFixed(2),
      csvEscape(r.ultimoPagoFecha)
    ].join(','))
  ]
  const csv = '﻿' + csvRows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cuentas-por-cobrar-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.add({
    title: 'Exportación lista',
    description: `Archivo CSV generado. Ábrelo con Excel.`,
    color: 'success',
    icon: 'i-lucide-file-spreadsheet'
  })
}
</script>

<template>
  <UDashboardPanel id="cuentas-por-cobrar">
    <template #header>
      <UDashboardNavbar title="Cuentas por cobrar">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Exportar a Excel"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :disabled="!filas.length"
            @click="exportarExcel"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="mb-6 max-w-3xl text-muted">
        Vista financiera de proyectos activos: devengado según artículos recibidos, pagos registrados y saldo pendiente (misma lógica que el detalle de proyecto).
      </p>

      <ProjectStats class="mb-8" :items="statsCartera" />

      <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3">
          <USwitch
            v-model="soloSaldoPendiente"
            label="Solo proyectos con saldo pendiente > $0"
            size="md"
          />
        </div>
        <p class="text-sm text-muted">
          {{ filas.length }} proyecto(s) en la tabla
        </p>
      </div>

      <UTable
        :data="filas"
        :columns="columns"
        :get-row-id="(row: CuentaPorCobrarFila) => row.idProyecto"
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
