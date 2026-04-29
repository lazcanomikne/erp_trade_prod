<script setup lang="ts">
export interface ProjectStatItem {
  title: string
  icon: string
  value: string
  tone?: 'primary' | 'success' | 'info' | 'warning'
}

const { items } = defineProps<{
  items: ProjectStatItem[]
}>()

const toneUi: Record<NonNullable<ProjectStatItem['tone']>, string> = {
  primary: 'bg-primary/10 ring ring-inset ring-primary/25',
  success: 'bg-success/10 ring ring-inset ring-success/25',
  info: 'bg-info/10 ring ring-inset ring-info/25',
  warning: 'bg-warning/10 ring ring-inset ring-warning/25'
}
</script>

<template>
  <UPageGrid :class="['gap-4 lg:gap-px', items.length >= 6 ? 'sm:grid-cols-3 lg:grid-cols-6' : items.length === 5 ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4']">
    <UPageCard
      v-for="(stat, index) in items"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: `p-2.5 rounded-full ${toneUi[stat.tone ?? 'primary']}`,
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
    >
      <span class="text-2xl font-semibold tabular-nums text-highlighted">
        {{ stat.value }}
      </span>
    </UPageCard>
  </UPageGrid>
</template>
