<script setup lang="ts">
import type { ManifiestoDetalle, ManifiestoLinea } from '~/types'

const route = useRoute()
const id = route.params.id as string
const store = useInventarioStore()
const toast = useToast()

// ─── Datos ────────────────────────────────────────────────────────────────────
const { data: manifiesto, refresh, pending } = await useFetch<ManifiestoDetalle>(`/api/erp/manifiestos/${id}`)

function folio(n: number) { return `MF-${String(n).padStart(4, '0')}` }

function formatUsd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
}

function formatFecha(iso: string) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return iso }
}

const totalLineas = computed(() => manifiesto.value?.lineas.length ?? 0)
const totalValor = computed(() =>
  (manifiesto.value?.lineas ?? []).reduce((s, l) => s + l.precioCorte * l.cantidadCorte, 0)
)

// ─── Edición inline ───────────────────────────────────────────────────────────
const editandoId = ref<string | null>(null)
const editForm = reactive({ desc: '', qty: 1, precio: 0 })
const savingEdit = ref(false)

function abrirEditar(l: ManifiestoLinea) {
  editandoId.value = l.id
  editForm.desc = l.descripcionGenerica
  editForm.qty = l.cantidadCorte
  editForm.precio = l.precioCorte
}

function cancelarEditar() { editandoId.value = null }

