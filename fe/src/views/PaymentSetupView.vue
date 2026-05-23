<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoTextarea from '../components/ui/NeoTextarea.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { apiErrorMessage } from '../api/client.js'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'
import { hostRoomPath } from '../composables/roomPaths'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { setPaymentMethod, publishRoom } = useRoomState()
const publishing = ref(false)
const publishError = ref('')

const types = [
  { value: 'duitnow', label: 'DuitNow QR' },
  { value: 'tng', label: "Touch 'n Go" },
  { value: 'bank', label: 'Bank transfer' },
]

const selected = ref(room.value?.paymentMethod?.type || 'duitnow')
const notes = ref(room.value?.paymentMethod?.notes || '')
const qrPreview = ref(room.value?.paymentMethod?.imageUrl || null)

function onQr({ file, previewUrl }) {
  qrPreview.value = previewUrl
  setPaymentMethod(roomId.value, { imageUrl: previewUrl }, file)
}

async function publish() {
  const label = types.find((t) => t.value === selected.value)?.label || selected.value
  publishing.value = true
  publishError.value = ''
  try {
    setPaymentMethod(roomId.value, {
      type: selected.value,
      label,
      notes: notes.value,
      imageUrl: qrPreview.value,
    })
    await publishRoom(roomId.value, {
      type: selected.value,
      notes: notes.value,
      label,
    })
    router.push(hostRoomPath(room.value, 'dashboard'))
  } catch (err) {
    publishError.value = apiErrorMessage(err)
  } finally {
    publishing.value = false
  }
}

function goBack() {
  router.push(hostBackRoute(room.value, 'payment-setup'))
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Payment method"
    subtitle="Members see this when paying you."
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="5" />

    <div class="mb-4 grid grid-cols-1 gap-2">
      <button
        v-for="t in types"
        :key="t.value"
        type="button"
        class="neo-pressable border-3 border-neo-ink px-4 py-3 text-left font-bold neo-shadow"
        :class="selected === t.value ? 'bg-neo-primary' : 'bg-neo-surface'"
        @click="selected = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="publishError" class="mb-3 text-sm font-bold text-neo-danger">{{ publishError }}</p>
    <NeoFileUpload label="QR code (optional)" :preview-url="qrPreview" @file="onQr" @clear="qrPreview = null" />
    <NeoTextarea id="notes" v-model="notes" class="mt-4" label="Transfer notes" placeholder="Ref: FRIDAY — Jeff" />

    <FlowNavBar @back="goBack">
      <NeoButton variant="accent" block :loading="publishing" @click="publish">Continue</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
