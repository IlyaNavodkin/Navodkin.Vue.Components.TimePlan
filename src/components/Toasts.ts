import type { Toast } from '../types';
import { escapeHtml } from '../utils/html';

export function Toasts(toasts: Toast[]): string {
  return `<div class="toasts">${toasts.map((toast) => `<div class="toast">${escapeHtml(toast.message)}</div>`).join('')}</div>`;
}
