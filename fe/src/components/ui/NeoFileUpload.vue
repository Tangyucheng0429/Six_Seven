<script setup>
import { ref } from 'vue'
import NeoLabel from './NeoLabel.vue'

const emit = defineEmits(['file', 'clear'])

defineProps({
  label: { type: String, default: 'Upload file' },
  accept: { type: String, default: 'image/*' },
  previewUrl: { type: String, default: null },
  error: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  shake: { type: Boolean, default: false },
})

const dragging = ref(false)
const inputRef = ref(null)

function onFile(files) {
  const file = files?.[0]
  if (!file) return
  emit('file', { file, previewUrl: URL.createObjectURL(file) })
}

function onDrop(e) {
  dragging.value = false
  onFile(e.dataTransfer.files)
}

function clear() {
  if (inputRef.value) inputRef.value.value = ''
  emit('clear')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <NeoLabel>{{ label }}</NeoLabel>
    <div
      class="relative flex min-h-40 cursor-pointer flex-col items-center justify-center border-3 border-dashed bg-neo-surface p-6 text-center neo-shadow transition-colors"
      :class="[
        dragging ? 'bg-neo-primary' : '',
        error ? 'neo-field-invalid border-neo-danger' : 'border-neo-ink',
        shake ? 'animate-neo-shake' : '',
      ]"
      :aria-invalid="error"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @click="inputRef?.click()"
    >
      <input
        ref="inputRef"
        type="file"
        class="hidden"
        :accept="accept"
        @change="onFile($event.target.files)"
      />
      <template v-if="previewUrl">
        <img :src="previewUrl" alt="Preview" class="max-h-48 w-full object-contain" />
        <button
          type="button"
          class="mt-3 text-xs font-bold uppercase underline"
          @click.stop="clear"
        >
          Remove
        </button>
      </template>
      <template v-else>
        <span class="text-4xl">↑</span>
        <p class="mt-2 text-sm font-bold">Tap or drag to upload</p>
        <p class="text-xs text-neo-ink/60">PNG, JPG up to 10MB</p>
      </template>
    </div>
    <p v-if="error && errorMessage" class="text-xs font-bold text-neo-danger">{{ errorMessage }}</p>
  </div>
</template>
