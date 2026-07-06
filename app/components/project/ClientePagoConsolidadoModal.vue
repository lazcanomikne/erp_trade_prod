<script setup lang="ts">
import type { CuentaClienteProyecto } from '~/types'
import { proponerRepartoFifo } from '~/utils/cuentasPorCobrar'

const open = defineModel<boolean>('open', { required: true })
const toast = useToast()

const props = defineProps<{
  cliente: string
  /** Proyectos del cliente, ordenados del más antiguo al más reciente. */
  proyectos: CuentaClienteProyecto[]
  saldoTotal: number
}>()

const emit = defineEmits<{
  submit: [payload: {
    fecha: string
    referencia?: string
    formaPago?: string
    asignaciones: Array<{ idProyecto: string, montoUsd: number }>
  }]
}>()

const formasPago = ['Efectivo', 'Transferencia', 'Cheque', 'Otros']

const monto = ref('')
const fecha = ref('')
const referencia = ref('')
const formaPago = ref('')
/** idProyecto → monto a aplicar (como string, editable). */
const asignaciones = ref<Record<string, string>>({})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(v)
}

/** Solo proyectos con saldo pendiente son candidatos a recibir el pago. */
const proyectosConSaldo = computed(() => props.proyectos.filter(p => p.saldoUsd > 0.005))

function redistribuir() {
  const m = Number(monto.value)
  const propuesta = proponerRepartoFifo(Number.isFinite(m) ? m : 0, proyectosConSaldo.value)
  const next: Record<string, string> = {}
  for (const p of proyectosConSaldo.value) {
    const val = propuesta[p.idProyecto] ?? 0
    next[p.idProyecto] = val ? String(val) : ''
  }
  asignaciones.value = next
}

watch(open, (v) => {
  if (v) {
    monto.value = ''
    fecha.value = new Date().toISOString().slice(0, 10)
    referencia.value = ''
    formaPago.value = ''
    asignaciones.value = {}
  }
})

// Al cambiar el monto, recalcula la propuesta FIFO (el usuario puede ajustarla después).
watch(monto, () => {
  redistribuir()
})

const montoNum = computed(() => {
  const m = Number(monto.value)
  return Number.isFinite(m) ? m : 0
})

