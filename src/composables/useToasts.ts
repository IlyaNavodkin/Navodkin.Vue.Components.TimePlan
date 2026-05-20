import type { Toast } from '../types';

export function useToasts(onChange: () => void) {
  let toasts: Toast[] = [];
  let seq = 1;

  function push(message: string) {
    const toast = { id: seq++, message };
    toasts = [...toasts, toast];
    window.setTimeout(() => {
      toasts = toasts.filter((item) => item.id !== toast.id);
      onChange();
    }, 2400);
  }

  return {
    push,
    get: () => toasts,
  };
}
