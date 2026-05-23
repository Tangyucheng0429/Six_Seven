<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import PaymentMethodCard from '../components/bill/PaymentMethodCard.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import { useRoom, useRoomState, formatMYR } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'
import { useFormValidation } from '../composables/useFormValidation'
import { MEMBER_STEPS, memberBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { markPaid, state } = useRoomState()
const { shaking, hint, hasError, clearField, validate } = useFormValidation()

const proofPreview = ref(null)
const member = computed(() => room.value?.members.find((m) => m.id === state.currentMemberId))

const memberStep = computed(() => (room.value?.splitMode === 'equal' ? 1 : 2))

function onProof({ previewUrl }) {
  proofPreview.value = previewUrl
  clearField('proof')
}

function submitPaid() {
  if (!member.value) return
  if (!validate([{ key: 'proof', valid: !!proofPreview.value, message: 'Upload payment proof' }])) {
    return
  }
  markPaid(roomId.value, member.value.id, proofPreview.value)
  router.push(`/room/${roomId.value}/done`)
}

function goBack() {
  if (!room.value) return
  router.push(
    memberBackRoute(roomId.value, 'pay', {
      splitMode: room.value.splitMode,
      inviteToken: room.value.inviteToken,
    }),
  )
}
</script>

<template>
  <AppShell
    v-if="room && member"
    title="Pay your share"
    :subtitle="`Due ${formatDueDate(room.dueDate)}`"
    :room-code="room.id"
  >
    <FlowProgress :steps="MEMBER_STEPS" :current="memberStep" />

    <NeoCard accent class="mb-6 text-center">
      <p class="text-xs font-bold uppercase">You owe</p>
      <p class="font-mono text-4xl font-bold">{{ formatMYR(member.amountDue) }}</p>
      <p v-if="room.splitMode === 'equal'" class="mt-2 text-xs">Equal split — auto calculated</p>
    </NeoCard>

    <PaymentMethodCard :method="room.paymentMethod" />

    <ValidationAlert :message="hint" :shake="shaking" />

    <NeoFileUpload
      class="mt-6"
      label="Payment proof"
      :preview-url="proofPreview"
      :error="hasError('proof')"
      error-message="Upload payment proof"
      :shake="hasError('proof') && shaking"
      @file="onProof"
      @clear="proofPreview = null"
    />

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton variant="primary" block :disabled="member.paid" @click="submitPaid">
        Continue
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
