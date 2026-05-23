<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import ReceiptItemRow from '../components/bill/ReceiptItemRow.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { HOST_STEPS } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { updateItem, confirmReceipt } = useRoomState()

function confirm() {
  confirmReceipt(roomId.value)
  router.push(`/room/${roomId.value}/payment-setup`)
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Verify receipt"
    subtitle="Fix anything the AI got wrong before inviting members."
    :room-code="room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="4" />

    <div class="mb-4 flex gap-2">
      <NeoBadge variant="ink">{{ room.splitMode === 'equal' ? 'Equal split' : 'Item-based' }}</NeoBadge>
      <NeoBadge>{{ room.items.length }} items</NeoBadge>
    </div>

    <NeoCard>
      <p class="mb-2 text-xs font-bold uppercase">Line items</p>
      <ReceiptItemRow
        v-for="item in room.items"
        :key="item.id"
        :item="item"
        editable
        @update="(patch) => updateItem(room.id, item.id, patch)"
      />
    </NeoCard>

    <NeoButton class="mt-6" variant="primary" block @click="confirm">Confirm & set payment</NeoButton>
  </AppShell>
</template>
