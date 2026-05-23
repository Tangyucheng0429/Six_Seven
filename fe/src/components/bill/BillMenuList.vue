<script setup>
import { computed } from 'vue'
import { formatMYR, billMenuLines, billFeeDisplayLines } from '../../composables/useRoomState'

const props = defineProps({
  room: { type: Object, required: true },
  showFees: { type: Boolean, default: true },
})

const menuLines = computed(() => billMenuLines(props.room))
const feeLines = computed(() => (props.showFees ? billFeeDisplayLines(props.room) : []))
</script>

<template>
  <div>
    <ul v-if="menuLines.length" class="space-y-1.5">
      <li
        v-for="line in menuLines"
        :key="line.id"
        class="flex items-start justify-between gap-2 text-sm"
      >
        <span class="min-w-0 font-bold leading-snug">
          {{ line.name }}
          <span v-if="line.qty > 1" class="font-medium text-neo-ink/70"> ×{{ line.qty }}</span>
        </span>
        <span class="shrink-0 font-mono text-xs font-bold">{{ formatMYR(line.amount) }}</span>
      </li>
    </ul>
    <p v-else class="text-xs font-medium text-neo-ink/70">No menu items on this bill yet.</p>

    <ul v-if="feeLines.length" class="mt-2 space-y-1 border-t border-neo-ink/15 pt-2">
      <li
        v-for="line in feeLines"
        :key="line.id"
        class="flex justify-between text-xs text-neo-ink/80"
      >
        <span>{{ line.name }}</span>
        <span class="font-mono font-bold">{{ formatMYR(line.amount) }}</span>
      </li>
    </ul>
  </div>
</template>
