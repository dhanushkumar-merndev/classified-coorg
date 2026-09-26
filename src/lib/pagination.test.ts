import { describe, expect, it } from "vitest";
import { paginationItems } from "./pagination";

describe("paginationItems", () => {
  it("lists every page when there are few", () => {
    expect(paginationItems(1, 3)).toEqual([1, 2, 3]);
  });
  it("uses one ellipsis slot per long gap", () => {
    expect(paginationItems(1, 5)).toEqual([1, 2, "gap", 5]);
    expect(paginationItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });
  it("shows the page itself instead of an ellipsis for a one-page gap", () => {
    expect(paginationItems(4, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
