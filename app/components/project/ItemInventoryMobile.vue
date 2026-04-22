<script setup lang="ts">
import { nextTick } from 'vue'
import type { ArticuloEstatusLogistica, ArticuloProyecto } from '~/types'
import { yaImportadoLineaUsd } from '~/utils/proyectoCalculos'

const props = defineProps<{
  articulos: ArticuloProyecto[]
}>()

const emit = defineEmits<{
  'estatus-change': [articulo: ArticuloProyecto, value: ArticuloEstatusLogistica]
  'referencia-change': [articulo: ArticuloProyecto, value: string]
}>()

const busqueda = ref('')
const highlightId = ref<string | null>(null)

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) {
    return props.articulos
  }
  return props.articulos.filter(
    a =>
      a.sg.toLowerCase().includes(q)
      || a.descripcion.toLowerCase().includes(q)
  )
})

function aplicarBusqueda() {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) {
    return
  }
  const exact = props.articulos.find(a => a.sg.toLowerCase() === q)
  const first = exact ?? filtrados.value[0]
  if (first) {
    highlightId.value = first.id
    nextTick(() => {
      const el = document.getElementById(`inv-m-${first.id}`)
      if (!el) return
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        el.scrollIntoView(true)
      }
    })
  }
}

function marcarMonterrey(a: ArticuloProyecto) {
  emit('estatus-change', a, 'Monterrey')
}

const touchStart = ref<{ x: number, y: number, id: string | null }>({ x: 0, y: 0, id: null })

function onTouchStart(e: TouchEvent, a: ArticuloProyecto) {
  const t = e.changedTouches[0]
  if (!t) {
    return
  }
  touchStart.value = { x: t.clientX, y: t.clientY, id: a.id }
}

function onTouchEnd(e: TouchEvent, a: ArticuloProyecto) {
  const t = e.changedTouches[0]
  if (!t || touchStart.value.id !== a.id) {
    return
  }
  const dx = t.clientX - touchStart.value.x
  const dy = Math.abs(t.clientY - touchStart.value.y)
  if (dy > 48) {
    return
  }
  if (dx < -56 && a.estatus !== 'Monterrey') {
    marcarMonterrey(a)
  }
}

const estatusLabel: Record<ArticuloEstatusLogistica, string> = {
  'Laredo': 'Laredo',
  'En Aduana': 'En aduana',
  'Monterrey': 'Monterrey'
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}
</script>

<template>
  <div class="space-y-4 lg:hidden">
    <div class="sticky top-0 z-10 -mx-1 bg-default/90 px-1 py-2 backdrop-blur-md">
      <p class="text-xs text-muted mb-2">
        Bodega Monterrey: escanea el SG o desliza la tarjeta hacia la izquierda para marcar recibido en Monterrey.
      </p>
      <div class="flex gap-2">
        <UInput
          v-model="busqueda"
          placeholder="Escanear o escribir SG…"
          icon="i-lucide-scan-barcode"
          size="lg"
          class="flex-1 min-w-0"
          autocomplete="off"
          inputmode="search"
          @keydown.enter.prevent="aplicarBusqueda"
        />
        <UButton
          icon="i-lucide-search"
          size="lg"
          square
          color="primary"
          class="shrink-0"
          aria-label="Buscar"
          @click="aplicarBusqueda"
        />
      </div>
    </div>

    <p
      v-if="!articulos.length"
      class="text-sm text-muted px-1"
    >
      No hay artículos en este proyecto.
    </p>

    <ul
      v-else
      class="space-y-3 pb-8"
    >
      <li
        v-for="a in filtrados"
        :id="`inv-m-${a.id}`"
        :key="a.id"
        class="rounded-2xl border border-default bg-elevated/40 p-4 transition-[box-shadow] duration-200"
        :class="highlightId === a.id ? 'ring-2 ring-primary shadow-md' : ''"
        @touchstart="onTouchStart($event, a)"
        @touchend="onTouchEnd($event, a)"
      >
        <div class="flex gap-3">
          <img
            :src="a.imagenUrl"
            :alt="a.descripcion"
            class="size-16 shrink-0 rounded-xl object-cover ring ring-default"
          >
          <div class="min-w-0 flex-1">
            <p class="font-mono text-sm font-semibold text-primary">
              {{ a.sg }}
            </p>
            <p class="text-sm text-highlighted line-clamp-3">
              {{ a.descripcion }}
            </p>
            <p class="mt-1 text-xs text-muted tabular-nums">
              {{ a.cantidadRecibida }} / {{ a.cantidadTotal }} · {{ estatusLabel[a.estatus] }}
            </p>
            <p class="mt-1 text-xs font-medium tabular-nums text-highlighted">
              Ya importado: {{ formatUsd(yaImportadoLineaUsd(a)) }}
            </p>
            <UFormField label="Referencia logística" class="mt-2" name="refLog">
              <UInput
                :model-value="a.referenciaLogistica ?? ''"
                placeholder="SG/17958Y64"
                icon="i-lucide-truck"
                size="sm"
                class="w-full font-mono text-xs"
                @change="(e: Event) => emit('referencia-change', a, (e.target as HTMLInputElement).value)"
              />
            </UFormField>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            v-if="a.estatus !== 'Monterrey'"
            label="Recibido en Monterrey"
            icon="i-lucide-package-check"
            color="primary"
            size="lg"
            block
            class="min-h-12 touch-manipulation"
            @click="marcarMonterrey(a)"
          />
          <UBadge
            v-else
            color="success"
            variant="subtle"
            size="lg"
            class="min-h-12 px-4"
          >
            Ya en Monterrey
          </UBadge>
        </div>

        <p class="mt-3 text-[11px] text-muted text-center">
          Desliza a la izquierda sobre la tarjeta para el mismo efecto
        </p>
      </li>
    </ul>

    <p
      v-if="articulos.length && !filtrados.length"
      class="text-sm text-warning px-1"
    >
      Ningún artículo coincide con “{{ busqueda }}”.
    </p>
  </div>
</template>
