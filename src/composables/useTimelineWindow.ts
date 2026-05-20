import type { TimeScaleMode, ZoomPresetId } from '../types';
import { getYearDays, getYearMonths } from '../utils/date';

export const ZOOM_PRESETS: Record<ZoomPresetId, { label: string; days: number; dayWidth: number }> = {
  week: { label: '1 неделя', days: 7, dayWidth: 112 },
  threeWeeks: { label: '3 недели', days: 21, dayWidth: 44 },
  month: { label: '1 месяц', days: 30, dayWidth: 32 },
};

export function useTimelineWindow(today: Date) {
  let zoomPreset: ZoomPresetId = 'month';
  let selectedYear = today.getFullYear();

  function getDays(): Date[] {
    return getYearDays(selectedYear);
  }

  function getColumns(): Date[] {
    return getScaleMode() === 'month' ? getYearMonths(selectedYear) : getDays();
  }

  function setZoom(nextZoom: ZoomPresetId) {
    zoomPreset = nextZoom;
  }

  function setYear(year: number) {
    selectedYear = year;
  }

  function getZoomPreset(): ZoomPresetId {
    return zoomPreset;
  }

  function getSelectedYear(): number {
    return selectedYear;
  }

  function getDayWidth(): number {
    return ZOOM_PRESETS[zoomPreset].dayWidth;
  }

  function getScaleMode(): TimeScaleMode {
    return 'day';
  }

  function getYearOptions(): number[] {
    return Array.from({ length: 7 }, (_, index) => today.getFullYear() - 3 + index);
  }

  return {
    getDays,
    getColumns,
    setZoom,
    setYear,
    getZoomPreset,
    getSelectedYear,
    getDayWidth,
    getScaleMode,
    getYearOptions,
  };
}

