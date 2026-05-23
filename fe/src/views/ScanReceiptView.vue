<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'
import { hostRoomPath } from '../composables/roomPaths'
import { apiErrorMessage } from '../api/client.js'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { uploadAndScanReceipt, getRoomError, ensureRoom, isRoomLoading } = useRoomState()

const started = ref(false)
const scanError = ref('')

const scanning = computed(
  () => room.value?.status === 'scanning' || room.value?.status === 'uploaded',
)

const loadingRoom = computed(() => isRoomLoading(roomId.value))

async function runScan() {
  if (started.value || !room.value?.id) return
  started.value = true
  scanError.value = ''
  try {
    await uploadAndScanReceipt(roomId.value)
  } catch (err) {
    scanError.value = apiErrorMessage(err) || getRoomError(roomId.value) || 'Scan failed'
    started.value = false
  }
}

function goBack() {
  if (room.value) {
    router.push(hostBackRoute(room.value, 'scan'))
  } else {
    router.push('/')
  }
}

watch(
  () => room.value?.id,
  (id) => {
    if (id) runScan()
  },
  { immediate: true },
)

watch(
  () => room.value?.status,
  (status) => {
    if (status === 'split_mode' && room.value) {
      router.replace(hostRoomPath(room.value, 'split-mode'))
    }
  },
)

watch(roomId, async (id) => {
  if (id && !room.value) await ensureRoom(id)
})
</script>

<template>
  <AppShell
    v-if="room"
    title="AI scanning…"
    subtitle="Extracting items & prices from your receipt."
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="2" />

    <NeoCard class="flex flex-col items-center py-12">
      <img
        v-if="room.receiptImageUrl"
        :src="room.receiptImageUrl"
        alt="Receipt"
        class="mb-6 max-h-40 border-3 border-neo-ink object-contain neo-shadow"
      />
      <div
        v-if="!scanError"
        class="size-12 animate-spin rounded-full border-4 border-neo-ink border-t-neo-primary"
        aria-hidden="true"
      />
      <p v-if="scanError" class="mt-4 text-center font-bold text-neo-danger">{{ scanError }}</p>
      <p v-else class="mt-4 font-bold">Scanning your receipt…</p>
      <p class="mt-1 text-sm text-neo-ink/70">Reading items and totals from your photo.</p>
    </NeoCard>

    <FlowNavBar @back="goBack">
      <NeoButton variant="primary" block disabled>
        {{ scanning ? 'Scanning…' : 'Continue' }}
      </NeoButton>
    </FlowNavBar>
  </AppShell>

  <AppShell
    v-else
    title="AI scanning…"
    :subtitle="loadingRoom ? 'Loading room…' : 'Room not found.'"
    :room-code="roomId"
  >
    <p v-if="!loadingRoom" class="text-sm font-bold text-neo-danger">
      Go back and upload your receipt again.
    </p>
    <FlowNavBar @back="goBack" />
  </AppShell>
</template>
