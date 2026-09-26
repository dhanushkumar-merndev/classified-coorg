"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileCollapsibleListProps {
  children: React.ReactNode[];
  initialCount?: number;
  moreLabel?: string;
  lessLabel?: string;
  gridClassName?: string;
}

export function MobileCollapsibleList({
  children,
  initialCount = 4,
  moreLabel,
  lessLabel = "Show less",
  gridClassName = "grid grid-cols-2 gap-3 md:grid-cols-4",
}: MobileCollapsibleListProps) {
  const [expanded, setExpanded] = useState(false);
  const total = children.length;
  const hasMore = total > initialCount;

  return (
    <div className="space-y-3">
      <ul className={gridClassName} role="list">
        {children.map((child, i) => (
          <li
            key={i}
            className={cn(hasMore && !expanded && i >= initialCount && "hidden sm:block")}
          >
            {child}
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="sm:hidden pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-primary/20 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 active:scale-[0.99]"
          >
            <span>{expanded ? lessLabel : (moreLabel ?? `See more (${total - initialCount} more)`)}</span>
            {expanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      )}
    </div>
  );
}
