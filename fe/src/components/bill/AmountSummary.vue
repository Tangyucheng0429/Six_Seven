<script setup>
import { computed } from 'vue'
import NeoCard from '../ui/NeoCard.vue'
import NeoDivider from '../ui/NeoDivider.vue'
import { formatMYR } from '../../composables/useRoomState'

const props = defineProps({
  items: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
})

const total = computed(() => props.items.reduce((s, i) => s + i.price, 0))
const payers = computed(() => props.members.filter((m) => !m.isHost))
</script>

<template>
  <NeoCard>
    <div class="flex justify-between font-bold">
      <span>Bill total</span>
      <span class="font-mono">{{ formatMYR(total) }}</span>
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
