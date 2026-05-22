<script setup>
const model = defineModel({ type: String, default: 'item' })
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <button
      type="button"
      class="neo-pressable border-3 border-neo-ink p-4 text-left neo-shadow"
      :class="model === 'equal' ? 'bg-neo-primary' : 'bg-neo-surface'"
      @click="model = 'equal'"
    >
      <span class="block text-lg font-bold">Equal Split</span>
      <span class="mt-1 block text-xs text-neo-ink/70">Divide total evenly</span>
    </button>
    <button
      type="button"
      class="neo-pressable border-3 border-neo-ink p-4 text-left neo-shadow"
      :class="model === 'item' ? 'bg-neo-accent' : 'bg-neo-surface'"
      @click="model = 'item'"
    >
      <span class="block text-lg font-bold">By Item</span>
      <span class="mt-1 block text-xs text-neo-ink/70">Pick what you ordered</span>
    </button>
  </div>
</template>
