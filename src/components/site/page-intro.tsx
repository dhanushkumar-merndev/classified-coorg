import { cn } from "@/lib/utils";

/** Shared page opening: headline, optional one-line lede and actions. No rule
    underneath — the content below provides its own edge, so lines never double up. */
export function PageIntro({ title, lede, actions, className }: {
  title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl space-y-2">
        <h1 className="font-display text-3xl leading-tight text-balance md:text-4xl">{title}</h1>
        {lede && <p className="text-base text-pretty text-muted-foreground">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Section heading used inside pages, with an optional trailing link. */
export function SectionHeading({ title, id, aside }: { title: string; id?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="font-display text-2xl leading-tight">{title}</h2>
      {aside}
    </div>
  );
}
