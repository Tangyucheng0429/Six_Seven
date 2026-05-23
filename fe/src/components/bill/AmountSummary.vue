<script setup>
import { computed } from 'vue'
import NeoCard from '../ui/NeoCard.vue'
import NeoDivider from '../ui/NeoDivider.vue'
import {
  formatMYR,
  billSubtotal,
  billScannedLineTax,
  billFeeLinesTotal,
} from '../../composables/useRoomState'

const props = defineProps({
  items: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
  room: { type: Object, default: null },
})

const subtotal = computed(() =>
  props.room ? billSubtotal(props.room) : props.items.reduce((s, i) => s + (i.price || 0), 0),
)
const scannedTax = computed(() => (props.room ? billScannedLineTax(props.room) : 0))
const fees = computed(() => (props.room ? billFeeLinesTotal(props.room) : 0))
const payers = computed(() => props.members.filter((m) => !m.isHost))
</script>

<template>
  <NeoCard>
    <p class="neo-section-label mb-3">Amounts</p>
    <div class="flex justify-between font-bold">
      <span>Subtotal</span>
      <span class="font-mono">{{ formatMYR(subtotal) }}</span>
    </div>
    <div v-if="scannedTax > 0" class="mt-1 flex justify-between text-xs text-neo-ink/70">
      <span>Includes SST on items</span>
      <span class="font-mono">{{ formatMYR(scannedTax) }}</span>
    </div>
    <div v-if="fees > 0" class="mt-1 flex justify-between text-xs text-neo-ink/70">
      <span>Includes fees</span>
      <span class="font-mono">{{ formatMYR(fees) }}</span>
    </div>
    <NeoDivider />
    <ul class="space-y-2">
      <li v-for="m in payers" :key="m.id" class="flex justify-between text-sm">
        <span>{{ m.name }}</span>
        <span class="font-mono font-bold">{{ formatMYR(m.amountDue) }}</span>
      </li>
    </ul>
  </NeoCard>
</template>
