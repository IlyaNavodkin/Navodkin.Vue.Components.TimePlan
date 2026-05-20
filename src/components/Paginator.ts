export function Paginator(currentPage: number, pageCount: number, totalItems: number, pageSize: number, itemLabel = 'строк'): string {
  const pages = getVisiblePages(currentPage, pageCount);

  return `
    <nav class="paginator" aria-label="Пагинация">
      <button class="pager-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>
      ${pages
        .map((page) => {
          if (page === 'gap') {
            return '<span class="pager-gap">...</span>';
          }
          return `<button class="pager-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
        })
        .join('')}
      <button class="pager-btn" data-page="${currentPage + 1}" ${currentPage >= pageCount ? 'disabled' : ''}>›</button>
      <span class="pager-meta">${totalItems} ${itemLabel} · по ${pageSize}</span>
    </nav>
  `;
}

function getVisiblePages(currentPage: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];

  for (const page of sorted) {
    const previous = result.at(-1);
    if (typeof previous === 'number' && page - previous > 1) {
      result.push('gap');
    }
    result.push(page);
  }

  return result;
}
