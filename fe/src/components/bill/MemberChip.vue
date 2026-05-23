<script setup>
import NeoBadge from '../ui/NeoBadge.vue'
import { formatMYR } from '../../composables/useRoomState'

defineProps({
  member: { type: Object, required: true },
  showAmount: { type: Boolean, default: true },
})
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 border-3 border-neo-ink bg-neo-surface px-3 py-2 neo-shadow"
  >
    <div class="flex items-center gap-2">
      <span class="font-bold">{{ member.name }}</span>
      <NeoBadge v-if="member.isHost" variant="ink">Host</NeoBadge>
    </div>
    <div v-if="showAmount && !member.isHost" class="flex items-center gap-2">
      <span class="font-mono text-sm font-bold">{{ formatMYR(member.amountDue) }}</span>
      <NeoBadge v-if="member.confirmed" variant="success">OK</NeoBadge>
      <NeoBadge v-else-if="member.paid || member.proofUrl" variant="warning">Pending</NeoBadge>
      <NeoBadge v-else variant="default">Due</NeoBadge>
    </div>
  </div>
</template>
