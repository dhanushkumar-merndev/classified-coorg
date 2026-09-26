/** First, last and the pages around the current one; a one-page gap shows the
 *  page itself, a longer gap an ellipsis. e.g. 1 … 4 5 6 … 12 */
export function paginationItems(page: number, pageCount: number): Array<number | "gap"> {
  const pages = [...new Set([1, pageCount, page - 1, page, page + 1])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const items: Array<number | "gap"> = [];
  for (const p of pages) {
    const prev = items.at(-1);
    if (typeof prev === "number" && p - prev === 2) items.push(prev + 1);
    else if (typeof prev === "number" && p - prev > 2) items.push("gap");
    items.push(p);
  }
  return items;
}
