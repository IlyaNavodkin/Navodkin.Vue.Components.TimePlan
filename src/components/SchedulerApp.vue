<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { sampleProjects, createSampleBlocks } from '../data/sampleData';
import type { ContextMenuItem, DragMode, DragPreview, FlatRow, TimelineBlock, ZoomPresetId } from '../types';
import { fromDateKey, isDateKey, shiftDateKey, startOfDay, toDateKey } from '../utils/date';
import { useContextMenu } from '../composables/useContextMenu';
import { useDragResize } from '../composables/useDragResize';
import { usePagination } from '../composables/usePagination';
import { useSchedulerData } from '../composables/useSchedulerData';
import { useSelection } from '../composables/useSelection';
import { useTimelineWindow } from '../composables/useTimelineWindow';
import { useToasts } from '../composables/useToasts';
import ContextMenu from './ContextMenu.vue';
import Paginator from './Paginator.vue';
import SchedulerRow from './SchedulerRow.vue';
import TimelineHeader from './TimelineHeader.vue';
import Toasts from './Toasts.vue';
import Toolbar from './Toolbar.vue';
import { getBlockGeometry } from './TimelineBar.vue';

const LEFT_COLUMN_WIDTH = 330;

const today = startOfDay(new Date());
const todayKey = toDateKey(today);
const scheduler = useSchedulerData(sampleProjects, createSampleBlocks(todayKey, shiftDateKey));
const timelineWindow = useTimelineWindow(today);
const selection = useSelection();
const contextMenu = useContextMenu();
const dragResize = useDragResize(() => timelineWindow.getDayWidth());
const pagination = usePagination(10);
const renderTick = ref(0);
const gridScroll = ref<HTMLDivElement | null>(null);
const focusedDayKey = ref<string | null>(null);

let lastScrollLeft = 0;
let visualDragBar: HTMLDivElement | null = null;
let visualDragOrigin: { left: string; width: string; display: string } | null = null;
let pendingDragPreview: DragPreview | null = null;
let dragPreviewFrame = 0;
let selectionPreviewFrame = 0;
let scrollFrame = 0;

const toasts = useToasts(() => {
  if (!dragResize.get() && !selection.getDrag()) {
    refresh();
  }
});

const columns = computed(() => {
  renderTick.value;
  return timelineWindow.getColumns();
});

const dayWidth = computed(() => {
  renderTick.value;
  return timelineWindow.getDayWidth();
});

const scaleMode = computed(() => {
  renderTick.value;
  return timelineWindow.getScaleMode();
});

const selectedRange = computed(() => {
  renderTick.value;
  return selection.getNormalized();
});

const currentSelection = computed(() => {
  renderTick.value;
  return selection.get();
});

const projectPage = computed(() => {
  renderTick.value;
  return pagination.getPage(scheduler.projects);
});

const rows = computed(() => {
  const projectIds = projectPage.value.items.map((project) => project.id);
  return scheduler.getVisibleRowsForProjects(projectIds);
});

const currentMenu = computed(() => {
  renderTick.value;
  return contextMenu.get();
});

const currentToasts = computed(() => {
  renderTick.value;
  return toasts.get();
});

const gridStyle = computed(() => ({
  '--left-width': `${LEFT_COLUMN_WIDTH}px`,
  '--day-width': String(dayWidth.value),
  '--days-count': String(columns.value.length),
}));

function refresh(captureCurrentScroll = true) {
  if (captureCurrentScroll) {
    captureScroll();
  }
  renderTick.value += 1;
  void nextTick(restoreScroll);
}

function captureScroll() {
  if (gridScroll.value) {
    lastScrollLeft = gridScroll.value.scrollLeft;
  }
}

function restoreScroll() {
  if (!gridScroll.value) {
    return;
  }
  gridScroll.value.scrollLeft = lastScrollLeft;
}

function onGridScroll(event: Event) {
  lastScrollLeft = (event.currentTarget as HTMLDivElement).scrollLeft;
}

