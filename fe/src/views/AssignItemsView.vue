<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import ReceiptPreviewCard from '../components/bill/ReceiptPreviewCard.vue'
import QtyStepper from '../components/ui/QtyStepper.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import {
  useRoomState,
  formatMYR,
  itemMemberQuantity,
  getMemberClaim,
  remainingMemberQty,
  memberShareForItem,
  othersClaimedQty,
  otherClaimants,
} from '../composables/useRoomState'
import { useMemberRoom } from '../composables/useMemberRoom'
import { useRestoreMemberSession } from '../composables/useMemberSession'
import { isAssignableKind } from '../constants/items'
import { useFormValidation } from '../composables/useFormValidation'
import { MEMBER_STEPS, staticBackRoute } from '../constants/flows'
import { apiErrorMessage } from '../api/client.js'
import { memberRoomPath, hostRoomPath } from '../composables/roomPaths'
import { isHostOfRoom } from '../composables/useHostCookie'
import { clearMemberSessionIfHost } from '../composables/useRoomState'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const { room } = useMemberRoom(roomId)
const { setMemberItemClaim, saveMemberAssignments, state, getMyAccessList } = useRoomState()
const saving = ref(false)
const { shaking, hint, hasError, clearField, validate, triggerShake } = useFormValidation()

useRestoreMemberSession(roomId, { state, getMyAccessList })