async function guardarEdicion(lineaId: string) {
  savingEdit.value = true
  try {
    await $fetch(`/api/erp/manifiestos/${id}/lineas/${lineaId}`, {
      method: 'PATCH',
      body: { descripcionGenerica: editForm.desc, cantidadCorte: editForm.qty, precioCorte: editForm.precio }
    })
    await refresh()
    editandoId.value = null
    toast.add({ title: 'Línea actualizada', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: 'Error al guardar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingEdit.value = false
  }
}

// ─── Eliminar línea ───────────────────────────────────────────────────────────
const eliminandoId = ref<string | null>(null)
const savingDelete = ref(false)

async function eliminarLinea(lineaId: string) {
  savingDelete.value = true
  try {
    await $fetch(`/api/erp/manifiestos/${id}/lineas/${lineaId}`, { method: 'DELETE' })
    await store.refreshFromApi()
    await refresh()
    eliminandoId.value = null
    toast.add({ title: 'Línea eliminada — artículo regresó a Laredo', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: 'Error al eliminar', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    savingDelete.value = false
  }
}

// ─── Imprimir ─────────────────────────────────────────────────────────────────
function imprimir() { window.print() }

// ─── Exportar CSV ─────────────────────────────────────────────────────────────
function exportarCsv() {
  const m = manifiesto.value
  if (!m) return
  function esc(v: string | number | null | undefined) {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const headers = ['Folio', 'Fecha', 'Proyecto', 'Cliente', 'SG', 'Descripción declaración', 'Descripción original', 'Cantidad', 'Precio corte (USD)', 'Total línea (USD)']
  const rows = m.lineas.map(l => [
    esc(folio(m.folio)),
    esc(m.fecha),
    esc(l.nombreProyecto),
    esc(l.cliente),
    esc(l.sg),
    esc(l.descripcionGenerica),
    esc(l.descripcionOriginal),
    l.cantidadCorte,
    l.precioCorte.toFixed(2),
    (l.precioCorte * l.cantidadCorte).toFixed(2)
  ].join(','))
  const csv = '﻿' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${folio(m.folio)}-${m.fecha}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UDashboardPanel id="manifiesto-detalle">
    <template #header>
      <UDashboardNavbar :title="manifiesto ? `Manifiesto ${folio(manifiesto.folio)}` : 'Manifiesto'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex gap-2 print:hidden">
            <UButton
              label="Exportar CSV"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              :disabled="!manifiesto"
              @click="exportarCsv"
            />
            <UButton
              label="Imprimir / PDF"
              icon="i-lucide-printer"
              color="primary"
              :disabled="!manifiesto"
              @click="imprimir"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div v-else-if="manifiesto">
        <!-- Header imprimible -->
        <PrintHeader
          :titulo="`Manifiesto de Importación — ${folio(manifiesto.folio)}`"
          :subtitulo="`Fecha: ${formatFecha(manifiesto.fecha)}`"
        />

        <!-- Resumen en pantalla -->
        <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 print:hidden">
          <div class="rounded-lg border border-default bg-elevated/30 px-4 py-3">
            <p class="text-xs text-muted">Folio</p>
            <p class="text-lg font-bold font-mono text-primary">{{ folio(manifiesto.folio) }}</p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-4 py-3">
            <p class="text-xs text-muted">Fecha</p>
            <p class="font-semibold">{{ formatFecha(manifiesto.fecha) }}</p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-4 py-3">
            <p class="text-xs text-muted">Artículos</p>
            <p class="text-lg font-bold">{{ totalLineas }}</p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-4 py-3">
            <p class="text-xs text-muted">Valor declarado</p>
            <p class="text-lg font-bold tabular-nums">{{ formatUsd(totalValor) }}</p>
          </div>
        </div>

        <div v-if="manifiesto.observaciones" class="mb-4 rounded-md bg-elevated/40 px-4 py-2 text-sm print:mb-4">
          <span class="text-muted">Observaciones:</span> {{ manifiesto.observaciones }}
        </div>

        <!-- Tabla de líneas -->
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full text-sm">
            <thead class="bg-elevated/50 print:bg-gray-100">
              <tr>
                <th class="border-b border-default px-3 py-2 text-left text-xs font-medium text-muted">Proyecto / Cliente</th>
                <th class="border-b border-default px-3 py-2 text-left text-xs font-medium text-muted">SG</th>
                <th class="border-b border-default px-3 py-2 text-left text-xs font-medium text-muted">Descripción declaración</th>
                <th class="border-b border-default px-3 py-2 text-left text-xs font-medium text-muted print:hidden">Descripción original</th>
                <th class="border-b border-default px-3 py-2 text-center text-xs font-medium text-muted">Cant.</th>
                <th class="border-b border-default px-3 py-2 text-right text-xs font-medium text-muted">P. corte</th>
                <th class="border-b border-default px-3 py-2 text-right text-xs font-medium text-muted">Total</th>
                <th class="border-b border-default px-3 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              <template v-for="l in manifiesto.lineas" :key="l.id">
                <!-- Fila normal -->
                <tr
                  v-if="editandoId !== l.id"
                  class="border-b border-default/60 last:border-b-0 hover:bg-elevated/30 print:hover:bg-transparent"
                >
                  <td class="px-3 py-2">
                    <p class="font-medium">{{ l.nombreProyecto }}</p>
                    <p class="text-xs text-muted">{{ l.cliente }}</p>
                  </td>
                  <td class="px-3 py-2 font-mono text-xs">{{ l.sg || '—' }}</td>
                  <td class="px-3 py-2">{{ l.descripcionGenerica }}</td>
                  <td class="px-3 py-2 text-xs text-muted print:hidden">{{ l.descripcionOriginal }}</td>
                  <td class="px-3 py-2 text-center tabular-nums">{{ l.cantidadCorte }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ formatUsd(l.precioCorte) }}</td>
                  <td class="px-3 py-2 text-right tabular-nums font-medium">{{ formatUsd(l.precioCorte * l.cantidadCorte) }}</td>
                  <td class="px-3 py-2 print:hidden">
                    <div class="flex gap-1">
                      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="abrirEditar(l)" />
                      <UButton
                        size="xs"
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        @click="eliminandoId = l.id"
                      />
                    </div>
                  </td>
                </tr>

                <!-- Fila edición inline -->
                <tr v-else class="border-b border-default/60 bg-elevated/50 print:hidden">
                  <td class="px-3 py-2 text-xs text-muted" colspan="2">
                    {{ l.nombreProyecto }} · <span class="font-mono">{{ l.sg }}</span>
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editForm.desc"
                      class="w-full rounded border border-default bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td class="px-3 py-2 print:hidden" />
                  <td class="px-3 py-2">
                    <input
                      v-model.number="editForm.qty"
                      type="number"
                      min="1"
                      class="w-16 rounded border border-default bg-background px-2 py-1 text-center text-sm focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model.number="editForm.precio"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-24 rounded border border-default bg-background px-2 py-1 text-right text-sm focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums text-muted">
                    {{ formatUsd(editForm.precio * editForm.qty) }}
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex gap-1">
                      <UButton size="xs" color="neutral" variant="subtle" label="Cancelar" @click="cancelarEditar" />
                      <UButton size="xs" color="primary" label="Guardar" :loading="savingEdit" @click="guardarEdicion(l.id)" />
                    </div>
                  </td>
                </tr>
              </template>

              <!-- Fila totales -->
              <tr class="bg-elevated/50 font-semibold print:bg-gray-100">
                <td colspan="6" class="px-3 py-2 text-right text-sm">Total declarado</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatUsd(totalValor) }}</td>
                <td class="print:hidden" />
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Confirm eliminar -->
        <UModal v-model:open="eliminandoId" title="Eliminar línea del manifiesto" :ui="{ width: 'sm:max-w-sm' }">
          <template #body>
            <p class="mb-4 text-sm text-muted">
              El artículo regresará a <strong>Laredo</strong> y podrá incluirse en un nuevo corte.
            </p>
            <div class="flex justify-end gap-2">
              <UButton label="Cancelar" color="neutral" variant="subtle" @click="eliminandoId = null" />
              <UButton
                label="Eliminar línea"
                color="error"
                :loading="savingDelete"
                @click="eliminarLinea(eliminandoId!)"
              />
            </div>
          </template>
        </UModal>

        <!-- Navegación -->
        <div class="mt-6 flex gap-2 print:hidden">
          <UButton
            to="/logistica/manifiestos"
            label="← Todos los manifiestos"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </div>
      </div>

      <div v-else class="py-12 text-center text-muted">
        Manifiesto no encontrado.
      </div>
    </template>
  </UDashboardPanel>
</template>

<style>
@media print {
  [data-slot="sidebar"],
  [data-slot="navbar"],
  .print\:hidden { display: none !important; }

  [data-slot="panel-body"] { padding: 0 !important; }

  body { background: white !important; color: black !important; }

  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
  thead { background: #f3f4f6 !important; print-color-adjust: exact; }
}
</style>
