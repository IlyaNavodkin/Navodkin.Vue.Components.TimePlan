<script setup lang="ts">
import type { DateRangeSelection, TimeScaleMode } from '../types';
import { formatMonth, isWeekend, isWithinRange, toDateKey } from '../utils/date';

defineProps<{
  columns: Date[];
  selection: DateRangeSelection | null;
  scaleMode: TimeScaleMode;
  focusedDayKey: string | null;
}>();

const emit = defineEmits<{
  (event: 'day-click', dayKey: string): void;
}>();

const todayKey = toDateKey(new Date());

function monthChunks(days: Date[]): Array<{ label: string; span: number }> {
  const chunks: Array<{ label: string; span: number }> = [];

  for (const day of days) {
    const label = formatMonth(day);
    const current = chunks.at(-1);
    if (current?.label === label) {
      current.span += 1;
    } else {
      chunks.push({ label, span: 1 });
    }
  }

  return chunks;
}

function dayClass(day: Date, selection: DateRangeSelection | null, focusedDayKey: string | null) {
  const dayKey = toDateKey(day);
  return {
    'is-selected': selection !== null && isWithinRange(dayKey, selection.startKey, selection.endKey),
    'is-weekend': isWeekend(day),
    'is-today': dayKey === todayKey,
    'is-focused-date': focusedDayKey === dayKey,
  };
}

function weekday(day: Date): string {
  return day.toLocaleDateString('ru-RU', { weekday: 'short' });
}
</script>

<template>
  <div
    v-if="scaleMode === 'month'"
    class="timeline-header month-scale-header"
  >
    <div class="month-scale-row">
      <div
        v-for="month in columns"
        :key="toDateKey(month)"
        class="month-scale-cell"
      >
        {{ formatMonth(month) }}
      </div>
    </div>
  </div>
  <div
    v-else
    class="timeline-header"
  >
    <div class="month-header-row">
      <div
        v-for="chunk in monthChunks(columns)"
        :key="chunk.label"
        class="month-cell"
        :style="{ gridColumn: `span ${chunk.span}` }"
      >
        {{ chunk.label }}
      </div>
    </div>
    <div class="day-header-row">
      <div
        v-for="day in columns"
        :key="toDateKey(day)"
        class="day-header-cell"
        :class="dayClass(day, selection, focusedDayKey)"
        :data-day-key="toDateKey(day)"
        @click="emit('day-click', toDateKey(day))"
      >
        <span class="day-weekday">{{ weekday(day) }}</span>
        <span class="day-number">{{ day.getDate() }}</span>
      </div>
    </div>
  </div>
</template>