const activeMemberId = computed(() => {
  const id = state.currentMemberId
  if (!id || !room.value) return null
  if (isHostOfRoom(room.value, id)) return null
  return id
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

watch(
  () => [room.value?.splitMode, roomId.value],
  () => {
    if (room.value?.splitMode === 'equal' && room.value) {
      router.replace(memberRoomPath(room.value, 'pay'))
    }
  },
  { immediate: true },
)

const memberItems = computed(
  () =>
    room.value?.items?.filter(
      (item) => isAssignableKind(item.kind) && itemMemberQuantity(item) > 0,
    ) ?? [],
)

const hasSelection = computed(() =>
  memberItems.value.some((item) => claimFor(item) > 0),
)

const receiptUrl = computed(() => room.value?.receiptImageUrl || null)

function claimFor(item) {
  return getMemberClaim(item, activeMemberId.value)
}

function shareFor(item) {
  return memberShareForItem(item, activeMemberId.value)
}

function maxClaimFor(item) {
  const id = activeMemberId.value
  if (!id) return 0
  return getMemberClaim(item, id) + remainingMemberQty(item)
}

function itemState(item) {
  const mine = claimFor(item)
  const remaining = remainingMemberQty(item)
  const others = othersClaimedQty(item, activeMemberId.value)
  if (mine > 0) return 'mine'
  if (remaining <= 0 && others > 0) return 'taken'
  if (others > 0) return 'partial'
  return 'available'
}

function claimantsFor(item) {
  if (!room.value) return []
  return otherClaimants(item, room.value, activeMemberId.value)
}

function setClaim(itemId, qty) {
  if (!activeMemberId.value) return
  setMemberItemClaim(roomId.value, itemId, activeMemberId.value, qty)
  clearField('items')
}

function clearClaim(item) {
  setClaim(item.id, 0)
}

function goJoin() {
  if (!room.value) return
  router.push(`/join/${room.value.roomCode || room.value.inviteToken}`)
}

async function next() {
  if (!activeMemberId.value) {
    goJoin()
    return
  }
  if (!memberItems.value.length) {
    triggerShake('No items left — host marked everything as theirs.')
    return
  }
  if (!validate([{ key: 'items', valid: hasSelection.value }], 'Pick at least one item')) {
    return
  }
  saving.value = true
  try {
    await saveMemberAssignments(roomId.value, activeMemberId.value)
    router.push(memberRoomPath(room.value, 'pay'))
  } catch (err) {
    triggerShake(apiErrorMessage(err))
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push(staticBackRoute('assign'))
}
</script>

<template>
  <AppShell
    v-if="room && activeMemberId"
    title="Pick your items"
    subtitle="Set how many you had — tax & service charge follow your share."
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="MEMBER_STEPS" :current="1" />

    <ValidationAlert :message="hint" :shake="shaking" />

    <ReceiptPreviewCard
      v-if="receiptUrl"
      :image-url="receiptUrl"
      hint="Check the bill photo while you pick your items."
    />

    <p v-if="memberItems.length" class="mb-3 text-xs font-medium text-neo-ink/70">
      Host’s food is hidden. Tap <span class="font-bold">−</span> or <span class="font-bold">Clear</span> to undo.
      Grey rows are taken by other members.
    </p>
    <p
      v-else-if="room.items?.some((i) => isAssignableKind(i.kind))"
      class="mb-3 text-xs font-medium text-neo-ink/70"
    >
      Only portions not marked as host food appear here.
    </p>

    <ul class="space-y-3" :class="hasError('items') && shaking ? 'animate-neo-shake' : ''">
      <li
        v-for="item in memberItems"
        :key="item.id"
        class="assign-item"
        :class="{
          'assign-item--mine': itemState(item) === 'mine',
          'assign-item--partial': itemState(item) === 'partial',
          'assign-item--taken': itemState(item) === 'taken',
          'border-neo-danger': hasError('items'),
        }"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 flex-1">
            <p class="font-bold leading-snug" :class="itemState(item) === 'taken' ? 'text-neo-ink/60' : ''">
              {{ item.name }}
            </p>
            <p class="mt-1 text-xs font-medium text-neo-ink/70">
              <span v-if="itemMemberQuantity(item) !== item.quantity">
                {{ itemMemberQuantity(item) }} for members
              </span>
              <span v-else-if="item.quantity > 1">Bill qty {{ item.quantity }}</span>
              <span v-if="itemState(item) === 'taken'" class="ml-1 font-bold text-neo-ink/50">
                · All claimed
              </span>
              <span v-else-if="remainingMemberQty(item) > 0" class="ml-1">
                · {{ remainingMemberQty(item) }} left to claim
              </span>
            </p>

            <div v-if="claimantsFor(item).length || claimFor(item) > 0" class="assign-item-claimants">
              <span v-if="claimFor(item) > 0" class="assign-item-tag assign-item-tag--mine">
                You ×{{ claimFor(item) }}
              </span>
              <span
                v-for="c in claimantsFor(item)"
                :key="c.id"
                class="assign-item-tag assign-item-tag--other"
              >
                {{ c.name }}<span v-if="c.qty > 1"> ×{{ c.qty }}</span>
              </span>
            </div>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-2">
            <template v-if="itemState(item) !== 'taken'">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <QtyStepper
                  :model-value="claimFor(item)"
                  :min="0"
                  :max="maxClaimFor(item)"
                  :aria-label="`Your quantity for ${item.name}`"
                  @update:model-value="setClaim(item.id, $event)"
                />
                <NeoButton
                  v-if="claimFor(item) > 0"
                  type="button"
                  variant="secondary"
                  class="!min-h-0 !px-2 !py-1 text-xs"
                  @click="clearClaim(item)"
                >
                  Clear
                </NeoButton>
              </div>
              <p v-if="claimFor(item) > 0" class="font-mono text-sm font-bold text-neo-ink">
                {{ formatMYR(shareFor(item)) }}
              </p>
            </template>
            <p v-else class="max-w-[9rem] text-right text-xs font-bold text-neo-ink/50">
              Unavailable — picked by others
            </p>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="!memberItems.length" class="text-center text-sm font-bold text-neo-ink/60">
      All items are marked as host-only — nothing left to pick.
    </p>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton variant="primary" block :loading="saving" @click="next">Continue</NeoButton>
    </FlowNavBar>
  </AppShell>

  <AppShell
    v-else-if="room"
    title="Pick your items"
    subtitle="Join this room to select what you ate."
    :room-code="room.roomCode || room.id"
  >
    <p class="text-sm font-bold">Your session expired. Re-enter your name to continue.</p>
    <NeoButton class="mt-6" variant="accent" block @click="goJoin">Join again</NeoButton>
    <FlowNavBar @back="goBack" />
  </AppShell>

  <AppShell v-else title="Pick your items" subtitle="Room not found.">
    <p class="text-sm font-bold text-neo-danger">Room not found.</p>
    <NeoButton class="mt-6" variant="secondary" block @click="router.push('/')">Home</NeoButton>
  </AppShell>
</template>
