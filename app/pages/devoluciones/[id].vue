<script setup lang="ts">
import type { Devolucion } from '~/server/utils/erp/types'

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const { data: dev, refresh } = await useFetch<Devolucion>(`/api/erp/devoluciones/${id}`)

useHead(() => ({ title: dev.value ? `DEV-${String(dev.value.numero).padStart(3, '0')}` : 'Devolución' }))

if (!dev.value) {
  throw createError({ statusCode: 404, statusMessage: 'Devolución no encontrada' })
}

const cancelando = ref(false)
const confirmarCancelacion = ref(false)

async function cancelar() {
  cancelando.value = true
  try {
    await $fetch(`/api/erp/devoluciones/${id}/cancelar`, { method: 'POST' })
    toast.add({ title: 'Devolución cancelada', description: 'Los artículos volvieron a Monterrey.', color: 'success', icon: 'i-lucide-check' })
    confirmarCancelacion.value = false
    await refresh()
  } catch {
    toast.add({ title: 'No se pudo cancelar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    cancelando.value = false
  }
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })
}

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}

const motivoColor: Record<string, string> = {
  'Dañado': 'error',
  'Incompleto': 'warning',
  'Producto incorrecto': 'warning',
  'Área no lista': 'neutral',
  'Otros': 'neutral'
}

const estatusColor: Record<string, string> = {
  'Laredo': 'warning',
  'En Aduana': 'info',
  'Monterrey': 'success'
}
</script>

<template>
  <UDashboardPanel v-if="dev" :id="`devolucion-${dev.id}`">
    <template #header>
      <UDashboardNavbar :title="`DEV-${String(dev.numero).padStart(3, '0')}`">
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <UButton to="/devoluciones" icon="i-lucide-arrow-left" color="neutral" variant="ghost" square />
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UBadge v-if="dev.cancelado" color="error" variant="soft" size="lg">
              Cancelada
            </UBadge>
            <UButton
              v-if="!dev.cancelado"
              label="Cancelar devolución"
              icon="i-lucide-x-circle"
              color="error"
              variant="outline"
              @click="confirmarCancelacion = true"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6 p-1">

        <!-- Encabezado info -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-xl border border-default bg-elevated/30 p-5">
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-1">
              Número
            </p>
            <p class="font-mono font-bold text-primary text-lg">
              DEV-{{ String(dev.numero).padStart(3, '0') }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-1">
              Fecha
            </p>
            <p class="font-medium text-highlighted capitalize">
              {{ formatFecha(dev.fecha) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-1">
              Destino
            </p>
            <UBadge :color="estatusColor[dev.destino] as any" variant="soft" size="md">
              {{ dev.destino }}
            </UBadge>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-1">
              Artículos
            </p>
            <p class="font-semibold text-highlighted">
              {{ dev.articulos.length }} línea(s)
            </p>
          </div>
          <div v-if="dev.notas" class="col-span-2 sm:col-span-4">
            <p class="text-xs text-muted uppercase tracking-wide mb-1">
              Notas
            </p>
            <p class="text-sm text-highlighted">
              {{ dev.notas }}
            </p>
          </div>
          <div v-if="dev.cancelado && dev.canceladoAt" class="col-span-2 sm:col-span-4">
            <p class="text-xs text-error uppercase tracking-wide mb-1">
              Cancelada el
            </p>
            <p class="text-sm text-error font-medium">
              {{ new Date(dev.canceladoAt).toLocaleString('es-MX') }}
            </p>
          </div>
        </div>

        <!-- Aviso cancelación -->
        <div v-if="dev.cancelado" class="flex items-start gap-3 rounded-lg border border-error/30 bg-error/5 p-4">
          <UIcon name="i-lucide-info" class="size-5 text-error shrink-0 mt-0.5" />
          <p class="text-sm text-error">
            Esta devolución fue cancelada. Los artículos se restauraron automáticamente a estatus <strong>Monterrey</strong>.
          </p>
        </div>

        <!-- Tabla de artículos devueltos -->
        <div>
          <h2 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Artículos devueltos
          </h2>
          <div class="rounded-xl border border-default overflow-hidden">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 border-b border-default">
                  <th class="px-4 py-2.5 text-start font-medium text-muted">
                    SG
                  </th>
                  <th class="px-4 py-2.5 text-start font-medium text-muted">
                    Descripción
                  </th>
                  <th class="px-4 py-2.5 text-start font-medium text-muted">
                    Proyecto
                  </th>
                  <th class="px-4 py-2.5 text-start font-medium text-muted">
                    Marca
                  </th>
                  <th class="px-4 py-2.5 text-center font-medium text-muted">
                    Cant.
                  </th>
                  <th class="px-4 py-2.5 text-end font-medium text-muted">
                    Precio unit.
                  </th>
                  <th class="px-4 py-2.5 text-start font-medium text-muted">
                    Motivo
                  </th>
                  <th class="px-4 py-2.5 text-start font-medium text-muted">
                    Estatus actual
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="a in dev.articulos"
                  :key="a.id"
                  class="border-b border-default last:border-0"
                >
                  <td class="px-4 py-3 font-mono text-xs font-semibold">
                    {{ a.sg }}
                  </td>
                  <td class="px-4 py-3 text-highlighted max-w-[240px]">
                    <p class="truncate">
                      {{ a.descripcion }}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-muted text-xs">
                    {{ a.nombreProyecto || '—' }}
                  </td>
                  <td class="px-4 py-3 text-muted text-xs">
                    {{ a.marca || '—' }}
                  </td>
                  <td class="px-4 py-3 text-center font-medium">
                    {{ a.cantidad }}
                  </td>
                  <td class="px-4 py-3 text-end font-mono tabular-nums">
                    {{ a.precioUnitario != null ? formatUsd(a.precioUnitario) : '—' }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-1">
                      <UBadge :color="motivoColor[a.motivo] as any" variant="soft" size="sm">
                        {{ a.motivo }}
                      </UBadge>
                      <span v-if="a.motivoDetalle" class="text-xs text-muted italic">
                        {{ a.motivoDetalle }}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <UBadge v-if="a.estatusActual" :color="estatusColor[a.estatusActual] as any" variant="soft" size="sm">
                      {{ a.estatusActual }}
                    </UBadge>
                    <span v-else class="text-muted text-xs">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal confirmación de cancelación -->
  <UModal v-model:open="confirmarCancelacion" title="Cancelar devolución">
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <UIcon name="i-lucide-triangle-alert" class="size-5 text-warning shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-semibold text-highlighted mb-1">
              ¿Confirmas la cancelación?
            </p>
            <p class="text-muted">
              Todos los artículos de esta devolución volverán automáticamente a estatus <strong>Monterrey</strong>.
              Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        <div class="rounded-lg border border-default bg-elevated/30 p-3">
          <p class="text-xs text-muted font-medium mb-2">
            Artículos que se restaurarán:
          </p>
          <ul class="space-y-1">
            <li
              v-for="a in dev?.articulos"
              :key="a.id"
              class="text-xs flex items-center gap-2"
            >
              <UIcon name="i-lucide-package" class="size-3.5 text-muted shrink-0" />
              <span class="font-mono font-medium">{{ a.sg }}</span>
              <span class="text-muted truncate">{{ a.descripcion }}</span>
              <span class="ml-auto text-muted shrink-0">→ Monterrey</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Mantener devolución" color="neutral" variant="outline" @click="confirmarCancelacion = false" />
        <UButton
          label="Sí, cancelar"
          icon="i-lucide-x-circle"
          color="error"
          :loading="cancelando"
          @click="cancelar"
        />
      </div>
    </template>
  </UModal>
</template>
