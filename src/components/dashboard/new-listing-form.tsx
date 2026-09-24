"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createDraftAction } from "@/actions/listing";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { PROPERTY_TYPES } from "@/schemas/property.schema";

export function NewListingForm() {
  const router = useRouter();
  const [type, setType] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="max-w-xl space-y-6">
      <RadioGroup value={type} onValueChange={setType} className="grid gap-3 sm:grid-cols-2">
        {PROPERTY_TYPES.map((t) => (
          <Label key={t} htmlFor={`type-${t}`}
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
            <RadioGroupItem id={`type-${t}`} value={t} />
            {PROPERTY_TYPE_LABELS[t]}
          </Label>
        ))}
      </RadioGroup>
      <Button
        size="lg"
        disabled={!type || pending}
        onClick={() => start(async () => {
          const r = await createDraftAction({ propertyType: type! });
          if (r.error) toast.error(r.error.message);
          else router.push(`/dashboard/properties/${r.data.id}/edit`);
        })}
      >
        {pending ? "Creating…" : "Continue"}
      </Button>
    </div>
  );
}
