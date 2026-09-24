import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
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
    <div className="wrap py-12 md:py-16">
      <PageIntro eyebrow="Guides" title="Before you buy in Coorg" lede="What to check, which documents matter, and how land deals work in Kodagu." />
      <div className="mt-10">
        {articles.length === 0 ? (
          <EmptyState icon={BookOpen} title="Guides are on the way" description="Our team is preparing buying guides for Coorg."
            action={{ href: "/properties", label: "Browse properties" }} />
        ) : (
          <ul className="grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3" role="list">
            {articles.map((a) => (
              <li key={a.id} className="space-y-3 border-t pt-5">
                <p className="text-xs text-muted-foreground">Updated {formatDate(a.updated_at)}</p>
                <h2 className="text-xl font-medium leading-snug"><Link href={`/guides/${a.slug}`} className="hover:text-primary">{a.title}</Link></h2>
                {a.excerpt && <p className="text-sm text-muted-foreground">{a.excerpt}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
