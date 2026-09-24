# continue.md
# Land in Coorg Classified Marketplace — Remaining Work & Execution Checklist

This file is the implementation continuation guide.

Use it after `design.md`, `architecture.md`, and `test.md`.

Updated 24 September 2026: read sections 23–29 (§29 = implementation evidence) for the gap register, optimization tasks, private Tigris storage, AI CLI/API readiness, Mumbai deployment and expanded QA gates. Original implementation tasks remain uncompleted unless actual build/test evidence exists.

---

## 1. Phase 0 — Project Setup

- [ ] Create GitHub repository
- [x] Create Next.js App Router project
- [x] Enable TypeScript strict mode
- [x] Install Tailwind CSS
- [ ] Install shadcn/ui
- [ ] Install Lucide icons
- [ ] Install Apache ECharts
- [ ] Install React Hook Form
- [x] Install Zod
- [x] Install Supabase client/server helpers
- [x] Install Vitest
- [ ] Install Playwright
- [ ] Install axe integration
- [x] Configure ESLint
- [ ] Configure Prettier
- [x] Create `.env.example`
- [ ] Create staging environment
- [ ] Configure correct Vercel project/team and Mumbai function region bom1
- [ ] Implement AI CLI/API readiness preflight from section 28

---

## 2. Phase 1 — Design Foundation

- [ ] Configure color tokens
- [ ] Configure typography
- [ ] Set max widths
- [ ] Create button variants
- [ ] Create input variants
- [ ] Create status badge variants
- [ ] Create property card
- [ ] Create skeleton components
- [ ] Create error state
- [ ] Create empty state
- [ ] Create responsive header
- [ ] Create footer
- [ ] Create mobile navigation
- [ ] Create search component
- [ ] Create filter components

---

## 3. Phase 2 — Supabase Setup

- [x] Create Supabase project
- [x] Configure database
- [x] Create profiles table
- [x] Create roles table
- [x] Create user_roles table
- [x] Create locations table
- [x] Create properties table
- [x] Create property_media table
- [x] Create property_documents table
- [x] Create property_features table
- [x] Create favorites table
- [x] Create enquiries table
- [x] Create recently_viewed table
- [x] Create verification_reviews table
- [x] Create admin_notes table
- [x] Create audit_logs table
- [x] Create notifications table
- [x] Create articles table
- [x] Add indexes
- [x] Enable RLS
- [x] Create RLS policies
- [x] Seed initial roles
- [x] Seed Coorg locations
- [ ] Seed isolated test accounts — live integration tests create run-scoped `@example.test` users; persistent role fixtures pending
- [ ] Complete missing schema/version/event/permission stores from GAP-09 and GAP-22

---

## 4. Phase 3 — Authentication

- [ ] Configure Supabase Auth
- [ ] Build phone login screen
- [ ] Integrate MSG91 — adapter + Send SMS hook implemented and unit-tested; live MSG91 send and Supabase hook registration pending (see §29)
- [x] Add OTP resend cooldown
- [x] Add OTP rate limiting
- [ ] Build OTP verification screen
- [x] Create session handling
- [x] Add protected-route helpers
- [x] Add role helpers
- [x] Add logout
- [x] Add suspended-user handling

---

## 5. Phase 4 — Public Marketplace

### Homepage

- [ ] Hero
- [ ] Main search
- [ ] Popular locations
- [ ] Featured properties
- [ ] Verified properties
- [ ] Property types
- [ ] Recent listings
- [ ] Guides
- [ ] Seller CTA

### Search

- [ ] Search results
- [ ] Location filter
- [ ] Property-type filter
- [ ] Price filter
- [ ] Area filter
- [ ] Seller filter
- [ ] Verification filter
- [ ] Sort
- [ ] Pagination/cursor
- [ ] URL query-state persistence
- [ ] Empty state

### Property Detail

- [ ] Gallery
- [ ] Price
- [ ] Area
- [ ] Location
- [ ] Key features
- [ ] Description
- [ ] Map
- [ ] Seller card
- [ ] Save
- [ ] Contact
- [ ] Similar properties
- [ ] Report listing
- [ ] Legal disclaimer

---

## 6. Phase 5 — Seller Listing Flow

- [ ] Create property stepper
- [ ] Property-type step
- [ ] Location step
- [ ] Details step
- [ ] Price step
- [ ] Features step
- [ ] Photo upload
- [ ] Document upload
- [ ] Seller-information step
- [ ] Preview
- [ ] Save draft
- [ ] Autosave
- [ ] Resume draft
- [ ] Submit for verification
- [ ] Status tracking

---

## 7. Phase 6 — Storage

- [x] Create private Tigris property-media bucket and environment isolation
- [x] Add server-authorized stable application delivery for approved public photos
- [x] Create private Tigris documents and avatars buckets
- [x] Implement scoped presigned quarantine upload, byte validation and immutable finalization
- [ ] Configure Tigris credentials, CORS and separate object restore procedure — scoped staging key and localhost PUT-only CORS done; production origin and restore procedure pending
- [x] Add upload validation
- [x] Add file-size limits
- [x] Add MIME validation
- [x] Generate thumbnails
- [x] Add image optimization
- [x] Authenticated no-store document proxy and explicitly bounded presigned access where required
- [ ] Delete orphaned files
- [ ] Add upload retry UX

---

## 8. Phase 7 — Buyer Dashboard

- [ ] Dashboard overview
- [ ] Saved properties
- [ ] My enquiries
- [ ] Recently viewed
- [ ] Profile
- [ ] Account settings
- [ ] Notification preferences

---

## 9. Phase 8 — Seller Dashboard

- [ ] My properties
- [ ] Listing status
- [ ] Received enquiries
- [ ] Edit draft
- [ ] Edit changes-required property
- [ ] Mark sold
- [ ] Listing analytics
- [ ] Profile

---

## 10. Phase 9 — Admin Panel

### Admin Shell

- [ ] Protected admin layout
- [ ] Sidebar
- [ ] Admin header
- [ ] Role check

### Dashboard

- [ ] Total listings
- [ ] Pending verification
- [ ] Verified listings
- [ ] Rejected listings
- [ ] Active users
- [ ] Enquiries
- [ ] ECharts listing trend
- [ ] ECharts status distribution
- [ ] ECharts location distribution

### Verification

- [ ] Verification queue
- [ ] View property
- [ ] View private documents
- [ ] Approve
- [ ] Reject
- [ ] Request changes
- [ ] Internal notes
- [ ] Audit log

