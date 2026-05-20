import type { DateRangeSelection, SelectionDragState } from '../types';
import { normalizeRange } from '../utils/date';

export function useSelection() {
  let selection: DateRangeSelection | null = null;
  let dragState: SelectionDragState | null = null;

  function start(rowId: string, dayKey: string) {
    dragState = { rowId, anchorKey: dayKey };
    selection = { rowId, startKey: dayKey, endKey: dayKey };
  }

  function extend(rowId: string, dayKey: string): boolean {
    if (!dragState || dragState.rowId !== rowId) {
      return false;
    }
    selection = { rowId, startKey: dragState.anchorKey, endKey: dayKey };
    return true;
  }

  function set(rowId: string, dayKey: string) {
    selection = { rowId, startKey: dayKey, endKey: dayKey };
  }

  function stop(): boolean {
    const hadDrag = dragState !== null;
    dragState = null;
    return hadDrag;
  }

  function clear() {
    selection = null;
    dragState = null;
  }

  function getNormalized(): DateRangeSelection | null {
    if (!selection) {
      return null;
    }
    const range = normalizeRange(selection.startKey, selection.endKey);
    return { rowId: selection.rowId, startKey: range.startKey, endKey: range.endKey };
  }

  return {
    start,
    extend,
    set,
    stop,
    clear,
    get: () => selection,
    getDrag: () => dragState,
    getNormalized,
  };
}
