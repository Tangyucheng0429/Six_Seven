<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import InviteLinkBox from '../components/bill/InviteLinkBox.vue'
import AmountSummary from '../components/bill/AmountSummary.vue'
import ReceiptPreviewCard from '../components/bill/ReceiptPreviewCard.vue'
import PaymentProofList from '../components/bill/PaymentProofList.vue'
import MemberChip from '../components/bill/MemberChip.vue'
import DueDateAlert from '../components/bill/DueDateAlert.vue'
import { useRoom, useRoomState, clearMemberSessionIfHost, equalSplitMemberCapacity } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'
import { HOST_STEPS, hostStepIndex } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { confirmPayment, completeRoom, checkDueDate, unpaidTotal, fetchRoom } = useRoomState()

let pollTimer = null

onMounted(() => {
  if (!roomId.value) return
  if (room.value) clearMemberSessionIfHost(room.value)
  checkDueDate(roomId.value)
  fetchRoom(roomId.value, { role: 'host' }).then((r) => {
    if (r) clearMemberSessionIfHost(r)
  })
  pollTimer = setInterval(() => fetchRoom(roomId.value, { role: 'host' }), 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

const unpaid = computed(() => (room.value ? unpaidTotal(room.value) : 0))

const allConfirmed = computed(() => {
  const payers = room.value?.members.filter((m) => !m.isHost) ?? []
  return payers.length > 0 && payers.every((m) => m.confirmed)
})

const step = computed(() => hostStepIndex(room.value?.status))

const equalCapacity = computed(() =>
  room.value ? equalSplitMemberCapacity(room.value) : null,
)

const isFinished = computed(
  () => room.value?.status === 'completed' || allConfirmed.value,
)

function goHome() {
  if (room.value?.status !== 'completed') {
    completeRoom(roomId.value)
  }
  router.push('/')
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <AppShell
    v-if="room"
    :title="room.name"
    :subtitle="`Due ${formatDueDate(room.dueDate)} · ${room.hostEmail}`"
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="step" />

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <NeoBadge :variant="room.status === 'completed' ? 'success' : room.status === 'overdue' ? 'danger' : 'warning'">
        {{ room.status }}
      </NeoBadge>
      <NeoBadge variant="default">{{ room.splitMode === 'equal' ? 'Equal' : 'By item' }}</NeoBadge>
    </div>

    <DueDateAlert
      class="mb-4"
      :room="room"
      :unpaid-total="unpaid"
      :email-sent="room.overdueEmailSent"
    />

    <InviteLinkBox :room-code="room.roomCode || room.inviteToken" />

    <p
      v-if="room.splitMode === 'equal' && equalCapacity"
      class="mt-3 text-center text-xs font-bold"
      :class="equalCapacity.isFull ? 'text-neo-danger' : 'text-neo-ink/70'"
    >
      <template v-if="equalCapacity.isFull">Invite closed — all {{ equalCapacity.maxMembers }} member slots filled.</template>
      <template v-else>
        {{ equalCapacity.spotsLeft }} invite spot{{ equalCapacity.spotsLeft === 1 ? '' : 's' }} left
        ({{ equalCapacity.memberCount }}/{{ equalCapacity.maxMembers }} members joined)
      </template>
    </p>

    <ReceiptPreviewCard
      v-if="room.receiptImageUrl"
      class="mt-6"
      :image-url="room.receiptImageUrl"
      hint="Tap to view the original receipt photo."
    />

    <AmountSummary class="mt-6" :room="room" :items="room.items" :members="room.members" />

    <div class="mt-6 space-y-2">
      <p class="neo-section-label">Member status</p>
      <MemberChip v-for="m in room.members" :key="m.id" :member="m" />
    </div>

    <PaymentProofList
      class="mt-6"
      :members="room.members"
      is-host
      @confirm="(id) => confirmPayment(room.id, id)"
    />

    <p v-if="!allConfirmed" class="mt-4 text-center text-xs font-bold text-neo-ink/60">
      Confirm all payments to complete the bill.
    </p>

    <FlowNavBar v-if="isFinished" hide-back>
      <NeoButton class="animate-neo-pop" variant="primary" block @click="goHome">
        Done
      </NeoButton>
    </FlowNavBar>
    <FlowNavBar v-else back-label="Home" @back="goBack" />
  </AppShell>
</template>
