import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { paginationItems } from "@/lib/pagination";

// Numbered, crawlable pagination (?page=N) — every page is a real URL that
// works without prior navigation (GAP-14).

export function ResultsPagination({ page, pageCount, hrefFor }: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const items = paginationItems(page, pageCount);
  return (
    <Pagination className="mt-10">
      <PaginationContent className="gap-1">
        {page > 1 && <PaginationItem><PaginationPrevious href={hrefFor(page - 1)} /></PaginationItem>}
        {items.map((item, i) => (
          <PaginationItem key={item === "gap" ? `gap-${i}` : item}>
            {item === "gap" ? (
              <PaginationEllipsis className="size-10 text-muted-foreground" />
            ) : (
              <PaginationLink href={hrefFor(item)} isActive={item === page} aria-label={`Page ${item}`}>{item}</PaginationLink>
            )}
          </PaginationItem>
        ))}
        {page < pageCount && <PaginationItem><PaginationNext href={hrefFor(page + 1)} /></PaginationItem>}
      </PaginationContent>
    </Pagination>
  );
}
