<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import NeoCard from '../ui/NeoCard.vue'

defineProps({
  imageUrl: { type: String, required: true },
  label: { type: String, default: 'Receipt from host' },
  hint: { type: String, default: 'Tap the photo to view full size.' },
})

const open = ref(false)

function close() {
  open.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <NeoCard class="mb-4">
    <p class="neo-section-label mb-2">{{ label }}</p>
    <p class="mb-3 text-xs font-medium text-neo-ink/70">{{ hint }}</p>
    <button
      type="button"
      class="neo-pressable block w-full overflow-hidden border-2 border-neo-ink bg-neo-bg text-left neo-shadow"
      @click="open = true"
    >
      <img
        :src="imageUrl"
        alt=""
        class="max-h-56 w-full object-contain"
      />
      <span class="block border-t-2 border-neo-ink bg-neo-primary px-3 py-2 text-center text-xs font-bold">
        View receipt
      </span>
    </button>
  </NeoCard>

  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neo-ink/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt full size"
      @click.self="close"
    >
      <div
        class="relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col border-3 border-neo-ink bg-neo-surface neo-shadow"
      >
        <div class="flex items-center justify-between gap-2 border-b-3 border-neo-ink bg-neo-primary px-3 py-2">
          <p class="text-sm font-bold">{{ label }}</p>
          <button
            type="button"
            class="neo-pressable flex size-9 shrink-0 items-center justify-center border-2 border-neo-ink bg-neo-surface text-sm font-bold"
            aria-label="Close"
            @click="close"
          >
            ✕
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-auto bg-neo-bg p-3">
          <img
            :src="imageUrl"
            alt="Receipt uploaded by host"
            class="mx-auto max-h-[min(75vh,640px)] w-full object-contain"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
