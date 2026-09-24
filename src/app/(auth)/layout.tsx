import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b"><div className="wrap flex h-16 items-center"><Logo /></div></header>
      <main id="main" className="wrap flex flex-1 items-start justify-center pb-16 pt-10 sm:pt-20">{children}</main>
    </div>
  );
}
