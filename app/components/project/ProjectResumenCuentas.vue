<script setup lang="ts">
import type { ArticuloProyecto, PagoProyecto } from '~/types'
import {
  valorDevengadoArticulosTotal,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

const props = defineProps<{
  articulos: ArticuloProyecto[]
  anticipoUsd: number
  totalPagosUsd: number
  pagos: PagoProyecto[]
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

const compraTrade = computed(() => props.compradoPorTrade ?? true)

const valorProyecto = computed(() =>
  compraTrade.value ? valorTotalProyectoDesdeArticulos(props.articulos) : 0
)

const valorDevengado = computed(() =>
  compraTrade.value ? valorDevengadoArticulosTotal(props.articulos) : 0
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
      <!-- Valor del proyecto (todos los artículos) -->
      <div class="flex justify-between gap-4 border-b border-default/60 py-1.5">
        <dt class="text-muted">Valor del proyecto</dt>
        <dd class="tabular-nums font-medium">{{ formatUsd(valorProyecto) }}</dd>
      </div>

      <!-- Valor devengado (Laredo + Monterrey) -->
      <div class="flex justify-between gap-4 rounded-md bg-info/10 px-2 py-2">
        <dt class="font-semibold text-highlighted">Valor devengado</dt>
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
        <dd class="tabular-nums font-medium text-error">
          −{{ formatUsd(deducciones) }}
        </dd>
      </div>

      <!-- Saldo pendiente = valor devengado − anticipos − pagos -->
      <div class="flex justify-between gap-4 rounded-md bg-warning/10 px-2 py-2">
        <dt class="font-semibold text-highlighted">Saldo pendiente</dt>
        <dd class="tabular-nums font-semibold text-highlighted">
          {{ formatUsd(saldoPendiente) }}
        </dd>
      </div>
    </dl>
    <p class="mt-3 text-xs text-muted">
      Valor devengado = artículos en Laredo o Monterrey. Saldo = valor devengado − anticipos − pagos.
    </p>
  </div>
</template>
