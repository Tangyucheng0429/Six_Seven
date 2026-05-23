<script setup>
import { Comment, computed, useSlots } from 'vue'
import NeoButton from '../ui/NeoButton.vue'

const props = defineProps({
  backLabel: { type: String, default: 'Back' },
  backDisabled: { type: Boolean, default: false },
  hideBack: { type: Boolean, default: false },
  shakeContinue: { type: Boolean, default: false },
})

const emit = defineEmits(['back'])
const slots = useSlots()

const hasNext = computed(() => {
  const nodes = slots.default?.() ?? []
  return nodes.some((node) => node.type !== Comment)
})

const showBack = computed(() => !props.hideBack)
const gridCols = computed(() => (showBack.value && hasNext.value ? 'grid-cols-2' : 'grid-cols-1'))
</script>

<template>
  <div aria-hidden="true" class="h-28 shrink-0 sm:h-24" />
  <div
    class="fixed inset-x-0 bottom-0 z-10 border-t-3 border-neo-ink bg-neo-bg/90 px-4 py-4 backdrop-blur-sm neo-shadow"
    style="padding-bottom: max(1rem, env(safe-area-inset-bottom))"
  >
    <div class="mx-auto grid max-w-lg gap-3" :class="gridCols">
      <NeoButton
        v-if="showBack"
        block
        class="min-h-12 min-w-0"
        variant="ghost"
        :disabled="backDisabled"
        @click="emit('back')"
      >
        {{ backLabel }}
      </NeoButton>
      <div
        v-if="hasNext"
        class="flow-nav-slot min-w-0"
        :class="[props.hideBack ? 'contents' : '', shakeContinue ? 'animate-neo-shake' : '']"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-nav-slot :deep(button) {
  width: 100%;
  min-height: 3rem;
  min-width: 0;
}

.flow-nav-slot.animate-neo-shake :deep(button) {
  border-color: #ff3d3d;
  animation: neo-shake 0.45s ease-in-out, neo-error-flash 0.5s ease-in-out 2;
}
</style>
