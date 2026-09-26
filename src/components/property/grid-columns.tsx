"use client";

import { LayoutGrid } from "lucide-react";
import { createContext, useContext, useSyncExternalStore } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gridColumnsCookie } from "@/lib/grid-columns";
import { cn } from "@/lib/utils";

// Cards-per-row choice for card lists on the widest screens (2xl and up), one
// cookie per list type. Dynamic pages pass the cookie as `initial` so the
// server renders the choice; cached pages read it in the browser instead.

export type GridColumns = 4 | 5 | 6;

// Literal class names so Tailwind generates them.
const WIDE: Record<GridColumns, string> = { 4: "2xl:grid-cols-4", 5: "2xl:grid-cols-5", 6: "2xl:grid-cols-6" };

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1]! : null;
}

type Ctx = { columns: GridColumns; options: readonly GridColumns[]; setColumns: (c: GridColumns) => void };
const GridColumnsContext = createContext<Ctx | null>(null);

export function GridColumnsProvider({ scope, options = [4, 5, 6], initial, children }: {
  scope: string;
  options?: readonly GridColumns[];
  initial?: string;
  children: React.ReactNode;
}) {
  const cookie = gridColumnsCookie(scope);
  const stored = useSyncExternalStore(subscribe, () => readCookie(cookie), () => initial ?? null);
  const parsed = Number(stored) as GridColumns;
  const columns = options.includes(parsed) ? parsed : options[0]!;
  const setColumns = (value: GridColumns) => {
    document.cookie = `${cookie}=${value}; path=/; max-age=31536000; samesite=lax`;
    for (const listener of listeners) listener();
  };
  return <GridColumnsContext.Provider value={{ columns, options, setColumns }}>{children}</GridColumnsContext.Provider>;
}

export function useGridColumns(): GridColumns | null {
  return useContext(GridColumnsContext)?.columns ?? null;
}

export function wideColumnsClass(columns: GridColumns): string {
  return WIDE[columns];
}

/** A card list whose widest-screen column count follows the viewer's choice. */
export function GridColumnsList({ className, children }: { className?: string; children: React.ReactNode }) {
  const columns = useGridColumns();
  return <ul className={cn(className, columns && WIDE[columns])} role="list">{children}</ul>;
}

/** Shown only where the extra columns can actually fit (2xl and up). */
export function GridColumnsSelect() {
  const ctx = useContext(GridColumnsContext);
  if (!ctx) return null;
  return (
    <Select value={String(ctx.columns)} onValueChange={(value) => ctx.setColumns(Number(value) as GridColumns)}>
      <SelectTrigger aria-label="Cards per row" className="hidden h-11 w-40 2xl:flex">
        <LayoutGrid className="text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ctx.options.map((n) => <SelectItem key={n} value={String(n)}>{n} per row</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
