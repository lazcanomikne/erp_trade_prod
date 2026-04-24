<script setup lang="ts">
interface Msg {
  role: 'user' | 'assistant'
  content: string
}

const open = ref(false)
const input = ref('')
const loading = ref(false)
const msgs = ref<Msg[]>([])
const bodyRef = ref<HTMLElement | null>(null)

const SUGERENCIAS = [
  '¿Cuántos artículos tengo en Laredo?',
  '¿Cuál es el valor total de todos los proyectos?',
  '¿Qué proyectos tienen artículos en aduana?',
  '¿Cuánto me ha pagado cada cliente?'
]

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  msgs.value.push({ role: 'user', content: text })
  loading.value = true
  await nextTick()
  scrollBottom()
  try {
    const history = msgs.value.slice(0, -1)
    const { reply } = await $fetch<{ reply: string }>('/api/chat/groq', {
      method: 'POST',
      body: { message: text, history }
    })
    msgs.value.push({ role: 'assistant', content: reply })
  } catch {
    msgs.value.push({ role: 'assistant', content: 'Ocurrió un error al consultar el asistente. Intenta de nuevo.' })
  } finally {
    loading.value = false
    await nextTick()
    scrollBottom()
  }
}

function scrollBottom() {
  if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function useSugerencia(s: string) {
  input.value = s
  send()
}

function limpiar() {
  msgs.value = []
}

watch(open, (v) => {
  if (v) nextTick(scrollBottom)
})
</script>

<template>
  <div class="fixed bottom-20 right-5 z-50 flex flex-col items-end gap-3">
    <!-- Panel de chat -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-4 scale-95"
    >
      <div
        v-if="open"
        class="flex w-[370px] flex-col overflow-hidden rounded-2xl shadow-2xl border border-neutral-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        style="height: 520px"
      >
        <!-- Header -->
        <div class="flex items-center gap-2.5 border-b border-neutral-200 dark:border-zinc-700 bg-neutral-100 dark:bg-zinc-800 px-4 py-3">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UIcon name="i-lucide-bot" class="size-4 text-primary" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">Asistente IA</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">Powered by Groq · Llama 3.3 70B</p>
          </div>
          <div class="flex gap-1">
            <UButton
              v-if="msgs.length"
              icon="i-lucide-trash-2"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              title="Limpiar chat"
              @click="limpiar"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              @click="open = false"
            />
          </div>
        </div>

        <!-- Mensajes -->
        <div ref="bodyRef" class="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white dark:bg-zinc-900">
          <!-- Estado vacío con sugerencias -->
          <div v-if="!msgs.length" class="flex flex-col gap-3 pt-2">
            <div class="flex items-start gap-2.5">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <UIcon name="i-lucide-bot" class="size-3.5 text-primary" />
              </div>
              <div class="rounded-2xl rounded-tl-sm bg-neutral-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 px-3 py-2 text-sm max-w-[280px]">
                ¡Hola! Soy tu asistente del ERP. Tengo acceso a todos tus proyectos, artículos y pagos en tiempo real. ¿En qué te ayudo?
              </div>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 pl-9">Sugerencias:</p>
            <div class="pl-9 flex flex-col gap-1.5">
              <button
                v-for="s in SUGERENCIAS"
                :key="s"
                class="rounded-lg border border-neutral-200 dark:border-zinc-700 bg-neutral-50 dark:bg-zinc-800 px-3 py-1.5 text-left text-xs text-zinc-600 dark:text-zinc-300 hover:bg-neutral-100 dark:hover:bg-zinc-700 transition-colors"
                @click="useSugerencia(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>

          <!-- Mensajes del chat -->
          <template v-for="(m, i) in msgs" :key="i">
            <!-- Usuario -->
            <div v-if="m.role === 'user'" class="flex justify-end">
              <div class="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-white">
                {{ m.content }}
              </div>
            </div>

            <!-- Asistente -->
            <div v-else class="flex items-start gap-2.5">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <UIcon name="i-lucide-bot" class="size-3.5 text-primary" />
              </div>
              <div class="max-w-[280px] rounded-2xl rounded-tl-sm bg-neutral-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 px-3 py-2 text-sm whitespace-pre-wrap">
                {{ m.content }}
              </div>
            </div>
          </template>

          <!-- Typing indicator -->
          <div v-if="loading" class="flex items-start gap-2.5">
            <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UIcon name="i-lucide-bot" class="size-3.5 text-primary" />
            </div>
            <div class="rounded-2xl rounded-tl-sm bg-neutral-100 dark:bg-zinc-800 px-3 py-2.5">
              <div class="flex gap-1 items-center">
                <span class="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style="animation-delay:0ms" />
                <span class="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style="animation-delay:150ms" />
                <span class="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style="animation-delay:300ms" />
              </div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="border-t border-neutral-200 dark:border-zinc-700 bg-neutral-100 dark:bg-zinc-800 px-3 py-2.5">
          <div class="flex items-end gap-2">
            <textarea
              v-model="input"
              placeholder="Pregunta algo sobre tus datos…"
              rows="1"
              :disabled="loading"
              class="flex-1 resize-none rounded-xl border border-neutral-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 max-h-28 overflow-y-auto"
              style="min-height: 36px"
              @keydown="onKey"
              @input="($event.target as HTMLTextAreaElement).style.height = 'auto'; ($event.target as HTMLTextAreaElement).style.height = ($event.target as HTMLTextAreaElement).scrollHeight + 'px'"
            />
            <UButton
              icon="i-lucide-send"
              color="primary"
              size="sm"
              square
              :loading="loading"
              :disabled="!input.trim() || loading"
              @click="send"
            />
          </div>
          <p class="mt-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-500">Enter para enviar · Shift+Enter nueva línea</p>
        </div>
      </div>
    </Transition>

    <!-- Botón principal -->
    <button
      class="flex size-13 items-center justify-center rounded-full bg-primary shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
      :title="open ? 'Cerrar asistente' : 'Abrir asistente IA'"
      @click="open = !open"
    >
      <Transition
        enter-active-class="transition duration-150"
        enter-from-class="opacity-0 rotate-90 scale-50"
        enter-to-class="opacity-100 rotate-0 scale-100"
        leave-active-class="transition duration-150"
        leave-from-class="opacity-100 rotate-0 scale-100"
        leave-to-class="opacity-0 rotate-90 scale-50"
        mode="out-in"
      >
        <UIcon v-if="open" name="i-lucide-x" class="size-5 text-white" />
        <UIcon v-else name="i-lucide-bot" class="size-5 text-white" />
      </Transition>
    </button>
  </div>
</template>
