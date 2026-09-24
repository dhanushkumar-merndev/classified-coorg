import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Card } from "@/components/ui/card";
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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Guides</h1>
      <p className="mt-2 text-muted-foreground">Know what to check before you buy in Coorg.</p>
      <div className="mt-8">
        {articles.length === 0 ? (
          <EmptyState icon={BookOpen} title="Guides are on the way" description="Our team is preparing buying guides for Coorg."
            action={{ href: "/properties", label: "Browse properties" }} />
        ) : (
          <ul className="grid gap-5 md:grid-cols-2" role="list">
            {articles.map((a) => (
              <li key={a.id}>
                <Card className="h-full gap-3 p-6">
                  <h2 className="text-lg font-semibold"><Link href={`/guides/${a.slug}`} className="hover:underline">{a.title}</Link></h2>
                  {a.excerpt && <p className="text-sm text-muted-foreground">{a.excerpt}</p>}
                  <p className="mt-auto text-xs text-muted-foreground">Updated {formatDate(a.updated_at)}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
