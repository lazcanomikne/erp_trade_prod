<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const toast = useToast()

const emit = defineEmits<{
  submit: [montoUsd: number]
}>()

const monto = ref('')

watch(open, (v) => {
  if (v) {
    monto.value = ''
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
  emit('submit', m)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Registrar pago"
    description="Registro local (demo); no conecta a pasarela."
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
        <div class="flex justify-end gap-2">
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