const sumAsignado = computed(() =>
  proyectosConSaldo.value.reduce((s, p) => {
    const v = Number(asignaciones.value[p.idProyecto])
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)
)

const excedeSaldoTotal = computed(() => montoNum.value > props.saldoTotal + 0.005)
const descuadre = computed(() => Math.abs(sumAsignado.value - montoNum.value) > 0.01)
const proyectosExcedidos = computed(() =>
  proyectosConSaldo.value.filter((p) => {
    const v = Number(asignaciones.value[p.idProyecto])
    return Number.isFinite(v) && v > p.saldoUsd + 0.005
  })
)

const valido = computed(() =>
  montoNum.value > 0
  && !excedeSaldoTotal.value
  && !descuadre.value
  && proyectosExcedidos.value.length === 0
)

function onConfirm() {
  if (montoNum.value <= 0) {
    toast.add({ title: 'Monto inválido', description: 'Indica un importe mayor a cero.', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  if (excedeSaldoTotal.value) {
    toast.add({ title: 'Monto excede el saldo', description: `El pago no puede superar el saldo pendiente del cliente (${fmt(props.saldoTotal)}).`, color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  if (proyectosExcedidos.value.length) {
    toast.add({ title: 'Asignación inválida', description: 'Hay proyectos con un monto asignado mayor a su saldo.', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  if (descuadre.value) {
    toast.add({ title: 'El reparto no cuadra', description: `La suma asignada (${fmt(sumAsignado.value)}) debe ser igual al monto del pago (${fmt(montoNum.value)}).`, color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  if (!fecha.value) {
    toast.add({ title: 'Fecha requerida', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }

  const lista = proyectosConSaldo.value
    .map(p => ({ idProyecto: p.idProyecto, montoUsd: round2(Number(asignaciones.value[p.idProyecto]) || 0) }))
    .filter(a => a.montoUsd > 0)

  emit('submit', {
    fecha: fecha.value,
    referencia: referencia.value.trim() || undefined,
    formaPago: formaPago.value || undefined,
    asignaciones: lista
  })
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Registrar pago — ${cliente}`"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2 text-sm flex items-center justify-between">
          <span class="text-muted">Saldo total pendiente del cliente</span>
          <span class="tabular-nums font-semibold text-warning">{{ fmt(saldoTotal) }}</span>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Monto del pago (USD)" name="monto" required>
            <UInput
              v-model="monto"
              type="number"
              min="0"
              step="0.01"
              icon="i-lucide-banknote"
              placeholder="0.00"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Fecha de pago recibido" name="fecha" required>
            <UInput
              v-model="fecha"
              type="date"
              icon="i-lucide-calendar"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Referencia" name="referencia">
            <UInput
              v-model="referencia"
              placeholder="Transferencia, folio, etc."
              icon="i-lucide-hash"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Forma de pago" name="formaPago">
            <USelect
              v-model="formaPago"
              :items="formasPago"
              placeholder="Selecciona..."
              class="w-full"
            />
          </UFormField>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-medium text-highlighted">
              Reparto entre proyectos
            </p>
            <UButton
              label="Redistribuir automáticamente"
              icon="i-lucide-wand-2"
              color="neutral"
              variant="subtle"
              size="xs"
              @click="redistribuir"
            />
          </div>

          <div class="overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                  <th class="px-3 py-2 text-start border-b border-default font-medium">
                    Proyecto
                  </th>
                  <th class="w-32 px-3 py-2 text-end border-b border-default font-medium">
                    Saldo
                  </th>
                  <th class="w-36 px-3 py-2 text-end border-b border-default font-medium">
                    A aplicar
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!proyectosConSaldo.length">
                  <td colspan="3" class="py-8 text-center text-muted text-sm">
                    Este cliente no tiene proyectos con saldo pendiente.
                  </td>
                </tr>
                <tr v-for="p in proyectosConSaldo" :key="p.idProyecto" class="hover:bg-elevated/30">
                  <td class="px-3 py-2 border-b border-default">
                    <p class="font-medium text-highlighted font-mono">
                      {{ p.idProyecto }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ p.clienteReal }}
                    </p>
                  </td>
                  <td class="px-3 py-2 border-b border-default text-end tabular-nums text-muted">
                    {{ fmt(p.saldoUsd) }}
                  </td>
                  <td class="px-3 py-2 border-b border-default text-end">
                    <UInput
                      v-model="asignaciones[p.idProyecto]"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      size="sm"
                      class="w-32"
                      :ui="{ base: 'text-end tabular-nums' }"
                      :color="Number(asignaciones[p.idProyecto]) > p.saldoUsd + 0.005 ? 'error' : 'neutral'"
                    />
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-elevated/30 text-sm font-semibold">
                <tr>
                  <td class="px-3 py-2 border-t border-default text-muted">
                    Total asignado
                  </td>
                  <td class="px-3 py-2 border-t border-default" />
                  <td class="px-3 py-2 border-t border-default text-end tabular-nums" :class="descuadre ? 'text-error' : 'text-success'">
                    {{ fmt(sumAsignado) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="mt-2 space-y-1 text-xs">
            <p v-if="excedeSaldoTotal" class="flex items-center gap-1 text-error">
              <UIcon name="i-lucide-alert-circle" class="size-3.5" />
              El monto supera el saldo pendiente del cliente ({{ fmt(saldoTotal) }}).
            </p>
            <p v-else-if="descuadre && montoNum > 0" class="flex items-center gap-1 text-warning">
              <UIcon name="i-lucide-alert-triangle" class="size-3.5" />
              La suma asignada debe ser igual al monto del pago ({{ fmt(montoNum) }}). Diferencia: {{ fmt(montoNum - sumAsignado) }}.
            </p>
            <p v-else-if="proyectosExcedidos.length" class="flex items-center gap-1 text-error">
              <UIcon name="i-lucide-alert-circle" class="size-3.5" />
              Hay proyectos con un monto mayor a su saldo disponible.
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Registrar pago"
            color="primary"
            icon="i-lucide-check"
            :disabled="!valido"
            @click="onConfirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
