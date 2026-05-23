<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import FlowProgress from '../components/layout/FlowProgress.vue'
import FlowNavBar from '../components/layout/FlowNavBar.vue'
import NeoCard from '../components/ui/NeoCard.vue'
import NeoButton from '../components/ui/NeoButton.vue'
import NeoBadge from '../components/ui/NeoBadge.vue'
import ValidationAlert from '../components/ui/ValidationAlert.vue'
import ReceiptItemRow from '../components/bill/ReceiptItemRow.vue'
import TaxSettingsCard from '../components/bill/TaxSettingsCard.vue'
import AddLineItemForm from '../components/bill/AddLineItemForm.vue'
import {
  useRoom,
  useRoomState,
  formatMYR,
  billSubtotal,
  billHostTotal,
  billMemberPool,
  billMenuBase,
  billScannedLineTax,
  billFeeLinesTotal,
} from '../composables/useRoomState'
import { isFeeLikeKind } from '../constants/items'
import { useFormValidation } from '../composables/useFormValidation'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { updateItem, removeItem, setHostQuantity, addItem, confirmReceipt } = useRoomState()
const { shaking, hint, validate } = useFormValidation()

const host = computed(() => room.value?.members.find((m) => m.isHost))

const menuItems = computed(() =>
  (room.value?.items ?? []).filter((i) => !isFeeLikeKind(i.kind)),
)

const menuBase = computed(() => (room.value ? billMenuBase(room.value) : 0))
const scannedTax = computed(() => (room.value ? billScannedLineTax(room.value) : 0))
const feesTotal = computed(() => (room.value ? billFeeLinesTotal(room.value) : 0))
const subtotal = computed(() => (room.value ? billSubtotal(room.value) : 0))
const hostTotal = computed(() => (room.value ? billHostTotal(room.value) : 0))
const memberPool = computed(() => (room.value ? billMemberPool(room.value) : 0))

function onAddItem(payload) {
  if (!room.value) return
  addItem(roomId.value, payload)
}

function confirm() {
  if (!validate([{ key: 'items', valid: (room.value?.items.length ?? 0) > 0 }], 'Keep at least one line item')) {
    return
  }
  confirmReceipt(roomId.value)
  router.push(`/room/${roomId.value}/payment-setup`)
}

function goBack() {
  router.push(hostBackRoute(roomId.value, 'review'))
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Verify receipt"
    subtitle="Edit tax % and menu lines from your scan."
    :room-code="room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="4" />

    <div class="mb-4 flex flex-wrap gap-2">
      <NeoBadge variant="ink">{{ room.splitMode === 'equal' ? 'Equal split' : 'Item-based' }}</NeoBadge>
      <NeoBadge>{{ room.items.length }} lines</NeoBadge>
      <NeoBadge v-if="room.taxFromScan" variant="success">Tax from scan</NeoBadge>
      <NeoBadge v-if="hostTotal > 0" variant="warning">Host {{ formatMYR(hostTotal) }}</NeoBadge>
    </div>

    <ValidationAlert class="mb-4" :message="hint" :shake="shaking" />

    <TaxSettingsCard class="mb-4" :room="room" :room-id="room.id" />

    <NeoCard class="mb-4">
      <p class="neo-section-label mb-1">Menu</p>
      <p class="mb-3 text-xs text-neo-ink/70">
        Food and drinks include SST. Adjust <span class="font-bold">You ate</span> per line.
      </p>
      <ReceiptItemRow
        v-for="item in menuItems"
        :key="item.id"
        :item="item"
        editable
        review
        @update="(patch) => updateItem(room.id, item.id, patch)"
        @remove="removeItem(room.id, item.id)"
        @set-host-qty="(qty) => setHostQuantity(room.id, item.id, qty)"
      />
      <p v-if="!menuItems.length" class="py-4 text-center text-sm font-bold text-neo-ink/60">
        No menu items — add one below or re-scan.
      </p>
      <AddLineItemForm
        embedded
        menu-only
        collapsible
        class="mt-4 border-t-2 border-neo-ink/20 pt-4"
        @add="onAddItem"
      />
    </NeoCard>

    <NeoCard>
      <p class="neo-section-label mb-3">Subtotal (from receipt)</p>
      <div class="flex justify-between text-sm">
        <span>Menu</span>
        <span class="font-mono">{{ formatMYR(menuBase) }}</span>
      </div>
      <div v-if="scannedTax > 0" class="mt-2 flex justify-between text-sm">
        <span>SST on items</span>
        <span class="font-mono">+ {{ formatMYR(scannedTax) }}</span>
      </div>
      <div v-if="feesTotal > 0" class="mt-2 flex justify-between text-sm">
        <span>Service charge</span>
        <span class="font-mono">+ {{ formatMYR(feesTotal) }}</span>
      </div>
      <div class="mt-2 flex justify-between border-t-2 border-neo-ink/20 pt-2 font-bold">
        <span>Subtotal</span>
        <span class="font-mono">{{ formatMYR(subtotal) }}</span>
      </div>

      <div class="mt-4 border-t-2 border-neo-ink/20 pt-3">
        <div v-if="hostTotal > 0" class="flex justify-between text-sm">
          <span>{{ host?.name ?? 'Host' }} (your share)</span>
          <span class="font-mono font-bold">− {{ formatMYR(hostTotal) }}</span>
        </div>
        <div class="mt-2 flex justify-between font-bold">
          <span>Members pay</span>
          <span class="font-mono">{{ formatMYR(memberPool) }}</span>
        </div>
      </div>
    </NeoCard>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton variant="primary" block @click="confirm">Continue</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
