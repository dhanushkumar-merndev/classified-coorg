import { BedDouble, Coffee, House, LandPlot, MapPinned, Store, Tractor, Wheat, type LucideIcon } from "lucide-react";

export const PROPERTY_TYPE_ICONS: Record<string, LucideIcon> = {
  coffee_estate: Coffee,
  agricultural_land: Wheat,
  farm_land: Tractor,
  residential_plot: LandPlot,
  commercial_land: Store,
  house_villa: House,
  homestay_resort: BedDouble,
  other: MapPinned,
};

/** Icon tile used on property-type cards. */
export function TypeIcon({ type }: { type: string }) {
  const Icon = PROPERTY_TYPE_ICONS[type] ?? MapPinned;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}
