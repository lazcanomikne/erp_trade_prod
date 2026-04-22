<script setup lang="ts">
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import { subtotalDevengadoUsd, servicioUsd } from '~/utils/proyectoCalculos'

const store = useInventarioStore()

const enlaces = [
  {
    titulo: 'Directorio de proyectos',
    descripcion: 'Inventario, SG y estatus logístico.',
    to: '/proyectos',
    icon: 'i-lucide-folder-kanban'
  },
  {
    titulo: 'Cuentas por cobrar',
    descripcion: 'Devengado, pagos y saldos.',
    to: '/cuentas-por-cobrar',
    icon: 'i-lucide-receipt'
  },
  {
    titulo: 'Logística (cortes)',
    descripcion: 'Laredo → Monterrey y manifiestos.',
    to: '/logistica',
    icon: 'i-lucide-truck'
  },
  {
    titulo: 'Arribos no identificados',
    descripcion: 'Excedentes en bodega USA hasta conciliar.',
    to: '/logistica/arribos-no-identificados',
    icon: 'i-heroicons-question-mark-circle'
  },
  {
    titulo: 'Reportes',
    descripcion: 'Comisiones, balance y cartera.',
    to: '/reportes',
    icon: 'i-lucide-pie-chart'
  }
]

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const statsItems = computed<ProjectStatItem[]>(() => {
  const activos = store.listaProyectos().filter(
    p => p.estatus === 'En Proceso' || p.estatus === 'Pendiente de Pago'
  )
  let comisiones = 0
  let lineasLaredo = 0
  for (const p of activos) {
    const d = store.detalle(p.idProyecto)
    comisiones += servicioUsd(subtotalDevengadoUsd(d.articulos), d.porcentajeServicio)
    lineasLaredo += d.articulos.filter(a => a.estatus === 'Laredo').length
  }
  return [
    {
      title: 'Proyectos activos',
      icon: 'i-lucide-briefcase',
      value: String(activos.length),
      tone: 'primary'
    },
    {
      title: 'Comisiones devengadas (vista)',
      icon: 'i-lucide-percent',
      value: formatUsd(comisiones),
      tone: 'success'
    },
    {
      title: 'Líneas aún en Laredo',
      icon: 'i-lucide-container',
      value: String(lineasLaredo),
      tone: 'warning'
    }
  ]
})
</script>

<template>
  <UDashboardPanel id="inicio">
    <template #header>
      <UDashboardNavbar title="Inicio">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="mb-8 max-w-2xl text-muted">
        Panel operativo Sergio Logística: inventario por proyecto, cortes de importación y cobranza alineados al devengado real en Monterrey.
      </p>

      <ProjectStats class="mb-10" :items="statsItems" />

      <h2 class="text-sm font-semibold text-highlighted uppercase tracking-wide mb-4">
        Accesos rápidos
      </h2>
      <UPageGrid class="lg:grid-cols-2 gap-4">
        <UPageCard
          v-for="item in enlaces"
          :key="item.to"
          :title="item.titulo"
          :description="item.descripcion"
          :icon="item.icon"
          :to="item.to"
          variant="subtle"
          :ui="{
            container: 'gap-y-2',
            title: 'text-base font-medium text-highlighted',
            description: 'text-muted text-sm'
          }"
        />
      </UPageGrid>
    </template>
  </UDashboardPanel>
</template>
