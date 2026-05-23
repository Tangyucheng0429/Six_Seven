<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import InviteLinkBox from '../components/bill/InviteLinkBox.vue'
import AmountSummary from '../components/bill/AmountSummary.vue'
import PaymentProofList from '../components/bill/PaymentProofList.vue'
import MemberChip from '../components/bill/MemberChip.vue'
import DueDateAlert from '../components/bill/DueDateAlert.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'
import { HOST_STEPS, hostStepIndex, hostBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { confirmPayment, completeRoom, checkDueDate, unpaidTotal } = useRoomState()

onMounted(() => {
  if (roomId.value) checkDueDate(roomId.value)
})

const unpaid = computed(() => (room.value ? unpaidTotal(room.value) : 0))

const allConfirmed = computed(() => {
  const payers = room.value?.members.filter((m) => !m.isHost) ?? []
  return payers.length > 0 && payers.every((m) => m.confirmed)
})

const step = computed(() => hostStepIndex(room.value?.status))

function finish() {
  completeRoom(roomId.value)
  router.push('/history')
}

function goBack() {
  router.push(hostBackRoute(roomId.value, 'dashboard'))
}
</script>

<template>
  <AppShell
    v-if="room"
    :title="room.name"
    :subtitle="`Due ${formatDueDate(room.dueDate)} · ${room.hostEmail}`"
    :room-code="room.id"
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

    <p v-if="!allConfirmed" class="mt-4 text-center text-xs font-bold text-neo-ink/60">
      Confirm all payments to complete the bill.
    </p>

    <FlowNavBar @back="goBack">
      <NeoButton
        v-if="allConfirmed"
        class="animate-neo-pop"
        variant="primary"
        block
        @click="finish"
      >
        Save to history
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
