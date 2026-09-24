// Mirror of app.property_transitions (supabase/migrations/..._lifecycle_functions.sql).
// The database is authoritative; this copy drives UI affordances and is the
// oracle the database tests compare against, so the two cannot drift silently.

export const PROPERTY_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_required",
  "rejected",
  "verified",
  "sold",
  "archived",
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_ACTIONS = [
  "submit",
  "begin_review",
  "request_changes",
  "reject",
  "approve",
  "mark_sold",
  "archive",
] as const;
export type PropertyAction = (typeof PROPERTY_ACTIONS)[number];

export type TransitionActor = "owner" | "admin";

export interface TransitionRule {
  from: PropertyStatus;
  action: PropertyAction;
  to: PropertyStatus;
  actor: TransitionActor;
  requiresReason: boolean;
}

export const TRANSITIONS: readonly TransitionRule[] = [
  { from: "draft", action: "submit", to: "submitted", actor: "owner", requiresReason: false },
  { from: "changes_required", action: "submit", to: "submitted", actor: "owner", requiresReason: false },
  { from: "submitted", action: "begin_review", to: "under_review", actor: "admin", requiresReason: false },
  { from: "under_review", action: "request_changes", to: "changes_required", actor: "admin", requiresReason: true },
  { from: "under_review", action: "reject", to: "rejected", actor: "admin", requiresReason: true },
  { from: "under_review", action: "approve", to: "verified", actor: "admin", requiresReason: false },
  { from: "verified", action: "mark_sold", to: "sold", actor: "owner", requiresReason: false },
  { from: "verified", action: "mark_sold", to: "sold", actor: "admin", requiresReason: true },
  { from: "sold", action: "archive", to: "archived", actor: "owner", requiresReason: false },
  { from: "sold", action: "archive", to: "archived", actor: "admin", requiresReason: true },
];

/** GAP-01 baseline: listing content is editable only in these states. */
export const EDITABLE_STATUSES: readonly PropertyStatus[] = ["draft", "changes_required"];

export function findTransition(
  from: PropertyStatus,
  action: PropertyAction,
  actor: TransitionActor,
): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.action === action && t.actor === actor);
}

/** Actions the given actor may attempt from a status, for rendering controls.
 *  Never an authorization decision on its own. */
export function availableActions(status: PropertyStatus, actor: TransitionActor): PropertyAction[] {
  return TRANSITIONS.filter((t) => t.from === status && t.actor === actor).map((t) => t.action);
}

export function isEditable(status: PropertyStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}
