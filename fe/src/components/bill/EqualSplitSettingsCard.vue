<script setup>
import { computed } from 'vue'
import NeoCard from '../ui/NeoCard.vue'
import QtyStepper from '../ui/QtyStepper.vue'
import { formatMYR, billSubtotal } from '../../composables/useRoomState'

const props = defineProps({
  room: { type: Object, required: true },
  headcount: { type: Number, required: true },
  hostParticipates: { type: Boolean, required: true },
})

const emit = defineEmits(['update:headcount', 'update:hostParticipates'])

const total = computed(() => billSubtotal(props.room))
const perPerson = computed(() => {
  const n = Math.max(1, Math.floor(Number(props.headcount) || 1))
  return Math.round((total.value / n) * 100) / 100
})

const headcountLabel = computed(() =>
  props.hostParticipates
    ? 'How many people are splitting? (including you)'
    : 'How many members are splitting?',
)
</script>

<template>
  <NeoCard>
    <p class="neo-section-label mb-1">Equal split setup</p>
    <p class="mb-4 text-xs text-neo-ink/70">
      Set who shares the bill before members join. Amounts update when people join the room.
    </p>

    <label class="mb-4 flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        class="size-5 border-2 border-neo-ink accent-neo-accent"
        :checked="hostParticipates"
        @change="emit('update:hostParticipates', $event.target.checked)"
      />
      <span class="text-sm font-bold">I'm splitting too (host pays a share)</span>
    </label>

    <div class="receipt-field-row">
      <span class="receipt-field-label">{{ headcountLabel }}</span>
      <div class="receipt-field-control">
        <QtyStepper
          :model-value="headcount"
          :min="1"
          :max="99"
          aria-label="Number of people splitting"
          @update:model-value="emit('update:headcount', $event)"
        />
      </div>
    </div>

    <div
      class="mt-4 border-t-2 border-neo-ink/20 pt-3 text-sm"
      v-if="total > 0 && headcount >= 1"
    >
      <div class="flex justify-between font-bold">
        <span>Each person pays (estimate)</span>
        <span class="font-mono">{{ formatMYR(perPerson) }}</span>
      </div>
      <p class="mt-1 text-xs font-medium text-neo-ink/70">
        {{ formatMYR(total) }} ÷ {{ headcount }} people
      </p>
    </div>
  </NeoCard>
</template>
