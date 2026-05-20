import type { DateRangeSelection, FlatRow, TimeScaleMode, TimelineBlock } from '../types';
import { isWeekend, isWithinRange, monthEndKey, monthStartKey, toDateKey } from '../utils/date';
import { escapeHtml } from '../utils/html';
import { ChargeStepLineCanvas, TimelineBar } from './TimelineBar';

export function SchedulerRow(
  row: FlatRow,
  columns: Date[],
  selection: DateRangeSelection | null,
  blocks: TimelineBlock[],
  columnWidth: number,
  scaleMode: TimeScaleMode,
  isCollapsed: boolean,
): string {
  return `
    <div class="grid-row ${row.kind}-row" data-row-id="${row.id}" data-row-kind="${row.kind}">
      <div class="sticky-cell row-label depth-${row.depth}" data-row-label-id="${row.id}">
        ${CollapseButton(row, isCollapsed)}
        <span class="row-title">${escapeHtml(row.label)}</span>
      </div>
      <div class="timeline-row" data-row-id="${row.id}" data-row-kind="${row.kind}">
        <div class="day-cells ${scaleMode === 'month' ? 'month-cells' : ''}">${Cells(row.id, columns, selection, scaleMode)}</div>
        <div class="bars-layer">${Bars(row, columns, blocks, columnWidth, scaleMode)}</div>
      </div>
    </div>
  `;
}

function CollapseButton(row: FlatRow, isCollapsed: boolean): string {
  if (row.kind === 'employee') {
    return '<span class="spacer"></span>';
  }
  return `<button class="collapse-btn" data-row-id="${row.id}" title="${isCollapsed ? 'Развернуть' : 'Свернуть'}">${isCollapsed ? '▸' : '▾'}</button>`;
}

function Bars(
  row: FlatRow,
  columns: Date[],
  blocks: TimelineBlock[],
  columnWidth: number,
  scaleMode: TimeScaleMode,
): string {
  if (row.kind === 'employee') {
    return blocks.map((block) => TimelineBar(block, columns, columnWidth, scaleMode)).join('');
  }
  if (row.kind === 'charge') {
    return ChargeStepLineCanvas(row.id);
  }
  return '';
}

function Cells(rowId: string, columns: Date[], selection: DateRangeSelection | null, scaleMode: TimeScaleMode): string {
  const todayKey = toDateKey(new Date());
  return columns
    .map((column) => {
      const columnKey = scaleMode === 'month' ? monthStartKey(column) : toDateKey(column);
      const selected =
        selection !== null &&
        selection.rowId === rowId &&
        (scaleMode === 'month'
          ? isWithinRange(monthStartKey(column), selection.startKey, selection.endKey) ||
            isWithinRange(monthEndKey(column), selection.startKey, selection.endKey)
          : isWithinRange(columnKey, selection.startKey, selection.endKey));
      const weekendClass = scaleMode === 'day' && isWeekend(column) ? 'is-weekend' : '';
      const todayClass = scaleMode === 'day' && columnKey === todayKey ? 'is-today' : '';
      return `<div class="day-cell ${selected ? 'is-selected' : ''} ${weekendClass} ${todayClass}" data-row-id="${rowId}" data-day-key="${columnKey}"></div>`;
    })
    .join('');
}
