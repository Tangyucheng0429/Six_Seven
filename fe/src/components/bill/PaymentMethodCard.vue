<script setup>
import NeoCard from '../ui/NeoCard.vue'

defineProps({
  method: { type: Object, required: true },
})
</script>

<template>
  <NeoCard accent>
    <p class="text-xs font-bold uppercase tracking-widest">Pay via</p>
    <p class="mt-1 text-xl font-bold">{{ method.label || method.type }}</p>
    <img
      v-if="method.imageUrl"
      :src="method.imageUrl"
      alt="Payment QR"
      class="mt-4 max-h-56 w-full border-3 border-neo-ink object-contain neo-shadow"
    />
    <p v-if="method.notes" class="mt-3 font-mono text-sm">{{ method.notes }}</p>
  </NeoCard>
</template>
