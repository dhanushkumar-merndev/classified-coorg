import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";
import { ADMIN_ROLES, requirePageActor } from "@/lib/auth/dal";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const actor = await requirePageActor("/admin", { anyRole: ADMIN_ROLES });
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="bg-secondary p-4 text-white lg:w-64 lg:shrink-0">
        <div className="lg:sticky lg:top-6 space-y-6">
          <Logo inverted />
          <AdminNav />
          <p className="hidden text-xs text-white/60 lg:block">
            Signed in as {actor.fullName ?? "admin"}<br />
            <Link href="/dashboard" className="underline">Back to my account</Link>
          </p>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 bg-background p-4 sm:p-6 lg:p-10">{children}</main>
    </div>
  );
}
