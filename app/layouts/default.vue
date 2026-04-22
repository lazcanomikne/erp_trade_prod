<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)
const appConfig = useAppConfig()

const store = useInventarioStore()

useDashboard()

const ni = computed(() => appConfig.navigation?.arribosNoIdentificados)

const links = computed<NavigationMenuItem[][]>(() => [[
  {
    label: 'Dashboard',
    icon: 'i-lucide-house',
    to: '/dashboard',
    onSelect: () => {
      open.value = false
    }
  },
  {
    label: 'Proyectos',
    icon: 'i-lucide-folder-kanban',
    to: '/proyectos',
    onSelect: () => {
      open.value = false
    }
  },
  {
    label: 'Cuentas por cobrar',
    icon: 'i-lucide-receipt',
    to: '/cuentas-por-cobrar',
    onSelect: () => {
      open.value = false
    }
  },
  {
    label: 'Logística',
    icon: 'i-lucide-truck',
    defaultOpen: true,
    children: [
      {
        label: 'Cortes (Laredo → aduana)',
        icon: 'i-lucide-container',
        to: '/logistica',
        onSelect: () => {
          open.value = false
        }
      },
      {
        label: 'Inventario no identificado',
        icon: ni.value?.icon ?? 'i-heroicons-outline-question-mark-circle',
        badge: ni.value?.badge,
        to: '/logistica/arribos-no-identificados',
        onSelect: () => {
          open.value = false
        }
      }
    ]
  },
  {
    label: 'Reportes',
    icon: 'i-lucide-pie-chart',
    to: '/reportes',
    onSelect: () => {
      open.value = false
    }
  }
]])

type CommandEntry = {
  id: string
  label: string
  description?: string
  icon: string
  to?: string
}

const commandGroups = computed(() => {
  const articulosItems: CommandEntry[] = []
  const proyectosItems: CommandEntry[] = []

  for (const p of store.listaProyectos()) {
    proyectosItems.push({
      id: `proy-${p.idProyecto}`,
      label: `${p.nombre} · ${p.idProyecto}`,
      description: p.cliente,
      icon: 'i-lucide-folder-kanban',
      to: `/proyectos/${encodeURIComponent(p.idProyecto)}`
    })
    const d = store.detalle(p.idProyecto)
    for (const a of d.articulos) {
      const ref = (a.referenciaLogistica ?? '').trim()
      const sg = (a.sg ?? '').trim()
      const codigoPrincipal = ref || sg || a.id
      const fuseText = [ref, sg, 'SG/', a.descripcion, p.nombre, p.idProyecto, p.cliente].filter(Boolean).join(' ')
      articulosItems.push({
        id: `art-sg-${p.idProyecto}-${a.id}`,
        label: `${codigoPrincipal} — ${a.descripcion}`,
        description: `${fuseText} · Ir a proyecto`,
        icon: 'i-lucide-scan-barcode',
        to: `/proyectos/${encodeURIComponent(p.idProyecto)}`
      })
    }
  }

  const arriboIcon = ni.value?.icon ?? 'i-heroicons-outline-question-mark-circle'
  const limboItems: CommandEntry[] = store.articulosLimbo.map(l => ({
    id: `arribo-ni-${l.id}`,
    label: `${l.sgProvisional} — ${l.descripcion.slice(0, 48)}`,
    description: `Arribo no identificado · ${l.descripcion}`,
    icon: arriboIcon,
    to: '/logistica/arribos-no-identificados'
  }))

  return [
    { id: 'articulos-sg', label: 'Artículos (SG / referencia)', items: articulosItems },
    { id: 'proyectos', label: 'Proyectos', items: proyectosItems },
    { id: 'limbo', label: 'Arribos no identificados', items: limboItems }
  ]
})

const searchFuse = computed(() => ({
  fuseOptions: {
    keys: ['label', 'description'],
    threshold: 0.22,
    ignoreLocation: true
  }
}))
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch
      :groups="commandGroups"
      :fuse="searchFuse"
    />

    <slot />
  </UDashboardGroup>
</template>
