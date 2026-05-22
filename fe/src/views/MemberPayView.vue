<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import PaymentMethodCard from '../components/bill/PaymentMethodCard.vue'
import { useRoom, useRoomState, formatMYR } from '../composables/useRoomState'

const route = useRoute()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { markPaid, state } = useRoomState()

const proofPreview = ref(null)
const member = computed(() => room.value?.members.find((m) => m.id === state.currentMemberId))

function onProof({ previewUrl }) {
  proofPreview.value = previewUrl
}

function submitPaid() {
  if (!member.value) return
  markPaid(roomId.value, member.value.id, proofPreview.value)
}
</script>

<template>
  <AppShell
    v-if="room && member"
    title="Your share"
    :subtitle="`Pay ${formatMYR(member.amountDue)} to ${room.hostName}`"
    :room-code="room.id"
  >
    <NeoCard accent class="mb-6 text-center">
      <p class="text-xs font-bold uppercase">You owe</p>
      <p class="font-mono text-4xl font-bold">{{ formatMYR(member.amountDue) }}</p>
    </NeoCard>

    <PaymentMethodCard :method="room.paymentMethod" />

    <div class="mt-6 space-y-4">
      <NeoFileUpload
        label="Payment proof (optional)"
        :preview-url="proofPreview"
        @file="onProof"
        @clear="proofPreview = null"
      />
      <NeoButton variant="primary" block :disabled="member.paid" @click="submitPaid">
        {{ member.paid ? 'Marked as paid' : 'I have paid' }}
      </NeoButton>
      <p v-if="member.paid" class="text-center text-sm font-bold text-neo-success">
        Waiting for host to confirm
      </p>
    </div>
  </AppShell>
</template>
