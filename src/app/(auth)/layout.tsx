import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-accent/50 to-background">
      <header className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6"><Logo /></header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">{children}</main>
    </div>
  );
}
