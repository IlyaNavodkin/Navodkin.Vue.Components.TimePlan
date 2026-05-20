import type { ContextMenuItem, ContextMenuState } from '../types';

export function useContextMenu() {
  let menu: ContextMenuState | null = null;

  function open(x: number, y: number, items: ContextMenuItem[], payload?: Record<string, string>) {
    menu = { x, y, items, payload };
  }

  function close() {
    menu = null;
  }

  return {
    open,
    close,
    get: () => menu,
  };
}
