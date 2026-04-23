<script setup lang="ts">
import type { Entrega, EntregaEstatus, EntregaDestino } from '~/types'

const route = useRoute()
const toast = useToast()
const entregasStore = useEntregasStore()

const id = decodeURIComponent(route.params.id as string)

try {
  await entregasStore.refreshFromApi()
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos.' })
}

const entrega = computed<Entrega | undefined>(() => entregasStore.getEntregaById(id))

if (!entrega.value) {
  throw createError({ statusCode: 404, statusMessage: 'Entrega no encontrada' })
}

const estatusOpciones = [
  { label: 'Pendiente', value: 'Pendiente' },
  { label: 'En Ruta', value: 'En Ruta' },
  { label: 'Parcial', value: 'Parcial' },
  { label: 'Entregado', value: 'Entregado' }
]

function estatusColor(e: EntregaEstatus) {
  if (e === 'Entregado') return 'success'
  if (e === 'En Ruta') return 'info'
  if (e === 'Parcial') return 'warning'
  return 'neutral'
}

const savingEstatus = ref(false)
async function cambiarEstatus(estatus: EntregaEstatus) {
  savingEstatus.value = true
  try {
    await entregasStore.actualizarEntrega(id, { estatus })
    toast.add({ title: `Estatus: ${estatus}`, color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: 'No se actualizó el estatus', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEstatus.value = false
  }
}

async function toggleEntregado(artId: string, entregado: boolean) {
  try {
    await entregasStore.marcarArticuloEntregado(id, artId, entregado)
  } catch {
    toast.add({ title: 'No se actualizó', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

// ─── Por cliente ──────────────────────────────────────────────────────────────
const porCliente = computed(() => {
  if (!entrega.value) return []
  const map = new Map<string, typeof entrega.value.articulos>()
  for (const a of entrega.value.articulos) {
    if (!map.has(a.cliente)) map.set(a.cliente, [])
    map.get(a.cliente)!.push(a)
  }
  return Array.from(map.entries()).map(([cliente, arts]) => ({ cliente, arts }))
})

// ─── Confirmación de destino ──────────────────────────────────────────────────
const modalConfirmar = ref(false)
const destinoActivo = ref<EntregaDestino | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const dibujando = ref(false)
const fotoArchivo = ref<File | null>(null)
const savingConfirm = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let lastX = 0
let lastY = 0

function abrirConfirmar(dest: EntregaDestino) {
  destinoActivo.value = dest
  fotoArchivo.value = null
  modalConfirmar.value = true
  nextTick(() => {
    if (canvasRef.value) {
      ctx = canvasRef.value.getContext('2d')
      limpiarFirma()
    }
  })
}

function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  if (e instanceof TouchEvent) {
    const t = e.touches[0]!
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function iniciarDibujo(e: MouseEvent | TouchEvent) {
  if (!canvasRef.value) return
  e.preventDefault()
  dibujando.value = true
  const pos = getPos(e, canvasRef.value)
  lastX = pos.x; lastY = pos.y
}

function dibujar(e: MouseEvent | TouchEvent) {
  if (!dibujando.value || !ctx || !canvasRef.value) return
  e.preventDefault()
  const pos = getPos(e, canvasRef.value)
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(pos.x, pos.y)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.stroke()
  lastX = pos.x; lastY = pos.y
}

function terminarDibujo() { dibujando.value = false }

function limpiarFirma() {
  if (!canvasRef.value || !ctx) return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)
}

async function guardarConfirmacion() {
  if (!destinoActivo.value) return
  savingConfirm.value = true
  try {
    let firmaUrl: string | null = null
    let fotoUrl: string | null = null

    if (canvasRef.value) {
      firmaUrl = canvasRef.value.toDataURL('image/png')
    }
    if (fotoArchivo.value) {
      const fd = new FormData()
      fd.append('file', fotoArchivo.value)
      try {
        const up = await $fetch<{ url: string }>('/api/articulos/upload', { method: 'POST', body: fd })
        fotoUrl = up.url
      } catch { /* no foto */ }
    }

    await entregasStore.confirmarDestino(id, destinoActivo.value.id, {
      confirmado: true,
      firmaUrl,
      fotoUrl
    })
    await entregasStore.refreshFromApi()
    modalConfirmar.value = false
    toast.add({ title: `Entrega confirmada: ${destinoActivo.value.cliente}`, color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: 'No se pudo confirmar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingConfirm.value = false
  }
}

// ─── Imprimir ─────────────────────────────────────────────────────────────────
function imprimir() { window.print() }
</script>

<template>
  <UDashboardPanel v-if="entrega" :id="`entrega-${entrega.id}`">
    <template #header>
      <UDashboardNavbar :title="entrega.descripcion">
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <UButton to="/entregas" icon="i-lucide-arrow-left" color="neutral" variant="ghost" square />
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UBadge :color="estatusColor(entrega.estatus)" variant="soft">{{ entrega.estatus }}</UBadge>
            <UButton icon="i-lucide-printer" label="Imprimir" color="neutral" variant="outline" @click="imprimir" class="print:hidden" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="lg:flex lg:h-full lg:flex-col gap-4">

        <!-- Info general -->
        <div class="lg:shrink-0 rounded-lg border border-default bg-elevated/30 p-4">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p class="text-xs text-muted uppercase tracking-wide mb-0.5">Chofer</p>
              <p class="font-medium text-highlighted">{{ entrega.chofer || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted uppercase tracking-wide mb-0.5">Fecha programada</p>
              <p class="font-medium text-highlighted">{{ entrega.fechaProgramada || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted uppercase tracking-wide mb-0.5">Origen</p>
              <p class="font-medium text-highlighted">{{ entrega.origen || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted uppercase tracking-wide mb-0.5">Notas</p>
              <p class="text-muted">{{ entrega.notas || '—' }}</p>
            </div>
          </div>

          <!-- Cambiar estatus -->
          <div class="mt-3 pt-3 border-t border-default/60 flex flex-wrap items-center gap-2 print:hidden">
            <span class="text-xs text-muted">Cambiar estatus:</span>
            <UButton
              v-for="op in estatusOpciones"
              :key="op.value"
              :label="op.label"
              size="xs"
              :color="entrega.estatus === op.value ? 'primary' : 'neutral'"
              :variant="entrega.estatus === op.value ? 'solid' : 'outline'"
              :loading="savingEstatus && entrega.estatus === op.value"
              @click="cambiarEstatus(op.value as EntregaEstatus)"
            />
          </div>
        </div>

        <!-- Destinos -->
        <div class="lg:shrink-0">
          <h2 class="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Destinos</h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="dest in entrega.destinos"
              :key="dest.id"
              class="rounded-lg border border-default p-3"
              :class="dest.confirmado ? 'border-success/40 bg-success/5' : ''"
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="font-semibold text-highlighted">{{ dest.cliente }}</p>
                  <p v-if="dest.direccion" class="text-xs text-muted">{{ dest.direccion }}</p>
                </div>
                <UBadge :color="dest.confirmado ? 'success' : 'neutral'" variant="soft" size="sm">
                  {{ dest.confirmado ? 'Confirmado' : 'Pendiente' }}
                </UBadge>
              </div>
              <div v-if="dest.firmaUrl" class="mt-2">
                <p class="text-xs text-muted mb-1">Firma:</p>
                <img :src="dest.firmaUrl" alt="Firma" class="h-16 rounded border border-default bg-white" />
              </div>
              <div v-if="dest.fotoUrl" class="mt-2">
                <p class="text-xs text-muted mb-1">Foto entrega:</p>
                <img :src="dest.fotoUrl" alt="Foto" class="h-20 rounded object-cover border border-default" />
              </div>
              <UButton
                v-if="!dest.confirmado"
                class="mt-2 print:hidden"
                label="Confirmar entrega"
                icon="i-lucide-pen-line"
                size="sm"
                color="primary"
                variant="outline"
                @click="abrirConfirmar(dest)"
              />
            </div>
          </div>
        </div>

        <!-- Artículos por cliente -->
        <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <h2 class="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
            Artículos · {{ entrega.articulos.filter(a => a.entregado).length }}/{{ entrega.articulos.length }} entregados
          </h2>
          <div class="space-y-4">
            <div v-for="grupo in porCliente" :key="grupo.cliente">
              <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-1 flex items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-3" />
                {{ grupo.cliente }}
              </p>
              <div class="rounded-lg border border-default overflow-hidden">
                <table class="w-full border-collapse text-sm">
                  <thead>
                    <tr class="bg-elevated/50">
                      <th class="w-8 px-3 py-2 text-center border-b border-default font-medium">✓</th>
                      <th class="px-3 py-2 text-start border-b border-default font-medium">Artículo</th>
                      <th class="w-20 px-3 py-2 text-center border-b border-default font-medium">Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="art in grupo.arts"
                      :key="art.id"
                      class="transition-colors"
                      :class="art.entregado ? 'bg-success/5' : 'hover:bg-elevated/30'"
                    >
                      <td class="px-3 py-2 border-b border-default text-center">
                        <UCheckbox
                          :model-value="art.entregado"
                          @update:model-value="(v) => toggleEntregado(art.id, v)"
                        />
                      </td>
                      <td class="px-3 py-2 border-b border-default">
                        <p :class="art.entregado ? 'line-through text-muted' : 'text-highlighted'">
                          {{ art.descripcion }}
                        </p>
                        <p class="text-xs text-muted font-mono">{{ art.sg }}</p>
                      </td>
                      <td class="px-3 py-2 border-b border-default text-center text-muted">{{ art.cantidad }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal confirmar entrega -->
      <UModal v-model:open="modalConfirmar" :title="`Confirmar entrega: ${destinoActivo?.cliente}`" description="Recopila firma y foto del cliente.">
        <template #body>
          <div class="space-y-4">
            <div>
              <p class="text-sm font-medium text-highlighted mb-2">Firma del cliente</p>
              <div class="rounded-lg border border-default overflow-hidden bg-slate-50 dark:bg-slate-900">
                <canvas
                  ref="canvasRef"
                  width="400"
                  height="160"
                  class="w-full touch-none cursor-crosshair"
                  @mousedown="iniciarDibujo"
                  @mousemove="dibujar"
                  @mouseup="terminarDibujo"
                  @mouseleave="terminarDibujo"
                  @touchstart="iniciarDibujo"
                  @touchmove="dibujar"
                  @touchend="terminarDibujo"
                />
              </div>
              <UButton
                label="Limpiar firma"
                icon="i-lucide-eraser"
                color="neutral"
                variant="ghost"
                size="sm"
                class="mt-1"
                @click="limpiarFirma"
              />
            </div>

            <UFormField label="Foto del producto entregado" name="foto" description="Toma una foto con la cámara o selecciona una imagen.">
              <UFileUpload
                v-model="fotoArchivo"
                accept="image/*"
                :interactive="true"
                variant="area"
                icon="i-lucide-camera"
                label="Tomar foto o seleccionar"
                description="PNG, JPG o WEBP"
              />
            </UFormField>

            <div class="flex justify-end gap-2 pt-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" :disabled="savingConfirm" @click="modalConfirmar = false" />
              <UButton label="Confirmar entrega" icon="i-lucide-check" color="success" :loading="savingConfirm" :disabled="savingConfirm" @click="guardarConfirmacion" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>

<style>
@media print {
  .print\:hidden { display: none !important; }

  aside, nav, [data-sidebar] { display: none !important; }

  body { background: white !important; }

  .rounded-lg { border-radius: 0 !important; }
}
</style>
