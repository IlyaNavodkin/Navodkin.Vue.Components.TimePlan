<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { DateRangeSelection, FlatRow, TimeScaleMode, TimelineBlock, TimelineSummaryBlock } from '../types';
import { isWeekend, isWithinRange, monthEndKey, monthStartKey, toDateKey } from '../utils/date';
import TimelineBar, { drawChargeStepLine } from './TimelineBar.vue';

const props = defineProps<{
  row: FlatRow;
  columns: Date[];
  selection: DateRangeSelection | null;
  blocks: TimelineBlock[];
  summaryBlocks?: TimelineSummaryBlock[];
  columnWidth: number;
  scaleMode: TimeScaleMode;
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  (event: 'collapse', rowId: string): void;
  (event: 'row-contextmenu', value: { event: MouseEvent; row: FlatRow }): void;
  (event: 'cell-mousedown', value: { event: MouseEvent; rowId: string; dayKey: string }): void;
  (event: 'cell-mouseenter', value: { event: MouseEvent; rowId: string; dayKey: string }): void;
  (event: 'cell-contextmenu', value: { event: MouseEvent; rowId: string; dayKey: string }): void;
  (event: 'block-mousedown', value: { event: MouseEvent; block: TimelineBlock }): void;
  (event: 'block-contextmenu', value: { event: MouseEvent; block: TimelineBlock }): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const todayKey = toDateKey(new Date());

const cells = computed(() =>
  props.columns.map((column) => {
    const dayKey = props.scaleMode === 'month' ? monthStartKey(column) : toDateKey(column);
    const selected =
      props.selection !== null &&
      props.selection.rowId === props.row.id &&
      (props.scaleMode === 'month'
        ? isWithinRange(monthStartKey(column), props.selection.startKey, props.selection.endKey) ||
          isWithinRange(monthEndKey(column), props.selection.startKey, props.selection.endKey)
        : isWithinRange(dayKey, props.selection.startKey, props.selection.endKey));

    return {
      dayKey,
      selected,
      weekend: props.scaleMode === 'day' && isWeekend(column),
      today: props.scaleMode === 'day' && dayKey === todayKey,
    };
  }),
);

function collapseTitle(): string {
  return props.isCollapsed ? 'Развернуть' : 'Свернуть';
}

function redrawChargeStepLine() {
  if (props.row.kind !== 'charge' || !canvasRef.value) {
    return;
  }

  drawChargeStepLine(canvasRef.value, props.summaryBlocks ?? [], props.columns, props.columnWidth, props.scaleMode);
}

onMounted(redrawChargeStepLine);

watch(
  () => [props.row.kind, props.summaryBlocks, props.columns, props.columnWidth, props.scaleMode],
  () => nextTick(redrawChargeStepLine),
  { deep: true },
);
</script>

<template>
  <div
    class="grid-row"
    :class="`${row.kind}-row`"
    :data-row-id="row.id"
    :data-row-kind="row.kind"
  >
    <div
      class="sticky-cell row-label"
      :class="`depth-${row.depth}`"
      :data-row-label-id="row.id"
      @contextmenu="emit('row-contextmenu', { event: $event, row })"
    >
      <span
        v-if="row.kind === 'employee'"
        class="spacer"
      ></span>
      <button
        v-else
        class="collapse-btn"
        :data-row-id="row.id"
        :title="collapseTitle()"
        @click.stop="emit('collapse', row.id)"
      >
        {{ isCollapsed ? '▸' : '▾' }}
      </button>
      <span class="row-title">{{ row.label }}</span>
    </div>
    <div
      class="timeline-row"
      :data-row-id="row.id"
      :data-row-kind="row.kind"
    >
      <div
        class="day-cells"
        :class="{ 'month-cells': scaleMode === 'month' }"
      >
        <div
          v-for="cell in cells"
          :key="cell.dayKey"
          class="day-cell"
          :class="{ 'is-selected': cell.selected, 'is-weekend': cell.weekend, 'is-today': cell.today }"
          :data-row-id="row.id"
          :data-day-key="cell.dayKey"
          @mousedown="emit('cell-mousedown', { event: $event, rowId: row.id, dayKey: cell.dayKey })"
          @mouseenter="emit('cell-mouseenter', { event: $event, rowId: row.id, dayKey: cell.dayKey })"
          @contextmenu="emit('cell-contextmenu', { event: $event, rowId: row.id, dayKey: cell.dayKey })"
        ></div>
      </div>
      <div class="bars-layer">
        <TimelineBar
          v-for="block in row.kind === 'employee' ? blocks : []"
          :key="block.id"
          :block="block"
          :columns="columns"
          :column-width="columnWidth"
          :scale-mode="scaleMode"
          @block-mousedown="emit('block-mousedown', $event)"
          @block-contextmenu="emit('block-contextmenu', $event)"
        />
        <canvas
          v-if="row.kind === 'charge'"
          ref="canvasRef"
          class="charge-step-line"
          :data-charge-id="row.id"
          aria-hidden="true"
        ></canvas>
      </div>
    </div>
  </div>
</template>
