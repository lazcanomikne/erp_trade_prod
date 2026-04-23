<script setup lang="ts">
const props = defineProps<{
  titulo: string
  subtitulo?: string
}>()

const fecha = new Date().toLocaleDateString('es-MX', {
  year: 'numeric', month: 'long', day: 'numeric'
})
</script>

<template>
  <div class="hidden print:flex items-center justify-between border-b-2 border-gray-800 pb-3 mb-4">
    <img src="/logo.png" alt="Logística Internacional" class="h-14 object-contain" />
    <div class="text-right">
      <p class="text-lg font-bold text-gray-900">{{ props.titulo }}</p>
      <p v-if="props.subtitulo" class="text-sm text-gray-600">{{ props.subtitulo }}</p>
      <p class="text-xs text-gray-500 mt-0.5">Generado el {{ fecha }}</p>
    </div>
  </div>
</template>
