<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import { useRoomState } from '../composables/useRoomState'
import { HOST_STEPS, staticBackRoute } from '../constants/flows'

const router = useRouter()
const { createRoom } = useRoomState()

const roomName = ref('')
const hostName = ref('')
const hostEmail = ref('')
const dueDate = ref('')
const loading = ref(false)

const minDate = new Date().toISOString().slice(0, 10)

function submit() {
  if (!roomName.value.trim() || !hostName.value.trim() || !hostEmail.value.trim() || !dueDate.value) {
    return
  }
  loading.value = true
  const room = createRoom({
    name: roomName.value.trim(),
    hostName: hostName.value.trim(),
    hostEmail: hostEmail.value.trim(),
    dueDate: dueDate.value,
  })
  router.push(`/room/${room.id}/upload`)
}

function goBack() {
  router.push(staticBackRoute('create'))
}
</script>

<template>
  <AppShell
    title="Create bill room"
    subtitle="Step 1 — email & due date (no login). Overdue alerts go to your email."
  >
    <FlowProgress :steps="HOST_STEPS" :current="0" />

    <form id="create-form" class="space-y-4" @submit.prevent="submit">
      <NeoInput id="room" v-model="roomName" label="Bill name" placeholder="Friday Lunch" />
      <NeoInput id="host" v-model="hostName" label="Your name (host)" placeholder="Jeff" />
      <NeoInput
        id="email"
        v-model="hostEmail"
        type="email"
        label="Host email"
        placeholder="jeff@example.com"
      />
      <NeoInput id="due" v-model="dueDate" type="date" :min="minDate" label="Payment due date" />
    </form>

    <FlowNavBar @back="goBack">
      <NeoButton type="submit" form="create-form" variant="primary" block :loading="loading">
        Continue to upload receipt
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
