<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import { getRoomById, useRoomState } from '../composables/useRoomState'
import { apiErrorMessage } from '../api/client.js'
import { memberRoomPath, hostRoomPath } from '../composables/roomPaths'
import { formatDueDate } from '../composables/useDueDate'
import { useFormValidation, isFilled } from '../composables/useFormValidation'
import { MEMBER_STEPS, staticBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomCode = computed(() => String(route.params.token || '').toUpperCase())
const { joinRoom, lookupRoomByCode } = useRoomState()
const { shaking, hint, hasError, fieldHint, clearField, validate } = useFormValidation()

const name = ref('')
const loading = ref(false)
const joinError = ref('')

const room = computed(() => getRoomById(roomCode.value))

watch(name, () => clearField('name'))

onMounted(async () => {
  if (!roomCode.value) {
    joinError.value = 'Invalid invite link.'
    return
  }
  if (room.value) return
  try {
    await lookupRoomByCode(roomCode.value)
  } catch {
    joinError.value = 'Room not found. Check the 6-character code with your host.'
  }
})

async function submit() {
  if (!room.value) return
  if (room.value.status !== 'open' && room.value.status !== 'overdue') {
    joinError.value = 'This bill is not open for members yet. Ask the host to finish setup.'
    return
  }
  if (!validate([{ key: 'name', valid: isFilled(name.value) }])) return

  loading.value = true
  joinError.value = ''
  try {
    const { isHost, room: joined } = await joinRoom(
      room.value.roomCode || roomCode.value,
      name.value.trim(),
    )
    const target = joined || getRoomById(room.value.id) || room.value
    if (isHost) {
      router.push(hostRoomPath(target, 'dashboard'))
      return
    }
    router.push(
      target.splitMode === 'equal'
        ? memberRoomPath(target, 'pay')
        : memberRoomPath(target, 'assign'),
    )
  } catch (err) {
    joinError.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push(staticBackRoute('join'))
}
</script>

<template>
  <AppShell title="Join bill" subtitle="No login — enter your name only." :room-code="roomCode">
    <FlowProgress :steps="MEMBER_STEPS" :current="0" />

    <NeoCard v-if="room" class="mb-6">
      <p class="text-xs font-bold uppercase">Room</p>
      <p class="font-mono text-lg font-bold tracking-wider">{{ room.roomCode }}</p>
      <p class="mt-2 text-2xl font-bold">{{ room.name }}</p>
      <p class="mt-1 text-sm">Host: {{ room.hostName }}</p>
      <p class="mt-2 text-sm">Due: {{ formatDueDate(room.dueDate) }}</p>
      <NeoBadge class="mt-2" variant="default">
        {{ room.splitMode === 'equal' ? 'Equal split — no item picking' : 'Pick your items next' }}
      </NeoBadge>
    </NeoCard>
    <p v-else class="font-bold text-neo-danger">{{ joinError || 'Loading room…' }}</p>

    <form v-if="room" id="join-form" class="space-y-4" @submit.prevent="submit">
      <ValidationAlert :message="hint || joinError" :shake="shaking" />
      <NeoInput
        id="name"
        v-model="name"
        label="Your name"
        placeholder="Ali"
        :error="hasError('name')"
        :error-message="fieldHint('name')"
        :shake="hasError('name') && shaking"
      />
    </form>

    <FlowNavBar v-if="room" :shake-continue="shaking" @back="goBack">
      <NeoButton type="submit" form="join-form" variant="accent" block :loading="loading">
        Continue
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
