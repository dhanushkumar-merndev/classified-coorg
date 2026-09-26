"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AMENITY_COUNTS, AMENITY_OPTIONS, FEATURE_COUNTS, FEATURE_OPTIONS,
  detailValueIsSelected, isCoreAmenity, selectedAmenities, selectedFeatures,
  type CoreAmenities, type DetailValues,
} from "@/lib/listing/details";

export function ListingDetailsEditor({ core, values, onCoreChange, onChange }: {
  core: CoreAmenities;
  values: DetailValues;
  onCoreChange: (key: keyof CoreAmenities, value: boolean) => void;
  onChange: (key: string, value: string) => void;
}) {
  const amenityCount = selectedAmenities(core, values).length;
  const featureCount = selectedFeatures(values).length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Amenities</CardTitle>
            <span className="text-sm text-muted-foreground" aria-live="polite">{amenityCount} / 9 selected</span>
          </div>
          <p className="text-sm text-muted-foreground">Select exactly 3, 6 or 9 amenities that the property has. Maximum 9.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AMENITY_OPTIONS.map((option) => {
              const checked = isCoreAmenity(option.key) ? core[option.key] === true : values[option.key] === "true";
              return (
                <Label key={option.key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3 font-normal">
                  <Checkbox checked={checked} disabled={!checked && amenityCount >= 9}
                    onCheckedChange={(value) => {
                      if (isCoreAmenity(option.key)) onCoreChange(option.key, value === true);
                      else onChange(option.key, value === true ? "true" : "");
                    }} />
                  {option.label}
                </Label>
              );
            })}
          </div>
          <CountHint count={amenityCount} allowed={AMENITY_COUNTS} name="amenities" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Features</CardTitle>
            <span className="text-sm text-muted-foreground" aria-live="polite">{featureCount} / 12 entered</span>
          </div>
          <p className="text-sm text-muted-foreground">Enter exactly 6, 8, 10 or 12 features. Only include details that apply.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURE_OPTIONS.map((option) => {
              const selected = detailValueIsSelected(option, values[option.key]);
              if (option.kind === "text") return (
                <div key={option.key} className="space-y-2 rounded-md border p-3">
                  <Label htmlFor={`detail-${option.key}`}>{option.label}</Label>
                  <Input id={`detail-${option.key}`} value={values[option.key] ?? ""} maxLength={200}
                    disabled={!selected && featureCount >= 12}
                    placeholder={option.key === "plantation_type" ? "e.g. Arabica coffee and pepper" : "e.g. Valley and forest views"}
                    onChange={(event) => onChange(option.key, event.target.value)} />
                </div>
              );
              return (
                <Label key={option.key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3 font-normal">
                  <Checkbox checked={selected} disabled={!selected && featureCount >= 12}
                    onCheckedChange={(value) => onChange(option.key, value === true ? "true" : "")} />
                  {option.label}
                </Label>
              );
            })}
          </div>
          <CountHint count={featureCount} allowed={FEATURE_COUNTS} name="features" />
          <p className="text-xs text-muted-foreground">Keep exact addresses, directions, map links and contact details out of public features.</p>
        </CardContent>
      </Card>
    </>
  );
}

function CountHint({ count, allowed, name }: { count: number; allowed: readonly number[]; name: string }) {
  const valid = allowed.includes(count);
  const next = allowed.find((n) => n > count);
  return (
    <p className={`text-sm ${valid ? "text-success" : "text-muted-foreground"}`} role="status">
      {valid ? `${count} ${name} — ready to submit.`
        : next ? `Add ${next - count} more to reach ${next} ${name}. You can save an incomplete draft.`
        : `Maximum ${allowed.at(-1)} ${name}.`}
    </p>
  );
}
