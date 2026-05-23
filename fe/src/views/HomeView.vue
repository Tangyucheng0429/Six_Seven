<script setup>
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'

const router = useRouter()
</script>

<template>
  <AppShell
    title="SixSeven"
    subtitle="AI receipt scan · smart split · payment tracking — no member login."
  >
    <NeoCard class="mb-6">
      <ol class="space-y-2 text-sm font-medium">
        <li><span class="font-bold">Host</span> — create room, set due date, OCR receipt, invite link</li>
        <li><span class="font-bold">Member</span> — join by link, pick items or equal split, pay & upload proof</li>
        <li><span class="font-bold">Auto</span> — overdue email to host (when unpaid after due date)</li>
      </ol>
    </NeoCard>

    <NeoButton variant="primary" block @click="router.push('/create')">Create bill room</NeoButton>

    <div class="mt-4 flex flex-col gap-3">
      <NeoButton variant="ghost" block @click="router.push('/join/join-demo01?room=demo01')">
        Join demo as member
      </NeoButton>
      <NeoButton
        variant="secondary"
        block
        @click="router.push('/room/demo01')"
      >
        Open demo host dashboard
      </NeoButton>
      <NeoButton variant="ghost" block @click="router.push('/history')">Payment history</NeoButton>
    </div>
  </AppShell>
</template>
