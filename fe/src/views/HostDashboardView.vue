<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import InviteLinkBox from '../components/bill/InviteLinkBox.vue'
import AmountSummary from '../components/bill/AmountSummary.vue'
import PaymentProofList from '../components/bill/PaymentProofList.vue'
import MemberChip from '../components/bill/MemberChip.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { confirmPayment, completeRoom } = useRoomState()

const allConfirmed = computed(() => {
  const payers = room.value?.members.filter((m) => !m.isHost) ?? []
  return payers.length > 0 && payers.every((m) => m.confirmed)
})

function finish() {
  completeRoom(roomId.value)
  router.push('/history')
}
</script>

<template>
  <AppShell
    v-if="room"
    :title="room.name"
    subtitle="Host dashboard — track who paid."
    :room-code="room.id"
  >
    <div class="mb-4 flex items-center gap-2">
      <NeoBadge :variant="room.status === 'completed' ? 'success' : 'warning'">{{ room.status }}</NeoBadge>
      <NeoBadge variant="default">{{ room.splitMode === 'equal' ? 'Equal' : 'By item' }}</NeoBadge>
    </div>

    <InviteLinkBox :room-id="room.id" :invite-token="room.inviteToken" />

    <div class="mt-6 space-y-2">
      <p class="text-xs font-bold uppercase tracking-widest">Members</p>
      <MemberChip v-for="m in room.members" :key="m.id" :member="m" />
    </div>

    <AmountSummary class="mt-6" :items="room.items" :members="room.members" />

    <PaymentProofList
      class="mt-6"
      :members="room.members"
      is-host
      @confirm="(id) => confirmPayment(room.id, id)"
    />

    <NeoButton
      v-if="allConfirmed"
      class="mt-6 animate-neo-pop"
      variant="primary"
      block
      @click="finish"
    >
      Complete bill
    </NeoButton>
    <NeoButton v-else class="mt-4" variant="ghost" block @click="router.push(`/room/${room.id}/upload`)">
      Re-upload receipt
    </NeoButton>
  </AppShell>
</template>