### Property Management

- [ ] Search listings
- [ ] Filter by status
- [ ] Filter by location
- [ ] Feature property
- [ ] Unpublish
- [ ] Archive
- [ ] Mark sold

### User Management

- [ ] Search users
- [ ] View user
- [ ] Suspend
- [ ] Reactivate
- [ ] Change allowed role
- [ ] View listing history

---

## 11. Phase 10 — Enquiries

- [ ] Contact Owner CTA
- [ ] Login gate
- [ ] Enquiry form
- [x] Duplicate protection
- [x] Rate limiting
- [ ] Seller notification
- [ ] Buyer confirmation
- [ ] Enquiry status
- [ ] Seller enquiry dashboard
- [ ] Admin enquiry visibility

---

## 12. Phase 11 — Brevo

- [ ] Configure Brevo
- [ ] Build provider wrapper
- [ ] Welcome template
- [ ] Listing submitted template
- [ ] Listing approved template
- [ ] Listing rejected template
- [ ] Changes required template
- [ ] New enquiry template
- [ ] Expiry template
- [ ] Security notification template
- [ ] Buyer confirmation behavior and phone-only/no-email handling
- [ ] Durable notification intent, deduplication and bounded recovery (GAP-12)
- [ ] Error handling
- [ ] Delivery logging

---

## 13. Phase 12 — SEO

- [ ] Dynamic metadata
- [ ] Canonical URLs
- [ ] Property Open Graph
- [ ] Location Open Graph
- [ ] Breadcrumb schema
- [ ] Property structured data
- [ ] Sitemap
- [ ] Sitemap index if required
- [ ] robots.txt
- [ ] Noindex private pages
- [ ] Internal links
- [ ] Image alt strategy
- [ ] 404 handling
- [ ] Redirect old slugs
- [ ] Search Console setup
- [ ] Google Analytics setup

---

## 14. Phase 13 — Location Landing Pages

Start with:

- [ ] Coorg
- [ ] Madikeri
- [ ] Kushalnagar
- [ ] Virajpet
- [ ] Somwarpet
- [ ] Gonikoppal
- [ ] Suntikoppa
- [ ] Boikere
- [ ] Napoklu

Each should support:

- SEO title
- SEO description
- intro copy
- property results
- nearby locations
- guides
- internal links

---

## 15. Phase 14 — Guides / CMS

- [ ] Articles table
- [ ] Admin article management
- [ ] Draft article
- [ ] Publish article
- [ ] Guide listing
- [ ] Guide detail
- [ ] SEO metadata
- [ ] Author field
- [ ] Updated date
- [ ] Related properties

Initial article ideas:

- [ ] Buying Land in Coorg
- [ ] Documents to Verify Before Buying Land
- [ ] Coffee Estate Investment Guide
- [ ] Best Locations to Buy Land in Coorg
- [ ] Agricultural Land Buying Guide
- [ ] Madikeri Property Guide

---

## 16. Phase 15 — Security Hardening

- [ ] Review RLS
- [ ] Test IDOR
- [ ] Test document access
- [ ] Add rate limits
- [ ] Add security headers
- [ ] Review CSP
- [ ] Verify secrets are server-side
- [ ] Add audit logs
- [ ] Validate uploads
- [ ] Add account suspension handling
- [ ] Review admin permission boundaries
- [ ] Review data retention

---

## 17. Phase 16 — Testing

Follow the complete `test.md` blueprint and its case IDs. Implement and run the API/action, RLS, boundary, race, recovery and Playwright coverage for each feature; section 26 below defines the harness backlog.

Minimum categories before launch (not a substitute for the detailed release gates):

- [ ] unit tests
- [ ] API tests
- [ ] auth E2E
- [ ] buyer E2E
- [ ] seller E2E
- [ ] admin verification E2E
- [ ] RLS tests
- [ ] upload tests
- [ ] responsive tests
- [ ] SEO tests
- [ ] accessibility checks
- [ ] production smoke test

---

## 18. Phase 17 — Performance

- [ ] Lighthouse
- [ ] Web Vitals
- [ ] optimize LCP image
- [ ] optimize listing card images
- [ ] reduce JS bundle
- [ ] check N+1 queries
- [ ] inspect DB query plans
- [ ] add required indexes
- [ ] server-side aggregation
- [ ] server-side filtering/sorting and bounded offset/cursor pagination
- [ ] debounce/throttle/cancellation and autosave flush/version handling
- [ ] measured admin row virtualization with stable IDs and accessible focus
- [ ] shared atomic rate-limit/idempotency guards without requiring Redis
- [ ] caching/tag invalidation
- [ ] lazy load ECharts
- [ ] lazy load map
- [ ] test slow mobile network

---

## 19. Phase 18 — Production Readiness

- [ ] Production domain
- [ ] SSL
- [ ] environment variables
- [ ] Supabase production database/Auth configuration and region verification
- [ ] Tigris private production buckets, scoped keys and object backup
- [ ] Verify Vercel Mumbai bom1 actual function execution region
- [ ] MSG91 production configuration
- [ ] Brevo production configuration
- [ ] backup policy
- [ ] Sentry
- [ ] uptime monitoring
- [ ] analytics
- [ ] Search Console
- [ ] admin accounts
- [ ] moderation policy
- [ ] privacy policy
- [ ] terms
- [ ] property disclaimer
- [ ] contact/support page

---

## 20. MVP Definition of Done

MVP is ready when:

1. Visitor can search verified properties.
2. Visitor can open SEO-friendly property details.
3. User can login using phone OTP.
4. Buyer can save and enquire.
5. Seller can create and submit a listing.
6. Seller can upload photos and private documents.
7. Admin can review property and documents.
8. Admin can approve/reject/request changes.
9. Approved property becomes public.
10. Buyer enquiry reaches seller dashboard.
11. Email notifications work.
12. Private documents are protected.
13. Search is paginated.
14. Site works well on mobile.
15. SEO metadata and sitemap are working.
16. All applicable P0 test families and parameter instances pass, all primary flows work, and the expanded release gates in `test.md` §10 are met with recorded evidence.

---

## 21. Post-MVP Backlog

Do after real usage data exists:

- [ ] WhatsApp enquiry
- [ ] Featured paid listings
- [ ] Agent subscription
- [ ] Developer profiles
- [ ] Saved searches
- [ ] Property alerts
- [ ] Map-based search
- [ ] Compare properties
- [ ] AI property search
- [ ] AI description assistant
- [ ] Property valuation
- [ ] Lead assignment CRM
- [ ] Native app
- [ ] Virtual tours
- [ ] Drone gallery
- [ ] Payment/billing
- [ ] Subscription management

