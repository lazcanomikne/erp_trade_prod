<template>
  <div class="relative min-h-dvh flex flex-col bg-slate-100 dark:bg-gray-950">
    <div class="absolute top-4 end-4 z-10">
      <UColorModeButton />
    </div>

    <div class="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
      <slot />
    </div>
  </div>
</template>
