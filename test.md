# test.md
# Land in Coorg Classified Marketplace — Complete QA Blueprint

Revision: 24 September 2026. Specification review only; no application or automated suite has been executed. This document replaces the earlier test checklist.

## 1. Scope, authority and how to use this blueprint

Read `design.md`, `architecture.md`, `test.md` and `continue.md` as one specification. The defined implementation stack remains **Next.js App Router, TypeScript, Supabase PostgreSQL/Auth, private Tigris object storage, MSG91, Brevo, shadcn/ui and Apache ECharts**, with Tailwind, React Hook Form, Zod, Vercel and the other support tools already named in the source files. Tigris replaces the earlier Supabase object-storage choice at the user’s explicit request; Supabase remains PostgreSQL/Auth/RLS. Keep MSG91, Brevo, shadcn/ui and Apache ECharts. Deployment target is Vercel Mumbai (`bom1`); recommend Mumbai (`ap-south-1`) for a new Supabase project. Do not add a second authentication system.

This blueprint covers the complete specified MVP and its operational surfaces, including features mentioned only in a navigation list or continuation task. Optional post-MVP features stay outside MVP acceptance; their disabled-state checks and future QA obligations are recorded at the end. New schema or policy needs are tracked in `continue.md` as GAP-01 through GAP-28.

**Coverage is a maintained contract, not a claim that every possible defect can be predicted.** Every specified feature must map to tests; every unresolved expected outcome must remain BLOCKED until its decision is recorded. Do not silently turn a proposal into an existing product requirement, skip a blocked case, or mark this document as evidence that the software passes.

Execution order:

1. Resolve release-blocking GAP decisions and freeze validation constants, permissions and API/action bindings.
2. Seed isolated fixtures and implement unit, service, API and database/RLS cases.
3. Implement the end-to-end journeys with real application and Supabase boundaries; mock only external delivery/services in normal CI.
4. Run fault, race, recovery, accessibility, responsive, SEO and performance suites.
5. Attach evidence to individual case IDs and evaluate the release gates in section 10.

Test tools: Vitest and Testing Library for units/components; direct Route Handler/Server Action adapters and Supabase integration fixtures for backend tests; MSW or server-side provider fakes for third parties; Playwright for browsers/API clients; axe-core plus manual assistive-technology checks; Lighthouse CI and an optional k6 load harness. Pin supported versions in the application lockfile.

### 1.1 Priorities and result states

| Priority | Meaning | Release treatment |
|---|---|---|
| P0 | Identity, authorization, publication integrity, private documents, core search/submission/review/enquiry, destructive integrity or recovery controls | All applicable cases pass; no unresolved P0 gap or defect |
| P1 | Complete supported flows, accessibility, SEO, dashboard/CMS/admin behavior, resilience and performance | All applicable cases pass or a named owner explicitly accepts a bounded exception with a deadline; no broken primary journey |
| P2 | Lower-risk presentation refinements and secondary analysis conveniences | Run and record; triage with an owner |

Use PASS, FAIL, BLOCKED, NOT RUN or APPROVED N/A. A skipped test is not PASS. Record build SHA, migration version, browser/device, environment, fixture seed, policy version, expected/actual result and redacted evidence. Parameterized instances retain their own results, e.g. `AUTH-003[phone=unsupported-country]` or `RLS-002[table=properties,actor=sellerB,verb=update,scope=other]`.

### 1.2 Field conventions

Every case contains Preconditions, Steps, Expected Result, Priority, API coverage and Playwright coverage. API coverage includes the service/action boundary if no HTTP route is warranted; do not create a route only to satisfy a test. `N/A` explains why another layer owns that assertion. `PW` means a browser test is required; `PW API` means Playwright's request client is suitable but is not browser E2E. Spec filenames are proposed test organization, not existing files.

Preconditions reference **F0**, which is expanded below and is mandatory for every case. Each semicolon-separated action in Steps is executed in order. For a matrix case, repeat the complete case once for each named parameter; do not test one representative and claim the entire matrix passed. All successful mutations verify durable database state and allowed effects; all rejected mutations verify no forbidden row, object, notification, audit-success event or other side effect was created.

## 2. Policy decisions and test oracles

The source files omit numeric limits and conflict in several areas. The table gives a conservative proposed acceptance baseline, while `continue.md` contains implementation tasks. Decisions affecting an implemented feature must be closed before that feature passes QA. Existing unambiguous requirements remain mandatory.

| Gap | Rule that must be fixed before implementation/acceptance | Proposed baseline to test after adoption |
|---|---|---|
| GAP-01 | Seller editable states; source architecture §9 suggests submitted CRUD while §30 and original tests imply a review lock | Only own draft and changes_required content is editable; submitted/under_review content is immutable; verified edits require a defined revision/review flow, otherwise denied |
| GAP-02 | Sold, archived, expired, deleted, future-published and suspended-seller visibility; unpublish/republish/expiry transitions | Public discovery and new enquiries require verified, publication time reached, not deleted, not expired, active seller and active location; hide sold/archived by default; explicitly decide historical detail URLs and SEO |
| GAP-03 | Validation constants and enumerations | Commit shared Zod/DB-compatible limits for every field, count, file, OTP, rate, cursor and date; document units, rounding, inclusivity and error codes |
| GAP-04 | Buyer/seller/agent onboarding, combined roles and seller-type selection | Phone identity alone grants no privileged role; select only approved non-admin capabilities; agent inventory limit is explicit; role addition requires a server-authorized action |
| GAP-05 | Admin versus super-admin boundaries and audit navigation conflict | Admin manages ordinary users/content; super admin manages admins, system settings, overrides, feature flags and audit-log access; no self-promotion or last-super-admin removal |
| GAP-06 | Reports UI has no persistence/workflow definition | Add report reason/status/ownership/triage model; authenticated reporting by default; freeze guest policy, dedupe, limits and resolve/dismiss behavior |
| GAP-07 | Profile/settings/notification preferences, missing email and phone changes | Phone-first users may have no email; dashboard remains primary notification channel; verify email before delivery, verify phone changes through Auth, separate preferences from mandatory security notices |
| GAP-08 | Enquiry status, repeat-contact policy, seller-self-contact and contact disclosure | Derive buyer/seller from server state; deny self-contact; one record per idempotency key; freeze repeat window and status actors; no private phone disclosure without an explicit policy |
| GAP-09 | Edit versioning and immutable reviewed content | Add version/revision comparison; review the exact submitted revision; stale edits/reviews return conflict and never overwrite silently |
| GAP-10 | User-confirmed private Tigris storage; application delivery and metadata boundary | All buckets private, including photos/avatars; Supabase RLS protects metadata only. Authorize uploads/proxies in Next.js; approved images use controlled stable app URLs; no public bucket or public ACL |
| GAP-11 | Upload lifecycle, harmful content handling, signed-link TTL/revocation | Define upload initiation/finalization, byte validation, document preview/download policy, cleanup grace period and link TTL; use an authenticated proxy if immediate revocation is required |
| GAP-12 | Retry-safe notification delivery although a queue is deferred | Persist business event/delivery intent and dedupe key; define bounded retries/manual recovery with existing stack; do not claim exactly-once external delivery after an ambiguous provider timeout |
| GAP-13 | Rejection, correction, unpublish/archive/restore/delete/override rules | Freeze all allowed transitions, reasons, actors and visibility effects; transitions not explicitly allowed are denied |
| GAP-14 | Public sorting, page-number/cursor mapping, count accuracy and changing datasets | Stable tie-breaker per sort; bind cursor to filters/sort; document live-keyset versus snapshot semantics and no duplicates for unchanged eligible rows |
| GAP-15 | Location hierarchy, inactive locations, CMS fields and old-slug storage | Add hierarchy rules, SEO/author/updated fields and unique slug-history storage; define deactivation, reparenting and redirect behavior |
| GAP-16 | Analytics semantics, reporting timezone, funnel, views and date ranges | Define events versus current-state counts, dedupe, timezone and reviewed/approved funnel meanings; exclude test/bot activity according to a documented rule |
| GAP-17 | Rate limiting across distributed instances and provider hooks | Freeze identity keys, trusted-proxy handling, reset windows and provider callback authentication based on the actual configured integration |
| GAP-18 | SEO indexing rules, canonical host and thin search pages | Index eligible published detail/location/guide pages; explicitly allowlist valuable numbered search pages; exclude private and thin query combinations |
| GAP-19 | Retention, user deletion, enquiry history and document removal | Approve retention periods and deletion/anonymization workflow; prevent orphan ownership and accidental cascade loss; ensure backups have a defined retention lifecycle |
| GAP-20 | Backup, recovery and monitoring acceptance targets | Set RPO/RTO, backup/object scope, alerts, owners and restore evidence; a database backup alone is not assumed to restore Storage bytes |
| GAP-21 | API/action contracts and idempotency lifetime | Freeze operation bindings, schemas, status/error mapping, request size ceilings, key scope/TTL and retry outcomes; preserve the source response envelope |
| GAP-22 | Schema/grants/RLS coverage beyond core tables | Add missing reports/preferences/settings/slug history/delivery intents and review version storage as needed; protect all exposed tables, views, functions and Storage objects |
| GAP-23 | Admin bulk actions and destructive confirmation | Inventory exactly supported bulk actions; per-row permission/state/version checks and explicit partial-failure summary; no hidden mass action implied by selection |
| GAP-24 | Notification/security events and operational diagnostics | Complete security-notification template, redaction rules, event correlation and delivery state machine; never log OTP/tokens/document bodies |
| GAP-25 | Maps, external links and precise location disclosure | Choose configured maps adapter; validate coordinates and external URLs; freeze approximate versus precise public location and fallback behavior |
| GAP-26 | Accessibility/browser budgets and measurable performance harness | Fix supported browsers, target viewports, JS/query/payload budgets, load dataset, network profile and measurement method; preserve existing performance targets |
| GAP-27 | Scheduled expiry/cleanup/delivery jobs and deployment safety | Define authenticated scheduling, idempotent batches, leases/checkpoints, time semantics, migration order and rollback/roll-forward procedure |
| GAP-28 | Support/legal/footer content and post-MVP isolation | Supply actual approved copy/contact destination; keep unimplemented payments, subscriptions, social login and other later features absent or explicitly disabled |

### 2.1 Publication and transition oracles

Use one server-owned eligibility function consistently in search, home, details, similar results, location results, enquiry creation, public metadata and sitemap. Its finalized predicate must include every GAP-02 dimension. Merely displaying a Verified badge is not authorization. `status` and `verification_status` must not contradict each other; define their relationship in GAP-13.

| From | Action / next state | Authorized actor | Required invariant |
|---|---|---|---|
| draft | submit → submitted | Owning seller/agent | Complete valid snapshot, uploads finalized, phone verified |
| submitted | begin review → under_review | Admin/super admin | Exact revision claimed, action audited |
| under_review | request changes → changes_required | Admin/super admin | Required feedback, no publication |
| changes_required | resubmit → submitted | Owning seller/agent | Corrected revision and fresh validation |
| under_review | reject → rejected | Admin/super admin | Reason retained, no publication |
| under_review | approve → verified | Admin/super admin | Exact revision approved; publication fields, review and audit consistent |
| verified | mark sold → sold | Actor permitted by GAP-13 | New enquiries/discovery follow GAP-02, history preserved |
| sold | archive → archived | Actor permitted by GAP-13 | Hidden state and retention rules preserved |
| Any other pair | Deny unless GAP-13 explicitly defines an override | Nobody by default | No arbitrary PATCH of status; override requires super-admin capability and reason |

Generate all 8 × 8 source/target combinations for each applicable actor and ownership scope. A no-op replay of a known idempotent operation is distinct from a new transition. Soft deletion and publication timestamps are independent flags and cannot bypass the state machine.

## 3. Fixtures, isolation and boundary data

**F0:** disposable local or staging Supabase database and isolated private Tigris bucket/prefix namespace; migrations applied; seeded roles/locations; deterministic test clock and seed where controllable; one test-run namespace per worker; clean provider fake inbox; production destinations disabled; baseline roles/policies and constraints frozen; reset/cleanup tracked. The system under test is the actual application/service, not a mock implementation of its business rules.

| Fixture | Required variants |
|---|---|
| Actors | Anonymous; buyerA/buyerB; sellerA/sellerB; agentA/agentB; adminA/adminB; superAdminA/superAdminB; each role suspended; expired/revoked sessions; unknown/deleted profile; approved multi-role account |
| Listings | Each of draft, submitted, under_review, changes_required, rejected, verified, sold, archived owned by A and B; soft-deleted; unpublished; future published; expiry null/before/equal/after now; seller suspended; location inactive; contradictory status fixture rejected by constraints |
| Search | 0, 1, limit−1, limit, limit+1, 2×limit and large datasets; equal publish times, equal prices/areas, different IDs; all allowed types/sellers/features; rupee/area precision boundaries; sparse metadata |
| Geography | Every initial location: Coorg, Madikeri, Kushalnagar, Virajpet, Somwarpet, Gonikoppal, Suntikoppa, Boikere, Napoklu; active/inactive parent and child; unknown/non-Coorg IDs; hierarchy-cycle attempts |
| Files | Valid JPEG/PNG/WebP/PDF; selected document image types; exactly size/pixel/count limits; zero bytes; truncated/corrupt; MIME/extension/signature mismatch; Unicode and traversal filenames; EXIF rotation/GPS; huge pixel count; PDF with active content/encryption |
| Content | Empty/blank/missing/null; Unicode/Kannada, combining characters, emoji, apostrophes, RTL, line breaks; long words; URL/HTML/script payloads; old/colliding slugs; unpublished/published guides |
| Failures | Database/storage/auth unavailable; slow/out-of-order responses; timeout before/after commit; provider 400/401/403/429/5xx; invalid JSON; network loss; denied third-party scripts; process termination |

### 3.1 Boundary matrix required for every applicable input

Bind these to shared configuration under GAP-03. Unknown limits are BLOCKED, not invented numbers. A test harness must emit a named instance per field/value/transport.

| Domain | Values / assertion |
|---|---|
| Required text | Missing, null, empty, spaces, tabs/newlines, trimmed valid value, min−1/min/min+1 and max−1/max/max+1 length; freeze character versus byte counting |
| Optional text | Omitted versus null versus blank semantics, clearing an existing value, max boundaries; avoid overwriting omitted fields in PATCH |
| Numbers | Negative, zero, smallest positive quantum, decimals, max−quantum/max/max+quantum, huge exponent, NaN/Infinity strings, unsafe JS integer, comma/currency-formatted input, numeric string versus number, negative zero |
| Money / area | Decimal precision, rounding midpoint, no floating-point drift, INR display versus canonical numeric storage, area unit conversion, no divide-by-zero, min = max, reversed bounds |
| Enums / IDs | Every allowed value, unknown value, wrong case, blank, array/object injection; valid UUID owned/other/missing/malformed; inactive references |
| Time | TTL−1 ms/TTL/TTL+1 ms, cooldown boundary, midnight/reporting timezone, month/year/leap-day boundaries, future dates, server/browser clock skew; test actual provider timing separately from fake clocks |
| Files | 0/1/max−1/max/max+1 bytes; min/max width and height; pixel-count limit; 0/1/count-limit/count-limit+1 including simultaneous uploads |
| Pagination | Missing/default, 0, 1, last, last+1, negative, fraction, huge number, duplicate query keys, malformed/oversized cursor, limit 25/50/100 and 101 for admin |
| Rate limits | L−1/L/L+1 requests in window W; exactly reset boundary; parallel requests; multiple instances; phone/IP/user/device/action scope and proxy spoofing |
| Collections | 0/1/max/max+1; repeated IDs, reordered IDs, foreign IDs, null entries; oversized JSON body and deeply nested payloads |

Use exhaustive enumeration for finite permission/state/enum sets, explicit boundary partitions, and pairwise covering arrays for search/UI combinations. Add full high-risk combinations: hidden listing + known URL + warm cache; stale admin + changed revision; upload near quota + parallel finish; suspended actor + old JWT; retry after committed enquiry + provider timeout. Pairwise coverage never substitutes for these combinations.

## 4. Authorization and database test matrices

### 4.1 Application capabilities

`Own` includes server-derived ownership; a request-supplied ID never grants ownership. `Decision` means GAP closure is required. Super-admin inherited capabilities must be explicitly granted, not inferred from its name.

| Capability | Guest | Buyer | Seller / Agent | Admin | Super admin |
|---|---|---|---|---|---|
| Read eligible public content | Yes | Yes | Yes | Yes | Yes |
| Save / enquire / own enquiry history | Login gate | Own | Decision: combined buyer capability; no self-contact | Decision: explicit capability | Decision: explicit capability |
| Create / edit / submit property | No | No until approved seller onboarding | Own + allowed state | Moderation capabilities only unless separately a seller | Explicit granted capabilities |
| Received enquiries | No | No | Own property only | Authorized moderation view | Explicit authorized view |
| Upload media / documents | No | No | Own + allowed state | Document review only; uploads if explicitly allowed | Explicit authorized operation |
| Review / approve / reject / request changes | No | No | No | Yes | Yes if granted |
| Manage ordinary users, locations, guides, reports | No | No | No | Yes | Yes if granted |
| Assign admin roles / system settings / flags / overrides | No | No | No | No | Yes |
| Read audit logs | No | No | No | Decision; default no | Yes |
| Own profile / preferences | No | Own safe fields | Own safe fields | Own safe fields | Own safe fields |

For each row test visible controls, direct URL, action/HTTP request and direct Supabase where exposed. Repeat with suspended/expired/deleted actors. Hidden controls alone do not pass permission testing. Recheck authorization at mutation time, including if role changes after a page loads.

### 4.2 Direct Supabase expected access

Privileged server operations use a server-only service-role client **after** current actor authorization. Positive admin API tests and negative ordinary admin-browser direct-DB tests are separate. Do not run RLS isolation tests with service-role credentials; a service role bypasses RLS. RLS row rules alone do not protect privileged columns.

| Table / object | Required direct-client access baseline | Forbidden access to test |
|---|---|---|
| profiles | Own safe profile read/update; approved public seller projection only | Other private email/phone, is_suspended/user_type privilege writes, enumeration |
| roles / user_roles | Only intentionally exposed role metadata; own role read if required | Self-grant, role replacement, other users' role writes; all ordinary role mutations |
| properties | Public eligible projection; own seller records and permitted draft edits | Hidden rows, foreign mutations, owner/status/verification/feature/publication/deletion privilege writes |
| property_media / property_features | Public eligible child projection; owner actions if policy permits | Parent hidden/foreign rows; attaching foreign objects; orphan insert |
| property_documents | Owner access only if explicitly allowed; authorized review via server | Guest/buyer/other-seller read, signing, download, list or mutation; public bucket copy |
| locations | Active public data | Public mutations, inactive data unless allowed, hierarchy corruption |
| favorites | Own select/insert/delete | Foreign favorites, forged user_id, hidden property insertion |
| enquiries | Buyer owns sent record; seller owns received record, approved fields | Third-party read, reassignment, status fields outside role policy, forged identities |
| recently_viewed | Own select/write/delete | Other user history, forged user_id, private property exposure |
| verification_reviews / admin_notes | Privileged server only; sanitized owner-facing feedback if explicitly projected | Internal notes/reviewer details disclosure or client mutations |
| audit_logs | Privileged server write; authorized audit read only | Client insert/update/delete; forged actor/event; ordinary admin read unless authorized |
| notifications | Own sanitized read and allowed read-state action | Foreign messages, delivery-state/provider-ID forgery |
| articles | Published public projection | Draft/private author fields; public write/publish |
| Tigris buckets / S3 objects (separate from PostgreSQL) | Server-authorized app grants/proxies; all origin buckets private; approved photos delivered through app media URLs | Unsigned object access, arbitrary signing, overwrite/copy across owners, private document proxy/cache leak and public ACL changes |
| New schema objects | GAP-22 tables, views, RPCs, jobs and sequences individually inventoried | Missing RLS/grants, unsafe definer execution, broad SELECT exposing private columns |

For each database table exercise SELECT (including count and embedded joins), INSERT, UPDATE, DELETE and UPSERT, using own/other/nonexistent parents and ID substitutions. For disallowed reads, zero visible rows or access denial is acceptable according to the adapter; for disallowed writes verify rows affected = 0 or an explicit error AND unchanged DB state. PostgREST returning HTTP 200 with no rows is not an authorization failure. Verify positive controls so blanket deny-all policies do not falsely pass. Tigris has no Supabase `storage.objects` policy in this architecture: test its S3/credential/presigned/proxy controls separately under STOR; never send a Supabase user JWT to Tigris as if it were an S3 credential.

## 5. API / Server Action operation inventory

The source specifies route groups, not concrete endpoint names. These are **logical operations to bind to implementation**, not a claim that routes exist. Record actual method/path or exported action, schema, role, idempotency/version field and error mapping in the test harness. Use `AUTH_REQUIRED`/401, `FORBIDDEN`/403, hidden/not-found/404, validation/400 or 422 (choose one), conflict/409, too-large/413, unsupported media/415, rate-limit/429 and safe dependency/5xx as the proposed HTTP mapping. Server Actions must expose equivalent typed domain results without relying on HTML redirects alone.

| Operations | Required contract / effects | Main suites |
|---|---|---|
| auth.requestOtp, auth.verifyOtp, auth.resendOtp, auth.logout, auth.session | Normalized phone/challenge, authenticated session only after verification, safe return path | AUTH, SMS, SEC |
| property.search, property.read, property.similar | Validated filters/sort/page; eligibility; minimal public DTO; cursor/count metadata | SEARCH, PAGE, DETAIL, SEO |
| property.createDraft, updateDraft, readOwn, listOwn, submit, markSold, archive/delete | Server owner, schema, version, status machine, durable result, appropriate idempotency | PROP, LIFE, CONC |
| media.initiateUpload, finalizeUpload, reorder, setCover, remove; document.sign/read/remove | Object scope, validated bytes, parent state, progress/failure cleanup, private access | MEDIA, DOC, RLS |
| favorite.add/remove/list; history.record/list/clear | Own identity, dedupe, visibility-safe projection, pagination | SAVE, HISTORY |
| enquiry.create/listSent/listReceived/updateStatus; report.create/list/review | Valid parent/roles, anti-spam/idempotency, safe messages, status policy | ENQ, REPORT |
| profile.read/update, account.updatePhone/updateEmail, preferences.read/update | Own safe fields, identity re-verification, no role escalation | PROFILE, ROLE |
| admin.queue/readReview/claimReview/approve/reject/requestChanges/addNote | Authorized exact revision, atomic review/audit/status, notification intent | ADMIN, LIFE |
| admin.properties/users/enquiries; feature/unpublish/suspend/reactivate/changeRole | Current privileged scope, pagination, reason/audit, stale-version checks | ADMIN, ROLE, API |
| location.list/read/create/update/deactivate; article.list/read/create/update/publish/unpublish | Hierarchy/publishing/slug integrity, sanitization, metadata/cache changes | LOC, CMS |
| analytics.aggregate; dashboard.summary | Authorized scoped aggregates, bounded date range, correct timezone, no raw private rows | DASH, CHART |
| settings.read/update; flags.update; audit.list | Super-admin boundary, allowlisted config, masking, audit, rollback | SETTINGS, ROLE |
| provider.smsHook, provider.deliveryWebhook; notification.dispatch/retry | Provider-specific authentication, schema and replay guard, delivery states | SMS, MAIL, API |
| jobs.expiry, jobs.cleanup, jobs.retention, jobs.deliveryRecovery | Authenticated job principal, idempotent bounded batches, checkpoints | REC, OPS |
| metadata, sitemap, robots, redirects, health | Correct public eligibility and environment; no sensitive diagnostics | SEO, OPS |

Every operation inherits API-001 through API-010 and applicable permission/RLS/boundary tests. The common success envelope is `{data, error:null, meta}`; error is `{data:null, error:{code,message,...}, meta?}` with documented optional fields. JSON serializes money/time consistently; no BigInt/NaN leaks or raw SQL/provider stack traces.

## 6. Feature test catalog

All cases below are specifications awaiting implementation/execution. Preconditions include F0. Suite source notes provide traceability to the synchronized source documents (design/architecture storage and deployment rules are updated for the latest user requirements); section 9 provides the reverse coverage map.


### Catalog index

**344 case families · 38 suites · 213 P0 / 129 P1 / 2 P2.** Parameter matrices expand these into additional separately reported executions. These counts describe specifications, not executed tests.

