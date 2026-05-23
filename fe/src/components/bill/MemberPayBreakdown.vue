<script setup>
import { computed } from 'vue'
import NeoCard from '../ui/NeoCard.vue'
import { formatDueDate } from '../../composables/useDueDate'
import { formatMYR, getMemberPayBreakdown } from '../../composables/useRoomState'

const props = defineProps({
  room: { type: Object, required: true },
  memberId: { type: String, required: true },
})

const breakdown = computed(() => getMemberPayBreakdown(props.room, props.memberId))

const memberName = computed(
  () => props.room.members?.find((m) => m.id === props.memberId)?.name ?? 'Guest',
)
</script>

<template>
  <NeoCard
    v-if="breakdown"
    class="receipt-slip mx-auto mb-6 max-w-sm !p-0 font-mono text-sm leading-snug"
    :padding="false"
    aria-label="Your bill receipt"
  >
    <div class="receipt-slip__due">
      <p class="text-[10px] font-bold uppercase tracking-[0.2em]">You owe</p>
      <p class="mt-0.5 font-mono text-3xl font-bold leading-none tabular-nums">
        {{ formatMYR(breakdown.total) }}
      </p>
    </div>

    <div class="receipt-slip__body">
      <header class="text-center">
        <p class="receipt-slip__shop">{{ room.name }}</p>
        <p class="receipt-slip__meta">Room {{ room.roomCode || room.id }}</p>
        <p class="receipt-slip__meta">{{ memberName }} · Due {{ formatDueDate(room.dueDate) }}</p>
      </header>

      <hr class="receipt-slip__rule" />

      <template v-if="breakdown.mode === 'equal'">
        <p class="text-center text-xs font-medium text-neo-ink/70">
          Equal split · {{ breakdown.headcount }} people
          <template v-if="breakdown.hostParticipates"> (incl. host)</template>
        </p>
        <p
          v-if="breakdown.memberCount < breakdown.headcount"
          class="mt-1 text-center text-[10px] font-medium text-neo-ink/60"
        >
          {{ breakdown.memberCount }} joined so far — amount may change when everyone joins
        </p>

        <hr class="receipt-slip__rule" />

        <section v-if="breakdown.menuLines?.length" aria-label="Bill menu">
          <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-neo-ink/60">On the bill</p>
          <div
            v-for="line in breakdown.menuLines"
            :key="line.id"
            class="receipt-slip__row receipt-slip__row--item"
          >
            <span class="receipt-slip__item">
              {{ line.name }}
              <span v-if="line.qty > 1" class="receipt-slip__qty"> ×{{ line.qty }}</span>
            </span>
            <span class="receipt-slip__amt">{{ formatMYR(line.amount) }}</span>
          </div>
        </section>

        <section v-if="breakdown.feeLines?.length" class="mt-1" aria-label="Fees">
          <div
            v-for="fee in breakdown.feeLines"
            :key="fee.id"
            class="receipt-slip__row receipt-slip__row--subtle"
          >
            <span class="receipt-slip__item">{{ fee.name }}</span>
            <span class="receipt-slip__amt">{{ formatMYR(fee.amount) }}</span>
          </div>
        </section>

        <hr class="receipt-slip__rule" />

        <div class="receipt-slip__row receipt-slip__row--subtle">
          <span class="receipt-slip__item">Bill total</span>
          <span class="receipt-slip__amt">{{ formatMYR(breakdown.billTotal) }}</span>
        </div>
        <div class="receipt-slip__row receipt-slip__row--subtle">
          <span class="receipt-slip__item">÷ {{ breakdown.headcount }} people</span>
          <span class="receipt-slip__amt">{{ formatMYR(breakdown.total) }}</span>
        </div>

        <hr class="receipt-slip__rule receipt-slip__rule--double" />

        <div class="receipt-slip__row receipt-slip__row--total">
          <span class="receipt-slip__item">YOUR SHARE</span>
          <span class="receipt-slip__amt">{{ formatMYR(breakdown.total) }}</span>
        </div>
      </template>

      <template v-else>
        <section v-if="breakdown.menuLines.length" aria-label="Items">
          <div
            v-for="line in breakdown.menuLines"
            :key="line.id"
            class="receipt-slip__row receipt-slip__row--item"
          >
            <span class="receipt-slip__item">
              {{ line.name }}
              <span v-if="line.qty > 1" class="receipt-slip__qty"> ×{{ line.qty }}</span>
            </span>
            <span class="receipt-slip__amt">{{ formatMYR(line.amount) }}</span>
          </div>
        </section>
        <p v-else class="py-2 text-center text-xs text-neo-ink/60">No items selected</p>

        <hr class="receipt-slip__rule" />

        <section aria-label="Totals">
          <div
            v-if="breakdown.menuLines.length"
            class="receipt-slip__row receipt-slip__row--subtle"
          >
            <span class="receipt-slip__item">Subtotal</span>
            <span class="receipt-slip__amt">{{ formatMYR(breakdown.menuSubtotal) }}</span>
          </div>
          <div
            v-for="(fee, index) in breakdown.feeLines"
            :key="`${fee.name}-${index}`"
            class="receipt-slip__row receipt-slip__row--subtle"
          >
            <span class="receipt-slip__item">{{ fee.name }}</span>
            <span class="receipt-slip__amt">{{ formatMYR(fee.amount) }}</span>
          </div>
        </section>

        <hr class="receipt-slip__rule receipt-slip__rule--double" />

        <div class="receipt-slip__row receipt-slip__row--total">
          <span class="receipt-slip__item">TOTAL</span>
          <span class="receipt-slip__amt">{{ formatMYR(breakdown.total) }}</span>
        </div>

        <p v-if="breakdown.menuLines.length" class="receipt-slip__foot">
          SST included in item amounts above
        </p>
      </template>
    </div>

    <div class="receipt-slip__tear" aria-hidden="true" />
  </NeoCard>
</template>
