<script setup>
import NeoBadge from '../ui/NeoBadge.vue'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  roomCode: { type: String, default: '' },
})
</script>

<template>
  <div class="min-h-dvh bg-neo-bg">
    <header class="border-b-3 border-neo-ink bg-neo-primary px-3 py-3 neo-shadow sm:px-4 sm:py-4">
      <div class="mx-auto flex max-w-lg items-center justify-between gap-2 sm:gap-3">
        <RouterLink to="/" class="neo-pressable inline-block">
          <span class="text-xl font-bold tracking-tight sm:text-2xl">SIX<span class="text-neo-accent">7</span></span>
        </RouterLink>
        <NeoBadge v-if="roomCode" variant="ink">{{ roomCode }}</NeoBadge>
      </div>
    </header>

    <main class="mx-auto max-w-lg px-3 py-5 pb-28 sm:px-4 sm:py-6 sm:pb-10">
      <div v-if="title" class="mb-5 sm:mb-6">
        <h1 class="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{{ title }}</h1>
        <p v-if="subtitle" class="mt-2 max-w-prose text-sm font-medium leading-relaxed text-neo-ink/70">
          {{ subtitle }}
        </p>
      </div>
      <slot />
    </main>
  </div>
</template>
