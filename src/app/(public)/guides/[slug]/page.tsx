import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

// Article bodies are plain text: blank-line paragraphs, "## " headings and
// "- " bullet lists. Rendered as text nodes only — no HTML from the database
// reaches the page.
function renderBody(body: string) {
  const out: React.ReactNode[] = [];
  body.split(/\n{2,}/).forEach((block, i) => {
    let lines = block.split("\n");
    // A heading owns only its first line; anything under it is a normal block.
    if (lines[0]!.startsWith("## ")) {
      out.push(<h2 key={`h${i}`} className="pt-4 font-display text-xl">{lines[0]!.slice(3)}</h2>);
      lines = lines.slice(1);
      if (!lines.length) return;
    }
    if (lines.every((l) => l.startsWith("- "))) {
      out.push(
        <ul key={`l${i}`} className="list-disc space-y-1.5 pl-5 marker:text-primary">
          {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
        </ul>,
      );
    } else {
      out.push(<p key={`p${i}`} className="whitespace-pre-line">{lines.join("\n")}</p>);
    }
  });
  return out;
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const article = await getArticleBySlug((await params).slug);
  if (!article) notFound();
  return (
    <article className="wrap py-12">
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
        <h1 className="font-display text-3xl leading-tight text-balance md:text-4xl">{article.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {article.author_name ? `By ${article.author_name} · ` : ""}Updated {formatDate(article.updated_at)}
        </p>
        {article.excerpt && <p className="mt-6 text-lg text-muted-foreground">{article.excerpt}</p>}
        <div className="mt-8 space-y-4 text-base leading-7 text-foreground/90">{renderBody(article.body ?? "")}</div>
        <p className="mt-10 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          General information, not legal advice. Have a local advocate check the documents before you buy.
        </p>
        <Link href="/guides" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> All guides
        </Link>
      </div>
    </article>
  );
}
