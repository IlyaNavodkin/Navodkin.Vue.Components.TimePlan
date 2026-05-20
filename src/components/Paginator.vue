<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    currentPage: number;
    pageCount: number;
    totalItems: number;
    pageSize: number;
    itemLabel?: string;
  }>(),
  {
    itemLabel: 'строк',
  },
);

const emit = defineEmits<{
  (event: 'page-change', value: number): void;
}>();

const pages = computed(() => getVisiblePages(props.currentPage, props.pageCount));

function getVisiblePages(currentPage: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pageSet = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pageSet].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];

  for (const page of sorted) {
    const previous = result.at(-1);
    if (typeof previous === 'number' && page - previous > 1) {
      result.push('gap');
    }
    result.push(page);
  }

  return result;
}
</script>

<template>
  <nav class="paginator" aria-label="Пагинация">
    <button
      class="pager-btn"
      :data-page="currentPage - 1"
      :disabled="currentPage <= 1"
      @click="emit('page-change', currentPage - 1)"
    >
      ‹
    </button>
    <template
      v-for="(page, index) in pages"
      :key="`${page}-${index}`"
    >
      <span
        v-if="page === 'gap'"
        class="pager-gap"
      >
        ...
      </span>
      <button
        v-else
        class="pager-btn"
        :class="{ active: page === currentPage }"
        :data-page="page"
        @click="emit('page-change', page)"
      >
        {{ page }}
      </button>
    </template>
    <button
      class="pager-btn"
      :data-page="currentPage + 1"
      :disabled="currentPage >= pageCount"
      @click="emit('page-change', currentPage + 1)"
    >
      ›
    </button>
    <span class="pager-meta">{{ totalItems }} {{ itemLabel }} · по {{ pageSize }}</span>
  </nav>
</template>
