<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import { useRoomState } from '../composables/useRoomState'
import { useFormValidation, isFilled, isEmail } from '../composables/useFormValidation'
import { HOST_STEPS, staticBackRoute } from '../constants/flows'

const router = useRouter()
const { createRoom } = useRoomState()
const { shaking, hint, hasError, fieldHint, clearField, validate } = useFormValidation()

const roomName = ref('')
const hostName = ref('')
const hostEmail = ref('')
const dueDate = ref('')
const loading = ref(false)

const minDate = new Date().toISOString().slice(0, 10)

watch(roomName, () => clearField('room'))
watch(hostName, () => clearField('host'))
watch(hostEmail, () => clearField('email'))
watch(dueDate, () => clearField('due'))

function submit() {
  const emailFilled = isFilled(hostEmail.value)
  const emailValid = isEmail(hostEmail.value)

  if (
    !validate([
      { key: 'room', valid: isFilled(roomName.value) },
      { key: 'host', valid: isFilled(hostName.value) },
      { key: 'email', valid: emailFilled && emailValid, message: emailFilled ? 'Invalid email' : 'Required' },
      { key: 'due', valid: isFilled(dueDate.value) },
    ])
  ) {
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
      <ValidationAlert class="mb-2" :message="hint" :shake="shaking" />
      <NeoInput
        id="room"
        v-model="roomName"
        label="Bill name"
        placeholder="Friday Lunch"
        :error="hasError('room')"
        :error-message="fieldHint('room')"
        :shake="hasError('room') && shaking"
      />
      <NeoInput
        id="host"
        v-model="hostName"
        label="Your name (host)"
        placeholder="Jeff"
        :error="hasError('host')"
        :error-message="fieldHint('host')"
        :shake="hasError('host') && shaking"
      />
      <NeoInput
        id="email"
        v-model="hostEmail"
        type="email"
        label="Host email"
        placeholder="jeff@example.com"
        :error="hasError('email')"
        :error-message="fieldHint('email')"
        :shake="hasError('email') && shaking"
      />
      <NeoInput
        id="due"
        v-model="dueDate"
        type="date"
        :min="minDate"
        label="Payment due date"
        :error="hasError('due')"
        :error-message="fieldHint('due')"
        :shake="hasError('due') && shaking"
      />
    </form>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton type="submit" form="create-form" variant="primary" block :loading="loading">
        Continue
      </NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
