<script setup>
defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, default: 0 },
})
</script>

<template>
  <nav class="mb-6 border-3 border-neo-ink bg-neo-surface p-3 neo-shadow" aria-label="Progress">
    <ol class="flex flex-wrap gap-2">
      <li
        v-for="(step, i) in steps"
        :key="step"
        class="border-2 border-neo-ink px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
        :class="i === current ? 'bg-neo-primary' : i < current ? 'bg-neo-success/40' : 'bg-neo-muted/50'"
      >
        <span class="mr-1 font-mono">{{ i + 1 }}</span>{{ step }}
      </li>
    </ol>
  </nav>
</template>
