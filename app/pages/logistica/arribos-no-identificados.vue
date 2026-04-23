<script setup lang="ts">
import type { ArticuloLimbo } from '~/types'

const appConfig = useAppConfig()
const toast = useToast()
const store = useInventarioStore()

const ni = computed(() => appConfig.navigation.arribosNoIdentificados)

const modalRegistro = ref(false)
const modalAsignar = ref(false)

const formRegistro = reactive({
  sgProvisional: '',
  descripcion: '',
  archivo: null as File | null
})

const seleccionArribo = ref<ArticuloLimbo | null>(null)
const formAsignar = reactive({
  idProyecto: '',
  precioUnitario: '',
  cantidadTotal: '1',
  sgFinal: '',
  marcarMonterrey: false
})

function imagenPreviewRegistro(): string {
  if (formRegistro.archivo) {
    return URL.createObjectURL(formRegistro.archivo)
  }
  return ''
}

function formatFechaLlegada(iso: string) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return iso
  }
}

function abrirVincular(item: ArticuloLimbo) {
  seleccionArribo.value = item
  formAsignar.idProyecto = store.listaProyectos()[0]?.idProyecto ?? ''
  formAsignar.precioUnitario = ''
  formAsignar.cantidadTotal = '1'
  formAsignar.sgFinal = item.sgProvisional
  formAsignar.marcarMonterrey = false
  modalAsignar.value = true
}

