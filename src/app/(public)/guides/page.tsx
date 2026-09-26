import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { GridColumnsList, GridColumnsProvider, GridColumnsSelect } from "@/components/property/grid-columns";
import { PageIntro } from "@/components/site/page-intro";
import { formatDate } from "@/lib/format";
import { getGuideImage } from "@/lib/guides";
import { breadcrumbLd, itemListLd, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { getPublishedArticles } from "@/repositories/public-listings";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Coorg Land Buying Guides | Legal Due Diligence, Jamma Bane & RTC",
  description:
    "Comprehensive guides to buying coffee estates and land in Coorg (Kodagu). Learn about Jamma Bane land rules, Bhoomi RTC verification, 11E sketch, and Karnataka registration.",
  keywords: [
    "Coorg land buying guide",
    "Jamma Bane land rules Coorg",
    "Bhoomi RTC Pahani verification",
    "coffee estate due diligence Coorg",
    "can outsiders buy land in Coorg",
    "DC conversion Coorg",
    "11E sketch Karnataka",
    "buying property in Kodagu",
  ],
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Coorg Land Buying Guides | Legal Due Diligence, Jamma Bane & RTC",
    description:
      "Essential guides on land laws, Jamma Bane tenure, RTC Pahani checks, and site visits in Coorg.",
    url: siteUrl("/guides"),
    siteName: "Land in Coorg",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: siteUrl("/images/hero-coorg-landscape.webp"),
        width: 1200,
        height: 630,
        alt: "Coorg Land Buying Guides",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coorg Land Buying Guides | Legal Due Diligence, Jamma Bane & RTC",
    description:
      "Essential guides on land laws, Jamma Bane tenure, RTC Pahani checks, and site visits in Coorg.",
    images: [siteUrl("/images/hero-coorg-landscape.webp")],
  },
};

export default async function GuidesPage() {
  const articles = await getPublishedArticles(60);
  return (
    <div className="wrap py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbLd([
          { name: "Home", url: siteUrl("/") },
          { name: "Guides", url: siteUrl("/guides") },
        ]))}
      />
      {articles.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(itemListLd(
            articles.map((a) => ({
              name: a.title,
              url: siteUrl(`/guides/${a.slug}`),
              image: siteUrl(getGuideImage(a.slug).src),
              description: a.excerpt ?? undefined,
            }))
          ))}
        />
      )}
      <GridColumnsProvider scope="guides">
      <PageIntro title="Guides" lede="What to check before buying land in Coorg." actions={<GridColumnsSelect />} />
      <div className="mt-8">
        {articles.length === 0 ? (
          <EmptyState icon={BookOpen} title="Guides are on the way" description="Our team is preparing buying guides for Coorg."
            action={{ href: "/properties", label: "Browse properties" }} />
        ) : (
          <GridColumnsList className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {articles.map((a) => {
              const guideImg = getGuideImage(a.slug);
              return (
                <li key={a.id}>
                  <Link
                    href={`/guides/${a.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:border-primary hover:shadow-md"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted select-none">
                      <Image
                        src={guideImg.src}
                        alt={guideImg.alt}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2.5 p-5">
                      <h2 className="line-clamp-2 text-lg font-semibold leading-snug group-hover:text-primary">
                        {a.title}
                      </h2>
                      {a.excerpt && (
                        <p className="line-clamp-3 text-sm text-muted-foreground leading-relaxed">
                          {a.excerpt}
                        </p>
                      )}
                      <span className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-subtle">
                        <Clock className="size-3.5" aria-hidden="true" /> Updated {formatDate(a.updated_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </GridColumnsList>
        )}
      </div>
      </GridColumnsProvider>
    </div>
  );
}
