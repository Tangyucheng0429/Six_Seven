<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import SplitModeToggle from '../components/bill/SplitModeToggle.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { HOST_STEPS } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { setSplitMode, confirmSplitMode } = useRoomState()

const splitMode = computed({
  get: () => room.value?.splitMode ?? 'item',
  set: (v) => setSplitMode(roomId.value, v),
})

function next() {
  if (!room.value?.splitMode) setSplitMode(roomId.value, splitMode.value)
  confirmSplitMode(roomId.value)
  router.push(`/room/${roomId.value}/review`)
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Choose split mode"
    subtitle="How should members pay?"
    :room-code="room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="3" />

    <SplitModeToggle v-model="splitMode" />

    <NeoCard class="mt-6">
      <p class="text-sm font-medium">
        <span class="font-bold">Equal</span> — total ÷ members, skip item picking.<br />
        <span class="font-bold">By item</span> — each member selects what they ordered.
      </p>
    </NeoCard>

    <NeoButton class="mt-6" variant="primary" block @click="next">Continue to verify items</NeoButton>
  </AppShell>
</template>
