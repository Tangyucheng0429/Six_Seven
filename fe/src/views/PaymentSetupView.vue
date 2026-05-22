<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoInput from '../components/ui/NeoInput.vue'
import NeoTextarea from '../components/ui/NeoTextarea.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoFileUpload from '../components/ui/NeoFileUpload.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { setPaymentMethod, openRoom } = useRoomState()

const types = [
  { value: 'duitnow', label: 'DuitNow QR' },
  { value: 'tng', label: "Touch 'n Go" },
  { value: 'bank', label: 'Bank transfer' },
]

const selected = ref(room.value?.paymentMethod?.type || 'duitnow')
const notes = ref(room.value?.paymentMethod?.notes || '')
const qrPreview = ref(room.value?.paymentMethod?.imageUrl || null)

function onQr({ previewUrl }) {
  qrPreview.value = previewUrl
  setPaymentMethod(roomId.value, { imageUrl: previewUrl })
}

function publish() {
  const label = types.find((t) => t.value === selected.value)?.label || selected.value
  setPaymentMethod(roomId.value, { type: selected.value, label, notes: notes.value, imageUrl: qrPreview.value })
  openRoom(roomId.value)
  router.push(`/room/${roomId.value}`)
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Payment method"
    subtitle="Members will see this when they pay."
    :room-code="room.id"
  >
    <div class="mb-4 grid grid-cols-1 gap-2">
      <button
        v-for="t in types"
        :key="t.value"
        type="button"
        class="neo-pressable border-3 border-neo-ink px-4 py-3 text-left font-bold neo-shadow"
        :class="selected === t.value ? 'bg-neo-primary' : 'bg-neo-surface'"
        @click="selected = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <NeoFileUpload label="QR code (optional)" :preview-url="qrPreview" @file="onQr" @clear="qrPreview = null" />
    <NeoTextarea id="notes" v-model="notes" class="mt-4" label="Transfer notes" placeholder="Ref: FRIDAY — Jeff" />

    <NeoButton class="mt-6" variant="accent" block @click="publish">Open room & get invite link</NeoButton>
  </AppShell>
</template>
