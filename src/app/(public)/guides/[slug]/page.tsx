import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { formatDate } from "@/lib/format";
import { breadcrumbLd, jsonLd, truncate } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { getArticleBySlug } from "@/repositories/public-listings";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const article = await getArticleBySlug((await params).slug);
  if (!article) return { title: "Guide not found", robots: { index: false } };
  return {
    title: article.seo_title ?? article.title,
    description: article.seo_description ?? truncate(article.excerpt ?? article.body, 160),
    alternates: { canonical: `/guides/${article.slug}` },
    openGraph: { type: "article", publishedTime: article.published_at, modifiedTime: article.updated_at },
  };
}

// Article bodies are plain text with blank-line paragraphs and "## " headings.
// Rendered as text nodes only — no HTML from the database reaches the page.
function renderBody(body: string) {
  return body.split(/\n{2,}/).map((block, i) =>
    block.startsWith("## ")
      ? <h2 key={i} className="pt-6 text-2xl font-medium tracking-tight">{block.slice(3)}</h2>
      : <p key={i} className="whitespace-pre-line leading-relaxed">{block}</p>,
  );
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const article = await getArticleBySlug((await params).slug);
  if (!article) notFound();
  return (
    <article className="wrap py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([
        breadcrumbLd([
          { name: "Home", url: siteUrl("/") },
          { name: "Guides", url: siteUrl("/guides") },
          { name: article.title, url: siteUrl(`/guides/${article.slug}`) },
        ]),
        {
          "@context": "https://schema.org", "@type": "Article", headline: article.title,
          datePublished: article.published_at, dateModified: article.updated_at,
          ...(article.author_name ? { author: { "@type": "Person", name: article.author_name } } : {}),
        },
      ])} />
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/guides">Guides</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage className="line-clamp-1">{article.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="max-w-3xl">
        <p className="eyebrow">Guide</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] text-balance md:text-5xl">{article.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {article.author_name ? `By ${article.author_name} · ` : ""}Updated {formatDate(article.updated_at)}
        </p>
        {article.excerpt && <p className="mt-8 border-l-2 border-primary pl-5 text-lg text-muted-foreground">{article.excerpt}</p>}
        <div className="mt-10 space-y-5 text-[1.05rem] leading-relaxed text-foreground/90">{renderBody(article.body ?? "")}</div>
      </div>
    </article>
  );
}
