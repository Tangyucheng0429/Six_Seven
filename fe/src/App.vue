<script setup>
import { onErrorCaptured, ref } from 'vue'
import { useRoomStateProvider } from './composables/useRoomState'

const fatalError = ref(null)

onErrorCaptured((err) => {
  fatalError.value = err
  console.error('[SixSeven]', err)
  return false
})

try {
  useRoomStateProvider()
} catch (err) {
  fatalError.value = err
  console.error('[SixSeven] Provider init failed', err)
}
</script>

<template>
  <div
    v-if="fatalError"
    class="mx-auto max-w-lg p-6 font-medium"
  >
    <p class="text-lg font-bold text-neo-danger">Something went wrong</p>
    <p class="mt-2 text-sm">{{ fatalError.message }}</p>
    <p class="mt-4 text-xs text-neo-ink/70">
      Try clearing site data for localhost, or open DevTools → Console for details.
    </p>
    <button
      type="button"
      class="mt-6 border-3 border-neo-ink bg-neo-primary px-4 py-2 font-bold neo-shadow"
      @click="fatalError = null; window.location.reload()"
    >
      Reload
    </button>
  </div>
  <RouterView v-else />
</template>
