export function usePagination(pageSize: number) {
  let currentPage = 1;

  function getPage<T>(items: T[]): { items: T[]; currentPage: number; pageCount: number; pageSize: number; totalItems: number } {
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      currentPage,
      pageCount,
      pageSize,
      totalItems: items.length,
    };
  }

  function setPage(page: number) {
    currentPage = Math.max(1, page);
  }

  function reset() {
    currentPage = 1;
  }

  return {
    getPage,
    setPage,
    reset,
  };
}