function onZoomChange(zoomId: ZoomPresetId) {
  const centerDate = getViewportCenterDate();
  timelineWindow.setZoom(zoomId);
  refresh();
  scheduleScrollToDate(centerDate);
}

function onCenterToday() {
  timelineWindow.setYear(today.getFullYear());
  refresh();
  scheduleScrollToDate(today);
}

function onYearChange(year: number) {
  if (!Number.isFinite(year)) {
    return;
  }
  timelineWindow.setYear(year);
  lastScrollLeft = 0;
  refresh(false);
}

function onPageChange(page: number) {
  if (!Number.isFinite(page)) {
    return;
  }
  pagination.setPage(page);
  refresh();
}

function onDayClick(dayKey: string) {
  focusedDayKey.value = dayKey;
  refresh();
  scheduleScrollToDate(fromDateKey(dayKey));
}

function onCollapse(rowId: string) {
  scheduler.toggleGroup(rowId);
  pagination.reset();
  contextMenu.close();
  refresh();
}

function onRowContextMenu({ event, row }: { event: MouseEvent; row: FlatRow }) {
  event.preventDefault();
  openRowHeaderContextMenu(event.clientX, event.clientY, row.id);
  refresh();
}

function onCellMouseDown({ event, rowId, dayKey }: { event: MouseEvent; rowId: string; dayKey: string }) {
  if (event.button !== 0 || !isSelectableRow(rowId)) {
    return;
  }
  selection.start(rowId, dayKey);
  contextMenu.close();
  scheduleSelectionPreview();
}

function onCellMouseEnter({ rowId, dayKey }: { event: MouseEvent; rowId: string; dayKey: string }) {
  if (isSelectableRow(rowId) && selection.extend(rowId, dayKey)) {
    scheduleSelectionPreview();
  }
}

function onCellContextMenu({ event, rowId, dayKey }: { event: MouseEvent; rowId: string; dayKey: string }) {
  event.preventDefault();
  if (isSelectableRow(rowId) && (!selection.get() || selection.get()?.rowId !== rowId)) {
    selection.set(rowId, dayKey);
  }
  openTimelineContextMenu(event.clientX, event.clientY, rowId);
  refresh();
}

function onBlockMouseDown({ event, block }: { event: MouseEvent; block: TimelineBlock }) {
  if (event.button !== 0) {
    return;
  }

  const target = event.target as HTMLElement;
  const resize = target.dataset.resize;
  const mode: DragMode = resize === 'left' ? 'resize-left' : resize === 'right' ? 'resize-right' : 'move';

  dragResize.start(mode, block.id, block.employeeId, event.clientX, block.startKey, block.endKey);
  visualDragBar = event.currentTarget as HTMLDivElement | null;
  if (visualDragBar) {
    visualDragOrigin = {
      left: visualDragBar.style.left,
      width: visualDragBar.style.width,
      display: visualDragBar.style.display,
    };
    visualDragBar.classList.add('is-dragging');
  }
  contextMenu.close();
  refresh();
  event.stopPropagation();
}

function onBlockContextMenu({ event, block }: { event: MouseEvent; block: TimelineBlock }) {
  event.preventDefault();
  event.stopPropagation();
  contextMenu.open(event.clientX, event.clientY, barMenuItems(), { blockId: block.id, employeeId: block.employeeId });
  refresh();
}

function openRowHeaderContextMenu(x: number, y: number, rowId: string) {
  const row = scheduler.getVisibleRows().find((candidate) => candidate.id === rowId);
  if (!row) {
    return;
  }

  const items: ContextMenuItem[] = [];
  if (row.kind === 'employee') {
    items.push({ label: 'РЈРґР°Р»РёС‚СЊ СЃРѕС‚СЂСѓРґРЅРёРєР°', action: 'delete-employee', danger: true });
  }
  if (row.kind === 'charge') {
    items.push({ label: 'Р”РѕР±Р°РІРёС‚СЊ СЃРѕС‚СЂСѓРґРЅРёРєР°', action: 'add-employee' });
  }

  if (items.length === 0) {
    items.push({ label: 'РќРµРґРѕСЃС‚СѓРїРЅРѕ РґР»СЏ СЌС‚РѕР№ СЃС‚СЂРѕРєРё', action: 'close-menu' });
  }

  contextMenu.open(x, y, items, { rowId, rowKind: row.kind });
}

