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
    <header class="border-b-3 border-neo-ink bg-neo-primary px-4 py-4 neo-shadow">
      <div class="mx-auto flex max-w-lg items-center justify-between gap-3">
        <RouterLink to="/" class="neo-pressable inline-block">
          <span class="text-2xl font-bold tracking-tight">SIX<span class="text-neo-accent">7</span></span>
        </RouterLink>
        <NeoBadge v-if="roomCode" variant="ink">{{ roomCode }}</NeoBadge>
      </div>
    </header>

    <main class="mx-auto max-w-lg px-4 py-6 pb-10">
      <div v-if="title" class="mb-6">
        <h1 class="text-3xl font-bold leading-tight">{{ title }}</h1>
        <p v-if="subtitle" class="mt-2 text-sm font-medium text-neo-ink/70">{{ subtitle }}</p>
      </div>
      <slot />
    </main>
  </div>
</template>
