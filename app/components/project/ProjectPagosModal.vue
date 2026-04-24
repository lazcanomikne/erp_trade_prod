<script setup lang="ts">
import type { PagoHistoriaEntry, PagoProyecto } from '~/types'

const props = defineProps<{
  idProyecto: string
  pagos: PagoProyecto[]
  anticipoUsd: number
  createdAt: string
}>()

const open = defineModel<boolean>('open', { required: true })
const store = useInventarioStore()
const toast = useToast()

const tabItems = [
  { label: 'Pagos recibidos', value: 'pagos', slot: 'pagos' },
  { label: 'Historial de cambios', value: 'historial', slot: 'historial' }
]
const tab = ref('pagos')

const historia = ref<PagoHistoriaEntry[]>([])
const cargandoHistoria = ref(false)

const formasPago = ['Efectivo', 'Transferencia', 'Cheque', 'Otros']

// ─── Editar pago ──────────────────────────────────────────────────────────────
const editando = ref<PagoProyecto | null>(null)
const editForm = reactive({ montoUsd: '', fecha: '', referencia: '', formaPago: '', motivo: '' })
const savingEdit = ref(false)

function abrirEditar(p: PagoProyecto) {
  editando.value = p
  editForm.montoUsd = String(p.montoUsd)
  editForm.fecha = p.fecha
  editForm.referencia = p.referencia ?? ''
  editForm.formaPago = p.formaPago ?? ''
  editForm.motivo = ''
}

function cancelarEditar() {
  editando.value = null
}

