<script setup>
import { computed, ref } from 'vue'
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
import EqualSplitSettingsCard from '../components/bill/EqualSplitSettingsCard.vue'
import ReceiptPreviewCard from '../components/bill/ReceiptPreviewCard.vue'
import {
  useRoom,
  useRoomState,
  formatMYR,
  billSubtotal,
  billMenuBase,
  billScannedLineTax,
  billFeeLinesTotal,
  equalSplitPayerCount,
  equalSplitShareAmount,
} from '../composables/useRoomState'
import { isFeeLikeKind } from '../constants/items'
import { useFormValidation } from '../composables/useFormValidation'
import { HOST_STEPS, hostBackRoute } from '../constants/flows'
import { hostRoomPath } from '../composables/roomPaths'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id)
const room = useRoom(roomId)
const { updateItem, removeItem, addItem, confirmReceipt, setEqualSplitSettings, setHostQuantity } =
  useRoomState()
const { shaking, hint, validate } = useFormValidation()
const saving = ref(false)
const saveError = ref('')

const isEqual = computed(() => room.value?.splitMode === 'equal')

const equalHeadcount = computed({
  get: () => room.value?.equalHeadcount ?? 2,
  set: (n) => setEqualSplitSettings(roomId.value, { headcount: n }),
})

const equalHostParticipates = computed({
  get: () => room.value?.equalHostParticipates !== false,
  set: (v) => setEqualSplitSettings(roomId.value, { hostParticipates: v }),
})

const equalShare = computed(() =>
  room.value ? equalSplitShareAmount(room.value) : 0,
)

const menuItems = computed(() =>
  (room.value?.items ?? []).filter((i) => !isFeeLikeKind(i.kind)),
)

const menuBase = computed(() => (room.value ? billMenuBase(room.value) : 0))
const scannedTax = computed(() => (room.value ? billScannedLineTax(room.value) : 0))
const feesTotal = computed(() => (room.value ? billFeeLinesTotal(room.value) : 0))
const subtotal = computed(() => (room.value ? billSubtotal(room.value) : 0))
const receiptUrl = computed(() => room.value?.receiptImageUrl || null)

function onAddItem(payload) {
  if (!room.value) return
  addItem(roomId.value, payload)
}

async function confirm() {
  const checks = [
    { key: 'items', valid: (room.value?.items.length ?? 0) > 0, message: 'Keep at least one line item' },
  ]
  if (isEqual.value) {
    checks.push({
      key: 'equal',
      valid: (room.value?.equalHeadcount ?? 0) >= 1,
      message: 'Set how many people are splitting',
    })
  }
  if (!validate(checks, checks.find((c) => !c.valid)?.message || 'Check the form')) {
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    await confirmReceipt(roomId.value)
    router.push(hostRoomPath(room.value, 'payment-setup'))
  } catch (err) {
    saveError.value = err?.message || 'Could not save receipt'
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push(hostBackRoute(room.value, 'review'))
}
</script>

<template>
  <AppShell
    v-if="room"
    title="Verify receipt"
    subtitle="Edit tax % and menu lines from your scan."
    :room-code="room.roomCode || room.id"
  >
    <FlowProgress :steps="HOST_STEPS" :current="4" />

    <div class="mb-4 flex flex-wrap gap-2">
      <NeoBadge variant="ink">{{ room.splitMode === 'equal' ? 'Equal split' : 'Item-based' }}</NeoBadge>
      <NeoBadge>{{ room.items.length }} lines</NeoBadge>
      <NeoBadge v-if="room.taxFromScan" variant="success">Tax from scan</NeoBadge>
      <NeoBadge v-if="isEqual" variant="warning">
        {{ equalSplitPayerCount(room) }} people · {{ formatMYR(equalShare) }} each
      </NeoBadge>
    </div>

    <ValidationAlert class="mb-4" :message="hint || saveError" :shake="shaking" />

    <ReceiptPreviewCard
      v-if="receiptUrl"
      :image-url="receiptUrl"
      label="Receipt photo"
      :hint="
        isEqual
          ? 'Check the photo matches your scanned lines and totals.'
          : 'Compare with each line — set You ate for what the host ordered.'
      "
    />

    <EqualSplitSettingsCard
      v-if="isEqual"
      class="mb-4"
      :room="room"
      :headcount="equalHeadcount"
      :host-participates="equalHostParticipates"
      @update:headcount="equalHeadcount = $event"
      @update:host-participates="equalHostParticipates = $event"
    />

    <TaxSettingsCard class="mb-4" :room="room" :room-id="room.id" />

    <NeoCard class="mb-4">
      <p class="neo-section-label mb-1">Menu</p>
      <p class="mb-3 text-xs text-neo-ink/70">
        <template v-if="isEqual">
          Edit lines and tax. Equal split uses the full bill — no per-item picking.
        </template>
        <template v-else>
          Food and drinks include SST. Adjust <span class="font-bold">You ate</span> per line.
        </template>
      </p>
      <ReceiptItemRow
        v-for="item in menuItems"
        :key="item.id"
        :item="item"
        editable
        review
        :hide-host-split="isEqual"
        @update="(patch) => updateItem(room.id, item.id, patch)"
        @set-host-qty="(qty) => setHostQuantity(room.id, item.id, qty)"
        @remove="removeItem(room.id, item.id)"
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
        <template v-if="isEqual">
          <div class="flex justify-between text-sm">
            <span>People splitting</span>
            <span class="font-mono font-bold">{{ equalSplitPayerCount(room) }}</span>
          </div>
          <div class="mt-2 flex justify-between text-sm">
            <span>Host in split</span>
            <span class="font-bold">{{ equalHostParticipates ? 'Yes' : 'No' }}</span>
          </div>
          <div class="mt-2 flex justify-between font-bold">
            <span>Each person pays</span>
            <span class="font-mono">{{ formatMYR(equalShare) }}</span>
          </div>
        </template>
        <div v-else class="flex justify-between font-bold">
          <span>Bill total to split</span>
          <span class="font-mono">{{ formatMYR(subtotal) }}</span>
        </div>
      </div>
    </NeoCard>

    <FlowNavBar :shake-continue="shaking" @back="goBack">
      <NeoButton variant="primary" block :loading="saving" @click="confirm">Continue</NeoButton>
    </FlowNavBar>
  </AppShell>
</template>
