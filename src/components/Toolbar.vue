<script setup lang="ts">
import type { ZoomPresetId } from '../types';
import { ZOOM_PRESETS } from '../composables/useTimelineWindow';

defineProps<{
  activeZoom: ZoomPresetId;
  selectedYear: number;
  yearOptions: number[];
}>();

const emit = defineEmits<{
  (event: 'zoom-change', value: ZoomPresetId): void;
  (event: 'year-change', value: number): void;
  (event: 'center-today'): void;
}>();

const zoomIds = Object.keys(ZOOM_PRESETS) as ZoomPresetId[];
</script>

<template>
  <header class="toolbar">
    <div class="title-wrap">
      <h1>Командный планировщик</h1>
    </div>
    <div class="toolbar-actions">
      <label class="year-select-label">
        <span>Год</span>
        <select
          class="year-select"
          data-action="select-year"
          :value="selectedYear"
          @change="emit('year-change', Number(($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="year in yearOptions"
            :key="year"
            :value="year"
          >
            {{ year }}
          </option>
        </select>
      </label>
      <button
        v-for="id in zoomIds"
        :key="id"
        class="toolbar-btn"
        :class="{ active: id === activeZoom }"
        :data-zoom-id="id"
        @click="emit('zoom-change', id)"
      >
        {{ ZOOM_PRESETS[id].label }}
      </button>
      <button
        class="toolbar-btn"
        data-action="center-today"
        title="Сегодня"
        @click="emit('center-today')"
      >
        Сегодня
      </button>
    </div>
  </header>
</template>
