<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const toast = useToast()

const props = defineProps<{
  titulo?: string
  initialValues?: {
    montoUsd?: number
    fecha?: string
    referencia?: string
    formaPago?: string
  }
}>()

const emit = defineEmits<{
  submit: [payload: { montoUsd: number; fecha: string; referencia?: string; formaPago?: string }]
}>()

const formasPago = ['Efectivo', 'Transferencia', 'Cheque', 'Otros']

const monto = ref('')
const fecha = ref('')
const referencia = ref('')
const formaPago = ref('')

watch(open, (v) => {
  if (v) {
    monto.value = props.initialValues?.montoUsd ? String(props.initialValues.montoUsd) : ''
    fecha.value = props.initialValues?.fecha ?? new Date().toISOString().slice(0, 10)
    referencia.value = props.initialValues?.referencia ?? ''
    formaPago.value = props.initialValues?.formaPago ?? ''
  }
})

function onConfirm() {
  const m = Number(monto.value)
  if (!Number.isFinite(m) || m <= 0) {
    toast.add({
      title: 'Monto inválido',
      description: 'Indica un importe mayor a cero.',
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  if (!fecha.value) {
    toast.add({ title: 'Fecha requerida', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  emit('submit', {
    montoUsd: m,
    fecha: fecha.value,
    referencia: referencia.value.trim() || undefined,
    formaPago: formaPago.value || undefined
  })
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="titulo ?? 'Registrar pago'"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Monto (USD)" name="monto" required>
          <UInput
            v-model="monto"
            type="number"
            min="0"
            step="0.01"
            icon="i-lucide-banknote"
            placeholder="0.00"
            class="w-full"
            @keydown.enter.prevent="onConfirm"
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
            placeholder="Número de transferencia, folio, etc."
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

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Registrar"
            color="primary"
            icon="i-lucide-check"
            @click="onConfirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
