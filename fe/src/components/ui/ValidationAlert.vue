<script setup>
defineProps({
  message: { type: String, default: '' },
  shake: { type: Boolean, default: false },
})
</script>

<template>
  <p
    v-if="message"
    role="alert"
    class="rounded-sm border-3 border-neo-danger bg-neo-danger/15 px-3 py-2 text-sm font-bold text-neo-danger"
    :class="shake ? 'animate-neo-shake' : ''"
  >
    {{ message }}
  </p>
</template>
