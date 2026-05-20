import type { TimeScaleMode, TimelineBlock, TimelineSummaryBlock } from '../types';
import { dayDiff, monthEndKey, monthStartKey, rangesIntersect, toDateKey } from '../utils/date';
import { escapeHtml } from '../utils/html';

export function TimelineBar(block: TimelineBlock, columns: Date[], columnWidth: number, scaleMode: TimeScaleMode): string {
  const geometry = getBlockGeometry(block, columns, columnWidth, scaleMode);
  if (!geometry) {
    return '';
  }

  return `
    <div class="timeline-bar" data-block-id="${block.id}" data-employee-id="${block.employeeId}" style="left:${geometry.left}px;width:${geometry.width}px;">
      <span class="resize-handle left" data-resize="left"></span>
      <span class="bar-title">${escapeHtml(block.title)}</span>
      <span class="resize-handle right" data-resize="right"></span>
    </div>
  `;
}

export function SummaryBar(block: TimelineSummaryBlock, columns: Date[], columnWidth: number, scaleMode: TimeScaleMode): string {
  const geometry = getBlockGeometry(block, columns, columnWidth, scaleMode);
  if (!geometry) {
    return '';
  }

  return `<div class="summary-bar" style="left:${geometry.left}px;width:${geometry.width}px;"></div>`;
}

export function ChargeStepLineCanvas(chargeId: string): string {
  return `<canvas class="charge-step-line" data-charge-id="${chargeId}" aria-hidden="true"></canvas>`;
}

export function drawChargeStepLine(
  canvas: HTMLCanvasElement,
  blocks: TimelineSummaryBlock[],
  columns: Date[],
  columnWidth: number,
  scaleMode: TimeScaleMode,
) {
  if (columns.length === 0 || columnWidth <= 0) {
    return;
  }

  const width = Math.max(1, Math.round(columns.length * columnWidth));
  const height = Math.max(1, canvas.parentElement?.clientHeight ?? 46);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const loadSeries = buildLoadSeries(blocks, columns, scaleMode);
  if (!loadSeries.length) {
    return;
  }

  const maxLoad = Math.max(...loadSeries);
  const topPad = 8;
  const bottomPad = 8;
  const chartHeight = Math.max(1, height - topPad - bottomPad);
  const yFor = (value: number): number => {
    if (maxLoad <= 0) {
      return height - bottomPad;
    }
    return topPad + chartHeight - (value / maxLoad) * chartHeight;
  };

  ctx.beginPath();
  ctx.moveTo(0, yFor(loadSeries[0]));
  for (let index = 1; index < loadSeries.length; index += 1) {
    const x = index * columnWidth;
    const prevY = yFor(loadSeries[index - 1]);
    const currentY = yFor(loadSeries[index]);
    ctx.lineTo(x, prevY);
    ctx.lineTo(x, currentY);
  }
  const lastY = yFor(loadSeries[loadSeries.length - 1]);
  ctx.lineTo(width, lastY);

  // Subtle area fill under the step line.
  ctx.lineTo(width, height - bottomPad);
  ctx.lineTo(0, height - bottomPad);
  ctx.closePath();
  ctx.fillStyle = 'rgba(79, 126, 207, 0.16)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, yFor(loadSeries[0]));
  for (let index = 1; index < loadSeries.length; index += 1) {
    const x = index * columnWidth;
    const prevY = yFor(loadSeries[index - 1]);
    const currentY = yFor(loadSeries[index]);
    ctx.lineTo(x, prevY);
    ctx.lineTo(x, currentY);
  }
  ctx.lineTo(width, lastY);
  ctx.strokeStyle = '#4f7ecf';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function getBlockGeometry(
  block: Pick<TimelineBlock, 'startKey' | 'endKey'>,
  columns: Date[],
  columnWidth: number,
  scaleMode: TimeScaleMode,
): { left: number; width: number } | null {
  const timelineStartKey = getColumnStartKey(columns[0], scaleMode);
  const timelineEndKey = getColumnEndKey(columns[columns.length - 1], scaleMode);
  if (!rangesIntersect(block.startKey, block.endKey, timelineStartKey, timelineEndKey)) {
    return null;
  }

  const startIndex = Math.max(0, findColumnIndex(block.startKey, columns, scaleMode));
  const endIndex = Math.min(columns.length - 1, findColumnIndex(block.endKey, columns, scaleMode));
  const widthInColumns = Math.max(1, endIndex - startIndex + 1);
  return { left: startIndex * columnWidth, width: widthInColumns * columnWidth };
}

function findColumnIndex(dateKey: string, columns: Date[], scaleMode: TimeScaleMode): number {
  if (scaleMode === 'day') {
    return dayDiff(toDateKey(columns[0]), dateKey);
  }
  const date = new Date(`${dateKey}T00:00:00`);
  return (date.getFullYear() - columns[0].getFullYear()) * 12 + date.getMonth() - columns[0].getMonth();
}

function buildLoadSeries(blocks: TimelineSummaryBlock[], columns: Date[], scaleMode: TimeScaleMode): number[] {
  if (columns.length === 0) {
    return [];
  }

  const diff = new Int32Array(columns.length + 1);
  for (const block of blocks) {
    const rawStart = findColumnIndex(block.startKey, columns, scaleMode);
    const rawEnd = findColumnIndex(block.endKey, columns, scaleMode);
    if (rawEnd < 0 || rawStart >= columns.length) {
      continue;
    }

    const start = Math.max(0, rawStart);
    const end = Math.min(columns.length - 1, rawEnd);
    if (start > end) {
      continue;
    }

    diff[start] += 1;
    diff[end + 1] -= 1;
  }

  const series = new Array<number>(columns.length);
  let current = 0;
  for (let index = 0; index < columns.length; index += 1) {
    current += diff[index];
    series[index] = current;
  }
  return series;
}

function getColumnStartKey(date: Date, scaleMode: TimeScaleMode): string {
  return scaleMode === 'month' ? monthStartKey(date) : toDateKey(date);
}

function getColumnEndKey(date: Date, scaleMode: TimeScaleMode): string {
  return scaleMode === 'month' ? monthEndKey(date) : toDateKey(date);
}
