import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { SiteHeader } from "@/components/site/site-header";
import { LISTING_ROLES, hasAnyRole, requirePageActor } from "@/lib/auth/dal";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s | Dashboard" }, robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const actor = await requirePageActor("/dashboard");
  return (
    <>
      <SiteHeader />
      <div className="wrap flex flex-1 flex-col gap-8 py-8 lg:flex-row lg:gap-12 lg:py-12">
        <aside className="lg:w-60 lg:shrink-0"><div className="lg:sticky lg:top-20"><DashboardNav isSeller={hasAnyRole(actor, LISTING_ROLES)} /></div></aside>
        <main id="main" className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
