<script setup>
import { computed } from 'vue'
import NeoCard from '../ui/NeoCard.vue'
import NeoInput from '../ui/NeoInput.vue'
import {
  useRoomState,
  billScannedLineTax,
  billFeeLinesTotal,
  billMenuBase,
  itemLineTotal,
  formatMYR,
} from '../../composables/useRoomState'

const props = defineProps({
  room: { type: Object, required: true },
  roomId: { type: String, required: true },
})

const { setScannedSstRate, setScannedServiceRate, resetServiceChargeManual } = useRoomState()

const serviceLine = computed(() => props.room.items.find((i) => i.feeRole === 'serviceCharge'))

const serviceAmount = computed(() =>
  serviceLine.value ? itemLineTotal(serviceLine.value) : 0,
)

const sstPercent = computed({
  get: () => String(Math.round((props.room.scannedSstRate ?? 0.06) * 1000) / 10),
  set: (v) => {
    const pct = Math.max(0, Math.min(100, parseFloat(v) || 0))
    setScannedSstRate(props.roomId, pct / 100)
  },
})

const servicePercent = computed({
  get: () => String(Math.round((props.room.scannedServiceRate ?? 0.1) * 1000) / 10),
  set: (v) => {
    const pct = Math.max(0, Math.min(100, parseFloat(v) || 0))
    setScannedServiceRate(props.roomId, pct / 100)
  },
})
</script>

<template>
  <NeoCard>
    <p class="neo-section-label mb-3">Tax & fees</p>

    <div
      v-if="room.taxFromScan"
      class="mb-4 space-y-2 rounded-sm border-2 border-neo-ink/30 bg-neo-primary/20 p-3 text-sm"
    >
      <p class="font-bold">From scan</p>
      <div class="flex items-baseline justify-between gap-3 text-xs font-bold">
        <span class="min-w-0">Menu (before tax)</span>
        <span class="shrink-0 font-mono">{{ formatMYR(billMenuBase(room)) }}</span>
      </div>
      <div class="flex items-baseline justify-between gap-3 text-xs font-bold">
        <span class="min-w-0">SST on items</span>
        <span class="shrink-0 font-mono">+ {{ formatMYR(billScannedLineTax(room)) }}</span>
      </div>
      <div
        v-if="billFeeLinesTotal(room) > 0"
        class="flex items-baseline justify-between gap-3 text-xs font-bold"
      >
        <span class="min-w-0">Service charge</span>
        <span class="shrink-0 font-mono">+ {{ formatMYR(billFeeLinesTotal(room)) }}</span>
      </div>
    </div>
    <p v-else class="mb-4 text-xs text-neo-ink/70">
      Adjust SST and service charge % below.
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <NeoInput
        id="sst-rate"
        v-model="sstPercent"
        label="SST on menu (%)"
        type="number"
        step="0.1"
        min="0"
        max="100"
        placeholder="6"
      />
      <div>
        <NeoInput
          id="service-rate"
          v-model="servicePercent"
          label="Service charge (%)"
          type="number"
          step="0.1"
          min="0"
          max="100"
          placeholder="10"
        />
        <p class="mt-1 text-xs font-bold text-neo-ink/70">
          = {{ formatMYR(serviceAmount) }}
          <span v-if="serviceLine?.serviceChargeManual" class="text-neo-warning">
            · manual
          </span>
        </p>
        <button
          v-if="serviceLine?.serviceChargeManual"
          type="button"
          class="mt-1 text-xs font-bold underline"
          @click="resetServiceChargeManual(roomId)"
        >
          Recalc from %
        </button>
        <button
          v-else-if="!serviceLine"
          type="button"
          class="mt-2 neo-pressable border-3 border-neo-ink bg-neo-surface px-3 py-2 text-xs font-bold uppercase neo-shadow"
          @click="setScannedServiceRate(roomId, room.scannedServiceRate ?? 0.1)"
        >
          + Service charge
        </button>
      </div>
    </div>
  </NeoCard>
</template>
