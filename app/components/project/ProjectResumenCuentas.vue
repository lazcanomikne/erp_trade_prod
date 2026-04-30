<script setup lang="ts">
import type { ArticuloProyecto, FleteExtra, OtroCargoProyecto, PagoProyecto } from '~/types'
import {
  calcMontoDesdeRate,
  montoImportacionTarifaUsd,
  totalProyectoConCargosUsd,
  valorDevengadoArticulosTotal,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

const props = defineProps<{
  articulos: ArticuloProyecto[]
  tarifaImportacionPct: number
  despachoAduanalUsd: number
  despachoAduanalDivisor?: number
  fleteLogisticaUsd: number
  fleteLogisticaDivisor?: number
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

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`
}

const compraTrade = computed(() => props.compradoPorTrade ?? true)

const extras = computed(() => ({
  maniobrasUsd: props.maniobrasUsd,
  fleteLaredoMtyUsd: props.fleteLaredoMtyUsd,
  fleteNacionalUsd: props.fleteNacionalUsd,
  fletesExtra: props.fletesExtra,
  otrosExtras: props.otrosExtras,
  igiPct: props.igiPct,
  wireTransferUsd: props.wireTransferUsd,
  comercializadoraPct: props.comercializadoraPct,
  despachoAduanalDivisor: props.despachoAduanalDivisor,
  fleteLogisticaDivisor: props.fleteLogisticaDivisor
}))

// Base artículos (todos, sin importar estatus logístico)
const valorBase = computed(() => valorTotalProyectoDesdeArticulos(props.articulos))

// Líneas de desglose de cargos
const comision = computed(() => montoImportacionTarifaUsd(valorBase.value, props.tarifaImportacionPct))
const igiMonto = computed(() => valorBase.value * ((props.igiPct ?? 0) / 100))
const comercializadoraMonto = computed(() => valorBase.value * ((props.comercializadoraPct ?? 0) / 100))
// Despacho y flete: totalMercancía × (tasa / divisor)
const despachoMonto = computed(() => calcMontoDesdeRate(props.despachoAduanalUsd, valorBase.value, props.despachoAduanalDivisor ?? 60000))
const fleteMonto = computed(() => calcMontoDesdeRate(props.fleteLogisticaUsd, valorBase.value, props.fleteLogisticaDivisor ?? 60000))

// Valor del proyecto = artículos + todos los cargos (total contratado)
const valorProyecto = computed(() =>
  totalProyectoConCargosUsd(
    props.articulos,
    props.tarifaImportacionPct,
    props.despachoAduanalUsd,
    props.fleteLogisticaUsd,
    extras.value,
    compraTrade.value
  )
)

// Artículos ya en Laredo o Monterrey
const devengadoArticulos = computed(() => valorDevengadoArticulosTotal(props.articulos))

// Prorrateo: fracción del proyecto que ya está en Laredo/Monterrey
const pctDevengado = computed(() =>
  valorBase.value > 0 ? devengadoArticulos.value / valorBase.value : 0
)

// Valor devengado = pct × valor del proyecto (aplica sin importar si Trade compra o no)
const valorDevengado = computed(() =>
  pctDevengado.value * valorProyecto.value
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

      <!-- Desglose de cargos -->
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">Artículos (subtotal)</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(compraTrade ? valorBase : 0) }}</dd>
      </div>
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">% Importación y pago de impuestos aduanales ({{ tarifaImportacionPct }}%)</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(comision) }}</dd>
      </div>
      <div v-if="despachoMonto > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Despacho aduanal
          <span class="text-xs text-muted/70">({{ despachoAduanalUsd }} / {{ despachoAduanalDivisor ?? 60000 }})</span>
        </dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(despachoMonto) }}</dd>
      </div>
      <div v-if="fleteMonto > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">
          Logística y fletes
          <span class="text-xs text-muted/70">({{ fleteLogisticaUsd }} / {{ fleteLogisticaDivisor ?? 60000 }})</span>
        </dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(fleteMonto) }}</dd>
      </div>
      <div v-if="(maniobrasUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">Maniobras especiales</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(maniobrasUsd ?? 0) }}</dd>
      </div>
      <div v-if="(fleteLaredoMtyUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">Flete Laredo → Mty</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(fleteLaredoMtyUsd ?? 0) }}</dd>
      </div>
      <div v-if="(fleteNacionalUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">Flete nacional</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(fleteNacionalUsd ?? 0) }}</dd>
      </div>
      <template v-if="fletesExtra && fletesExtra.length">
        <div
          v-for="fe in fletesExtra.filter(f => f.monto > 0)"
          :key="fe.label"
          class="flex justify-between gap-4 border-b border-default/60 py-1.5"
        >
          <dt class="text-muted">{{ fe.label || 'Flete adicional' }}</dt>
          <dd class="tabular-nums font-medium">{{ formatUsd(fe.monto) }}</dd>
        </div>
      </template>
      <template v-if="otrosExtras && otrosExtras.length">
        <div
          v-for="oc in otrosExtras.filter(o => o.montoUsd > 0)"
          :key="oc.id"
          class="flex justify-between gap-4 border-b border-default/60 py-1.5"
        >
          <dt class="text-muted">{{ oc.descripcion || 'Otro cargo' }}</dt>
          <dd class="tabular-nums font-medium">{{ formatUsd(oc.montoUsd) }}</dd>
        </div>
      </template>
      <div v-if="(igiPct ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">IGI ({{ igiPct }}%)</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(igiMonto) }}</dd>
      </div>
      <div v-if="(wireTransferUsd ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">Wire transfer</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(wireTransferUsd ?? 0) }}</dd>
      </div>
      <div v-if="(comercializadoraPct ?? 0) > 0" class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">Comercializadora ({{ comercializadoraPct }}%)</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(comercializadoraMonto) }}</dd>
      </div>

      <!-- Valor del proyecto = suma total de artículos + todos los cargos -->
      <div class="flex justify-between gap-4 rounded-md bg-elevated px-2 py-2 border border-default">
        <dt class="font-semibold text-highlighted">Valor del proyecto</dt>
        <dd class="tabular-nums font-semibold text-highlighted">{{ formatUsd(valorProyecto) }}</dd>
      </div>

      <!-- Valor devengado = prorrateo del valor del proyecto según artículos en Laredo/Monterrey -->
      <div class="flex justify-between gap-4 rounded-md bg-info/10 px-2 py-2">
        <dt class="flex items-center gap-2 font-semibold text-highlighted">
          <span>Valor devengado</span>
          <span v-if="pctDevengado > 0 && pctDevengado < 1" class="text-xs font-normal text-info">
            ({{ formatPct(pctDevengado) }} del proyecto)
          </span>
        </dt>
        <dd class="tabular-nums font-semibold text-info">{{ formatUsd(valorDevengado) }}</dd>
      </div>

      <!-- Anticipos y pagos -->
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
        <dd class="tabular-nums font-medium text-error">−{{ formatUsd(deducciones) }}</dd>
      </div>

      <!-- Saldo pendiente = valor devengado − anticipos − pagos -->
      <div class="flex justify-between gap-4 rounded-md bg-warning/10 px-2 py-2">
        <dt class="font-semibold text-highlighted">Saldo pendiente</dt>
        <dd class="tabular-nums font-semibold text-highlighted">{{ formatUsd(saldoPendiente) }}</dd>
      </div>
    </dl>
    <p class="mt-3 text-xs text-muted">
      Valor devengado = % de artículos en Laredo/Monterrey × valor del proyecto. Saldo = devengado − anticipos − pagos.
    </p>
  </div>
</template>
