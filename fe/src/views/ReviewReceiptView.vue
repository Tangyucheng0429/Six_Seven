<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import ReceiptItemRow from '../components/bill/ReceiptItemRow.vue'
import SplitModeToggle from '../components/bill/SplitModeToggle.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { updateItem, setSplitMode, confirmReceipt } = useRoomState()

const splitMode = computed({
  get: () => room.value?.splitMode ?? 'item',
  set: (v) => setSplitMode(roomId.value, v),
})

function confirm() {
  confirmReceipt(roomId.value)
  router.push(`/room/${roomId.value}/payment-setup`)
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Check items"
    subtitle="Edit anything the AI got wrong, then pick split mode."
    :room-code="room.id"
  >
    <p class="mb-3 text-xs font-bold uppercase tracking-widest">Split mode</p>
    <SplitModeToggle v-model="splitMode" />

    <NeoCard class="mt-6">
      <p class="mb-2 text-xs font-bold uppercase">Line items</p>
      <ReceiptItemRow
        v-for="item in room.items"
        :key="item.id"
        :item="item"
        editable
        @update="(patch) => updateItem(room.id, item.id, patch)"
      />
    </NeoCard>

    <NeoButton class="mt-6" variant="primary" block @click="confirm">Confirm & continue</NeoButton>
  </AppShell>
</template>
