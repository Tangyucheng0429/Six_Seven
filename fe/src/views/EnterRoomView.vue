<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import { getRoomById } from '../composables/useRoomState'
import { staticBackRoute } from '../constants/flows'

const router = useRouter()
const roomNumber = ref('')
const error = ref('')

function submit() {
  const id = roomNumber.value.trim().toLowerCase()
  error.value = ''
  if (!id) return

  const room = getRoomById(id)
  if (!room) {
    error.value = 'Room not found. Check the number with your host.'
    return
  }
  if (room.status !== 'open' && room.status !== 'overdue') {
    error.value = 'This bill is not open for members yet. Ask the host to finish setup.'
    return
  }

  router.push(`/join/${room.inviteToken}?room=${room.id}`)
}

function goBack() {
  router.push(staticBackRoute('enter-room'))
}
</script>

<template>
  <AppShell title="Enter room number" subtitle="Join a bill without the invite link.">
    <form id="enter-room-form" class="space-y-4" @submit.prevent="submit">
      <NeoInput
        id="room-no"
        v-model="roomNumber"
        label="Room number"
        placeholder="e.g. demo01"
        autocomplete="off"
      />
      <p v-if="error" class="text-sm font-bold text-neo-danger">{{ error }}</p>
    </form>

    <NeoCard class="mt-6">
      <p class="text-xs font-bold uppercase">Tip</p>
      <p class="mt-1 text-sm">The host shares this code with the invite link. No login required.</p>
    </NeoCard>

    <FlowNavBar @back="goBack">
      <NeoButton type="submit" form="enter-room-form" variant="accent" block>Continue</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
