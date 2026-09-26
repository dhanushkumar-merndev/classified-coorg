"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AREA_UNIT_LABELS } from "@/lib/format";
import { PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS } from "@/lib/labels";
import { activeFilterCount, toQueryString, type SearchFilters } from "@/schemas/search-params";
import { cn } from "cn";

// design.md §13–14: URL is the source of truth. Desktop applies changes
// immediately (text/number inputs debounced 300 ms, continue.md §25); mobile
// edits a draft in a sheet and applies on "Show results".

const ANY = "any";

interface Props {
  filters: SearchFilters;
  locations: Array<{ slug: string; name: string }>;
}

// Keep the DOM node (and caret) while URL-driven results arrive. External
// navigation and Clear still update inactive inputs.
function FilterInput({ value, ...props }: Omit<ComponentProps<typeof Input>, "value" | "defaultValue"> & { value: string | number }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = String(value);
  }, [value]);
  return <Input {...props} ref={ref} defaultValue={value} />;
}

function FilterFields({ value, onChange, locations, idPrefix }: {
  value: SearchFilters;
  onChange: (patch: Partial<SearchFilters>, debounce?: boolean) => void;
  locations: Props["locations"];
  idPrefix: string;
}) {
  const num = (v: string) => (v.trim() === "" || !/^\d+$/.test(v.trim()) ? undefined : Number(v.trim()));
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={id("q")}>Keyword</Label>
        <FilterInput id={id("q")} type="search" placeholder="e.g. estate with stream" value={value.q ?? ""}
          onChange={(e) => onChange({ q: e.target.value.trim() || undefined }, true)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("location")}>Location</Label>
        <Select value={value.location ?? ANY} onValueChange={(v) => onChange({ location: v === ANY ? undefined : v })}>
          <SelectTrigger id={id("location")} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All of Coorg</SelectItem>
            {locations.map((l) => <SelectItem key={l.slug} value={l.slug}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("type")}>Property type</Label>
        <Select value={value.type ?? ANY} onValueChange={(v) => onChange({ type: v === ANY ? undefined : (v as SearchFilters["type"]) })}>
          <SelectTrigger id={id("type")} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any type</SelectItem>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Price (₹)</legend>
        <div className="grid grid-cols-2 gap-2">
          <FilterInput aria-label="Minimum price in rupees" inputMode="numeric" placeholder="Min" value={value.minPrice ?? ""}
            onChange={(e) => onChange({ minPrice: num(e.target.value) }, true)} />
          <FilterInput aria-label="Maximum price in rupees" inputMode="numeric" placeholder="Max" value={value.maxPrice ?? ""}
            onChange={(e) => onChange({ maxPrice: num(e.target.value) }, true)} />
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Area</legend>
        <div className="grid grid-cols-2 gap-2">
          <FilterInput aria-label="Minimum area" inputMode="numeric" placeholder="Min" value={value.minArea ?? ""}
            onChange={(e) => onChange({ minArea: num(e.target.value) }, true)} />
          <FilterInput aria-label="Maximum area" inputMode="numeric" placeholder="Max" value={value.maxArea ?? ""}
            onChange={(e) => onChange({ maxArea: num(e.target.value) }, true)} />
        </div>
        <Select value={value.unit} onValueChange={(v) => onChange({ unit: v as SearchFilters["unit"] })}>
          <SelectTrigger aria-label="Area unit" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(AREA_UNIT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l.many}</SelectItem>)}
          </SelectContent>
        </Select>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={id("seller")}>Seller type</Label>
        <Select value={value.seller ?? ANY} onValueChange={(v) => onChange({ seller: v === ANY ? undefined : (v as SearchFilters["seller"]) })}>
          <SelectTrigger id={id("seller")} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any seller</SelectItem>
            {Object.entries(SELLER_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("plantation")}>Plantation type</Label>
        <FilterInput id={id("plantation")} placeholder="e.g. Arabica, pepper" value={value.plantation ?? ""}
          onChange={(e) => onChange({ plantation: e.target.value.trim() || undefined }, true)} />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Amenities</legend>
        <div className="flex items-center gap-2.5 py-1">
          <Checkbox id={id("road")} checked={value.road} onCheckedChange={(c) => onChange({ road: c === true })} />
          <Label htmlFor={id("road")} className="cursor-pointer py-1 font-normal select-none">Road access</Label>
        </div>
        <div className="flex items-center gap-2.5 py-1">
          <Checkbox id={id("water")} checked={value.water} onCheckedChange={(c) => onChange({ water: c === true })} />
          <Label htmlFor={id("water")} className="cursor-pointer py-1 font-normal select-none">Water available</Label>
        </div>
      </fieldset>
    </div>
  );
}

