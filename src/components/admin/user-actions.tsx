"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adminChangeRoleAction, adminSetSuspensionAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Role = "seller" | "agent" | "admin" | "super_admin";
const ROLES: Role[] = ["seller", "agent", "admin", "super_admin"];

export function UserActions({ userId, suspended, roles, isSelf }: { userId: string; suspended: boolean; roles: string[]; isSelf: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [role, setRole] = useState<Role>("seller");
  const has = roles.includes(role);

  const done = (r: { error: { message: string } | null }, msg: string) => {
    if (r.error) toast.error(r.error.message);
    else { toast.success(msg); setOpen(false); setReason(""); router.refresh(); }
  };

  if (isSelf) return <span className="text-xs text-muted-foreground">You</span>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Manage</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage user</DialogTitle>
          <DialogDescription>A reason is required and recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" rows={2} />
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" disabled={pending || !reason.trim()}
            onClick={() => start(async () => done(await adminChangeRoleAction({ userId, role, grant: !has, reason }), has ? "Role removed" : "Role granted"))}>
            {has ? "Remove role" : "Grant role"}
          </Button>
        </div>
        <DialogFooter>
          <Button variant={suspended ? "default" : "destructive"} disabled={pending || !reason.trim()}
            onClick={() => start(async () => done(await adminSetSuspensionAction({ userId, suspended: !suspended, reason }), suspended ? "Reactivated" : "Suspended"))}>
            {suspended ? "Reactivate account" : "Suspend account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
