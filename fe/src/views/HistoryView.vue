<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import { useRoomState, formatMYR } from '../composables/useRoomState'

const router = useRouter()
const { state } = useRoomState()

const rooms = computed(() => Object.values(state.rooms))

function total(room) {
  return room.items.reduce((s, i) => s + i.price, 0)
}
</script>

<template>
  <AppShell title="History" subtitle="Completed and open bills (local mock).">
    <ul v-if="rooms.length" class="space-y-4">
      <li v-for="room in rooms" :key="room.id">
        <NeoCard>
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-bold text-lg">{{ room.name }}</p>
              <p class="text-sm text-neo-ink/70">{{ room.hostName }} · {{ room.id }}</p>
            </div>
            <NeoBadge :variant="room.status === 'completed' ? 'success' : 'default'">
              {{ room.status }}
            </NeoBadge>
          </div>
          <p class="mt-2 font-mono font-bold">{{ formatMYR(total(room)) }}</p>
          <NeoButton class="mt-3" variant="secondary" block @click="router.push(`/room/${room.id}`)">
            Open
          </NeoButton>
        </NeoCard>
      </li>
    </ul>
    <p v-else class="text-sm font-bold">No bills yet.</p>

    <NeoButton class="mt-8" variant="ghost" block @click="router.push('/')">Back home</NeoButton>
  </AppShell>
</template>
