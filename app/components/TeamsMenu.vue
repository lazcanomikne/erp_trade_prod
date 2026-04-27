<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <div
    class="flex w-full items-center gap-2 px-1 py-0.5"
    :class="collapsed ? 'justify-center' : ''"
  >
    <img
      src="/logo.png"
      alt="Logística Internacional"
      class="size-9 shrink-0 rounded-lg object-contain"
    >
    <div
      v-if="!collapsed"
      class="min-w-0 flex-1 text-left"
    >
      <p class="truncate text-sm font-semibold text-highlighted">
        Logística Internacional
      </p>
      <p class="truncate text-xs text-muted">
        TradeERP
      </p>
    </div>
  </div>
</template>
