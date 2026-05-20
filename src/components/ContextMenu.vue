<script setup lang="ts">
import type { ContextMenuItem, ContextMenuState } from '../types';

defineProps<{
  menu: ContextMenuState | null;
}>();

const emit = defineEmits<{
  (event: 'action', value: { action: string; payload?: Record<string, string> }): void;
}>();

function selectItem(item: ContextMenuItem, payload?: Record<string, string>) {
  emit('action', { action: item.action, payload });
}
</script>

<template>
  <div
    v-if="menu"
    class="context-menu"
    :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
  >
    <button
      v-for="(item, index) in menu.items"
      :key="`${item.action}-${index}`"
      class="menu-item"
      :class="{ danger: item.danger }"
      :data-menu-index="index"
      @click="selectItem(item, menu.payload)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
