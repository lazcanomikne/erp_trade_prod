<script setup lang="ts">
import type { MotivoDevolucion, DestinoDevolucion, Devolucion, ArticuloDisponibleDevolucion } from '~/server/utils/erp/types'

useHead({ title: 'Devoluciones' })

type ArticuloSeleccionado = ArticuloDisponibleDevolucion & {
  motivo: MotivoDevolucion
  motivoDetalle: string
}

const toast = useToast()

// ── Lista de devoluciones ──────────────────────────────────────────────────────
const { data: devoluciones, refresh, pending } = await useFetch<Devolucion[]>('/api/erp/devoluciones')

// ── Modal crear ───────────────────────────────────────────────────────────────
const modalOpen = ref(false)
const saving = ref(false)
const disponibles = ref<ArticuloDisponibleDevolucion[]>([])
const loadingDisp = ref(false)
const seleccionados = ref<ArticuloSeleccionado[]>([])
const destino = ref<DestinoDevolucion>('Laredo')
const notas = ref('')

const MOTIVOS: MotivoDevolucion[] = ['Dañado', 'Incompleto', 'Producto incorrecto', 'Área no lista', 'Otros']
const DESTINOS: { label: string, value: DestinoDevolucion }[] = [
  { label: 'Laredo', value: 'Laredo' },
  { label: 'En Aduana', value: 'En Aduana' },
  { label: 'Monterrey', value: 'Monterrey' }
]

