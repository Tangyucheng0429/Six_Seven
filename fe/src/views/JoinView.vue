<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'
import { MEMBER_STEPS, staticBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.query.room || 'demo01')
const room = useRoom(roomId)
const { joinRoom } = useRoomState()

const name = ref('')

function submit() {
  if (!name.value.trim() || !room.value) return
  joinRoom(roomId.value, name.value.trim())
  if (room.value.splitMode === 'equal') {
    router.push(`/room/${roomId.value}/pay`)
  } else {
    router.push(`/room/${roomId.value}/assign`)
  }
}

function goBack() {
  router.push(staticBackRoute('join'))
}
</script>

<template>
  <AppShell title="Join bill" subtitle="No login — enter your name only.">
    <FlowProgress :steps="MEMBER_STEPS" :current="0" />

    <NeoCard v-if="room" class="mb-6">
      <p class="text-xs font-bold uppercase">Room</p>
      <p class="text-2xl font-bold">{{ room.name }}</p>
      <p class="mt-1 text-sm">Host: {{ room.hostName }}</p>
      <p class="mt-2 text-sm">Due: {{ formatDueDate(room.dueDate) }}</p>
      <NeoBadge class="mt-2" variant="default">
        {{ room.splitMode === 'equal' ? 'Equal split — no item picking' : 'Pick your items next' }}
      </NeoBadge>
    </NeoCard>
    <p v-else class="font-bold text-neo-danger">Room not found.</p>

    <form v-if="room" id="join-form" class="space-y-4" @submit.prevent="submit">
      <NeoInput id="name" v-model="name" label="Your name" placeholder="Ali" />
    </form>

    <FlowNavBar v-if="room" @back="goBack">
      <NeoButton type="submit" form="join-form" variant="accent" block>Join room</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
