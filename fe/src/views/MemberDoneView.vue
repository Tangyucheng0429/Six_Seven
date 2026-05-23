<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import { useRoomState, formatMYR } from '../composables/useRoomState'
import { useMemberRoom } from '../composables/useMemberRoom'
import { useRestoreMemberSession } from '../composables/useMemberSession'
import { MEMBER_STEPS } from '../constants/flows'
import { isHostOfRoom } from '../composables/useHostCookie'
import { hostRoomPath } from '../composables/roomPaths'
import { clearMemberSessionIfHost } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const { room } = useMemberRoom(roomId, { pollMs: 5000 })
const { state, getMyAccessList } = useRoomState()

useRestoreMemberSession(roomId, { state, getMyAccessList })

const member = computed(() => {
  const id = state.currentMemberId
  if (!id || !room.value) return null
  const m = room.value.members?.find((p) => p.id === id)
  return m?.isHost ? null : m
})

watch(
  room,
  (r) => {
    if (!r) return
    if (isHostOfRoom(r, state.currentMemberId)) {
      clearMemberSessionIfHost(r)
      router.replace(hostRoomPath(r, 'dashboard'))
    }
  },
  { immediate: true },
)

function goJoin() {
  if (!room.value) return
  router.push(`/join/${room.value.roomCode || room.value.inviteToken}`)
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <AppShell
    v-if="room && member"
    title="Payment submitted"
    :subtitle="member.confirmed ? 'Host confirmed your payment.' : 'Waiting for host to confirm.'"
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="MEMBER_STEPS" :current="3" />

    <NeoCard class="text-center animate-neo-pop">
      <p class="text-4xl">{{ member.confirmed ? '✓' : '⏳' }}</p>
      <p class="mt-2 font-bold">Thanks, {{ member.name }}!</p>
      <p v-if="member.amountDue > 0" class="mt-2 font-mono text-xl font-bold">
        {{ formatMYR(member.amountDue) }}
      </p>
      <NeoBadge class="mt-3" :variant="member.confirmed ? 'success' : 'warning'">
        {{ member.confirmed ? 'Confirmed by host' : 'Pending host verification' }}
      </NeoBadge>
      <p v-if="!member.confirmed" class="mt-3 text-sm">
        Host will verify your proof on the dashboard. This page updates automatically.
      </p>
    </NeoCard>

    <FlowNavBar hide-back>
      <NeoButton variant="primary" block @click="goHome">Done</NeoButton>
    </FlowNavBar>
  </AppShell>

  <AppShell
    v-else-if="room"
    title="Payment submitted"
    subtitle="Re-join if you need to view this bill."
    :room-code="room.roomCode || room.id"
  >
    <NeoButton variant="accent" block @click="goJoin">Join again</NeoButton>
    <FlowNavBar hide-back>
      <NeoButton variant="primary" block @click="goHome">Done</NeoButton>
    </FlowNavBar>
  </AppShell>

  <AppShell v-else title="Payment submitted" subtitle="Room not found.">
    <NeoButton variant="secondary" block @click="goHome">Home</NeoButton>
  </AppShell>
</template>
