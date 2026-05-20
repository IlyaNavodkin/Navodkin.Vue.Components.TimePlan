import { sampleProjects, createSampleBlocks } from '../data/sampleData';
import type { ContextMenuItem, DateRangeSelection, DragMode, DragPreview, ZoomPresetId } from '../types';
import { fromDateKey, isDateKey, shiftDateKey, startOfDay, toDateKey } from '../utils/date';
import { useContextMenu } from '../composables/useContextMenu';
import { useDragResize } from '../composables/useDragResize';
import { usePagination } from '../composables/usePagination';
import { useSchedulerData } from '../composables/useSchedulerData';
import { useSelection } from '../composables/useSelection';
import { useTimelineWindow } from '../composables/useTimelineWindow';
import { useToasts } from '../composables/useToasts';
import { ContextMenu } from './ContextMenu';
import { Paginator } from './Paginator';
import { SchedulerRow } from './SchedulerRow';
import { drawChargeStepLine, getBlockGeometry } from './TimelineBar';
import { TimelineHeader } from './TimelineHeader';
import { Toasts } from './Toasts';
import { Toolbar } from './Toolbar';

const LEFT_COLUMN_WIDTH = 330;

export function mountSchedulerApp(root: HTMLElement) {
  const today = startOfDay(new Date());
  const todayKey = toDateKey(today);
  const scheduler = useSchedulerData(sampleProjects, createSampleBlocks(todayKey, shiftDateKey));
  const timelineWindow = useTimelineWindow(today);
  const selection = useSelection();
  const contextMenu = useContextMenu();
  const dragResize = useDragResize(() => timelineWindow.getDayWidth());
  const pagination = usePagination(10);
  const toasts = useToasts(() => {
    if (!dragResize.get() && !selection.getDrag()) {
      render();
    }
  });

  let lastScrollLeft = 0;
  let visualDragBar: HTMLDivElement | null = null;
  let visualDragOrigin: { left: string; width: string; display: string } | null = null;
  let pendingDragPreview: DragPreview | null = null;
  let dragPreviewFrame = 0;
  let visualSelectionRowId: string | null = null;
  let selectionPreviewFrame = 0;
  let scrollFrame = 0;
  let focusedDayKey: string | null = null;

  function render() {
    const scroller = root.querySelector<HTMLDivElement>('#grid-scroll');
    if (scroller) {
      lastScrollLeft = scroller.scrollLeft;
    }

    const projectPage = pagination.getPage(scheduler.projects);
    const projectIds = projectPage.items.map((project) => project.id);
    const rows = scheduler.getVisibleRowsForProjects(projectIds);
    const columns = timelineWindow.getColumns();
    const dayWidth = timelineWindow.getDayWidth();
    const scaleMode = timelineWindow.getScaleMode();
    const currentSelection = selection.get();
    const selectedRange = selection.getNormalized();

    root.innerHTML = `
      <main class="scheduler-page">
        ${Toolbar(timelineWindow.getZoomPreset(), timelineWindow.getSelectedYear(), timelineWindow.getYearOptions())}
        <section class="grid-shell">
          <div class="grid-scroll" id="grid-scroll" style="--left-width:${LEFT_COLUMN_WIDTH}px;--day-width:${dayWidth};--days-count:${columns.length};">
            <div class="grid-header-row">
              <div class="sticky-cell sticky-header left-header">Проект / Чардж / Сотрудник</div>
              ${TimelineHeader(columns, selectedRange, scaleMode, focusedDayKey)}
            </div>
            ${rows
              .map((row) =>
                SchedulerRow(
                  row,
                  columns,
                  currentSelection,
                  scheduler.getEmployeeBlocks(row.id),
                  dayWidth,
                  scaleMode,
                  scheduler.isCollapsed(row),
                ),
              )
              .join('')}
          </div>
        </section>
        <div class="pagination-shell">
          ${Paginator(projectPage.currentPage, projectPage.pageCount, projectPage.totalItems, projectPage.pageSize, 'проектов')}
        </div>
        <footer class="status-bar">
          <span>${timelineWindow.getSelectedYear()}</span>
          <span>${projectPage.totalItems} проектов</span>
          <span>${rows.length} строк на странице</span>
          <span>${scaleMode === 'month' ? `${columns.length} месяцев` : `${columns.length} дней`}</span>
          <span>${selectedRange ? `${selectedRange.startKey} - ${selectedRange.endKey}` : 'диапазон не выбран'}</span>
        </footer>
        ${Toasts(toasts.get())}
        ${ContextMenu(contextMenu.get())}
      </main>
    `;

    bindEvents();
    restoreScroll();
    renderAllChargeStepLines(rows);
  }

  function bindEvents() {
    root.querySelector<HTMLDivElement>('#grid-scroll')?.addEventListener('scroll', (event) => {
      lastScrollLeft = (event.currentTarget as HTMLDivElement).scrollLeft;
    });

    root.querySelectorAll<HTMLButtonElement>('[data-zoom-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const zoomId = button.dataset.zoomId as ZoomPresetId | undefined;
        if (!zoomId) {
          return;
        }
        const centerDate = getViewportCenterDate();
        timelineWindow.setZoom(zoomId);
        render();
        scheduleScrollToDate(centerDate);
      });
    });

    root.querySelector<HTMLButtonElement>('[data-action="center-today"]')?.addEventListener('click', () => {
      timelineWindow.setYear(today.getFullYear());
      render();
      scheduleScrollToDate(today);
    });

    root.querySelector<HTMLSelectElement>('[data-action="select-year"]')?.addEventListener('change', (event) => {
      const year = Number.parseInt((event.currentTarget as HTMLSelectElement).value, 10);
      if (!Number.isFinite(year)) {
        return;
      }
      timelineWindow.setYear(year);
      lastScrollLeft = 0;
      render();
    });

    root.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        const page = Number.parseInt(button.dataset.page ?? '', 10);
        if (!Number.isFinite(page)) {
          return;
        }
        pagination.setPage(page);
        render();
      });
    });

    root.querySelectorAll<HTMLDivElement>('.day-header-cell[data-day-key]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const dayKey = cell.dataset.dayKey;
        if (!dayKey) {
          return;
        }
        focusedDayKey = dayKey;
        applyFocusedHeaderDate();
        scheduleScrollToDate(fromDateKey(dayKey));
      });
    });

    root.querySelectorAll<HTMLButtonElement>('.collapse-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const rowId = button.dataset.rowId;
        if (!rowId) {
          return;
        }
        scheduler.toggleGroup(rowId);
        pagination.reset();
        contextMenu.close();
        render();
      });
    });

    root.querySelectorAll<HTMLDivElement>('.row-label').forEach((label) => {
      label.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const rowId = label.dataset.rowLabelId;
        if (!rowId) {
          return;
        }
        openRowHeaderContextMenu(event.clientX, event.clientY, rowId);
        renderContextMenuView();
      });
    });

    root.querySelectorAll<HTMLDivElement>('.employee-row .day-cell').forEach((cell) => {
      cell.addEventListener('mousedown', (event) => {
        if (event.button !== 0) {
          return;
        }
        const point = readCellPoint(cell);
        if (!point) {
          return;
        }
        if (!isSelectableCell(cell)) {
          return;
        }
        selection.start(point.rowId, point.dayKey);
        contextMenu.close();
        removeContextMenuView();
        scheduleSelectionPreview();
      });

      cell.addEventListener('mouseenter', () => {
        const point = readCellPoint(cell);
        if (point && isSelectableCell(cell) && selection.extend(point.rowId, point.dayKey)) {
          scheduleSelectionPreview();
        }
      });

      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const point = readCellPoint(cell);
        if (!point) {
          return;
        }
        if (isSelectableRow(point.rowId) && (!selection.get() || selection.get()?.rowId !== point.rowId)) {
          selection.set(point.rowId, point.dayKey);
        }
        openTimelineContextMenu(event.clientX, event.clientY, point.rowId);
        applySelectionPreview();
        renderContextMenuView();
      });
    });

    root.querySelectorAll<HTMLDivElement>('.timeline-bar').forEach((bar) => {
      bar.addEventListener('mousedown', (event) => {
        if (event.button !== 0) {
          return;
        }
        const blockRef = readBlockRef(bar);
        const block = blockRef ? scheduler.getBlock(blockRef.employeeId, blockRef.blockId) : null;
        if (!blockRef || !block) {
          return;
        }

        const target = event.target as HTMLElement;
        const resize = target.dataset.resize;
        const mode: DragMode = resize === 'left' ? 'resize-left' : resize === 'right' ? 'resize-right' : 'move';
        dragResize.start(mode, block.id, block.employeeId, event.clientX, block.startKey, block.endKey);
        visualDragBar = bar;
        visualDragOrigin = {
          left: bar.style.left,
          width: bar.style.width,
          display: bar.style.display,
        };
        visualDragBar.classList.add('is-dragging');
        contextMenu.close();
        removeContextMenuView();
        event.stopPropagation();
      });

      bar.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const blockRef = readBlockRef(bar);
        if (!blockRef) {
          return;
        }
        contextMenu.open(event.clientX, event.clientY, barMenuItems(), blockRef);
        renderContextMenuView();
      });
    });

    bindContextMenuEvents();
  }

  function openRowHeaderContextMenu(x: number, y: number, rowId: string) {
    const row = scheduler.getVisibleRows().find((candidate) => candidate.id === rowId);
    if (!row) {
      return;
    }

    const items: ContextMenuItem[] = [];
    if (row.kind === 'employee') {
      items.push({ label: 'Удалить сотрудника', action: 'delete-employee', danger: true });
    }
    if (row.kind === 'charge') {
      items.push({ label: 'Добавить сотрудника', action: 'add-employee' });
    }

    if (items.length === 0) {
      items.push({ label: 'Недоступно для этой строки', action: 'close-menu' });
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
      items.push({ label: 'Создать блок', action: 'create-employee-block' });
      items.push({ label: 'Очистить выделение', action: 'clear-selection' });
    }
    if (items.length === 0) {
      items.push({ label: 'Недоступно для этой строки', action: 'close-menu' });
    }

    contextMenu.open(x, y, items, { rowId, rowKind: row.kind });
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
      render();
    }
    if (action === 'edit-block') {
      editBlock(payload.employeeId, payload.blockId);
    }
    if (action === 'delete-block') {
      scheduler.deleteBlock(payload.employeeId, payload.blockId);
      contextMenu.close();
      toasts.push('Блок удален');
      render();
    }
    if (action === 'close-menu') {
      contextMenu.close();
      render();
    }
  }

  function createEmployeeBlock(employeeId: string) {
    const range = selection.getNormalized();
    if (!range || range.rowId !== employeeId) {
      toasts.push('Сначала выделите диапазон на строке сотрудника');
      return;
    }

    const title = window.prompt('Название блока', 'Новый блок')?.trim();
    if (!title) {
      contextMenu.close();
      render();
      return;
    }
    const block = scheduler.addBlock(employeeId, title, range.startKey, range.endKey);
    if (!block) {
      contextMenu.close();
      toasts.push('Блок не может пересекаться с другим блоком сотрудника');
      render();
      return;
    }
    contextMenu.close();
    toasts.push('Блок сохранен');
    render();
  }

  function addEmployeeToCharge(chargeId: string) {
    const employeeName = window.prompt('Имя сотрудника', '')?.trim();
    if (!employeeName) {
      contextMenu.close();
      render();
      return;
    }

    const employee = scheduler.addEmployee(chargeId, employeeName);
    pagination.reset();
    contextMenu.close();
    if (!employee) {
      toasts.push('Чардж не найден');
      render();
      return;
    }
    toasts.push('Сотрудник добавлен');
    render();
  }

  function deleteEmployee(employeeId: string) {
    const confirmed = window.confirm('Удалить сотрудника и все его таймлайн-блоки?');
    if (!confirmed) {
      contextMenu.close();
      render();
      return;
    }

    const deleted = scheduler.deleteEmployee(employeeId);
    pagination.reset();
    contextMenu.close();
    toasts.push(deleted ? 'Сотрудник удален' : 'Сотрудник не найден');
    render();
  }

  function editBlock(employeeId: string, blockId: string) {
    const block = scheduler.getBlock(employeeId, blockId);
    if (!block) {
      return;
    }

    const title = window.prompt('Название блока', block.title)?.trim();
    const startKey = window.prompt('Дата начала YYYY-MM-DD', block.startKey)?.trim();
    const endKey = window.prompt('Дата окончания YYYY-MM-DD', block.endKey)?.trim();
    if (!title || !startKey || !endKey || !isDateKey(startKey) || !isDateKey(endKey)) {
      contextMenu.close();
      toasts.push('Редактирование отменено: неверные данные');
      render();
      return;
    }

    const updated = scheduler.updateBlock(employeeId, blockId, { title, startKey, endKey });
    if (!updated) {
      contextMenu.close();
      toasts.push('Блок не может пересекаться с другим блоком сотрудника');
      render();
      return;
    }
    contextMenu.close();
    toasts.push('Блок обновлен');
    render();
  }

  function attachDocumentEvents() {
    document.addEventListener('mousemove', (event) => {
      const preview = dragResize.preview(event.clientX);
      if (!preview) {
        return;
      }
      scheduleDragPreview(preview);
    });

    document.addEventListener('mouseup', () => {
      const hadSelectionDrag = selection.stop();
      if (hadSelectionDrag) {
        cancelSelectionPreviewFrame();
      }
      const result = dragResize.stop();
      if (result.hadDrag) {
        cancelDragPreviewFrame();
        const preview = result.preview;
        const updated = result.preview
          ? scheduler.updateBlock(result.preview.employeeId, result.preview.blockId, {
              startKey: result.preview.startKey,
              endKey: result.preview.endKey,
            })
          : true;
        resetVisualDrag(updated);
        if (preview && updated) {
          renderChargeSummaryForEmployee(preview.employeeId);
        }
        if (preview) {
          toasts.push(
            updated
              ? '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b'
              : '\u041f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u0435 \u0441 \u0434\u0440\u0443\u0433\u0438\u043c \u0431\u043b\u043e\u043a\u043e\u043c \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u043e',
          );
          renderToastsView();
        }
        return;
      }
    });

    document.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('.context-menu')) {
        return;
      }
      if (contextMenu.get()) {
        contextMenu.close();
        removeContextMenuView();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        selection.clear();
        contextMenu.close();
        render();
      }
    });
  }

  function restoreScroll() {
    const scroller = root.querySelector<HTMLDivElement>('#grid-scroll');
    if (!scroller) {
      return;
    }
    scroller.scrollLeft = lastScrollLeft;
  }

  function scheduleSelectionPreview() {
    if (selectionPreviewFrame) {
      return;
    }
    selectionPreviewFrame = window.requestAnimationFrame(() => {
      selectionPreviewFrame = 0;
      applySelectionPreview();
    });
  }

  function applySelectionPreview() {
    const range = selection.getNormalized();
    if (visualSelectionRowId && visualSelectionRowId !== range?.rowId) {
      clearSelectionRow(visualSelectionRowId);
    }

    updateHeaderSelection(range);
    if (!range) {
      visualSelectionRowId = null;
      return;
    }

    visualSelectionRowId = range.rowId;
    getRowCells(range.rowId).forEach((cell) => {
      const dayKey = cell.dataset.dayKey;
      cell.classList.toggle('is-selected', Boolean(dayKey && dayKey >= range.startKey && dayKey <= range.endKey));
    });
  }

  function cancelSelectionPreviewFrame() {
    if (!selectionPreviewFrame) {
      return;
    }
    window.cancelAnimationFrame(selectionPreviewFrame);
    selectionPreviewFrame = 0;
    applySelectionPreview();
  }

  function clearSelectionRow(rowId: string) {
    getRowCells(rowId).forEach((cell) => {
      cell.classList.remove('is-selected');
    });
  }

  function getRowCells(rowId: string): NodeListOf<HTMLDivElement> {
    return root.querySelectorAll<HTMLDivElement>(`.timeline-row[data-row-id="${rowId}"] .day-cell`);
  }

  function updateHeaderSelection(range: DateRangeSelection | null) {
    root.querySelectorAll<HTMLDivElement>('.day-header-cell[data-day-key]').forEach((cell) => {
      const dayKey = cell.dataset.dayKey;
      cell.classList.toggle('is-selected', Boolean(range && dayKey && dayKey >= range.startKey && dayKey <= range.endKey));
    });
    applyFocusedHeaderDate();
  }

  function applyFocusedHeaderDate() {
    root.querySelectorAll<HTMLDivElement>('.day-header-cell[data-day-key]').forEach((cell) => {
      cell.classList.toggle('is-focused-date', Boolean(focusedDayKey && cell.dataset.dayKey === focusedDayKey));
    });
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

    const geometry = getBlockGeometry(pendingDragPreview, timelineWindow.getColumns(), timelineWindow.getDayWidth(), timelineWindow.getScaleMode());
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

  function renderChargeSummaryForEmployee(employeeId: string) {
    const chargeRow = findChargeRowForEmployee(employeeId);
    const chargeId = chargeRow?.dataset.rowId;
    if (!chargeId) {
      return;
    }
    renderChargeStepLine(chargeId);
  }

  function findChargeRowForEmployee(employeeId: string): HTMLElement | null {
    let row = root.querySelector<HTMLElement>(`.grid-row[data-row-id="${employeeId}"]`)?.previousElementSibling;
    while (row instanceof HTMLElement) {
      if (row.dataset.rowKind === 'charge') {
        return row;
      }
      row = row.previousElementSibling;
    }
    return null;
  }

  function renderToastsView() {
    root.querySelector('.toasts')?.remove();
    const page = root.querySelector<HTMLElement>('.scheduler-page');
    if (!page) {
      return;
    }
    page.insertAdjacentHTML('beforeend', Toasts(toasts.get()));
  }

  function renderContextMenuView() {
    removeContextMenuView();
    const menu = contextMenu.get();
    const page = root.querySelector<HTMLElement>('.scheduler-page');
    if (!menu || !page) {
      return;
    }

    page.insertAdjacentHTML('beforeend', ContextMenu(menu));
    bindContextMenuEvents();
  }

  function renderAllChargeStepLines(rows: ReturnType<typeof scheduler.getVisibleRowsForProjects>) {
    for (const row of rows) {
      if (row.kind !== 'charge') {
        continue;
      }
      renderChargeStepLine(row.id);
    }
  }

  function renderChargeStepLine(chargeId: string) {
    const canvas = root.querySelector<HTMLCanvasElement>(`.charge-step-line[data-charge-id="${chargeId}"]`);
    if (!canvas) {
      return;
    }

    drawChargeStepLine(
      canvas,
      scheduler.getChargeSummaryBlocks(chargeId),
      timelineWindow.getColumns(),
      timelineWindow.getDayWidth(),
      timelineWindow.getScaleMode(),
    );
  }

  function removeContextMenuView() {
    root.querySelector('.context-menu')?.remove();
  }

  function bindContextMenuEvents() {
    root.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number.parseInt(button.dataset.menuIndex ?? '', 10);
        const menu = contextMenu.get();
        const item = Number.isFinite(index) ? menu?.items[index] : null;
        if (!menu || !item) {
          return;
        }
        runMenuAction(item.action, menu.payload ?? {});
      });
    });
  }

  function getViewportCenterDate(): Date {
    const days = timelineWindow.getColumns();
    const scroller = root.querySelector<HTMLDivElement>('#grid-scroll');
    if (!scroller) {
      return days[Math.floor(days.length / 2)];
    }
    const timelineScroll = Math.max(0, scroller.scrollLeft);
    const viewportWidth = Math.max(0, scroller.clientWidth - LEFT_COLUMN_WIDTH);
    const index = Math.max(0, Math.min(days.length - 1, Math.round((timelineScroll + viewportWidth / 2) / timelineWindow.getDayWidth())));
    return days[index];
  }

  function scrollToDate(date: Date) {
    const scroller = root.querySelector<HTMLDivElement>('#grid-scroll');
    if (!scroller) {
      return;
    }

    const days = timelineWindow.getColumns();
    const targetKey = toDateKey(date);
    const index = days.findIndex((day) => toDateKey(day) === targetKey);
    if (index < 0) {
      return;
    }

    const viewportWidth = Math.max(0, scroller.clientWidth - LEFT_COLUMN_WIDTH);
    lastScrollLeft = Math.max(0, index * timelineWindow.getDayWidth() - viewportWidth / 2);
    scroller.scrollLeft = lastScrollLeft;
  }

  function scheduleScrollToDate(date: Date) {
    if (scrollFrame) {
      window.cancelAnimationFrame(scrollFrame);
    }

    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      scrollToDate(date);
    });
  }

  function isSelectableRow(rowId: string): boolean {
    return scheduler.getVisibleRows().some((row) => row.id === rowId && row.kind === 'employee');
  }

  function isSelectableCell(cell: HTMLElement): boolean {
    return cell.closest<HTMLElement>('.grid-row')?.dataset.rowKind === 'employee';
  }

  function readCellPoint(cell: HTMLElement): { rowId: string; dayKey: string } | null {
    const rowId = cell.dataset.rowId;
    const dayKey = cell.dataset.dayKey;
    return rowId && dayKey ? { rowId, dayKey } : null;
  }

  function readBlockRef(bar: HTMLElement): { blockId: string; employeeId: string } | null {
    const blockId = bar.dataset.blockId;
    const employeeId = bar.dataset.employeeId;
    return blockId && employeeId ? { blockId, employeeId } : null;
  }

  function barMenuItems(): ContextMenuItem[] {
    return [
      { label: 'Редактировать', action: 'edit-block' },
      { label: 'Удалить', action: 'delete-block', danger: true },
    ];
  }

  attachDocumentEvents();
  render();
}
