"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";

// Location · Property type · Budget · Search, with a compact mobile grid.

export const BUDGETS = [
  { value: "0-2500000", label: "Up to ₹25 L" },
  { value: "2500000-5000000", label: "₹25 L – ₹50 L" },
  { value: "5000000-10000000", label: "₹50 L – ₹1 Cr" },
  { value: "10000000-50000000", label: "₹1 Cr – ₹5 Cr" },
  { value: "50000000-", label: "Above ₹5 Cr" },
];

const ANY = "any";

export function HeroSearch({ locations }: { locations: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const [location, setLocation] = useState(ANY);
  const [type, setType] = useState(ANY);
  const [budget, setBudget] = useState(ANY);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (location !== ANY) params.set("location", location);
    if (type !== ANY) params.set("type", toSlug(type));
    if (budget !== ANY) {
      const [min, max] = budget.split("-");
      if (min && min !== "0") params.set("minPrice", min);
      if (max) params.set("maxPrice", max);
    }
    router.push(`/properties${params.size ? `?${params}` : ""}`);
  }

  const segment = "flex min-w-0 flex-col px-4 pt-2 pb-1 transition-colors hover:bg-muted/60 focus-within:bg-muted/60 md:px-5";
  const trigger = "h-11 min-h-11 w-full border-0 bg-transparent p-0 text-[0.9375rem] font-medium shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 md:text-base [&_svg]:text-subtle";
  const label = "text-xs leading-4 font-medium text-muted-foreground";

  return (
    <form onSubmit={submit} role="search" aria-label="Search properties"
      className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/70 bg-card text-card-foreground shadow-[0_8px_24px_rgba(10,25,17,.12)] md:grid-cols-[1.1fr_1fr_1fr_auto]">
      <div className={`${segment} col-span-2 border-b md:col-span-1 md:border-r md:border-b-0`}>
        <Label htmlFor="hero-location" className={label}>Location</Label>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger id="hero-location" className={trigger}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All of Coorg</SelectItem>
            {locations.map((l) => <SelectItem key={l.slug} value={l.slug}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className={`${segment} border-r`}>
        <Label htmlFor="hero-type" className={label}>Property type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="hero-type" className={trigger}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any type</SelectItem>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className={segment}>
        <Label htmlFor="hero-budget" className={label}>Budget</Label>
        <Select value={budget} onValueChange={setBudget}>
          <SelectTrigger id="hero-budget" className={trigger}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any budget</SelectItem>
            {BUDGETS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 border-t p-2 md:col-span-1 md:self-center md:border-t-0">
        <Button type="submit" className="h-14 w-full gap-2 rounded-md px-8 text-base focus-visible:ring-offset-2"><Search aria-hidden="true" className="size-[18px]" /> Search</Button>
      </div>
    </form>
  );
}
