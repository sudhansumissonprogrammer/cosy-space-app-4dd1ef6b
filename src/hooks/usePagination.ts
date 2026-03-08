import { useState } from "react";

const PAGE_SIZE = 20;

export function usePagination(totalCount: number | undefined) {
  const [page, setPage] = useState(1);
  const total = totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  return {
    page,
    setPage,
    from,
    to,
    totalPages,
    total,
    pageSize: PAGE_SIZE,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
