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
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold tracking-tight text-primary ring-1 ring-inset ring-primary/20"
      aria-hidden="true"
    >
      SL
    </div>
    <div
      v-if="!collapsed"
      class="min-w-0 flex-1 text-left"
    >
      <p class="truncate text-sm font-semibold text-highlighted">
        Sergio Logística
      </p>
      <p class="truncate text-xs text-muted">
        TradeERP
      </p>
    </div>
  </div>
</template>
