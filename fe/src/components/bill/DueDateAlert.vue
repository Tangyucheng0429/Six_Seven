<script setup>
import NeoBadge from '../ui/NeoBadge.vue'
import { formatMYR } from '../../composables/useRoomState'

defineProps({
  room: { type: Object, required: true },
  unpaidTotal: { type: Number, default: 0 },
  emailSent: { type: Boolean, default: false },
})
</script>

<template>
  <div
    v-if="room.isOverdue && unpaidTotal > 0"
    class="border-3 border-neo-ink bg-neo-danger p-4 text-white neo-shadow"
  >
    <div class="flex flex-wrap items-center gap-2">
      <NeoBadge variant="ink">Overdue</NeoBadge>
      <span v-if="emailSent" class="text-xs font-bold uppercase">Email sent to host</span>
    </div>
    <p class="mt-2 text-sm font-bold">
      Due date passed — {{ formatMYR(unpaidTotal) }} still unpaid.
    </p>
    <p class="mt-1 text-xs opacity-90">
      Notification sent to {{ room.hostEmail }}.
    </p>
  </div>
</template>
