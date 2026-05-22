<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import { useRoomState } from '../composables/useRoomState'

const router = useRouter()
const { createRoom } = useRoomState()

const roomName = ref('')
const hostName = ref('')
const loading = ref(false)

function submit() {
  if (!roomName.value.trim() || !hostName.value.trim()) return
  loading.value = true
  const room = createRoom({
    name: roomName.value.trim(),
    hostName: hostName.value.trim(),
  })
  router.push(`/room/${room.id}/upload`)
}
</script>

<template>
  <AppShell
    title="Split the bill."
    subtitle="Upload a receipt, invite friends, pay your share — no login needed."
  >
    <NeoCard class="mb-6 border-neo-accent bg-neo-surface">
      <p class="text-sm font-medium">
        Built for Malaysian receipts & payments — DuitNow, TnG, bank transfer.
      </p>
    </NeoCard>

    <form class="space-y-4" @submit.prevent="submit">
      <NeoInput id="room" v-model="roomName" label="Bill name" placeholder="Friday Lunch" />
      <NeoInput id="host" v-model="hostName" label="Your name (host)" placeholder="Jeff" />
      <NeoButton type="submit" variant="primary" block :loading="loading">
        Create bill room
      </NeoButton>
    </form>

    <div class="mt-8 flex flex-col gap-3">
      <NeoButton variant="ghost" block @click="router.push('/join/join-demo01?room=demo01')">
        Try demo room
      </NeoButton>
      <NeoButton variant="secondary" block @click="router.push('/history')">
        Payment history
      </NeoButton>
    </div>
  </AppShell>
</template>
