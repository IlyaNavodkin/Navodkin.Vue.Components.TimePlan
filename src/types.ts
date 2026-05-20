export type RowKind = 'project' | 'charge' | 'employee';
export type ZoomPresetId = 'week' | 'threeWeeks' | 'month';
export type DragMode = 'move' | 'resize-left' | 'resize-right';
export type TimeScaleMode = 'day' | 'month';

export type Employee = {
  id: string;
  name: string;
};

export type Charge = {
  id: string;
  name: string;
  employees: Employee[];
};

export type Project = {
  id: string;
  name: string;
  charges: Charge[];
};

export type FlatRow = {
  id: string;
  kind: RowKind;
  label: string;
  depth: number;
  projectId?: string;
  chargeId?: string;
};

export type TimelineBlock = {
  id: string;
  employeeId: string;
  title: string;
  startKey: string;
  endKey: string;
};

export type TimelineSummaryBlock = {
  id: string;
  startKey: string;
  endKey: string;
};

export type DateRangeSelection = {
  rowId: string;
  startKey: string;
  endKey: string;
};

export type Toast = {
  id: number;
  message: string;
};

export type ContextMenuItem = {
  label: string;
  action: string;
  danger?: boolean;
};

export type ContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  payload?: Record<string, string>;
};

export type DragState = {
  mode: DragMode;
  blockId: string;
  employeeId: string;
  startX: number;
  originStartKey: string;
  originEndKey: string;
};

export type DragPreview = {
  employeeId: string;
  blockId: string;
  startKey: string;
  endKey: string;
};

export type DragStopResult = {
  hadDrag: boolean;
  preview: DragPreview | null;
};

export type SelectionDragState = {
  rowId: string;
  anchorKey: string;
};
