<script setup>
defineProps({
  padding: { type: Boolean, default: true },
  accent: { type: Boolean, default: false },
})
</script>

<template>
  <div
    class="border-3 border-neo-ink bg-neo-surface neo-shadow"
    :class="[padding ? 'p-4' : '', accent ? 'bg-neo-primary' : '']"
  >
    <slot />
  </div>
</template>
