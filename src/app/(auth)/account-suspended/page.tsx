import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { signOutAction } from "../login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Account suspended" };

export default function AccountSuspendedPage() {
  return (
    <Card className="w-full max-w-md rounded-2xl text-center">
      <CardHeader className="items-center">
        <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden="true" />
        <CardTitle className="text-2xl">Your account is suspended</CardTitle>
        <CardDescription>
          You can still browse listings, but saving, enquiring and posting are paused while our team reviews the account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button asChild><Link href="/properties">Browse properties</Link></Button>
        <form action={signOutAction}><Button type="submit" variant="outline" className="w-full">Log out</Button></form>
      </CardContent>
    </Card>
  );
}
