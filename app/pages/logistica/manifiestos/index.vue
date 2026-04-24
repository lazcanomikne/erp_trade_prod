<script setup lang="ts">
import type { ManifiestoResumen } from '~/types'

const route = useRoute()
const toast = useToast()

const filtroProy = ref((route.query.proyecto as string) ?? '')
const busqueda = ref('')

const { data: lista, refresh, pending } = await useFetch<ManifiestoResumen[]>('/api/erp/manifiestos')

const listaFiltrada = computed(() => {
  if (!lista.value) return []
  const q = busqueda.value.toLowerCase()
  return lista.value.filter(m => {
    if (filtroProy.value && !m.proyectos.includes(filtroProy.value) &&
        !m.proyectos.some(p => p.toLowerCase().includes(filtroProy.value.toLowerCase()))) return false
    if (q) {
      const hay = [String(m.folio), m.fecha, m.observaciones ?? '', ...m.proyectos].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v)
}

function formatFecha(iso: string) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function folio(n: number) { return `MF-${String(n).padStart(4, '0')}` }
</script>

<template>
  <UDashboardPanel id="manifiestos">
    <template #header>
      <UDashboardNavbar title="Manifiestos de importación">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Ir a Cortes Laredo"
            icon="i-lucide-truck"
            color="neutral"
            variant="outline"
            to="/logistica"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filtros -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <UInput
          v-model="busqueda"
          placeholder="Buscar folio, proyecto, fecha…"
          icon="i-lucide-search"
          class="w-64"
        />
        <UInput
          v-model="filtroProy"
          placeholder="Filtrar por proyecto…"
          icon="i-lucide-folder-kanban"
          class="w-52"
        />
        <span class="ml-auto text-sm text-muted">{{ listaFiltrada.length }} manifiesto(s)</span>
      </div>

      <!-- Estado vacío / loading -->
      <div v-if="pending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div
        v-else-if="!listaFiltrada.length"
        class="rounded-lg border border-dashed border-default px-4 py-12 text-center text-muted"
      >
        {{ !lista?.length ? 'No hay manifiestos generados aún.' : 'Ningún manifiesto coincide con los filtros.' }}
      </div>

      <!-- Tabla -->
      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/50">
            <tr>
              <th class="border-b border-default px-4 py-2 text-left text-xs font-medium text-muted">Folio</th>
              <th class="border-b border-default px-4 py-2 text-left text-xs font-medium text-muted">Fecha</th>
              <th class="border-b border-default px-4 py-2 text-left text-xs font-medium text-muted">Proyectos</th>
              <th class="border-b border-default px-4 py-2 text-center text-xs font-medium text-muted">Líneas</th>
              <th class="border-b border-default px-4 py-2 text-right text-xs font-medium text-muted">Valor corte</th>
              <th class="border-b border-default px-4 py-2 text-left text-xs font-medium text-muted">Observaciones</th>
              <th class="border-b border-default px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in listaFiltrada"
              :key="m.id"
              class="border-b border-default/60 last:border-b-0 hover:bg-elevated/40"
            >
              <td class="px-4 py-2 font-mono font-semibold text-primary">
                {{ folio(m.folio) }}
              </td>
              <td class="px-4 py-2">
                {{ formatFecha(m.fecha) }}
              </td>
              <td class="px-4 py-2">
                <p v-for="p in m.proyectos" :key="p" class="text-xs text-muted">
                  {{ p }}
                </p>
                <p v-if="!m.proyectos.length" class="text-xs text-muted">
                  —
                </p>
              </td>
              <td class="px-4 py-2 text-center tabular-nums">
                {{ m.totalLineas }}
              </td>
              <td class="px-4 py-2 text-right tabular-nums font-medium">
                {{ formatUsd(m.totalValorCorte) }}
              </td>
              <td class="max-w-[200px] truncate px-4 py-2 text-xs text-muted">
                {{ m.observaciones || '—' }}
              </td>
              <td class="px-4 py-2">
                <UButton
                  :to="`/logistica/manifiestos/${m.id}`"
                  label="Ver"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-eye"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UDashboardPanel>
</template>
