<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import { useRoom, useRoomState, formatMYR } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { toggleItemAssignment, state } = useRoomState()

const memberId = computed(() => state.currentMemberId)

function isSelected(item) {
  return item.assignedTo.includes(memberId.value)
}

function toggle(itemId) {
  toggleItemAssignment(roomId.value, itemId, memberId.value)
}

function next() {
  router.push(`/room/${roomId.value}/pay`)
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Pick your items"
    subtitle="Tap each dish you ordered."
    :room-code="room.id"
  >
    <ul class="space-y-3">
      <li v-for="item in room.items" :key="item.id">
        <button
          type="button"
          class="neo-pressable w-full border-3 border-neo-ink p-4 text-left neo-shadow"
          :class="isSelected(item) ? 'bg-neo-primary' : 'bg-neo-surface'"
          @click="toggle(item.id)"
        >
          <span class="font-bold">{{ item.name }}</span>
          <span class="float-right font-mono">{{ formatMYR(item.price) }}</span>
        </button>
      </li>
    </ul>

    <NeoButton class="mt-6" variant="primary" block @click="next">Continue to pay</NeoButton>
  </AppShell>
</template>
