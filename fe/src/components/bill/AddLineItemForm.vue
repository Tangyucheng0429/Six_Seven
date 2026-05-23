<script setup>
import { ref, computed } from 'vue'
import NeoCard from '../ui/NeoCard.vue'
import NeoInput from '../ui/NeoInput.vue'
import NeoButton from '../ui/NeoButton.vue'
import { ITEM_KINDS } from '../../constants/items'
import { useFormValidation, isFilled } from '../../composables/useFormValidation'

const props = defineProps({
  embedded: { type: Boolean, default: false },
  menuOnly: { type: Boolean, default: false },
  collapsible: { type: Boolean, default: false },
})

const emit = defineEmits(['add'])

const expanded = ref(!props.collapsible)
const addLabel = computed(() => (props.menuOnly ? 'Add menu item' : 'Add item'))

function toggleExpanded() {
  expanded.value = !expanded.value
}

const menuKinds = ITEM_KINDS.filter((k) => !['fee', 'tax'].includes(k.value))
const kindOptions = computed(() => (props.menuOnly ? menuKinds : ITEM_KINDS))

const name = ref('')
const unitPrice = ref('')
const quantity = ref('1')
const kind = ref('food')
const { shaking, hint, hasError, fieldHint, clearField, validate } = useFormValidation()

function onNameInput() {
  clearField('name')
}
function onPriceInput() {
  clearField('price')
}

function submit() {
  if (props.collapsible) expanded.value = true
  if (
    !validate([
      { key: 'name', valid: isFilled(name.value) },
      { key: 'price', valid: isFilled(unitPrice.value) && Number(unitPrice.value) >= 0 },
    ])
  ) {
    return
  }
  emit('add', {
    name: name.value.trim(),
    unitPrice: parseFloat(unitPrice.value) || 0,
    quantity: Math.max(1, parseInt(quantity.value, 10) || 1),
    kind: kind.value,
  })
  name.value = ''
  unitPrice.value = ''
  quantity.value = '1'
  kind.value = 'food'
  if (props.collapsible) expanded.value = false
}
</script>

<template>
  <component :is="embedded ? 'div' : NeoCard">
    <button
      v-if="collapsible"
      type="button"
      class="neo-pressable flex w-full items-center justify-between gap-2 border-3 border-neo-ink bg-neo-surface px-3 py-3 text-left text-xs font-bold uppercase neo-shadow"
      :aria-expanded="expanded"
      @click="toggleExpanded"
    >
      <span>{{ addLabel }}</span>
      <span class="text-base leading-none" aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
    </button>
    <p v-else class="neo-section-label mb-3">{{ addLabel }}</p>

    <template v-if="!collapsible || expanded">
      <p
        v-if="hint"
        class="mb-3 text-sm font-bold text-neo-danger"
        :class="[shaking ? 'animate-neo-shake' : '', collapsible ? 'mt-3' : '']"
      >
        {{ hint }}
      </p>
      <div class="space-y-3" :class="collapsible ? 'mt-3' : ''">
      <div>
        <label class="mb-2 block text-xs font-bold uppercase text-neo-ink/60">Type</label>
        <div
          class="grid gap-2"
          :class="menuOnly ? 'grid-cols-3' : 'grid-cols-2'"
        >
          <button
            v-for="k in kindOptions"
            :key="k.value"
            type="button"
            class="neo-pressable border-3 border-neo-ink px-2 py-2 text-xs font-bold uppercase neo-shadow"
            :class="kind === k.value ? 'bg-neo-primary' : 'bg-neo-surface'"
            @click="kind = k.value"
          >
            {{ k.label }}
          </button>
        </div>
      </div>
      <NeoInput
        id="add-name"
        v-model="name"
        label="Name"
        placeholder="Nasi lemak"
        :error="hasError('name')"
        :error-message="fieldHint('name')"
        :shake="hasError('name') && shaking"
        @input="onNameInput"
      />
      <div class="grid grid-cols-2 gap-3">
        <NeoInput
          id="add-price"
          v-model="unitPrice"
          label="Unit price (RM)"
          type="number"
          step="0.01"
          min="0"
          placeholder="12.50"
          :error="hasError('price')"
          :error-message="fieldHint('price')"
          :shake="hasError('price') && shaking"
          @input="onPriceInput"
        />
        <NeoInput
          id="add-qty"
          v-model="quantity"
          label="Qty"
          type="number"
          min="1"
        />
      </div>
      <NeoButton variant="secondary" block @click="submit">Add to list</NeoButton>
      </div>
    </template>
  </component>
</template>
