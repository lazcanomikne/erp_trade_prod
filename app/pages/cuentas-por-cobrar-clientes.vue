<script setup lang="ts">
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import type { CuentaClienteConsolidada } from '~/types'
import { listarCuentasPorCobrarPorCliente } from '~/utils/cuentasPorCobrar'

useHead({ title: 'Cobranza por cliente' })

const toast = useToast()
const inv = useInventarioStore()

try {
  await inv.refreshFromApi()
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos del ERP.' })
}

const soloConSaldo = ref(true)
const busqueda = ref('')
const expandidos = ref<Set<string>>(new Set())

const base = computed<CuentaClienteConsolidada[]>(() => {
  void inv.porProyecto
  return listarCuentasPorCobrarPorCliente()
})

const clientes = computed(() => {
  let lista = base.value
  if (soloConSaldo.value) lista = lista.filter(c => c.saldoTotalUsd > 0.005)
  const q = busqueda.value.trim().toLowerCase()
  if (q) lista = lista.filter(c => c.cliente.toLowerCase().includes(q))
  return lista
})

function toggle(cliente: string) {
  const next = new Set(expandidos.value)
  if (next.has(cliente)) next.delete(cliente)
  else next.add(cliente)
  expandidos.value = next
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(value)
}

const stats = computed<ProjectStatItem[]>(() => {
  const todos = base.value
  return [
    {
      title: 'Saldo total por cobrar',
      icon: 'i-lucide-scale',
      value: formatUsd(todos.reduce((s, c) => s + c.saldoTotalUsd, 0)),
      tone: 'warning'
    },
    {
      title: 'Clientes con saldo',
      icon: 'i-lucide-users-round',
      value: String(todos.filter(c => c.saldoTotalUsd > 0.005).length),
      tone: 'info'
    },
    {
      title: 'Valor total de proyectos',
      icon: 'i-lucide-circle-dollar-sign',
      value: formatUsd(todos.reduce((s, c) => s + c.totalProyectoUsd, 0)),
      tone: 'primary'
    },
    {
      title: 'Pagos recibidos',
      icon: 'i-lucide-wallet',
      value: formatUsd(todos.reduce((s, c) => s + c.pagosRecibidosUsd, 0)),
      tone: 'success'
    }
  ]
})

// --- Registro de pago consolidado ---
const modalPago = ref(false)
const clienteSel = ref<CuentaClienteConsolidada | null>(null)

function abrirPago(c: CuentaClienteConsolidada) {
  clienteSel.value = c
  modalPago.value = true
}