---

## 22. Recommended Build Order

Build exactly in this order:

```text
Foundation
↓
Database + RLS
↓
Authentication
↓
Public Search
↓
Property Details
↓
Seller Listing Flow
↓
Storage
↓
Admin Verification
↓
Buyer Enquiry
↓
Dashboards
↓
Email
↓
SEO
↓
Testing
↓
Performance
↓
Launch
```

Do not start advanced analytics, AI, subscriptions or mobile apps before the complete property submission → verification → publication → enquiry loop works reliably.

---

## 23. QA Expansion and Current Project Status — 24 September 2026

The four files form one specification. The design and architecture preserve product intent and have been synchronized for the user-confirmed private Tigris storage, Vercel Mumbai deployment and AI tooling requirements; this addendum makes remaining acceptance/implementation decisions visible. `test.md` now supplies the detailed test catalog, traceability, boundary/role/state matrices and release gates.

Completed documentation work:

- [x] Read and cross-check all four files together.
- [x] Replace the short QA checklist with a feature-organized blueprint containing 344 case families across 38 suites, including 24 Playwright E2E journeys.
- [x] Add Preconditions, Steps, Expected Result, P0/P1/P2 priority, API/action coverage and Playwright coverage to each catalog case.
- [x] Map every numbered design/architecture/original continuation section to QA suites.
- [x] Identify policy, schema, permissions, recovery and optimization gaps below.

**Implementation/test execution status:** No application repository or running product was included in this ZIP. No implementation checkbox below is completed by writing a test specification. Automated suites, migrations, provider integrations and measured performance still need to be built and run. Documentation coverage is not a test pass report.

### Reading and execution order

1. Read `test.md` sections 1–5 for agreed versus proposed rules, fixtures, roles, state machine and logical API/action inventory.
2. Close the applicable GAP items below before coding behavior with an ambiguous expected outcome.
3. Build the original phases using the same stack; add acceptance tests alongside each feature.
4. Apply section 25 optimization defaults and implement the test harness in section 26.
5. Use `test.md` release gates before launch; retain BLOCKED and NOT RUN status until evidence exists.

Defined stack remains **Next.js App Router, TypeScript, Supabase PostgreSQL/Auth, private Tigris object storage, MSG91, Brevo, shadcn/ui and Apache ECharts**, with the already specified supporting libraries and Vercel. **Redis is not an MVP dependency.** No additional queue/search/auth/cache provider is required by this revision.

## 24. Cross-Specification Gap Register and Implementation Tasks

Each item needs a named owner, decision date and implementation/test evidence. `Product` means the product decision owner; `Engineering` means the implementation owner; `QA` owns test evidence. P0 gaps block affected release-critical flows. P1 gaps block acceptance of their specified features unless scope/exception is explicitly approved. No decision is silently resolved by an illustrative test expectation.

### GAP-01 — Seller editable states and submitted-review lock — P0

Source conflict: architecture §9 mentions own draft/submitted CRUD; the lifecycle and earlier tests restrict edits primarily to draft/changes_required.

- [ ] Product + Engineering: freeze field/action permissions for every lifecycle state. Proposed baseline: editable own draft/changes_required only; submitted/under_review immutable.
- [ ] Define what happens when a verified listing needs a price/photo/document edit. Either implement a separately reviewed revision or deny unsupported edits clearly; do not mutate reviewed content invisibly.
- [ ] Apply the same rule to service actions, database grants/RLS and Storage finalization.
- [ ] QA acceptance: PROP-011/012/013, LIFE-001/002, DOC-005, ADMIN-005, CONC-001.

### GAP-02 — Single publication/availability predicate — P0

- [ ] Product: decide sold historical detail visibility/indexing, expiry, soft deletion, future publication, suspended seller and inactive location effects. Record exact boundary semantics.
- [ ] Engineering: implement one server-owned eligibility predicate used by home/search/detail/similar/location/enquiry/metadata/sitemap and public database projections.
- [ ] Define public removal freshness/SLO and cache strategy. Expired/unpublished/private data must not remain contactable or leak through stale cached detail/RSC/OG responses.
- [ ] QA acceptance: LIFE-003 through LIFE-008, ENQ-003, CACHE-002/003, SEO-005/007/011.

### GAP-03 — Validation constants, enums and units — P0

- [ ] Commit versioned Zod-compatible field requirements and DB constraints for title/description/address/message/reason/profile, supported types/features/seller types/countries and coordinates.
- [ ] Freeze price/area min/max/decimal precision/rounding, accepted units and unit conversion. Define `price_per_unit` as a server-derived value and disallow invalid denominator.
- [ ] Define image/document byte/pixel/count limits and required documents by type; OTP length/expiry/cooldown/attempts; quotas; idempotency/cursor/signing TTLs; text character-versus-byte counting.
- [ ] Generate min−1/min/min+1/max−1/max/max+1 test instances where applicable. Keep unknown business values BLOCKED until chosen; use section 25 defaults for optimization values.
- [ ] QA acceptance: test.md §3.1; AUTH, PROP, MEDIA, DOC, ENQ, API, PAGE.

### GAP-04 — Buyer/seller/agent onboarding and combined capabilities — P0

- [ ] Product: define how a phone-verified buyer becomes an owner/seller/agent, whether those accounts retain buyer capabilities, and any inventory quota difference.
- [ ] Engineering: authorize onboarding server-side; never interpret `seller_type` or editable Auth metadata as admin permission.
- [ ] Define defaults for a newly provisioned/missing profile and make profile creation retry-safe.
- [ ] QA acceptance: AUTH-001/011/012, ROLE-001/002/004/007, PROP-012, E2E-014.

### GAP-05 — Admin/super-admin boundaries and lockout protection — P0

Source conflict: design shows Audit Logs/Settings in the admin navigation, while architecture reserves audit/settings/admin management for super admin.

- [ ] Product: freeze capability matrix including audit read, ordinary user-role changes, privileged account changes, status overrides and inherited super-admin actions.
- [ ] Engineering: role-filter navigation and enforce direct route/action/DB boundaries; prevent self-promotion and unintended final-super-admin removal with atomic checks.
- [ ] Require current authorization after role/suspension changes, not only a cached page/JWT role claim.
- [ ] QA acceptance: ROLE, ADMIN-008/011/012, SETTINGS, RLS-006/008, E2E-018.