async function abrirModal() {
  loadingDisp.value = true
  seleccionados.value = []
  destino.value = 'Laredo'
  notas.value = ''
  modalOpen.value = true
  try {
    disponibles.value = await $fetch<ArticuloDisponibleDevolucion[]>('/api/erp/devoluciones/disponibles')
  } catch {
    toast.add({ title: 'No se pudieron cargar los artículos', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    loadingDisp.value = false
  }
}

function estaSeleccionado(idArticulo: string) {
  return seleccionados.value.some(s => s.idArticulo === idArticulo)
}

function toggleArticulo(art: ArticuloDisponibleDevolucion) {
  const idx = seleccionados.value.findIndex(s => s.idArticulo === art.idArticulo)
  if (idx >= 0) {
    seleccionados.value.splice(idx, 1)
  } else {
    seleccionados.value.push({ ...art, motivo: 'Dañado', motivoDetalle: '' })
  }
}

function getSeleccionado(idArticulo: string): ArticuloSeleccionado | undefined {
  return seleccionados.value.find(s => s.idArticulo === idArticulo)
}

async function guardar() {
  if (!seleccionados.value.length) {
    toast.add({ title: 'Selecciona al menos un artículo', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  for (const s of seleccionados.value) {
    if (s.motivo === 'Otros' && !s.motivoDetalle.trim()) {
      toast.add({ title: `Indica el motivo detallado para: ${s.sg}`, color: 'warning', icon: 'i-lucide-alert-circle' })
      return
    }
  }
  saving.value = true
  try {
    await $fetch('/api/erp/devoluciones', {
      method: 'POST',
      body: {
        destino: destino.value,
        notas: notas.value.trim() || undefined,
        articulos: seleccionados.value.map(s => ({
          idProyecto: s.idProyecto,
          idArticulo: s.idArticulo,
          sg: s.sg,
          descripcion: s.descripcion,
          cantidad: s.cantidadTotal,
          motivo: s.motivo,
          motivoDetalle: s.motivoDetalle.trim() || undefined
        }))
      }
    })
    toast.add({ title: `Devolución registrada`, color: 'success', icon: 'i-lucide-check' })
    modalOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'No se pudo guardar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    saving.value = false
  }
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const motivoColor: Record<MotivoDevolucion, string> = {
  'Dañado': 'error',
  'Incompleto': 'warning',
  'Producto incorrecto': 'warning',
  'Área no lista': 'neutral',
  'Otros': 'neutral'
}
</script>

<template>
  <UDashboardPanel id="devoluciones">
    <template #header>
      <UDashboardNavbar title="Devoluciones">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Nueva devolución"
            icon="i-lucide-undo-2"
            color="primary"
            @click="abrirModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Lista vacía -->
      <div v-if="!pending && !devoluciones?.length" class="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <UIcon name="i-lucide-undo-2" class="size-12 text-muted/40" />
        <p class="text-muted">
          No hay devoluciones registradas.
        </p>
        <UButton label="Registrar primera devolución" icon="i-lucide-plus" @click="abrirModal" />
      </div>

      <!-- Tabla devoluciones -->
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="px-4 py-3 text-start font-medium text-muted">
                #
              </th>
              <th class="px-4 py-3 text-start font-medium text-muted">
                Fecha
              </th>
              <th class="px-4 py-3 text-start font-medium text-muted">
                Destino
              </th>
              <th class="px-4 py-3 text-start font-medium text-muted">
                Artículos
              </th>
              <th class="px-4 py-3 text-start font-medium text-muted">
                Notas
              </th>
              <th class="px-4 py-3 text-start font-medium text-muted">
                Motivos
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="dev in (devoluciones ?? [])"
              :key="dev.id"
              class="border-b border-default hover:bg-elevated/30 transition-colors cursor-pointer"
              @click="navigateTo(`/devoluciones/${dev.id}`)"
            >
              <td class="px-4 py-3 font-mono font-semibold text-primary">
                DEV-{{ String(dev.numero).padStart(3, '0') }}
              </td>
              <td class="px-4 py-3 text-muted">
                {{ formatFecha(dev.fecha) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <UBadge color="neutral" variant="soft">
                    {{ dev.destino }}
                  </UBadge>
                  <UBadge v-if="dev.cancelado" color="error" variant="soft">
                    Cancelada
                  </UBadge>
                </div>
              </td>
              <td class="px-4 py-3 font-medium">
                {{ dev.articulos.length }} artículo(s)
              </td>
              <td class="px-4 py-3 text-muted text-xs max-w-[180px] truncate">
                {{ dev.notas || '—' }}
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="a in dev.articulos"
                    :key="a.id"
                    :color="motivoColor[a.motivo] as any"
                    variant="soft"
                    size="sm"
                  >
                    {{ a.sg }} · {{ a.motivo }}
                  </UBadge>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal nueva devolución -->
  <UModal v-model:open="modalOpen" title="Nueva devolución" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div class="flex flex-col gap-5">

        <!-- Destino global -->
        <div class="flex items-center gap-4 rounded-lg border border-default bg-elevated/30 p-4">
          <UIcon name="i-lucide-map-pin" class="size-5 text-primary shrink-0" />
          <div class="flex-1">
            <p class="text-sm font-medium mb-2">
              ¿A dónde se devuelven los artículos?
            </p>
            <div class="flex gap-2">
              <UButton
                v-for="d in DESTINOS"
                :key="d.value"
                :label="d.label"
                size="sm"
                :color="destino === d.value ? 'primary' : 'neutral'"
                :variant="destino === d.value ? 'solid' : 'outline'"
                @click="destino = d.value"
              />
            </div>
          </div>
        </div>

        <!-- Artículos disponibles -->
        <div>
          <p class="text-sm font-semibold mb-2 text-highlighted">
            Artículos en Monterrey disponibles para devolución
          </p>

          <div v-if="loadingDisp" class="py-8 text-center text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
          </div>

          <div v-else-if="!disponibles.length" class="rounded-lg border border-default py-8 text-center text-muted text-sm">
            No hay artículos en Monterrey sin entrega confirmada.
          </div>

          <div v-else class="rounded-lg border border-default overflow-hidden">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-elevated/50 border-b border-default">
                  <th class="w-8 px-3 py-2" />
                  <th class="px-3 py-2 text-start font-medium">
                    SG
                  </th>
                  <th class="px-3 py-2 text-start font-medium">
                    Descripción
                  </th>
                  <th class="px-3 py-2 text-start font-medium">
                    Proyecto
                  </th>
                  <th class="px-3 py-2 text-start font-medium">
                    Motivo
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="art in disponibles" :key="art.idArticulo">
                  <tr
                    class="border-b border-default cursor-pointer transition-colors"
                    :class="estaSeleccionado(art.idArticulo) ? 'bg-primary/5' : 'hover:bg-elevated/30'"
                    @click="toggleArticulo(art)"
                  >
                    <td class="px-3 py-2 text-center" @click.stop>
                      <input
                        type="checkbox"
                        :checked="estaSeleccionado(art.idArticulo)"
                        class="size-4 cursor-pointer accent-primary"
                        @change="toggleArticulo(art)"
                      >
                    </td>
                    <td class="px-3 py-2 font-mono text-xs font-medium">
                      {{ art.sg }}
                    </td>
                    <td class="px-3 py-2 max-w-[200px] truncate">
                      {{ art.descripcion }}
                    </td>
                    <td class="px-3 py-2 text-muted text-xs">
                      {{ art.nombreProyecto }}
                    </td>
                    <td class="px-3 py-2" @click.stop>
                      <div v-if="estaSeleccionado(art.idArticulo)" class="flex flex-col gap-1.5">
                        <USelect
                          :model-value="getSeleccionado(art.idArticulo)!.motivo"
                          :items="MOTIVOS"
                          size="sm"
                          class="w-44"
                          @update:model-value="(v: string) => { const s = getSeleccionado(art.idArticulo); if (s) s.motivo = v as MotivoDevolucion }"
                        />
                        <UInput
                          v-if="getSeleccionado(art.idArticulo)?.motivo === 'Otros'"
                          :model-value="getSeleccionado(art.idArticulo)!.motivoDetalle"
                          placeholder="Describe el motivo…"
                          size="sm"
                          class="w-44"
                          @update:model-value="(v: string) => { const s = getSeleccionado(art.idArticulo); if (s) s.motivoDetalle = v }"
                        />
                      </div>
                      <span v-else class="text-muted text-xs">—</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <p v-if="seleccionados.length" class="mt-2 text-xs text-muted">
            {{ seleccionados.length }} artículo(s) seleccionado(s)
          </p>
        </div>

        <!-- Notas opcionales -->
        <UFormField label="Notas (opcional)">
          <UTextarea
            v-model="notas"
            placeholder="Observaciones sobre la devolución…"
            :rows="2"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="modalOpen = false" />
        <UButton
          label="Registrar devolución"
          icon="i-lucide-undo-2"
          color="primary"
          :loading="saving"
          :disabled="!seleccionados.length"
          @click="guardar"
        />
      </div>
    </template>
  </UModal>
</template>
