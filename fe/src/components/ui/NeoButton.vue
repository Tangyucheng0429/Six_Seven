<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'danger', 'ghost', 'accent'].includes(v),
  },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
})

const variants = {
  primary: 'bg-neo-primary text-neo-ink border-neo-ink',
  secondary: 'bg-neo-surface text-neo-ink border-neo-ink',
  accent: 'bg-neo-accent text-neo-ink border-neo-ink',
  danger: 'bg-neo-danger text-white border-neo-ink',
  ghost: 'bg-transparent text-neo-ink border-neo-ink',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="neo-pressable inline-flex min-h-12 items-center justify-center gap-2 border-3 px-5 py-3 text-sm font-bold uppercase tracking-wide neo-shadow disabled:cursor-not-allowed disabled:opacity-50"
    :class="[variants[variant], block ? 'w-full' : '']"
  >
    <span
      v-if="loading"
      class="inline-block size-4 animate-spin rounded-full border-2 border-neo-ink border-t-transparent"
    />
    <slot />
  </button>
</template>