### GAP-06 — Reports persistence and moderation — P1

- [ ] Product: define guest/authenticated reporting, reasons, details length, duplicate window, statuses, moderator actions and reporter visibility.
- [ ] Engineering: implement report storage, foreign keys, RLS, indexes, creation/triage actions, admin search/filter/pagination and abuse limits.
- [ ] Add report resolution reasons/audit and handle removed target listings without destroying case history.
- [ ] QA acceptance: REPORT-001 through REPORT-005, E2E-017, RLS-001/002.

### GAP-07 — Profile, account settings and phone-first notifications — P0

- [ ] Product: define required/optional profile fields, email verification and missing-email behavior, notification preferences, mandatory security notices and avatar publicity.
- [ ] Engineering: keep Auth identity and profile phone consistent; support verified phone-change flow if in scope, otherwise explicitly disable it. Do not accept raw profile phone edits as identity proof.
- [ ] Freeze logout scope, refresh-token handling and any requirement for immediate revocation of already issued access tokens. Implement what the UI promises.
- [ ] Add preference/email-verification storage and safe delivery routing. Phone-only accounts must still complete core flows.
- [ ] QA acceptance: PROFILE, AUTH-009/010/013/016/017, MAIL-002/007, ROLE-008.

### GAP-08 — Enquiry lifecycle, duplicates and contact privacy — P0

- [ ] Product: define message requirement, enquiry statuses/actors, repeat-contact window, self-enquiry policy and whether any phone disclosure is allowed.
- [ ] Engineering: derive buyer/seller server-side, check property/actor at commit, add scoped idempotency/uniqueness and atomic rate limits.
- [ ] Build buyer confirmation, seller received view and admin moderation projection; preserve historical enquiries under approved deletion rules.
- [ ] QA acceptance: ENQ-001 through ENQ-012, CONC-002, E2E-002/006/020.

### GAP-09 — Revision/version control and immutable review snapshot — P0

- [ ] Add version or equivalent atomic concurrency token for property edits/reviews and other shared mutable records.
- [ ] Bind submitted revision, document set and review decision; reject stale edits/reviews with a recoverable conflict response.
- [ ] Ensure autosave queue does not overwrite newer data or submit before durable final state.
- [ ] QA acceptance: PROP-009/011, ADMIN-005, DOC-005, DB-005/006, CONC.

### GAP-10 — Private Tigris storage and controlled delivery — P0

- [x] Storage choice confirmed by user: Tigris, with all buckets private. Supabase remains database/Auth/RLS; this is a specification decision, not a live connection.
- [ ] Engineering: keep media/documents/avatars private and verify unsigned raw access fails. Database RLS protects metadata; it does not authorize Tigris bytes.
- [ ] Implement quarantine uploads and immutable finalized keys so reusable presigned PUT URLs cannot alter reviewed bytes. Authorize each grant/finalization/proxy in Next.js.
- [ ] Deliver approved optimized public photos through stable eligibility-checked app media URLs; never switch bucket/object ACL to public or persist expiring signed URLs for SEO.
- [ ] Define app-image removal/cache lifetime and avatar display projection. Use authenticated no-store document proxy; private files cannot pass through a public optimizer/cache.
- [ ] Implement Tigris-specific CORS, key scope, signing expiry, upload validation, retries, location verification, backup and cross-provider reconciliation tests.
- [ ] QA acceptance: STOR, MEDIA-008, DOC-002/003, RLS-009, CACHE-002, E2E-023.

### GAP-11 — Upload finalization, document safety and signed links — P0

- [ ] Define initiate/upload/finalize state and quota reservation; byte/MIME/signature/dimension validation; supported PDF preview/download behavior; dangerous/unsupported file handling.
- [ ] Add cleanup grace period for abandoned uploads, version-safe cover/reorder/delete and reconciliation of stored bytes versus metadata.
- [ ] Set signed document-link TTL and authorized issuance. Document that a previously issued bearer URL can remain valid after logout until expiry; choose an authenticated proxy if immediate revocation is required.
- [ ] Prevent private tokens/content from entering logs/referrers/analytics/shared caches; do not claim to revoke already downloaded copies.
- [ ] QA acceptance: MEDIA, DOC, RLS-009, SEC-006, REC-005.

### GAP-12 — Durable notification intent and bounded recovery — P0

Source gap: architecture defers queue/retry but requires retry-safe email and business operations.

- [ ] Implement durable event/delivery intent, dedupe identity, attempt state and an authorized bounded recovery mechanism using Supabase/PostgreSQL and the current application stack. A separate queue product is unnecessary for MVP.
- [ ] Keep submission/approval/enquiry commit independent from external email success; preserve the intent durably enough to reconcile failures.
- [ ] Define provider timeout-after-acceptance behavior and manual reconciliation. Do not promise exactly-once external delivery without a supported provider guarantee.
- [ ] QA acceptance: ENQ-011, MAIL-004/005/006/008, DB-005, CONC-005, REC-004/008.

### GAP-13 — Complete moderation/lifecycle operation table — P0

- [ ] Freeze reject/resubmit/reopen, mark-sold, unpublish/republish, archive/restore, soft/hard delete, expiry and super-admin override rules, including actor, source/target states and required reasons.
- [ ] Define relationship of `status`, `verification_status`, `published_at`, `expires_at` and `deleted_at`; prevent contradictory public states.
- [ ] Define audit/notification/cache effects per operation and treat unknown state transitions as denied.
- [ ] QA acceptance: LIFE, ADMIN-002 through ADMIN-007, DB-005/006, E2E-004/005/006.

### GAP-14 — Search sorts, cursors, numbered pages and count semantics — P0

- [ ] Define supported sort options and canonical area/unit sorting, null order and stable ID tie-breaker.
- [ ] Bind cursor to filters/sort/version; choose live-keyset versus snapshot semantics; ensure direct `?page=N` SEO routes work without prior navigation.
- [ ] Use bounded server offset for moderate admin data; freeze deep-page policy and exact/approximate count labels; reset cursor/page on committed filter/sort change.
- [ ] QA acceptance: SEARCH, PAGE, API-009, PERF-003/008.

### GAP-15 — Location/CMS/slug-history schema completion — P1

