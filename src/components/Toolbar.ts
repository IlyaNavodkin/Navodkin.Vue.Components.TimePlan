import type { ZoomPresetId } from '../types';
import { ZOOM_PRESETS } from '../composables/useTimelineWindow';
import { escapeHtml } from '../utils/html';

export function Toolbar(activeZoom: ZoomPresetId, selectedYear: number, yearOptions: number[]): string {
  return `
    <header class="toolbar">
      <div class="title-wrap">
        <h1>Командный планировщик</h1>
      </div>
      <div class="toolbar-actions">
        ${YearSelect(selectedYear, yearOptions)}
        ${ZoomControls(activeZoom)}
        <button class="toolbar-btn" data-action="center-today" title="Сегодня">Сегодня</button>
      </div>
    </header>
  `;
}

function YearSelect(selectedYear: number, yearOptions: number[]): string {
  return `
    <label class="year-select-label">
      <span>Год</span>
      <select class="year-select" data-action="select-year">
        ${yearOptions
          .map((year) => `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`)
          .join('')}
      </select>
    </label>
  `;
}

function ZoomControls(activeZoom: ZoomPresetId): string {
  return (Object.keys(ZOOM_PRESETS) as ZoomPresetId[])
    .map((id) => {
      const activeClass = id === activeZoom ? 'active' : '';
      return `<button class="toolbar-btn ${activeClass}" data-zoom-id="${id}">${escapeHtml(ZOOM_PRESETS[id].label)}</button>`;
    })
    .join('');
}
