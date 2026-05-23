<script setup>
import { computed } from 'vue'
import {
  formatMYR,
  itemLineTotal,
  itemLineSubtotal,
  itemLineTax,
  itemHostQuantity,
  itemMemberQuantity,
} from '../../composables/useRoomState'
import { ITEM_KINDS, ITEM_KIND_LABELS, isFeeLikeKind } from '../../constants/items'

const props = defineProps({
  item: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  review: { type: Boolean, default: false },
  /** Hide host "You ate" controls (equal split). */
  hideHostSplit: { type: Boolean, default: false },
})

const emit = defineEmits(['update', 'remove', 'set-host-qty'])

const lineTotal = computed(() => itemLineTotal(props.item))
const quantity = computed(() => Math.max(1, Number(props.item.quantity) || 1))
const unitPrice = computed(() => Number(props.item.unitPrice ?? props.item.price) || 0)
const hostQty = computed(() => itemHostQuantity(props.item))
const memberQty = computed(() => itemMemberQuantity(props.item))
const hostHighlight = computed(() => hostQty.value > 0)
const isFeeLine = computed(() => isFeeLikeKind(props.item.kind))
const lineSubtotal = computed(() => itemLineSubtotal(props.item))
const lineTax = computed(() => itemLineTax(props.item))
const taxPercent = computed(() => String(Math.round((Number(props.item.taxRate) || 0) * 1000) / 10))

function setTaxRate(percentStr) {
  const pct = Math.max(0, Math.min(100, parseFloat(percentStr) || 0))
  emit('update', { taxRate: pct / 100, taxFromScan: false })
}

function setQuantity(next) {
  emit('update', { quantity: Math.max(1, next) })
}

function setUnitPrice(value) {
  emit('update', { unitPrice: Math.max(0, parseFloat(value) || 0) })
}

function setHostQty(next) {
  emit('set-host-qty', Math.min(quantity.value, Math.max(0, next)))
}

function onQuantityInput(value) {
  setQuantity(Math.max(1, Math.floor(Number(value) || 1)))
}

function onHostQtyInput(value) {
  setHostQty(Math.floor(Number(value) || 0))
}
</script>

<template>
  <div
    class="border-b-2 border-neo-ink/20 py-3 last:border-0"
    :class="hostHighlight ? 'bg-neo-primary/30 -mx-2 px-2' : ''"
  >
    <div class="flex items-start gap-2">
      <input
        v-if="editable"
        :value="item.name"
        class="min-w-0 flex-1 border-2 border-neo-ink bg-neo-bg px-2 py-2.5 text-sm font-bold"
        @input="emit('update', { name: $event.target.value })"
      />
      <div v-else class="min-w-0 flex-1">
        <p class="font-bold leading-snug">{{ item.name }}</p>
        <span
          v-if="review && item.kind"
          class="mt-1 inline-block border border-neo-ink px-1.5 py-0.5 text-[10px] font-bold uppercase"
          :class="item.taxFromScan ? 'bg-neo-primary/50' : ''"
        >
          {{ ITEM_KIND_LABELS[item.kind] ?? item.kind }}
          <span v-if="item.taxFromScan" class="normal-case"> · scan</span>
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <input
          v-if="editable"
          type="number"
          step="0.01"
          min="0"
          :value="unitPrice"
          class="w-[5.25rem] border-2 border-neo-ink bg-neo-bg px-2 py-2.5 text-right text-sm font-bold"
          @input="setUnitPrice($event.target.value)"
        />
        <button
          v-if="review"
          type="button"
          class="neo-pressable flex h-11 w-11 shrink-0 items-center justify-center border-2 border-neo-danger bg-neo-danger/10 text-sm font-bold text-neo-danger"
          aria-label="Remove item"
          @click="emit('remove')"
        >
          ✕
        </button>
      </div>
    </div>

    <p
      v-if="review"
      class="mt-2 text-right font-mono text-xs font-bold leading-relaxed text-neo-ink/70"
    >
      <template v-if="!isFeeLine && lineTax > 0">
        {{ formatMYR(lineSubtotal) }} + tax {{ formatMYR(lineTax) }} =
      </template>
      <span v-if="quantity > 1 && !isFeeLine">{{ quantity }} × </span>
      {{ formatMYR(lineTotal) }}
    </p>
    <p v-if="review && hostQty > 0" class="mt-0.5 text-right text-[10px] font-bold text-neo-ink/60">
      yours {{ formatMYR(unitPrice * hostQty) }}
    </p>

    <div v-if="review && !isFeeLine" class="mt-3">
      <label class="mb-1 block text-[10px] font-bold uppercase text-neo-ink/60">Type</label>
      <select
        :value="item.kind || 'food'"
        class="w-full border-2 border-neo-ink bg-neo-bg px-2 py-2.5 text-xs font-bold"
        @change="emit('update', { kind: $event.target.value })"
      >
        <option v-for="k in ITEM_KINDS" :key="k.value" :value="k.value">{{ k.label }}</option>
      </select>
    </div>

    <div v-if="review" class="receipt-item-fields mt-3">
      <div v-if="!isFeeLine" class="receipt-field-row">
        <span class="receipt-field-label">SST %</span>
        <div class="receipt-field-control">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            :value="taxPercent"
            class="w-16 max-w-full border-2 border-neo-ink bg-neo-bg px-2 py-2.5 text-sm font-bold"
            @input="setTaxRate($event.target.value)"
          />
          <p class="text-xs font-bold leading-snug text-neo-ink/70">
            +{{ formatMYR(lineTax) }}
            <span class="font-normal">on {{ formatMYR(lineSubtotal) }}</span>
          </p>
        </div>
      </div>

      <div class="receipt-field-row">
        <span class="receipt-field-label">Bill qty</span>
        <div class="receipt-field-control">
          <div class="qty-stepper">
            <button
              type="button"
              class="neo-pressable qty-stepper-btn"
              :disabled="quantity <= 1"
              @click="setQuantity(quantity - 1)"
            >
              −
            </button>
            <input
              type="number"
              class="qty-stepper-value"
              min="1"
              :value="quantity"
              aria-label="Bill quantity"
              @change="onQuantityInput($event.target.value)"
              @blur="onQuantityInput($event.target.value)"
            />
            <button
              type="button"
              class="neo-pressable qty-stepper-btn"
              @click="setQuantity(quantity + 1)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div v-if="!hideHostSplit" class="receipt-field-row">
        <span class="receipt-field-label">You ate</span>
        <div class="receipt-field-control">
          <div class="qty-stepper">
            <button
              type="button"
              class="neo-pressable qty-stepper-btn"
              :disabled="hostQty <= 0"
              @click="setHostQty(hostQty - 1)"
            >
              −
            </button>
            <input
              type="number"
              class="qty-stepper-value qty-stepper-value--host"
              min="0"
              :max="quantity"
              :value="hostQty"
              aria-label="You ate quantity"
              @change="onHostQtyInput($event.target.value)"
              @blur="onHostQtyInput($event.target.value)"
            />
            <button
              type="button"
              class="neo-pressable qty-stepper-btn"
              :disabled="hostQty >= quantity"
              @click="setHostQty(hostQty + 1)"
            >
              +
            </button>
          </div>
          <p class="text-xs font-medium leading-snug text-neo-ink/70">
            <template v-if="memberQty > 0">{{ memberQty }} left for members</template>
            <template v-else>All yours</template>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
