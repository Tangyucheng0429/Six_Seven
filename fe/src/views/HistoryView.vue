<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import { useRoomState, formatMYR, itemLineTotal } from '../composables/useRoomState'
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
  return room.items.reduce((s, i) => s + itemLineTotal(i), 0)
}

function openBill(entry) {
  const path = openPathForEntry(entry)
  if (router.currentRoute.value.path !== path) {
    router.push(path)
  } else {
    router.replace(path)
  }
}

function resumeLabel(entry) {
  const s = entry.room.status
  if (s === 'open' || s === 'overdue') return 'Open dashboard'
  if (s === 'completed') return 'View'
  return 'Continue setup'
}

function statusVariant(status) {
  if (status === 'completed') return 'success'
  if (status === 'overdue') return 'danger'
  if (status === 'open') return 'warning'
  return 'default'
}

function statusLabel(status) {
  return status.replace(/_/g, ' ')
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
      <p class="neo-section-label mb-3 text-neo-success">Completed</p>
      <ul class="space-y-4">
        <li v-for="entry in completed" :key="entry.roomId">
          <button
            type="button"
            class="neo-card-interactive w-full text-left"
            @click="openBill(entry)"
          >
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
              <p class="mt-3 font-mono text-xl font-bold">{{ formatMYR(total(entry.room)) }}</p>
            </NeoCard>
          </button>
        </li>
      </ul>
    </section>

    <section v-if="inProgress.length">
      <p class="neo-section-label mb-3">In progress</p>
      <ul class="space-y-4">
        <li v-for="entry in inProgress" :key="entry.roomId">
          <NeoCard>
            <div class="flex items-start justify-between gap-2">
              <p class="text-lg font-bold">{{ entry.room.name }}</p>
              <NeoBadge :variant="statusVariant(entry.room.status)">
                {{ statusLabel(entry.room.status) }}
              </NeoBadge>
            </div>
            <p class="mt-1 text-sm text-neo-ink/70">Room {{ entry.roomId }}</p>
            <p class="mt-3 font-mono text-xl font-bold">
              {{ entry.room.items.length ? formatMYR(total(entry.room)) : '—' }}
            </p>
            <NeoButton class="mt-4" variant="secondary" block @click="openBill(entry)">
              {{ resumeLabel(entry) }}
            </NeoButton>
          </NeoCard>
        </li>
      </ul>
    </section>

    <NeoCard v-if="!bills.length" accent class="text-center">
      <p class="text-sm font-bold">No host bills yet</p>
      <p class="mt-1 text-sm text-neo-ink/70">Create a room from the home page to see it here.</p>
    </NeoCard>

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