function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const go = (f: SearchFilters) => startTransition(() => router.push(`${pathname}${toQueryString(f, { page: 1 })}`, { scroll: false }));
  return { go, pending };
}

export function DesktopFilters({ filters, locations }: Props) {
  const { go, pending } = useNavigate();
  const latest = useRef(filters);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { latest.current = filters; }, [filters]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onChange = (patch: Partial<SearchFilters>, debounce = false) => {
    latest.current = { ...latest.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    if (debounce) timer.current = setTimeout(() => go(latest.current), 300);
    else go(latest.current);
  };

  const count = activeFilterCount(filters);
  return (
    <aside aria-label="Filters" aria-busy={pending} className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-20 max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto rounded-md border bg-card p-5">
        <div className="flex h-7 items-center justify-between">
          <div className="flex items-center font-semibold text-base">Filters {count > 0 && <Badge variant="secondary" className="ml-1.5 border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{count}</Badge>}</div>
          {count > 0 && <Button variant="link" size="sm" className="h-9 px-2 text-sm text-primary inline-flex items-center hover:underline" onClick={() => go({ ...filters, ...CLEARED })}>Clear all</Button>}
        </div>
        <FilterFields value={filters} onChange={onChange} locations={locations} idPrefix="d" />
      </div>
    </aside>
  );
}

const CLEARED: Partial<SearchFilters> = {
  q: undefined, location: undefined, type: undefined, seller: undefined, minPrice: undefined, maxPrice: undefined,
  minArea: undefined, maxArea: undefined, road: false, water: false, plantation: undefined, unit: "acre",
};

export function MobileFilters({ filters, locations, className }: Props & { className?: string }) {
  const { go } = useNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const count = useMemo(() => activeFilterCount(filters), [filters]);

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(filters); }}>
      <SheetTrigger asChild>
        <Button variant="outline" className={cn("w-full h-11 lg:hidden", className)}>
          <SlidersHorizontal /> Filters {count > 0 && <Badge variant="secondary" className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{count}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-md">
        <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
        <div className="px-4">
          <FilterFields key={open ? "open" : "closed"} value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            locations={locations} idPrefix="m" />
        </div>
        <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t bg-card p-4">
          <Button variant="outline" className="flex-1 h-11" onClick={() => { setDraft({ ...draft, ...CLEARED }); }}>
            <X /> Clear
          </Button>
          <Button className="flex-1 h-11" onClick={() => { go(draft); setOpen(false); }}>Show results</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function SortSelect({ filters, className }: { filters: SearchFilters; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select value={filters.sort} onValueChange={(sort) => router.push(`${pathname}${toQueryString(filters, { sort: sort as SearchFilters["sort"], page: 1 })}`, { scroll: false })}>
      <SelectTrigger aria-label="Sort results" className={cn("w-full h-11 sm:w-48", className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest first</SelectItem>
        <SelectItem value="price_asc">Price: low to high</SelectItem>
        <SelectItem value="price_desc">Price: high to low</SelectItem>
        <SelectItem value="area_asc">Area: small to large</SelectItem>
        <SelectItem value="area_desc">Area: large to small</SelectItem>
      </SelectContent>
    </Select>
  );
}