async function onSubmitPago(payload: {
  fecha: string
  referencia?: string
  formaPago?: string
  asignaciones: Array<{ idProyecto: string, montoUsd: number }>
}) {
  const cliente = clienteSel.value?.cliente
  if (!cliente) return
  try {
    await inv.registrarPagoConsolidado(cliente, payload)
    const total = payload.asignaciones.reduce((s, a) => s + a.montoUsd, 0)
    toast.add({
      title: 'Pago registrado',
      description: `Se aplicó ${formatUsd(total)} a ${payload.asignaciones.length} proyecto(s) de ${cliente}.`,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch {
    toast.add({
      title: 'No se pudo registrar el pago',
      description: 'Intenta de nuevo. Si persiste, revisa la conexión con el ERP.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  }
}

// --- Exportar ---
function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str
}

function exportarExcel() {
  const rows = clientes.value
  const headers = ['Cliente', 'Proyectos', 'Valor total (USD)', 'Pagos recibidos (USD)', 'Saldo total pendiente (USD)']
  const csvRows = [
    headers.map(csvEscape).join(','),
    ...rows.map(c => [
      csvEscape(c.cliente),
      String(c.numProyectos),
      (Math.round(c.totalProyectoUsd * 100) / 100).toFixed(2),
      (Math.round(c.pagosRecibidosUsd * 100) / 100).toFixed(2),
      (Math.round(c.saldoTotalUsd * 100) / 100).toFixed(2)
    ].join(','))
  ]
  const csv = '﻿' + csvRows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cobranza-por-cliente-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.add({ title: 'Exportación lista', description: 'Archivo CSV generado. Ábrelo con Excel.', color: 'success', icon: 'i-lucide-file-spreadsheet' })
}
</script>

<template>
  <UDashboardPanel id="cobranza-clientes">
    <template #header>
      <UDashboardNavbar title="Cobranza por cliente">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Exportar a Excel"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :disabled="!clientes.length"
            @click="exportarExcel"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="mb-6 max-w-3xl text-muted">
        Saldo consolidado por cliente sobre proyectos activos. Cada cliente aparece una sola vez con la suma del saldo de todos sus proyectos.
        Registra un pago del cliente y repártelo entre sus proyectos. Misma fórmula de saldo que
        <NuxtLink to="/cuentas-por-cobrar" class="text-primary hover:underline">Cuentas por cobrar</NuxtLink>.
      </p>

      <ProjectStats class="mb-8" :items="stats" />

      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="busqueda"
            icon="i-lucide-search"
            placeholder="Buscar cliente…"
            class="w-full max-w-xs"
          />
          <USwitch v-model="soloConSaldo" label="Solo clientes con saldo > $0" size="md" />
        </div>
        <p class="shrink-0 text-sm text-muted">
          {{ clientes.length }} cliente(s)
        </p>
      </div>

      <div class="w-full min-w-0 overflow-x-auto rounded-lg border border-default">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
              <th class="w-10 px-2 py-2.5 border-b border-default" />
              <th class="px-3 py-2.5 text-start border-b border-default font-medium">
                Cliente
              </th>
              <th class="w-24 px-3 py-2.5 text-center border-b border-default font-medium">
                Proyectos
              </th>
              <th class="w-36 px-3 py-2.5 text-end border-b border-default font-medium">
                Valor total
              </th>
              <th class="w-36 px-3 py-2.5 text-end border-b border-default font-medium">
                Pagos recibidos
              </th>
              <th class="w-40 px-3 py-2.5 text-end border-b border-default font-medium">
                Saldo total pendiente
              </th>
              <th class="w-32 px-3 py-2.5 text-center border-b border-default font-medium">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!clientes.length">
              <td colspan="7" class="py-16 text-center text-sm text-muted">
                <div class="flex flex-col items-center gap-2">
                  <UIcon name="i-lucide-users-round" class="size-8 text-muted/50" />
                  <span>Sin clientes con saldo pendiente.</span>
                </div>
              </td>
            </tr>
            <template v-for="c in clientes" :key="c.cliente">
              <tr class="hover:bg-elevated/30 transition-colors">
                <td class="px-2 py-3 border-b border-default text-center align-middle">
                  <UButton
                    :icon="expandidos.has(c.cliente) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    square
                    :aria-label="expandidos.has(c.cliente) ? 'Contraer' : 'Expandir'"
                    @click="toggle(c.cliente)"
                  />
                </td>
                <td class="px-3 py-3 border-b border-default align-middle">
                  <div class="flex items-center gap-2.5">
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary select-none">
                      {{ c.cliente.charAt(0).toUpperCase() }}
                    </span>
                    <span class="font-medium text-highlighted">{{ c.cliente }}</span>
                  </div>
                </td>
                <td class="px-3 py-3 border-b border-default text-center align-middle">
                  <span class="font-medium text-highlighted">{{ c.numProyectos }}</span>
                  <span v-if="c.numProyectosConSaldo < c.numProyectos" class="text-xs text-muted"> ({{ c.numProyectosConSaldo }} c/saldo)</span>
                </td>
                <td class="px-3 py-3 border-b border-default text-end tabular-nums font-semibold align-middle">
                  {{ formatUsd(c.totalProyectoUsd) }}
                </td>
                <td class="px-3 py-3 border-b border-default text-end tabular-nums text-success align-middle">
                  {{ formatUsd(c.pagosRecibidosUsd) }}
                </td>
                <td class="px-3 py-3 border-b border-default text-end tabular-nums font-semibold align-middle" :class="c.saldoTotalUsd > 0.005 ? 'text-warning' : 'text-success'">
                  {{ formatUsd(c.saldoTotalUsd) }}
                </td>
                <td class="px-3 py-3 border-b border-default text-center align-middle">
                  <UButton
                    label="Registrar pago"
                    icon="i-lucide-hand-coins"
                    color="primary"
                    variant="soft"
                    size="xs"
                    :disabled="c.saldoTotalUsd <= 0.005"
                    @click="abrirPago(c)"
                  />
                </td>
              </tr>
              <tr v-if="expandidos.has(c.cliente)">
                <td class="border-b border-default bg-elevated/20" />
                <td colspan="6" class="px-3 py-3 border-b border-default bg-elevated/20">
                  <div class="overflow-x-auto rounded-lg border border-default bg-default">
                    <table class="w-full border-collapse text-sm">
                      <thead>
                        <tr class="bg-elevated/40 text-xs">
                          <th class="px-3 py-2 text-start border-b border-default font-medium">
                            Proyecto
                          </th>
                          <th class="w-32 px-3 py-2 text-end border-b border-default font-medium">
                            Valor total
                          </th>
                          <th class="w-32 px-3 py-2 text-end border-b border-default font-medium">
                            Pagos
                          </th>
                          <th class="w-32 px-3 py-2 text-end border-b border-default font-medium">
                            Saldo
                          </th>
                          <th class="w-24 px-3 py-2 text-center border-b border-default font-medium">
                            Estatus
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="p in c.proyectos" :key="p.idProyecto" class="hover:bg-elevated/30">
                          <td class="px-3 py-2 border-b border-default last:border-b-0">
                            <NuxtLink :to="`/proyectos/${encodeURIComponent(p.idProyecto)}`" class="font-medium text-primary hover:underline">
                              {{ p.nombre }}
                            </NuxtLink>
                            <p class="text-xs text-muted font-mono">
                              {{ p.idProyecto }}
                            </p>
                          </td>
                          <td class="px-3 py-2 border-b border-default last:border-b-0 text-end tabular-nums">
                            {{ formatUsd(p.totalProyectoUsd) }}
                          </td>
                          <td class="px-3 py-2 border-b border-default last:border-b-0 text-end tabular-nums text-success">
                            {{ formatUsd(p.pagosRecibidosUsd) }}
                          </td>
                          <td class="px-3 py-2 border-b border-default last:border-b-0 text-end tabular-nums font-medium" :class="p.saldoUsd > 0.005 ? 'text-warning' : 'text-success'">
                            {{ formatUsd(p.saldoUsd) }}
                          </td>
                          <td class="px-3 py-2 border-b border-default last:border-b-0 text-center">
                            <UBadge color="neutral" variant="subtle" size="sm">
                              {{ p.estatus }}
                            </UBadge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <ClientePagoConsolidadoModal
        v-if="clienteSel"
        v-model:open="modalPago"
        :cliente="clienteSel.cliente"
        :proyectos="clienteSel.proyectos"
        :saldo-total="clienteSel.saldoTotalUsd"
        @submit="onSubmitPago"
      />
    </template>
  </UDashboardPanel>
</template>
