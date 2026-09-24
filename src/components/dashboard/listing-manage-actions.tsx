"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDraftAction, ownerTransitionAction } from "@/actions/listing";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { availableActions, findTransition, type PropertyAction, type PropertyStatus } from "@/lib/domain/property-lifecycle";

const ACTION_LABEL: Record<PropertyAction, string> = {
  submit: "Submit for review",
  begin_review: "Begin review",
  request_changes: "Request changes",
  reject: "Reject",
  approve: "Approve",
  mark_sold: "Mark as sold",
  archive: "Archive",
};

export function ListingManageActions({ id, status, version }: { id: string; status: PropertyStatus; version: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const actions = availableActions(status, "owner");

  function run(action: PropertyAction) {
    start(async () => {
      const rule = findTransition(status, action, "owner");
      const r = await ownerTransitionAction({
        propertyId: id, action, expectedVersion: version, requestId: crypto.randomUUID(),
        ...(rule?.requiresReason ? { reason } : {}),
      });
      if (r.error) toast.error(r.error.message);
      else { toast.success(`${ACTION_LABEL[action]} done`); router.refresh(); }
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => {
          const rule = findTransition(status, action, "owner");
          return (
            <AlertDialog key={action}>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant={action === "mark_sold" ? "default" : "outline"} disabled={pending}>
                  {ACTION_LABEL[action]}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{ACTION_LABEL[action]}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {action === "submit" && "Your listing will be sent for verification. You won't be able to edit it while it's under review."}
                    {action === "mark_sold" && "This removes the listing from public search results."}
                    {action === "archive" && "This hides the listing permanently. You can't undo this."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {rule?.requiresReason && (
                  <Textarea placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={rule?.requiresReason && !reason.trim()} onClick={() => run(action)}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        })}

        {status === "draft" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" variant="ghost" disabled={pending}>Delete draft</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes the draft, its photos and documents. This can&rsquo;t be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => start(async () => {
                  const r = await deleteDraftAction({ propertyId: id, expectedVersion: version });
                  if (r.error) toast.error(r.error.message);
                  else { toast.success("Draft deleted"); router.push("/dashboard/properties"); }
                })}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {actions.length === 0 && status !== "draft" && <p className="text-sm text-muted-foreground">No actions available right now.</p>}
      </CardContent>
    </Card>
  );
}
