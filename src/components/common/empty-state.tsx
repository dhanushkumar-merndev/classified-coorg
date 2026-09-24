import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// design.md §23: every empty state names a next action.
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-lg border bg-card px-6 py-10 sm:flex-row sm:items-center sm:px-10">
      <Icon className="size-7 shrink-0 text-subtle" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="text-lg font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button asChild variant="outline"><Link href={action.href}>{action.label} <ArrowRight /></Link></Button>
      )}
    </div>
  );
}
