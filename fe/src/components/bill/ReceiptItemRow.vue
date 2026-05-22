<script setup>
import { formatMYR } from '../../composables/useRoomState'

const props = defineProps({
  item: { type: Object, required: true },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['update'])
</script>

<template>
  <div class="flex items-center gap-3 border-b-2 border-neo-ink/20 py-3 last:border-0">
    <div class="min-w-0 flex-1">
      <input
        v-if="editable"
        :value="item.name"
        class="w-full border-2 border-neo-ink bg-neo-bg px-2 py-1 text-sm font-bold"
        @input="emit('update', { name: $event.target.value })"
      />
      <p v-else class="truncate font-bold">{{ item.name }}</p>
    </div>
    <div class="shrink-0 font-mono text-sm font-bold">
      <input
        v-if="editable"
        type="number"
        step="0.01"
        :value="item.price"
        class="w-20 border-2 border-neo-ink bg-neo-bg px-2 py-1 text-right"
        @input="emit('update', { price: parseFloat($event.target.value) || 0 })"
      />
      <span v-else>{{ formatMYR(item.price) }}</span>
    </div>
  </div>
</template>