| Suite | Cases | Focus |
|---|---|---|
| [AUTH](#auth-tests) | AUTH-001–AUTH-017 (17) | Phone OTP, sessions and login recovery |
| [SMS](#sms-tests) | SMS-001–SMS-007 (7) | MSG91 delivery adapter and Supabase SMS hook |
| [ROLE](#role-tests) | ROLE-001–ROLE-008 (8) | Role assignment and authorization boundaries |
| [HOME](#home-tests) | HOME-001–HOME-005 (5) | Homepage, navigation and public entry points |
| [SEARCH](#search-tests) | SEARCH-001–SEARCH-011 (11) | Filtering, sorting, URL state and debounce |
| [PAGE](#page-tests) | PAGE-001–PAGE-008 (8) | Cursor pagination and server-side admin offset |
| [PROP](#prop-tests) | PROP-001–PROP-015 (15) | Seller/agent posting, drafts and validation |
| [LIFE](#life-tests) | LIFE-001–LIFE-008 (8) | Property lifecycle and publication invariants |
| [DETAIL](#detail-tests) | DETAIL-001–DETAIL-007 (7) | Property detail, gallery, map and trust content |
| [MEDIA](#media-tests) | MEDIA-001–MEDIA-010 (10) | Property images, uploads and object lifecycle |
| [DOC](#doc-tests) | DOC-001–DOC-009 (9) | Private verification documents and review access |
| [ADMIN](#admin-tests) | ADMIN-001–ADMIN-012 (12) | Verification and administrative management |
| [ENQ](#enq-tests) | ENQ-001–ENQ-012 (12) | Contact Owner, buyer enquiries and seller inbox |
| [SAVE](#save-tests) | SAVE-001–SAVE-005 (5) | Saved properties and optimistic interaction |
| [HISTORY](#history-tests) | HISTORY-001–HISTORY-003 (3) | Recently viewed privacy and ordering |
| [PROFILE](#profile-tests) | PROFILE-001–PROFILE-007 (7) | Profile, account settings and preferences |
| [DASH](#dash-tests) | DASH-001–DASH-005 (5) | Buyer and seller dashboard completeness |
| [LOC](#loc-tests) | LOC-001–LOC-005 (5) | Locations, hierarchy and landing pages |
| [CMS](#cms-tests) | CMS-001–CMS-006 (6) | Guides and article management |
| [REPORT](#report-tests) | REPORT-001–REPORT-005 (5) | Report listing and moderation workflow |
| [SETTINGS](#settings-tests) | SETTINGS-001–SETTINGS-004 (4) | System settings, feature flags and safe configuration |
| [MAIL](#mail-tests) | MAIL-001–MAIL-008 (8) | Brevo templates, delivery status and retry safety |
| [CHART](#chart-tests) | CHART-001–CHART-006 (6) | Admin Apache ECharts analytics and metric correctness |
| [DB](#db-tests) | DB-001–DB-009 (9) | Database constraints, transactions and migrations |
| [RLS](#rls-tests) | RLS-001–RLS-011 (11) | Direct Supabase RLS and paired object authorization |
| [API](#api-tests) | API-001–API-010 (10) | Shared API/action contracts and transport edges |
| [SEC](#sec-tests) | SEC-001–SEC-013 (13) | Application and infrastructure security regression |
| [CONC](#conc-tests) | CONC-001–CONC-007 (7) | Concurrency, transaction ordering and idempotency |
| [CACHE](#cache-tests) | CACHE-001–CACHE-007 (7) | Next.js server caching, freshness and invalidation |
| [REC](#rec-tests) | REC-001–REC-008 (8) | Failures, recovery and data reconciliation |
| [UI](#ui-tests) | UI-001–UI-009 (9) | Responsive UI, design consistency and browser behavior |
| [A11Y](#a11y-tests) | A11Y-001–A11Y-007 (7) | Accessibility and assistive-technology acceptance |
| [SEO](#seo-tests) | SEO-001–SEO-012 (12) | SSR, metadata, canonical routing and crawlability |
| [PERF](#perf-tests) | PERF-001–PERF-014 (14) | Optimization, virtualization, indexing and load |
| [OPS](#ops-tests) | OPS-001–OPS-010 (10) | Environment, deployment and release operations |
| [E2E](#e2e-tests) | E2E-001–E2E-024 (24) | Playwright end-to-end journeys and orchestration |
| [STOR](#stor-tests) | STOR-001–STOR-012 (12) | Private Tigris object storage and cross-service consistency |
| [CLI](#cli-tests) | CLI-001–CLI-008 (8) | AI workspace readiness and verified service connections |

<a id="auth-tests"></a>

### AUTH — Phone OTP, sessions and login recovery

Source coverage: architecture §§10–11,24–29,36; design §§21,25; continue phase 3.

#### AUTH-001 — New and returning phone login

**Priority:** P0

**Preconditions:** F0; new phone and existing buyer phone; SMS fake captures hook dispatch.

**Steps:**

1. Request OTP.
2. Enter correct code.
3. Reload a protected dashboard.
4. Repeat with returning user.

**Expected Result:** One identity/profile per normalized phone; session is verified; permitted dashboard loads; welcome event only for new account.

**API coverage:** auth.requestOtp/verifyOtp/session; assert Auth and profile records, safe response and event counts.

**Playwright coverage:** PW: auth.spec.ts; complete real local Auth round trip with controlled SMS transport.

#### AUTH-002 — Phone normalization and country validation

**Priority:** P0

**Preconditions:** F0; frozen supported countries and phone parser.

**Steps:**

1. Submit local and international equivalent forms, whitespace, punctuation, missing/short/long/letter values and unsupported countries.

**Expected Result:** Accepted equivalents resolve to one account; invalid or unsupported numbers fail before SMS dispatch; normalized phone retained.

**API coverage:** Request and direct action with every phone partition; assert zero invalid-provider calls.

**Playwright coverage:** PW: input formatting, country selector and field errors; full partitions at API layer.

#### AUTH-003 — OTP format and input interaction

**Priority:** P1

**Preconditions:** F0; active challenge; configured OTP length.

**Steps:**

1. Type, paste, backspace and autofill a code.
2. Submit blank, too short/long, non-digit and leading-zero values.

**Expected Result:** Digits and leading zeros preserved; malformed input rejected consistently; focus/order accessible; no accidental repeated verification.

**API coverage:** Verify schema partitions; do not coerce code to number.

**Playwright coverage:** PW: keyboard/paste/autofill-like input on desktop/mobile OTP form.

#### AUTH-004 — Incorrect, expired, reused and cross-phone OTP

**Priority:** P0

**Preconditions:** F0; independent challenges for phone A/B; frozen expiry.

**Steps:**

1. Try wrong code, A code for B, code at expiry−1/expiry/expiry+1.
2. Reuse a successfully consumed code.

**Expected Result:** Only valid unexpired matching challenge succeeds once; failures issue no session and disclose no OTP. Provider timing contract decides exact boundary.

**API coverage:** Real Auth integration plus deterministic adapter time cases; inspect sessions and attempt counters.

**Playwright coverage:** PW: wrong/expired/reused messages and retry without losing phone.

#### AUTH-005 — Resend cooldown and superseded challenges

**Priority:** P0

**Preconditions:** F0; resend policy and clock defined.

**Steps:**

1. Send.
2. Resend before/at/after cooldown.
3. Receive delayed first SMS after second.
4. Try both codes and refresh timer.

**Expected Result:** Server enforces cooldown independent of browser; documented Supabase challenge behavior is applied; resend does not reset abuse quota; UI timer reflects server remaining time.

**API coverage:** Concurrent request/resend across tabs and instances; verify provider call count.

**Playwright coverage:** PW: timer refresh, disabled resend, delayed-code recovery; no arbitrary sleeps.

#### AUTH-006 — Attempt exhaustion and reset boundary

**Priority:** P0

**Preconditions:** F0; verification attempt limit L/window W fixed.

**Steps:**

1. Submit L−1, L and L+1 wrong codes.
2. Parallelize final attempts.
3. Change tabs/IP and then cross reset boundary.

**Expected Result:** No extra verification allowed beyond policy; counter is atomic at authoritative scope; useful retry time; legitimate retry works after reset.

**API coverage:** Direct Auth/application guard tests; assert rate response and no session.

**Playwright coverage:** PW: locked-state UX; API owns parallel/boundary variants.

#### AUTH-007 — Safe continuation after login

**Priority:** P0

**Preconditions:** F0; guest on a property, save action or post-property entry.

**Steps:**

1. Trigger gate.
2. Authenticate.
3. Return to original destination.
4. Repeat with deleted destination and external/protocol-relative/encoded return URLs.

**Expected Result:** Safe same-origin path/filter state restored; no external redirect; missing target has fallback; enquiry or listing is never submitted without required user confirmation.

**API coverage:** Validate return-path allowlist, encoded variants and unauthorized target.

**Playwright coverage:** PW: gate from Contact Owner, Saved and Post Property, including cancelled login.

#### AUTH-008 — Refresh and session expiry while editing

**Priority:** P0

**Preconditions:** F0; seller with unsaved/durable draft and expiring session.

**Steps:**

1. Expire access token.
2. Perform authenticated read and autosave.
3. Refresh once.
4. Then expire/revoke refresh capability and retry.

**Expected Result:** Valid refresh preserves identity; failed refresh prompts re-login, preserves recoverable form state and never commits as guest or another user.

**API coverage:** session/updateDraft with valid/invalid refresh, missing cookies and token mismatch.

**Playwright coverage:** PW: edit→expiry→login→resume; inspect saved versus unsaved indicators.

#### AUTH-009 — Logout, back navigation and account switching

**Priority:** P0

**Preconditions:** F0; user A private data viewed; user B exists.

**Steps:**

1. Logout.
2. Use back/forward, reload and prefetched links.
3. Log in as B in same browser.

**Expected Result:** A private content and requests are inaccessible; caches/storage cannot leak A data to B; UI reflects logout across relevant tabs. Token revocation semantics are explicitly tested.

**API coverage:** Logout/session/private reads; verify current principal rather than cookie existence.

**Playwright coverage:** PW: back/forward cache and two-account isolation flow.

#### AUTH-010 — Suspended/deleted account and stale session

**Priority:** P0

**Preconditions:** F0; each role has active session then is suspended, deleted or stripped of role.

**Steps:**

1. Call protected operations using old session.
2. Reload page.
3. Attempt new OTP login.

**Expected Result:** Server checks current allowed account state; protected actions denied; no resurrection or privileged success from stale claims; user sees recovery/support route.

**API coverage:** All protected operation families plus direct RLS with real user token.

**Playwright coverage:** PW: seller/admin session while another context changes account state.

#### AUTH-011 — Duplicate verify and first-login profile race

**Priority:** P0

**Preconditions:** F0; new phone; synchronized two requests.

**Steps:**

1. Verify same challenge concurrently.
2. Retry lost response.
3. Load profile immediately on success.

**Expected Result:** At most one identity/profile and welcome intent; no partial privileged account; deterministic consumed-code or existing-session result.

**API coverage:** Assert profile uniqueness, transaction/error recovery and counters.

**Playwright coverage:** PW: double click disabled; backend barrier test owns exact race.

#### AUTH-012 — Missing profile and Auth/database partial failure

**Priority:** P0

**Preconditions:** F0; Auth identity exists without profile; profile creation fault injected.

**Steps:**

1. Log in.
2. Load protected pages.
3. Retry provisioning after recovery.

**Expected Result:** No unauthorized defaults or blank privileged page; recoverable onboarding/error; profile created once with least privileges.

**API coverage:** Provisioning service with transaction failures and idempotent retry.

**Playwright coverage:** PW: recoverable error then successful least-privilege onboarding.

#### AUTH-013 — Session transport and browser storage safety

**Priority:** P0

**Preconditions:** F0; chosen Supabase SSR/session storage model documented.

**Steps:**

1. Inspect cookies/storage, network, HTML/RSC and logs before/after login/logout.
2. Test HTTPS, same-site and alternate origin.

**Expected Result:** Only intended session material exists; cookies have applicable Secure/SameSite flags; HttpOnly where compatible with chosen model; tokens absent from URLs/logs/public caches.

**API coverage:** Header/session tests and production-build bundle scan; no assumption all Supabase tokens can be HttpOnly.

**Playwright coverage:** PW: cookies/storage inspection and cross-context isolation.

#### AUTH-014 — Offline login and provider response recovery

**Priority:** P1

**Preconditions:** F0; request can fail before or after SMS acceptance.

**Steps:**

1. Disconnect during request/verify.
2. Reconnect.
3. Retry.
4. Change phone mid-request.

**Expected Result:** No false login/sent success; pending state resolves; latest phone remains authoritative; retry respects quota and does not create an uncontrolled SMS burst.

**API coverage:** Timeout-before/after acceptance, cancellation and delayed-response service tests.

**Playwright coverage:** PW: offline/online, stale response and retry states.

#### AUTH-015 — Optional login methods remain gated

**Priority:** P1

**Preconditions:** F0; Google and email magic link are post-MVP.

**Steps:**

1. Inspect login and directly request unconfigured login methods.

**Expected Result:** Unavailable methods are absent or explicitly disabled; no broken provider redirects or accidental alternate privilege path.

**API coverage:** Unsupported-method/action tests.

**Playwright coverage:** PW: visible options and unsupported route behavior.

#### AUTH-016 — Tampered JWT, issuer/audience and session confusion

**Priority:** P0

**Preconditions:** F0; authentic A/B sessions and safe invalid-token fixtures.

**Steps:**

1. Submit altered signature/algorithm/issuer/audience/subject, expired/not-yet-valid token, missing profile and mismatched cookie/bearer identity.

**Expected Result:** Only cryptographically verified intended Supabase identity accepted; deterministic credential precedence or rejection; no trust in unverified claims; no A request executed as B.

**API coverage:** Protected reads/actions and direct Supabase integration; test server verification path independently of UI.

**Playwright coverage:** PW API negative tokens; browser redirects safely to re-authentication.

#### AUTH-017 — Concurrent session refresh and multi-tab logout

**Priority:** P0

**Preconditions:** F0; two tabs share expiring session; supported session scope documented.

**Steps:**

1. Trigger concurrent refresh.
2. Logout one tab while other refreshes.
3. Replay old refresh/access material according to policy.

**Expected Result:** No refresh loop, session resurrection or cross-user mutation; supported logout scope and access-token lifetime explicitly tested; UI clears current account state; stronger immediate revocation implemented if promised.

**API coverage:** Auth SDK/server refresh cookie race and revocation contract tests.

**Playwright coverage:** PW: two-tab expiry/logout race and final private-page denial.


<a id="sms-tests"></a>

### SMS — MSG91 delivery adapter and Supabase SMS hook

Source coverage: architecture §§10–11,25,27,29,44; continue phases 3,18.

#### SMS-001 — Supabase-issued OTP delivered by MSG91

**Priority:** P0

**Preconditions:** F0; configured SMS hook and provider contract fixture.

**Steps:**

1. Trigger Supabase phone OTP.
2. Inspect hook input and MSG91 request.
3. Verify through Supabase.

**Expected Result:** Same Auth-issued OTP is delivered using configured template; MSG91 does not become a second verifier/session issuer; no OTP in client response or logs.

**API coverage:** auth.requestOtp→smsHook→SmsProvider contract; auth.verifyOtp against Supabase.

**Playwright coverage:** PW: AUTH-001 journey; one allowlisted staging delivery smoke separately.

#### SMS-002 — Hook authentication and replay

**Priority:** P0

**Preconditions:** F0; actual hook authentication scheme configured.

**Steps:**

1. Send valid, missing, invalid and tampered authentication.
2. Replay event.
3. Alter timestamp/body and use stale event if timestamp validation applies.

**Expected Result:** Only authentic correctly bound hook accepted; replay/duplicate protection avoids duplicate delivery under frozen contract; rejects have no SMS effect.

**API coverage:** Direct hook request using provider-supported verification mechanism; do not invent signature headers.

**Playwright coverage:** PW API only; browser cannot legitimately invoke hook.

#### SMS-003 — MSG91 request/schema and template failures

**Priority:** P0

**Preconditions:** F0; template/sender configuration and phone mapping fixed.

**Steps:**

1. Send valid payload.
2. Inject bad template, unauthorized credential, missing variable, invalid phone and invalid JSON response.

**Expected Result:** Correct encoding/template on success; permanent errors safely classified; no false delivered/session state; operational error is redacted.

**API coverage:** SmsProvider 400/401/403 and semantic-error-in-200 fixtures.

**Playwright coverage:** PW: safe user error with retry/support path, no provider secrets.

#### SMS-004 — Throttling, outage and ambiguous acceptance

**Priority:** P0

**Preconditions:** F0; retry budget defined; fake can accept then time out.

**Steps:**

1. Return 429, 5xx, timeout before send, timeout after send.
2. Recover and retry.

**Expected Result:** Retry-after/backoff respected; attempt budget bounded; ambiguous delivery recorded honestly; application does not repeatedly generate/send OTP automatically.

**API coverage:** Provider failure matrix plus request idempotency key/window test.

**Playwright coverage:** PW: resend timer and recovery feedback; backend checks dispatch counts.

#### SMS-005 — Delivery callbacks and ordering

**Priority:** P1

**Preconditions:** F0; callbacks enabled only if selected integration supports them.

**Steps:**

1. Deliver success/failure, duplicate, out-of-order and unknown-message callbacks.
2. Try forged callback.

**Expected Result:** Authenticated known messages update valid delivery state only; duplicate harmless; late failure does not invent Auth/session outcome; unsupported callbacks documented N/A.

**API coverage:** Webhook schema/authentication/state tests with captured contract fixtures.

**Playwright coverage:** PW API; admin diagnostics can show sanitized delivery state.

#### SMS-006 — Staging and production SMS separation

**Priority:** P0

**Preconditions:** F0; explicit staging test-number allowlist and separate credentials.

**Steps:**

1. Run CI login.
2. Attempt non-allowlisted send.
3. Inspect production build/config for test OTP bypass.

**Expected Result:** Normal CI sends zero real SMS; staging sends only to designated test phones; production has no test bypass or fixed OTP.

**API coverage:** Environment guard and build/config integration checks.

**Playwright coverage:** PW: production-like build rejects test-login shortcuts; never send to real users.

#### SMS-007 — Direct Supabase Auth cannot bypass SMS abuse controls

**Priority:** P0

**Preconditions:** F0; Supabase publishable key is intentionally public; application and hook/Auth quotas configured.

**Steps:**

1. Request OTP directly through exposed Supabase Auth instead of Next.js.
2. Repeat/resend across app instances and alternate routes at quota.

**Expected Result:** MSG91 spend and verification attempts remain bounded by authoritative Auth/hook/shared controls; Next.js-only client throttling is not the sole guard; safe denial before repeated provider dispatch.

**API coverage:** Direct Auth OTP/resend/verify and SMS hook limiter integration with provider call count.

**Playwright coverage:** PW API direct Auth versus application paths; no real SMS in CI.


<a id="role-tests"></a>

### ROLE — Role assignment and authorization boundaries

Source coverage: architecture §§7–9,24,36; design §§18–19; continue phases 3,9,15.

#### ROLE-001 — Complete capability matrix

**Priority:** P0

**Preconditions:** F0; finalized section 4.1 matrix.

**Steps:**

1. For every actor/capability, inspect UI.
2. Navigate directly.
3. Invoke action/API.
4. Repeat own/other and suspended variants.

**Expected Result:** Every permitted operation succeeds with scope; every forbidden operation denies with no effect; route/layout guard cannot replace mutation checks.

**API coverage:** Parameterized matrix over all logical operations; RLS matrix separately uses user tokens.

**Playwright coverage:** PW: role-boundary.spec.ts; dashboard/admin routes and forbidden controls.

#### ROLE-002 — Buyer becomes seller or agent through approved onboarding

**Priority:** P0

**Preconditions:** F0; GAP-04 closed; buyer has only buyer capability.

**Steps:**

1. Start Post Property.
2. Complete required onboarding.
3. Choose permitted seller type.
4. Try forged admin/super-admin value.

**Expected Result:** Only intended capability added after requirements; identity/data preserved; actor cannot self-grant privileged role or agent quota.

**API coverage:** Onboarding/role mutation schemas and user_roles checks.

**Playwright coverage:** PW: buyer→seller→first draft; forbidden role injection via request client.

#### ROLE-003 — Ordinary admin versus super-admin management

**Priority:** P0

**Preconditions:** F0; adminA, adminB and superAdminA.

**Steps:**

1. Admin changes ordinary user role/suspension.
2. Attempts admin creation, super-admin edits, flags, settings and audit access.
3. Super admin performs allowed equivalents.

**Expected Result:** GAP-05 boundaries hold for each operation; allowed changes audited; denied calls cause no role/config changes.

**API coverage:** Management action matrix including direct stale requests.

**Playwright coverage:** PW: role-specific menu and direct URL behavior.

#### ROLE-004 — Privilege claims and mass assignment

**Priority:** P0

**Preconditions:** F0; ordinary authenticated user.

**Steps:**

1. Inject role/admin metadata, user_type, is_suspended=false, owner_id, featured, status and verification fields into allowed updates.

**Expected Result:** Allowlisted fields only; privilege fields denied/ignored per explicit schema, never persisted; trusted roles remain unchanged.

**API coverage:** Profile/property/auth-metadata tests plus direct user_roles/RLS writes.

**Playwright coverage:** PW API negative requests; browser profile remains least-privilege.

#### ROLE-005 — Role revoked after authorization screen loads

**Priority:** P0

**Preconditions:** F0; admin review/settings form open.

**Steps:**

1. Revoke/demote actor in second context.
2. Submit first form using old session and page.

**Expected Result:** Current capability rechecked; no privileged write or signed document issuance; route refresh shows correct access.

**API coverage:** Mutation authorization at transaction boundary; direct RLS stale JWT case.

**Playwright coverage:** PW: two browser contexts and visible forbidden recovery.

#### ROLE-006 — Last super-admin and self-lockout protection

**Priority:** P0

**Preconditions:** F0; one remaining active super admin; GAP-05 lockout policy fixed.

**Steps:**

1. Attempt self-demote/suspend/delete.
2. Race two super-admin demotions in a two-admin setup.

**Expected Result:** At least one recoverable authorized administrator remains per policy; protected changes atomically rejected; reason and audit accurate.

**API coverage:** Role-count/concurrency transactional test.

**Playwright coverage:** PW: confirmation and meaningful refusal; API covers simultaneous changes.

#### ROLE-007 — Agent inventory and isolated ownership

**Priority:** P1

**Preconditions:** F0; agent limit and seller limit fixed; near-quota accounts.

**Steps:**

1. Create up to quota.
2. Attempt extra draft/submit concurrently.
3. Open another agent inventory.

**Expected Result:** Quota applied at defined counting states without race bypass; larger agent allowance does not grant foreign access/team/subscription features.

**API coverage:** Quota boundary and listOwn ownership tests.

**Playwright coverage:** PW: agent inventory pagination, quota message and foreign direct URL.

#### ROLE-008 — Public seller summary versus private profile

**Priority:** P0

**Preconditions:** F0; seller has private phone/email and approved public fields.

**Steps:**

1. View listing as guest/buyer.
2. Inspect HTML/RSC/JSON and joins.
3. Request full profile directly.

**Expected Result:** Only approved public seller projection exposed; contact gate not bypassed by network or metadata; private fields remain protected.

**API coverage:** Property DTO, profile grants, joins and cache tests.

**Playwright coverage:** PW: payload inspection and Contact Owner gate.


<a id="home-tests"></a>

### HOME — Homepage, navigation and public entry points

Source coverage: design §§9–12,23–25,30; continue phases 1,4,18.

#### HOME-001 — Search-first home and all navigation destinations

**Priority:** P0

**Preconditions:** F0; populated public fixtures.

**Steps:**

1. Open home.
2. Use location/type/budget search.
3. Follow Buy, Locations, Property Types, Guides, Post Property, Saved and Account.

**Expected Result:** Correct destinations and URL filters; active state correct; protected actions gated; featured/recent/verified groups contain only eligible listings.

**API coverage:** Home/featured/recent/location summary eligibility and bounded payload.

**Playwright coverage:** PW: home.spec.ts on desktop/mobile and guest/authenticated variants.

#### HOME-002 — Popular chips and seller call to action

**Priority:** P1

**Preconditions:** F0; Madikeri/Kushalnagar/Virajpet and estate/farm fixtures.

**Steps:**

1. Select each popular chip and property-type entry.
2. Return home.
3. Activate seller CTA as guest and seller.

**Expected Result:** Exact intended filter, no inherited stale filter; readable selected state; seller entry resumes/starts correct flow.

**API coverage:** Search parameter mapping and allowed location/type values.

**Playwright coverage:** PW: chip navigation, back and role-appropriate CTA.

#### HOME-003 — Property card complete and robust

**Priority:** P1

**Preconditions:** F0; normal, long-title, missing-image and boundary-price cards.

**Steps:**

1. Render card variants.
2. Save/open each.
3. Tab through controls.

**Expected Result:** Image, badge, title, location, price, area, price per unit, seller type, date and CTA accurate; no nested-action accidental navigation; fallback and labels work.

**API coverage:** Public card DTO omits documents/full enquiry data; numeric/date formatting units tested.

**Playwright coverage:** PW: card rendering at all breakpoint widths, save propagation and fallback.

#### HOME-004 — Empty/loading/failure home sections

**Priority:** P1

**Preconditions:** F0; zero eligible listings and independent home service faults.

**Steps:**

1. Load empty.
2. Delay one section.
3. Fail featured feed.
4. Retry and navigate.

**Expected Result:** Useful empty CTAs and skeletons; no private fallback data or permanent spinner; unrelated navigation remains usable; error not misreported as zero inventory.

**API coverage:** Home section timeout/error classification and retry.

**Playwright coverage:** PW: route/provider fault injection and stable layout.

#### HOME-005 — Footer, support and legal destinations

**Priority:** P1

**Preconditions:** F0; GAP-28 approved contact, privacy, terms and disclaimer content.

**Steps:**

1. Open every footer/support/legal link with keyboard and mobile.
2. Inspect external destinations.

**Expected Result:** No dead/placeholder route, invented contact or false legal guarantee; actual approved content readable; external links safely handled.

**API coverage:** Public route status and external URL validation if stored.

**Playwright coverage:** PW: link crawl plus support/contact action; no message is sent by automated smoke.


<a id="search-tests"></a>

### SEARCH — Filtering, sorting, URL state and debounce

Source coverage: design §§10,13–14; architecture §§16–17,24,33; continue phases 4,17.

#### SEARCH-001 — Each supported filter and result eligibility

**Priority:** P0

**Preconditions:** F0; distinct fixtures for all filter values.

**Steps:**

1. Apply location, type, min/max price, min/max area/unit, seller type, verified-only, plantation, road access and water availability one at a time.

**Expected Result:** All returned IDs satisfy exact predicate and publication rules; missing/false/unknown feature values handled distinctly; result count matches stated count contract.

**API coverage:** property.search parameterized per filter, boundary and eligibility flag.

**Playwright coverage:** PW: search.spec.ts each control and server-rendered initial results.

#### SEARCH-002 — Combined filter logic

**Priority:** P0

**Preconditions:** F0; pairwise covering dataset and expected SQL-independent ID sets.

**Steps:**

1. Run pairwise combinations plus location+type+price+area+seller+features.
2. Exercise multiple locations only if supported.

**Expected Result:** Intersection/union semantics match contract; no ignored filters or duplicate joined rows; zero result valid; unsupported multivalue input rejected.

**API coverage:** Compare IDs to reference predicate, not the same query implementation.

**Playwright coverage:** PW: representative full combination, active chips/count and result total.

#### SEARCH-003 — Numeric range and area-unit boundaries

**Priority:** P0

**Preconditions:** F0; exact prices and areas in every supported unit.

**Steps:**

1. Set min=max.
2. Enter reversed/negative/huge/nonfinite values.
3. Switch acre/cent units with active bounds.
4. Test rounding edge.

**Expected Result:** Inclusive boundaries and conversions match frozen rules; equivalent areas match; display rounding never changes filter inclusion; invalid range errors do not silently broaden results.

**API coverage:** Decimal/reference conversion unit and service cases.

**Playwright coverage:** PW: range errors, unit switching and URL serialization.

#### SEARCH-004 — Query parsing and hostile URL parameters

**Priority:** P0

**Preconditions:** F0; URL query schema defined.

**Steps:**

1. Open URLs with repeated keys, malformed encoding, unknown slugs/enums, arrays, Unicode, whitespace, injection and excessive query length.

**Expected Result:** Deterministic safe rejection/normalization; no 500 or filter bypass; text preserved safely; no private data on fallback.

**API coverage:** Raw HTTP search/page requests and parser units for each partition.

**Playwright coverage:** PW: representative malformed deep links and recovery via Clear all.

#### SEARCH-005 — Sort order and tie-breakers

**Priority:** P0

**Preconditions:** F0; every allowed sort and equal publish/price/area values.

**Steps:**

1. Sort ascending/descending by supported choices.
2. Traverse pages.
3. Include null optional values.

**Expected Result:** Server applies allowlisted sort and deterministic ID tie-breaker; price/area uses canonical numeric units; documented null order; changing sort resets pagination.

**API coverage:** Reference ordered ID comparisons; unknown SQL sort strings denied.

**Playwright coverage:** PW: sort dropdown, URL state and page reset.

#### SEARCH-006 — Shareable URLs, back/forward and reload

**Priority:** P1

**Preconditions:** F0; search with filters, sort and later page.

**Steps:**

1. Open result, navigate back.
2. Reload.
3. Copy URL to fresh context.
4. Use browser forward/back after edits.

**Expected Result:** Committed search state and pagination reconstruct correctly; selected controls equal URL/server results; no hydration flicker to wrong query.

**API coverage:** URL encode/decode round-trip and server-rendered request.

**Playwright coverage:** PW: multi-navigation history with desktop/mobile states.

#### SEARCH-007 — Mobile apply/cancel and desktop immediate filters

**Priority:** P1

**Preconditions:** F0; committed filter set; mobile sheet closed.

**Steps:**

1. Edit mobile draft filters then cancel/Escape.
2. Reopen, apply and clear.
3. Repeat desktop immediate controls.

**Expected Result:** Cancel preserves committed URL/results; apply commits once; active count and Clear all accurate; focus returns; desktop semantics remain consistent.

**API coverage:** Search called only for committed mobile changes; clear resets page and cursor.

**Playwright coverage:** PW: sheet interactions at 360/390/430px and desktop.

#### SEARCH-008 — Debounce rapid typing and IME input

**Priority:** P1

**Preconditions:** F0; debounce delay D configured; request counter and controllable clock.

**Steps:**

1. Type a sequence faster than D.
2. Wait D−1/D/D+1.
3. Compose Kannada text with IME.
4. Press Enter/apply.
5. Clear while timer pending.

**Expected Result:** Only intended final query dispatches after D; composition not sent prematurely; explicit submit flushes or cancels once; clearing/unmount cancels stale timer; no lost final character.

**API coverage:** Unit/component timer tests and real server search request count; no fixed delay invented.

**Playwright coverage:** PW: rapid input, Enter and clear; assert final URL/results and request budget.

#### SEARCH-009 — Out-of-order responses and request cancellation

**Priority:** P0

**Preconditions:** F0; query A response delayed behind B.

**Steps:**

1. Enter A then B.
2. Resolve B then A.
3. Navigate away while a third query is pending.

**Expected Result:** Only current query updates list/count/errors/loading; aborted request cannot overwrite B or another page; final accessible status correct.

**API coverage:** Abort/correlation handling, canceled query timeout and server resource budget.

**Playwright coverage:** PW: controlled network response order and navigation.

#### SEARCH-010 — Empty, partial and unavailable results

**Priority:** P1

**Preconditions:** F0; zero matches, last item removed and search dependency failure.

**Steps:**

1. Search each fixture.
2. Relax filters.
3. Retry after failure.

**Expected Result:** Zero matches has useful next action; outage shows error not misleading zero; stale results, if shown, clearly labeled; no endless retry loop.

**API coverage:** Empty versus timeout versus malformed response typed results.

**Playwright coverage:** PW: no-results CTA, skeleton, retry and preserved filters.

#### SEARCH-011 — Server-side execution and bounded search payload

**Priority:** P0

**Preconditions:** F0; large dataset; network/DB instrumentation.

**Steps:**

1. Load and filter multiple pages.
2. Inspect SQL, payload and browser memory.

**Expected Result:** Server filters/sorts/paginates; browser never downloads all listings to filter; only card projection plus bounded metadata; no N+1 media/location fetches.

**API coverage:** EXPLAIN/query-count/payload assertions with public RLS and production-like indexes.

**Playwright coverage:** PW: network assertions; performance suite measures large data.


<a id="page-tests"></a>

### PAGE — Cursor pagination and server-side admin offset

Source coverage: architecture §§16–18,33; design §§13,19; continue phases 4,9,17.

#### PAGE-001 — Public first/next/last page boundaries

**Priority:** P0

**Preconditions:** F0; 0/1/L−1/L/L+1/2L eligible rows at public limit L.

**Steps:**

1. Request first and successive cursors through end.
2. Reload last page.
3. Follow next when absent.

**Expected Result:** Each unchanged eligible ID appears once in stable order; next cursor only when needed; bounded page and truthful empty/end state.

**API coverage:** Cursor parser/query tests with complete ordered expected set.

**Playwright coverage:** PW: pagination control/load-more behavior chosen in GAP-14.

#### PAGE-002 — Cursor filter/sort binding and tampering

**Priority:** P0

**Preconditions:** F0; valid cursor from one filter/sort; GAP-14 format fixed.

**Steps:**

1. Alter token, timestamp, ID, sort, filter scope and expiry/version if used.
2. Send huge or unrelated cursor.

**Expected Result:** Invalid/mismatched cursor rejected or explicitly resets as contracted; no injection/private rows; opaque token never treated as trusted SQL.

**API coverage:** All token partitions with bounded decoding and validation.

**Playwright coverage:** PW: invalid shared cursor produces recoverable result state.

#### PAGE-003 — Equal keys and changing live dataset

**Priority:** P0

**Preconditions:** F0; tied sort keys and live-keyset semantics documented.

**Steps:**

1. Fetch page 1.
2. Insert newer row, delete unseen row, update a sort key, then traverse.
3. Refresh from start.

**Expected Result:** No duplicates/skips among unchanged eligible rows under documented semantics; newly inserted earlier rows appear on refresh; moved/deleted rows follow live policy, not a false snapshot guarantee.

**API coverage:** Barrier-controlled database integration per supported sort.

**Playwright coverage:** PW: representative insert/remove during browse and refresh.

#### PAGE-004 — Numbered public pages and SEO mapping

**Priority:** P1

**Preconditions:** F0; page-number strategy and maximum deep-page policy fixed.

**Steps:**

1. Request page 1,2,last,last+1 and a deep page directly in a fresh context.
2. Change filters from page 2.

**Expected Result:** Direct URLs return defined stable results without needing prior browser cursor history; invalid/out-of-range behavior consistent; filter change resets page; no unbounded cursor walking.

**API coverage:** Numbered-to-query mapping, count/offset strategy and deep-page query-plan budget.

**Playwright coverage:** PW: reload/share numbered URLs and next/previous links.

#### PAGE-005 — Admin offset pagination sizes and totals

**Priority:** P0

**Preconditions:** F0; admin table data around 25/50/100 boundaries.

**Steps:**

1. Request pages at sizes 25,50,100.
2. Verify offset=(page−1)×limit.
3. Sort/filter.
4. Delete last row on last page.

**Expected Result:** Only requested window retrieved; deterministic order; totals and page count accurate at documented snapshot; out-of-range page handled; selection not silently applied to unseen rows.

**API coverage:** Server-side limit/offset queries for properties/users/enquiries/queue/audit/reports/CMS.

**Playwright coverage:** PW: table controls, page size, filters and empty-last-page recovery.

#### PAGE-006 — Pagination invalid values and ceilings

**Priority:** P0

**Preconditions:** F0; configured public and admin limits.

**Steps:**

1. Send missing, zero, negative, fractional, string, huge page/offset/limit and admin limit 101.
2. Repeated keys and integer overflow.

**Expected Result:** Defaults only where specified; invalid inputs rejected/capped by explicit rule; no all-rows request, overflow, expensive runaway offset or 500.

**API coverage:** All paginated operations share validated schema and hard bounds.

**Playwright coverage:** PW: invalid URL handling; PW API owns full partitions.

#### PAGE-007 — Offset drift and selection across page changes

**Priority:** P1

**Preconditions:** F0; admin offset list with new rows arriving.

**Steps:**

1. Select rows, page/filter/sort.
2. Concurrently insert/delete rows.
3. Refresh and execute supported bulk action.

**Expected Result:** Live offset may move rows as documented; selections are visible and correctly scoped/cleared; mutation revalidates actual IDs, never row positions.

**API coverage:** Bulk selection/version and table snapshot contract.

**Playwright coverage:** PW: explicit selection count, page switch and partial-result display.

#### PAGE-008 — Deep-page performance and indexes

**Priority:** P1

**Preconditions:** F0; stage-1 near-10k and projected 100k benchmark dataset; budgets fixed.

**Steps:**

1. Measure first/middle/deep public and admin pages with filters and representative role.
2. Inspect query plans.

**Expected Result:** Bounded rows/bytes; appropriate selective/composite indexes used when beneficial; deep offsets follow cap/alternative policy; no client fetch-all; measured p95 within budget.

**API coverage:** EXPLAIN ANALYZE in isolated DB, query count and load profiles; record plan rather than insist every small query uses index.

**Playwright coverage:** PW API latency/payload sampling; browser remains responsive.


<a id="prop-tests"></a>

### PROP — Seller/agent posting, drafts and validation

Source coverage: design §§17,21–25; architecture §§6–9,24–25,30; continue phases 5–6,8.

#### PROP-001 — Complete ten-step primary posting flow

**Priority:** P0

**Preconditions:** F0; eligible seller; valid location/photos/documents.

**Steps:**

1. Choose Property Type→Location→Property Details→Pricing→Features→Photos→Documents→Seller Details→Preview→Submit.

**Expected Result:** All ten steps reachable in order; final durable submitted record belongs to session owner; exact preview data saved; review queue entry once; no public publication.

**API coverage:** createDraft/updateDraft/finalizeUpload/submit; assert parent/children, revision and delivery intent.

**Playwright coverage:** PW: seller-posting.spec.ts complete journey for owner and agent.

#### PROP-002 — Minimal versus fully populated property

**Priority:** P0

**Preconditions:** F0; field requirements fixed per allowed type.

**Steps:**

1. Create minimal valid property.
2. Create one with every optional field.
3. Omit each required field individually at submission.

**Expected Result:** Minimal valid and complete records accepted; omitted required fields identified by step/label; draft may be incomplete but submission cannot be.

**API coverage:** Parameterized required-field matrix for type/location/title/description/price/area/unit/seller and conditional requirements.

**Playwright coverage:** PW: required markers, step errors and preview for both valid variants.

#### PROP-003 — Property type and listing/seller enums

**Priority:** P0

**Preconditions:** F0; frozen property_type/listing_type/seller_type sets.

**Steps:**

1. Exercise every allowed value.
2. Switch type after entering conditional features/documents.
3. Inject unknown type or unauthorized seller type.

**Expected Result:** Only supported values persist; obsolete conditional fields cleared or explicitly retained by rule; new requirements revalidated; role cannot be altered through seller_type.

**API coverage:** Shared Zod and DB constraints; PATCH mass-assignment partitions.

**Playwright coverage:** PW: type switches, step completion reset and conditional field visibility.

#### PROP-004 — Coorg location and coordinates

**Priority:** P0

**Preconditions:** F0; active, inactive, foreign and unknown locations; map policy fixed.

**Steps:**

1. Choose each seeded hierarchy.
2. Submit inactive/non-Coorg ID.
3. Test latitude ±90 and longitude ±180 boundaries, beyond bounds, one missing coordinate and malformed values.

**Expected Result:** Allowed Coorg location enforced; coordinate pair valid and precision controlled; invalid/reparented reference prevents submission with actionable error.

**API coverage:** Location FK/active validation and coordinate numeric boundaries.

**Playwright coverage:** PW: location combobox, map selection and field-error focus.

#### PROP-005 — Price, area and price-per-unit calculation

**Priority:** P0

**Preconditions:** F0; GAP-03 numeric limits/precision and positive-value rules fixed.

**Steps:**

1. Enter matrix numeric values.
2. Use decimal acre/cent area.
3. Toggle negotiable.
4. Tamper calculated price_per_unit.

**Expected Result:** Canonical decimal values accurate; zero/negative/overflow rejected per policy; unit conversion and rounding consistent; derived price server-computed, no divide by zero.

**API coverage:** Reference decimal calculations, DB precision/check constraints and tampered derived fields.

**Playwright coverage:** PW: INR/area formatting, unit labels and preview match stored values.

#### PROP-006 — Text, feature fields and length limits

**Priority:** P1

**Preconditions:** F0; full text/feature schema fixed.

**Steps:**

1. Enter Unicode/Kannada, line breaks, long words, blank/over-limit values, HTML/XSS and unknown feature keys.
2. Clear optional values.

**Expected Result:** Text safely rendered; required whitespace rejected; lengths enforced identically; allowlisted feature values retained; missing booleans distinct from false when specified.

**API coverage:** Boundary matrix for title/description/address/features and sanitation/escaping.

**Playwright coverage:** PW: field errors, safe preview and long-content layout.

#### PROP-007 — Back/next, step jumps and completion percentage

**Priority:** P1

**Preconditions:** F0; partially completed draft.

**Steps:**

1. Move forward/back.
2. Jump to incomplete/complete step.
3. Correct invalid field.
4. Remove required photo after preview.

**Expected Result:** No entered data lost; step navigation respects validation policy; completion is deterministic and excludes invalidated fields; submission revalidates every step.

**API coverage:** Completion/validation units and final service schema.

**Playwright coverage:** PW: stepper keyboard/mobile and progress updates.

#### PROP-008 — Explicit draft save and resume across sessions

**Priority:** P0

**Preconditions:** F0; seller with partial valid draft.

**Steps:**

1. Save draft at several steps.
2. Refresh.
3. Logout/login.
4. Resume from My Properties in fresh context.

**Expected Result:** Durable fields, uploads and last relevant step restored for owner only; no accidental duplicate draft or publication; save timestamp/status truthful.

**API coverage:** createDraft/readOwn/updateDraft with incomplete allowed shape.

**Playwright coverage:** PW: save→reload→new-session resume; compare fields and media IDs.

#### PROP-009 — Autosave debounce/throttle and final flush

**Priority:** P0

**Preconditions:** F0; autosave delay/max-wait strategy fixed; request/clock instrumentation.

**Steps:**

1. Type rapidly and continuously.
2. Pause.
3. Switch step.
4. Click Submit while save pending.
5. Navigate away/unmount.

**Expected Result:** Autosave batches changes with bounded wait; final values durably saved before submission; no stale timer after unmount; retry never overwrites newer revision; status distinguishes saving/saved/failed.

**API coverage:** Timer, max-wait, flush/cancel and concurrent version tests; count writes.

**Playwright coverage:** PW: continuous typing, step switch and pending-autosave submit.

#### PROP-010 — Autosave failure, refresh and unsaved-leave protection

**Priority:** P0

**Preconditions:** F0; durable draft plus unsaved edits; local recovery policy fixed.

**Steps:**

1. Fail save.
2. Refresh/close attempt.
3. Leave via internal link.
4. Restore network and retry.

**Expected Result:** Unsaved changes warning where browser supports it; saved values survive; local recovery, if used, is user-scoped and cleared appropriately; no false saved toast.

**API coverage:** Save-before/after-commit fault and retry/version semantics.

**Playwright coverage:** PW: dialog handling, offline recovery, refresh; manual hard-close scenario recorded.

#### PROP-011 — Two-tab edits and stale revision

**Priority:** P0

**Preconditions:** F0; same draft version open twice.

**Steps:**

1. Save tab A.
2. Save conflicting tab B.
3. Reload/resolve.
4. Replay B response after newer save.

**Expected Result:** No silent last-write overwrite; conflict explains reload/merge path; exact version increments; stale response cannot regress UI.

**API coverage:** Optimistic version/updated-at token with atomic conditional update.

**Playwright coverage:** PW: two-context conflict and explicit resolution.

#### PROP-012 — Server ownership and protected-field enforcement

**Priority:** P0

**Preconditions:** F0; sellerA/B and buyer; known property IDs.

**Steps:**

1. Create with owner_id=B.
2. Update B draft.
3. Set verified/featured/published/deleted fields.
4. Attempt as buyer/suspended seller.

**Expected Result:** Owner comes from verified session; protected fields cannot be changed; foreign records hidden/denied; no side effects.

**API coverage:** create/update actions, HTTP adapters and direct Supabase mutations.

**Playwright coverage:** PW API adversarial calls; UI does not show foreign editable forms.

#### PROP-013 — Submission completeness and upload-in-progress

**Priority:** P0

**Preconditions:** F0; draft with incomplete required fields/media/documents.

**Steps:**

1. Submit during upload/thumbnail finalization.
2. Omit required document by type.
3. Deactivate location.
4. Then complete requirements and retry.

**Expected Result:** Incomplete/unfinalized submission denied with exact corrective steps; valid final snapshot accepted once; client progress cannot bypass server checks.

**API coverage:** submit transaction rechecks all references and upload readiness.

**Playwright coverage:** PW: disabled/pending submit and recovery to successful submission.

#### PROP-014 — Preview faithfully reflects current data

**Priority:** P1

**Preconditions:** F0; draft with changed price, cover, features and seller fields.

**Steps:**

1. Open preview.
2. Edit upstream fields.
3. Return.
4. Inspect links/Contact Owner and refresh preview URL as guest.

**Expected Result:** Current saved/intended draft shown accurately with clear preview state; preview cannot leak publicly or create enquiry; private docs/notes never appear as public content.

**API coverage:** Authenticated preview read and DTO field allowlist.

**Playwright coverage:** PW: edit→preview changes, safe disabled contact and guest direct link.

#### PROP-015 — Draft deletion and repeat submission

**Priority:** P0

**Preconditions:** F0; own draft and submitted listing; delete/withdraw rules fixed.

**Steps:**

1. Cancel delete.
2. Confirm allowed draft deletion.
3. Replay delete/submit.
4. Try deleting submitted/foreign listing.

**Expected Result:** Confirmation and state rules respected; delete idempotent by contract; one submission transition; media cleanup scheduled safely; no history lost unexpectedly.

**API coverage:** Deletion state/version/idempotency plus dependent-object checks.

**Playwright coverage:** PW: confirmation cancel/confirm and repeated-click prevention.


<a id="life-tests"></a>

### LIFE — Property lifecycle and publication invariants

Source coverage: architecture §§9,19–22,25,28,30,42; design §§12,25.

#### LIFE-001 — All valid state-machine paths

**Priority:** P0

**Preconditions:** F0; one fixture per state and actor; transition table approved.

**Steps:**

1. Execute every allowed transition from section 2.1, including request-changes loop and sold→archived.

**Expected Result:** Correct next state, revision, required reason, timestamps, review, audit and notification effects; no unspecified transition.

**API coverage:** Service/state-machine units and real transactional DB integration.

**Playwright coverage:** PW: E2E-003/E2E-004 and seller sold/archive path.

#### LIFE-002 — All invalid transitions and forged timestamps

**Priority:** P0

**Preconditions:** F0; 8 states × 8 targets × actor/scope matrix.

**Steps:**

1. Attempt every non-allowed state pair.
2. Directly modify verification_status/published_at/expires_at/deleted_at.
3. Replay stale transition.

**Expected Result:** Invalid transitions fail without partial changes; contradictory status fields cannot confer public access; authorized no-op replay follows idempotency contract.

**API coverage:** Enumerated action and direct-DB constraint/grant tests.

**Playwright coverage:** PW API matrix; browser shows safe conflict/state error.

#### LIFE-003 — Public visibility across every surface

**Priority:** P0

**Preconditions:** F0; all eligibility combinations and warm caches.

**Steps:**

1. Request home, search, direct slug/UUID, similar/location results, metadata/OG, sitemap and public child rows for each fixture.

**Expected Result:** Only finalized eligibility predicate passes; hidden listing contents/IDs/private media absent; direct URLs enforce same rule, not only discovery filters.

**API coverage:** Parameterized publication matrix at HTML/RSC/API/DB layers.

**Playwright coverage:** PW: guest browsing plus request/source inspections.

#### LIFE-004 — Mark sold and preserve enquiry history

**Priority:** P0

**Preconditions:** F0; eligible property with favorites/enquiries; GAP-02/13 fixed.

**Steps:**

1. Owner/admin marks sold.
2. Attempt new enquiry and old bookmarked detail.
3. Inspect dashboards/history.

**Expected Result:** Actor/state/reason enforced; new contact prevented under baseline; status and public/SEO visibility follow explicit policy; existing enquiry history remains scoped.

**API coverage:** markSold transaction, search/cache/sitemap invalidation, enquiry eligibility.

**Playwright coverage:** PW: seller→buyer contexts, unavailable card and retained history.

#### LIFE-005 — Scheduled expiry boundary

**Priority:** P0

**Preconditions:** F0; expires_at null/before/equal/after clock; authenticated expiry job.

**Steps:**

1. Query around expiry.
2. Run job twice/concurrently and after downtime.
3. Inspect notifications/cache.

**Expected Result:** Eligibility enforces timestamp even before job catches up; job applies defined lifecycle once; no duplicate expiry intent; null expiry treated as configured.

**API coverage:** Clock-boundary reads, idempotent job batches and publication invalidation.

**Playwright coverage:** PW: expired deep link and owner expiry status; API owns exact timing.

#### LIFE-006 — Unpublish, archive, restore and rejection policy

**Priority:** P0

**Preconditions:** F0; GAP-13 operation table resolved.

**Steps:**

1. Invoke each allowed moderation operation with reason.
2. Attempt unauthorized restore/rejected→verified shortcut.

**Expected Result:** Explicit policy controls republishing/re-review and content snapshot; hidden states remain hidden; no silent revival of expired/deleted listing; audit complete.

**API coverage:** Per-operation role/state/version/visibility integration.

**Playwright coverage:** PW: admin actions and seller status/reason display.

#### LIFE-007 — Slug generation and history

**Priority:** P1

**Preconditions:** F0; duplicate/Unicode/long/punctuated titles and title-change policy.

**Steps:**

1. Create duplicate titles concurrently.
2. Rename permitted property.
3. Request all old slugs and collision attempts.

**Expected Result:** Unique stable UUID-based identity; deterministic valid slugs; old public URLs redirect once to current canonical without loops or hidden-content disclosure.

**API coverage:** Unique constraints/history mapping and redirect status tests.

**Playwright coverage:** PW: bookmarks and old-slug navigation; SEO suite checks HTML.

#### LIFE-008 — Deletion, suspended seller and inactive location

**Priority:** P0

**Preconditions:** F0; property with media/favorites/enquiries and cached public result.

**Steps:**

1. Soft-delete, suspend owner or deactivate location separately.
2. Read every public and private dependent view.
3. Undo where permitted.

**Expected Result:** Visibility/contact effects match GAP-02; private history retained by policy; no orphan relations or stale contact path; restoration does not bypass review.

**API coverage:** Cross-table integrity, cache and eligibility transaction tests.

**Playwright coverage:** PW: saved/unavailable listing messages and admin recovery.


<a id="detail-tests"></a>

### DETAIL — Property detail, gallery, map and trust content

Source coverage: design §§12,15–16,29–30; architecture §§15,20–21,31; continue phase 4.

#### DETAIL-001 — Full public property detail

**Priority:** P0

**Preconditions:** F0; eligible listing with complete fields.

**Steps:**

1. Open canonical URL.
2. Inspect breadcrumb, gallery, title/badge/location/price/stats/contact, description/details/features/map/seller/disclaimer/similar/report.

**Expected Result:** All specified sections accurate and ordered; INR/area/date consistent with cards; meaningful server-rendered content; sticky contact action refers to current listing.

**API coverage:** read/similar DTOs, eligibility and aggregation.

**Playwright coverage:** PW: property-detail.spec.ts with desktop two-column and mobile CTA.

#### DETAIL-002 — Verification badge and disclaimer

**Priority:** P1

**Preconditions:** F0; reviewed listing and hidden/nonverified fixture.

**Steps:**

1. Read badge tooltip via mouse, keyboard and touch.
2. Inspect page wording and metadata.

**Expected Result:** Badge shown only for reviewed allowed state; source disclaimer present: review is not a legal title guarantee; no implied ownership guarantee.

**API coverage:** Status-to-badge formatter and public DTO.

**Playwright coverage:** PW: tooltip accessible activation and visible disclaimer; text assertion.

#### DETAIL-003 — Gallery counts, swiping and fullscreen controls

**Priority:** P1

**Preconditions:** F0; 1/5/max images, portrait/landscape and broken image.

**Steps:**

1. Swipe, use arrows/thumbnails, view all, keyboard navigate, close with Escape.
2. Open first/last repeatedly.

**Expected Result:** Correct order/count/cover; no out-of-bounds index; focus restored; fallback remains usable; lazy thumbnails do not shift content.

**API coverage:** Media order/read contract and transformed image status.

**Playwright coverage:** PW: desktop keyboard and mobile swipe; broken-image response.

#### DETAIL-004 — Optional and oversized detail content

**Priority:** P1

**Preconditions:** F0; missing optional features/map/images plus long description and seller name.

**Steps:**

1. Open both variants.
2. Expand sections if present.
3. Zoom/reflow.

**Expected Result:** Required facts still visible; unknown not misrepresented as No; no undefined/null text, overlap or fake map coordinates; useful fallback.

**API coverage:** Nullable DTO and formatter units.

**Playwright coverage:** PW: long/empty detail at 360px and 200% zoom.

#### DETAIL-005 — Map provider failure and coordinate disclosure

**Priority:** P1

**Preconditions:** F0; GAP-25 precision policy and maps adapter selected.

**Steps:**

1. Load valid/no coordinates.
2. Block provider/consent or fail network.
3. Inspect public coordinate payload and external directions URL.

**Expected Result:** Only approved precision exposed; lightweight fallback keeps address/contact usable; allowed URL encoded safely; no map/secret leak or page crash.

**API coverage:** MapProvider adapter and coordinate projection/URL validation.

**Playwright coverage:** PW: scroll-triggered lazy map, failure fallback and external-link target.

#### DETAIL-006 — Similar listings and navigation safety

**Priority:** P1

**Preconditions:** F0; same/different location/type and hidden/sold candidates.

**Steps:**

1. Open property.
2. Follow similar links.
3. Remove a candidate and refresh.

**Expected Result:** Bounded relevant eligible results; no self/duplicate/private row; stale unavailable target handled; no all-inventory payload.

**API coverage:** similar query limit, eligibility and relevance deterministic fixtures.

**Playwright coverage:** PW: similar cards and no-results fallback.

#### DETAIL-007 — Removed/under-review/sold deep links and HTTP results

**Priority:** P0

**Preconditions:** F0; known slugs for every nonpublic state.

**Steps:**

1. Navigate directly as guest, owner and another seller.
2. Refresh and request initial HTML.

**Expected Result:** Safe 404/unavailable/authorized owner status as frozen; no hidden-content flash; sold policy explicit; retry/back/home next action present.

**API coverage:** read authorization and correct non-200 for absent hidden public resources.

**Playwright coverage:** PW: initial render/network and owner-versus-guest views.


<a id="media-tests"></a>

### MEDIA — Property images, uploads and object lifecycle

Source coverage: design §§16–17,24–25; architecture §§13–15,24,29; continue phase 6.

#### MEDIA-001 — Valid photo upload through durable finalization

**Priority:** P0

**Preconditions:** F0; editable own draft; JPEG/PNG/WebP fixtures.

**Steps:**

1. Initiate.
2. Upload bytes.
3. Finalize.
4. Reload draft.
5. Submit after processing ready.

**Expected Result:** Server-scoped UUID path; MIME/dimensions validated; original/optimized/thumbnail metadata consistent; durable media appears once with accurate progress.

**API coverage:** initiate/finalize Storage and DB integration for each supported format.

**Playwright coverage:** PW: upload input, progress, preview and refresh persistence.

#### MEDIA-002 — Size, pixel, count and quota boundaries

**Priority:** P0

**Preconditions:** F0; GAP-03 upload limits fixed.

**Steps:**

1. Upload byte/dimension/count boundary fixtures, including compressed huge-pixel image and simultaneous finalizations at quota.

**Expected Result:** Limits enforced server-side before expensive processing where possible and again on finalize; no decompression resource exhaustion or count bypass; rejected objects safely cleaned.

**API coverage:** Validation and atomic quota reservation/finalization tests.

**Playwright coverage:** PW: clear limit error/progress cleanup; API owns full boundary matrix.

#### MEDIA-003 — File identity and malformed bytes

**Priority:** P0

**Preconditions:** F0; safe synthetic corrupt/mismatched file corpus.

**Steps:**

1. Upload executable/script/SVG if unsupported, renamed .jpg, incorrect MIME/signature, zero/truncated bytes and polyglot fixture.

**Expected Result:** Allowed extension alone insufficient; unsupported/malformed content rejected; no execution or public publication; safe error and cleanup.

**API coverage:** Byte-sniff/decode/security validation independent of browser accept attribute.

**Playwright coverage:** PW: rejected upload UX; direct requests bypass client validation.

#### MEDIA-004 — Storage path and owner tampering

**Priority:** P0

**Preconditions:** F0; sellerA/B drafts and object paths.

**Steps:**

1. Change property ID, bucket/path, filename traversal and foreign signed upload destination.
2. Attempt overwrite/copy/move/list/delete.

**Expected Result:** Only own allowed namespace/operation succeeds; path generated server-side; no documents exposed through public app-media delivery or foreign objects modified.

**API coverage:** Tigris key/bucket controls plus application initiate/finalize parent/owner recheck.

**Playwright coverage:** PW API for hostile paths; browser upload only scoped targets.

#### MEDIA-005 — Cancel, timeout, offline and resumable retry

**Priority:** P1

**Preconditions:** F0; large permitted file; transfer can pause/fail.

**Steps:**

1. Cancel midway.
2. Lose network.
3. Retry before/after server accepted upload.
4. Leave page.

**Expected Result:** Truthful progress; cancel stops UI/work as supported; retry idempotent, no duplicate media; orphan finalized state reconciled; resume only if implemented and specified.

**API coverage:** Timeout/cancel/finalize-loss integration and cleanup grace period.

**Playwright coverage:** PW: cancellation, retry, offline and navigation during upload.

#### MEDIA-006 — Cover selection, reorder and deletion

**Priority:** P1

**Preconditions:** F0; multiple finalized photos with one cover.

**Steps:**

1. Reorder, choose cover, remove current cover, attempt foreign/duplicate IDs and delete all.

**Expected Result:** Exactly one cover when nonempty; deterministic replacement or explicit required selection; stored order matches gallery/card; minimum-photo rule enforced on submit.

**API coverage:** Transactional order/cover uniqueness and ownership constraints.

**Playwright coverage:** PW: accessible reorder controls, persistence and card image update.

#### MEDIA-007 — Image processing fidelity and metadata removal

**Priority:** P1

**Preconditions:** F0; EXIF rotated/GPS image, transparent PNG and extreme aspect ratios.

**Steps:**

1. Process then inspect output/thumbnail pixels, dimensions and metadata.

**Expected Result:** Orientation/aspect preserved; bounded optimized dimensions; sensitive metadata removed per policy; no stretched thumbnail; failed decode leaves recoverable state.

**API coverage:** Pipeline fixture verification using image metadata and reference dimensions.

**Playwright coverage:** PW: portrait/landscape and fallback rendering.

#### MEDIA-008 — Private Tigris objects and approved public image delivery

**Priority:** P0

**Preconditions:** F0; all Tigris buckets private; staged draft and approved final image.

**Steps:**

1. Fetch unsigned raw object paths as guest.
2. Request app media URL for draft and approved image.
3. Approve/unpublish.
4. Inspect retained URLs.

**Expected Result:** Unsigned raw access always denied; only eligible approved photos served through controlled app delivery; drafts/documents never public; publication never flips bucket/object ACL; removal/cache lifetime follows explicit policy.

**API coverage:** Tigris anonymous S3 probes plus server media eligibility and cache invalidation tests.

**Playwright coverage:** PW: approved public cards/OG and forbidden draft media; no permanent presigned URL in SEO HTML.

#### MEDIA-009 — Finalize against changed parent or lost transaction

**Priority:** P0

**Preconditions:** F0; upload started while property editable.

**Steps:**

1. Submit/delete/transfer allowed state in second request before finalize.
2. Fail DB insert after object stored.
3. Retry.

**Expected Result:** Finalize rechecks owner/state/quota; no attachment to forbidden parent; orphan tracked for cleanup; retry yields one media row.

**API coverage:** Barrier-controlled Storage/DB fault integration.

**Playwright coverage:** PW: changed-parent message and upload recovery.

#### MEDIA-010 — Responsive image loading and fallback

**Priority:** P1

**Preconditions:** F0; gallery and result page with many images.

**Steps:**

1. Load narrow/wide DPR variants.
2. Inspect next/image sizes/srcsets, priority and lazy requests.
3. Fail cover.

**Expected Result:** Appropriately sized variants; LCP image prioritized, offscreen images lazy; cards do not fetch 10MB originals; dimensions reserve space; fallback no retry loop.

**API coverage:** Transformed URL allowlist and response-size checks.

**Playwright coverage:** PW: network/viewport scroll tests and CLS measurement.


<a id="doc-tests"></a>

### DOC — Private verification documents and review access

Source coverage: architecture §§9,13–14,28,42; design §§17,19,25; continue phases 6,9,15.

#### DOC-001 — Valid documents and type-specific requirements

**Priority:** P0

**Preconditions:** F0; editable own draft; allowed PDF/selected-image policy.

**Steps:**

1. Upload each supported type.
2. Classify.
3. Preview as owner/admin.
4. Submit with and without conditional required types.

**Expected Result:** Private object and metadata durable; types/counts validated; required documents gate submission; no public URL emitted.

**API coverage:** Document initiate/finalize/read/sign and submission requirements.

**Playwright coverage:** PW: document step and admin review in separate contexts.

#### DOC-002 — Private object access matrix

**Priority:** P0

**Preconditions:** F0; documents for sellerA/B; every actor token.

**Steps:**

1. Try metadata, list, download, signing, public URL, guessed paths, thumbnails/transforms, copy/move and embedded joins.

**Expected Result:** Only intended owner/server-authorized reviewer accesses; guest/buyer/other seller/suspended actor cannot obtain bytes or new signed link; public media route cannot proxy documents.

**API coverage:** Real user tokens for app/DB/RPC; anonymous or scoped presigned Tigris requests for bytes; storage fixture credentials server-only.

**Playwright coverage:** PW API with unauthenticated requests; browser review positive control.

#### DOC-003 — Signed URL TTL and logout semantics

**Priority:** P0

**Preconditions:** F0; short TTL and revocation policy frozen.

**Steps:**

1. Mint link as authorized actor.
2. Use before/at/after expiry.
3. Logout/revoke actor then try new link and existing link.

**Expected Result:** New signing denied after lost access; Tigris presigned-link expiry verified; do not assume Supabase logout revokes an already issued bearer link. Private document proxy reauthorizes every request and is the baseline for immediate denial after access changes.

**API coverage:** Tigris-backed link expiry/revocation smoke plus clocked signer/proxy tests; private/no-store and referrer controls.

**Playwright coverage:** PW: expiry recovery requests a fresh authorized link; token redacted from trace.

#### DOC-004 — Document corruption, active content and encryption

**Priority:** P0

**Preconditions:** F0; safe synthetic PDF/image security corpus; preview policy fixed.

**Steps:**

1. Upload bad signature/corrupt/oversized/encrypted/active-content file and misleading extension.
2. Preview if allowed.

**Expected Result:** Unsupported/unsafe file fails or is quarantined by defined policy; no execution in app origin; private attachment/sandboxed preview behavior enforced; clear unsupported-file message.

**API coverage:** Byte validation and preview response headers; antivirus only if actually selected.

**Playwright coverage:** PW: safe preview/download UI and controlled failure; no production malware.

#### DOC-005 — Replace/delete during review and revision binding

**Priority:** P0

**Preconditions:** F0; reviewer has exact submitted revision open.

**Steps:**

1. Owner attempts document replacement/removal during review.
2. Reviewer signs old path.
3. Resubmit allowed correction then review.

**Expected Result:** Locked revision cannot change; approved decision references exact document set; old URLs/removal follow TTL policy; new revision requires fresh review.

**API coverage:** Version/parent-state checks, immutable review snapshot and object reference integrity.

**Playwright coverage:** PW: simultaneous seller/reviewer contexts.

#### DOC-006 — Internal comments versus owner feedback

**Priority:** P0

**Preconditions:** F0; internal admin note and owner-facing request-change reason.

**Steps:**

1. View documents/review through owner, buyer and admin endpoints.
2. Inspect public HTML/email.

**Expected Result:** Owner sees only approved feedback; internal notes, reviewer private details and sensitive document contents stay private; reasons escaped safely.

**API coverage:** Projection/column/RLS tests and email payload inspection.

**Playwright coverage:** PW: seller feedback versus admin internal note panels.

#### DOC-007 — Private document retention and cleanup

**Priority:** P0

**Preconditions:** F0; rejected/deleted listings with retention timestamps and live references.

**Steps:**

1. Run cleanup before/at/after retention.
2. Simulate partial delete and retry.
3. Restore permitted record.

**Expected Result:** Only eligible unreferenced documents removed; ongoing reviews protected; metadata/bytes reconciliation recorded; no cross-owner deletion; retention policy applies to backups separately.

**API coverage:** Authenticated idempotent cleanup and FK/object reconciliation.

**Playwright coverage:** PW: expired/unavailable document state; API owns cleanup and restore checks.

#### DOC-008 — Document access audit and leak prevention

**Priority:** P0

**Preconditions:** F0; review-access auditing and logging policy fixed.

**Steps:**

1. View/download document.
2. Cause failure.
3. Inspect logs, analytics, browser cache and email.

**Expected Result:** Audit records actor/target/time/outcome if required; no document body, signed token, OTP or service key in diagnostics; sensitive preview not cached/shared.

**API coverage:** Redaction/header/instrumentation integration.

**Playwright coverage:** PW: preview headers, history/referrer and nonshared cache checks.

#### DOC-009 — Authorization errors do not reveal document existence

**Priority:** P0

**Preconditions:** F0; known/unknown private IDs, paths and foreign property association.

**Steps:**

1. Probe signing/download/metadata with own, other and nonexistent IDs.
2. Alter content-disposition filename and path encodings.

**Expected Result:** Foreign/private existence not unnecessarily disclosed; filename/header injection rejected; unsigned probes never return bytes; a legitimately issued bearer URL is governed separately by DOC-003.

**API coverage:** Document route/Storage error normalization and header/path validation.

**Playwright coverage:** PW API probes; authorized download remains usable.


<a id="admin-tests"></a>

### ADMIN — Verification and administrative management

Source coverage: design §§19–22; architecture §§7,25,28,30; continue phase 9.

#### ADMIN-001 — Verification queue and start review

**Priority:** P0

**Preconditions:** F0; submitted/under-review/other-state inventory; authorized reviewer.

**Steps:**

1. Open queue.
2. Search/filter/page.
3. Claim/start eligible review.
4. Inspect details/documents.

**Expected Result:** Queue contains defined eligible states only; exact revision and review state visible; begin-review transition audited; no foreign role bypass.

**API coverage:** queue/readReview/claimReview contract and server-side pagination.

**Playwright coverage:** PW: admin-review.spec.ts queue→detail→private document.

#### ADMIN-002 — Approve exact reviewed listing

**Priority:** P0

**Preconditions:** F0; complete under_review snapshot with valid documents.

**Steps:**

1. Review all required information.
2. Approve with valid version.
3. Reload seller/admin/public views.

**Expected Result:** One review/status/audit transaction; published_at and verification fields consistent; notification intent once; eligible listing publicly discoverable with invalidated caches.

**API coverage:** approve transaction, concurrency precondition and side-effect/outbox record.

**Playwright coverage:** PW: approve→new guest sees listing; stale preapproval page refresh.

#### ADMIN-003 — Request changes, correct and resubmit

**Priority:** P0

**Preconditions:** F0; under_review property; reason requirements fixed.

**Steps:**

1. Request changes with field/document feedback.
2. Seller corrects.
3. Resubmits.
4. Admin reviews again.

**Expected Result:** Reason preserved and safely displayed; changes_required editable only by owner; new revision/queue entry; old review cannot approve changed content.

**API coverage:** requestChanges/update/submit/version integration.

**Playwright coverage:** PW: end-to-end multi-role correction loop.

#### ADMIN-004 — Reject and invalid decision inputs

**Priority:** P0

**Preconditions:** F0; under_review listing; permitted reason bounds.

**Steps:**

1. Reject with missing/blank/overlong reason.
2. Reject validly.
3. Attempt approve from rejected state and arbitrary decision value.

**Expected Result:** Invalid input no transition; valid rejection hidden with feedback/audit; reopening only through defined GAP-13 path.

**API coverage:** reject decision schema, state constraints and notification intent.

**Playwright coverage:** PW: reject dialog validation, cancel and seller result.

#### ADMIN-005 — Competing reviewers and stale content

**Priority:** P0

**Preconditions:** F0; adminA/B viewing same revision.

**Steps:**

1. Approve and reject simultaneously.
2. Repeat same decision.
3. Mutate allowed revision before stale reviewer submits.

**Expected Result:** Exactly one valid transition wins; loser sees conflict/current state; no duplicate reviews/emails/audits; stale snapshot never approved.

**API coverage:** Barrier-controlled DB transaction/conditional version tests.

**Playwright coverage:** PW: two reviewer contexts and refresh/review conflict guidance.

#### ADMIN-006 — Internal notes and sensitive edits

**Priority:** P0

**Preconditions:** F0; authorized admin, safe-field edit policy.

**Steps:**

1. Add/edit allowed note.
2. Attempt buyer/seller read.
3. Edit sensitive listing field with/without reason/version.

**Expected Result:** Internal notes private and attributed; permitted sensitive changes audited and trigger re-review/publication rule; unauthorized edits denied.

**API coverage:** admin_notes grants/projection and sensitive field allowlist.

**Playwright coverage:** PW: note visibility and edit confirmation/reason UX.

#### ADMIN-007 — Properties management actions

**Priority:** P0

**Preconditions:** F0; properties in every state; feature/unpublish/archive/sold rules fixed.

**Steps:**

1. Search/filter/paginate.
2. Feature/unfeature.
3. Unpublish/archive/mark sold.
4. Cancel confirmation.
5. Retry lost response.

**Expected Result:** Only legal actor/state actions succeed; confirmed intent only; public/cache/SEO effects coherent; idempotent retry and audit; featured status never exposes hidden listing.

**API coverage:** Management state/role/version matrix and invalidation tests.

**Playwright coverage:** PW: action dropdown/dialogs, public follow-up and pending errors.

#### ADMIN-008 — User search, profile history and suspension

**Priority:** P0

**Preconditions:** F0; ordinary users, agents and privileged accounts.

**Steps:**

1. Search user.
2. Inspect listing history.
3. Suspend/reactivate permitted user.
4. Attempt privileged-user operation as ordinary admin.

**Expected Result:** Scope and pagination correct; sensitive fields limited; reason/audit recorded; stale sessions denied as designed; privileged accounts protected.

**API coverage:** User management authorization and account/property effects.

**Playwright coverage:** PW: user table, history and suspension across contexts.

#### ADMIN-009 — Bulk actions and partial failure

**Priority:** P1

**Preconditions:** F0; supported actions enumerated; selected rows include stale/forbidden/valid IDs.

**Steps:**

1. Select across pages per policy.
2. Confirm operation.
3. Inject one failure.
4. Retry selected failures only.

**Expected Result:** Each row reauthorized/versioned; result identifies success/failure without false global success; no unintended rows; audit and side effects once per committed item.

**API coverage:** Bulk size/duplicates/foreign IDs and transaction-per-item versus atomic contract.

**Playwright coverage:** PW: selection scope, confirmation count and partial-result summary.

#### ADMIN-010 — Admin enquiry visibility and safe moderation

**Priority:** P0

**Preconditions:** F0; enquiries across sellers/buyers; admin capability granted.

**Steps:**

1. Search/filter/page enquiry list.
2. Open details.
3. Attempt unauthorized status/reassignment/export operation.

**Expected Result:** Permitted moderation view only; no unsupported export or reassignment; per-operation permission; private data absent from public cache/logs.

**API coverage:** Admin enquiry projection, limits and negative mutation matrix.

**Playwright coverage:** PW: list/detail, loading/empty/error and ordinary-user forbidden route.

#### ADMIN-011 — Audit log integrity and access

**Priority:** P0

**Preconditions:** F0; super admin and ordinary admin; representative audited actions.

**Steps:**

1. Perform approve/reject/changes/suspend/publish/unpublish/delete/feature/sensitive-edit.
2. Inspect audit.
3. Attempt tampering and actor spoof.

**Expected Result:** Actor/target/time/reason/before-after accurate; append-only from client perspective; required audit failure prevents unaudited privileged success or follows explicit durable intent contract; access follows GAP-05.

**API coverage:** Audit insert transaction, read filters/pagination and immutable grants.

**Playwright coverage:** PW: authorized audit filters and forbidden direct URL.

#### ADMIN-012 — All admin pages empty, loading, errors and direct routes

**Priority:** P1

**Preconditions:** F0; no pending reviews and selectively failed services.

**Steps:**

1. Visit Dashboard, Verification, Properties, Users, Enquiries, Locations, Articles, Reports, Settings and Audit Logs for each allowed role.

**Expected Result:** Every specified destination exists or is intentionally role-hidden; usable empty/skeleton/retry states; direct URLs enforce authorization; no decorative dead navigation.

**API coverage:** Page initial-data action failure and authorization contract.

**Playwright coverage:** PW: admin navigation coverage on desktop/mobile.


<a id="enq-tests"></a>

### ENQ — Contact Owner, buyer enquiries and seller inbox

Source coverage: design §§15,18,21; architecture §§25,29,31; continue phases 7–8,10–11.

#### ENQ-001 — Primary enquiry and both dashboards

**Priority:** P0

**Preconditions:** F0; buyerA, active sellerA and eligible listing; email optional.

**Steps:**

1. Open Contact Owner.
2. Enter valid message.
3. Submit.
4. Open My Enquiries and seller Received Enquiries.

**Expected Result:** One durable enquiry with correct buyer/property/server-derived seller; visible to both intended participants; buyer confirmation and seller notification intent; truthful success.

**API coverage:** enquiry.create/listSent/listReceived; assert rows, event and scoped DTOs.

**Playwright coverage:** PW: buyer-enquiry.spec.ts multi-context complete journey.

#### ENQ-002 — Guest gate and return after login

**Priority:** P0

**Preconditions:** F0; guest on eligible property.

**Steps:**

1. Click desktop contact card/mobile sticky CTA.
2. Cancel login.
3. Repeat and authenticate.
4. Confirm enquiry form.

**Expected Result:** No unauthenticated enquiry or contact disclosure; cancel preserves listing; login returns safely; explicit submission required once.

**API coverage:** Guest create denied; return-path and session checks.

**Playwright coverage:** PW: both CTA variants and fresh session.

#### ENQ-003 — Invalid or newly ineligible target

**Priority:** P0

**Preconditions:** F0; properties in every lifecycle/visibility state.

**Steps:**

1. Submit for missing, malformed, unpublished, deleted, expired, sold, archived, inactive-location or suspended-seller property.
2. Change state after form opens.

**Expected Result:** Server checks current eligibility at commit; baseline rejects unavailable targets; no enquiry/notification; actionable unavailable state without private data.

**API coverage:** Parameterized eligibility and transaction race tests.

**Playwright coverage:** PW: property becomes unavailable during open form.

#### ENQ-004 — Buyer identity, ownership and self-contact

**Priority:** P0

**Preconditions:** F0; buyerA/B, sellerA and combined-role seller.

**Steps:**

1. Forge buyer_id/seller_id/property owner.
2. Contact own listing.
3. Use suspended/expired actor.

**Expected Result:** Identities derived from session and property; self-contact follows explicit deny baseline; inactive actors denied; foreign history untouched.

**API coverage:** Create schema/authorization plus RLS insert and update attempts.

**Playwright coverage:** PW API attacks and own-listing contact behavior.

#### ENQ-005 — Message validation and safe display

**Priority:** P0

**Preconditions:** F0; message requirement and bounds fixed.

**Steps:**

1. Submit blank/missing/whitespace, min/max boundaries, Unicode, HTML/script/URLs and very long text.

**Expected Result:** Allowed text preserved and escaped in buyer/seller/admin/email; invalid rejected with field error; no executable or hidden markup.

**API coverage:** Zod/action/DB boundaries and notification template escaping.

**Playwright coverage:** PW: message form, multiline layout and inbox rendering.

#### ENQ-006 — Double click, retry and repeat-contact policy

**Priority:** P0

**Preconditions:** F0; idempotency scope/TTL and repeat window fixed.

**Steps:**

1. Double-submit.
2. Retry same key after response loss.
3. Use same key with changed payload.
4. Create new key within/after repeat window.

**Expected Result:** Same valid retry returns original result; changed payload conflicts; intentional repeated enquiry follows policy; one notification intent per committed event.

**API coverage:** DB uniqueness/idempotency and time-window partitions.

**Playwright coverage:** PW: disabled button, ambiguous-response recovery and correct history count.

#### ENQ-007 — Rate limiting and spam abuse

**Priority:** P0

**Preconditions:** F0; user/IP/action limits defined.

**Steps:**

1. Send L−1/L/L+1 enquiries across properties and instances.
2. Vary spoofed forwarding headers.
3. Reset window.

**Expected Result:** Atomic scope limits enforced; no burst bypass via new tab/key/property; retry time shown; valid use resumes; private identity not exposed.

**API coverage:** Shared limiter tests plus per-action quotas and DB side-effect counts.

**Playwright coverage:** PW: rate-limited form keeps message and permits later retry.

#### ENQ-008 — Enquiry status actors and history

**Priority:** P1

**Preconditions:** F0; GAP-08 status machine and editable fields fixed.

**Steps:**

1. Seller updates through every allowed state.
2. Buyer/foreign seller/admin tries each state.
3. Repeat stale update.

**Expected Result:** Only allowed actors/transitions apply; buyer status display consistent; version conflict safe; no reassignment or unauthorized deletion.

**API coverage:** Enumerated status/role matrix and immutable relation fields.

**Playwright coverage:** PW: seller inbox status, buyer refresh and forbidden controls.

#### ENQ-009 — Enquiry lists, filters and empty states

**Priority:** P1

**Preconditions:** F0; sent/received histories over page limit.

**Steps:**

1. Search/filter/sort/page.
2. Open each item.
3. Clear filters.
4. Simulate zero data/error.

**Expected Result:** Only own sent/received scope; stable server pagination and counts; correct listing references/status; empty distinguished from outage.

**API coverage:** List projection, ownership, limits and indexed seller/buyer lookups.

**Playwright coverage:** PW: dashboard histories on mobile and desktop.

#### ENQ-010 — Contact privacy and external channel policy

**Priority:** P0

**Preconditions:** F0; seller private phone/email; WhatsApp is later scope.

**Steps:**

1. Inspect card, HTML/RSC, API, emails and analytics before/after enquiry.
2. Request direct contact data or unimplemented channel.

**Expected Result:** No private phone disclosure unless explicitly authorized policy; enquiry alone does not imply public contact release; later WhatsApp path remains disabled.

**API coverage:** DTO/channel allowlist and authorization tests.

**Playwright coverage:** PW: contact UI and network payload inspection.

#### ENQ-011 — Notification failure does not lose enquiry

**Priority:** P0

**Preconditions:** F0; database healthy; Brevo/notification worker failing.

**Steps:**

1. Commit enquiry.
2. Fail delivery.
3. Reload both dashboards.
4. Recover worker and retry.

**Expected Result:** Enquiry persists once and success reflects accepted enquiry, not guaranteed email delivery; failed/pending delivery recorded; controlled recovery without duplicate business event.

**API coverage:** Business transaction/durable delivery intent and retry tests.

**Playwright coverage:** PW: accepted enquiry remains visible despite email outage.

#### ENQ-012 — Historical enquiries after account/property removal

**Priority:** P0

**Preconditions:** F0; enquiry history and approved retention/deletion policy.

**Steps:**

1. Remove/archive property or request user deletion.
2. Inspect remaining participant/admin history.

**Expected Result:** Required history retained/anonymized consistently; no broken foreign-key crashes, forbidden contacts or resurrected listing; deletion does not silently expose other data.

**API coverage:** FK/retention/anonymization migration and projection tests.

**Playwright coverage:** PW: historical unavailable listing presentation.


<a id="save-tests"></a>

### SAVE — Saved properties and optimistic interaction

Source coverage: design §§9,11,18,23; architecture §§6,9; continue phases 4,7.

#### SAVE-001 — Save, list and remove

**Priority:** P1

**Preconditions:** F0; buyer and eligible listing.

**Steps:**

1. Save from card.
2. Open saved dashboard.
3. Remove from detail/list.
4. Reload.

**Expected Result:** One own favorite; synchronized icon/count; removal durable; empty state with discovery CTA.

**API coverage:** favorite.add/remove/list and unique pair constraint.

**Playwright coverage:** PW: saved.spec.ts card/detail/dashboard round trip.

#### SAVE-002 — Duplicate and concurrent toggles

**Priority:** P0

**Preconditions:** F0; same property open in two contexts.

**Steps:**

1. Send duplicate add.
2. Add/remove near-simultaneously.
3. Retry lost response.

**Expected Result:** Unique constraint prevents duplicates; final state matches documented operation order/idempotency; no negative count or incorrect optimistic state.

**API coverage:** Atomic upsert/delete and barrier-controlled final-state assertions.

**Playwright coverage:** PW: rapid clicks and two-tab refresh.

#### SAVE-003 — Unauthorized, foreign and hidden favorite

**Priority:** P0

**Preconditions:** F0; guest/buyerA/B and hidden listing.

**Steps:**

1. Forge user_id.
2. Read/remove B favorites.
3. Save hidden/deleted property.
4. Bypass UI gate.

**Expected Result:** Only own eligible actions; unknown/hidden IDs reveal nothing; denied calls no mutation; direct RLS protects rows.

**API coverage:** Favorite operation/DB matrix.

**Playwright coverage:** PW: login gate and PW API negative calls.

#### SAVE-004 — Saved property becomes unavailable

**Priority:** P1

**Preconditions:** F0; saved listing then sold/unpublished/deleted.

**Steps:**

1. Open saved dashboard and existing card.
2. Try contact.
3. Remove favorite.

**Expected Result:** Safe unavailable/tombstone or omission per policy; no private details; removal still possible if supported; count reflects documented behavior.

**API coverage:** Availability-safe joins/projection and removal semantics.

**Playwright coverage:** PW: unavailable saved card and next action.

#### SAVE-005 — Optimistic update rollback and pagination

**Priority:** P1

**Preconditions:** F0; paginated favorites and network failure.

**Steps:**

1. Save/remove with failed request.
2. Retry.
3. Page/sort if supported.
4. Refresh.

**Expected Result:** Optimistic icon/count rolls back or reconciles accurately; no endless pending state; server paginates and isolates user.

**API coverage:** Failure/timeout-after-commit read-back contract.

**Playwright coverage:** PW: toast/error, rollback and final durable state.


<a id="history-tests"></a>

### HISTORY — Recently viewed privacy and ordering

Source coverage: design §§18,23; architecture §6; continue phase 7.

#### HISTORY-001 — Record, deduplicate and order recent views

**Priority:** P1

**Preconditions:** F0; authenticated buyer and several eligible listings.

**Steps:**

1. View A→B→A.
2. Refresh A.
3. Open Recently Viewed.

**Expected Result:** One entry per user/property with most recent viewed_at; deterministic order and bounded retention/count; tracking does not block detail rendering.

**API coverage:** history.record/list uniqueness, timestamp and pagination.

**Playwright coverage:** PW: view sequence→dashboard ordering.

#### HISTORY-002 — Guest behavior and cross-account isolation

**Priority:** P0

**Preconditions:** F0; guest and userA/B; guest-history policy documented.

**Steps:**

1. Browse as guest.
2. Log in as A then B.
3. Inspect storage and direct history requests.

**Expected Result:** No unauthorized server history writes; any local guest history follows explicit merge policy; no A-to-B leak or forged user ID.

**API coverage:** History RLS and optional merge authorization/idempotency.

**Playwright coverage:** PW: account switch and storage cleanup.

#### HISTORY-003 — Unavailable property and history removal

**Priority:** P1

**Preconditions:** F0; viewed property becomes private/deleted; clear behavior fixed.

**Steps:**

1. Read history.
2. Open unavailable entry.
3. Clear if supported.
4. Retry failed tracking.

**Expected Result:** No hidden detail leak; safe unavailable/omitted entry; own clear only; tracking errors do not break marketplace.

**API coverage:** Visibility-safe joins, retention and allowed delete.

**Playwright coverage:** PW: empty/unavailable/failure dashboard states.


<a id="profile-tests"></a>

### PROFILE — Profile, account settings and preferences

Source coverage: design §§18,21; architecture §§6–7,10,42; continue phase 7.

#### PROFILE-001 — Read and update safe profile fields

**Priority:** P1

**Preconditions:** F0; own profile and editable-field allowlist.

**Steps:**

1. Edit name and permitted public fields.
2. Submit text boundary cases.
3. Refresh.
4. Attempt other user profile update.

**Expected Result:** Valid own values persist; invalid error inline; omitted PATCH fields preserved; no privileged/private foreign data changed.

**API coverage:** profile.read/update plus RLS column grants and mass-assignment tests.

**Playwright coverage:** PW: profile.spec.ts form save, error and reload.

#### PROFILE-002 — Phone change and identity verification

**Priority:** P0

**Preconditions:** F0; GAP-07 supported phone-change flow or explicit disablement.

**Steps:**

1. Try editing phone directly.
2. Perform required old/new verification if supported.
3. Use phone already owned by B.
4. Interrupt midway.

**Expected Result:** No raw profile write changes identity; duplicates rejected; Auth/profile stay consistent; old sessions/security notice follow policy; unsupported feature clearly disabled.

**API coverage:** Supabase Auth change verification and rollback/reconciliation.

**Playwright coverage:** PW: supported change/re-auth flow or absence of unsupported action.

#### PROFILE-003 — Optional email and delivery verification

**Priority:** P0

**Preconditions:** F0; phone-only profile; email verification policy fixed.

**Steps:**

1. Enquire with no email.
2. Add invalid/valid email.
3. Attempt unverified delivery.
4. Change/delete email and retry pending event.

**Expected Result:** Core phone-first workflow works; email status honest; intended recipient verified by policy; no delivery to stale/foreign email; no requirement for email invented at login.

**API coverage:** Profile/email verification and notification recipient-resolution tests.

**Playwright coverage:** PW: missing-email prompt, verification state and preferences.

#### PROFILE-004 — Avatar upload and visibility

**Priority:** P1

**Preconditions:** F0; Tigris avatar bucket private; public-avatar projection policy set.

**Steps:**

1. Upload valid/invalid/oversized avatar.
2. Replace/delete.
3. Try other user path and script image.

**Expected Result:** Validated image only; correct ownership/cleanup; raw object access private; avatar displayed only through authorized/public-projection app delivery; broken image has fallback.

**API coverage:** Storage namespace, validation and profile pointer consistency.

**Playwright coverage:** PW: avatar preview, fallback, mobile crop if implemented.

#### PROFILE-005 — Notification preferences and mandatory messages

**Priority:** P1

**Preconditions:** F0; preference schema/defaults and mandatory security events fixed.

**Steps:**

1. Change each supported preference.
2. Reload.
3. Trigger corresponding events.
4. Inject another user ID.

**Expected Result:** Own preferences persist; optional channels honor choices; mandatory events behave as stated; UI never promises suppression it cannot provide.

**API coverage:** preferences read/update and event routing tests.

**Playwright coverage:** PW: settings toggles, disabled/loading/error and persisted values.

#### PROFILE-006 — Account deletion and cancellation

**Priority:** P0

**Preconditions:** F0; approved deletion/retention policy; account with listings/docs/enquiries.

**Steps:**

1. Request deletion.
2. Cancel confirmation.
3. Confirm authenticated/reverified request.
4. Fail midway then retry.

**Expected Result:** Only confirmed authorized request proceeds; sessions/ownership/data follow policy; progress/recovery clear; no cascade destroys another participant history.

**API coverage:** Deletion orchestration, retention, idempotency and forbidden actor tests.

**Playwright coverage:** PW: destructive confirmation and post-deletion access; staging only.

#### PROFILE-007 — Profile/session identity and concurrent updates

**Priority:** P0

**Preconditions:** F0; two contexts editing own profile, one logged out.

**Steps:**

1. Save conflicting fields.
2. Revoke session.
3. Retry stale update with account B login.

**Expected Result:** No silent cross-account write; version/merge rule honored; revoked session denied; correct current profile displayed.

**API coverage:** Version/principal consistency and scoped cache tests.

**Playwright coverage:** PW: multi-tab update and account-switch isolation.


<a id="dash-tests"></a>

### DASH — Buyer and seller dashboard completeness

Source coverage: design §18; architecture §§4–5,19,33–34; continue phases 7–8.

#### DASH-001 — Role-specific overview and all sections

**Priority:** P1

**Preconditions:** F0; buyer, seller, agent and approved combined-role fixtures.

**Steps:**

1. Open Overview, My Properties, Saved, My Enquiries, Received, Recently Viewed, Profile and Settings as permitted.

**Expected Result:** Correct allowed navigation and useful summaries; direct forbidden route denied; mobile tabs/dropdown reach all permitted sections.

**API coverage:** Summary and initial-data authorization for every dashboard route.

**Playwright coverage:** PW: dashboard.spec.ts route matrix and navigation.

#### DASH-002 — KPI counts and drill-down reconciliation

**Priority:** P1

**Preconditions:** F0; known active/under-review/enquiry/saved counts including deleted states.

**Steps:**

1. Compare cards to scoped lists.
2. Create/change/delete records.
3. Refresh/drill down.

**Expected Result:** Counts follow defined status/scope and timezone; no global/private leakage; drill-down filter matches displayed metric; 0 distinct from unavailable.

**API coverage:** Server aggregate reference queries and invalidation/session isolation.

**Playwright coverage:** PW: KPI→list and updated count after mutation.

#### DASH-003 — Seller inventory and actionable status

**Priority:** P1

**Preconditions:** F0; own listings in every state and over one page.

**Steps:**

1. Search/filter/sort/page inventory.
2. Open each status.
3. Use edit/resubmit/sold permitted actions.

**Expected Result:** Own rows only; status/reasons/available actions correct; no edit on locked revision; pagination server-side.

**API coverage:** listOwn/actions matrix and indexed owner/status query.

**Playwright coverage:** PW: seller dashboard status and corrected submission path.

#### DASH-004 — Listing analytics scope and failure

**Priority:** P1

**Preconditions:** F0; sellerA/B event datasets and definition of views/enquiries.

**Steps:**

1. Open own analytics.
2. Vary allowed date range.
3. Request B listing analytics.
4. Fail aggregation.

**Expected Result:** Only own approved aggregates; truthful counts/empty/error states; no raw buyer data or ECharts public bundle requirement.

**API coverage:** Scoped aggregate authorization and bounded date inputs.

**Playwright coverage:** PW: readable numeric seller stats; charts limited to admin per design.

#### DASH-005 — Initial SSR, loading and stale data recovery

**Priority:** P1

**Preconditions:** F0; delayed/failed dashboard services.

**Steps:**

1. Load directly.
2. Navigate within dashboard.
3. Mutate in another context.
4. Retry/refresh.

**Expected Result:** Server initial data for authorized actor; section skeleton/error without full failure; refresh reconciles changes; no A data flash under B session.

**API coverage:** Server Component DTO and cache/session tests.

**Playwright coverage:** PW: initial source/network and loading/error transitions.


<a id="loc-tests"></a>

### LOC — Locations, hierarchy and landing pages

Source coverage: design §§9–10,13; architecture §§6,19–22; continue phases 9,13.

#### LOC-001 — Every initial location landing page

**Priority:** P1

**Preconditions:** F0; all nine initial locations seeded.

**Steps:**

1. Open Coorg, Madikeri, Kushalnagar, Virajpet, Somwarpet, Gonikoppal, Suntikoppa, Boikere and Napoklu.

**Expected Result:** Correct SEO title/description/intro, eligible paginated properties, nearby locations, guides and internal links; no placeholder or cross-location mismatch.

**API coverage:** location.read/results/related DTO and server pagination.

**Playwright coverage:** PW: parameterized location route and empty listing variant.

#### LOC-002 — Admin location create/edit and uniqueness

**Priority:** P1

**Preconditions:** F0; admin and existing slug hierarchy.

**Steps:**

1. Create child.
2. Edit SEO/name/slug.
3. Enter duplicate/Unicode/overlong slug and invalid parent.

**Expected Result:** Valid changes persist/audit and update public links/cache; duplicate/invalid parent fails; old slug behavior explicit.

**API coverage:** Location validation, unique constraints and slug history.

**Playwright coverage:** PW: admin location form and public follow-up.

#### LOC-003 — Hierarchy cycles, descendants and filtering

**Priority:** P0

**Preconditions:** F0; Coorg→town→locality fixtures.

**Steps:**

1. Set self-parent.
2. Reparent to descendant.
3. Filter parent/child and edit concurrently.

**Expected Result:** Cycles rejected; allowed parent changes atomic; inclusion of descendant properties matches defined search semantics; no non-Coorg escape.

**API coverage:** Recursive/cycle constraints and query predicate tests.

**Playwright coverage:** PW: parent selection error and descendant filter results.

#### LOC-004 — Deactivate/delete referenced location

**Priority:** P0

**Preconditions:** F0; active location with listings and child pages.

**Steps:**

1. Deactivate parent/child.
2. Attempt delete.
3. Submit draft referencing it.
4. Reactivate.

**Expected Result:** Referenced-row deletion/visibility follows GAP-02/15; no orphan properties; sitemap/filter options/cache updated; seller gets correction path.

**API coverage:** FK policy and eligibility rechecks, invalidation.

**Playwright coverage:** PW: admin change and buyer/seller affected views.

#### LOC-005 — Location content safety and unknown route

**Priority:** P1

**Preconditions:** F0; long/unsafe SEO/intro text and missing slug.

**Steps:**

1. Save content.
2. Render landing metadata.
3. Request unknown/renamed slug.

**Expected Result:** Safe escaped/sanitized content; proper 404/redirect/canonical; no hidden administrative fields or stack traces.

**API coverage:** Metadata serialization, output allowlist and route status.

**Playwright coverage:** PW: source/visible content, long mobile headings.


<a id="cms-tests"></a>

### CMS — Guides and article management

Source coverage: design §§9,19,29; architecture §§6,19–22; continue phase 14.

#### CMS-001 — Create draft, preview and publish guide

**Priority:** P1

**Preconditions:** F0; authorized admin; article author/SEO/updated fields added under GAP-15.

**Steps:**

1. Create draft.
2. Save/reload/preview.
3. Publish.
4. Open guide list/detail.

**Expected Result:** Exact approved content/author/dates/SEO persisted; draft private; published server-rendered and internally linked; one publication event.

**API coverage:** article create/update/preview/publish and RLS.

**Playwright coverage:** PW: cms.spec.ts admin→public journey.

#### CMS-002 — Guide content validation and stored XSS

**Priority:** P0

**Preconditions:** F0; allowed editor markup/link/image policy.

**Steps:**

1. Submit blank/long/Unicode title/excerpt/body, script/event-handler markup, javascript URLs and embedded unsafe content.

**Expected Result:** Required/bounded content enforced; only safe markup rendered in preview/public/admin; URL schemes and image sources controlled.

**API coverage:** Server sanitation independent of editor; JSON-LD/metadata escaping.

**Playwright coverage:** PW: safe rich text and no executable payload.

#### CMS-003 — Edit, unpublish and old-slug redirects

**Priority:** P1

**Preconditions:** F0; published guide with cached page/sitemap entry.

**Steps:**

1. Edit title/body.
2. Change slug.
3. Unpublish.
4. Request old/current URLs and sitemap.

**Expected Result:** Content/cache/updated date coherent; no redirect loop; draft/unpublished never leaks through old slug/metadata; state rules enforced.

**API coverage:** Article version/slug history/invalidation and eligibility tests.

**Playwright coverage:** PW: old bookmark and unpublished public view.

#### CMS-004 — Listing, pagination, related properties and empty state

**Priority:** P1

**Preconditions:** F0; guide count across page limits and related hidden properties.

**Steps:**

1. Browse/search if supported.
2. Paginate.
3. Open related properties.
4. Delete relation target.

**Expected Result:** Only published guides and eligible related properties; bounded server query; no duplicate rows; clear empty/fallback state.

**API coverage:** List/read/related query and reference-integrity tests.

**Playwright coverage:** PW: guides navigation at mobile/desktop.

#### CMS-005 — CMS role and concurrent editor protection

**Priority:** P0

**Preconditions:** F0; adminA/B, buyer/seller; draft open in two contexts.

**Steps:**

1. Attempt forbidden write.
2. Save conflicting versions.
3. Publish stale version.
4. Inject author or status field outside capability.

**Expected Result:** Permission/current version enforced; no silent overwrite or unauthorized publication; author attribution follows policy.

**API coverage:** Action/grants/version and reviewable publication tests.

**Playwright coverage:** PW: concurrent edit conflict and forbidden direct route.

#### CMS-006 — Initial editorial content readiness

**Priority:** P1

**Preconditions:** F0; six initial guide topics from continue phase 14.

**Steps:**

1. Check each topic has approved content/author/updated date and no placeholder links.
2. Inspect related location links.

**Expected Result:** Buying Land, Documents to Verify, Coffee Estate Investment, Best Locations, Agricultural Land and Madikeri guides are complete or explicitly tracked as unfinished; no fabricated approvals/legal claims.

**API coverage:** Public route/metadata/content presence checks.

**Playwright coverage:** PW: route crawl; editorial review manual with case evidence.


<a id="report-tests"></a>

### REPORT — Report listing and moderation workflow

Source coverage: design §§15,19,22; architecture §29; continue phases 4,9; GAP-06.

#### REPORT-001 — Report primary flow and admin triage

**Priority:** P1

**Preconditions:** F0; report model/status/reasons and guest policy fixed.

**Steps:**

1. Open report dialog.
2. Choose reason and details.
3. Submit.
4. Admin opens Reports and triages.

**Expected Result:** One report attributed/scoped correctly; confirmation without exposing reporter identity to public; admin can resolve/dismiss through defined statuses with audit.

**API coverage:** report.create/list/review and persistence schema.

**Playwright coverage:** PW: report.spec.ts listing→report→admin triage.

#### REPORT-002 — Report validation, cancellation and target states

**Priority:** P1

**Preconditions:** F0; reason/text limits and allowed reportable states fixed.

**Steps:**

1. Cancel.
2. Omit reason.
3. Use boundary/XSS text.
4. Report nonexistent/hidden/deleted listing.
5. Guest attempt.

**Expected Result:** Cancelled report absent; valid reason required; unsafe text rendered safely; target/guest policy enforced without hidden data leak.

**API coverage:** Report validation and eligibility/role matrix.

**Playwright coverage:** PW: modal focus/error/cancel and login gate if required.

#### REPORT-003 — Duplicate reports and abuse limits

**Priority:** P0

**Preconditions:** F0; report dedupe/window and shared quota configured.

**Steps:**

1. Double click.
2. Retry lost response.
3. Repeated reports across targets/actors at limit.
4. Spoof user ID.

**Expected Result:** Dedupe and atomic rate limit applied; no forged reporter; genuine distinct permitted reports preserved; moderation not flooded by replay.

**API coverage:** Idempotency/constraint/rate limiter tests.

**Playwright coverage:** PW: pending, duplicate and rate error feedback.

#### REPORT-004 — Report privacy and unauthorized moderation

**Priority:** P0

**Preconditions:** F0; reports by A/B about sellerC.

**Steps:**

1. Read/edit/delete others reports as buyer/seller.
2. Resolve as ordinary user.
3. Request public joins.

**Expected Result:** Only defined reporter/admin access; seller does not receive reporter private details by accident; privileged decisions audited and state-checked.

**API coverage:** RLS/new-table grants and action permissions.

**Playwright coverage:** PW API adversarial tests; admin positive control.

#### REPORT-005 — Reports search, pagination and concurrent resolution

**Priority:** P1

**Preconditions:** F0; over-page report set; two reviewers.

**Steps:**

1. Filter status/reason, paginate.
2. Resolve same report concurrently.
3. Archive target property.

**Expected Result:** Bounded correct table; one resolution wins with conflict feedback; target removal does not corrupt case history; empty/error states useful.

**API coverage:** Report indexes/offset and versioned moderation.

**Playwright coverage:** PW: report table and two-context conflict.


<a id="settings-tests"></a>

### SETTINGS — System settings, feature flags and safe configuration

Source coverage: design §19; architecture §§7,37–38; continue phases 9,18; GAP-05/23.

#### SETTINGS-001 — Super-admin settings read/update

**Priority:** P0

**Preconditions:** F0; allowlisted settings schema and super-admin capability.

**Steps:**

1. Open settings.
2. Change supported nonsecret field.
3. Save/reload.
4. Attempt admin/buyer direct update.

**Expected Result:** Only authorized allowlisted changes persist and audit; defaults and effective configuration visible; forbidden writes no effect.

**API coverage:** settings.read/update authorization and schema.

**Playwright coverage:** PW: settings form, permission and reload.

#### SETTINGS-002 — Invalid, secret and environment-bound configuration

**Priority:** P0

**Preconditions:** F0; runtime/environment ownership documented.

**Steps:**

1. Submit invalid limits/URLs/negative TTL, unknown keys and credential values.
2. Inspect responses/logs.

**Expected Result:** Unsafe config rejected; secrets masked/server-only; client cannot change production env through generic settings; validation preserves last valid state.

**API coverage:** Allowlist, constraints and redaction tests.

**Playwright coverage:** PW: clear validation and masked controls where applicable.

#### SETTINGS-003 — Feature flags and disabled future routes

**Priority:** P0

**Preconditions:** F0; flags defined with safe defaults and role checks.

**Steps:**

1. Toggle allowed flag.
2. Open disabled route directly.
3. Modify flag as ordinary admin.
4. Fail config service.

**Expected Result:** Flags affect only defined behavior; permissions never bypassed; unavailable feature safely disabled on failure; post-MVP checkout/subscription paths cannot activate accidentally.

**API coverage:** Flag service default/cache/version and route enforcement.

**Playwright coverage:** PW: visible controls plus direct URL checks.

#### SETTINGS-004 — Concurrent settings and rollback

**Priority:** P1

**Preconditions:** F0; two super admins with same config version.

**Steps:**

1. Save conflicting versions.
2. Roll back a permitted config change.
3. Inject audit persistence failure.

**Expected Result:** Conflict explicit; no lost update; rollback validated/audited; effective value coherent across instances within defined freshness; no unaudited privileged success.

**API coverage:** Versioned config transaction and invalidation.

**Playwright coverage:** PW: conflict/reload/rollback confirmation.


<a id="mail-tests"></a>

### MAIL — Brevo templates, delivery status and retry safety

Source coverage: architecture §§12,25–28,31,40; continue phases 10–11; GAP-07/12/24.

#### MAIL-001 — Every defined transactional event

**Priority:** P1

**Preconditions:** F0; fake Brevo and opted-in verified test recipients.

**Steps:**

1. Trigger welcome, submitted, approved, rejected, changes requested, new enquiry, buyer confirmation, expiry and security notification events.

**Expected Result:** Correct template/recipient/property/reason/links and preference behavior; one durable intent per event; no document attachment or private admin note; welcome only once.

**API coverage:** EmailProvider contract matrix for all event types.

**Playwright coverage:** PW: business-flow evidence plus fake inbox inspection; bounded staging smoke separately.

#### MAIL-002 — Phone-only users and invalid/unverified email

**Priority:** P0

**Preconditions:** F0; missing, malformed, unverified, changed and bounced email fixtures.

**Steps:**

1. Trigger each relevant event.
2. Add valid verified email later.
3. Retry pending delivery according to policy.

**Expected Result:** Business operation succeeds independently; no invented email or wrong-recipient send; skipped/pending reason explicit; retry recipient chosen by frozen safe policy.

**API coverage:** Recipient resolution and delivery eligibility tests.

**Playwright coverage:** PW: dashboard notification and profile prompt remain usable.

#### MAIL-003 — Template escaping and link correctness

**Priority:** P0

**Preconditions:** F0; malicious/Unicode/long user fields and renamed property.

**Steps:**

1. Render HTML/text emails.
2. Inspect title/message/reason and absolute action URLs.

**Expected Result:** Safe HTML and text; correct canonical environment host; no header injection/open redirect/token/phone/internal-note leak; formatting readable.

**API coverage:** Template contract and escaping/scheme tests.

**Playwright coverage:** PW: email HTML render snapshot optional; link request checks without sending.

#### MAIL-004 — Provider errors, quotas and retry budget

**Priority:** P1

**Preconditions:** F0; retryable/permanent error map and max attempts set.

**Steps:**

1. Return 400/401/403/429/5xx, malformed success and timeout.
2. Cross retry schedule and exhaust budget.

**Expected Result:** Permanent errors not hammered; transient backoff/Retry-After respected; capped retry and failed/manual-recovery state; business rows retained.

**API coverage:** Brevo wrapper/status transition and deterministic-clock retries.

**Playwright coverage:** PW: sanitized delivery diagnostics where surfaced; no browser assertion for backoff clock.

#### MAIL-005 — Ambiguous send and duplicate event delivery

**Priority:** P0

**Preconditions:** F0; event identity and provider dedupe capability documented.

**Steps:**

1. Accept send then lose response.
2. Dispatch same event from two workers.
3. Replay webhook/job.

**Expected Result:** One business event/intent; delivery attempts correlated; provider idempotency used only if supported; ambiguous-send policy avoids blind resend and honestly allows bounded duplication risk.

**API coverage:** Unique event key/worker claim/lease/provider-message reconciliation tests.

**Playwright coverage:** PW API; dashboard never falsely states guaranteed exactly-once email.

#### MAIL-006 — Webhook authentication and out-of-order status

**Priority:** P0

**Preconditions:** F0; actual Brevo webhook authentication configured.

**Steps:**

1. Send valid delivered/bounce/failure events, duplicate, old, unknown-message and forged callbacks.

**Expected Result:** Only authentic valid events applied; dedupe and monotonic status rule; accepted versus delivered distinguished; callback never changes listing/auth permissions.

**API coverage:** Webhook raw-body/auth/schema/state matrix; no invented universal HMAC support.

**Playwright coverage:** PW API contract tests; admin status UI if implemented.

#### MAIL-007 — Notification privacy and read state

**Priority:** P0

**Preconditions:** F0; in-app notifications A/B, delivery metadata.

**Steps:**

1. List/read own.
2. Forge recipient.
3. Mark foreign notification read.
4. Alter delivery status/provider ID directly.

**Expected Result:** Own sanitized content only; allowed read-state action only; internal provider metadata private; pagination/empty/error behavior accurate.

**API coverage:** notifications RLS, grants and DTO projection.

**Playwright coverage:** PW: supported notifications/settings surface and API negatives.

#### MAIL-008 — Safe staging delivery and recovery operations

**Priority:** P0

**Preconditions:** F0; fake inbox default, staging allowlist, production secrets separate.

**Steps:**

1. Run normal tests.
2. Run allowlisted integration.
3. Attempt replay/manual retry as unauthorized user.

**Expected Result:** CI sends no real mail; only approved test mailbox receives staging smoke; manual retry privileged/audited; credentials/test bypass absent from client build.

**API coverage:** Environment guard/provider config and retry endpoint authorization.

**Playwright coverage:** PW API and separately tagged provider smoke; never real customer recipients.


<a id="chart-tests"></a>

### CHART — Admin Apache ECharts analytics and metric correctness

Source coverage: design §20; architecture §§33–34; continue phases 9,17; GAP-16.

#### CHART-001 — All six specified chart families

**Priority:** P1

**Preconditions:** F0; independently calculated aggregate dataset.

**Steps:**

1. Open status donut, listing trend, enquiry trend, location bars, property-type bars and submitted→reviewed→approved→enquired funnel.

**Expected Result:** Each chart receives bounded server aggregate; labels/series/counts correct; all lifecycle states accounted or explicit Other; no raw large dataset shipped.

**API coverage:** analytics.aggregate reference sums and DTO size tests.

**Playwright coverage:** PW: admin-analytics.spec.ts all chart panels and accessible summaries.

#### CHART-002 — Date ranges, timezone and funnel definitions

**Priority:** P1

**Preconditions:** F0; GAP-16 metric definitions and timezone fixed.

**Steps:**

1. Switch daily/weekly/monthly.
2. Test midnight, month/year/leap boundaries, reversed/too-large range.
3. Resubmit and re-review same property.

**Expected Result:** Defined time buckets/counting units correct; zero buckets filled; no double-count from retries/resubmission; funnel labels do not imply invalid monotonic counts.

**API coverage:** Pure/reference aggregate tests independent of implementation query.

**Playwright coverage:** PW: range controls and displayed periods/totals.

#### CHART-003 — Zero, singleton, large and missing aggregates

**Priority:** P1

**Preconditions:** F0; 0/1/large values and sparse location/type categories.

**Steps:**

1. Render datasets.
2. Include zero denominator and unknown/deleted dimension.
3. Fail/malformed aggregate response.

**Expected Result:** No NaN/Infinity/crash; readable scales/labels; empty differs from error; no fabricated data; safe unknown grouping.

**API coverage:** Aggregation numeric precision and response-schema validation.

**Playwright coverage:** PW: chart empty/loading/retry and large-label layout.

#### CHART-004 — Analytics permissions and sensitive data

**Priority:** P0

**Preconditions:** F0; guest/buyer/seller/admin and separate owner datasets.

**Steps:**

1. Request admin aggregate directly as each role.
2. Alter seller scope/date.
3. Inspect browser payload.

**Expected Result:** Admin-only ECharts page; seller sees only approved own numeric analytics; no raw PII or cross-owner counts; private responses not shared cached.

**API coverage:** Aggregate authorization/RPC/grants and DTO allowlist.

**Playwright coverage:** PW: route gate and request inspection.

#### CHART-005 — Resize, lazy loading and instance disposal

**Priority:** P1

**Preconditions:** F0; charts offscreen/tabbed and repeated route navigation.

**Steps:**

1. Resize viewport/container.
2. Switch tabs.
3. Scroll into view.
4. Mount/unmount repeatedly.

**Expected Result:** ECharts loads only where needed; chart resizes without clipping; listeners/instances disposed; no growing memory, duplicate tooltip or leaked observer.

**API coverage:** N/A: component/lifecycle profiling and bundle analysis; aggregate API request budget still asserted.

**Playwright coverage:** PW: responsive resize/tab/route loop with memory/DOM diagnostics.

#### CHART-006 — Keyboard/readable alternatives and reduced motion

**Priority:** P1

**Preconditions:** F0; chart page with accessible table/text equivalent.

**Steps:**

1. Use keyboard/screen reader alternative.
2. Disable animation via reduced motion.
3. Inspect contrast and color-independent labels.

**Expected Result:** Essential data available without canvas hover/color alone; chart motion preference honored; legend/controls named and focusable.

**API coverage:** N/A: UI/assistive technology owns access; compare alternative totals to same aggregate.

**Playwright coverage:** PW plus axe and manual screen reader verification.


<a id="db-tests"></a>

### DB — Database constraints, transactions and migrations

Source coverage: architecture §§6,18,24–25,28,30,33,41–42; continue phases 2,15.

#### DB-001 — Schema and constraint inventory

**Priority:** P0

**Preconditions:** F0; migration-defined schema including GAP-22 additions.

**Steps:**

1. Introspect every table/column/default/FK/unique/check/index.
2. Compare to approved schema.
3. Insert boundary-invalid data without application validation.

**Expected Result:** All required fields and relationships exist; invalid enum, numeric, ownership and state invariants rejected by appropriate DB safeguards; no silent type truncation.

**API coverage:** DB migration/constraint tests; direct SQL only in isolated test harness.

**Playwright coverage:** N/A: database invariant tests; browser failures covered by feature cases.

#### DB-002 — Unique keys and concurrent inserts

**Priority:** P0

**Preconditions:** F0; duplicate favorites, slugs, user roles, recent views and idempotency keys.

**Steps:**

1. Insert duplicates serially and concurrently.
2. Vary null/case/normalized phone equivalence.

**Expected Result:** Approved uniqueness holds atomically; conflicts deterministic; no duplicate identity/business event or orphan child.

**API coverage:** Constraint tests with independent connections and concurrent barriers.

**Playwright coverage:** PW API representative duplicate favorite/enquiry; DB owns full matrix.

#### DB-003 — Foreign keys, delete policy and orphan prevention

**Priority:** P0

**Preconditions:** F0; populated parent/child graph across all tables.

**Steps:**

1. Insert unknown parent.
2. Reassign foreign parent.
3. Delete property/user/location under each allowed path.
4. Interrupt cleanup.

**Expected Result:** FK and retention policy preserve required history; no orphan documents/media/enquiries or accidental cascade loss; cleanup failures recoverable.

**API coverage:** Real DB relation and job reconciliation tests.

**Playwright coverage:** PW: affected history/unavailable states; no direct SQL in browser.

#### DB-004 — Money, area, dates and derived consistency

**Priority:** P0

**Preconditions:** F0; precision/unit/time rules fixed.

**Steps:**

1. Round-trip max/min decimals and timestamps.
2. Recompute price_per_unit.
3. Serialize through API/browser.
4. Cross timezone boundary.

**Expected Result:** No floating-point drift, overflow or loss of precision; server derived fields agree; UTC instants/reporting timezone handled distinctly.

**API coverage:** Independent decimal arithmetic and serialization assertions.

**Playwright coverage:** PW: displayed numbers/dates match expected values.

#### DB-005 — Atomic business writes and audit failure

**Priority:** P0

**Preconditions:** F0; submission/review/enquiry transaction fault points.

**Steps:**

1. Fail after each write boundary: property, review, audit, event intent.
2. Retry with same key/version.

**Expected Result:** All-or-defined durable transaction state; no verified listing without required review/audit, no orphan enquiry event; safe retry creates once.

**API coverage:** Injected rollback/commit-failure integration and row count assertions.

**Playwright coverage:** PW: no success toast for rolled-back operation; ambiguous commit handled by read-back.

#### DB-006 — Version checks and consistent status fields

**Priority:** P0

**Preconditions:** F0; revision/version model implemented.

**Steps:**

1. Update with correct, missing, stale and future version.
2. Attempt contradictory status/verification/publication fields.

**Expected Result:** Required precondition enforced; one increment per committed change; no review of superseded revision or contradictory public state.

**API coverage:** Conditional update/constraint/action integration.

**Playwright coverage:** PW: conflict recovery in property/admin forms.

#### DB-007 — Index and query-plan correctness

**Priority:** P1

**Preconditions:** F0; 10k/100k representative fixtures, selective/nonselective filters.

**Steps:**

1. Inspect owner/status/location/type/publish+ID/price/area and buyer/seller enquiry queries.
2. Joins and counts under RLS.

**Expected Result:** Indexes support actual hot queries without excessive write overhead; no N+1/full-table browser fetch; plans and p95 recorded; sequential scan acceptable when planner cost justifies it.

**API coverage:** EXPLAIN ANALYZE/BUFFERS on isolated data; index existence and regression budgets.

**Playwright coverage:** PW API response-size/time regression sampling.

#### DB-008 — Fresh install and upgrade migration

**Priority:** P0

**Preconditions:** F0; empty DB and prior-version populated snapshot.

**Steps:**

1. Apply migrations to both.
2. Run seeds twice.
3. Run rollback/roll-forward rehearsal.
4. Test old/new app overlap.

**Expected Result:** Schema/data/grants correct; migrations deterministic and preserve data; no deploy interval with exposed tables; rollback path documented; seed does not duplicate roles.

**API coverage:** Migration CI plus old/new operation compatibility.

**Playwright coverage:** PW: smoke on upgraded fixture; migration execution is backend-only.

#### DB-009 — Pagination joins and aggregate integrity

**Priority:** P1

**Preconditions:** F0; properties with many images/features/enquiries.

**Steps:**

1. Run cards/list/count/analytics queries and compare independently calculated IDs/totals.

**Expected Result:** Child joins do not multiply rows/counts; correct cover and bounded children; select only intended columns; counts do not leak RLS-hidden records.

**API coverage:** SQL/repository integration with query/payload instrumentation.

**Playwright coverage:** PW: count and card uniqueness checks.


<a id="rls-tests"></a>

### RLS — Direct Supabase RLS and paired object authorization

Source coverage: architecture §§7–9,13,24,36; section 4.2 full matrix; GAP-22.

#### RLS-001 — RLS enabled and object grants inventoried

**Priority:** P0

**Preconditions:** F0; all migration-created database tables/views/functions known; Tigris bucket inventory separate.

**Steps:**

1. Enumerate exposed database objects.
2. Inspect RLS and grants.
3. Create a sample new protected table through migration check.
4. Reconcile separate Tigris access inventory.

**Expected Result:** Every public schema table protected; unknown DB exposure fails CI; view/function/sequence privileges explicit; Tigris bytes covered by STOR rather than fictional Postgres object policies.

**API coverage:** Catalog inspection plus anon/authenticated API probes.

**Playwright coverage:** N/A: database/security CI; do not infer RLS from UI.

#### RLS-002 — Every table × actor × verb × ownership

**Priority:** P0

**Preconditions:** F0; section 4.2 approved; actual anon/user JWT clients.

**Steps:**

1. For every database table and exposed SQL object run SELECT/count/join, INSERT, UPDATE, DELETE, UPSERT for each actor and own/other/missing resource.
2. Verify DB state.
3. Run Tigris operation matrix separately under STOR.

**Expected Result:** Expected visible rows and changed-row count exactly match matrix; forbidden writes have no effect; allowed own operation proves policy not deny-all; service role never used for actor assertions.

**API coverage:** Parameterized direct PostgREST/RPC tests with named subcase results.

**Playwright coverage:** PW API can execute user-token requests; browser is not the RLS proof.

#### RLS-003 — Properties and child parent-state leakage

**Priority:** P0

**Preconditions:** F0; every publication state plus parent/child ID mismatches.

**Steps:**

1. Read/mutate properties/media/features/docs using joins and guessed IDs.
2. Change child parent to foreign property.

**Expected Result:** Eligibility and ownership propagate through children; hidden parent data not exposed by child route/count; cannot attach foreign media/docs or bypass editable state.

**API coverage:** Direct parent/child RLS and FK/column-grant tests.

**Playwright coverage:** PW API adversarial queries and positive own draft view.

#### RLS-004 — Profile columns and role escalation

**Priority:** P0

**Preconditions:** F0; own visible profile and private role tables.

**Steps:**

1. Request all columns/joins.
2. Update is_suspended/user_type/phone/role.
3. Insert user_roles.
4. Spoof editable Auth metadata.

**Expected Result:** Only allowed column projection/mutations; RLS row access alone never grants privileged fields; auth identity and trusted roles unaffected.

**API coverage:** Column privilege/view/RPC and metadata-derived-policy tests.

**Playwright coverage:** PW API; browser profile remains safe.

#### RLS-005 — Enquiry, favorites, history and notification privacy

**Priority:** P0

**Preconditions:** F0; buyerA/B and sellerA/B cross-linked fixtures.

**Steps:**

1. Forge each user/buyer/seller ID.
2. Select counts/joins.
3. Reassign relations/status/provider delivery fields.
4. Delete foreign row.

**Expected Result:** Only defined own/participant access; no private data or mutation through relation reassignment; uniqueness and statuses enforced.

**API coverage:** Direct matrix with before/after snapshots for each table.

**Playwright coverage:** PW API actor contexts; participant UI positive controls.

#### RLS-006 — Privileged tables and server route boundary

**Priority:** P0

**Preconditions:** F0; ordinary admin browser session and authorized server service.

**Steps:**

1. Access reviews/internal notes/audit/settings/reports/delivery internals directly.
2. Call authorized admin routes.
3. Repeat route as buyer.

**Expected Result:** Direct client grants follow explicit policy; only properly authorized server operation gains privilege; service-role bypass is never mistaken for RLS enforcement.

**API coverage:** Admin application authorization before service client plus direct grants matrix.

**Playwright coverage:** PW: route positive/negative and no privileged credential in network.

#### RLS-007 — Views, RPCs and SECURITY DEFINER paths

**Priority:** P0

**Preconditions:** F0; every view/function/exposed schema inventoried.

**Steps:**

1. Invoke all reachable RPCs/views as anon/users.
2. Change parameter IDs.
3. Test search_path manipulation and broad execute grants.

**Expected Result:** Views obey intended caller policies or are restricted; definer functions validate caller/scope, use safe fixed schema resolution and minimal grants; no aggregate/private-row backdoor.

**API coverage:** Direct RPC/view tests and migration lint/grant checks.

**Playwright coverage:** PW API only; user UI does not exercise all exposure paths.

#### RLS-008 — Suspension, role changes and session claims

**Priority:** P0

**Preconditions:** F0; valid JWT retained after role removal/suspension.

**Steps:**

1. Perform direct database operations and application Tigris grant/proxy requests without refreshing token.
2. Manipulate user metadata.
3. Then refresh legitimately.

**Expected Result:** Policy uses trusted current capability/account state where required; stale JWT cannot mutate protected data; missing/null auth identity defaults to deny.

**API coverage:** Real Supabase JWT integration for DB and app authorization; a Supabase JWT is not a Tigris S3 credential.

**Playwright coverage:** PW: retained-session forbidden operation after admin action.

#### RLS-009 — Tigris object access paired with metadata RLS

**Priority:** P0

**Preconditions:** F0; private Tigris media/doc/avatar objects and Supabase metadata for A/B.

**Steps:**

1. Read allowed/foreign metadata as user.
2. Request app sign/proxy/finalize/delete operations.
3. Try raw S3 operations anonymously and alter requested object path.

**Expected Result:** Database RLS and server Tigris authorization both hold; no direct user S3 privilege from Supabase role; all buckets private; publication exposes approved image bytes only via controlled app path.

**API coverage:** User-token DB/app tests plus Tigris unsigned/limited-presigned probes; STOR suite validates credentials and bucket controls.

**Playwright coverage:** PW API and document/media positive controls.

#### RLS-010 — RLS failures, recursion and count side channels

**Priority:** P0

**Preconditions:** F0; complex role/ownership policies and large fixtures.

**Steps:**

1. Query nested joins/counts.
2. Trigger policy dependency failure.
3. Probe hidden IDs and timing within controlled budgets.

**Expected Result:** No policy recursion/500 under normal use; failures deny safely; count/existence output does not reveal hidden records; acceptable measured policy overhead.

**API coverage:** Direct DB/API integration and EXPLAIN under actual roles.

**Playwright coverage:** PW: safe error boundary without private content.

#### RLS-011 — Realtime and unused exposed surfaces

**Priority:** P0

**Preconditions:** F0; inventory of enabled Realtime/GraphQL/extra-schema features.

**Steps:**

1. If enabled, subscribe/query private and foreign records.
2. Revoke role mid-subscription.
3. Inspect disabled surfaces.

**Expected Result:** Unused features remain disabled/restricted; enabled channels honor same privacy/role rules and revocation policy; no alternate access path left untested.

**API coverage:** Conditional transport-specific integration with explicit APPROVED N/A if disabled.

**Playwright coverage:** PW: subscription lifecycle only if product uses it; API security checks otherwise.


<a id="api-tests"></a>

### API — Shared API/action contracts and transport edges

Source coverage: architecture §§23–27,29,36; section 5 operation inventory.

#### API-001 — Operation binding and schema contract

**Priority:** P0

**Preconditions:** F0; every section 5 operation bound to actual route or action.

**Steps:**

1. Invoke valid request.
2. Validate response envelope, safe field projection, IDs, times, money and pagination metadata.

**Expected Result:** Each implemented operation documented/tested; unsupported method/route not silently successful; consistent domain outcome across action and HTTP adapters.

**API coverage:** Contract tests generated from operation inventory; schema independent of returned data.

**Playwright coverage:** PW API all HTTP bindings; browser journeys validate action behavior.

#### API-002 — Missing/malformed/oversized request bodies

**Priority:** P0

**Preconditions:** F0; request size/validation contract fixed.

**Steps:**

1. Send malformed JSON, wrong content type, null/array body, absent fields, repeated form keys, deep objects, oversized multipart and JSON.

**Expected Result:** Safe 400/422/413/415 as mapped; no parser crash or expensive uncontrolled allocation; no partial mutation.

**API coverage:** Parameterized transport partitions for every applicable mutation.

**Playwright coverage:** PW API full matrix; form UI representative field errors.

#### API-003 — Authentication, permission and IDOR parity

**Priority:** P0

**Preconditions:** F0; all role/session/ownership partitions.

**Steps:**

1. Call operation directly without page visit.
2. Omit/alter token/cookie.
3. Use foreign ID.
4. Invoke Server Action outside UI.

**Expected Result:** Server enforces principal/permission/resource/state independently of layout or middleware; no side effects and safe 401/403/404 mapping.

**API coverage:** Operation × actor × scope coverage with direct adapter calls.

**Playwright coverage:** PW API and direct navigation checks.

#### API-004 — HTTP methods, HEAD/OPTIONS and CORS

**Priority:** P0

**Preconditions:** F0; explicit methods/origins defined.

**Steps:**

1. Try GET mutation, unsupported methods, HEAD, OPTIONS/preflight, cross-origin credentialed request and method-override parameter.

**Expected Result:** GET/HEAD never mutate; unsupported methods rejected; HEAD no body/private metadata; allowed-origin policy precise; CORS does not replace auth/CSRF.

**API coverage:** Raw route transport tests including preflight.

**Playwright coverage:** PW: separate-origin attack context; PW API full method matrix.

#### API-005 — Idempotency key scope, payload and lifetime

**Priority:** P0

**Preconditions:** F0; keys scoped by actor/operation and TTL fixed.

**Steps:**

1. Retry identical request.
2. Change payload with same key.
3. Reuse across users/operations.
4. Expire key.
5. Race initial requests.

**Expected Result:** Correct original result or explicit conflict; no cross-user response leak; expired-key behavior defined; one business commit and corresponding effects.

**API coverage:** Submission/approval/enquiry/OTP/delivery idempotency partitions.

**Playwright coverage:** PW: duplicate click/lost-response journey; API owns full key matrix.

#### API-006 — Safe error envelope and request correlation

**Priority:** P1

**Preconditions:** F0; injected validation/conflict/provider/DB errors.

**Steps:**

1. Cause each error code.
2. Inspect API, UI and correlated logs.

**Expected Result:** Documented safe code/message and request ID; no raw SQL/stack/token/document content; response classification distinguishes unavailable, forbidden, invalid and retryable.

**API coverage:** Error mapper contract and log redaction.

**Playwright coverage:** PW: useful next action/retry without false success.

#### API-007 — Timeout before versus after committed write

**Priority:** P0

**Preconditions:** F0; controllable network and commit boundary.

**Steps:**

1. Abort request before commit.
2. Lose response after commit.
3. Retry same action/key.
4. Poll/read result.

**Expected Result:** No client abort assumed to roll back server; durable outcome reconciled; no duplicate mutation or false unsaved/saved status.

**API coverage:** Fault injection and idempotent read-back.

**Playwright coverage:** PW: ambiguous response recovery on submission/enquiry.

#### API-008 — Cache headers and private data transport

**Priority:** P0

**Preconditions:** F0; anonymous/A/B requests and CDN-like replay harness.

**Steps:**

1. Repeat authenticated response with another actor.
2. Inspect Set-Cookie/Vary/Cache-Control and HTML/RSC/action payload.

**Expected Result:** Private results cannot be shared across users; session-setting responses not publicly reused; public DTO remains minimal; sensitive errors uncached.

**API coverage:** Header/SSR/RSC/action projection integration.

**Playwright coverage:** PW: multi-context cache isolation and network assertions.

#### API-009 — Limits, sorting and filtering on all lists

**Priority:** P1

**Preconditions:** F0; every list operation and default/max page size defined.

**Steps:**

1. Send boundary page/cursor/sort/filter inputs to each list.
2. Inspect rows fetched and output.

**Expected Result:** Server applies allowlist, stable order and hard size ceiling consistently; no hidden endpoint returns thousands by default.

**API coverage:** Parameterized list-schema/query-budget tests.

**Playwright coverage:** PW API all lists; browser representative controls.

#### API-010 — Provider callbacks and scheduled operation access

**Priority:** P0

**Preconditions:** F0; hook/job principal and authentication defined.

**Steps:**

1. Call webhooks/jobs without authentication, with wrong/expired credential, altered payload and replay.
2. Call valid event/batch.

**Expected Result:** Only intended machine principal succeeds; caller cannot choose arbitrary recipient/table/path; replay safe; failed jobs do not report completed work.

**API coverage:** Raw-body/schema/replay/job authorization tests.

**Playwright coverage:** PW API only; no public browser control can invoke privileged job.


<a id="sec-tests"></a>

### SEC — Application and infrastructure security regression

Source coverage: architecture §§11,14,24,27,29,35–38,42; continue phase 15.

#### SEC-001 — Stored/reflected/DOM XSS across all text surfaces

**Priority:** P0

**Preconditions:** F0; safe XSS fixture corpus.

**Steps:**

1. Inject into property/profile/enquiry/report/guide/location/admin notes/query strings.
2. View UI/email/metadata/JSON-LD/tooltips.

**Expected Result:** Untrusted content safely escaped or sanitized for its output context; no script/event execution or javascript link; CSP violations reviewed.

**API coverage:** Validation/output contract tests; server and client sink coverage.

**Playwright coverage:** PW: harmless execution sentinel and no unexpected dialogs/network.

#### SEC-002 — SQL and query manipulation

**Priority:** P0

**Preconditions:** F0; text, filter, sort, JSON feature and cursor inputs.

**Steps:**

1. Submit SQL fragments, wildcard-heavy patterns, encoded operators and untrusted column names.

**Expected Result:** Parameterized query/allowlists prevent query change; bounded cost; safe validation/literal result, no private rows or raw SQL errors.

**API coverage:** Repository/service fuzz partitions and query plan limits.

**Playwright coverage:** PW API attacks; browser safe error/result.

#### SEC-003 — IDOR and horizontal/vertical privilege escalation

**Priority:** P0

**Preconditions:** F0; known A/B resource IDs for every feature.

**Steps:**

1. Swap IDs in URL/body/path/query/storage/RPC.
2. Forge actor/role/status.
3. Call super-admin actions as admin.

**Expected Result:** Section 4 matrix enforced at every boundary; no read/write/signing/count leakage; denied attempts produce zero unauthorized effects.

**API coverage:** Full operation/RLS/storage matrix with positive controls.

**Playwright coverage:** PW: direct URL plus request API and multiple roles.

#### SEC-004 — CSRF, origin validation and session fixation

**Priority:** P0

**Preconditions:** F0; hostile origin and victim session; chosen session design fixed.

**Steps:**

1. Submit cross-origin form/fetch/Server Action.
2. Forge Origin/Host combinations.
3. Replay pre-login session material after login.

**Expected Result:** State-changing requests require intended origin/session protections; valid same-origin works; session identity cannot be fixed or swapped by attacker.

**API coverage:** Cookie/origin/action protections for pinned Next.js version.

**Playwright coverage:** PW: two-origin browser harness and legitimate control flow.

#### SEC-005 — Open redirects, SSRF and external URL inputs

**Priority:** P0

**Preconditions:** F0; return URLs, CMS links/images, map URLs and any server fetch adapters.

**Steps:**

1. Use external/protocol-relative/javascript/local/private-IP URL and encoded variants.
2. Change forwarded host.

**Expected Result:** Redirects and outbound fetches restricted to intended destinations; no internal metadata/network access; canonical links use configured host; public image optimizer cannot proxy private documents.

**API coverage:** URL allowlist, redirect validation and safe synthetic fetch adapter tests.

**Playwright coverage:** PW API/redirect assertions; no real internal network probing.

#### SEC-006 — File traversal, MIME confusion and active content

**Priority:** P0

**Preconditions:** F0; MEDIA/DOC synthetic fixtures.

**Steps:**

1. Upload encoded traversal names, path separators, double extensions and active-content types.
2. Attempt public preview/proxy.

**Expected Result:** Server-generated paths and byte validation; no path escape/execution/exfiltration; private bytes stay private; safe download/preview headers.

**API coverage:** Storage/upload/preview route tests.

**Playwright coverage:** PW: harmless rejected-file and sandboxed preview cases.

#### SEC-007 — Secrets, build artifacts and logs

**Priority:** P0

**Preconditions:** F0; production build and test logs/traces available.

**Steps:**

1. Scan client bundles, source maps, HTML/RSC, env example, repository artifacts, errors and telemetry for sentinel secrets.

**Expected Result:** No service-role/Tigris/MSG91/Brevo secret, OTP/token or signed document URL leaked; publishable Supabase key not falsely classified as secret; configured public map key restricted.

**API coverage:** Build/static scan plus runtime log/error checks.

**Playwright coverage:** PW: response/storage inspection; trace redaction verification.

#### SEC-008 — Distributed rate-limit bypass and denial-of-service bounds

**Priority:** P0

**Preconditions:** F0; quotas on OTP request/verify/login/admin login/enquiry/property/upload/report.

**Steps:**

1. Parallelize at L boundaries across instances.
2. Rotate spoofed headers and action keys.
3. Send oversized/deep requests.

**Expected Result:** Shared atomic counters and trusted-proxy parsing hold; no unbounded body/query/image processing; graceful 429/backoff; legitimate traffic recovers.

**API coverage:** Load/limiter/size limit tests isolated from real providers.

**Playwright coverage:** PW: useful rate-limit feedback; API owns distributed load.

#### SEC-009 — Security headers and browser embedding

**Priority:** P1

**Preconditions:** F0; HTTPS staging/production-like config.

**Steps:**

1. Inspect public/private/error/assets headers.
2. Embed sensitive page in hostile iframe.
3. Exercise permitted image/map/scripts.

**Expected Result:** CSP/HSTS/nosniff/referrer/permissions/frame policy effective per architecture; required integrations work; no wildcard credential policy; private documents protected.

**API coverage:** Header contract and CSP-report checks; HTTPS-only controls tested on HTTPS.

**Playwright coverage:** PW: framing and legitimate interaction; console violations reviewed.

#### SEC-010 — Account enumeration and sensitive logging

**Priority:** P0

**Preconditions:** F0; existing/missing/suspended phone and private resource IDs.

**Steps:**

1. Compare authentication/error responses and counts.
2. Trigger failures.
3. Review redacted logs.

**Expected Result:** No unnecessary existence/phone/email/OTP disclosure; appropriate generic auth messages; authorized troubleshooting retains safe correlation; no tokens/body secrets.

**API coverage:** Response equivalence and redaction tests with bounded timing analysis.

**Playwright coverage:** PW: safe messaging for login/forgotten resource flows.

#### SEC-011 — Dependency/configuration and test-backdoor review

**Priority:** P0

**Preconditions:** F0; lockfile, env policies and deployment bundle.

**Steps:**

1. Run dependency scan.
2. Inspect configured environment exposure.
3. Invoke test fixtures/bypass endpoints on production-like build.

**Expected Result:** No reachable critical unmitigated dependency issue or test bypass; test accounts/seeds/secrets not shipped to production; debug diagnostics require authorization.

**API coverage:** Build/config/security CI gate and route inventory.

**Playwright coverage:** PW API production-like negative test-login/test-seed probes.

#### SEC-012 — Retention, privacy export and unsupported actions

**Priority:** P1

**Preconditions:** F0; approved privacy/retention policy and implemented account actions.

**Steps:**

1. Exercise supported data deletion/export if present.
2. Attempt foreign scope/oversized export.
3. Inspect disabled unsupported actions.

**Expected Result:** Only authenticated own authorized data included; no private third-party docs or spreadsheet formula execution in exports if enabled; absent features not silently exposed.

**API coverage:** Conditional export contract and retention authorization; APPROVED N/A if export absent.

**Playwright coverage:** PW: supported confirmation/download or disabled-state checks.

#### SEC-013 — Trusted proxy and origin allowlist correctness

**Priority:** P0

**Preconditions:** F0; actual deployment proxy chain and canonical hosts recorded.

**Steps:**

1. Vary forwarded IP/host/proto headers from untrusted caller.
2. Send valid deployment headers.
3. Run CSRF and limiter checks.

**Expected Result:** Untrusted headers cannot choose identity, bypass quotas or poison canonical/cache/origin checks; legitimate proxy traffic works; trust chain explicitly configured.

**API coverage:** Middleware/service integration against Vercel deployment model and raw HTTP fixtures.

**Playwright coverage:** PW API header variants plus normal HTTPS browser control.


<a id="conc-tests"></a>

### CONC — Concurrency, transaction ordering and idempotency

Source coverage: architecture §§25,28,30–31; original test §§32–33; GAP-09/12/17.

#### CONC-001 — Seller edit versus admin review

**Priority:** P0

**Preconditions:** F0; exact reviewed version and editable-state policy.

**Steps:**

1. Pause review at authorization.
2. Attempt seller mutation.
3. Release both in opposite orders.

**Expected Result:** Only legal serial outcome; reviewed snapshot cannot change underneath approval; loser conflict, not silent data loss; audit matches winner.

**API coverage:** Two independent DB connections with barriers, repeat both interleavings.

**Playwright coverage:** PW: multi-context realistic conflict; backend barriers prove race.

#### CONC-002 — Enquiry versus sold/unpublish/delete/suspend

**Priority:** P0

**Preconditions:** F0; eligible property and synchronized mutation requests.

**Steps:**

1. Race enquiry with each availability-changing action.
2. Inspect committed timestamps/state/events.

**Expected Result:** Serializable business outcome: enquiry either commits while eligible with history retained, or rejects; no enquiry created after forbidden transition wins.

**API coverage:** Transactional parent/current-actor checks and durable event assertions.

**Playwright coverage:** PW: buyer form/admin mutation conflict feedback.

#### CONC-003 — Final upload versus quota/submission/deletion

**Priority:** P0

**Preconditions:** F0; two uploads near quota and editable parent.

**Steps:**

1. Race finalizations.
2. Submit/delete parent between initiation/finalization.
3. Retry failed response.

**Expected Result:** No quota overshoot, incomplete submitted files or foreign/orphan attachment; one consistent object/row state and cleanup path.

**API coverage:** Atomic quota/parent version/finalize transaction and Storage reconciliation.

**Playwright coverage:** PW: upload progress plus changed-parent recovery.

#### CONC-004 — Cover reorder/delete simultaneous operations

**Priority:** P1

**Preconditions:** F0; gallery with one cover and several IDs.

**Steps:**

1. Race cover switch with removal and reorder.
2. Include stale item list.

**Expected Result:** Exactly one valid cover when images remain, deterministic order and conflict response; no duplicate index/reference to deleted object.

**API coverage:** DB uniqueness/version/order transaction.

**Playwright coverage:** PW: two tabs refresh to consistent gallery.

#### CONC-005 — Same business event processed by multiple workers

**Priority:** P0

**Preconditions:** F0; submission/approval/enquiry/expiry event and worker lease.

**Steps:**

1. Deliver same event/job twice.
2. Terminate claimed worker.
3. Let lease expire and recover.

**Expected Result:** One business commit; delivery attempt ownership/lease safe; no lost event; external ambiguous sends reconciled under MAIL-005.

**API coverage:** Unique key, atomic claim and crash recovery integration.

**Playwright coverage:** PW API job tests; dashboard reflects true durable status.

#### CONC-006 — Distributed quotas and final admin demotion

**Priority:** P0

**Preconditions:** F0; shared DB rate/quota store and last-super-admin policy.

**Steps:**

1. Race last available quota slot and simultaneous admin demotions across server instances.

**Expected Result:** Atomic bounds hold; no lost increment or all-admin lockout; losing operation safely rejected.

**API coverage:** Shared-state transactions and multi-instance harness.

**Playwright coverage:** PW API; UI error states verified by ROLE and AUTH suites.

#### CONC-007 — Bulk moderation versus concurrent row edits

**Priority:** P0

**Preconditions:** F0; selected row IDs/versions across pages.

**Steps:**

1. Edit/delete one selected row before bulk commit.
2. Retry whole request after partial success.

**Expected Result:** Each row rechecked; stale result explicit; successful rows not repeated; unselected rows untouched; audit counts match commits.

**API coverage:** Bulk action/version/idempotency integration.

**Playwright coverage:** PW: partial results and retry failed subset.


<a id="cache-tests"></a>

### CACHE — Next.js server caching, freshness and invalidation

Source coverage: architecture §§4–5,19,33; user optimization request; GAP-02/26.

#### CACHE-001 — Public cache candidates and key completeness

**Priority:** P1

**Preconditions:** F0; pinned Next.js caching mode and public cache policy.

**Steps:**

1. Warm location/guide/home/public-detail reads.
2. Vary slug, filters, page, sort and environment.

**Expected Result:** Only intended public DTOs cached; key includes all result-changing inputs; cache hit reduces DB work; no variant contamination; count freshness documented.

**API coverage:** Service/cache integration with hit/miss/query counters.

**Playwright coverage:** PW API repeated and varied URLs; browser content matches keys.

#### CACHE-002 — Publication and content mutation invalidation

**Priority:** P0

**Preconditions:** F0; warmed property/search/home/location/guide/sitemap/OG caches.

**Steps:**

1. Approve, edit allowed content, feature, sell, expire, unpublish, delete or change location/slug.
2. Request each dependent surface.

**Expected Result:** All affected tags/paths/projections refreshed within frozen public freshness policy; security-sensitive removal cannot serve hidden/private detail via stale cache; new canonical/image current.

**API coverage:** Mutation→invalidation matrix with dependency assertions and failed invalidation recovery.

**Playwright coverage:** PW: separate fresh guest context after each mutation.

#### CACHE-003 — Private data, permissions and session cache isolation

**Priority:** P0

**Preconditions:** F0; A/B dashboards/enquiries/admin states.

**Steps:**

1. Warm A response then request as B/guest.
2. Change role/suspension without token refresh.
3. Inspect prefetch and RSC.

**Expected Result:** No shared private data or cached authorization success; current permissions enforced; logout clears client-visible state; private errors safe.

**API coverage:** Cache headers/keys/service authorization and multi-instance replay.

**Playwright coverage:** PW: account switching/back/prefetch and role revocation.

#### CACHE-004 — Cold start, eviction and process restart

**Priority:** P1

**Preconditions:** F0; cache empty/evicted and two runtime instances.

**Steps:**

1. Warm then restart/evict.
2. Read and mutate on separate instances.
3. Drop optional cache access.

**Expected Result:** Correctness independent of cache existence; database authoritative; no per-process-only quota/deduplication; graceful cache miss within measured budget.

**API coverage:** Multi-instance cache behavior and source query fallback.

**Playwright coverage:** PW API cold/warm comparison; UI handles loading.

#### CACHE-005 — Stampede and failed revalidation

**Priority:** P1

**Preconditions:** F0; popular public item at TTL boundary.

**Steps:**

1. Expire cache.
2. Burst requests.
3. Fail refresh.
4. Recover.
5. Unpublish during refresh.

**Expected Result:** Bounded refresh work where feasible; stale-public-content policy explicit; errors do not poison cache indefinitely; private/unpublished data never introduced by fallback.

**API coverage:** Burst/failure/invalidations race and query-count/load tests.

**Playwright coverage:** PW API load and final public eligibility check.

#### CACHE-006 — Cache poisoning and host/header variation

**Priority:** P0

**Preconditions:** F0; canonical host and allowlisted headers.

**Steps:**

1. Send spoofed host/forwarded host, user cookies, query duplication and alternate accept/RSC headers.
2. Read normal request.

**Expected Result:** Attacker-controlled input cannot cache private/error content or malicious canonical/redirect for others; correct response variation.

**API coverage:** Raw HTTP header/cache-key regression.

**Playwright coverage:** PW API and clean guest context.

#### CACHE-007 — No Redis dependency at MVP and upgrade evidence

**Priority:** P1

**Preconditions:** F0; chosen Next.js plus Supabase-only MVP; shared DB atomic guards.

**Steps:**

1. Deploy without Redis configuration.
2. Run concurrency/rate/cache/load suites.
3. Record DB/cold-cache/latency metrics.

**Expected Result:** All core flows correct without Redis; no local-memory security substitute; Redis considered only if measured contention/latency/durability needs justify a documented future change.

**API coverage:** Deployment config, shared DB counters and load profile checks.

**Playwright coverage:** PW: core smoke with intended MVP services only.


<a id="rec-tests"></a>

### REC — Failures, recovery and data reconciliation

Source coverage: design §§23–25; architecture §§26,38–42; original test §§33–34.

#### REC-001 — Supabase Auth/DB and Tigris storage independently unavailable

**Priority:** P0

**Preconditions:** F0; fault injection per dependency.

**Steps:**

1. Fail each service during read, draft save, submit, review and enquiry.
2. Restore and retry.

**Expected Result:** No false success, private fallback or uncontrolled retries; preserved recoverable input; completed writes reconciled; dependency-specific safe next action.

**API coverage:** Failure-point matrix and DB/object side-effect assertions.

**Playwright coverage:** PW: loading→error→retry→success for core flows.

#### REC-002 — Provider outage while business operation commits

**Priority:** P0

**Preconditions:** F0; MSG91/Brevo independent faults.

**Steps:**

1. Fail SMS during login.
2. Fail email after approval/enquiry.
3. Recover services.

**Expected Result:** Login never bypasses OTP; committed business data retained; pending/failed delivery tracked; retry bounded and duplicate-safe.

**API coverage:** Provider/service and durable intent integration.

**Playwright coverage:** PW: login error and enquiry/approval success with delivery pending.

#### REC-003 — Browser offline, tab close and stale restore

**Priority:** P1

**Preconditions:** F0; partial form and recent durable version.

**Steps:**

1. Disconnect, background/close tab, reopen and reconnect.
2. Restore old cached page after another context edits.

**Expected Result:** No unacknowledged data loss claim; recover last durable/recoverable edits per policy; conflicts explicit; stale view cannot overwrite current state.

**API coverage:** Timeout/read-back/version contracts.

**Playwright coverage:** PW offline/context restore plus manual hard-close check.

#### REC-004 — DB commit succeeds but cache/notification fails

**Priority:** P0

**Preconditions:** F0; mutation transaction committed; side-effect step fails.

**Steps:**

1. Inject failure after commit.
2. Retry request and recovery worker.
3. Read all dependent views.

**Expected Result:** Business result not duplicated or rolled back fictionally; durable repair intent exists; pending effects retried/alerted; publication/privacy maintained.

**API coverage:** Post-commit fault/reconciliation and idempotency tests.

**Playwright coverage:** PW: honest status and eventual consistent public/dashboard view.

#### REC-005 — Orphan object and dangling database cleanup

**Priority:** P0

**Preconditions:** F0; orphan staged files, missing bytes, active uploads and referenced documents.

**Steps:**

1. Run cleanup at age boundaries.
2. Fail batch halfway.
3. Retry while active upload completes.

**Expected Result:** Only eligible orphan resources removed; grace period/leases protect in-flight data; missing bytes flagged; job checkpoint idempotent and auditable.

**API coverage:** Storage↔DB reconciliation and bounded job queries.

**Playwright coverage:** PW: unavailable file/retry status; backend owns cleanup.

#### REC-006 — Database and Storage restore rehearsal

**Priority:** P0

**Preconditions:** F0; isolated restore target; approved RPO/RTO and backup scope.

**Steps:**

1. Create known property/docs/enquiry/audit fixture.
2. Back up.
3. Mutate/delete.
4. Restore DB and object bytes.
5. Run consistency and permission checks.

**Expected Result:** Measured recovery meets targets; both rows and private file bytes usable with correct ACL; no unintended email/SMS replay; production untouched.

**API coverage:** Restore runbook, checksums, migrations/RLS and event-state verification.

**Playwright coverage:** PW: core read/login/review smoke against restored isolated environment.

#### REC-007 — Expired leases, missed schedules and duplicate jobs

**Priority:** P0

**Preconditions:** F0; expiry/retention/delivery jobs with auth/checkpoints.

**Steps:**

1. Stop worker mid-batch.
2. Skip schedule.
3. Run overlapping retries after clock boundary.

**Expected Result:** Work resumes from durable checkpoint; one logical transition; bounded batch/lease; missed items caught up; failed work not marked complete.

**API coverage:** Scheduler principal/idempotency/time/lease tests.

**Playwright coverage:** PW API job integration and status UI if present.

#### REC-008 — Retry exhaustion and operational alert

**Priority:** P1

**Preconditions:** F0; alert thresholds and on-call destination configured to test sink.

**Steps:**

1. Cause persistent failure until budget exhausted.
2. Recover service.
3. Perform authorized manual replay.

**Expected Result:** One actionable deduplicated alert with safe request/event ID; failed state retained; audited replay works without duplication; alert clears on recovery.

**API coverage:** Monitoring/delivery retry contract and authorization.

**Playwright coverage:** PW: relevant admin diagnostics; alert sink assertions at backend.


<a id="ui-tests"></a>

### UI — Responsive UI, design consistency and browser behavior

Source coverage: design §§1–30; continue phases 1,4–10,17.

#### UI-001 — Required viewport and orientation matrix

**Priority:** P1

**Preconditions:** F0; representative populated/empty/error pages.

**Steps:**

1. Run 360,375,390,430,768,1024,1280,1366,1440px widths.
2. Portrait/landscape and short viewport.
3. Visit every screen family.

**Expected Result:** No unintended page horizontal overflow, clipping or inaccessible primary action; intentional table scroll labeled; layout follows mobile-first card grid/header/sidebar rules.

**API coverage:** N/A: responsive browser checks; underlying requests still bounded.

**Playwright coverage:** PW: responsive.spec.ts parameterized viewport matrix and screenshots.

#### UI-002 — Header, mobile navigation and sticky actions

**Priority:** P1

**Preconditions:** F0; long home/search/detail and authenticated/admin pages.

**Steps:**

1. Scroll, open menu, navigate, rotate and show virtual keyboard near forms.

**Expected Result:** Sticky header/contact CTA does not cover content/focus; safe-area insets handled; menu reachable and closable; current role/account state correct.

**API coverage:** N/A: layout/interaction test.

**Playwright coverage:** PW: mobile menu/sheet/sticky CTA; real-device keyboard check.

#### UI-003 — Forms and uploads on narrow/short screens

**Priority:** P1

**Preconditions:** F0; ten-step form with long labels/errors/upload progress.

**Steps:**

1. Complete core forms at 360px.
2. Trigger multiple errors.
3. Open selects/combobox/date controls.
4. Rotate during upload.

**Expected Result:** Labels/errors/actions readable; focused field scrolls into view; keyboard does not hide submit indefinitely; progress and entered data survive rotation.

**API coverage:** Validation APIs as feature suites; no additional client-only rules.

**Playwright coverage:** PW mobile flow plus real iOS/Android keyboard smoke.

#### UI-004 — Design tokens, typography and status meaning

**Priority:** P2

**Preconditions:** F0; design.md tokens and approved font chosen.

**Steps:**

1. Compare buttons/cards/forms/status badges/table/charts across page families at desktop/mobile.

**Expected Result:** Forest green/charcoal/warm-white palette, 4px spacing, specified radii/type scale/max-width used consistently; price strongest metadata; status not color-only.

**API coverage:** N/A: component/visual checks.

**Playwright coverage:** PW screenshot regression with stable fonts/clock; manual design review.

#### UI-005 — Dialogs, sheets and nested-interaction behavior

**Priority:** P1

**Preconditions:** F0; delete/reject/changes/report dialogs and mobile filter/nav sheets.

**Steps:**

1. Open each by keyboard/touch.
2. Submit, cancel, Escape and click outside according to policy.
3. Open another trigger while one is active.

**Expected Result:** No accidental mutation on dismiss; no nested modal trap; body scroll/focus restored; loading state prevents repeated action yet failure can be retried.

**API coverage:** Mutation count assertions for confirm dialogs.

**Playwright coverage:** PW: parameterized dialog/sheet interaction tests.

#### UI-006 — All required empty/loading/error states

**Priority:** P1

**Preconditions:** F0; no saved/listings/results/enquiries/verifications/recent history; error fixture matrix.

**Steps:**

1. Render each empty state, skeleton and network/unauthorized/forbidden/removed/sold/review/image/upload/OTP/rate error.

**Expected Result:** Specific useful next action; errors not disguised as empty; skeleton preserves geometry; no permanent full-page spinner or success toast on failure.

**API coverage:** Typed error/state mapping per feature.

**Playwright coverage:** PW: UI state gallery plus representative route faults.

#### UI-007 — Touch, hover, keyboard and long content

**Priority:** P1

**Preconditions:** F0; mouse, touch and keyboard contexts with long Unicode content.

**Steps:**

1. Use hover-only affordances with touch/keyboard.
2. Tap adjacent card/save controls.
3. Zoom text.
4. Scroll gallery/table.

**Expected Result:** All actions available without hover; touch targets usable; long words/numbers wrap safely; no accidental card navigation or drag-only essential control.

**API coverage:** N/A: interaction and layout; mutation request counts where relevant.

**Playwright coverage:** PW: input modality matrix; manual touch validation.

#### UI-008 — Subtle motion and reduced-motion behavior

**Priority:** P2

**Preconditions:** F0; prefers-reduced-motion on/off.

**Steps:**

1. Open sheets/accordions, hover cards, navigate and animate charts.

**Expected Result:** Normal transitions follow subtle 150–250ms guidance; reduced motion removes nonessential motion; no scroll-card animation overload or blocked interaction.

**API coverage:** N/A: CSS/component settings.

**Playwright coverage:** PW: media preference and computed style/animation inspection.

#### UI-009 — Browser engine and real-device coverage

**Priority:** P1

**Preconditions:** F0; pinned Chromium/Firefox/WebKit and supported Chrome/Edge.

**Steps:**

1. Run critical journeys per engine.
2. Smoke real Chrome Android and Safari iOS.
3. Test storage/cookies/file picker/download/touch.

**Expected Result:** Same authorization/data outcomes and usable controls; documented platform limits not hidden; emulation is not claimed as real Safari/device verification.

**API coverage:** API behavior browser-independent; browser-specific session transport validated.

**Playwright coverage:** PW projects plus recorded real-device smoke evidence.


<a id="a11y-tests"></a>

### A11Y — Accessibility and assistive-technology acceptance

Source coverage: design §§21–22,27–28; original test §27; GAP-26.

#### A11Y-001 — Automated accessibility screen/state matrix

**Priority:** P1

**Preconditions:** F0; home/search/detail/login/post/dashboard/admin/location/guide screens in loaded/error/dialog states.

**Steps:**

1. Run axe on each screen/state at desktop/mobile.
2. Triage all serious/critical findings and applicable AA checks.

**Expected Result:** No unresolved serious/critical violations; manual checks cover what axe cannot; hidden/offscreen virtualized nodes do not mask essential accessibility failures.

**API coverage:** N/A: accessibility tooling.

**Playwright coverage:** PW+axe parameterized pages and open dialogs.

#### A11Y-002 — Keyboard order, focus and skip navigation

**Priority:** P1

**Preconditions:** F0; all navigation/forms/tables/filter/gallery controls.

**Steps:**

1. Complete primary journeys with keyboard only.
2. Use skip link.
3. Change route.
4. Open/close overlays.

**Expected Result:** Logical order, visible focus, no trap except active dialog; focus moves to relevant heading/error and returns to trigger; offscreen/hidden controls not focusable.

**API coverage:** N/A: keyboard UX.

**Playwright coverage:** PW keyboard suite plus manual walkthrough.

#### A11Y-003 — Names, labels, headings and semantics

**Priority:** P1

**Preconditions:** F0; forms/cards/status charts and page landmarks.

**Steps:**

1. Inspect accessibility tree.
2. Focus icon-only Save/Search/Account/Report buttons and every field.

**Expected Result:** Semantic heading hierarchy/landmarks; explicit labels and errors linked; image alt meaningful; button names and current navigation state announced.

**API coverage:** N/A: DOM/accessibility tree.

**Playwright coverage:** PW role/label locators and axe; manual image-alt review.

#### A11Y-004 — Dialogs and asynchronous announcements

**Priority:** P1

**Preconditions:** F0; OTP/upload/save/enquiry and modal flows.

**Steps:**

1. Trigger progress/success/error.
2. Open dialog.
3. Tab/Shift-Tab/Escape.
4. Dismiss after failure.

**Expected Result:** Dialog titled and focus-contained; aria-live announces useful nonrepetitive changes; user can recover; background not interactive while modal active.

**API coverage:** N/A except request count for announced mutation result.

**Playwright coverage:** PW focus/assertions plus screen-reader verification.

#### A11Y-005 — Contrast, status distinction and zoom/reflow

**Priority:** P1

**Preconditions:** F0; light design/status colors, disabled/error states and long content.

**Steps:**

1. Measure normal/large text and UI contrast.
2. Zoom 200% and inspect 320 CSS px reflow.
3. Test forced colors where supported.

**Expected Result:** AA contrast and usable focus/controls; muted/status tokens adjusted if failing; color not sole signal; no loss of content/actions.

**API coverage:** N/A: contrast/manual visual tooling.

**Playwright coverage:** PW screenshots/media checks plus measured contrast evidence.

#### A11Y-006 — Accessible gallery, filters, stepper and virtual rows

**Priority:** P1

**Preconditions:** F0; gallery/filter/form/admin virtualization enabled where justified.

**Steps:**

1. Navigate without pointer.
2. Move to offscreen row.
3. Sort/filter while focus in table.
4. Reorder photos with alternative controls.

**Expected Result:** All functionality keyboard-accessible; live row indices/total and selection clear; virtual unmount does not lose active focus; step error navigates to field.

**API coverage:** N/A: component accessibility; table fetch only scoped page.

**Playwright coverage:** PW: keyboard across virtualization boundary plus screen reader.

#### A11Y-007 — Charts and reduced motion alternatives

**Priority:** P1

**Preconditions:** F0; all admin charts and motion preference.

**Steps:**

1. Read chart via table/text alternative.
2. Distinguish series without color.
3. Change date range.
4. Reduce motion.

**Expected Result:** Equivalent metric information available without hover/canvas; range update announced; no motion requirement; focus remains stable.

**API coverage:** Compare accessible summary to aggregate API.

**Playwright coverage:** PW + manual NVDA/VoiceOver or available equivalent; record actual technology.


<a id="seo-tests"></a>

### SEO — SSR, metadata, canonical routing and crawlability

Source coverage: design §§1,29; architecture §§4–5,20–22; continue phases 12–14.

#### SEO-001 — Server-rendered public content without JavaScript

**Priority:** P1

**Preconditions:** F0; eligible property/location/guide and home/search pages.

**Steps:**

1. Fetch initial HTML.
2. Disable JS.
3. Inspect title/price/area/location/description/image/breadcrumb and similar/internal links.

**Expected Result:** Essential content and crawlable links available server-side; no client-only empty shell; private fields absent; public virtualization cannot erase all indexable content.

**API coverage:** Initial HTTP/RSC response and data projection assertions.

**Playwright coverage:** PW no-JS context plus request HTML parsing.

#### SEO-002 — Property metadata and social previews

**Priority:** P1

**Preconditions:** F0; normal/long/Unicode property and current canonical host.

**Steps:**

1. Read title, description, canonical, Open Graph and Twitter card before/after approved edit.
2. Fetch image.

**Expected Result:** Correct unique safely escaped metadata; absolute canonical and reachable approved image; no stale title/price or private media; no fabricated rich-result promise.

**API coverage:** Metadata/OG handlers and cache invalidation.

**Playwright coverage:** PW API/source assertions and browser page title.

#### SEO-003 — Location and guide SEO fields

**Priority:** P1

**Preconditions:** F0; every landing location and published guide.

**Steps:**

1. Inspect custom/fallback metadata, author/updated date and related links.
2. Test empty optional SEO fields.

**Expected Result:** Useful distinct title/description/canonical and index policy; server content reflects source; fallbacks bounded; internal links target canonical eligible routes.

**API coverage:** Location/article metadata contract.

**Playwright coverage:** PW route crawl and source inspection.

#### SEO-004 — Structured data and escaping

**Priority:** P1

**Preconditions:** F0; property/breadcrumb structured-data schema chosen appropriately.

**Steps:**

1. Parse JSON-LD.
2. Validate fields/URLs/numbers.
3. Inject closing-script text.
4. Change listing status.

**Expected Result:** Valid safe JSON matching visible content and supported schema; no false title guarantee, rating or invented fields; hidden listings emit no private structured data.

**API coverage:** JSON-LD serializer/schema and eligibility unit/integration tests.

**Playwright coverage:** PW initial HTML parsing; external validator manual only when useful.

#### SEO-005 — Noindex and access controls on private pages

**Priority:** P0

**Preconditions:** F0; auth/dashboard/admin/draft/review/rejected/private preview URLs.

**Steps:**

1. Request as guest and authorized owner.
2. Inspect HTTP, robots meta/header, sitemap and HTML.

**Expected Result:** Unauthorized contents protected regardless of robots; private pages noindex and excluded from sitemap; robots.txt is not authorization; noindex not accidentally prevented from being observed where needed.

**API coverage:** Response/auth/metadata matrix.

**Playwright coverage:** PW guest versus owner contexts and source checks.

#### SEO-006 — Canonical redirects and slug history

**Priority:** P1

**Preconditions:** F0; old/new slugs, trailing slash/case/encoded variants, alternate host.

**Steps:**

1. Request each variant and redirect chain.
2. Include hidden/deleted renamed resource.

**Expected Result:** One canonical identity and intended permanent redirect status; no loop/chain explosion/open redirect; hidden content not exposed by redirect metadata; query tracking handling consistent.

**API coverage:** Slug-history/redirect route tests.

**Playwright coverage:** PW navigation plus request status/location checks.

#### SEO-007 — Sitemap inclusion/exclusion and lastmod

**Priority:** P1

**Preconditions:** F0; all publication states and dated changes.

**Steps:**

1. Generate sitemap.
2. Approve/edit/unpublish/delete/expire property and publish/unpublish guide.
3. Regenerate.

**Expected Result:** Exactly eligible canonical property/location/guide URLs; no private/query-heavy/duplicate URLs; accurate lastmod for meaningful change; sold policy explicit.

**API coverage:** Sitemap generation and cache invalidation reference-set comparison.

**Playwright coverage:** PW API sitemap parse and sampled URL fetch.

#### SEO-008 — Sitemap scale and index boundaries

**Priority:** P1

**Preconditions:** F0; configured protocol-compliant sitemap count/byte caps.

**Steps:**

1. Generate at cap−1/cap/cap+1 for URL count and uncompressed bytes.
2. Inspect sitemap index and escaped URLs.

**Expected Result:** Splits before protocol limits; index references accessible child files without omission/duplication; valid UTF-8/XML and absolute canonical URLs; bounded memory/query paging.

**API coverage:** Generator boundary/streaming and count tests; confirm limits against current protocol during binding.

**Playwright coverage:** PW API file retrieval/XML validation; no browser rendering needed.

#### SEO-009 — Robots and environment indexing rules

**Priority:** P0

**Preconditions:** F0; production and staging environments, canonical domain fixed.

**Steps:**

1. Fetch robots and metadata in each.
2. Inspect sitemap declaration.
3. Deploy config variant with missing domain.

**Expected Result:** Staging/test/private surfaces cannot accidentally become intended public index targets; production public pages not blanket noindexed; no secrets in robots; domain config fail-safe.

**API coverage:** Environment configuration and response tests.

**Playwright coverage:** PW API robots/headers; deployment smoke.

#### SEO-010 — Filtered search pagination and thin content

**Priority:** P1

**Preconditions:** F0; GAP-18 allowlist for valuable search pages and page-number mapping.

**Steps:**

1. Open base search/page2 and arbitrary filter/query combinations.
2. Inspect canonical/index policy and links.

**Expected Result:** No infinite faceted crawl or all-pages canonical-to-page1 mistake; meaningful numbered pages follow explicit policy; thin variants excluded; direct page URLs work with SSR.

**API coverage:** Search metadata and pagination route tests.

**Playwright coverage:** PW source and next/previous anchor assertions.

#### SEO-011 — 404, unavailable and redirect status accuracy

**Priority:** P1

**Preconditions:** F0; unknown/removed/sold/expired pages.

**Steps:**

1. Request initial response and client navigation.
2. Inspect status/body/metadata.

**Expected Result:** Absent/hidden resource not a misleading soft-404 200 with leaked content; sold historical policy explicit; useful next action; no private data in streamed payload.

**API coverage:** HTTP route status and streamed metadata checks for pinned Next.js.

**Playwright coverage:** PW request and page navigation parity.

#### SEO-012 — Internal-link and image discoverability audit

**Priority:** P1

**Preconditions:** F0; seeded full public content graph.

**Steps:**

1. Crawl homepage/cards/breadcrumb/similar/location/guide/footer links.
2. Inspect image alt/dimensions and broken destinations.

**Expected Result:** Crawlable anchors with accurate labels and canonical targets; no broken core links, private URLs or missing approved images; no reliance on click handlers alone.

**API coverage:** Crawl/asset HTTP checks bounded to test site.

**Playwright coverage:** PW link crawl and initial source checks.


<a id="perf-tests"></a>

### PERF — Optimization, virtualization, indexing and load

Source coverage: architecture §§4–5,15–19,32–34,43; design §§16,20,24; user optimization requirements.

#### PERF-001 — Public core Web Vitals and Lighthouse budgets

**Priority:** P1

**Preconditions:** F0; production build; fixed mobile network/CPU/hardware profile; warm/cold cache.

**Steps:**

1. Measure home/search/detail/location/guide.
2. Run repeated Lighthouse samples and field-like interactions.

**Expected Result:** Preserve LCP<2.5s, CLS<0.1 and practical INP<200ms goals; Lighthouse performance≥85, accessibility/best-practices/SEO≥95 initial targets; record median and tail, not one favorable run.

**API coverage:** Page and asset payload timing; server query spans correlated.

**Playwright coverage:** PW user flows plus Lighthouse CI; INP measured via appropriate interaction/field instrumentation, not invented from Lighthouse score.

#### PERF-002 — API latency under defined concurrent load

**Priority:** P1

**Preconditions:** F0; 10k representative listings, 100 concurrent virtual users, fixed region/cache mix.

**Steps:**

1. Ramp load on home/search/detail.
2. Include filtered/deep-page reads and bounded writes.
3. Measure steady-state then recovery.

**Expected Result:** Normal DB-operation API p95≤800ms initial gate, ≤500ms target; error budget agreed and unexpected 5xx investigated; no unbounded queues/connections; correct responses under load.

**API coverage:** k6/equivalent request mix with p50/p95/p99, errors, throughput and DB saturation.

**Playwright coverage:** PW API correctness sample during load; no full browser-per-user assumption.

#### PERF-003 — Server pagination rather than fetch-all

**Priority:** P0

**Preconditions:** F0; each public/admin/dashboard list with large fixtures.

**Steps:**

1. Load first/last/filter pages.
2. Inspect network response, DB rows and client allocation.

**Expected Result:** Hard bounded query and DTO; server applies filter/sort/offset/cursor; table virtualization never justifies downloading entire dataset.

**API coverage:** Shared pagination/projection contract and query instrumentation.

**Playwright coverage:** PW request-size/row-count assertions for every list family.

#### PERF-004 — Debounce and throttle request budgets

**Priority:** P1

**Preconditions:** F0; section 7 default timers and test clock.

**Steps:**

1. Generate rapid search/type/resize/scroll/autosave events.
2. Unmount/remount.
3. Change latest value near trailing boundary.

**Expected Result:** Search sends latest committed value once per intended debounce; autosave max-wait prevents starvation; throttle avoids event flood and retains necessary trailing update; listeners/timers removed.

**API coverage:** Timer/component/service call-count tests; server rate limit independent of client timing.

**Playwright coverage:** PW rapid interaction and request budget; API rate limits still tested separately.

#### PERF-005 — Virtualized admin table rendering bounds

**Priority:** P1

**Preconditions:** F0; profiling justifies virtualization; current server page bounded; stable row IDs.

**Steps:**

1. Scroll top/middle/end rapidly.
2. Filter/sort/page.
3. Measure DOM row count and frame responsiveness.

**Expected Result:** Only viewport+overscan rows mounted; total/scroll height accurate; rows display correct records without blank gaps/duplicates; no fetch-all or growing unbounded retained pages.

**API coverage:** List API remains paginated; instrumentation asserts DOM/payload limits.

**Playwright coverage:** PW: virtual-table.spec.ts rendered-window and fast-scroll assertions.

#### PERF-006 — Virtualized selection, keyboard and variable height

**Priority:** P0

**Preconditions:** F0; selectable rows, expanded details/long text and changing viewport.

**Steps:**

1. Select row.
2. Scroll it out/in.
3. Shift focus across render boundary.
4. Sort/delete/change row height.
5. Execute bulk action.

**Expected Result:** Selection bound to IDs, not recycled indexes; focused row remains accessible; offscreen selection visible in count; height measurement no overlap; bulk affects exact selected authorized IDs.

**API coverage:** Selected-ID/version contract and row-key unit tests.

**Playwright coverage:** PW: keyboard/offscreen selection/expansion and bulk result; manual screen reader.

#### PERF-007 — Virtualization scope and nonvirtual fallback

**Priority:** P1

**Preconditions:** F0; public SEO results and short/long admin tables.

**Steps:**

1. Disable virtualization feature or use small dataset.
2. Inspect initial public HTML/no-JS.
3. Test browser find/print expectations if supported.

**Expected Result:** Public SEO listings retain crawlable SSR page content; short tables remain simple; virtualization used only after measured benefit; accessibility/fallback preserves essential tasks.

**API coverage:** N/A for virtualization logic; public/list DTO and pagination contract retained.

**Playwright coverage:** PW: enabled/disabled table behavior and no-JS public route.

#### PERF-008 — Query count, composite indexes and count cost

**Priority:** P1

**Preconditions:** F0; representative indexed data and RLS role; query budget recorded.

**Steps:**

1. Fetch cards/admin rows/aggregates with 1 then page-limit records.
2. Filter by hot combinations.
3. Inspect plans including exact counts.

**Expected Result:** Query count not proportional to row count; suitable compound/tie-breaker/owner indexes; expensive count strategy documented/cached only safely; unused indexes not added blindly.

**API coverage:** EXPLAIN ANALYZE/BUFFERS and query-count regression with reference correctness.

**Playwright coverage:** PW API payload count; backend owns plan evidence.

#### PERF-009 — Rendering boundaries and bundle splitting

**Priority:** P1

**Preconditions:** F0; production build analyzer.

**Steps:**

1. Inspect public/server/client chunks and initial fetch waterfall.
2. Open admin chart/map only when needed.

**Expected Result:** Server Components deliver initial data; only interactive islands client-side; ECharts excluded from public route chunks; map/chart dynamically loaded; no duplicate initial fetch or giant dependency bundle.

**API coverage:** Build manifest/bundle budgets and SSR integration.

**Playwright coverage:** PW: route network waterfall and delayed chunk requests.

#### PERF-010 — Images, fonts and layout stability

**Priority:** P1

**Preconditions:** F0; realistic images/font files and slow network.

**Steps:**

1. Load search/gallery at DPR/viewports.
2. Block one asset.
3. Navigate with warm cache.

**Expected Result:** Responsive images and thumbnails sized appropriately; reserved dimensions/fallbacks; font loading avoids excessive shift; only LCP image eager; below-fold media lazy; no original giant files on cards.

**API coverage:** Asset size/dimension/cache-header assertions.

**Playwright coverage:** PW: network/image load and CLS evidence.

#### PERF-011 — Server aggregates and chart cost

**Priority:** P1

**Preconditions:** F0; 10k/100k events and all chart types.

**Steps:**

1. Request bounded date ranges.
2. Inspect aggregate bytes/SQL.
3. Resize charts under CPU throttle.

**Expected Result:** Browser receives small series/totals, never raw rows to count/join; date range capped; server aggregation indexed; responsive chart without long blocking tasks.

**API coverage:** Aggregate query/row/payload budgets and result correctness.

**Playwright coverage:** PW: chart interaction and payload inspection.

#### PERF-012 — Connection pooling, burst recovery and resource cleanup

**Priority:** P1

**Preconditions:** F0; serverless-compatible Supabase access configuration; load harness.

**Steps:**

1. Burst cold requests then idle.
2. Repeat route/navigation/upload cycles.
3. Inspect DB connections, event listeners and memory.

**Expected Result:** Connection budget stable; no one-new-unbounded-pool per request; requests time out safely; memory/listeners/objects reclaimed; app recovers after spike.

**API coverage:** Runtime/DB telemetry and connection/timeout budget tests.

**Playwright coverage:** PW navigation-cycle memory sampling plus API burst harness.

#### PERF-013 — Cache usefulness and Redis introduction threshold

**Priority:** P1

**Preconditions:** F0; Next.js public caches and shared PostgreSQL guards; no Redis.

**Steps:**

1. Compare cold/warm request latency and query work.
2. Stress atomic limiter/intent claims.
3. Record p95, lock waits, CPU and connection pressure.

**Expected Result:** Optimizations retain correctness; current stack meets measured gate or explicit bottleneck recorded; Redis proposal requires demonstrated benefit, failure policy and fresh tests, not speculative addition.

**API coverage:** Cache hit/miss and database contention/load metrics.

**Playwright coverage:** PW API benchmark; core browser journey during cold cache.

#### PERF-014 — Performance regressions under negative flows

**Priority:** P1

**Preconditions:** F0; slow network, malformed query and dependency errors.

**Steps:**

1. Rapidly change filters then fail final response.
2. Retry upload.
3. Open long admin table while analytics fails.

**Expected Result:** Cancellation/debounce prevent request storms; retry/backoff bounded; input remains usable; no repeated render/effect loop, runaway logs or unbounded network requests.

**API coverage:** Request/render counters, timeout and retry-budget assertions.

**Playwright coverage:** PW controlled fault/rapid interaction and console/network counts.


<a id="ops-tests"></a>

### OPS — Environment, deployment and release operations

Source coverage: architecture §§27,37–43; continue phases 0,15–18.

#### OPS-001 — Environment configuration and startup validation

**Priority:** P0

**Preconditions:** F0; local/staging/production config templates with sentinel secrets.

**Steps:**

1. Build with required variable missing/invalid.
2. Inspect public env.
3. Deploy valid staging configuration.

**Expected Result:** Missing critical config fails clearly without revealing secrets; actual Supabase/MSG91/Brevo endpoints match environment; no unintended production test traffic.

**API coverage:** Config schema/build/startup integration.

**Playwright coverage:** PW smoke against explicit staging baseURL only.

#### OPS-002 — HTTPS, domain and canonical routing

**Priority:** P1

**Preconditions:** F0; configured Vercel domain/SSL and redirect policy.

**Steps:**

1. Request HTTP/HTTPS/canonical/alternate domains.
2. Inspect auth cookies, assets and metadata.

**Expected Result:** Valid TLS/HTTPS behavior; no mixed content; canonical host consistent; redirects safe; protected sessions function on intended domain.

**API coverage:** Header/redirect/TLS checks on staging/production read-only endpoints.

**Playwright coverage:** PW public smoke and no mixed-content console errors.

#### OPS-003 — Reviewed deployment and migration order

**Priority:** P0

**Preconditions:** F0; reviewed build and migration artifact; prior-version fixture.

**Steps:**

1. Deploy staged migration/code order.
2. Simulate application rollback.
3. Run old/new clients during rollout.

**Expected Result:** No schema incompatibility/data exposure; correct build SHA recorded; reviewed-code gate; reversible code rollback or documented forward recovery for irreversible migration.

**API coverage:** Migration compatibility/build CI checks and runbook rehearsal.

**Playwright coverage:** PW critical smoke on upgraded fixture.

#### OPS-004 — Scheduled jobs authorization and bounded execution

**Priority:** P0

**Preconditions:** F0; expiry/cleanup/retention/delivery jobs with credentials, batch size and timeout.

**Steps:**

1. Invoke correctly/incorrectly.
2. Overlap runs.
3. Exceed timeout.
4. Retry from checkpoint.

**Expected Result:** Authenticated least-privilege operation; bounded pages/leases, no concurrent duplicate work; incomplete batch stays recoverable; next schedule catches up.

**API coverage:** Job access/idempotency/checkpoint integration.

**Playwright coverage:** PW API only; no browser-driven scheduler required.

#### OPS-005 — Monitoring, health and redaction

**Priority:** P1

**Preconditions:** F0; error/uptime/DB/provider log integrations pointed to test sinks.

**Steps:**

1. Trigger auth/SMS/email/upload/server/query failures.
2. Check health and correlated alert.

**Expected Result:** Actionable metric/alert with request/event correlation; liveness/readiness meaningful; public health leaks no secrets/topology/private counts; alerts deduplicated.

**API coverage:** Telemetry contract and safe health endpoint.

**Playwright coverage:** PW API health/error responses; browser errors correlated without PII.

#### OPS-006 — Backup/restore evidence and retention runbook

**Priority:** P0

**Preconditions:** F0; GAP-19/20 approved targets and REC-006 results.

**Steps:**

1. Review latest backup age.
2. Rehearse restore/access.
3. Simulate missing object backup and missed backup alert.

**Expected Result:** DB and Storage backup scope explicit; measured RPO/RTO met; missing coverage blocks release; recovery owners/commands documented and credentials protected.

**API coverage:** Backup metadata/checksum/restore validation and alert tests.

**Playwright coverage:** PW restored-environment smoke; no destructive production test.

#### OPS-007 — Test harness isolation and artifact handling

**Priority:** P0

**Preconditions:** F0; CI workers, fixtures and auth storage files.

**Steps:**

1. Run tests in parallel twice.
2. Interrupt cleanup.
3. Inspect retained traces/screenshots/reports.
4. Point destructive test config at production hostname.

**Expected Result:** Run-scoped data prevents collisions; cleanup idempotent; production target hard-blocked; auth files/secrets/docs not committed or publicly attached; redacted evidence usable.

**API coverage:** Fixture/environment guard and cleanup tests.

**Playwright coverage:** PW worker isolation and deliberate failed-test artifact review.

#### OPS-008 — Production-safe smoke and rollback trigger

**Priority:** P0

**Preconditions:** F0; deployed reviewed build; approved smoke policy and test accounts.

**Steps:**

1. Check home/search/detail/images/robots/sitemap/mobile.
2. Exercise login only with allowlisted test number.
3. Inspect monitoring and release gates.

**Expected Result:** Read-only production checks safe; staging owns destructive posting/review tests unless explicitly authorized isolated production fixture; regressions trigger documented rollback/incident path.

**API coverage:** Public health/read contracts and deploy/build verification.

**Playwright coverage:** PW @production-readonly; staging @smoke covers full mutation loop.

#### OPS-009 — Staging credentials, provider templates and operational readiness

**Priority:** P1

**Preconditions:** F0; staging configuration and approved production template/sender/domain inventory.

**Steps:**

1. Validate configured MSG91 template/sender and Brevo sender/template/domain using official provider responses.
2. Send only allowlisted smoke.
3. Verify callback reachability and alerting.

**Expected Result:** Configured accounts/templates are ready; no assumption delivery is guaranteed from API acceptance; failures block affected launch flow; real recipient send remains outside routine tests.

**API coverage:** Provider contract and separately tagged staging smoke with redacted IDs/results.

**Playwright coverage:** PW: AUTH-001 and accepted enquiry path tied to provider smoke evidence.

#### OPS-010 — Mumbai deployment region and adjacent database

**Priority:** P0

**Preconditions:** F0; Vercel project configured for bom1; existing Supabase region inventoried.

**Steps:**

1. Validate vercel.json regions and per-route overrides.
2. Deploy authorized staging build.
3. Inspect function execution metadata.
4. Measure actual DB/Tigris latency.

**Expected Result:** Application server compute executes in Mumbai as requested; recommend Supabase ap-south-1 for new project, do not migrate existing data silently; CDN/Tigris residency remains separately documented.

**API coverage:** Deployment config and runtime region/latency checks with safe internal diagnostics.

**Playwright coverage:** PW: staging full smoke plus actual compute evidence; no deploy is claimed from this ZIP.


<a id="e2e-tests"></a>

### E2E — Playwright end-to-end journeys and orchestration

Source coverage: All source feature flows; section 8 execution model.

#### E2E-001 — Guest discovery→login gate

**Priority:** P0

**Preconditions:** F0; guest, eligible Madikeri coffee-estate fixture and hidden control.

**Steps:**

1. Open home.
2. Search location/type/budget.
3. Apply filters/sort.
4. Paginate.
5. Open detail/gallery.
6. Click Contact Owner.
7. Cancel.
8. Try hidden direct URL.

**Expected Result:** Correct URL/results/metadata; public content usable; gate returns safely; no hidden listing leakage.

**API coverage:** Assert public read requests/DTO; guest enquiry denied; covers HOME/SEARCH/PAGE/DETAIL/AUTH.

**Playwright coverage:** PW @smoke guest.spec.ts; Chromium and mobile WebKit projects.

#### E2E-002 — Buyer login→save→enquire→logout

**Priority:** P0

**Preconditions:** F0; controlled OTP, buyer and active seller.

**Steps:**

1. Authenticate.
2. Search/save.
3. Open Saved.
4. Contact with message.
5. Inspect My Enquiries and seller inbox.
6. Remove save.
7. Logout/back.

**Expected Result:** One favorite/enquiry event; correct participant views; safe logout; all durable state confirmed through independent fixture client.

**API coverage:** AUTH/SAVE/ENQ/RLS contracts and fake notification sink.

**Playwright coverage:** PW @smoke buyer.spec.ts with separate seller context.

#### E2E-003 — Seller ten-step draft→resume→submit

**Priority:** P0

**Preconditions:** F0; owner and valid upload fixtures; required fields policy fixed.

**Steps:**

1. Complete steps through preview.
2. Save draft.
3. Reload/new context.
4. Resume/edit.
5. Finalize uploads.
6. Submit twice rapidly.

**Expected Result:** Exact durable data, one submitted revision/intent; no public listing yet; submitted content locked.

**API coverage:** PROP/MEDIA/DOC/LIFE; verify DB plus Storage state.

**Playwright coverage:** PW @smoke seller.spec.ts desktop and mobile parameterized.

#### E2E-004 — Admin request changes→seller resubmit→approve→buyer contact

**Priority:** P0

**Preconditions:** F0; submitted seller listing and admin/buyer contexts.

**Steps:**

1. Admin starts review/reads docs/requests changes.
2. Seller corrects and resubmits.
3. Admin approves new version.
4. Fresh guest finds it.
5. Buyer enquires.

**Expected Result:** Complete business loop and exact revision; audit/review/event counts correct; privacy and publication/cache changes proven.

**API coverage:** ADMIN/PROP/LIFE/CACHE/ENQ/MAIL; real DB/RLS, provider fake only.

**Playwright coverage:** PW @smoke lifecycle.spec.ts independent seeded journey, no reliance on another test.

#### E2E-005 — Reject→hidden listing and seller feedback

**Priority:** P0

**Preconditions:** F0; submitted listing; admin/seller/guest.

**Steps:**

1. Start review.
2. Reject with reason.
3. Seller views feedback.
4. Guest requests slug/search/sitemap.
5. Admin tries invalid approval shortcut.

**Expected Result:** Rejected stays private; safe feedback; invalid transition rejected; correct notification intent.

**API coverage:** ADMIN/LIFE/SEO/MAIL assertions.

**Playwright coverage:** PW rejection.spec.ts.

#### E2E-006 — Sold/expired/unpublished→saved and enquiry behavior

**Priority:** P0

**Preconditions:** F0; saved eligible listing with prior enquiry and open new enquiry form.

**Steps:**

1. Change each availability state.
2. Refresh public/saved/history.
3. Submit stale contact form.

**Expected Result:** No new forbidden enquiry; correct unavailable/sold policy; retained scoped history and sitemap/cache effects.

**API coverage:** LIFE/ENQ/SAVE/SEO/CACHE; clock adapter for expiry.

**Playwright coverage:** PW availability.spec.ts parameterized state transitions.

#### E2E-007 — Direct URL and request permission matrix

**Priority:** P0

**Preconditions:** F0; guest/buyer/seller/agent/admin/super-admin/suspended accounts.

**Steps:**

1. Navigate all protected route families.
2. Invoke matching mutation/read requests.
3. Swap IDs.
4. Test stale token after demotion.

**Expected Result:** UI, service and RLS outcomes agree with capability matrix; no sensitive flash or effects.

**API coverage:** ROLE/API/RLS direct caller tests, not service-role substitutes.

**Playwright coverage:** PW @security permissions.spec.ts parameterized contexts.

#### E2E-008 — Private document authorized→expired→forbidden

**Priority:** P0

**Preconditions:** F0; private document, owner/reviewer/foreign buyer, configured TTL.

**Steps:**

1. Review as authorized actor.
2. Attempt public/foreign link creation.
3. Expire link.
4. Revoke actor.
5. Request new link.

**Expected Result:** Only intended access; expired URL recovery safe; no new link after revoke; existing-link semantics explicitly respected.

**API coverage:** DOC/RLS/SEC with redacted link evidence.

**Playwright coverage:** PW @security private-documents.spec.ts; controlled time for service and real provider expiry smoke.

#### E2E-009 — Autosave offline→retry→conflicting tab

**Priority:** P0

**Preconditions:** F0; saved draft with two independent owner contexts.

**Steps:**

1. Type quickly.
2. Go offline during save.
3. Reconnect/retry.
4. Save conflicting edit in second context.
5. Reload/resolve.

**Expected Result:** No lost acknowledged edits or silent overwrite; timers/request budget correct; final durable version matches accepted edit.

**API coverage:** PROP-009/010/011 and REC/CONC.

**Playwright coverage:** PW draft-recovery.spec.ts with request barriers.

#### E2E-010 — Upload cancellation, invalid file and quota race

**Priority:** P0

**Preconditions:** F0; own draft near image quota; valid/corrupt files.

**Steps:**

1. Reject corrupt file.
2. Start/cancel valid upload.
3. Retry.
4. Finalize two at quota.
5. Submit only when valid media ready.

**Expected Result:** Actionable errors/progress; quota respected; no duplicate/orphan ready rows or incomplete submission.

**API coverage:** MEDIA/DOC/CONC including object cleanup assertions.

**Playwright coverage:** PW upload-recovery.spec.ts desktop/mobile input.

#### E2E-011 — Search debounce, stale results and browser history

**Priority:** P1

**Preconditions:** F0; request-controlled search datasets A/B.

**Steps:**

1. Type rapidly.
2. Switch filter/sort.
3. Resolve responses out of order.
4. Open result/back.
5. Share URL in fresh context.

**Expected Result:** Latest query only; bounded requests; correct committed URL/results/history; no stale count or cursor.

**API coverage:** SEARCH/PAGE/PERF request budgets and reference IDs.

**Playwright coverage:** PW search-state.spec.ts.

#### E2E-012 — Mobile full buyer and seller journeys

**Priority:** P0

**Preconditions:** F0; 360/390/430px projects, touch and safe-area fixtures.

**Steps:**

1. Use mobile nav/filter Apply/Cancel.
2. Browse gallery/sticky contact.
3. OTP/enquire.
4. Complete seller form with uploads and errors.

**Expected Result:** All primary actions reachable without overlap/overflow; state persists; no hover-only dependence.

**API coverage:** Same real action/DB assertions as desktop, not a separate mocked app.

**Playwright coverage:** PW mobile-primary.spec.ts; real-device keyboard smoke supplements emulation.

#### E2E-013 — Admin tables, offset pagination and virtualization

**Priority:** P1

**Preconditions:** F0; multi-page admin data; virtualization only on approved profiled table.

**Steps:**

1. Search/page at 25/50/100.
2. Select row.
3. Scroll out/in.
4. Resize/expand.
5. Bulk action with one stale row.
6. Inspect results.

**Expected Result:** Bounded server offset query and rendered rows; stable IDs/focus/selection; per-row result accurate; no fetch-all.

**API coverage:** PAGE/ADMIN/PERF bulk IDs/versions and payload budgets.

**Playwright coverage:** PW admin-tables.spec.ts desktop and mobile table scroll.

#### E2E-014 — Agent inventory and onboarding capability

**Priority:** P1

**Preconditions:** F0; buyer onboarding allowed, agent quota fixed.

**Steps:**

1. Become allowed seller/agent through defined flow.
2. Post inventory to boundary.
3. View others known IDs.
4. Attempt admin role injection.

**Expected Result:** Only allowed capability/quota; inventory private; forbidden actions no effect; later agency/subscription UI not exposed.

**API coverage:** ROLE/PROP/RLS; quota row count and roles assertions.

**Playwright coverage:** PW agent.spec.ts.

#### E2E-015 — Profile and notification settings

**Priority:** P1

**Preconditions:** F0; phone-only buyer, verified-email test mechanism, avatar fixture.

**Steps:**

1. Update profile/avatar.
2. Add/change email per policy.
3. Adjust preferences.
4. Trigger optional and mandatory event.
5. Log out/in.

**Expected Result:** Correct durable own values; channel routing respects policy; no foreign/privileged field access; phone identity unchanged without re-verification.

**API coverage:** PROFILE/MAIL/RLS safe projection and fake inbox.

**Playwright coverage:** PW profile-settings.spec.ts.

#### E2E-016 — Locations and guides administrative lifecycle

**Priority:** P1

**Preconditions:** F0; admin/public contexts and hierarchy fixture.

**Steps:**

1. Create/edit location.
2. Publish guide with related properties.
3. Rename slug.
4. Follow old links.
5. Unpublish/deactivate.

**Expected Result:** Public content/metadata/links correct; invalid hierarchy rejected; hidden content removed from discoverability and cache.

**API coverage:** LOC/CMS/SEO/CACHE reference assertions.

**Playwright coverage:** PW content-lifecycle.spec.ts.

#### E2E-017 — Report→moderate and ordinary-user denial

**Priority:** P1

**Preconditions:** F0; report policy implemented; user/admin contexts.

**Steps:**

1. Report listing.
2. Retry duplicate.
3. Inspect own permitted receipt.
4. Admin triages/resolves.
5. User attempts resolve API.

**Expected Result:** One report; private reporter data protected; audited authorized resolution; denied direct mutation.

**API coverage:** REPORT/RLS/API and fake notification if supported.

**Playwright coverage:** PW report-lifecycle.spec.ts.

#### E2E-018 — Super-admin role/settings/audit flow

**Priority:** P0

**Preconditions:** F0; superAdminA/B, admin and ordinary account.

**Steps:**

1. Assign allowed admin role.
2. Change supported setting/flag.
3. Inspect audit.
4. Attempt last-admin lockout.
5. Repeat privileged action as ordinary admin.

**Expected Result:** Exact privilege boundaries, effective config and audits; lockout protection; no secret display.

**API coverage:** ROLE/SETTINGS/ADMIN/RLS.

**Playwright coverage:** PW super-admin.spec.ts; staging only.

#### E2E-019 — Admin analytics and dashboard reconciliation

**Priority:** P1

**Preconditions:** F0; known aggregates across dates/statuses/locations.

**Steps:**

1. Open KPIs and all ECharts types.
2. Switch date range.
3. Compare accessible data.
4. Resize/navigate repeatedly.

**Expected Result:** Scoped exact totals, correct timezone/funnel labels, bounded payload and disposed chart instances; no raw PII.

**API coverage:** DASH/CHART/PERF reference aggregate comparisons.

**Playwright coverage:** PW analytics.spec.ts with visual alternatives and request budget.

#### E2E-020 — Provider/database outage and committed retry

**Priority:** P0

**Preconditions:** F0; fault adapters and durable business data.

**Steps:**

1. Fail SMS login.
2. Recover.
3. Submit enquiry with lost response and failed email.
4. Retry.
5. Restore worker.
6. Verify both dashboards.

**Expected Result:** No OTP bypass; one enquiry/intent; honest pending email state and bounded recovery; no duplicate business mutation.

**API coverage:** AUTH/SMS/ENQ/MAIL/REC/API side-effect assertions.

**Playwright coverage:** PW recovery.spec.ts; server-side provider fake required.

#### E2E-021 — SEO and accessibility regression journey

**Priority:** P1

**Preconditions:** F0; published public graph and all private-state fixtures.

**Steps:**

1. Crawl public HTML without JS.
2. Inspect metadata/sitemap/robots/redirects.
3. Keyboard-run filters/dialog/enquiry.
4. Run axe.

**Expected Result:** Correct crawlable eligible content only; no private indexing/leak; keyboard/focus/errors accessible; no critical axe violations.

**API coverage:** SEO/SEC and response status/metadata assertions.

**Playwright coverage:** PW seo-a11y.spec.ts with separate manual contrast/screen-reader evidence.

#### E2E-022 — Deployment and restored-environment smoke

**Priority:** P0

**Preconditions:** F0; upgraded or restored isolated environment, baseline fixture IDs/checksums.

**Steps:**

1. Run login→search→draft→submit→review→publish→enquiry.
2. Inspect private document, email sink, sitemap and monitoring.

**Expected Result:** Database, Storage, Auth, policies and configured providers operate together; event state not replayed accidentally; actual build/migration versions recorded.

**API coverage:** OPS/REC/DB critical checks.

**Playwright coverage:** PW @smoke release.spec.ts; destructive flow never pointed at production.

#### E2E-023 — Private Tigris upload→review→public image delivery

**Priority:** P0

**Preconditions:** F0; real private Tigris test bucket and Supabase fixtures.

**Steps:**

1. Upload quarantine image/PDF.
2. Finalize.
3. Review document.
4. Approve listing.
5. Fetch public app photo as guest.
6. Deny unsigned bucket/doc fetch.
7. Unpublish.
8. Retry stale links.

**Expected Result:** Private origin throughout; exact reviewed bytes immutable; public listing photo works through approved app route; document and post-revocation access rules hold.

**API coverage:** STOR/MEDIA/DOC/RLS/CACHE integration across real test providers.

**Playwright coverage:** PW tigris-lifecycle.spec.ts; Tigris emulator alone is insufficient provider compatibility evidence.

#### E2E-024 — AI readiness→staging smoke with correct targets

**Priority:** P1

**Preconditions:** F0; real application checkout and configured nonproduction credentials.

**Steps:**

1. Run doctor:ai.
2. Require verified target report.
3. Start app/test services.
4. Run critical Playwright smoke.
5. Change one target and retry.

**Expected Result:** Verified tooling enables uninterrupted correct-environment work; mismatched/expired connection fails clearly; no production write or secret leakage; no account connection claimed without proof.

**API coverage:** CLI/OPS preflight and target-guard integration.

**Playwright coverage:** PW workspace-readiness.spec.ts orchestration plus CLI evidence; credentials absent means BLOCKED, not PASS.


<a id="stor-tests"></a>

### STOR — Private Tigris object storage and cross-service consistency

Source coverage: User-confirmed Tigris change; architecture §§6,9,13–15,37–41; design §16; continue §§24,28.

#### STOR-001 — Every bucket private and anonymous operations denied

**Priority:** P0

**Preconditions:** F0; isolated Tigris media/documents/avatars buckets and staging prefixes.

**Steps:**

1. Inspect bucket/object publicity.
2. Try unsigned GET/HEAD/LIST/PUT/DELETE and known object paths.
3. Attempt public ACL during upload.

**Expected Result:** All buckets/objects remain private; unsigned operations denied without sensitive enumeration; normal app identity has no bucket-public mutation privilege; approved public photo served only via app route.

**API coverage:** Real Tigris configuration/S3 integration with positive server-key control.

**Playwright coverage:** PW API anonymous probes; no service keys in browser.

#### STOR-002 — Signer authorization and object-key derivation

**Priority:** P0

**Preconditions:** F0; owner/reviewer/foreign/suspended users; object metadata in Supabase.

**Steps:**

1. Request upload/download grant with allowed ID.
2. Inject foreign property/key/bucket/method/TTL.
3. Revoke role before retry.

**Expected Result:** Server verifies current Auth/role/ownership/state; key resolved/generated server-side; client cannot choose arbitrary S3 path or permission; grants scoped to one method/object and bounded TTL.

**API coverage:** Application signer/action and metadata RLS tests; denied calls mint zero grants.

**Playwright coverage:** PW: owner upload/reviewer document positive and hostile API calls.

#### STOR-003 — Presigned expiry, method/header binding and clock skew

**Priority:** P0

**Preconditions:** F0; server-set short upload/download TTL and pinned SDK contract.

**Steps:**

1. Use before/at/after expiry.
2. Tamper key/query/method/signed headers.
3. Request client TTL beyond ceiling.
4. Test server clock skew.

**Expected Result:** Only authentic scoped request succeeds; expired/mismatched signature denied; safe refresh reauthorizes; signer cannot extend TTL by untrusted input; errors do not expose credentials.

**API coverage:** Actual Tigris SigV4/presigned request tests; do not assume unsupported S3 conditions.

**Playwright coverage:** PW: expired upload/download recovery; signed tokens redacted.

#### STOR-004 — Replayable upload URL cannot change reviewed bytes

**Priority:** P0

**Preconditions:** F0; presigned PUT to unique quarantine key; immutable final-key design.

**Steps:**

1. Upload valid bytes.
2. Finalize.
3. Reuse still-valid PUT URL with altered bytes.
4. Race overwrite with validation/review.

**Expected Result:** URL is not assumed single-use; final media/doc is stored under a different server-only immutable key/version from validated bytes; replay cannot alter submitted/reviewed content; staged leftovers cleaned.

**API coverage:** Digest/version/final-key integrity and concurrent overwrite tests.

**Playwright coverage:** PW: finalized preview unchanged after hostile staging replay.

#### STOR-005 — Finalize verifies actual bytes and metadata

**Priority:** P0

**Preconditions:** F0; initiated upload session, quotas and real Tigris object.

**Steps:**

1. Lie about size/type/checksum/key in finalize request.
2. Upload zero/oversized/corrupt bytes.
3. Omit upload.
4. Modify source during processing.

**Expected Result:** Server checks actual object and decodes/validates content; declared Content-Type/HEAD alone not proof of safe bytes; quota enforced; no ready row for invalid/missing object; validated output bound to final revision.

**API coverage:** Head/get/process/finalize failure points and atomic DB reference tests.

**Playwright coverage:** PW: progress→processing→ready/error states; no submit until ready.

#### STOR-006 — Browser CORS and origin/method restrictions

**Priority:** P1

**Preconditions:** F0; exact local/staging/production origin allowlist.

**Steps:**

1. Preflight and upload from permitted origin.
2. Try hostile/null origin, wrong method/headers and mobile browser.

**Expected Result:** Required browser uploads/downloads work; unnecessary cross-origin permissions absent; CORS is not authorization; nonbrowser unsigned access still denied.

**API coverage:** Tigris CORS plus app origin/signer tests against configured headers.

**Playwright coverage:** PW: separate-origin contexts and mobile browser upload.

#### STOR-007 — Multipart/retry/abort behavior when enabled

**Priority:** P1

**Preconditions:** F0; multipart explicitly enabled for permitted size or documented N/A.

**Steps:**

1. Upload parts out of order.
2. Duplicate/missing/corrupt part.
3. Expire grant.
4. Abort/retry.
5. Complete twice and interrupt worker.

**Expected Result:** Correct final checksum/order and one ready row; expired/foreign upload IDs rejected; incomplete parts cleaned; no assumption every AWS S3 feature is supported by Tigris.

**API coverage:** Pinned SDK multipart/abort/list-part contract and quota/cleanup checks.

**Playwright coverage:** PW: large permitted upload progress/cancel/retry if product supports multipart.

#### STOR-008 — Private buckets with stable public/SEO media URLs

**Priority:** P0

**Preconditions:** F0; approved photo, draft image and private PDF; controlled app-media route.

**Steps:**

1. Fetch stable app photo URL as guest/crawler.
2. Request draft/doc through it.
3. Change approval or image version.
4. Run image optimizer and cache probes.

**Expected Result:** Approved image/OG remains reachable without login while raw bucket stays private; server resolves allowed media only; no arbitrary-key proxy or expired presigned URL stored in canonical HTML; protected docs bypass public optimizer/cache.

**API coverage:** Media route current eligibility, range/conditional request and cache/purge tests.

**Playwright coverage:** PW: no-JS image/OG, responsive variants and hidden-media denial.

#### STOR-009 — Credentials, least privilege, rotation and environment isolation

**Priority:** P0

**Preconditions:** F0; staging/prod bucket IDs and separately scoped app keys.

**Steps:**

1. Attempt app-key bucket/admin/foreign-environment operations.
2. Inspect client bundle/logs.
3. Rotate/revoke test key and retry configured app.

**Expected Result:** Only intended data operations allowed; keys server-only; environments isolated; rotation handled without leaking or broadening access; presigned revocation semantics measured rather than assumed from Supabase logout.

**API coverage:** Tigris key scope/SDK credential refresh and deployment secret tests.

**Playwright coverage:** PW API safe failure/recovery; no keys in page/request to app client.

#### STOR-010 — Tigris outages and Supabase partial commits

**Priority:** P0

**Preconditions:** F0; independent Tigris and DB faults.

**Steps:**

1. Fail store/read/delete before/after DB commit.
2. Return 403/404/429/5xx/timeout/invalid response.
3. Recover.

**Expected Result:** Typed safe retry; no false ready upload, missing private doc accepted for review or silent deletion; bounded attempts; durable reconciliation restores consistency.

**API coverage:** StorageProvider fault matrix and object/metadata count assertions.

**Playwright coverage:** PW: upload/preview failure and recovery preserving draft.

#### STOR-011 — Retention, restore and object/metadata reconciliation

**Priority:** P0

**Preconditions:** F0; separate Tigris backup/version strategy and Supabase backup.

**Steps:**

1. Back up and restore known objects/metadata.
2. Clean orphan/quarantine versions.
3. Simulate missing bytes and deletion marker/version behavior if enabled.

**Expected Result:** Correct private bytes/checksums/metadata restored; retention meets policy; no accidental public ACL; DB backup not treated as object backup; approved versioning features explicitly tested.

**API coverage:** Cross-provider restore/retention/reconciliation with checksums and least-privilege keys.

**Playwright coverage:** PW restored document/media and lifecycle smoke.

#### STOR-012 — Region, endpoint and actual S3 feature compatibility

**Priority:** P1

**Preconditions:** F0; real Tigris account endpoint/location configuration and chosen pinned SDK.

**Steps:**

1. Verify selected account/buckets/location policy.
2. Exercise every used S3 operation.
3. Test bad endpoint/signing region and inspect latency from Mumbai compute.

**Expected Result:** No implicit AWS feature/residency guarantee; unsupported operation fails clearly; configured endpoint/signing rules correct; Tigris location recorded separately from Vercel bom1 and Supabase ap-south-1.

**API coverage:** Read-only config/contract smoke and regional latency profile.

**Playwright coverage:** PW API diagnostic result sanitized; production-independent staging fixture.


<a id="cli-tests"></a>

### CLI — AI workspace readiness and verified service connections

Source coverage: User CLI/AI execution request; architecture §§37–39; continue §28.

#### CLI-001 — Pinned tools and one-command doctor

**Priority:** P1

**Preconditions:** F0; actual application checkout; project tool/version manifest.

**Steps:**

1. Run proposed npm run doctor:ai.
2. Detect Git, Node/package manager, gh, Supabase, Tigris, Vercel, Playwright and local DB runtime if used.

**Expected Result:** Installed/version/auth/target/read capability separately reported; missing tool fails relevant gate with exact remedy; check does not auto-upgrade globally or claim installed means connected.

**API coverage:** N/A: CLI subprocess contracts and machine-readable sanitized report.

**Playwright coverage:** PW: browser binary/version dry smoke included after dependencies; not an account login.

#### CLI-002 — Git/GitHub target and credentials

**Priority:** P0

**Preconditions:** F0; expected repository owner/name/remote recorded.

**Steps:**

1. Inspect repository root/remotes/status.
2. Run gh auth status and repo view.
3. Compare selected repository and branch.

**Expected Result:** Correct repository/account verified; unrelated repo/remotes never deleted/reinitialized; uncommitted work preserved; auth token not printed; missing/mismatch marked BLOCKED.

**API coverage:** GitHub read-only identity/repository API via CLI.

**Playwright coverage:** N/A: CLI integration; repository guard unit test.

#### CLI-003 — Supabase link, region and database capability

**Priority:** P0

**Preconditions:** F0; expected organization/staging/production project refs.

**Steps:**

1. Run projects list.
2. Compare existing link/config and actual region.
3. Perform allowlisted read/schema/RLS checks using appropriate roles.

**Expected Result:** Correct project/Auth/DB endpoint and capability verified; new-project target Mumbai recommended; no silent relink/create/reset/push; service role not proof user RLS works.

**API coverage:** Read-only CLI/management/database checks and minimal user-token test.

**Playwright coverage:** PW local/staging Auth smoke only after target guard passes.

#### CLI-004 — Tigris identity, buckets and application credentials

**Priority:** P0

**Preconditions:** F0; expected Tigris organization/private buckets; app credentials separately configured.

**Steps:**

1. Run whoami/read known bucket config.
2. Verify private access and endpoint.
3. Check app-key allowed read on synthetic object without printing secrets.

**Expected Result:** CLI identity and app SDK credentials both validated; known correct buckets/private status; blocked key/target explicit; CLI login alone not considered application access.

**API coverage:** Tigris read-only CLI/SDK preflight; staging write probe separately authorized/test-scoped.

**Playwright coverage:** PW: object access smoke through app after target guard.

#### CLI-005 — Vercel link and Mumbai compute

**Priority:** P0

**Preconditions:** F0; expected Vercel team/project and existing .vercel/project.json if linked.

**Steps:**

1. Run vercel whoami.
2. Compare project/team metadata, environment and regions config.
3. Inspect deployed function execution region if a deployment exists.

**Expected Result:** Correct account and exact linked project verified; regions includes bom1 and route overrides agree; static CDN location not confused with compute; no auto-create/link/deploy on mismatch.

**API coverage:** Read-only CLI/project settings and server execution metadata; never infer compute only from CDN request header.

**Playwright coverage:** PW deployed staging smoke only after actual region evidence; absent deployment NOT RUN.

#### CLI-006 — MSG91/Brevo readiness without invented CLIs

**Priority:** P0

**Preconditions:** F0; required credential/template/sender variables present in secret store.

**Steps:**

1. Validate presence without values.
2. Call supported non-sending account/template checks where available.
3. Run fake transport contracts.

**Expected Result:** API integration ready or exact missing permission/template identified; no assumption providers need separate CLI; no real message sent by default; delivery smoke separately allowlisted.

**API coverage:** Official provider APIs/SDK wrappers, timeout/redaction and unavailable-read-check fallback.

**Playwright coverage:** PW login/enquiry with server fakes; real delivery remains separately tagged.

#### CLI-007 — Headless CI, shell compatibility and secret safety

**Priority:** P0

**Preconditions:** F0; local Fish/Bash and headless CI runner with scoped credentials.

**Steps:**

1. Run doctor without interactive terminal.
2. Remove/expire token.
3. Inspect logs/exit status.
4. Test from path with spaces.

**Expected Result:** No hanging login prompt; actionable BLOCKED/MISSING status; portable Node/script runner; no token values/credential files/URLs in report; CI honors same project allowlist.

**API coverage:** Subprocess timeout/error/secret-redaction contract.

**Playwright coverage:** PW CI bootstrap fails clearly rather than launching against wrong baseURL.

#### CLI-008 — Connection state drift and safe continuation

**Priority:** P0

**Preconditions:** F0; previously verified report, changed project/key/region or stale timestamp.

**Steps:**

1. Switch account/remote/environment.
2. Expire proof.
3. Rerun preflight.
4. Attempt critical mutation with mismatched target.

**Expected Result:** Fresh checks required after drift; target mismatch blocks mutation only, local work continues; no false CONNECTED claim; report records timestamp/version/nonsecret target and next action.

**API coverage:** Doctor manifest validation and command target guards.

**Playwright coverage:** PW/test runner production-target guard and valid staging control.

## 7. Optimization implementation contract

These choices implement the user's pagination, debounce, throttle, indexing, virtualization and caching requirements within the confirmed stack, including private Tigris storage. They are initial engineering defaults; change a value only with a recorded reason and updated boundary tests. Business limits such as property price or required document types still require their GAP decisions.

| Area | MVP implementation rule | Verification / failure condition |
|---|---|---|
| Data retrieval | Server Components for initial content; service/repository queries filter, sort, authorize and paginate on the server; fetch minimal DTOs | SEARCH-011, API-009, PERF-003: downloading whole datasets to filter/page locally fails |
| Public pagination | Default page size 24; hard maximum 48 as proposed starting engineering limits. Use stable keyset/cursor for large feeds; approved numbered SEO URLs must work directly without prior cursor history | PAGE suite; bind cursor to sort/filters; no false promise of snapshot behavior during changing data |
| Admin offset | Default 25; options 25/50/100; hard maximum 100. `offset=(page-1)*limit`; stable sort + ID tie-breaker. Initial deep-offset budget 10,000 rows; beyond it require narrower filters or an explicitly implemented cursor path | PAGE-005/006/008: reject expensive unsupported navigation clearly, never silently clamp to wrong page |
| Dashboard lists | Default 25 and maximum 100; select cursor or bounded offset by actual access pattern; no unpaginated fallback | API-009, DASH, ENQ, SAVE, HISTORY |
| Text search debounce | Initial 300 ms trailing delay; composition-aware; explicit Enter/Apply submits latest input once; cancel pending work on Clear/unmount; optionally add a 1,000 ms max-wait for continuous typing only if UX warrants it | SEARCH-008/009 and PERF-004: D−1/D/D+1, stale response, Enter double-send, IME and timer cleanup |
| Draft autosave | Initial 750 ms trailing debounce with 3,000 ms max-wait; flush/await durable state before submission; serialize/version writes; display saving/saved/failed | PROP-009/010/011: no starvation, false saved state, stale overwrite or pending timer after navigation |
| Throttle | Scroll visual updates at most once per animation frame; resize/chart recalculation initially trailing-throttled to 100 ms where useful. Use IntersectionObserver for lazy visibility rather than expensive scroll polling | PERF-004, CHART-005; cleanup listeners/observers, preserve final dimensions. Client throttle is never a security rate limiter |
| Cancellation | Abort obsolete browser requests when possible and ignore stale results by request identity; server timeouts/query budgets still apply | SEARCH-009/API-007: abort cannot be assumed to undo a committed server write |
| Virtualization | Start with paginated native/shadcn tables. Add row virtualization only when a measured heavy page benefits, e.g. mounted-row/render cost produces repeated >50 ms tasks. Never increase API page size to justify virtualization. Stable IDs, modest overscan (initially 5 rows per edge), measured variable heights, accessible row counts and focus retention | PERF-005/006/007: bounded DOM; selection by ID; no recycled-row action bug. Public SEO pages remain server-rendered and paginated |
| Indexed queries | Measure actual plans. Evaluate composite indexes for publication+sort+ID, owner+status, location/type+publication, seller/buyer enquiry time, report status/time and unique dedupe keys. Account for normalized area, RLS predicates and count queries | DB-007/PERF-008: compare representative selective and broad filters; no rule requiring index scans on tiny tables; record write overhead |
| Aggregation | Database/server computes KPI/chart/funnel data with a bounded date range; ECharts receives only small aggregates | CHART/PERF-011: independent reference totals, no client-side full-table counting |
| Public cache | Use the pinned Next.js version's supported server caching API and explicit tags/paths. Initial low-risk TTL 300 s for location directory/guides/home modules, with mutation invalidation; public listing detail only if removal/expiry rules remain enforceable | CACHE-001/002: cache TTL is not permission freshness. Freeze removal SLO; do not accept an unpublished/private listing leaking for the whole TTL |
| Private data | Keep dashboards/admin/enquiries/verification decisions/current permissions out of shared public caches. Request-local deduplication is acceptable when scope is proven; mark sensitive responses appropriately | CACHE-003/API-008/RLS; account switching, RSC/prefetch, revoked role and two-instance checks |
| Redis | **No Redis required for MVP.** Next.js handles eligible public caching; Supabase/PostgreSQL remains authoritative. Use shared atomic DB constraints/transactions/counters for quotas, event claims and idempotency; Supabase Auth/hook controls protect direct OTP calls | CACHE-007/PERF-013/SMS-007. Add Redis only after measured shared-state contention/cache requirements justify it, with persistence/failure/eviction semantics tested |
| Assets | `next/image` sizes/srcset/dimensions; optimized cover/thumbs; lazy below-fold media; priority only for LCP; lazy map and ECharts on relevant routes; selected fonts with stable layout | MEDIA-010/PERF-009/010; no public ECharts payload or giant original images on cards |
| Server capacity | Bounded request bodies/query timeouts/pools; avoid per-request unbounded connection pools; provider timeouts/retries finite | PERF-012/014, API, REC: bursts recover without memory/connection/request storms |

### 7.1 Performance evidence sheet

For each benchmark record commit, schema/index version, dataset size/distribution, role/RLS, deployment region, warm/cold cache, concurrency/ramp/steady duration, device/network profile and median/tail statistics. Compare identical environments. Initial load profile: 100 concurrent virtual users; 70% search, 20% detail, 10% home reads, plus a separate realistic write profile. Use a 2-minute ramp, 5-minute steady sample and 2-minute recovery; test a 10k-listing MVP dataset and a separately labeled 100k-listing scale scenario. Provider delivery calls use fakes during load tests.

Normal database-operation API p95 target is 500 ms and initial release ceiling is 800 ms. Initial unexpected 5xx budget is below 1% with no unexplained integrity/auth failures; exclude intentional fault tests from this measurement and report all errors separately. Set hard JSON page-payload budget initially to 250 KiB excluding image bytes and chart aggregate response to 100 KiB. Set initial gzip first-load route JavaScript budget to 200 KiB for public routes and document any justified exception. These starting budgets must be measured against the chosen Next.js build and realistic content, not asserted without evidence.

Measure query counts independently of page size; record a justified per-operation query ceiling before approving performance. Exact result counts can be costly: choose exact, capped or approximate behavior explicitly, label approximation, and never display a stale approximate total as an exact count. Query/page limits, cancellation, index improvements and payload reduction come before adding infrastructure.

## 8. Playwright implementation blueprint

### 8.1 Test organization and fixture responsibilities

Proposed layout in the application repository:

```text
tests/
  unit/                 # schemas, numeric conversions, state machine, permissions, timers
  integration/
    actions/            # actual internal action/service boundaries
    api/                # HTTP contract, raw body/method/header cases
    database/           # constraints, transactions, migrations, query budgets
    rls/                # real anon/user-token PostgREST/RPC/Storage tests
    providers/          # MSG91/Brevo wrappers, hook authentication, delivery states
    concurrency/        # independent connections and deterministic barriers
    recovery/           # commit ambiguity, cleanup, restore, scheduled jobs
  e2e/
    fixtures.ts         # isolated actors, run-scoped factories, fake inbox, assertions
    auth.setup.ts       # controlled local/staging session bootstrap
    *.spec.ts           # suite files named in the catalog
  performance/          # Lighthouse, load profiles, query/bundle/payload budgets
  contracts/            # bound logical operations, policy values, route and RLS matrices
  evidence/             # generated sanitized reports; not production secrets
```

Required fixture contracts:

| Fixture/helper | Responsibility |
|---|---|
| createUser(role, state, runId) | Create isolated authorized role fixture; return actual Auth identity/session; include second user of same role |
| createProperty(owner, status, overrides) | Seed valid fixtures respecting constraints; deliberately invalid cases use a separate explicit negative-fixture helper |
| createLocation / createArticle / createEnquiry | Create run-scoped relation graph and return authoritative IDs/version values |
| actorContext(actor) | Separate BrowserContext and user-token API client; ordinary actions never use service credentials |
| seed/admin cleanup client | Server-only privileged fixture setup/assertion/cleanup; never passed into page or used as a negative-authorization caller |
| fakeSms / fakeEmail | Capture only synthetic provider payloads and fault responses on the application server side; control external transport, not business logic |
| clock / barrier | Control application timers and exact race boundaries; database/provider clocks require their own integration strategy |
| assertDomainState | Independently inspect durable rows/objects/audits/event intents and assert forbidden side effects are absent |
| cleanup(runId) | Remove only owned test namespace after assertions; preserve failure diagnostics, respect FK order and make cleanup retry-safe |

Every test must be independently seedable; E2E-004 must not depend on E2E-003 having run. Use per-worker users/objects for mutating suites. Authentication state files contain credentials and must be ignored by version control and access-restricted. Never share a mutable seller account across parallel workers unless testing that race deliberately.

### 8.2 Authentication strategy without a production bypass

Use the local Supabase test environment's controlled authentication mechanism or a test-configured SMS hook to complete a genuine Supabase verification/session flow. A small dedicated suite tests OTP end to end; most browser tests can bootstrap a legitimate isolated session through a secure test fixture. Any test helper exists only in local/staging test configuration and must fail closed in production. No universal OTP, publicly reachable seed endpoint or ordinary-user role override is permitted.

Real MSG91/Brevo staging smoke tests are separately tagged, use allowlisted test recipients and have strict volume limits. Normal CI never sends real messages. Phone-only users still need core marketplace acceptance without email.

### 8.3 Assertions, selectors, waiting and mocks

- Name each automated test with its case ID and priority, e.g. `[ENQ-001] authenticated buyer creates one enquiry @p0 @smoke`. Parameter names appear in test titles/reports.
- Prefer `getByRole` and `getByLabel`; use stable `data-testid` only when semantic selection is insufficient. Avoid brittle style selectors, changing text/count positions or recycled row indexes.
- Wait for observable UI/domain/network state. Do not use fixed sleeps to make a race pass. Use controlled clocks for debounce/cooldown units and synchronization barriers for backend concurrency.
- Browser `page.route` can control requests the browser makes; it does **not** intercept Next.js server-to-Supabase, MSG91 or Brevo calls. Use a server-side adapter/test transport for those failures.
- Critical positive E2E uses real application actions and a test Supabase database with actual RLS and isolated private Tigris objects; include real Tigris staging compatibility checks. Mocking the app API to always succeed is a component test, not proof of the complete workflow.
- Assert database rows, object state, reviews, audits and notification intent after critical mutation, not only a toast. On rejected requests assert absence of side effects.
- Visual comparisons use deterministic time/fonts/fixtures and mask only genuinely variable nonessential fields. Never mask errors, private-content leaks, bad statuses or pagination results.
- Capture screenshot/trace/console/network evidence on failure. Redact OTPs, tokens, signed URLs and private document contents. Keep sensitive artifacts access-controlled and time-limited.
- Use retry-at-most-once in CI for infrastructure flakiness, with first-failure evidence retained. A retry-passed test is tracked as flaky; P0 races/authorization failures are not waived as flakes.
- Avoid forced clicks except deliberate disabled-control negative tests; forced clicks can hide overlays/focus/layout defects.

### 8.4 Browser and execution matrix

| Run | Required coverage |
|---|---|
| Pull request | Typecheck, ESLint, unit/state/schema/timer tests, API/action contract, DB/RLS/Storage security, build and Chromium critical E2E; mobile smoke; axe for changed screens |
| Main / staging | Full feature suites; Chromium/Firefox/WebKit critical journeys; full responsive set; SEO crawl; provider contract fakes; migration/upgrade check |
| Nightly / before release | Concurrent workers, fault/recovery scenarios, 10k load profile, cold/warm cache, query/bundle budgets, full visual/axe checks; 100k scenario as scaling evidence |
| Before release | Allowlisted MSG91/Brevo real staging smoke, manual real-device/screen-reader/contrast review, backup/restore drill and release checklist |
| Production smoke | Read-only public availability/SEO/asset checks by default; no destructive user/moderation/retention test |

Viewport widths: 360, 375, 390, 430, 768, 1024, 1280, 1366 and 1440 px. Representative sizes include 375×812, 390×844, 768×1024, 1366×768 and 1440×900; also test short heights, landscape, safe-area and virtual-keyboard conditions. Use Chromium for desktop Chrome, branded Chrome/Edge checks where available, Firefox and WebKit. WebKit/mobile emulation is not real Safari/iOS; record separate real-device evidence for file selection, keyboard, cookies, touch and downloads.

## 9. Requirement-to-test traceability

The tables below enumerate every numbered source section. Suite references mean the full relevant family plus its named parameter instances; they are not a substitute for execution evidence. Implementation gaps from navigation-only or underspecified features are tracked in `continue.md` and the decision register.

### Design source coverage

| Source section | QA coverage |
|---|---|
| §1. Design Goal | [HOME](#home-tests), [DETAIL](#detail-tests), [UI](#ui-tests), [SEO](#seo-tests) |
| §2. Core UI Stack | [UI](#ui-tests), [CHART](#chart-tests), [PERF](#perf-tests), [OPS](#ops-tests), [STOR](#stor-tests) |
| §3. Brand Personality | [UI](#ui-tests), [DETAIL](#detail-tests) |
| §4. Color System | [UI](#ui-tests), [A11Y](#a11y-tests) |
| §5. Typography | [UI](#ui-tests), [A11Y](#a11y-tests) |
| §6. Spacing | [UI](#ui-tests) |
| §7. Border Radius | [UI](#ui-tests) |
| §8. Shadows | [UI](#ui-tests) |
| §9. Navigation | [HOME](#home-tests), [ROLE](#role-tests), [UI](#ui-tests) |
| §10. Homepage Hero | [HOME](#home-tests), [SEARCH](#search-tests) |
| §11. Property Card | [HOME](#home-tests), [SAVE](#save-tests), [MEDIA](#media-tests) |
| §12. Verified Badge | [DETAIL](#detail-tests), [LIFE](#life-tests) |
| §13. Search Results Page | [SEARCH](#search-tests), [PAGE](#page-tests), [SEO](#seo-tests) |
| §14. Filter UX | [SEARCH](#search-tests), [PERF](#perf-tests) |
| §15. Property Detail Page | [DETAIL](#detail-tests), [ENQ](#enq-tests), [REPORT](#report-tests) |
| §16. Image Gallery | [DETAIL](#detail-tests), [MEDIA](#media-tests), [A11Y](#a11y-tests), [STOR](#stor-tests) |
| §17. Post Property Flow | [PROP](#prop-tests), [MEDIA](#media-tests), [DOC](#doc-tests), [CONC](#conc-tests), [STOR](#stor-tests) |
| §18. User Dashboard | [DASH](#dash-tests), [SAVE](#save-tests), [HISTORY](#history-tests), [PROFILE](#profile-tests), [ENQ](#enq-tests) |
| §19. Admin Panel UI | [ADMIN](#admin-tests), [ROLE](#role-tests), [LOC](#loc-tests), [CMS](#cms-tests), [REPORT](#report-tests), [SETTINGS](#settings-tests) |
| §20. Apache ECharts Usage | [CHART](#chart-tests), [PERF](#perf-tests) |
| §21. Forms | [AUTH](#auth-tests), [PROP](#prop-tests), [PROFILE](#profile-tests), [ENQ](#enq-tests), [API](#api-tests), [A11Y](#a11y-tests) |
| §22. Modals and Sheets | [UI](#ui-tests), [A11Y](#a11y-tests), [ADMIN](#admin-tests), [REPORT](#report-tests) |
| §23. Empty States | [UI](#ui-tests), [DASH](#dash-tests), [HOME](#home-tests) |
| §24. Loading States | [UI](#ui-tests), [PERF](#perf-tests) |
| §25. Error States | [REC](#rec-tests), [AUTH](#auth-tests), [LIFE](#life-tests), [MEDIA](#media-tests), [API](#api-tests) |
| §26. Responsive Breakpoints | [UI](#ui-tests), [E2E](#e2e-tests) |
| §27. Accessibility | [A11Y](#a11y-tests) |
| §28. Animation | [UI](#ui-tests), [A11Y](#a11y-tests) |
| §29. SEO UX Requirements | [SEO](#seo-tests), [DETAIL](#detail-tests), [STOR](#stor-tests) |
| §30. Final Design Principle | [HOME](#home-tests), [DETAIL](#detail-tests), [ENQ](#enq-tests) |

### Architecture source coverage

| Source section | QA coverage |
|---|---|
| §1. Architecture Goal | [DB](#db-tests), [ROLE](#role-tests), [SEO](#seo-tests), [PERF](#perf-tests), [OPS](#ops-tests), [STOR](#stor-tests) |
| §2. High-Level Architecture | [API](#api-tests), [SMS](#sms-tests), [MAIL](#mail-tests), [DB](#db-tests), [MEDIA](#media-tests), [OPS](#ops-tests), [STOR](#stor-tests) |
| §3. Recommended Next.js Structure | [API](#api-tests), [PERF](#perf-tests), [OPS](#ops-tests), [CLI](#cli-tests) |
| §4. Rendering Strategy | [SEO](#seo-tests), [DASH](#dash-tests), [PERF](#perf-tests) |
| §5. Server-Side Data Fetching | [API](#api-tests), [PERF](#perf-tests) |
| §6. Database Core Tables | [DB](#db-tests), [RLS](#rls-tests), [PROP](#prop-tests), [ENQ](#enq-tests), [PROFILE](#profile-tests), [CMS](#cms-tests), [LOC](#loc-tests), [STOR](#stor-tests) |
| §7. Roles and Responsibilities | [ROLE](#role-tests), [ADMIN](#admin-tests), [SETTINGS](#settings-tests) |
| §8. Authorization | [ROLE](#role-tests), [API](#api-tests), [RLS](#rls-tests) |
| §9. Row Level Security | [RLS](#rls-tests), [DB](#db-tests), [SEC](#sec-tests), [STOR](#stor-tests) |
| §10. Authentication | [AUTH](#auth-tests), [SMS](#sms-tests) |
| §11. OTP Security | [AUTH](#auth-tests), [SMS](#sms-tests), [SEC](#sec-tests) |
| §12. Brevo Email Layer | [MAIL](#mail-tests) |
| §13. Storage Architecture — Private Tigris | [MEDIA](#media-tests), [DOC](#doc-tests), [PROFILE](#profile-tests), [RLS](#rls-tests), [STOR](#stor-tests) |
| §14. Upload Security | [MEDIA](#media-tests), [DOC](#doc-tests), [SEC](#sec-tests), [STOR](#stor-tests) |
| §15. Image Optimisation | [MEDIA](#media-tests), [PERF](#perf-tests), [STOR](#stor-tests) |
| §16. Pagination | [PAGE](#page-tests), [PERF](#perf-tests) |
| §17. Search | [SEARCH](#search-tests), [DB](#db-tests), [PERF](#perf-tests) |
| §18. Database Indexes | [DB](#db-tests), [PERF](#perf-tests) |
| §19. Caching | [CACHE](#cache-tests) |
| §20. SEO Architecture | [SEO](#seo-tests) |
| §21. Slugs | [LIFE](#life-tests), [LOC](#loc-tests), [CMS](#cms-tests), [SEO](#seo-tests) |
| §22. Sitemap | [SEO](#seo-tests) |
| §23. API Design | [API](#api-tests) |
| §24. Validation | [PROP](#prop-tests), [API](#api-tests), [ROLE](#role-tests), [SEC](#sec-tests) |
| §25. Idempotency | [API](#api-tests), [CONC](#conc-tests), [ENQ](#enq-tests), [MAIL](#mail-tests), [AUTH](#auth-tests) |
| §26. Error Handling | [API](#api-tests), [REC](#rec-tests), [UI](#ui-tests) |
| §27. Logging | [SEC](#sec-tests), [DOC](#doc-tests), [OPS](#ops-tests) |
| §28. Audit Logs | [ADMIN](#admin-tests), [DB](#db-tests), [ROLE](#role-tests) |
| §29. Rate Limiting | [AUTH](#auth-tests), [SMS](#sms-tests), [ENQ](#enq-tests), [REPORT](#report-tests), [SEC](#sec-tests) |
| §30. Property Status State Machine | [LIFE](#life-tests), [PROP](#prop-tests), [ADMIN](#admin-tests), [CONC](#conc-tests) |
| §31. Enquiry Architecture | [ENQ](#enq-tests), [MAIL](#mail-tests), [ROLE](#role-tests) |
| §32. Performance Targets | [PERF](#perf-tests) |
| §33. Query Optimisation | [DB](#db-tests), [PAGE](#page-tests), [SEARCH](#search-tests), [PERF](#perf-tests) |
| §34. Admin Dashboard Analytics | [CHART](#chart-tests), [DASH](#dash-tests) |
| §35. Security Headers | [SEC](#sec-tests) |
| §36. CSRF and Mutation Security | [SEC](#sec-tests), [ROLE](#role-tests), [API](#api-tests) |
| §37. Secret Management | [SEC](#sec-tests), [OPS](#ops-tests), [STOR](#stor-tests), [CLI](#cli-tests) |
| §38. Environment Strategy | [OPS](#ops-tests), [STOR](#stor-tests), [CLI](#cli-tests) |
| §39. Deployment | [OPS](#ops-tests), [DB](#db-tests), [E2E](#e2e-tests), [STOR](#stor-tests), [CLI](#cli-tests) |
| §40. Monitoring | [OPS](#ops-tests), [REC](#rec-tests), [MAIL](#mail-tests), [SMS](#sms-tests) |
| §41. Backup & Recovery | [REC](#rec-tests), [OPS](#ops-tests), [STOR](#stor-tests) |
| §42. Data Retention | [DOC](#doc-tests), [PROFILE](#profile-tests), [ENQ](#enq-tests), [REC](#rec-tests) |
| §43. Scaling Path | [PERF](#perf-tests), [PAGE](#page-tests), [CACHE](#cache-tests) |
| §44. Architecture Principle | [SMS](#sms-tests), [MAIL](#mail-tests), [MEDIA](#media-tests), [DOC](#doc-tests), [DETAIL](#detail-tests), [SEARCH](#search-tests), [API](#api-tests), [STOR](#stor-tests) |

### Original continuation phases and backlog coverage

| Source section | QA coverage |
|---|---|
| §1. Phase 0 — Project Setup | [OPS](#ops-tests), [DB](#db-tests), [UI](#ui-tests), [API](#api-tests), [STOR](#stor-tests), [CLI](#cli-tests) |
| §2. Phase 1 — Design Foundation | [HOME](#home-tests), [UI](#ui-tests), [A11Y](#a11y-tests) |
| §3. Phase 2 — Supabase Setup | [DB](#db-tests), [RLS](#rls-tests) |
| §4. Phase 3 — Authentication | [AUTH](#auth-tests), [SMS](#sms-tests), [ROLE](#role-tests) |
| §5. Phase 4 — Public Marketplace | [HOME](#home-tests), [SEARCH](#search-tests), [PAGE](#page-tests), [DETAIL](#detail-tests), [REPORT](#report-tests) |
| §6. Phase 5 — Seller Listing Flow | [PROP](#prop-tests), [MEDIA](#media-tests), [DOC](#doc-tests), [LIFE](#life-tests), [STOR](#stor-tests) |
| §7. Phase 6 — Storage | [MEDIA](#media-tests), [DOC](#doc-tests), [RLS](#rls-tests), [REC](#rec-tests), [STOR](#stor-tests) |
| §8. Phase 7 — Buyer Dashboard | [DASH](#dash-tests), [SAVE](#save-tests), [HISTORY](#history-tests), [PROFILE](#profile-tests), [ENQ](#enq-tests) |
| §9. Phase 8 — Seller Dashboard | [DASH](#dash-tests), [PROP](#prop-tests), [LIFE](#life-tests), [CHART](#chart-tests) |
| §10. Phase 9 — Admin Panel | [ADMIN](#admin-tests), [ROLE](#role-tests), [LOC](#loc-tests), [CMS](#cms-tests), [REPORT](#report-tests), [SETTINGS](#settings-tests), [CHART](#chart-tests) |
| §11. Phase 10 — Enquiries | [ENQ](#enq-tests), [MAIL](#mail-tests) |
| §12. Phase 11 — Brevo | [MAIL](#mail-tests) |
| §13. Phase 12 — SEO | [SEO](#seo-tests) |
| §14. Phase 13 — Location Landing Pages | [LOC](#loc-tests), [SEO](#seo-tests) |
| §15. Phase 14 — Guides / CMS | [CMS](#cms-tests), [SEO](#seo-tests) |
| §16. Phase 15 — Security Hardening | [RLS](#rls-tests), [SEC](#sec-tests), [ROLE](#role-tests), [DOC](#doc-tests), [STOR](#stor-tests) |
| §17. Phase 16 — Testing | [E2E](#e2e-tests), [API](#api-tests), [DB](#db-tests), [RLS](#rls-tests), [UI](#ui-tests), [SEO](#seo-tests), [A11Y](#a11y-tests), [OPS](#ops-tests), [STOR](#stor-tests), [CLI](#cli-tests) |
| §18. Phase 17 — Performance | [PERF](#perf-tests), [PAGE](#page-tests), [CACHE](#cache-tests), [CHART](#chart-tests) |
| §19. Phase 18 — Production Readiness | [OPS](#ops-tests), [REC](#rec-tests), [HOME](#home-tests), [SEC](#sec-tests), [STOR](#stor-tests), [CLI](#cli-tests) |
| §20. MVP Definition of Done | [E2E](#e2e-tests), [AUTH](#auth-tests), [PROP](#prop-tests), [ADMIN](#admin-tests), [ENQ](#enq-tests), [DOC](#doc-tests), [RLS](#rls-tests), [PAGE](#page-tests), [SEO](#seo-tests), [MAIL](#mail-tests) |
| §21. Post-MVP Backlog | [SETTINGS](#settings-tests), [AUTH](#auth-tests), [ROLE](#role-tests), [ENQ](#enq-tests), [SEC](#sec-tests) |
| §22. Recommended Build Order | [E2E](#e2e-tests), [OPS](#ops-tests), [DB](#db-tests), [RLS](#rls-tests) |

### Original test checklist preservation

| Source section | QA coverage |
|---|---|
| §1. Testing Goal | [E2E](#e2e-tests), [API](#api-tests), [RLS](#rls-tests), [SEC](#sec-tests) |
| §2. Test Stack | [OPS](#ops-tests), [E2E](#e2e-tests) |
| §3. Test Environments | [OPS](#ops-tests) |
| §4. Unit Tests | [LIFE](#life-tests), [PROP](#prop-tests), [ROLE](#role-tests), [DB](#db-tests) |
| §5. Authentication Tests | [AUTH](#auth-tests) |
| §6. MSG91 Tests | [SMS](#sms-tests) |
| §7. Brevo Tests | [MAIL](#mail-tests) |
| §8. Property Creation API Tests | [PROP](#prop-tests) |
| §9. Property Update Tests | [PROP](#prop-tests), [CONC](#conc-tests) |
| §10. Property Submission Tests | [PROP](#prop-tests), [LIFE](#life-tests) |
| §11. Admin Verification Tests | [ADMIN](#admin-tests) |
| §12. Listing Visibility Tests | [LIFE](#life-tests) |
| §13. Search API Tests | [SEARCH](#search-tests) |
| §14. Search Edge Cases | [SEARCH](#search-tests) |
| §15. Pagination Tests | [PAGE](#page-tests) |
| §16. Favorites Tests | [SAVE](#save-tests) |
| §17. Enquiry Tests | [ENQ](#enq-tests) |
| §18. Document Upload Tests | [DOC](#doc-tests), [MEDIA](#media-tests) |
| §19. Property Image Tests | [MEDIA](#media-tests) |
| §20. RLS Tests | [RLS](#rls-tests) |
| §21. Security Tests | [SEC](#sec-tests) |
| §22. Playwright E2E — Guest Flow | [E2E](#e2e-tests) |
| §23. Playwright E2E — Buyer Flow | [E2E](#e2e-tests) |
| §24. Playwright E2E — Seller Flow | [E2E](#e2e-tests) |
| §25. Playwright E2E — Admin Flow | [E2E](#e2e-tests) |
| §26. Playwright E2E — Responsive | [UI](#ui-tests), [E2E](#e2e-tests) |
| §27. Accessibility Tests | [A11Y](#a11y-tests) |
| §28. SEO Tests | [SEO](#seo-tests) |
| §29. Sitemap Tests | [SEO](#seo-tests) |
| §30. Performance Tests | [PERF](#perf-tests) |
| §31. API Performance | [PERF](#perf-tests) |
| §32. Race Conditions | [CONC](#conc-tests) |
| §33. Data Consistency | [DB](#db-tests), [LIFE](#life-tests), [REC](#rec-tests) |
| §34. Error UX Tests | [REC](#rec-tests) |
| §35. Browser Coverage | [UI](#ui-tests) |
| §36. Test Data | [OPS](#ops-tests) |
| §37. CI Test Pipeline | [OPS](#ops-tests) |
| §38. Release Smoke Checklist | [OPS](#ops-tests), [E2E](#e2e-tests) |
| §39. Highest Priority Test Areas | [E2E](#e2e-tests), [RLS](#rls-tests), [SEC](#sec-tests) |

### 9.1 End-to-end product flow coverage

| Product flow | Primary journey | Alternate / negative / edge families |
|---|---|---|
| Guest discovery and contact gate | E2E-001 | SEARCH, PAGE, DETAIL, AUTH-007, SEO, UI |
| Buyer authentication, save and enquiry | E2E-002 | AUTH, SAVE, HISTORY, ENQ, RLS, MAIL, REC |
| Seller/agent posting and draft recovery | E2E-003, E2E-014 | PROP, MEDIA, DOC, ROLE, CONC, REC |
| Review, corrections and publication | E2E-004 | ADMIN, LIFE, DOC, CACHE, RLS, MAIL |
| Rejection and lifecycle availability | E2E-005, E2E-006 | LIFE, ENQ, SAVE, SEO, CONC |
| Profile, settings and role administration | E2E-015, E2E-018 | PROFILE, ROLE, SETTINGS, ADMIN, SEC |
| Locations, guides and reports | E2E-016, E2E-017 | LOC, CMS, REPORT, SEO, CACHE |
| Dashboard/admin data and optimization | E2E-013, E2E-019 | DASH, CHART, PAGE, PERF, CACHE, A11Y |
| Failure, privacy and release recovery | E2E-007/008/009/010/020/022 | API, DB, RLS, SEC, CONC, REC, OPS |
| Search state, responsive and accessibility | E2E-011/012/021 | SEARCH, UI, A11Y, SEO, PERF |

### 9.2 Post-MVP exclusions and future test obligations

The source explicitly defers WhatsApp enquiry, paid featured listings, agent subscriptions, developer/agency profiles and team members, saved searches/property alerts, map-based search, comparison, AI search/description, valuation, lead-assignment CRM, native app, virtual tours/drone gallery, payment/billing/subscription management, and optional Google/email magic-link login. Current acceptance verifies these cannot be reached accidentally via hidden endpoints, flags or broken UI (AUTH-015, ROLE-007, SETTINGS-003, ENQ-010, SEC-012).

When a deferred feature is approved, add schema/RLS/API/role/state/boundary/failure/concurrency/E2E cases before enabling it. Payments need duplicate-webhook/payment/refund/reconciliation coverage; subscriptions need entitlement and expiry races; teams need tenant isolation; saved alerts need opt-out/delivery dedupe; AI needs unsafe output/privacy/cost-limit tests; native/map/virtual-tour features need their own device/media/performance contracts. These are future obligations, not evidence of implemented MVP features.

## 10. Release gates, evidence and maintenance

Release is blocked by any applicable P0 failure, unresolved P0 decision, missing critical integration boundary, untested private-data access path, data-loss race, production bypass or absent recovery plan. This is a full specified-product acceptance blueprint, not just a shortlist of happy-path smoke tests.

Required gates:

1. Close GAP decisions affecting the release; freeze validation, state, permission, API, retention and operational contracts. Any excluded source feature has explicit owner-approved scope status, never a silent omission.
2. Every P0 case and all its named required matrix instances pass against the release build. All implemented feature P1 cases pass or have a documented bounded exception; no exception hides a broken primary flow, serious accessibility issue or privacy failure.
3. Every exposed operation/table/view/RPC/bucket is in the API/RLS inventory with positive and negative controls. No endpoint/table can ship merely because no browser route uses it.
4. The complete property submission→review/correction→approval→public search→buyer enquiry→seller dashboard loop passes with real application and test Supabase boundaries. Provider fakes and real staging smoke evidence are clearly distinguished.
5. Concurrency and fault tests prove safe retry after uncertain commits, exact review versions, guarded visibility, upload consistency and no cross-account data. Shared security state works across instances without Redis.
6. Responsive/browser/accessibility/SEO and measurable performance budgets pass for release scope. Cache or virtualization optimization cannot waive correctness, privacy, crawlability or keyboard access.
7. Upgrade, backup/object restore, scheduler recovery, monitoring and secret/configuration gates have evidence. Production smoke is safe and an owner knows the rollback/forward-recovery procedure.
8. Record known limitations, risk owner, mitigation and due date. No test is marked PASS by assumption; blocked numeric/policy cases remain visible.

### 10.1 Execution record template

```text
Case ID + parameters:
Requirement/GAP decision version:
Priority / environment / commit / migration:
Browser/device + viewport (if relevant):
Fixture seed/run namespace:
Preconditions verified:
Actual steps and observed outcome:
Database/object/event/audit checks:
Status: PASS / FAIL / BLOCKED / NOT RUN / APPROVED N/A
Evidence: redacted trace, screenshot, query plan, request ID, report
Defect ID / owner / retest build / accepted limitation:
```

### 10.2 Regression maintenance

Add a named regression case for each production/QA defect. Update the reverse traceability map whenever a source requirement changes. Schema changes must update grants/RLS/object inventory and fixtures in the same change. Preserve existing IDs; append new numbers rather than renumbering references. Coverage counts must distinguish case families from expanded parameter instances and implemented tests from this blueprint. Review all BLOCKED/N/A cases at each release; do not let a temporary gap become permanent silent scope loss.

## 11. Technical reference notes

The product requirements come from the four project files. The following official references were checked on 24 September 2026 for implementation-sensitive test pitfalls; use documentation matching the application's pinned versions.

- [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook): the hook delivers Supabase's OTP through a chosen transport; it does not replace Auth verification.
- [Tigris S3 API compatibility](https://www.tigrisdata.com/docs/api/s3/), [official SDK repository](https://github.com/tigrisdata/storage), [SDK API reference](https://www.tigrisdata.com/docs/sdks/tigris/api/) and [official CLI package](https://www.npmjs.com/package/@tigrisdata/cli): private access and bounded presigned operations are implemented with the selected pinned SDK. Verify used S3 operations, CORS, key scope and revocation behavior against actual Tigris; do not carry over Supabase Storage-specific assumptions.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security), [API security](https://supabase.com/docs/guides/api/securing-your-api) and [database functions](https://supabase.com/docs/guides/database/functions): evaluate row rules, object grants, columns, views and privileged functions separately.
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security), [authentication](https://nextjs.org/docs/app/guides/authentication) and [caching guide](https://nextjs.org/docs/app/guides/caching): select the caching mode supported by the pinned version, protect each server mutation/read boundary, and prevent private DTOs from reaching shared caches/client output. The no-Redis MVP choice is a project engineering decision, not a framework capacity guarantee.
- [Playwright authentication](https://playwright.dev/docs/auth), [fixtures](https://playwright.dev/docs/test-fixtures) and [best practices](https://playwright.dev/docs/best-practices): isolate actors/tests and protect saved session artifacts. Browser emulation and mocked transport results must be labeled accurately.

Provider webhook authentication, retries and MSG91/Brevo account/template details must be bound to the actual configured provider contract; this blueprint deliberately does not invent unsupported signature headers, provider idempotency guarantees or delivery guarantees.

- [Vercel regions](https://vercel.com/docs/regions) and [vercel.json configuration](https://vercel.com/docs/project-configuration/vercel-json): Mumbai function region is `bom1`; configure and verify actual compute independently of CDN edge routing.
- [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Supabase CLI](https://supabase.com/docs/reference/cli), [Vercel CLI](https://vercel.com/docs/cli) and [GitHub CLI authentication](https://cli.github.com/manual/gh_auth_status): use read-only identity/target checks and prove live connections before marking them verified.
