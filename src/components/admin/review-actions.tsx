"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adminAddNoteAction, adminSetFeaturedAction, adminTransitionAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { availableActions, findTransition, type PropertyAction, type PropertyStatus } from "@/lib/domain/property-lifecycle";

const LABEL: Partial<Record<PropertyAction, string>> = {
  begin_review: "Start review", approve: "Approve & publish", reject: "Reject", request_changes: "Request changes",
  mark_sold: "Mark as sold", archive: "Archive",
};

export function ReviewActions({ id, status, version, revisionId, featured }: {
  id: string; status: PropertyStatus; version: number; revisionId: string | null; featured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [internal, setInternal] = useState("");
  const [note, setNote] = useState("");
  const actions = availableActions(status, "admin");

  const run = (action: PropertyAction) => start(async () => {
    const r = await adminTransitionAction({
      propertyId: id, action, expectedVersion: version, revisionId, requestId: crypto.randomUUID(),
      ...(reason.trim() ? { reason: reason.trim() } : {}), ...(internal.trim() ? { internalNotes: internal.trim() } : {}),
    });
    if (r.error) toast.error(r.error.message); else { toast.success(`${LABEL[action]} done`); setReason(""); setInternal(""); router.refresh(); }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Decision</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {actions.length === 0 && <p className="text-sm text-muted-foreground">No admin actions for this status.</p>}
          {actions.length > 0 && (
            <>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Message to the owner (required to reject, request changes, or override)" rows={3} />
              <Textarea value={internal} onChange={(e) => setInternal(e.target.value)} placeholder="Internal notes (never shown to the owner)" rows={2} />
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => {
                  const needsReason = findTransition(status, a, "admin")?.requiresReason && !reason.trim();
                  return <Button key={a} disabled={pending || needsReason} variant={a === "approve" ? "default" : "outline"} onClick={() => run(a)}>{LABEL[a]}</Button>;
                })}
              </div>
            </>
          )}
          {status === "verified" && (
            <Button variant="outline" disabled={pending} onClick={() => start(async () => {
              const r = await adminSetFeaturedAction({ propertyId: id, featured: !featured, expectedVersion: version });
              if (r.error) toast.error(r.error.message); else router.refresh();
            })}>{featured ? "Remove from featured" : "Feature on home page"}</Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Add internal note</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          <Button size="sm" variant="outline" disabled={pending || !note.trim()} onClick={() => start(async () => {
            const r = await adminAddNoteAction({ propertyId: id, note });
            if (r.error) toast.error(r.error.message); else { setNote(""); router.refresh(); }
          })}>Save note</Button>
        </CardContent>
      </Card>
    </div>
  );
}