async function confirmarEditar() {
  const m = Number(editForm.montoUsd)
  if (!Number.isFinite(m) || m <= 0) {
    toast.add({ title: 'Monto inválido', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  if (!editForm.fecha) {
    toast.add({ title: 'Fecha requerida', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingEdit.value = true
  try {
    await store.editarPago(props.idProyecto, editando.value!.id, {
      montoUsd: m,
      fecha: editForm.fecha,
      referencia: editForm.referencia.trim() || null,
      formaPago: editForm.formaPago || null,
      motivo: editForm.motivo.trim()
    })
    toast.add({ title: 'Pago actualizado', color: 'success', icon: 'i-lucide-check' })
    editando.value = null
    await cargarHistoria()
  } catch {
    toast.add({ title: 'Error al actualizar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEdit.value = false
  }
}

// ─── Eliminar pago ────────────────────────────────────────────────────────────
const eliminando = ref<PagoProyecto | null>(null)
const motivoEliminacion = ref('')
const savingDelete = ref(false)

function abrirEliminar(p: PagoProyecto) {
  eliminando.value = p
  motivoEliminacion.value = ''
}

function cancelarEliminar() {
  eliminando.value = null
}

async function confirmarEliminar() {
  if (!motivoEliminacion.value.trim()) {
    toast.add({ title: 'Indica el motivo de eliminación', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }
  savingDelete.value = true
  try {
    await store.eliminarPago(props.idProyecto, eliminando.value!.id, motivoEliminacion.value.trim())
    toast.add({ title: 'Pago eliminado', color: 'success', icon: 'i-lucide-trash-2' })
    eliminando.value = null
    await cargarHistoria()
  } catch {
    toast.add({ title: 'Error al eliminar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingDelete.value = false
  }
}

// ─── Historia ─────────────────────────────────────────────────────────────────
async function cargarHistoria() {
  cargandoHistoria.value = true
  try {
    historia.value = await $fetch<PagoHistoriaEntry[]>(
      `/api/erp/proyectos/${encodeURIComponent(props.idProyecto)}/pagos/historia`
    )
  } catch {
    toast.add({ title: 'No se pudo cargar el historial', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    cargandoHistoria.value = false
  }
}

watch(open, (v) => {
  if (v) {
    tab.value = 'pagos'
    editando.value = null
    eliminando.value = null
    cargarHistoria()
  }
})

// ─── Utilidades ───────────────────────────────────────────────────────────────
function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
}

function formatFecha(iso: string) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Pagos del proyecto" :ui="{ width: 'sm:max-w-2xl' }">
    <template #body>
      <UTabs v-model="tab" :items="tabItems">

        <!-- ── Tab: Pagos recibidos ── -->
        <template #pagos>
          <div class="mt-4 space-y-3">
            <!-- Anticipo inicial (fecha = creación del proyecto) -->
            <div v-if="anticipoUsd > 0" class="rounded-md border border-default bg-elevated/30 px-3 py-2 text-sm">
              <div class="flex items-start justify-between gap-2">
                <div class="space-y-0.5">
                  <p class="font-semibold tabular-nums text-highlighted">
                    {{ formatUsd(anticipoUsd) }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ formatFecha(createdAt) }}
                    <span class="ml-2 rounded bg-default px-1.5 py-0.5 text-xs">Anticipo inicial</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Sin pagos -->
            <p v-if="!pagos.length && anticipoUsd === 0" class="py-6 text-center text-sm text-muted">
              No hay pagos registrados.
            </p>

            <!-- Lista de pagos -->
            <template v-for="p in pagos" :key="p.id">
              <!-- Vista normal -->
              <div v-if="editando?.id !== p.id" class="rounded-md border border-default bg-elevated/30 px-3 py-2 text-sm">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 space-y-0.5">
                    <p class="font-semibold tabular-nums text-highlighted">
                      {{ formatUsd(p.montoUsd) }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ formatFecha(p.fecha) }}
                      <span v-if="p.formaPago" class="ml-2 rounded bg-default px-1.5 py-0.5 text-xs">{{ p.formaPago }}</span>
                    </p>
                    <p v-if="p.referencia" class="text-xs text-muted">
                      Ref: {{ p.referencia }}
                    </p>
                  </div>
                  <div class="flex shrink-0 gap-1">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="abrirEditar(p)" />
                    <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="abrirEliminar(p)" />
                  </div>
                </div>
              </div>

              <!-- Formulario de edición inline -->
              <div v-else class="space-y-3 rounded-md border border-primary/40 bg-elevated/50 p-3 text-sm">
                <p class="font-medium text-primary">
                  Editar pago
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <UFormField label="Monto (USD)" required>
                    <UInput v-model="editForm.montoUsd" type="number" min="0" step="0.01" class="w-full" />
                  </UFormField>
                  <UFormField label="Fecha" required>
                    <UInput v-model="editForm.fecha" type="date" class="w-full" />
                  </UFormField>
                  <UFormField label="Referencia">
                    <UInput v-model="editForm.referencia" placeholder="Ref..." class="w-full" />
                  </UFormField>
                  <UFormField label="Forma de pago">
                    <USelect v-model="editForm.formaPago" :items="formasPago" placeholder="Selecciona..." class="w-full" />
                  </UFormField>
                </div>
                <UFormField label="Motivo de la edición">
                  <UInput v-model="editForm.motivo" placeholder="Opcional — queda en el historial" class="w-full" />
                </UFormField>
                <div class="flex justify-end gap-2">
                  <UButton label="Cancelar" color="neutral" variant="subtle" size="sm" @click="cancelarEditar" />
                  <UButton label="Guardar" color="primary" size="sm" :loading="savingEdit" @click="confirmarEditar" />
                </div>
              </div>
            </template>

            <!-- Confirmación de eliminación -->
            <div v-if="eliminando" class="rounded-md border border-error/40 bg-error/5 p-3 text-sm">
              <p class="mb-2 font-medium text-error">
                Eliminar pago de {{ formatUsd(eliminando.montoUsd) }} ({{ formatFecha(eliminando.fecha) }})
              </p>
              <UFormField label="Motivo de eliminación" required>
                <UInput v-model="motivoEliminacion" placeholder="Describe el motivo..." class="w-full" />
              </UFormField>
              <div class="mt-3 flex justify-end gap-2">
                <UButton label="Cancelar" color="neutral" variant="subtle" size="sm" @click="cancelarEliminar" />
                <UButton label="Eliminar" color="error" size="sm" :loading="savingDelete" @click="confirmarEliminar" />
              </div>
            </div>
          </div>
        </template>

        <!-- ── Tab: Historial ── -->
        <template #historial>
          <div class="mt-4">
            <div v-if="cargandoHistoria" class="flex justify-center py-8">
              <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
            </div>
            <p v-else-if="!historia.length" class="py-6 text-center text-sm text-muted">
              Sin cambios registrados.
            </p>
            <div v-else class="space-y-2">
              <div
                v-for="h in historia"
                :key="h.id"
                class="rounded-md border border-default bg-elevated/30 px-3 py-2 text-sm"
              >
                <div class="flex items-center gap-2">
                  <UBadge
                    :label="h.accion === 'edicion' ? 'Edición' : 'Eliminación'"
                    :color="h.accion === 'edicion' ? 'info' : 'error'"
                    size="xs"
                    variant="subtle"
                  />
                  <span class="text-xs text-muted">{{ formatTs(h.createdAt) }}</span>
                </div>
                <p v-if="h.motivo" class="mt-1 text-xs text-muted">
                  {{ h.motivo }}
                </p>
                <p class="mt-1 text-xs text-muted">
                  Antes: {{ formatUsd(h.snapshotAntes.montoUsd) }}
                  · {{ formatFecha(h.snapshotAntes.fecha) }}
                  <span v-if="h.snapshotAntes.formaPago">· {{ h.snapshotAntes.formaPago }}</span>
                  <span v-if="h.snapshotAntes.referencia">· Ref: {{ h.snapshotAntes.referencia }}</span>
                </p>
              </div>
            </div>
          </div>
        </template>

      </UTabs>
    </template>
  </UModal>
</template>
