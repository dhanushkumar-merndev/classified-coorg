import { KpiCard, PageHeader } from "@/components/dashboard/page-header";
import { TrendChart } from "@/components/admin/trend-chart";
import { PROPERTY_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getAdminSummary, getAdminTrend } from "@/repositories/admin";

export const metadata = { title: "Dashboard" };

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }

export default async function AdminDashboardPage() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  const [summary, created, approved, enquiries] = await Promise.all([
    getAdminSummary(),
    getAdminTrend("listings_created", isoDay(from), isoDay(to)),
    getAdminTrend("listings_approved", isoDay(from), isoDay(to)),
    getAdminTrend("enquiries", isoDay(from), isoDay(to)),
  ]);
  const pts = (rows: typeof created) => rows.map((r) => ({ label: r.bucket.slice(5), value: r.count }));
  const queue = (summary.status_counts.submitted ?? 0) + (summary.status_counts.under_review ?? 0);
  const f = summary.funnel_90d;

  return (
    <>
      <PageHeader title="Dashboard" description="Last 30 days unless stated." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Awaiting verification" value={queue} />
        <KpiCard label="Live listings" value={summary.listed} />
        <KpiCard label="Users" value={summary.users.total} hint={`${summary.users.suspended} suspended`} />
        <KpiCard label="Enquiries" value={summary.enquiries.total} hint={`${summary.enquiries.today} today`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <TrendChart title="Listings created" points={pts(created)} />
        <TrendChart title="Listings approved" points={pts(approved)} />
        <TrendChart title="Enquiries" points={pts(enquiries)} kind="bar" />
        <TrendChart title="Live listings by type" kind="bar"
          points={summary.by_type.map((t) => ({ label: PROPERTY_TYPE_LABELS[t.type] ?? t.type, value: t.count }))} />
        <TrendChart title="Live listings by location" kind="bar" points={summary.by_location.map((l) => ({ label: l.name, value: l.count }))} />
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-sm font-medium">Verification funnel (90 days)</p>
          <dl className="space-y-2 text-sm">
            {[["Submitted", f.submitted], ["Review started", f.reviewed], ["Approved", f.approved], ["Listings enquired on", f.enquired]].map(([l, v]) => (
              <div key={l as string} className="flex justify-between"><dt className="text-muted-foreground">{l}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          <p className="mb-2 mt-5 text-sm font-medium">By status</p>
          <dl className="space-y-1 text-sm">
            {Object.entries(summary.status_counts).map(([s, n]) => (
              <div key={s} className="flex justify-between"><dt className="text-muted-foreground">{STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</dt><dd>{n}</dd></div>
            ))}
          </dl>
        </div>
      </div>
    </>
  );
}
