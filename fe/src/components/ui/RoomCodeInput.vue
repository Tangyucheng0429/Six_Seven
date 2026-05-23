<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import NeoLabel from './NeoLabel.vue'
import { normalizeRoomCodeInput } from '../../composables/roomCodes'

const CODE_LENGTH = 6

const model = defineModel({ type: String, default: '' })

defineProps({
  id: { type: String, default: 'room-code' },
  label: { type: String, default: 'Room number' },
  error: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  shake: { type: Boolean, default: false },
})

const inputRef = ref(null)
const focused = ref(false)

const cells = computed(() => {
  const chars = normalizeRoomCodeInput(model.value).split('')
  return Array.from({ length: CODE_LENGTH }, (_, i) => chars[i] ?? '')
})

const activeIndex = computed(() => {
  const len = normalizeRoomCodeInput(model.value).length
  if (!focused.value) return -1
  return len >= CODE_LENGTH ? CODE_LENGTH - 1 : len
})

function focusInput() {
  inputRef.value?.focus()
}

function onInput(event) {
  model.value = normalizeRoomCodeInput(event.target.value)
  event.target.value = model.value
}

function onPaste(event) {
  event.preventDefault()
  const pasted = event.clipboardData?.getData('text') || ''
  model.value = normalizeRoomCodeInput(pasted)
  if (inputRef.value) inputRef.value.value = model.value
}

function onKeydown(event) {
  if (event.key === 'Enter' && normalizeRoomCodeInput(model.value).length === CODE_LENGTH) {
    event.target.form?.requestSubmit()
  }
}

onMounted(() => {
  nextTick(() => focusInput())
})
</script>

<template>
  <div class="flex flex-col gap-2" :class="shake ? 'animate-neo-shake' : ''">
    <NeoLabel v-if="label" :for="id">{{ label }}</NeoLabel>

    <div
      class="room-code-input"
      :class="{ 'room-code-input--error': error, 'room-code-input--focused': focused }"
      role="group"
      :aria-label="label"
      @click="focusInput"
    >
      <div class="room-code-cells" aria-hidden="true">
        <div
          v-for="(char, index) in cells"
          :key="index"
          class="room-code-cell"
          :class="{
            'room-code-cell--filled': Boolean(char),
            'room-code-cell--active': activeIndex === index,
          }"
        >
          <span class="room-code-char">{{ char || '−' }}</span>
        </div>
      </div>

      <input
        :id="id"
        ref="inputRef"
        :value="model"
        type="text"
        class="room-code-hidden"
        maxlength="6"
        autofocus
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        inputmode="text"
        :aria-invalid="error"
        @input="onInput"
        @paste="onPaste"
        @keydown="onKeydown"
        @focus="focused = true"
        @blur="focused = false"
      />
    </div>

    <p class="text-center text-xs font-medium text-neo-ink/60">
      6 characters · letters &amp; numbers (no O / 0 / I / 1)
    </p>

    <p v-if="error && errorMessage" class="text-center text-xs font-bold text-neo-danger">
      {{ errorMessage }}
    </p>
  </div>
</template>
