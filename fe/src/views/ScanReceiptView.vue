<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { loadReceiptMock } = useRoomState()

const started = ref(false)

const scanning = computed(
  () => room.value?.status === 'scanning' || room.value?.status === 'uploaded',
)

function runScan() {
  if (started.value) return
  started.value = true
  loadReceiptMock(roomId.value)
}

function goBack() {
  router.push(hostBackRoute(roomId.value, 'scan'))
}

onMounted(runScan)

watch(
  () => room.value?.status,
  (status) => {
    if (status === 'split_mode') {
      router.replace(`/room/${roomId.value}/split-mode`)
    }
  },
)
</script>

<template>
  <AppShell v-if="room" title="AI scanning…" subtitle="Extracting items & prices from your receipt." :room-code="room.id">
    <FlowProgress :steps="HOST_STEPS" :current="2" />

    <NeoCard class="flex flex-col items-center py-12">
      <img
        v-if="room.receiptImageUrl"
        :src="room.receiptImageUrl"
        alt="Receipt"
        class="mb-6 max-h-40 border-3 border-neo-ink object-contain neo-shadow"
      />
      <div
        class="size-12 animate-spin rounded-full border-4 border-neo-ink border-t-neo-primary"
        aria-hidden="true"
      />
      <p class="mt-4 font-bold">OpenAI OCR pipeline (mock)</p>
      <p class="mt-1 text-sm text-neo-ink/70">Items · SST per line · service charge</p>
    </NeoCard>

    <FlowNavBar @back="goBack">
      <NeoButton variant="primary" block disabled>
        {{ scanning ? 'Scanning…' : 'Continue' }}
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
