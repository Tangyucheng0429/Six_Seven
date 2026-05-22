<script setup>
import { ref } from 'vue'
import NeoButton from '../ui/NeoButton.vue'

const props = defineProps({
  roomId: { type: String, required: true },
  inviteToken: { type: String, required: true },
})

const copied = ref(false)
const link = `${window.location.origin}/join/${props.inviteToken}?room=${props.roomId}`

async function copy() {
  await navigator.clipboard.writeText(link)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="border-3 border-neo-ink bg-neo-accent p-4 neo-shadow">
    <p class="text-xs font-bold uppercase tracking-widest">Invite link</p>
    <p class="mt-2 break-all font-mono text-xs">{{ link }}</p>
    <NeoButton class="mt-3" variant="secondary" block @click="copy">
      {{ copied ? 'Copied!' : 'Copy link' }}
    </NeoButton>
  </div>
</template>
