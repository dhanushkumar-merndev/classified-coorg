import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

// Numbered, crawlable pagination (?page=N) — every page is a real URL that
// works without prior navigation (GAP-14).
export function ResultsPagination({ page, pageCount, hrefFor }: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return (
    <Pagination className="mt-10">
      <PaginationContent>
        {page > 1 && <PaginationItem><PaginationPrevious href={hrefFor(page - 1)} /></PaginationItem>}
        {sorted.map((p, i) => (
          <PaginationItem key={p}>
            {i > 0 && p - sorted[i - 1]! > 1 && <PaginationEllipsis />}
            <PaginationLink href={hrefFor(p)} isActive={p === page} aria-label={`Page ${p}`}>{p}</PaginationLink>
          </PaginationItem>
        ))}
        {page < pageCount && <PaginationItem><PaginationNext href={hrefFor(page + 1)} /></PaginationItem>}
      </PaginationContent>
    </Pagination>
  );
}
