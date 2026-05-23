<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { setReceiptImage } = useRoomState()

const preview = ref(room.value?.receiptImageUrl || null)

function onFile({ previewUrl }) {
  preview.value = previewUrl
  setReceiptImage(roomId.value, previewUrl)
}

function onClear() {
  preview.value = null
  setReceiptImage(roomId.value, null)
}

function next() {
  router.push(`/room/${roomId.value}/scan`)
}

function goBack() {
  router.push(hostBackRoute(roomId.value, 'upload'))
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Upload receipt"
    :subtitle="`Due ${formatDueDate(room.dueDate)} · ${room.hostEmail}`"
    :room-code="room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="1" />

    <NeoFileUpload label="Receipt image" :preview-url="preview" @file="onFile" @clear="onClear" />

    <NeoCard class="mt-4">
      <p class="text-xs font-bold uppercase">Next</p>
      <p class="mt-1 text-sm">OCR / AI will extract line items from Malaysian receipt formats.</p>
    </NeoCard>

    <FlowNavBar @back="goBack">
      <NeoButton variant="primary" block :disabled="!preview" @click="next">
        Run OCR scan
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
