<script setup>
import { useRoomStateProvider } from './composables/useRoomState'

useRoomStateProvider()
</script>

<template>
  <RouterView />
</template>
