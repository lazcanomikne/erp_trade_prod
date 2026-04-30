<script setup lang="ts">
import type { ProjectStatItem } from '~/components/project/ProjectStats.vue'
import {
  totalProyectoConCargosUsd,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

useHead({ title: 'Reportes' })

const store = useInventarioStore()

try {
  await store.refreshFromApi()
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos.' })
}

const resumen = computed(() => {
  let cartera = 0
  let totalProy = 0
  let pagado = 0
  let laredo = 0
  let enAduana = 0
  let monterrey = 0

  for (const p of store.listaProyectos()) {
    const det = store.detalle(p.idProyecto)
    const va = valorTotalProyectoDesdeArticulos(det.articulos)
    cartera += va > 0 ? va : p.valorTotalUsd
    totalProy += totalProyectoConCargosUsd(
      det.articulos, det.tarifaImportacionPct, det.aduanaUsd, det.fleteUsd,
      {
        maniobrasUsd: det.maniobrasUsd, fleteLaredoMtyUsd: det.fleteLaredoMtyUsd,
        fleteNacionalUsd: det.fleteNacionalUsd, fletesExtra: det.fletesExtra,
        otrosExtras: det.otrosExtras, igiPct: det.igiPct,
        wireTransferUsd: det.wireTransferUsd, comercializadoraPct: det.comercializadoraPct,
        despachoAduanalDivisor: det.despachoAduanalDivisor, fleteLogisticaDivisor: det.fleteLogisticaDivisor
      },
      p.compradoPorTrade
    )
    pagado += det.pagos.reduce((s, pg) => s + pg.montoUsd, 0) + det.anticipoUsd
    for (const a of det.articulos) {
      if (a.estatus === 'Laredo') laredo++
      else if (a.estatus === 'En Aduana' || a.estatus === 'Sin Estatus') enAduana++
      else if (a.estatus === 'Monterrey') monterrey++
    }
  }
  return { cartera, totalProy, pagado, saldo: totalProy - pagado, laredo, enAduana, monterrey }
})

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v)
}

const statsItems = computed<ProjectStatItem[]>(() => [
  { title: 'Cartera artículos', icon: 'i-lucide-package', value: fmt(resumen.value.cartera), tone: 'primary' },
  { title: 'Total proyectos', icon: 'i-lucide-circle-dollar-sign', value: fmt(resumen.value.totalProy), tone: 'info' },
  { title: 'Total pagado', icon: 'i-lucide-wallet', value: fmt(resumen.value.pagado), tone: 'success' },
  {
    title: 'Saldo pendiente',
    icon: 'i-lucide-scale',
    value: fmt(Math.max(0, resumen.value.saldo)),
    tone: resumen.value.saldo > 0 ? 'warning' : 'success'
  }
])

const reportes = computed(() => [
  {
    to: '/reportes/cuentas-por-cobrar',
    icon: 'i-lucide-receipt',
    color: 'text-warning',
    bg: 'bg-warning/10',
    titulo: 'Cuentas por Cobrar',
    descripcion: 'Saldo pendiente por proyecto y cliente. Anticipo, pagos y total del proyecto.'
  },
  {
    to: '/reportes/articulos-entregados',
    icon: 'i-lucide-package-check',
    color: 'text-success',
    bg: 'bg-success/10',
    titulo: 'Artículos Entregados',
    descripcion: `Artículos con registro de entrega al cliente final. General y por cliente.`
  },
  {
    to: '/reportes/articulos-laredo',
    icon: 'i-lucide-warehouse',
    color: 'text-info',
    bg: 'bg-info/10',
    titulo: 'Artículos en Laredo',
    descripcion: `Artículos pendientes en Laredo sin importar. (${resumen.value.laredo} artículos)`
  },
  {
    to: '/reportes/articulos-monterrey',
    icon: 'i-lucide-map-pin',
    color: 'text-primary',
    bg: 'bg-primary/10',
    titulo: 'Artículos en Monterrey',
    descripcion: `Inventario recibido en Monterrey. General y por cliente. (${resumen.value.monterrey} artículos)`
  }
])
</script>

<template>
  <UDashboardPanel id="reportes">
    <template #header>
      <UDashboardNavbar title="Reportes">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-8">
        <ProjectStats :items="statsItems" />

        <div>
          <h2 class="text-lg font-semibold text-highlighted mb-4">Reportes disponibles</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <NuxtLink
              v-for="r in reportes"
              :key="r.to"
              :to="r.to"
              class="group flex gap-4 rounded-xl border border-default bg-elevated/20 p-5 transition-all hover:bg-elevated/50 hover:border-primary/30"
            >
              <div :class="[r.bg, 'flex size-12 shrink-0 items-center justify-center rounded-lg']">
                <UIcon :name="r.icon" :class="[r.color, 'size-6']" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-highlighted group-hover:text-primary transition-colors">{{ r.titulo }}</p>
                <p class="text-sm text-muted mt-0.5 leading-snug">{{ r.descripcion }}</p>
              </div>
              <UIcon name="i-lucide-arrow-right" class="size-4 text-muted shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
            </NuxtLink>
          </div>
        </div>

        <div class="rounded-lg border border-default bg-elevated/20 p-4 text-sm">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-lucide-info" class="size-4 text-info" />
            <span class="font-medium text-highlighted">Distribución actual de artículos</span>
          </div>
          <div class="flex flex-wrap gap-5">
            <span class="flex items-center gap-2">
              <span class="size-2.5 rounded-full bg-neutral-400 inline-block" />
              <span class="text-muted">Laredo:</span> <strong class="text-highlighted">{{ resumen.laredo }}</strong>
            </span>
            <span class="flex items-center gap-2">
              <span class="size-2.5 rounded-full bg-amber-400 inline-block" />
              <span class="text-muted">En Aduana:</span> <strong class="text-highlighted">{{ resumen.enAduana }}</strong>
            </span>
            <span class="flex items-center gap-2">
              <span class="size-2.5 rounded-full bg-emerald-500 inline-block" />
              <span class="text-muted">Monterrey:</span> <strong class="text-highlighted">{{ resumen.monterrey }}</strong>
            </span>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