- [ ] Add missing CMS author/updated/SEO fields and location intro/related-link data as required by continuation phases 13–14.
- [ ] Define Coorg hierarchy/descendant search, cycles, reparenting, inactive parent/child behavior and referenced-location deletion.
- [ ] Add unique canonical slug and old-slug history mapping with no loop/hidden-content leak; handle concurrent duplicate titles.
- [ ] Complete all nine location pages and six initial guide topics using approved content.
- [ ] QA acceptance: LOC, CMS, LIFE-007, SEO-003/006, E2E-016.

### GAP-16 — Analytics definitions and all chart families — P1

- [ ] Define current-state versus event counts, viewed/enquired dedupe, repeated reviews, funnel cohort/unit and reporting timezone/date boundaries.
- [ ] Implement server aggregates for status donut, daily/weekly/monthly listing trend, enquiry trend, location bars, type bars and funnel.
- [ ] Reconcile seller numeric analytics and admin KPIs without cross-owner leakage. ECharts remains admin-only as specified in design.md.
- [ ] QA acceptance: DASH-002/004, CHART, PERF-011, E2E-019.

### GAP-17 — Shared abuse controls and provider hook contracts — P0

- [ ] Implement atomic shared counters/quotas using Supabase/PostgreSQL or built-in authoritative Auth controls; no process-memory-only protection across Vercel instances.
- [ ] Cover OTP request/verify/resend, normal/admin login, enquiries, property creation, uploads and reports; configure trusted IP/proxy parsing.
- [ ] Test direct Supabase Auth OTP access so users cannot bypass MSG91 spend limits by skipping Next.js.
- [ ] Bind SMS hook/Brevo/MSG91 callback authentication, body schema, replay/time checks and delivery state to the actual provider-supported mechanism.
- [ ] QA acceptance: AUTH-005/006/016, SMS-002/004/005/007, MAIL-006, SEC-008/013, API-010.

### GAP-18 — SEO index/canonical policy — P1

- [ ] Freeze canonical production host, filtered/numbered search indexing, sold/expired page policy and correct unknown/removed HTTP statuses.
- [ ] Add SSR metadata, OG/Twitter, safe structured data, sitemap/index boundaries, robots and old-slug redirects; exclude all private/unpublished resources.
- [ ] Ensure public listings remain crawlable if client optimization/virtualization is added elsewhere.
- [ ] QA acceptance: SEO-001 through SEO-012, PERF-007, E2E-021.

### GAP-19 — Retention and account/property deletion — P0

- [ ] Product + Engineering: approve retention for rejected documents, inactive/deleted listings, enquiries, notifications, audit logs and backups.
- [ ] Define anonymization/deletion/cascade behavior and preservation of other participants' history; prevent orphan ownership.
- [ ] Implement authenticated, idempotent, bounded retention/cleanup jobs and user confirmation/re-verification where required.
- [ ] QA acceptance: PROFILE-006, ENQ-012, DOC-007, DB-003, REC-005/007, SEC-012.

### GAP-20 — Recovery targets and restore coverage — P0

- [ ] Choose RPO/RTO, backup frequency/retention, owners and alert thresholds.
- [ ] Document database, Auth/config and Storage-byte backup scope; database backup alone must not be assumed to contain files.
- [ ] Rehearse isolated restoration, RLS/ACL checks and suppression of unintended delivery replay; retain measured evidence.
- [ ] QA acceptance: REC-006, OPS-006, E2E-022.

### GAP-21 — Logical operation-to-implementation bindings — P0

- [ ] Bind every test.md §5 operation to actual Route Handler/method or Server Action/service. Do not invent HTTP endpoints solely for tests.
- [ ] Freeze response/error envelope, code/status mapping, request ceilings, partial PATCH semantics, pagination schema, version/idempotency scope and lifetime.
- [ ] Inventory methods, raw-body/webhook handling, origin/CORS and cache/header policy; reject unknown dangerous fields.
- [ ] QA acceptance: API-001 through API-010 and every feature API coverage field.

### GAP-22 — Missing schema objects and complete RLS/grants — P0

- [ ] Inventory/create needed reports, preferences, system settings/flags, revision snapshots, slug history, delivery/event intents, idempotency and shared limiter stores. Final names come from migrations, not this illustrative list.
- [ ] Protect every exposed table/view/RPC/sequence/Storage operation; separate public seller DTO from private profile columns; constrain privileged property columns.
- [ ] Restrict SECURITY DEFINER functions and view access. Test real anon/user tokens rather than service-role credentials for negative RLS assertions.
- [ ] Add CI failure when a new exposed object lacks explicit authorization tests.
- [ ] QA acceptance: RLS-001 through RLS-011, DB, SEC-003/007.

### GAP-23 — Bulk admin actions and selection semantics — P1

- [ ] Define exactly which bulk actions exist, whether selection spans pages, maximum batch size and atomic versus per-row result semantics.
- [ ] Recheck each ID/role/state/version at commit; audit committed items; retry failed items safely.
- [ ] Preserve selection by stable IDs through pagination and virtualization; present partial failures clearly.
- [ ] QA acceptance: ADMIN-009, PAGE-007, CONC-007, PERF-005/006, E2E-013.

### GAP-24 — Notification/security events and observability — P1

- [ ] Add the security-notification template omitted from the original Brevo checklist; define buyer confirmation and delivery event states.
- [ ] Correlate request/user/property/event IDs safely; redact OTP/auth/service keys/private documents/signed URLs across logs, errors, traces and analytics.
- [ ] Add alerts for auth/SMS/email/upload/server/query/backup failures with dedupe, owners and recovery checks.
- [ ] QA acceptance: MAIL, DOC-008, SEC-007/010, REC-008, OPS-005/009.

### GAP-25 — Maps and external-link contract — P1

- [ ] Choose configured MapProvider within the existing abstraction; decide approximate/precise public coordinates and allowed URL/host schemes.
- [ ] Lazy-load interactive map, validate coordinates, and provide usable address/fallback when blocked/offline.
- [ ] Prevent server-fetch/optimizer SSRF and private document proxying through public URLs.
- [ ] QA acceptance: PROP-004, DETAIL-005, SEC-005, PERF-009.

### GAP-26 — Measured optimization and accessibility budgets — P1

- [ ] Apply section 25 and test.md §7 engineering defaults; record pinned Next.js/cache mode and actual supported browser/device matrix.
- [ ] Measure query/payload/bundle/DOM budgets, public Web Vitals, API latency and load before/after each optimization.
- [ ] Add virtualization only for a measured long/heavy admin table benefit; keep server pagination, stable selection and keyboard/screen-reader support.
- [ ] Record numeric budgets/measurement fixtures in CI; do not substitute Lighthouse for real INP or WebKit emulation for actual iOS verification.
- [ ] QA acceptance: PERF, PAGE, CACHE, UI, A11Y, CHART-005/006.

