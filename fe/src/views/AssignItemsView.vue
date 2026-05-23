<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import {
  useRoom,
  useRoomState,
  formatMYR,
  itemMemberQuantity,
  itemMemberPoolTotal,
} from '../composables/useRoomState'
import { isAssignableKind } from '../constants/items'
import { useFormValidation } from '../composables/useFormValidation'
import { MEMBER_STEPS, staticBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { toggleItemAssignment, state } = useRoomState()
const { shaking, hint, hasError, clearField, validate, triggerShake } = useFormValidation()

const memberId = computed(() => state.currentMemberId)

const memberItems = computed(
  () =>
    room.value?.items.filter(
      (item) => isAssignableKind(item.kind) && itemMemberQuantity(item) > 0,
    ) ?? [],
)

const hasSelection = computed(() =>
  memberItems.value.some((item) => item.assignedTo.includes(memberId.value)),
)

function isSelected(item) {
  return item.assignedTo.includes(memberId.value)
}

function toggle(itemId) {
  toggleItemAssignment(roomId.value, itemId, memberId.value)
  clearField('items')
}

function next() {
  if (!memberItems.value.length) {
    triggerShake('No items left — host marked everything as theirs.')
    return
  }
  if (!validate([{ key: 'items', valid: hasSelection.value }], 'Pick at least one item')) {
    return
  }
  router.push(`/room/${roomId.value}/pay`)
}

function goBack() {
  router.push(staticBackRoute('assign'))
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Pick your items"
    subtitle="Pick what you ate — tax & service charge are added automatically."
    :room-code="room.id"
  >
    <FlowProgress :steps="MEMBER_STEPS" :current="1" />

    <ValidationAlert :message="hint" :shake="shaking" />

    <p v-if="memberItems.length" class="mb-3 text-xs font-medium text-neo-ink/70">
      Tax and service charge are split by your menu share — no need to select them.
    </p>
    <p v-else-if="room.items.some((i) => isAssignableKind(i.kind))" class="mb-3 text-xs font-medium text-neo-ink/70">
      Only portions not marked as host food appear here.
    </p>

    <ul class="space-y-3" :class="hasError('items') && shaking ? 'animate-neo-shake' : ''">
      <li v-for="item in memberItems" :key="item.id">
        <button
          type="button"
          class="neo-pressable flex w-full items-start justify-between gap-3 border-3 p-4 text-left neo-shadow"
          :class="[
            isSelected(item) ? 'bg-neo-primary border-neo-ink' : 'bg-neo-surface border-neo-ink',
            hasError('items') ? 'border-neo-danger' : '',
          ]"
          @click="toggle(item.id)"
        >
          <span class="min-w-0 font-bold leading-snug">
            {{ item.name }}
            <span v-if="itemMemberQuantity(item) !== item.quantity" class="font-normal text-neo-ink/60">
              · {{ itemMemberQuantity(item) }} to claim
            </span>
            <span v-else-if="item.quantity > 1" class="block font-normal text-neo-ink/60 sm:inline">
              × {{ item.quantity }}
            </span>
          </span>
          <span class="shrink-0 font-mono text-sm font-bold">{{ formatMYR(itemMemberPoolTotal(item)) }}</span>
        </button>
      </li>
    </ul>

    <p v-if="!memberItems.length" class="text-center text-sm font-bold text-neo-ink/60">
      All items are marked as host-only — nothing left to pick.
    </p>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton variant="primary" block @click="next">Continue</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
