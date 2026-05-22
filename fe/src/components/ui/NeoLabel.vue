<script setup>
defineProps({
  for: { type: String, default: '' },
})
</script>

<template>
  <label :for="$props.for" class="text-xs font-bold uppercase tracking-widest text-neo-ink">
    <slot />
  </label>
</template>