function openTimelineContextMenu(x: number, y: number, rowId: string) {
  const row = scheduler.getVisibleRows().find((candidate) => candidate.id === rowId);
  if (!row) {
    return;
  }

  const items: ContextMenuItem[] = [];
  if (row.kind === 'employee') {
    items.push({ label: 'РЎРѕР·РґР°С‚СЊ Р±Р»РѕРє', action: 'create-employee-block' });
    items.push({ label: 'РћС‡РёСЃС‚РёС‚СЊ РІС‹РґРµР»РµРЅРёРµ', action: 'clear-selection' });
  }
  if (items.length === 0) {
    items.push({ label: 'РќРµРґРѕСЃС‚СѓРїРЅРѕ РґР»СЏ СЌС‚РѕР№ СЃС‚СЂРѕРєРё', action: 'close-menu' });
  }

  contextMenu.open(x, y, items, { rowId, rowKind: row.kind });
}

function onContextMenuAction({ action, payload }: { action: string; payload?: Record<string, string> }) {
  runMenuAction(action, payload ?? {});
}

function runMenuAction(action: string, payload: Record<string, string>) {
  if (action === 'create-employee-block') {
    createEmployeeBlock(payload.rowId);
  }
  if (action === 'add-employee') {
    addEmployeeToCharge(payload.rowId);
  }
  if (action === 'delete-employee') {
    deleteEmployee(payload.rowId);
  }
  if (action === 'clear-selection') {
    selection.clear();
    contextMenu.close();
    refresh();
  }
  if (action === 'edit-block') {
    editBlock(payload.employeeId, payload.blockId);
  }
  if (action === 'delete-block') {
    scheduler.deleteBlock(payload.employeeId, payload.blockId);
    contextMenu.close();
    toasts.push('Р‘Р»РѕРє СѓРґР°Р»РµРЅ');
    refresh();
  }
  if (action === 'close-menu') {
    contextMenu.close();
    refresh();
  }
}

function createEmployeeBlock(employeeId: string) {
  const range = selection.getNormalized();
  if (!range || range.rowId !== employeeId) {
    toasts.push('РЎРЅР°С‡Р°Р»Р° РІС‹РґРµР»РёС‚Рµ РґРёР°РїР°Р·РѕРЅ РЅР° СЃС‚СЂРѕРєРµ СЃРѕС‚СЂСѓРґРЅРёРєР°');
    refresh();
    return;
  }

  const title = window.prompt('РќР°Р·РІР°РЅРёРµ Р±Р»РѕРєР°', 'РќРѕРІС‹Р№ Р±Р»РѕРє')?.trim();
  if (!title) {
    contextMenu.close();
    refresh();
    return;
  }
  const block = scheduler.addBlock(employeeId, title, range.startKey, range.endKey);
  if (!block) {
    contextMenu.close();
    toasts.push('Р‘Р»РѕРє РЅРµ РјРѕР¶РµС‚ РїРµСЂРµСЃРµРєР°С‚СЊСЃСЏ СЃ РґСЂСѓРіРёРј Р±Р»РѕРєРѕРј СЃРѕС‚СЂСѓРґРЅРёРєР°');
    refresh();
    return;
  }
  contextMenu.close();
  toasts.push('Р‘Р»РѕРє СЃРѕС…СЂР°РЅРµРЅ');
  refresh();
}

