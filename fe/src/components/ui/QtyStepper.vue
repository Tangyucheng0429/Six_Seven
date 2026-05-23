<script setup>
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 99 },
  ariaLabel: { type: String, default: 'Quantity' },
})

const emit = defineEmits(['update:modelValue'])

function clamp(next) {
  return Math.min(props.max, Math.max(props.min, Math.floor(Number(next) || 0)))
}

function set(next) {
  emit('update:modelValue', clamp(next))
}

function onInput(value) {
  set(value)
}
</script>

<template>
  <div class="qty-stepper">
    <button
      type="button"
      class="neo-pressable qty-stepper-btn"
      :disabled="modelValue <= min"
      aria-label="Decrease"
      @click="set(modelValue - 1)"
    >
      −
    </button>
    <input
      type="number"
      class="qty-stepper-value"
      :min="min"
      :max="max"
      :value="modelValue"
      :aria-label="ariaLabel"
      @input="onInput($event.target.value)"
      @change="onInput($event.target.value)"
      @blur="onInput($event.target.value)"
    />
    <button
      type="button"
      class="neo-pressable qty-stepper-btn"
      :disabled="modelValue >= max"
      aria-label="Increase"
      @click="set(modelValue + 1)"
    >
      +
    </button>
  </div>
</template>
