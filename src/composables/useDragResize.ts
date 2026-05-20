import type { DragMode, DragPreview, DragState, DragStopResult } from '../types';
import { maxDateKey, minDateKey, shiftDateKey } from '../utils/date';

export function useDragResize(dayWidth: number | (() => number)) {
  let dragState: DragState | null = null;
  let lastPreview: DragPreview | null = null;

  function start(mode: DragMode, blockId: string, employeeId: string, startX: number, originStartKey: string, originEndKey: string) {
    dragState = { mode, blockId, employeeId, startX, originStartKey, originEndKey };
    lastPreview = null;
  }

  function preview(clientX: number): DragPreview | null {
    if (!dragState) {
      return null;
    }

    const width = typeof dayWidth === 'function' ? dayWidth() : dayWidth;
    const deltaDays = Math.round((clientX - dragState.startX) / width);
    let startKey = dragState.originStartKey;
    let endKey = dragState.originEndKey;

    if (dragState.mode === 'move') {
      startKey = shiftDateKey(dragState.originStartKey, deltaDays);
      endKey = shiftDateKey(dragState.originEndKey, deltaDays);
    }

    if (dragState.mode === 'resize-left') {
      startKey = minDateKey(shiftDateKey(dragState.originStartKey, deltaDays), dragState.originEndKey);
    }

    if (dragState.mode === 'resize-right') {
      endKey = maxDateKey(shiftDateKey(dragState.originEndKey, deltaDays), dragState.originStartKey);
    }

    lastPreview = {
      employeeId: dragState.employeeId,
      blockId: dragState.blockId,
      startKey,
      endKey,
    };
    return lastPreview;
  }

  function stop(): DragStopResult {
    const result = {
      hadDrag: dragState !== null,
      preview: lastPreview,
    };
    dragState = null;
    lastPreview = null;
    return result;
  }

  return {
    start,
    preview,
    stop,
    get: () => dragState,
  };
}
