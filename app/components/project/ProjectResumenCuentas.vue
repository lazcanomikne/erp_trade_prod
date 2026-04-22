<script setup lang="ts">
import type { ArticuloProyecto } from '~/types'
import {
  montoImportacionTarifaUsd,
  saldoPorCobrarZambranoUsd,
  subtotalCargosZambranoUsd,
  subtotalLineasMonterreyCompletasUsd,
  totalArticulosSubtotalUsd
} from '~/utils/proyectoCalculos'

const props = defineProps<{
  articulos: ArticuloProyecto[]
  tarifaImportacionPct: number
  despachoAduanalUsd: number
  fleteLogisticaUsd: number
  anticipoUsd: number
  totalPagosUsd: number
}>()

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const totalArticulosValuado = computed(() => totalArticulosSubtotalUsd(props.articulos))
const subtotalMonterrey = computed(() => subtotalLineasMonterreyCompletasUsd(props.articulos))
const comision = computed(() =>
  montoImportacionTarifaUsd(subtotalMonterrey.value, props.tarifaImportacionPct)
)
const deducciones = computed(() => props.anticipoUsd + props.totalPagosUsd)
const valorDevengado = computed(() =>
  subtotalCargosZambranoUsd(
    props.articulos,
    props.tarifaImportacionPct,
    props.despachoAduanalUsd,
    props.fleteLogisticaUsd
  )
)
const saldoTotal = computed(() =>
  saldoPorCobrarZambranoUsd(
    props.articulos,
    props.tarifaImportacionPct,
    props.despachoAduanalUsd,
    props.fleteLogisticaUsd,
    props.anticipoUsd,
    props.totalPagosUsd
  )
)
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated/30 p-4">
    <div class="mb-3 flex items-center gap-2 text-highlighted">
      <UIcon name="i-lucide-file-spreadsheet" class="size-5 text-primary" />
      <span class="font-semibold">Resumen de cuentas</span>
    </div>
    <dl class="space-y-2 text-sm">
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Total artículos (valuación)
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(totalArticulosValuado) }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Subtotal mercancía Monterrey
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(subtotalMonterrey) }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Comisión proyecto ({{ tarifaImportacionPct }}%)
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(comision) }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Despacho aduanal
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(despachoAduanalUsd) }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Logística y fletes
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(fleteLogisticaUsd) }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Anticipos y pagos
        </dt>
        <dd class="tabular-nums font-medium text-error">
          −{{ formatUsd(deducciones) }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 rounded-md bg-primary/10 px-2 py-2">
        <dt class="font-semibold text-highlighted">
          Valor devengado
        </dt>
        <dd class="tabular-nums font-semibold text-highlighted">
          {{ formatUsd(valorDevengado) }}
        </dd>
      </div>
      <div class="flex justify-between gap-4 rounded-md bg-warning/10 px-2 py-2">
        <dt class="font-semibold text-highlighted">
          Saldo total
        </dt>
        <dd class="tabular-nums font-semibold text-highlighted">
          {{ formatUsd(saldoTotal) }}
        </dd>
      </div>
    </dl>
    <p class="mt-3 text-xs text-muted">
      Valor devengado = subtotal Monterrey + comisión + despacho + fletes. Saldo = valor devengado − anticipos − pagos. Solo líneas con estatus «Monterrey».
    </p>
  </div>
</template>
