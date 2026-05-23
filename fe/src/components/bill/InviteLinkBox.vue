<script setup>
import { ref } from 'vue'
import NeoButton from '../ui/NeoButton.vue'

const props = defineProps({
  roomId: { type: String, required: true },
  inviteToken: { type: String, required: true },
})

const copiedLink = ref(false)
const copiedRoom = ref(false)
const link = `${window.location.origin}/join/${props.inviteToken}?room=${props.roomId}`

async function copyLink() {
  await navigator.clipboard.writeText(link)
  copiedLink.value = true
  setTimeout(() => {
    copiedLink.value = false
  }, 2000)
}

async function copyRoom() {
  await navigator.clipboard.writeText(props.roomId)
  copiedRoom.value = true
  setTimeout(() => {
    copiedRoom.value = false
  }, 2000)
}
</script>

<template>
  <div class="space-y-3">
    <div class="border-3 border-neo-ink bg-neo-surface p-4 neo-shadow">
      <p class="text-xs font-bold uppercase tracking-widest">Room number</p>
      <p class="mt-2 font-mono text-2xl font-bold">{{ roomId }}</p>
      <NeoButton class="mt-3" variant="secondary" block @click="copyRoom">
        {{ copiedRoom ? 'Copied!' : 'Copy room number' }}
      </NeoButton>
      <p class="mt-2 text-xs text-neo-ink/70">Members can enter this on the home page.</p>
    </div>

    <div class="border-3 border-neo-ink bg-neo-accent p-4 neo-shadow">
      <p class="text-xs font-bold uppercase tracking-widest">Invitation link</p>
      <p class="mt-2 break-all font-mono text-xs">{{ link }}</p>
      <NeoButton class="mt-3" variant="secondary" block @click="copyLink">
        {{ copiedLink ? 'Copied!' : 'Copy invite link' }}
      </NeoButton>
    </div>
  </div>
</template>
