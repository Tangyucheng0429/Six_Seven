<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import { hasHostCookie } from '../composables/useHostCookie'
import heroImg from '../assets/hero.png'

const router = useRouter()
const showHostHistory = computed(() => hasHostCookie())

const steps = [
  { role: 'Host', text: 'Email, due date, OCR, invite link & room number' },
  { role: 'Member', text: 'Join by link or room number, pick items or equal split' },
  { role: 'Auto', text: 'Email host when unpaid after due date' },
]
</script>

<template>
  <AppShell
    title="SixSeven"
    subtitle="Split bills with AI receipt scan — no login for host or members."
  >
    <div class="mb-6 overflow-hidden border-3 border-neo-ink bg-neo-surface neo-shadow">
      <img
        :src="heroImg"
        alt=""
        class="h-36 w-full object-cover object-center"
        width="400"
        height="144"
      />
    </div>

    <NeoCard class="mb-6">
      <p class="neo-section-label mb-3">How it works</p>
      <ul class="space-y-4">
        <li v-for="(step, i) in steps" :key="step.role" class="flex gap-3">
          <span
            class="flex size-9 shrink-0 items-center justify-center border-3 border-neo-ink bg-neo-primary text-sm font-bold neo-shadow"
          >
            {{ i + 1 }}
          </span>
          <p class="pt-1 text-sm font-medium leading-snug">
            <span class="font-bold">{{ step.role }}</span>
            — {{ step.text }}
          </p>
        </li>
      </ul>
    </NeoCard>

    <div class="space-y-3">
      <NeoButton variant="primary" block @click="router.push('/create')">Create bill room</NeoButton>

      <NeoButton variant="accent" block @click="router.push('/enter-room')">
        Enter room number
      </NeoButton>

      <NeoButton
        v-if="showHostHistory"
        variant="secondary"
        block
        @click="router.push('/history')"
      >
        Host history
      </NeoButton>
    </div>
  </AppShell>
</template>
