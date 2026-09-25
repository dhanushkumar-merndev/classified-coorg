import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/60">
      <header className="border-b bg-background"><div className="wrap flex h-16 items-center"><Logo /></div></header>
      {/* Card sits in the optical centre of the remaining viewport. */}
      <main id="main" className="wrap flex flex-1 items-center justify-center py-10">{children}</main>
      <div aria-hidden="true" className="h-16" />
    </div>
  );
}