function addEmployeeToCharge(chargeId: string) {
  const employeeName = window.prompt('РРјСЏ СЃРѕС‚СЂСѓРґРЅРёРєР°', '')?.trim();
  if (!employeeName) {
    contextMenu.close();
    refresh();
    return;
  }

  const employee = scheduler.addEmployee(chargeId, employeeName);
  pagination.reset();
  contextMenu.close();
  if (!employee) {
    toasts.push('Р§Р°СЂРґР¶ РЅРµ РЅР°Р№РґРµРЅ');
    refresh();
    return;
  }
  toasts.push('РЎРѕС‚СЂСѓРґРЅРёРє РґРѕР±Р°РІР»РµРЅ');
  refresh();
}

function deleteEmployee(employeeId: string) {
  const confirmed = window.confirm('РЈРґР°Р»РёС‚СЊ СЃРѕС‚СЂСѓРґРЅРёРєР° Рё РІСЃРµ РµРіРѕ С‚Р°Р№РјР»Р°Р№РЅ-Р±Р»РѕРєРё?');
  if (!confirmed) {
    contextMenu.close();
    refresh();
    return;
  }

  const deleted = scheduler.deleteEmployee(employeeId);
  pagination.reset();
  contextMenu.close();
  toasts.push(deleted ? 'РЎРѕС‚СЂСѓРґРЅРёРє СѓРґР°Р»РµРЅ' : 'РЎРѕС‚СЂСѓРґРЅРёРє РЅРµ РЅР°Р№РґРµРЅ');
  refresh();
}

function editBlock(employeeId: string, blockId: string) {
  const block = scheduler.getBlock(employeeId, blockId);
  if (!block) {
    return;
  }

  const title = window.prompt('РќР°Р·РІР°РЅРёРµ Р±Р»РѕРєР°', block.title)?.trim();
  const startKey = window.prompt('Р”Р°С‚Р° РЅР°С‡Р°Р»Р° YYYY-MM-DD', block.startKey)?.trim();
  const endKey = window.prompt('Р”Р°С‚Р° РѕРєРѕРЅС‡Р°РЅРёСЏ YYYY-MM-DD', block.endKey)?.trim();
  if (!title || !startKey || !endKey || !isDateKey(startKey) || !isDateKey(endKey)) {
    contextMenu.close();
    toasts.push('Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РѕС‚РјРµРЅРµРЅРѕ: РЅРµРІРµСЂРЅС‹Рµ РґР°РЅРЅС‹Рµ');
    refresh();
    return;
  }

  const updated = scheduler.updateBlock(employeeId, blockId, { title, startKey, endKey });
  if (!updated) {
    contextMenu.close();
    toasts.push('Р‘Р»РѕРє РЅРµ РјРѕР¶РµС‚ РїРµСЂРµСЃРµРєР°С‚СЊСЃСЏ СЃ РґСЂСѓРіРёРј Р±Р»РѕРєРѕРј СЃРѕС‚СЂСѓРґРЅРёРєР°');
    refresh();
    return;
  }
  contextMenu.close();
  toasts.push('Р‘Р»РѕРє РѕР±РЅРѕРІР»РµРЅ');
  refresh();
}

function onDocumentMouseMove(event: MouseEvent) {
  const preview = dragResize.preview(event.clientX);
  if (!preview) {
    return;
  }
  scheduleDragPreview(preview);
}

function onDocumentMouseUp() {
  const hadSelectionDrag = selection.stop();
  if (hadSelectionDrag) {
    cancelSelectionPreviewFrame();
    refresh();
  }

  const result = dragResize.stop();
  if (!result.hadDrag) {
    return;
  }

  cancelDragPreviewFrame();
  const preview = result.preview;
  const updated = preview
    ? scheduler.updateBlock(preview.employeeId, preview.blockId, {
        startKey: preview.startKey,
        endKey: preview.endKey,
      })
    : true;
  resetVisualDrag(updated);
  if (preview) {
    toasts.push(
      updated
        ? '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b'
        : '\u041f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u0435 \u0441 \u0434\u0440\u0443\u0433\u0438\u043c \u0431\u043b\u043e\u043a\u043e\u043c \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u043e',
    );
  }
  refresh();
}

function onDocumentClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('.context-menu')) {
    return;
  }
  if (contextMenu.get()) {
    contextMenu.close();
    refresh();
  }
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    selection.clear();
    contextMenu.close();
    refresh();
  }
}

function scheduleSelectionPreview() {
  if (selectionPreviewFrame) {
    return;
  }
  selectionPreviewFrame = window.requestAnimationFrame(() => {
    selectionPreviewFrame = 0;
    refresh();
  });
}

function cancelSelectionPreviewFrame() {
  if (!selectionPreviewFrame) {
    return;
  }
  window.cancelAnimationFrame(selectionPreviewFrame);
  selectionPreviewFrame = 0;
}

function scheduleDragPreview(preview: DragPreview) {
  pendingDragPreview = preview;
  if (dragPreviewFrame) {
    return;
  }
  dragPreviewFrame = window.requestAnimationFrame(() => {
    dragPreviewFrame = 0;
    applyDragPreview();
  });
}

function applyDragPreview() {
  if (!visualDragBar || !pendingDragPreview) {
    return;
  }

  const geometry = getBlockGeometry(pendingDragPreview, columns.value, dayWidth.value, scaleMode.value);
  if (!geometry) {
    visualDragBar.style.display = 'none';
    return;
  }

  visualDragBar.style.display = '';
  visualDragBar.style.left = `${geometry.left}px`;
  visualDragBar.style.width = `${geometry.width}px`;
}

function cancelDragPreviewFrame() {
  if (!dragPreviewFrame) {
    return;
  }
  window.cancelAnimationFrame(dragPreviewFrame);
  dragPreviewFrame = 0;
}

function resetVisualDrag(keepPreview: boolean) {
  if (!visualDragBar) {
    pendingDragPreview = null;
    visualDragOrigin = null;
    return;
  }

  visualDragBar.classList.remove('is-dragging');
  if (!keepPreview && visualDragOrigin) {
    visualDragBar.style.left = visualDragOrigin.left;
    visualDragBar.style.width = visualDragOrigin.width;
    visualDragBar.style.display = visualDragOrigin.display;
  } else {
    visualDragBar.style.display = '';
  }
  pendingDragPreview = null;
  visualDragOrigin = null;
  visualDragBar = null;
}

function getViewportCenterDate(): Date {
  const days = columns.value;
  const scroller = gridScroll.value;
  if (!scroller) {
    return days[Math.floor(days.length / 2)];
  }
  const timelineScroll = Math.max(0, scroller.scrollLeft);
  const viewportWidth = Math.max(0, scroller.clientWidth - LEFT_COLUMN_WIDTH);
  const index = Math.max(0, Math.min(days.length - 1, Math.round((timelineScroll + viewportWidth / 2) / dayWidth.value)));
  return days[index];
}

function scrollToDate(date: Date) {
  const scroller = gridScroll.value;
  if (!scroller) {
    return;
  }

  const days = columns.value;
  const targetKey = toDateKey(date);
  const index = days.findIndex((day) => toDateKey(day) === targetKey);
  if (index < 0) {
    return;
  }

  const viewportWidth = Math.max(0, scroller.clientWidth - LEFT_COLUMN_WIDTH);
  lastScrollLeft = Math.max(0, index * dayWidth.value - viewportWidth / 2);
  scroller.scrollLeft = lastScrollLeft;
}

function scheduleScrollToDate(date: Date) {
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame);
  }

  void nextTick(() => {
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      scrollToDate(date);
    });
  });
}

function isSelectableRow(rowId: string): boolean {
  return scheduler.getVisibleRows().some((row) => row.id === rowId && row.kind === 'employee');
}

function barMenuItems(): ContextMenuItem[] {
  return [
    { label: 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ', action: 'edit-block' },
    { label: 'РЈРґР°Р»РёС‚СЊ', action: 'delete-block', danger: true },
  ];
}

function rowBlocks(row: FlatRow): TimelineBlock[] {
  return row.kind === 'employee' ? scheduler.getEmployeeBlocks(row.id) : [];
}

function rowSummaryBlocks(row: FlatRow) {
  return row.kind === 'charge' ? scheduler.getChargeSummaryBlocks(row.id) : [];
}

function attachDocumentEvents() {
  document.addEventListener('mousemove', onDocumentMouseMove);
  document.addEventListener('mouseup', onDocumentMouseUp);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeyDown);
}

