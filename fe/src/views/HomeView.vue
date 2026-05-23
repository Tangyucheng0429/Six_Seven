<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import { hasHostCookie } from '../composables/useHostCookie'

const router = useRouter()
const showHostHistory = computed(() => hasHostCookie())
</script>

<template>
  <AppShell
    title="SixSeven"
    subtitle="Split bills with AI receipt scan — no login for host or members."
  >
    <NeoCard class="mb-6">
      <ol class="space-y-2 text-sm font-medium">
        <li><span class="font-bold">Host</span> — email, due date, OCR, invite link & room number</li>
        <li><span class="font-bold">Member</span> — join by link or room number, pick items or equal split</li>
        <li><span class="font-bold">Auto</span> — email host when unpaid after due date</li>
      </ol>
    </NeoCard>

    <NeoButton variant="primary" block @click="router.push('/create')">Create bill room</NeoButton>

    <NeoButton class="mt-3" variant="accent" block @click="router.push('/enter-room')">
      Enter room number
    </NeoButton>

    <NeoButton
      v-if="showHostHistory"
      class="mt-3"
      variant="secondary"
      block
      @click="router.push('/history')"
    >
      Host history
    </NeoButton>
  </AppShell>
</template>
