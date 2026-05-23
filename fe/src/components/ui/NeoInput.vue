<script setup>
import NeoLabel from './NeoLabel.vue'

const model = defineModel({ type: [String, Number], default: '' })

defineProps({
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  id: { type: String, default: '' },
  error: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  shake: { type: Boolean, default: false },
})
</script>

<template>
  <div class="flex flex-col gap-2" :class="shake ? 'animate-neo-shake' : ''">
    <NeoLabel v-if="label" :for="id">{{ label }}</NeoLabel>
    <input
      :id="id"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      class="w-full border-3 bg-neo-surface px-4 py-3 font-medium neo-shadow transition-[box-shadow,border-color] placeholder:text-neo-ink/40 focus:bg-neo-primary/20 focus:outline-none"
      :class="error ? 'neo-field-invalid' : 'border-neo-ink focus:border-neo-ink'"
      :aria-invalid="error"
    />
    <p v-if="error && errorMessage" class="text-xs font-bold text-neo-danger">{{ errorMessage }}</p>
  </div>
</template>
