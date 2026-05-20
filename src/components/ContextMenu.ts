import type { ContextMenuState } from '../types';
import { escapeHtml } from '../utils/html';

export function ContextMenu(menu: ContextMenuState | null): string {
  if (!menu) {
    return '';
  }

  return `
    <div class="context-menu" style="left:${menu.x}px;top:${menu.y}px;">
      ${menu.items
        .map((item, index) => {
          return `<button class="menu-item ${item.danger ? 'danger' : ''}" data-menu-index="${index}">${escapeHtml(item.label)}</button>`;
        })
        .join('')}
    </div>
  `;
}