### GAP-27 — Jobs, deployment and migration recovery — P0

- [ ] Define authenticated expiry/cleanup/retention/delivery-recovery scheduling with bounded batches, leases, checkpoints and catch-up behavior.
- [ ] Rehearse reviewed deployment, migration ordering and old/new application compatibility; define rollback versus forward recovery.
- [ ] Keep staging/test recipients/data isolated; fail production startup/build when test bypass configuration is present.
- [ ] QA acceptance: API-010, REC-007, DB-008, OPS-001 through OPS-008, E2E-022.

### GAP-28 — Support/legal content and future-feature isolation — P1

- [ ] Supply approved privacy/terms/disclaimer/support/contact content and working footer destinations; no placeholder/invented legal or contact text.
- [ ] Ensure every source navigation item has an implemented route or explicit approved scope status with appropriate role visibility.
- [ ] Keep all post-MVP items in §21 disabled/absent until separately specified and tested. Preserve admin manual featuring; do not confuse it with future paid featuring.
- [ ] QA acceptance: HOME-005, ADMIN-012, AUTH-015, SETTINGS-003, CMS-006; test.md §9.2.

## 25. Optimization Tasks — Required Engineering Work

Use Next.js server-side caching and Supabase/PostgreSQL initially. Redis can be evaluated later if measurements show cache-sharing/limiter contention or another concrete need; adding it requires a documented purpose, cost/failure model and tests. Current security/correctness must work without it.

- [ ] Implement server-side filtering/sorting/pagination for every list, including users/enquiries/reports/audit/CMS, not just public search.
- [ ] Public default page 24, hard max 48; admin default 25/options 25,50,100/hard max 100; dashboard default 25/max 100. Bind any changed value to the tests.
- [ ] Add stable cursor tie-breakers and filter/sort binding. Support direct numbered SEO pages with an efficient documented strategy.
- [ ] Enforce initial admin deep-offset budget 10,000 rows; require narrowing filters or explicit cursor mode beyond it; never show the wrong page through silent clamping.
- [ ] Search: 300 ms trailing debounce, IME support, explicit submit/clear behavior, stale-response cancellation and request identity checks.
- [ ] Autosave: 750 ms trailing debounce, 3,000 ms max-wait, serialized/versioned writes and durable flush before submit.
- [ ] Throttle scroll visual work to animation frames and expensive resize updates initially to 100 ms; prefer visibility observers; clean timers/listeners on unmount.
- [ ] Profile tables before virtualization. If useful, virtualize only rendered current-page rows with stable IDs, initial 5-row overscan per edge, measured heights, focus/selection retention and accessible alternatives. Do not fetch every row first.
- [ ] Keep public SEO results server-rendered and paginated; avoid virtualizing away indexable listing content.
- [ ] Select minimal card/table DTOs and remove N+1 queries; use server aggregates for KPIs and all ECharts.
- [ ] Inspect query plans under actual RLS roles. Add justified composite/unique indexes and normalized-area query support; measure count cost and write overhead.
- [ ] Cache appropriate public data with explicit keys/tags and an initial 300 s low-risk TTL plus mutations that invalidate all dependents. Establish stricter publication/removal correctness separately.
- [ ] Keep private dashboards/enquiries/admin data and current authorization out of shared public caches. Prove no account-switch/RSC/prefetch leakage.
- [ ] Use atomic shared DB guards for rate limits/quotas/idempotency/worker claims; protect direct Supabase Auth SMS path.
- [ ] Optimize images/fonts; lazy-load maps and admin-only ECharts; maintain small public client bundles and stable layout.
- [ ] Enforce bounded server bodies/timeouts/pools and clean up canceled/failed work safely.
- [ ] Run test.md §7.1 benchmark: 10k listings/100 concurrent readers, cold/warm cache, API p95≤800 ms initial ceiling; record 100k scale scenario separately. Preserve LCP/CLS/INP/Lighthouse targets.
- [ ] Record initial budgets: public first-load gzip JS 200 KiB, paginated JSON 250 KiB, chart aggregate JSON 100 KiB; measure and document any approved adjustment.
- [ ] Before proposing Redis, show current cache-hit ratio, p95/p99, query/lock/connection metrics and failed target; identify exactly what Redis would own and how correctness survives outage/eviction.

## 26. Test Harness and Automation Backlog

- [ ] Implement isolated factories for every role, suspended/expired session, lifecycle state, private/public object and location hierarchy.
- [ ] Implement real local/staging Supabase Auth login fixtures and server-side MSG91/Brevo fakes; forbid public production bypasses.
- [ ] Bind all logical operations and generate role/state/field/pagination matrices with independent parameter-instance reports.
- [ ] Implement direct user-token RLS tests for every table and added object, with positive allowed controls and zero-effect denial assertions.
- [ ] Implement action/HTTP contract and raw header/body/method tests; test malformed responses and uncertain commits.
- [ ] Implement transaction race barriers with independent connections for review/edit, enquiry/availability, quota/finalize and worker claims.
- [ ] Implement all 24 Playwright journeys, with separate actor contexts and independent run-scoped fixtures; critical E2E uses real business/database paths.
- [ ] Implement every feature case's API and browser coverage. Mark backend-only assertions explicitly, not as missing E2E.
- [ ] Add timers/debounce/throttle/stale-response tests; DOM/network/bundle/query/connection performance budgets.
- [ ] Add axe + manual contrast/screen-reader/keyboard review; full responsive widths and real-device upload/OTP/keyboard smoke.
- [ ] Add SSR/no-JS SEO crawl, structured metadata, sitemap boundary and canonical/robots tests.
- [ ] Add provider webhook signature/authentication fixtures matching actual selected integration and separately tagged allowlisted real-provider smoke.
- [ ] Add fail-safe production target guards, per-worker cleanup and redacted trace/screenshot/log artifacts.
- [ ] Add CI stages from test.md §8.4, first-failure evidence, flaky test ownership and case-ID report links.
- [ ] Run and record backup/object restore, scheduler catch-up and migration upgrade/recovery tests.
- [ ] Complete the execution record for every required case/parameter. NOT RUN/BLOCKED must never be converted to PASS by documentation alone.

## 27. Updated Definition of Done and Handover

