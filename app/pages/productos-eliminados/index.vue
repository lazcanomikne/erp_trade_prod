<script setup lang="ts">
import type { ArticuloEliminado } from '~/types'

useHead({ title: 'Productos eliminados' })

const store = useInventarioStore()
const toast = useToast()
const busqueda = ref('')

const eliminados = ref<ArticuloEliminado[]>([])

async function cargar() {
  try {
    eliminados.value = await $fetch<ArticuloEliminado[]>('/api/erp/articulos/eliminados')
  } catch {
    eliminados.value = []
  }
}
await cargar()

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return eliminados.value
  return eliminados.value.filter(a =>
    a.sg.toLowerCase().includes(q) ||
    a.descripcion.toLowerCase().includes(q) ||
    (a.proyectoNombre ?? '').toLowerCase().includes(q) ||
    (a.proyectoCliente ?? '').toLowerCase().includes(q) ||
    (a.eliminacionComentario ?? '').toLowerCase().includes(q)
  )
})

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v)
}

function estatusColor(e: string) {
  if (e === 'Monterrey') return 'success'
  if (e === 'En Aduana') return 'warning'
  return 'neutral'
}

const restaurando = ref<string | null>(null)

async function restaurar(art: ArticuloEliminado) {
  restaurando.value = art.id
  try {
    await store.restaurarArticulo(art.id)
    await cargar()
    toast.add({ title: `Artículo restaurado: ${art.sg}`, color: 'success', icon: 'i-lucide-refresh-cw' })
  } catch {
    toast.add({ title: 'No se pudo restaurar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    restaurando.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="productos-eliminados">
    <template #header>
      <UDashboardNavbar title="Productos eliminados">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col">
        <div class="mb-3 flex flex-wrap items-center gap-3 lg:shrink-0">
          <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar SG, descripción, proyecto, comentario…" class="w-full max-w-xs" />
          <UBadge color="error" variant="soft">{{ filtrados.length }} eliminado(s)</UBadge>
        </div>

        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div v-if="!filtrados.length" class="flex flex-col items-center justify-center py-20 text-muted gap-3">
            <UIcon name="i-lucide-trash-2" class="size-10 text-muted/40" />
            <p class="text-sm">No hay productos eliminados.</p>
          </div>

          <div v-else class="overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">Artículo</th>
                  <th class="w-28 px-3 py-2.5 text-start border-b border-default font-medium">Proyecto</th>
                  <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">Cant.</th>
                  <th class="w-24 px-3 py-2.5 text-center border-b border-default font-medium">Estatus</th>
                  <th class="px-3 py-2.5 text-start border-b border-default font-medium">Razón eliminación</th>
                  <th class="w-32 px-3 py-2.5 text-start border-b border-default font-medium">Fecha</th>
                  <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in filtrados" :key="a.id" class="hover:bg-elevated/30 transition-colors">
                  <td class="px-3 py-2.5 border-b border-default">
                    <p class="font-medium text-highlighted">{{ a.descripcion }}</p>
                    <p class="text-xs text-muted font-mono">{{ a.sg }}</p>
                    <p v-if="a.marca" class="text-xs text-muted">{{ a.marca }}</p>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default">
                    <p class="text-sm text-muted truncate max-w-28">{{ a.proyectoNombre || '—' }}</p>
                    <p class="text-xs text-muted truncate">{{ a.proyectoCliente || '' }}</p>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-center font-medium">{{ a.cantidadTotal }}</td>
                  <td class="px-3 py-2.5 border-b border-default text-center">
                    <UBadge :color="estatusColor(a.estatus)" variant="subtle" size="sm">{{ a.estatus }}</UBadge>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default">
                    <p class="text-sm text-muted italic">{{ a.eliminacionComentario || '—' }}</p>
                  </td>
                  <td class="px-3 py-2.5 border-b border-default text-xs text-muted">{{ a.deletedAt }}</td>
                  <td class="px-3 py-2.5 border-b border-default text-center">
                    <UButton
                      label="Restaurar"
                      icon="i-lucide-refresh-cw"
                      size="xs"
                      color="primary"
                      variant="outline"
                      :loading="restaurando === a.id"
                      :disabled="restaurando !== null"
                      @click="restaurar(a)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
