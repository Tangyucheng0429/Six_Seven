<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import MemberPayBreakdown from '../components/bill/MemberPayBreakdown.vue'
import ReceiptPreviewCard from '../components/bill/ReceiptPreviewCard.vue'
import PaymentMethodCard from '../components/bill/PaymentMethodCard.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import { useRoomState } from '../composables/useRoomState'
import { useMemberRoom } from '../composables/useMemberRoom'
import { useRestoreMemberSession } from '../composables/useMemberSession'
import { formatDueDate } from '../composables/useDueDate'
import { useFormValidation } from '../composables/useFormValidation'
import { MEMBER_STEPS, memberBackRoute } from '../constants/flows'
import { apiErrorMessage } from '../api/client.js'
import { memberRoomPath, hostRoomPath } from '../composables/roomPaths'
import { isHostOfRoom } from '../composables/useHostCookie'
import { clearMemberSessionIfHost } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const { room } = useMemberRoom(roomId, { pollMs: 8000 })
const { markPaid, state, getMyAccessList } = useRoomState()
const { shaking, hint, hasError, clearField, validate } = useFormValidation()

useRestoreMemberSession(roomId, { state, getMyAccessList })

const proofPreview = ref(null)
const proofFile = ref(null)

const member = computed(() => {
  const id = state.currentMemberId
  if (!id || !room.value) return null
  const m = room.value.members?.find((p) => p.id === id)
  return m?.isHost ? null : m
})

watch(
  room,
  (r) => {
    if (!r) return
    if (isHostOfRoom(r, state.currentMemberId)) {
      clearMemberSessionIfHost(r)
      router.replace(hostRoomPath(r, 'dashboard'))
    }
  },
  { immediate: true },
)

const memberStep = computed(() => (room.value?.splitMode === 'equal' ? 1 : 2))

const submitting = ref(false)
const submitError = ref('')

watch(
  () => member.value?.paid,
  (paid) => {
    if (paid && room.value) {
      router.replace(memberRoomPath(room.value, 'done'))
    }
  },
  { immediate: true },
)

watch(
  () => member.value?.proofUrl,
  (url) => {
    if (url && !proofPreview.value) proofPreview.value = url
  },
  { immediate: true },
)

function onProof({ file, previewUrl }) {
  proofPreview.value = previewUrl
  proofFile.value = file
  clearField('proof')
}

async function submitPaid() {
  if (!member.value) return
  if (member.value.paid) {
    router.push(memberRoomPath(room.value, 'done'))
    return
  }
  if (!validate([{ key: 'proof', valid: !!proofFile.value, message: 'Upload payment proof' }])) {
    return
  }
  submitting.value = true
  submitError.value = ''
  try {
    await markPaid(roomId.value, member.value.id, proofFile.value)
    router.push(memberRoomPath(room.value, 'done'))
  } catch (err) {
    submitError.value = apiErrorMessage(err)
  } finally {
    submitting.value = false
  }
}

function goJoin() {
  if (!room.value) return
  router.push(`/join/${room.value.roomCode || room.value.inviteToken}`)
}

function goBack() {
  if (!room.value) {
    router.push('/')
    return
  }
  router.push(
    memberBackRoute(room.value, 'pay', {
      splitMode: room.value.splitMode,
      inviteToken: room.value.roomCode || room.value.inviteToken,
    }),
  )
}
</script>

<template>
  <AppShell
    v-if="room && member"
    title="Pay your share"
    :subtitle="`Due ${formatDueDate(room.dueDate)}`"
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="MEMBER_STEPS" :current="memberStep" />

    <NeoBadge v-if="member.paid || member.proofUrl" class="mb-4" variant="warning">
      Proof submitted — waiting for host
    </NeoBadge>

    <MemberPayBreakdown :room="room" :member-id="member.id" />

    <ReceiptPreviewCard
      v-if="room.receiptImageUrl"
      :image-url="room.receiptImageUrl"
      :hint="
        room.splitMode === 'equal'
          ? 'Original receipt from host — check the bill while you pay your share.'
          : 'Original receipt from host — compare with your items above.'
      "
    />

    <PaymentMethodCard :method="room.paymentMethod" />

    <ValidationAlert :message="hint || submitError" :shake="shaking" />

    <NeoFileUpload
      class="mt-6"
      label="Payment proof"
      :preview-url="proofPreview"
      :error="hasError('proof')"
      error-message="Upload payment proof"
      :shake="hasError('proof') && shaking"
      @file="onProof"
      @clear="proofPreview = null; proofFile = null"
    />

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton
        variant="primary"
        block
        :loading="submitting"
        :disabled="member.paid"
        @click="submitPaid"
      >
        {{ member.paid ? 'Submitted' : 'Continue' }}
      </NeoButton>
    </FlowNavBar>
  </AppShell>

  <AppShell
    v-else-if="room"
    title="Pay your share"
    subtitle="Re-join to continue paying."
    :room-code="room.roomCode || room.id"
  >
    <p class="text-sm font-bold">Your session expired. Re-enter your name to pay.</p>
    <NeoButton class="mt-6" variant="accent" block @click="goJoin">Join again</NeoButton>
    <FlowNavBar @back="goBack" />
  </AppShell>

  <AppShell v-else title="Pay your share" subtitle="Room not found.">
    <p class="text-sm font-bold text-neo-danger">Room not found.</p>
    <NeoButton class="mt-6" variant="secondary" block @click="router.push('/')">Home</NeoButton>
  </AppShell>
</template>
