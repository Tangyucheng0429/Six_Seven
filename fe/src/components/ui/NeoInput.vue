<script setup>
import NeoLabel from './NeoLabel.vue'

const model = defineModel({ type: [String, Number], default: '' })

defineProps({
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  id: { type: String, default: '' },
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <NeoLabel v-if="label" :for="id">{{ label }}</NeoLabel>
    <input
      :id="id"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      class="w-full border-3 border-neo-ink bg-neo-surface px-4 py-3 font-medium neo-shadow placeholder:text-neo-ink/40"
    />
  </div>
</template>
