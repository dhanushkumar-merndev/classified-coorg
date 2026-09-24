import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you&rsquo;re looking for doesn&rsquo;t exist or is no longer available.</p>
      <Button asChild><Link href="/properties">Browse properties</Link></Button>
    </main>
  );
}
