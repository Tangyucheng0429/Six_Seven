<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import { useRoomState, formatMYR } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'
import { openPathForEntry } from '../composables/useMyBills'
import { hasHostCookie } from '../composables/useHostCookie'
import { staticBackRoute } from '../constants/flows'

const router = useRouter()
const { getHostBills } = useRoomState()

const bills = computed(() => getHostBills())
const completed = computed(() => bills.value.filter((b) => b.room.status === 'completed'))
const inProgress = computed(() => bills.value.filter((b) => b.room.status !== 'completed'))

function total(room) {
  return room.items.reduce((s, i) => s + i.price, 0)
}

function openBill(entry) {
  router.push(openPathForEntry(entry))
}

function resumeLabel(entry) {
  const s = entry.room.status
  if (s === 'open' || s === 'overdue') return 'Open dashboard'
  if (s === 'completed') return 'View'
  return 'Continue setup'
}

function goBack() {
  router.push(staticBackRoute('history'))
}
</script>

<template>
  <AppShell
    v-if="hasHostCookie()"
    title="Host history"
    subtitle="Bills you created on this device (host cookie, no login)."
  >
    <section v-if="completed.length" class="mb-8">
      <p class="mb-3 text-xs font-bold uppercase tracking-widest text-neo-success">Completed</p>
      <ul class="space-y-4">
        <li v-for="entry in completed" :key="entry.roomId">
          <NeoCard>
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-lg font-bold">{{ entry.room.name }}</p>
                <p class="text-sm text-neo-ink/70">
                  Room {{ entry.roomId }} · Due {{ formatDueDate(entry.room.dueDate) }}
                </p>
              </div>
              <NeoBadge variant="success">completed</NeoBadge>
            </div>
            <p class="mt-2 font-mono font-bold">{{ formatMYR(total(entry.room)) }}</p>
          </NeoCard>
        </li>
      </ul>
    </section>

    <section v-if="inProgress.length">
      <p class="mb-3 text-xs font-bold uppercase tracking-widest">In progress</p>
      <ul class="space-y-4">
        <li v-for="entry in inProgress" :key="entry.roomId">
          <NeoCard>
            <p class="font-bold text-lg">{{ entry.room.name }}</p>
            <p class="text-sm text-neo-ink/70">
              {{ entry.room.status }} · Room {{ entry.roomId }}
            </p>
            <p class="mt-2 font-mono font-bold">
              {{ entry.room.items.length ? formatMYR(total(entry.room)) : '—' }}
            </p>
            <NeoButton class="mt-3" variant="secondary" block @click="openBill(entry)">
              {{ resumeLabel(entry) }}
            </NeoButton>
          </NeoCard>
        </li>
      </ul>
    </section>

    <p v-if="!bills.length" class="text-sm font-bold">No host bills yet. Create one from home.</p>

    <FlowNavBar @back="goBack" />
  </AppShell>

  <AppShell v-else title="Host history" subtitle="Create a bill room first to enable history.">
    <p class="text-sm font-bold">Host history appears after you create a bill on this browser.</p>
    <NeoButton class="mt-6" variant="primary" block @click="router.push('/create')">
      Create bill room
    </NeoButton>
    <FlowNavBar @back="goBack" />
  </AppShell>
</template>
