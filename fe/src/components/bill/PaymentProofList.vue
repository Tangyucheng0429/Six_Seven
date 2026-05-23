<script setup>
import NeoButton from '../ui/NeoButton.vue'
import NeoBadge from '../ui/NeoBadge.vue'
import { formatMYR } from '../../composables/useRoomState'

defineProps({
  members: { type: Array, default: () => [] },
  isHost: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm'])
</script>

<template>
  <ul class="space-y-3">
    <li
      v-for="m in members.filter((x) => !x.isHost)"
      :key="m.id"
      class="border-3 border-neo-ink bg-neo-surface p-3 neo-shadow"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-bold">{{ m.name }}</span>
        <span class="font-mono text-sm">{{ formatMYR(m.amountDue) }}</span>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <NeoBadge v-if="m.confirmed" variant="success">Confirmed</NeoBadge>
        <NeoBadge v-else-if="m.paid || m.proofUrl" variant="warning">Pending</NeoBadge>
        <NeoBadge v-else variant="danger">Unpaid</NeoBadge>
        <img
          v-if="m.proofUrl"
          :src="m.proofUrl"
          alt="Proof"
          class="mt-2 max-h-24 border-2 border-neo-ink object-cover"
        />
      </div>
      <NeoButton
        v-if="isHost && (m.paid || m.proofUrl) && !m.confirmed"
        class="mt-3"
        variant="primary"
        block
        @click="emit('confirm', m.id)"
      >
        Confirm payment
      </NeoButton>
    </li>
  </ul>
</template>
