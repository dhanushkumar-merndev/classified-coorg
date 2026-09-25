import { BookOpen } from "lucide-react";
import { ArticleForm } from "@/components/admin/article-form";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ToneBadge } from "@/components/property/badges";
import { ResultsPagination } from "@/components/search/results-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listAdminArticles } from "@/repositories/admin";

export const metadata = { title: "Articles" };
const TONE = { draft: "draft", published: "success", archived: "warning" } as const;

export default async function AdminArticlesPage({ searchParams }: PageProps<"/admin/articles">) {
  const page = Number((await searchParams).page ?? 1) || 1;
  const list = await listAdminArticles(page);
  return (
    <>
      <PageHeader title="Articles" description={`${list.total} guides`} actions={<ArticleForm />} />
      {list.items.length === 0 ? (
        <EmptyState icon={BookOpen} title="No articles yet" description="Write the first buying guide for Coorg." />
      ) : (
        <>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {list.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><span className="font-medium">{a.title}</span><span className="block text-xs text-muted-foreground">/guides/{a.slug}</span></TableCell>
                    <TableCell><ToneBadge tone={TONE[a.status]}>{a.status}</ToneBadge></TableCell>
                    <TableCell>{formatDate(a.updated_at)}</TableCell>
                    <TableCell className="text-right"><ArticleForm article={a} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ResultsPagination page={list.page} pageCount={list.pageCount} hrefFor={(p) => `/admin/articles?page=${p}`} />
        </>
      )}
    </>
  );
}
