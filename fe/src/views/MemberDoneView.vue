<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import { useRoom, useRoomState } from '../composables/useRoomState'
import { MEMBER_STEPS, staticBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { state } = useRoomState()

const member = computed(() => room.value?.members.find((m) => m.id === state.currentMemberId))

function goBack() {
  router.push(staticBackRoute('member-done'))
}
</script>

<template>
  <AppShell v-if="room && member" title="Payment submitted" subtitle="Waiting for host to confirm.">
    <FlowProgress :steps="MEMBER_STEPS" :current="3" />

    <NeoCard class="text-center animate-neo-pop">
      <p class="text-4xl">✓</p>
      <p class="mt-2 font-bold">Thanks, {{ member.name }}!</p>
      <p class="mt-2 text-sm">Host will verify your proof on the dashboard.</p>
    </NeoCard>

    <FlowNavBar @back="goBack" />
  </AppShell>
</template>