The original MVP list in §20 remains the product minimum. Release additionally requires the gates in `test.md` §10: all applicable P0 families/instances pass; required P1 flows pass or have bounded recorded exceptions; every exposed API/DB/Storage path is inventoried and tested; no ambiguous critical policy remains; measured responsive/accessibility/SEO/performance and recovery evidence exists.

Handover must contain:

- [ ] Actual build/migration versions, environment and implemented feature scope.
- [ ] Closed GAP register with owner/date/decision links and any explicitly deferred source requirement.
- [ ] Case-ID execution report and defect/retest evidence, distinguishing fake provider tests from real staging smoke.
- [ ] Role/state/API/schema/RLS inventories and limits used by the application.
- [ ] Performance/query/cache/virtualization benchmark results and rationale for any budget change.
- [ ] Backup/restore/deploy/rollback/scheduler/monitoring runbooks and ownership.
- [ ] Known limitations and remaining work with priorities and dates.

Continue building the original complete submission → verification → publication → enquiry loop first. Test database/RLS/auth rules as they are built, rather than postponing all QA until the end. Optimization should improve measured behavior while retaining privacy, clear UX and correctness.

## 28. AI Execution Preflight, Service Connections and Mumbai Deployment

**Current live connection status: UNVERIFIED.** This ZIP is a specification, not an authenticated application checkout. No GitHub repository, Supabase project, Tigris account/bucket, Vercel deployment or provider credential was connected by generating it. The implementing AI must establish the following evidence in the actual project workspace before marking readiness complete. Do useful local work while an external connection is missing; do not fabricate a successful connection.

### Required tools and services

| Tool/service | Purpose | Readiness evidence | Current status |
|---|---|---|---|
| Git + GitHub CLI (`gh`) | Correct source repository and reviewed changes | Repository root/remote match expected owner/name; cleanly understood working state; `gh auth status`; read-only `gh repo view` for intended repo | UNVERIFIED |
| Node + project package manager | Next.js/shadcn/ECharts app and scripts | Version compatible with pinned Next.js; one lockfile/package-manager selection; reproducible install/build | UNVERIFIED |
| Supabase CLI + SDK | PostgreSQL, migrations, Auth and RLS | CLI authenticated, exact linked project ref/organization matches allowlist, database/Auth read checks and actual region recorded | UNVERIFIED |
| Tigris CLI + server SDK | Private object storage | `tigris whoami`, exact account/buckets/endpoint; all buckets private; scoped application credentials separately verified | UNVERIFIED |
| Vercel CLI | Hosting and Mumbai application compute | `vercel whoami` plus actual linked project/team metadata; environment separation; `bom1` config and deployed function evidence | UNVERIFIED |
| MSG91 API | Supabase-issued phone OTP delivery | Server credential/template/sender mapping and configured hook authentication; safe non-sending readiness check where supported; allowlisted staging smoke separately | UNVERIFIED |
| Brevo API | Transactional email | Server credential/sender/templates/event callbacks and verified recipient routing; fake contracts and separate test-mailbox smoke | UNVERIFIED |
| Playwright + browser binaries | E2E and responsive tests | Pinned local binary version, installed browser projects, staging baseURL guard and smoke run | UNVERIFIED |
| Vitest/Testing Library/axe/Lighthouse | Unit, integration, accessibility/performance | Pinned local tools and actual script execution/report | UNVERIFIED |
| Local Supabase/container runtime, if used | Disposable local database/Auth tests | Runtime healthy and isolated local project; never use production as a substitute for missing local services | UNVERIFIED |
| Map provider + monitoring | Defined maps/error/uptime requirements | Selected adapter and restricted credentials, safe failure fallback and diagnostics sink | UNVERIFIED |

MSG91 and Brevo use their supported APIs/SDKs; do not invent mandatory vendor CLIs. shadcn/ui and Apache ECharts are project dependencies, not cloud accounts. An S3 CLI is optional diagnostic tooling; Tigris remains the sole object-storage provider. Redis is not required.

### Implement a single AI readiness command

- [ ] Add a portable Node-based `scripts/doctor-ai.mjs` and package command **`npm run doctor:ai`** (or the chosen package manager equivalent) in the actual repository. This ZIP specifies that script; it does not include an already implemented command.
- [ ] Pin tool/package versions. Prefer project-local CLIs where supported; do not depend on unspecified globally installed `latest` tools. Shell entry points must work from Fish/Bash and paths containing spaces; spawn commands with argument arrays.
- [ ] Check tool availability/version, authentication, exact account/project/bucket/repository target, environment, permission scope and minimal read capability as separate fields.
- [ ] Use read-only diagnostics by default: `git status --short`, `git remote -v` with credential redaction, `gh auth status`, `gh repo view`, `supabase projects list`, `tigris whoami`, known-bucket configuration/read probes and `vercel whoami`. CLI syntax must match the pinned version.
- [ ] Compare existing Supabase link and `.vercel/project.json` to a nonsecret target allowlist. `whoami` proves identity, not correct project selection. Do not silently link/create/switch projects, replace remotes or reinitialize Git on mismatch.
- [ ] Validate application runtime credentials separately from CLI login. A CLI session can work while the deployed SDK key is missing, expired or scoped to another project.
- [ ] Check required environment-variable **presence only**; never dump values, `.env`, access keys, raw session files or signed URLs. Do not paste raw local-service status output if it contains keys.
- [ ] Produce sanitized machine-readable results: tool, version, expected/actual nonsecret target, stage, VERIFIED/MISSING/BLOCKED/NOT RUN, checkedAt, safe reason and next action. Return nonzero for missing required capabilities; never hang on a headless login prompt.
- [ ] Keep optional test writes explicitly scoped to disposable staging prefixes/rows with cleanup; default doctor sends no SMS/email, applies no migration and performs no deployment.
- [ ] Require a fresh report after account/link/credential/environment changes. Test commands enforce allowed staging/local targets independently of the report, so stale proof cannot bypass guards.
- [ ] Implement CLI-001 through CLI-008 and E2E-024. Local QA work may continue while a provider connection is BLOCKED; affected integration/release tests remain blocked visibly.

### Environment and secret contract

Commit `.env.example` containing names and safe comments only. Actual secrets belong in local ignored environment files, CI secrets and the corresponding Vercel environment. Expected categories:

