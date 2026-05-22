<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'

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
</script>

<template>
  <AppShell title="Join bill" subtitle="No login — just your name.">
    <NeoCard v-if="room" class="mb-6">
      <p class="text-xs font-bold uppercase">Room</p>
      <p class="text-2xl font-bold">{{ room.name }}</p>
      <p class="mt-1 text-sm">Host: {{ room.hostName }}</p>
    </NeoCard>
    <p v-else class="font-bold text-neo-danger">Room not found.</p>

    <form v-if="room" class="space-y-4" @submit.prevent="submit">
      <NeoInput id="name" v-model="name" label="Your name" placeholder="Ali" />
      <NeoButton type="submit" variant="accent" block>Join room</NeoButton>
    </form>
  </AppShell>
</template>
