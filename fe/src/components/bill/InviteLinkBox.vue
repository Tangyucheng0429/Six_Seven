<script setup>
import { ref } from 'vue'
import NeoButton from '../ui/NeoButton.vue'
import { inviteLink } from '../../composables/useShareInvite'
import { copyToClipboard } from '../../utils/copyToClipboard.js'

const props = defineProps({
  roomCode: { type: String, required: true },
})

const copiedLink = ref(false)
const copiedRoom = ref(false)
const link = inviteLink(props.roomCode)

async function copyLink() {
  if (await copyToClipboard(link)) {
    copiedLink.value = true
    setTimeout(() => {
      copiedLink.value = false
    }, 2000)
  }
}

async function copyRoom() {
  if (await copyToClipboard(props.roomCode)) {
    copiedRoom.value = true
    setTimeout(() => {
      copiedRoom.value = false
    }, 2000)
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="border-3 border-neo-ink bg-neo-surface p-4 neo-shadow">
      <p class="text-xs font-bold uppercase tracking-widest">Room number</p>
      <p class="mt-2 font-mono text-3xl font-bold tracking-widest">{{ roomCode }}</p>
      <NeoButton class="mt-3" variant="secondary" block @click="copyRoom">
        {{ copiedRoom ? 'Copied!' : 'Copy room number' }}
      </NeoButton>
      <p class="mt-2 text-xs text-neo-ink/70">6 letters &amp; numbers — enter on the home page or use the link.</p>
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
