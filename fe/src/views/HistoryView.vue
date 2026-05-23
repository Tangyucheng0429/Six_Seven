<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import { useRoomState, formatMYR } from '../composables/useRoomState'
import { formatDueDate } from '../composables/useDueDate'

const router = useRouter()
const { getCompletedRooms, state } = useRoomState()

const completed = computed(() => getCompletedRooms())
const open = computed(() =>
  Object.values(state.rooms).filter((r) => r.status !== 'completed'),
)

function total(room) {
  return room.items.reduce((s, i) => s + i.price, 0)
}
</script>

<template>
  <AppShell title="Bill history" subtitle="Completed bills are saved here.">
    <section v-if="completed.length" class="mb-8">
      <p class="mb-3 text-xs font-bold uppercase tracking-widest text-neo-success">Completed</p>
      <ul class="space-y-4">
        <li v-for="room in completed" :key="room.id">
          <NeoCard>
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-lg font-bold">{{ room.name }}</p>
                <p class="text-sm text-neo-ink/70">
                  {{ room.hostName }} · Due {{ formatDueDate(room.dueDate) }}
                </p>
              </div>
              <NeoBadge variant="success">done</NeoBadge>
            </div>
            <p class="mt-2 font-mono font-bold">{{ formatMYR(total(room)) }}</p>
          </NeoCard>
        </li>
      </ul>
    </section>

    <section v-if="open.length">
      <p class="mb-3 text-xs font-bold uppercase tracking-widest">Open / in progress</p>
      <ul class="space-y-4">
        <li v-for="room in open" :key="room.id">
          <NeoCard>
            <p class="font-bold text-lg">{{ room.name }}</p>
            <p class="text-sm text-neo-ink/70">{{ room.status }} · {{ room.id }}</p>
            <p class="mt-2 font-mono font-bold">{{ formatMYR(total(room)) }}</p>
            <NeoButton class="mt-3" variant="secondary" block @click="router.push(`/room/${room.id}`)">
              Open
            </NeoButton>
          </NeoCard>
        </li>
      </ul>
    </section>

    <p v-if="!completed.length && !open.length" class="text-sm font-bold">No bills yet.</p>

    <NeoButton class="mt-8" variant="ghost" block @click="router.push('/')">Back home</NeoButton>
  </AppShell>
</template>
