<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { setReceiptImage, loadReceiptMock } = useRoomState()

const preview = ref(room.value?.receiptImageUrl || null)
const scanning = ref(false)

function onFile({ previewUrl }) {
  preview.value = previewUrl
  setReceiptImage(roomId.value, previewUrl)
}

function onClear() {
  preview.value = null
  setReceiptImage(roomId.value, null)
}

async function scan() {
  if (!preview.value) return
  scanning.value = true
  await new Promise((r) => setTimeout(r, 800))
  loadReceiptMock(roomId.value)
  scanning.value = false
  router.push(`/room/${roomId.value}/review`)
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Upload receipt"
    subtitle="Snap or upload — AI will read the items (mock for now)."
    :room-code="room.id"
  >
    <NeoFileUpload label="Receipt image" :preview-url="preview" @file="onFile" @clear="onClear" />

    <NeoCard class="mt-4">
      <p class="text-xs font-bold uppercase">Tip</p>
      <p class="mt-1 text-sm">Flat, well-lit photos work best for Malaysian receipt formats.</p>
    </NeoCard>

    <NeoButton class="mt-6" variant="primary" block :disabled="!preview" :loading="scanning" @click="scan">
      Scan receipt
    </NeoButton>
  </AppShell>
</template>
