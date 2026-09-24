import { cn } from "@/lib/utils";

/** Shared page opening: eyebrow, display headline, optional lede and actions. */
export function PageIntro({ eyebrow, title, lede, actions, className }: {
  eyebrow?: string; title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-6 border-b pb-8", className)}>
      <div className="max-w-3xl space-y-3">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display text-4xl leading-[1.05] text-balance md:text-[3.25rem]">{title}</h1>
        {lede && <p className="max-w-2xl text-base text-pretty text-muted-foreground md:text-lg">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Section heading used inside pages: display h2 with an optional trailing link. */
export function SectionHeading({ title, id, aside }: { title: string; id?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <h2 id={id} className="font-display text-3xl leading-tight md:text-4xl">{title}</h2>
      {aside}
    </div>
  );
}
