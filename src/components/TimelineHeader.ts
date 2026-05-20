import type { DateRangeSelection, TimeScaleMode } from '../types';
import { formatMonth, isWeekend, isWithinRange, toDateKey } from '../utils/date';
import { escapeHtml } from '../utils/html';

export function TimelineHeader(
  columns: Date[],
  selection: DateRangeSelection | null,
  scaleMode: TimeScaleMode,
  focusedDayKey: string | null,
): string {
  if (scaleMode === 'month') {
    return `
      <div class="timeline-header month-scale-header">
        <div class="month-scale-row">${MonthScaleHeader(columns)}</div>
      </div>
    `;
  }

  return `
    <div class="timeline-header">
      <div class="month-header-row">${MonthHeader(columns)}</div>
      <div class="day-header-row">${DayHeader(columns, selection, focusedDayKey)}</div>
    </div>
  `;
}

function MonthScaleHeader(months: Date[]): string {
  return months
    .map((month) => `<div class="month-scale-cell">${escapeHtml(formatMonth(month))}</div>`)
    .join('');
}

function MonthHeader(days: Date[]): string {
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

  return chunks
    .map((chunk) => `<div class="month-cell" style="grid-column: span ${chunk.span};">${escapeHtml(chunk.label)}</div>`)
    .join('');
}

function DayHeader(days: Date[], selection: DateRangeSelection | null, focusedDayKey: string | null): string {
  const todayKey = toDateKey(new Date());
  return days
    .map((day) => {
      const dayKey = toDateKey(day);
      const isSelected = selection !== null && isWithinRange(dayKey, selection.startKey, selection.endKey);
      const weekend = isWeekend(day);
      const todayClass = dayKey === todayKey ? 'is-today' : '';
      const focusedClass = focusedDayKey === dayKey ? 'is-focused-date' : '';
      const weekday = day.toLocaleDateString('ru-RU', { weekday: 'short' });
      return `
        <div class="day-header-cell ${isSelected ? 'is-selected' : ''} ${weekend ? 'is-weekend' : ''} ${todayClass} ${focusedClass}" data-day-key="${dayKey}">
          <span class="day-weekday">${escapeHtml(weekday)}</span>
          <span class="day-number">${day.getDate()}</span>
        </div>
      `;
    })
    .join('');
}
