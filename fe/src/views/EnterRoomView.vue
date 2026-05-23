<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import { useRoomState } from '../composables/useRoomState'
import { useFormValidation, isFilled } from '../composables/useFormValidation'
import { staticBackRoute } from '../constants/flows'

const router = useRouter()
const { lookupRoomByCode } = useRoomState()
const { shaking, hint, hasError, fieldHint, clearField, validate, triggerShake } = useFormValidation()

const roomNumber = ref('')
const serverError = ref('')
const loading = ref(false)

watch(roomNumber, () => {
  clearField('room-no')
  serverError.value = ''
})

async function submit() {
  const code = roomNumber.value.trim().toUpperCase()
  serverError.value = ''

  if (!validate([{ key: 'room-no', valid: isFilled(code) }])) return

  loading.value = true
  try {
    const room = await lookupRoomByCode(code)
    if (room.status !== 'open' && room.status !== 'overdue') {
      serverError.value = 'This bill is not open for members yet. Ask the host to finish setup.'
      triggerShake(serverError.value)
      return
    }
    router.push(`/join/${room.roomCode || room.inviteToken}`)
  } catch (err) {
    serverError.value = err?.message || 'Room not found. Check the number with your host.'
    triggerShake(serverError.value)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push(staticBackRoute('enter-room'))
}
</script>

<template>
  <AppShell title="Enter room number" subtitle="Join a bill without the invite link.">
    <form id="enter-room-form" class="space-y-4" @submit.prevent="submit">
      <ValidationAlert :message="hint || serverError" :shake="shaking" />
      <NeoInput
        id="room-no"
        v-model="roomNumber"
        label="Room number"
        placeholder="e.g. JKRRK6"
        maxlength="6"
        autocomplete="off"
        :error="hasError('room-no') || !!serverError"
        :error-message="serverError || fieldHint('room-no')"
        :shake="(hasError('room-no') || !!serverError) && shaking"
      />
    </form>

    <NeoCard class="mt-6">
      <p class="text-xs font-bold uppercase">Tip</p>
      <p class="mt-1 text-sm">The host shares this code with the invite link. No login required.</p>
    </NeoCard>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton type="submit" form="enter-room-form" variant="accent" block :loading="loading">
        Continue
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
