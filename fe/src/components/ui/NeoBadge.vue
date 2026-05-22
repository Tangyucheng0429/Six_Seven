<script setup>
defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'success', 'warning', 'danger', 'ink'].includes(v),
  },
})

const variants = {
  default: 'bg-neo-muted text-neo-ink',
  success: 'bg-neo-success text-neo-ink',
  warning: 'bg-neo-primary text-neo-ink',
  danger: 'bg-neo-danger text-white',
  ink: 'bg-neo-ink text-neo-primary',
}
</script>

<template>
  <span
    class="inline-block border-2 border-neo-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
    :class="variants[variant]"
  >
    <slot />
  </span>
</template>
