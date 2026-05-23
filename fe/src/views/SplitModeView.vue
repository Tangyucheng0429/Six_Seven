<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import SplitModeToggle from '../components/bill/SplitModeToggle.vue'
import EqualSplitSettingsCard from '../components/bill/EqualSplitSettingsCard.vue'
import BillMenuList from '../components/bill/BillMenuList.vue'
import ReceiptPreviewCard from '../components/bill/ReceiptPreviewCard.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { useFormValidation } from '../composables/useFormValidation'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'
import { hostRoomPath } from '../composables/roomPaths'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { setSplitMode, confirmSplitMode, setEqualSplitSettings } = useRoomState()
const { shaking, hint, validate } = useFormValidation()

const splitMode = computed({
  get: () => room.value?.splitMode ?? 'item',
  set: (v) => setSplitMode(roomId.value, v),
})

const equalHeadcount = computed({
  get: () => room.value?.equalHeadcount ?? 2,
  set: (n) => setEqualSplitSettings(roomId.value, { headcount: n }),
})

const equalHostParticipates = computed({
  get: () => room.value?.equalHostParticipates !== false,
  set: (v) => setEqualSplitSettings(roomId.value, { hostParticipates: v }),
})

const hasMenu = computed(() => (room.value?.items?.length ?? 0) > 0)

function next() {
  if (!room.value?.splitMode) setSplitMode(roomId.value, splitMode.value)
  if (splitMode.value === 'equal') {
    const count = room.value?.equalHeadcount ?? 0
    if (
      !validate(
        [{ key: 'equal', valid: count >= 1, message: 'Set how many people are splitting' }],
        'Set how many people are splitting',
      )
    ) {
      return
    }
  }
  confirmSplitMode(roomId.value)
  router.push(hostRoomPath(room.value, 'review'))
}

function goBack() {
  router.push(hostBackRoute(room.value, 'split-mode'))
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Choose split mode"
    subtitle="How should members pay?"
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="3" />

    <ValidationAlert class="mb-4" :message="hint" :shake="shaking" />

    <SplitModeToggle v-model="splitMode" />

    <EqualSplitSettingsCard
      v-if="splitMode === 'equal' && room"
      class="mt-4"
      :room="room"
      :headcount="equalHeadcount"
      :host-participates="equalHostParticipates"
      @update:headcount="equalHeadcount = $event"
      @update:host-participates="equalHostParticipates = $event"
    />

    <ReceiptPreviewCard
      v-if="room.receiptImageUrl"
      class="mt-4"
      :image-url="room.receiptImageUrl"
      hint="Reference while you choose equal or by-item split."
    />

    <NeoCard v-if="hasMenu" class="mt-4">
      <p class="neo-section-label mb-2">Scanned menu</p>
      <p class="mb-3 text-xs text-neo-ink/70">
        {{ splitMode === 'equal' ? 'Everyone splits this bill equally.' : 'Members will pick from these items.' }}
      </p>
      <BillMenuList :room="room" />
    </NeoCard>

    <NeoCard class="mt-6">
      <p class="text-sm font-medium">
        <span class="font-bold">Equal</span> — total ÷ members, skip item picking.<br />
        <span class="font-bold">By item</span> — each member selects what they ordered.
      </p>
    </NeoCard>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton variant="primary" block @click="next">Continue</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
