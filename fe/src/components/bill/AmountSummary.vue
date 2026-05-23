<script setup>
import { computed } from 'vue'
import NeoCard from '../ui/NeoCard.vue'
import NeoDivider from '../ui/NeoDivider.vue'
import {
  formatMYR,
  billSubtotal,
  billHostTotal,
  billMemberPool,
  billScannedLineTax,
  billFeeLinesTotal,
  itemHostQuantity,
  itemHostTotal,
  equalSplitPayerCount,
  equalSplitShareAmount,
  billMenuLines,
} from '../../composables/useRoomState'
import BillMenuList from './BillMenuList.vue'
import { isAssignableKind } from '../../constants/items'

const props = defineProps({
  items: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
  room: { type: Object, default: null },
})

const totalBill = computed(() =>
  props.room ? billSubtotal(props.room) : props.items.reduce((s, i) => s + (i.price || 0), 0),
)
const hostShare = computed(() => (props.room ? billHostTotal(props.room) : 0))
const membersPay = computed(() =>
  props.room ? billMemberPool(props.room) : Math.max(0, totalBill.value - hostShare.value),
)
const scannedTax = computed(() => (props.room ? billScannedLineTax(props.room) : 0))
const fees = computed(() => (props.room ? billFeeLinesTotal(props.room) : 0))
const payers = computed(() => props.members.filter((m) => !m.isHost))
const hostMember = computed(() => props.members.find((m) => m.isHost))

const hostLabel = computed(() => hostMember.value?.name ?? props.room?.hostName ?? 'Host')

const hostFoodItems = computed(() => {
  if (!props.room?.items) return []
  return props.room.items.filter(
    (item) => isAssignableKind(item.kind) && itemHostQuantity(item) > 0,
  )
})

const isEqual = computed(() => props.room?.splitMode === 'equal')
const equalShare = computed(() =>
  props.room ? equalSplitShareAmount(props.room) : 0,
)
const equalHeadcount = computed(() =>
  props.room ? equalSplitPayerCount(props.room) : 0,
)
const menuLineCount = computed(() => billMenuLines(props.room).length)

const showHostFoodDetails = computed(
  () => props.room?.splitMode === 'item' || hostFoodItems.value.length > 0,
)
const showMenuList = computed(() => menuLineCount.value > 0)
</script>

<template>
  <NeoCard>
    <p class="neo-section-label mb-3">Amounts</p>
    <div class="flex justify-between text-sm">
      <span>Bill total</span>
      <span class="font-mono font-bold">{{ formatMYR(totalBill) }}</span>
    </div>

    <div v-if="showMenuList" class="mt-3">
      <p class="neo-section-label mb-2">Menu on bill</p>
      <BillMenuList :room="room" />
    </div>

    <div v-if="isEqual" class="mt-3 flex justify-between text-sm">
      <span>Equal split ({{ equalHeadcount }} people)</span>
      <span class="font-mono font-bold">{{ formatMYR(equalShare) }} each</span>
    </div>

    <template v-else-if="hostShare > 0 || showHostFoodDetails">
      <div class="mt-3">
        <div class="flex justify-between text-sm font-bold">
          <span>{{ hostLabel }} (your share)</span>
          <span class="font-mono">− {{ formatMYR(hostShare) }}</span>
        </div>

        <ul v-if="hostFoodItems.length" class="mt-2 space-y-1.5 pl-1">
          <li
            v-for="item in hostFoodItems"
            :key="item.id"
            class="flex items-start justify-between gap-2 border-l-4 border-neo-accent bg-neo-primary/20 py-1.5 pl-2 pr-1 text-sm"
          >
            <span class="min-w-0">
              <span class="font-bold leading-snug">{{ item.name }}</span>
              <span class="mt-0.5 block text-xs font-medium text-neo-ink/70">
                <template v-if="itemHostQuantity(item) < item.quantity">
                  {{ itemHostQuantity(item) }} of {{ item.quantity }}
                </template>
                <template v-else>Qty {{ item.quantity }}</template>
              </span>
            </span>
            <span class="shrink-0 font-mono text-xs font-bold">{{ formatMYR(itemHostTotal(item)) }}</span>
          </li>
        </ul>
        <p
          v-else-if="room?.splitMode === 'item'"
          class="mt-2 text-xs font-medium text-neo-ink/70"
        >
          No items marked as yours on the receipt.
        </p>
      </div>
    </template>

    <div class="mt-3 flex justify-between font-bold">
      <span>{{ isEqual ? 'Each person pays' : 'Members pay' }}</span>
      <span class="font-mono">{{ formatMYR(isEqual ? equalShare : membersPay) }}</span>
    </div>
    <div v-if="scannedTax > 0" class="mt-1 flex justify-between text-xs text-neo-ink/70">
      <span>Includes SST on items</span>
      <span class="font-mono">{{ formatMYR(scannedTax) }}</span>
    </div>
    <div v-if="fees > 0" class="mt-1 flex justify-between text-xs text-neo-ink/70">
      <span>Includes fees</span>
      <span class="font-mono">{{ formatMYR(fees) }}</span>
    </div>

    <NeoDivider />

    <p class="neo-section-label mb-2">Members</p>
    <ul v-if="payers.length" class="space-y-2">
      <li v-for="m in payers" :key="m.id" class="flex justify-between text-sm">
        <span>{{ m.name }}</span>
        <span class="font-mono font-bold">{{ formatMYR(m.amountDue) }}</span>
      </li>
    </ul>
    <p v-else class="text-xs font-medium text-neo-ink/70">No members joined yet — share the room code.</p>
  </NeoCard>
</template>
