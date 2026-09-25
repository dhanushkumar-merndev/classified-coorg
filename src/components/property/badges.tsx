import { ShieldCheck } from "lucide-react";
import type { PropertyStatus } from "@/lib/domain/property-lifecycle";
import { STATUS_LABELS, STATUS_TONE, VERIFIED_DISCLAIMER } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** design.md §12: "Verified" with a shield; never implies a title guarantee. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          tabIndex={0}
          className={cn("h-6 gap-1 border-transparent bg-success px-2 text-white hover:bg-success", className)}
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" /> Verified
          <span className="sr-only">. {VERIFIED_DISCLAIMER}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-center">{VERIFIED_DISCLAIMER}</TooltipContent>
    </Tooltip>
  );
}

const TONE_CLASSES: Record<string, string> = {
  draft: "bg-draft/10 text-draft border-draft/20",
  warning: "bg-warning/15 text-[#8a5a0a] border-warning/30",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASSES[STATUS_TONE[status]], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function ToneBadge({ tone, children, className }: { tone: keyof typeof TONE_CLASSES; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASSES[tone], className)}>
      {children}
    </Badge>
  );
}