- Public Supabase URL/publishable key; server-only Supabase privileged credential where required; CLI token/database migration credentials scoped separately.
- Server-only Tigris access key ID/secret, endpoint/signing configuration, and media/document/avatar bucket identifiers. Match actual variable names to the selected SDK; no Tigris secret uses `NEXT_PUBLIC_`.
- Server-only MSG91 key/template/sender and hook-verification secret; server-only Brevo key/sender/template IDs and actual callback-authentication configuration.
- Canonical application URL, environment identifier, allowed test targets/origins, supported map key restrictions and monitoring configuration.
- CI/provider connection credentials for GitHub and Vercel, scoped to intended projects; never embed tokens in command-line examples or repository remote URLs.

Use already available authorized credentials; request missing account sign-in through the legitimate platform/CLI flow when needed. Never borrow unrelated project credentials, bypass approval/access controls or put user tokens into this specification.

### Mumbai deployment requirement

- [ ] Configure Vercel Function region **Mumbai `bom1`** and verify route/function-specific overrides do not select another region.
- [ ] Merge the following into the application's existing `vercel.json`, retaining unrelated settings:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["bom1"]
}
```

- [ ] For a new Supabase database project, choose Mumbai **`ap-south-1`** where available. For an existing project, record its actual region and measure latency; changing regions requires a separately planned migration, not silent recreation.
- [ ] Verify Tigris endpoint/bucket location policy separately. Mumbai application compute does not by itself mean Tigris objects or global CDN copies stay in Mumbai/India.
- [ ] Validate actual Vercel function execution region using deployment/runtime evidence after authorized deployment. A CDN request header or successful `vercel whoami` alone is not proof of function placement.
- [ ] Confirm staging versus production environment variables, callback URLs, private bucket targets and database refs before deployment; run OPS-010 and STOR-012.
- [ ] Run staging E2E/region/provider smoke, then the reviewed release process and safe production smoke. No deployment is claimed until a real deployment succeeds and is verified.

Official references: [Tigris SDK](https://github.com/tigrisdata/storage), [Tigris CLI](https://www.npmjs.com/package/@tigrisdata/cli), [Supabase CLI](https://supabase.com/docs/reference/cli), [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Vercel CLI](https://vercel.com/docs/cli), [Vercel region configuration](https://vercel.com/docs/project-configuration/vercel-json), [GitHub CLI auth](https://cli.github.com/manual/gh_auth_status).

## 29. Implementation Status and Evidence — 24 September 2026

Checked items above have automated or live evidence; anything without evidence stays unchecked. Re-run the commands below after every change.

### Evidence

| Area | Evidence | Command |
|---|---|---|
| Schema, RLS, grants, lifecycle, uploads, rate limits | 52 DB tests on real Postgres 18 (PGlite) emulating Supabase roles: full 8×7×4 transition matrix, RLS per actor, exact grant/function allowlists, definer `search_path`, index-backed public plans | `pnpm test:db` |
| Auth helpers, SMS hook, MSG91 adapter, validation | 56 unit tests: phone normalization, safe redirects, signed/tampered/replayed hooks, per-phone limits, provider failure classes, byte sniffing, PDF scan, redaction | `pnpm test` |
| Live Tigris (staging) | 6 tests: private buckets deny unsigned GET/PUT, presigned PUT bound to size/type/key, image pipeline strips EXIF | `pnpm vitest run tests/integration/tigris.test.ts` |
| Live Supabase + Tigris (staging) | 6 tests: trigger-provisioned least-privilege profile, seller onboarding, draft → upload/finalize → submit → review → approve → public, unsafe PDF rejected, enquiry idempotency/self-contact, suspension hides listing | `pnpm vitest run tests/integration/supabase-flow.test.ts` |
| Mutation check | Opening the documents policy or removing the edit lock makes DOC-002 / GAP-01 tests fail | manual, repeat before release |
| Type-check, lint, production build | clean | `pnpm typecheck && pnpm lint && pnpm build` |

### Environment (staging)

- Supabase project `gtwzpyzdfowmfmlxycfl`, region `ap-south-1`, Postgres 17; migrations `20260924000100`–`000400` applied with `supabase db push`. Remote checks: RLS on every public table, anon executes only the 5 allowlisted functions, server-only tables have no client grants, 9 locations seeded.
- Tigris buckets `landincoorg-staging-{media,documents,avatars}`: private, location `sin` (Singapore — nearest single region to Mumbai; user decision), snapshots on, object ACLs off, CORS `http://localhost:3000` PUT + Content-Type only. Access key `landincoorg-staging-app`: ReadWrite on those three buckets only.
- Staging data: integration runs leave soft-deleted listings and suspended `test-*@example.test` users (append-only audit/revision tables prevent hard deletes by design).

### Decisions adopted as PROPOSED baselines (Product sign-off needed)

Taken from test.md §2 so work could proceed; each is one migration or config change away from revision. Full list in `supabase/README.md`.

GAP-01 edit lock, GAP-02 public predicate, GAP-03 enums/limits/submission requirements, GAP-04 seller self-onboarding (agent by admin only), GAP-05 admin/super-admin matrix, GAP-08 enquiry rules, GAP-09 revision snapshots + optimistic versions, GAP-10/11 storage pipeline and document policy (attachment-only, active-content PDFs rejected), GAP-12 durable notification intents, GAP-13 transition table (unpublish/restore/override denied), GAP-17 limiter policies in `app.rate_limit_policies`.

### Still BLOCKED — no values invented

Listing expiry period, seller/agent inventory quotas, report workflow (GAP-06), retention periods (GAP-19), approximate vs precise public coordinates (GAP-25), RPO/RTO (GAP-20).

### Pending before auth works end-to-end

1. Deploy (Vercel `bom1`) so the Send SMS hook has a public HTTPS URL.
2. Supabase dashboard: enable Phone provider; register Send SMS hook → `/api/auth/sms-hook`; put the secret in `SEND_SMS_HOOK_SECRET`; OTP length 6, expiry 300 s.
3. MSG91: auth key + DLT OTP template id; staging `SMS_TEST_ALLOWLIST`.
4. Remove `NEXT_PUBLIC_MSG91_WIDGET_ID` / `NEXT_PUBLIC_MSG91_TOKEN_AUTH`: the widget verifies OTPs itself, which would make MSG91 a second verifier (SMS-001). This design only uses MSG91 for delivery.

### Known limits

- OTP guessing through direct Supabase `/verify` calls is bounded by Supabase's built-in verification limits, not by this app.
- The PDF active-content scan cannot see inside compressed object streams; documents are therefore always served as sandboxed, no-store attachments through the authorized proxy.
- Public photo URLs may stay in shared caches for up to 300 s after a listing is hidden.