function detachDocumentEvents() {
  document.removeEventListener('mousemove', onDocumentMouseMove);
  document.removeEventListener('mouseup', onDocumentMouseUp);
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKeyDown);
}

onMounted(() => {
  attachDocumentEvents();
  restoreScroll();
});

onUnmounted(() => {
  detachDocumentEvents();
  if (selectionPreviewFrame) {
    window.cancelAnimationFrame(selectionPreviewFrame);
  }
  if (dragPreviewFrame) {
    window.cancelAnimationFrame(dragPreviewFrame);
  }
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame);
  }
});
</script>

<template>
  <main class="scheduler-page">
    <Toolbar
      :active-zoom="timelineWindow.getZoomPreset()"
      :selected-year="timelineWindow.getSelectedYear()"
      :year-options="timelineWindow.getYearOptions()"
      @zoom-change="onZoomChange"
      @year-change="onYearChange"
      @center-today="onCenterToday"
    />
    <section class="grid-shell">
      <div
        id="grid-scroll"
        ref="gridScroll"
        class="grid-scroll"
        :style="gridStyle"
        @scroll="onGridScroll"
      >
        <div class="grid-header-row">
          <div class="sticky-cell sticky-header left-header">РџСЂРѕРµРєС‚ / Р§Р°СЂРґР¶ / РЎРѕС‚СЂСѓРґРЅРёРє</div>
          <TimelineHeader
            :columns="columns"
            :selection="selectedRange"
            :scale-mode="scaleMode"
            :focused-day-key="focusedDayKey"
            @day-click="onDayClick"
          />
        </div>
        <SchedulerRow
          v-for="row in rows"
          :key="row.id"
          :row="row"
          :columns="columns"
          :selection="currentSelection"
          :blocks="rowBlocks(row)"
          :summary-blocks="rowSummaryBlocks(row)"
          :column-width="dayWidth"
          :scale-mode="scaleMode"
          :is-collapsed="scheduler.isCollapsed(row)"
          @collapse="onCollapse"
          @row-contextmenu="onRowContextMenu"
          @cell-mousedown="onCellMouseDown"
          @cell-mouseenter="onCellMouseEnter"
          @cell-contextmenu="onCellContextMenu"
          @block-mousedown="onBlockMouseDown"
          @block-contextmenu="onBlockContextMenu"
        />
      </div>
    </section>
    <div class="pagination-shell">
      <Paginator
        :current-page="projectPage.currentPage"
        :page-count="projectPage.pageCount"
        :total-items="projectPage.totalItems"
        :page-size="projectPage.pageSize"
        item-label="РїСЂРѕРµРєС‚РѕРІ"
        @page-change="onPageChange"
      />
    </div>
    <footer class="status-bar">
      <span>{{ timelineWindow.getSelectedYear() }}</span>
      <span>{{ projectPage.totalItems }} РїСЂРѕРµРєС‚РѕРІ</span>
      <span>{{ rows.length }} СЃС‚СЂРѕРє РЅР° СЃС‚СЂР°РЅРёС†Рµ</span>
      <span>{{ scaleMode === 'month' ? `${columns.length} РјРµСЃСЏС†РµРІ` : `${columns.length} РґРЅРµР№` }}</span>
      <span>{{ selectedRange ? `${selectedRange.startKey} - ${selectedRange.endKey}` : 'РґРёР°РїР°Р·РѕРЅ РЅРµ РІС‹Р±СЂР°РЅ' }}</span>
    </footer>
    <Toasts :toasts="currentToasts" />
    <ContextMenu
      :menu="currentMenu"
      @action="onContextMenuAction"
    />
  </main>
</template>
