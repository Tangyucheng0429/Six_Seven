<script setup>
import { computed, useSlots } from 'vue'
import NeoButton from '../ui/NeoButton.vue'

defineProps({
  backLabel: { type: String, default: 'Back' },
  backDisabled: { type: Boolean, default: false },
})

const emit = defineEmits(['back'])
const slots = useSlots()

const hasNext = computed(() => {
  const nodes = slots.default?.() ?? []
  return nodes.some((node) => node.type !== Comment)
})
</script>

<template>
  <div class="mt-6" :class="hasNext ? 'flex gap-3' : ''">
    <NeoButton
      :class="hasNext ? 'min-w-0 flex-1' : 'w-full'"
      variant="ghost"
      :disabled="backDisabled"
      @click="emit('back')"
    >
      {{ backLabel }}
    </NeoButton>
    <div v-if="hasNext" class="min-w-0 flex-1">
      <slot />
    </div>
  </div>
</template>
