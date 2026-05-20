<script setup lang="ts">
import type { Toast } from '../types';

defineProps<{
  toasts: Toast[];
}>();
</script>

<template>
  <div class="toasts">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
    >
      {{ toast.message }}
    </div>
  </div>
</template>
