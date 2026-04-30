<script setup lang="ts">
import { totalProyectoConCargosUsd } from '~/utils/proyectoCalculos'

const store = useInventarioStore()

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX').format(n)
}

const kpis = computed(() => {
  const activos = store.listaProyectos().filter(p => p.estatus !== 'Completado')

  let productosActivos = 0
  let productosLaredo = 0
  let productosAduana = 0
  let productosTotal = 0

  for (const p of store.listaProyectos()) {
    const det = store.detalle(p.idProyecto)
    const esActivo = p.estatus !== 'Completado'
    for (const a of det.articulos) {
      productosTotal += a.cantidadTotal
      if (esActivo) productosActivos += a.cantidadTotal
      if (a.estatus === 'Laredo') productosLaredo += a.cantidadTotal
      if (a.estatus === 'En Aduana' || a.estatus === 'Sin Estatus') productosAduana += a.cantidadTotal
    }
  }

  return [
    {
      label: 'Proyectos activos',
      value: fmt(activos.length),
      icon: 'i-lucide-folder-kanban',
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      label: 'Productos en proyectos activos',
      value: fmt(productosActivos),
      icon: 'i-lucide-package',
      color: 'text-info',
      bg: 'bg-info/10'
    },
    {
      label: 'Productos en Laredo',
      value: fmt(productosLaredo),
      icon: 'i-lucide-container',
      color: 'text-neutral-500',
      bg: 'bg-neutral-500/10'
    },
    {
      label: 'Productos en Aduana',
      value: fmt(productosAduana),
      icon: 'i-lucide-landmark',
      color: 'text-warning',
      bg: 'bg-warning/10'
    },
    {
      label: 'Total productos en inventario',
      value: fmt(productosTotal),
      icon: 'i-lucide-boxes',
      color: 'text-success',
      bg: 'bg-success/10'
    }
  ]
})

const accesos = [
  {
    label: 'Proyectos',
    desc: 'Detalle de artículos, SG y financiero',
    to: '/proyectos',
    icon: 'i-lucide-folder-kanban',
    color: 'text-primary',
    bg: 'bg-primary/10'
  },
  {
    label: 'Clientes',
    desc: 'Cartera, saldos y pagos por cliente',
    to: '/clientes',
    icon: 'i-lucide-users',
    color: 'text-info',
    bg: 'bg-info/10'
  },
  {
    label: 'Inventario',
    desc: 'Todos los artículos con estatus logístico',
    to: '/inventario',
    icon: 'i-lucide-box',
    color: 'text-success',
    bg: 'bg-success/10'
  },
  {
    label: 'Entregas',
    desc: 'Hoja de ruta, confirmación y firma',
    to: '/entregas',
    icon: 'i-lucide-package-check',
    color: 'text-teal-500',
    bg: 'bg-teal-500/10'
  },
  {
    label: 'Logística',
    desc: 'Cortes Laredo → Monterrey',
    to: '/logistica',
    icon: 'i-lucide-truck',
    color: 'text-warning',
    bg: 'bg-warning/10'
  },
  {
    label: 'Reportes',
    desc: 'Artículos Laredo, Mty, CxC, entregados',
    to: '/reportes',
    icon: 'i-lucide-pie-chart',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10'
  },
  {
    label: 'Cuentas por cobrar',
    desc: 'Saldos y pendientes de pago',
    to: '/cuentas-por-cobrar',
    icon: 'i-lucide-receipt',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10'
  },
  {
    label: 'Arribos no identificados',
    desc: 'Mercancía en bodega sin proyecto asignado',
    to: '/logistica/arribos-no-identificados',
    icon: 'i-lucide-circle-help',
    color: 'text-neutral-500',
    bg: 'bg-neutral-500/10'
  }
]
</script>

<template>
  <UDashboardPanel id="inicio">
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-8">

        <!-- KPIs -->
        <div>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Indicadores</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div
              v-for="kpi in kpis"
              :key="kpi.label"
              class="flex flex-col gap-3 rounded-xl border border-default bg-elevated/30 p-4"
            >
              <div :class="['flex size-10 items-center justify-center rounded-lg', kpi.bg]">
                <UIcon :name="kpi.icon" :class="['size-5', kpi.color]" />
              </div>
              <div>
                <p class="text-2xl font-bold tabular-nums text-highlighted">{{ kpi.value }}</p>
                <p class="mt-0.5 text-xs text-muted leading-tight">{{ kpi.label }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Accesos rápidos -->
        <div>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Accesos rápidos</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <NuxtLink
              v-for="item in accesos"
              :key="item.to"
              :to="item.to"
              class="group flex items-center gap-3 rounded-xl border border-default bg-elevated/30 p-3.5 transition-all hover:bg-elevated hover:border-primary/30 hover:shadow-sm"
            >
              <div :class="['flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors', item.bg]">
                <UIcon :name="item.icon" :class="['size-5 transition-transform group-hover:scale-110', item.color]" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-highlighted text-sm">{{ item.label }}</p>
                <p class="truncate text-xs text-muted">{{ item.desc }}</p>
              </div>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </NuxtLink>
          </div>
        </div>

      </div>
    </template>
  </UDashboardPanel>
</template>
