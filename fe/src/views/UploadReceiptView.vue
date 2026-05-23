<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'
import { useFormValidation } from '../composables/useFormValidation'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'
import { hostRoomPath } from '../composables/roomPaths'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { setReceiptImage } = useRoomState()
const { shaking, hint, hasError, fieldHint, clearField, validate } = useFormValidation()

const preview = ref(room.value?.receiptImageUrl || null)

function onFile({ file, previewUrl }) {
  preview.value = previewUrl
  setReceiptImage(roomId.value, previewUrl, file)
  clearField('receipt')
}

function onClear() {
  preview.value = null
  setReceiptImage(roomId.value, null)
}

function next() {
  if (!validate([{ key: 'receipt', valid: !!preview.value, message: 'Upload a receipt image' }])) {
    return
  }
  router.push(hostRoomPath(room.value, 'scan'))
}

function goBack() {
  router.push(hostBackRoute(room.value, 'upload'))
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Upload receipt"
    :subtitle="`Due ${formatDueDate(room.dueDate)} · ${room.hostEmail}`"
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="1" />

    <ValidationAlert :message="hint" :shake="shaking" />
    <NeoFileUpload
      label="Receipt image"
      :preview-url="preview"
      :error="hasError('receipt')"
      error-message="Upload a receipt image"
      :shake="hasError('receipt') && shaking"
      @file="onFile"
      @clear="onClear"
    />

    <NeoCard class="mt-4">
      <p class="text-xs font-bold uppercase">Next</p>
      <p class="mt-1 text-sm">Upload a clear photo of your receipt.</p>
    </NeoCard>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton variant="primary" block @click="next">Continue</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