async function guardarRegistro() {
  const sg = formRegistro.sgProvisional.trim()
  const desc = formRegistro.descripcion.trim()
  if (!sg || !desc) {
    toast.add({
      title: 'Faltan datos',
      description: 'SG provisional y descripción son obligatorios.',
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  let url = ''
  if (formRegistro.archivo) {
    try {
      const fd = new FormData()
      fd.append('file', formRegistro.archivo)
      const up = await $fetch<{ url: string }>('/api/articulos/upload', {
        method: 'POST',
        body: fd
      })
      url = up.url
    } catch {
      toast.add({
        title: 'No se subió la imagen',
        description: 'Se guardó sin imagen.',
        color: 'warning',
        icon: 'i-lucide-alert-circle'
      })
    }
  }
  try {
    await store.registrarArriboDesconocido({
      sgProvisional: sg,
      descripcion: desc,
      imagenUrl: url
    })
  } catch {
    toast.add({
      title: 'No se guardó el arribo',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  formRegistro.sgProvisional = ''
  formRegistro.descripcion = ''
  formRegistro.archivo = null
  modalRegistro.value = false
  toast.add({
    title: 'Arribo registrado',
    description: 'Queda en la lista de inspección hasta vincularlo a un proyecto.',
    color: 'success',
    icon: 'i-lucide-package-plus'
  })
}

async function confirmarVinculacion() {
  if (!seleccionArribo.value) {
    return
  }
  const precio = Number(formAsignar.precioUnitario)
  if (!formAsignar.idProyecto || !Number.isFinite(precio) || precio <= 0) {
    toast.add({
      title: 'Revisa el proyecto y el precio',
      description: 'Selecciona un proyecto y un precio unitario válido.',
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }
  const proyecto = store.getProyectoById(formAsignar.idProyecto)
  const nombreProyecto = proyecto?.nombre ?? formAsignar.idProyecto
  const cant = Number(formAsignar.cantidadTotal)
  const ok = await store.asignarLimboAProyecto(seleccionArribo.value.id, formAsignar.idProyecto, {
    precioUnitario: precio,
    cantidadTotal: Number.isFinite(cant) && cant > 0 ? cant : 1,
    sgFinal: formAsignar.sgFinal.trim() || undefined,
    marcarRecibidoMonterrey: formAsignar.marcarMonterrey
  })
  if (!ok) {
    toast.add({ title: 'No se pudo vincular', color: 'error', icon: 'i-lucide-x' })
    return
  }
  modalAsignar.value = false
  seleccionArribo.value = null
  toast.add({
    title: 'Artículo conciliado exitosamente.',
    description: `Los saldos del Proyecto ${nombreProyecto} han sido actualizados.`,
    color: 'success',
    icon: 'i-heroicons-outline-check-circle',
    duration: 8000
  })
}

const proyectosItems = computed(() =>
  store.listaProyectos().map(p => ({
    label: `${p.nombre} (${p.idProyecto})`,
    value: p.idProyecto
  }))
)
</script>

<template>
  <UDashboardPanel id="arribos-no-identificados">
    <template #header>
      <UDashboardNavbar title="Arribos no identificados">
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <UButton
              to="/logistica"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              square
            />
          </div>
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UBadge
              v-if="ni?.badge"
              color="neutral"
              variant="subtle"
              class="hidden sm:inline-flex"
            >
              {{ ni.badge }}
            </UBadge>
            <UButton
              label="Registrar arribo desconocido"
              icon="i-lucide-package-plus"
              color="primary"
              class="touch-manipulation"
              @click="modalRegistro = true"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="mb-8 max-w-3xl text-muted">
        Piezas que llegaron a la bodega en USA y <strong>no estaban cargadas en ningún proyecto</strong>. Inspección visual, SG provisional y fecha de llegada; luego <strong>vincula</strong> al proyecto correcto para actualizar valor y devengado.
      </p>

      <div
        v-if="!store.articulosLimbo.length"
        class="rounded-2xl border border-dashed border-default px-4 py-16 text-center text-muted"
      >
        <UIcon
          :name="ni?.icon ?? 'i-heroicons-outline-question-mark-circle'"
          class="mx-auto mb-4 size-14 opacity-40"
        />
        <p class="font-medium text-highlighted">
          No hay artículos pendientes de conciliar
        </p>
        <p class="mt-1 text-sm">
          Usa «Registrar arribo desconocido» cuando llegue algo que no está en el sistema.
        </p>
      </div>

      <div v-else class="w-full overflow-x-auto rounded-lg border border-default">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
              <th class="px-3 py-2.5 text-start border-b border-default font-medium">SG provisional</th>
              <th class="px-3 py-2.5 text-start border-b border-default font-medium">Descripción</th>
              <th class="w-44 px-3 py-2.5 text-start border-b border-default font-medium">Fecha de llegada</th>
              <th class="w-36 px-3 py-2.5 text-center border-b border-default font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in store.articulosLimbo"
              :key="item.id"
              class="transition-colors hover:bg-elevated/40"
            >
              <td class="px-3 py-3 align-middle border-b border-default">
                <div class="flex items-center gap-2.5">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                    <UIcon name="i-lucide-circle-help" class="size-5 text-warning" />
                  </div>
                  <span class="font-mono font-semibold text-highlighted">{{ item.sgProvisional }}</span>
                </div>
              </td>
              <td class="px-3 py-3 align-middle border-b border-default">
                <p class="text-highlighted line-clamp-2 max-w-lg">{{ item.descripcion }}</p>
              </td>
              <td class="px-3 py-3 align-middle border-b border-default text-muted">
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-calendar-days" class="size-4 shrink-0 text-primary" />
                  {{ formatFechaLlegada(item.fechaRegistro) }}
                </div>
              </td>
              <td class="px-3 py-3 align-middle border-b border-default text-center">
                <UButton
                  label="Vincular"
                  icon="i-lucide-link-2"
                  color="primary"
                  size="sm"
                  @click="abrirVincular(item)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <UModal
        v-model:open="modalRegistro"
        title="Registrar arribo desconocido"
        description="Captura evidencia y datos mínimos. El SG puede ser provisional."
      >
        <template #body>
          <div class="space-y-4">
            <UFormField label="SG provisional" name="sg" required>
              <UInput
                v-model="formRegistro.sgProvisional"
                placeholder="Ej. SG-TEMP-001"
                icon="i-lucide-hash"
                class="w-full font-mono"
              />
            </UFormField>
            <UFormField label="Descripción" name="desc" required>
              <textarea
                v-model="formRegistro.descripcion"
                rows="3"
                placeholder="Qué es, marca, color…"
                class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm text-highlighted placeholder:text-dimmed focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </UFormField>
            <UFormField
              label="Foto del producto"
              name="foto"
              description="Grande y clara: ayuda a la inspección en bodega."
            >
              <UFileUpload
                v-model="formRegistro.archivo"
                accept="image/*"
                :interactive="true"
                variant="area"
                icon="i-lucide-camera"
                label="Tomar o subir foto"
              />
            </UFormField>
            <div
              v-if="formRegistro.archivo"
              class="flex justify-center"
            >
              <img
                :src="imagenPreviewRegistro()"
                alt="Vista previa"
                class="max-h-52 w-full max-w-md rounded-xl object-contain ring ring-default"
              >
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <UButton
                label="Cancelar"
                color="neutral"
                variant="subtle"
                @click="modalRegistro = false"
              />
              <UButton
                :label="`Guardar en ${ni?.badge ?? 'Arribos NI'}`"
                color="primary"
                icon="i-lucide-check"
                @click="guardarRegistro"
              />
            </div>
          </div>
        </template>
      </UModal>

      <UModal
        v-model:open="modalAsignar"
        title="Vincular a proyecto"
        description="El precio y la cantidad definen el aporte al valor del proyecto. Opcional: marcar ya recibido en Monterrey."
        :ui="{ content: 'w-full sm:max-w-lg' }"
      >
        <template #body>
          <div
            v-if="seleccionArribo"
            class="space-y-4"
          >
            <div class="overflow-hidden rounded-xl ring ring-default">
              <div v-if="seleccionArribo.imagenUrl" class="aspect-[16/9] w-full bg-elevated">
                <img
                  :src="seleccionArribo.imagenUrl"
                  :alt="seleccionArribo.descripcion"
                  class="size-full object-cover"
                >
              </div>
              <div class="bg-elevated/80 p-3">
                <p class="font-mono text-lg font-semibold text-primary">
                  {{ seleccionArribo.sgProvisional }}
                </p>
                <p class="text-sm text-muted">
                  {{ seleccionArribo.descripcion }}
                </p>
              </div>
            </div>
            <UFormField
              label="Proyecto destino"
              name="proyecto"
              required
            >
              <USelect
                v-model="formAsignar.idProyecto"
                :items="proyectosItems"
                value-key="value"
                label-key="label"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Precio unitario (USD)"
              name="precio"
              required
            >
              <UInput
                v-model="formAsignar.precioUnitario"
                type="number"
                min="0"
                step="0.01"
                icon="i-lucide-dollar-sign"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Cantidad"
              name="cantidad"
            >
              <UInput
                v-model="formAsignar.cantidadTotal"
                type="number"
                min="1"
                step="1"
                icon="i-lucide-hash"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="SG definitivo (opcional)"
              name="sgFinal"
              description="Si el cliente da el SG real, reemplaza al provisional."
            >
              <UInput
                v-model="formAsignar.sgFinal"
                class="w-full font-mono"
                icon="i-lucide-hash"
              />
            </UFormField>
            <UCheckbox
              v-model="formAsignar.marcarMonterrey"
              label="Ya recibido en Monterrey (devenga de inmediato)"
              description="Marca solo si la mercancía ya está físicamente en MTY."
            />
            <div class="flex justify-end gap-2 pt-2">
              <UButton
                label="Cancelar"
                color="neutral"
                variant="subtle"
                @click="modalAsignar = false"
              />
              <UButton
                label="Confirmar vinculación"
                color="primary"
                icon="i-lucide-check"
                @click="confirmarVinculacion"
              />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
