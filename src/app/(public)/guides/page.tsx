import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageIntro } from "@/components/site/page-intro";
import { formatDate } from "@/lib/format";
import { getPublishedArticles } from "@/repositories/public-listings";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Guides for buying land in Coorg",
  description: "Practical guides on buying land, coffee estates and plots in Coorg (Kodagu).",
  alternates: { canonical: "/guides" },
};

export default async function GuidesPage() {
  const articles = await getPublishedArticles(60);
  return (
    <div className="wrap py-12">
      <PageIntro title="Guides" lede="What to check before buying land in Coorg." />
      <div className="mt-8">
        {articles.length === 0 ? (
          <EmptyState icon={BookOpen} title="Guides are on the way" description="Our team is preparing buying guides for Coorg."
            action={{ href: "/properties", label: "Browse properties" }} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/guides/${a.slug}`} className="group flex h-full flex-col gap-3 rounded-md border bg-card p-5 transition-colors hover:border-primary">
                  <span className="flex size-10 items-center justify-center rounded-md bg-accent text-primary"><BookOpen className="size-5" aria-hidden="true" /></span>
                  <h2 className="line-clamp-2 text-lg font-semibold leading-snug group-hover:text-primary">{a.title}</h2>
                  {a.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{a.excerpt}</p>}
                  <span className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-subtle">
                    <Clock className="size-3.5" aria-hidden="true" /> Updated {formatDate(a.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
