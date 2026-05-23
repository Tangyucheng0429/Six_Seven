<script setup>
import { computed } from 'vue'

const props = defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, default: 0 },
})

const progressPct = computed(() => ((props.current + 1) / props.steps.length) * 100)
const currentLabel = computed(() => props.steps[props.current] ?? '')
</script>

<template>
  <nav class="mb-6 border-3 border-neo-ink bg-neo-surface p-4 neo-shadow" aria-label="Progress">
    <div class="mb-3 flex items-baseline justify-between gap-2">
      <p class="neo-section-label">
        Step {{ current + 1 }} / {{ steps.length }}
      </p>
      <p class="text-right text-xs font-bold uppercase tracking-wide">{{ currentLabel }}</p>
    </div>
    <div
      class="h-5 overflow-hidden border-3 border-neo-ink bg-neo-muted/40"
      role="progressbar"
      :aria-valuenow="current + 1"
      :aria-valuemin="1"
      :aria-valuemax="steps.length"
    >
      <div
        class="h-full border-r-3 border-neo-ink bg-neo-primary transition-[width] duration-300 ease-out"
        :style="{ width: `${progressPct}%` }"
      />
    </div>
    <ol class="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" aria-hidden="true">
      <li
        v-for="(step, i) in steps"
        :key="step"
        class="shrink-0 border-2 border-neo-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        :class="i === current ? 'bg-neo-primary' : i < current ? 'bg-neo-success/50' : 'bg-neo-muted/30 text-neo-ink/50'"
        :title="step"
      >
        {{ i + 1 }}
      </li>
    </ol>
  </nav>
</template>
