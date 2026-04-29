<script setup lang="ts">
import type { ArticuloProyecto, FleteExtra, OtroCargoProyecto, PagoProyecto } from '~/types'
import {
  montoImportacionTarifaUsd,
  subtotalLineasMonterreyCompletasUsd,
  totalArticulosSubtotalUsd,
  totalProyectoConCargosUsd
} from '~/utils/proyectoCalculos'

const props = defineProps<{
  articulos: ArticuloProyecto[]
  tarifaImportacionPct: number
  despachoAduanalUsd: number
  fleteLogisticaUsd: number
  anticipoUsd: number
  totalPagosUsd: number
  pagos: PagoProyecto[]
  maniobrasUsd?: number
  fleteLaredoMtyUsd?: number
  fleteNacionalUsd?: number
  fletesExtra?: FleteExtra[]
  otrosExtras?: OtroCargoProyecto[]
  igiPct?: number
  wireTransferUsd?: number
  comercializadoraPct?: number
  compradoPorTrade?: boolean
}>()

const emit = defineEmits<{
  'ver-pagos': []
}>()

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const extras = computed(() => ({
  maniobrasUsd: props.maniobrasUsd,
  fleteLaredoMtyUsd: props.fleteLaredoMtyUsd,
  fleteNacionalUsd: props.fleteNacionalUsd,
  fletesExtra: props.fletesExtra,
  otrosExtras: props.otrosExtras,
  igiPct: props.igiPct,
  wireTransferUsd: props.wireTransferUsd,
  comercializadoraPct: props.comercializadoraPct
}))

const totalArticulosValuado = computed(() => totalArticulosSubtotalUsd(props.articulos))
const subtotalMonterrey = computed(() => subtotalLineasMonterreyCompletasUsd(props.articulos))
const comision = computed(() =>
  montoImportacionTarifaUsd(totalArticulosValuado.value, props.tarifaImportacionPct)
)
const igiMonto = computed(() => totalArticulosValuado.value * ((props.igiPct ?? 0) / 100))
const comercializadoraMonto = computed(() => totalArticulosValuado.value * ((props.comercializadoraPct ?? 0) / 100))

const valorDevengado = computed(() =>
  totalProyectoConCargosUsd(
    props.articulos,
    props.tarifaImportacionPct,
    props.despachoAduanalUsd,
    props.fleteLogisticaUsd,
    extras.value,
    props.compradoPorTrade ?? true
  )
)
const deducciones = computed(() => props.anticipoUsd + props.totalPagosUsd)
const saldoPendiente = computed(() => Math.max(0, valorDevengado.value - deducciones.value))
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
          % Importación y pago de impuestos aduanales ({{ tarifaImportacionPct }}%)
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
      <div v-if="(maniobrasUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Maniobras especiales
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(maniobrasUsd ?? 0) }}
        </dd>
      </div>
      <div v-if="(fleteLaredoMtyUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Flete Laredo → Mty
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(fleteLaredoMtyUsd ?? 0) }}
        </dd>
      </div>
      <div v-if="(fleteNacionalUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Flete nacional
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(fleteNacionalUsd ?? 0) }}
        </dd>
      </div>
      <template v-if="fletesExtra && fletesExtra.length">
        <div
          v-for="fe in fletesExtra.filter(f => f.monto > 0)"
          :key="fe.label"
          class="flex justify-between gap-4 border-b border-default/60 py-1.5"
        >
          <dt class="text-muted">
            {{ fe.label || 'Flete adicional' }}
          </dt>
          <dd class="tabular-nums font-medium">
            {{ formatUsd(fe.monto) }}
          </dd>
        </div>
      </template>
      <template v-if="otrosExtras && otrosExtras.length">
        <div
          v-for="oc in otrosExtras.filter(o => o.montoUsd > 0)"
          :key="oc.id"
          class="flex justify-between gap-4 border-b border-default/60 py-1.5"
        >
          <dt class="text-muted">
            {{ oc.descripcion || 'Otro cargo' }}
          </dt>
          <dd class="tabular-nums font-medium">
            {{ formatUsd(oc.montoUsd) }}
          </dd>
        </div>
      </template>
      <div v-if="(igiPct ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          IGI ({{ igiPct }}%)
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(igiMonto) }}
        </dd>
      </div>
      <div v-if="(wireTransferUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Wire transfer
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(wireTransferUsd ?? 0) }}
        </dd>
      </div>
      <div v-if="(comercializadoraPct ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Comercializadora ({{ comercializadoraPct }}%)
        </dt>
        <dd class="tabular-nums font-medium">
          {{ formatUsd(comercializadoraMonto) }}
        </dd>
      </div>

      <!-- Valor devengado (total del proyecto con todos los cargos) -->
      <div class="flex justify-between gap-4 rounded-md bg-primary/10 px-2 py-2">
        <dt class="font-semibold text-highlighted">
          Valor devengado
        </dt>
        <dd class="tabular-nums font-semibold text-highlighted">
          {{ formatUsd(valorDevengado) }}
        </dd>
      </div>

      <!-- Anticipos y pagos con botón para ver detalle -->
      <div class="flex items-center justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="flex items-center gap-2 text-muted">
          <span>Anticipos y pagos</span>
          <UButton
            v-if="anticipoUsd > 0 || pagos.length > 0"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-eye"
            :label="String(pagos.length + (anticipoUsd > 0 ? 1 : 0))"
            @click="emit('ver-pagos')"
          />
        </dt>
        <dd class="tabular-nums font-medium text-error">
          −{{ formatUsd(deducciones) }}
        </dd>
      </div>

      <!-- Saldo pendiente -->
      <div class="flex justify-between gap-4 rounded-md bg-warning/10 px-2 py-2">
        <dt class="font-semibold text-highlighted">
          Saldo pendiente
        </dt>
        <dd class="tabular-nums font-semibold text-highlighted">
          {{ formatUsd(saldoPendiente) }}
        </dd>
      </div>
    </dl>
    <p class="mt-3 text-xs text-muted">
      Valor devengado = total artículos + % importación + despacho + fletes + extras. Saldo = valor devengado − anticipos − pagos.
    </p>
  </div>
</template>
