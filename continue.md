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

## 30. Session status — 24 September 2026 (evening) and next steps

### Done this session

- **Tests:** `tests/integration/supabase-flow.test.ts` now signs in through real phone OTP as the staging SELLER/ADMIN/BUYER accounts (email login is disabled). It reactivates them before and after the run, so the QA logins keep working. `pnpm test`: 128 passed.
- **Migrations:** `20260924000500_operations` and `20260924000600_public_read_helpers` are pushed to staging. `pnpm build` passes.
- **Seller UI:**
  - `/dashboard/properties` (list with enquiry counts)
  - `/new` (type picker; non-sellers are sent to profile)
  - `/[id]` (manage page: status, review feedback, history, submit/mark sold/archive/delete draft)
  - `/[id]/edit`: tabbed editor with versioned autosave (750 ms debounce, 3 s max wait, conflict banner, beforeunload), photo and document upload with XHR progress → finalize, cover and reorder, features, and a submit checklist that mirrors `app.property_submission_gaps`
- **Admin panel (`/admin`):**
  - dashboard: KPIs and lazy ECharts from `admin_dashboard_summary` / `admin_trend`
  - verification queue and review page: photos via the preview proxy, documents via the authorized proxy, begin/approve/reject/request changes with owner message and internal notes, feature toggle, internal notes
  - all properties (search and status filter)
  - users: search, suspend/reactivate, grant/remove role, reason required
  - code: `src/repositories/admin.ts`, `src/actions/admin.ts`
- **Ops:**
  - `/api/jobs/notifications`: claims intents → in-app notification; Brevo email only when `BREVO_API_KEY` and a confirmed email exist
  - `/api/jobs/maintenance`: runs `run_maintenance` and deletes expired quarantine objects
  - both require `Authorization: Bearer $CRON_SECRET`
  - `vercel.json`: `bom1` region plus cron schedules
- **Security and SEO:** CSP and security headers in `next.config.ts`; `robots.ts`, `sitemap.ts`, `not-found`, `error`, `global-error`.
- **UI redesign (shadcn only):**
  - Roboto everywhere; warm paper palette with forest green and a clay accent
  - one `wrap` container (1240px) on every page
  - `overflow-y: scroll` so pages never shift sideways
  - Radix scroll-lock padding neutralized
  - `dark:` variant tied to a `.dark` class only; the OS dark mode was greying the inputs
  - Select dropdowns open below the trigger at trigger width
  - hero with contour motif and a joined search bar
  - numbered location index; property-type grid with blurbs; photo-led property cards
  - shared `PageIntro`
  - restyled header, footer, empty states, dashboard and admin
- **Playwright:** `@playwright/test` and `@axe-core/playwright` installed; Chromium downloaded.

### Next steps, in order

1. Screenshot `/admin` again and confirm the page no longer has extra height below the layout (the chart `sr-only` tables are now wrapped in a div).
2. Write `playwright.config.ts` (webServer `pnpm build && pnpm start`) and specs:
   - API: uploads 401/origin, sms-hook 401, documents 404, media 404
   - public pages plus an axe scan
   - journeys: buyer save and enquire; seller create → edit → upload → submit; admin approve → listing public; admin suspend
   - login uses `E2E_*_PHONE` / `E2E_*_OTP`
   - note: the per-number OTP send limit is 60 s, so reuse one storageState per role
3. Run the suite headed (`--headed`, `DISPLAY=:0`).
4. Still to build: admin locations CRUD, articles CRUD, audit-log page (super admin).
5. Real SMS needs all three:
   - a public HTTPS URL for `/api/auth/sms-hook` (Vercel preview or a tunnel)
   - `MSG91_OTP_TEMPLATE_ID` from a DLT-approved template
   - Supabase hook URI updated
   - until then only the `[auth.sms.test_otp]` numbers can log in; real numbers get "Failed to reach hook"
6. Lint: two remaining `react-hooks/set-state-in-effect` errors, in `account-provider.tsx:63` and stock `ui/carousel.tsx`.
7. Before launch:
   - remove `[auth.sms.test_otp]` and run `node scripts/staging-accounts.mjs teardown`
   - set the production CORS origin and `CRON_SECRET`
   - add privacy/terms copy (GAP-28)
   - remove the MSG91 widget env vars

## 31. Status — 25 September 2026

### Verified now

- **Playwright: 40/40 pass, also in headed mode** (`pnpm e2e`, `pnpm e2e:headed`, `DISPLAY=:0`):
  - 29 public/API/accessibility tests: every public page renders and passes an axe WCAG A/AA scan for serious issues; one shared content width; dropdowns don't shift the page and open below the field; security headers; signed-out redirects; unsigned SMS hook and cron endpoints refused; foreign-origin uploads refused; hidden documents/media 404.
  - 11 role tests: seller creates a draft, fills it in, uploads a photo and a document and submits → the submitted listing is locked and not public → admin opens the private document and approves → the listing is public with structured data → buyer saves it and sends one enquiry with a double click → seller sees it and marks it read → buyer cannot reach `/admin` or seller pages → admin suspends the seller (listing gone) and reactivates.
- `pnpm test`: unit, DB and live integration suites green.

### Bugs found and fixed by the browser tests

- The SMS hook returned 500 before checking the signature whenever MSG91 settings were incomplete; unsigned calls now get 401 first, and MSG91 settings are read only at send time.
- `/admin/users` crashed: profiles and user_roles have two foreign keys, so the embed was ambiguous.
- Save and Contact owner sent a signed-in user to login when clicked before the session finished loading; both are now disabled until it is known.
- Contrast and ARIA violations on the home page (light grey text, skeleton `aria-label`, Verified badge `aria-label`); the login page had no `<h1>`.

### Still to do

- Admin: locations CRUD, articles CRUD, audit-log page (super admin), enquiries view.
- Real SMS: ngrok is installed at `~/.local/bin/ngrok`; it needs your authtoken, `ngrok http 3000`, then the hook URI updated, plus `MSG91_OTP_TEMPLATE_ID`.
- Tests not yet written: responsive widths 360/390/430/768/1024, seller edit conflict (two tabs), upload retry UX, RLS negative tests via the browser, Lighthouse and performance budgets.
- Remaining lint errors: `account-provider.tsx:63` and stock `ui/carousel.tsx`.
- Launch checklist unchanged (§30 step 7).

## 32. Admin e2e + full-suite run (2026-09-25)

- Added `e2e/admin.spec.ts` (13 checks incl. setup): admin oversight pages render, audit logs super-admin only, location create/edit/duplicate-slug, article draft not public, buyer/seller 404 on all `/admin/*`. All pass.
- `auth.setup.ts` now also signs in SUPER_ADMIN and AGENT.
- Full run: typecheck clean, unit 122 pass, Playwright 42 pass. Journey spec + Supabase integration test are blocked only by the staging `property_create` limit (10 drafts/day per seller) and OTP cooldown, both consumed by repeated runs. Counters live in `app.rate_limits`; clear them (or wait 24 h) and rerun.
- Pre-launch reminders (rate limits, test OTP, ngrok hook): see remember.md

## 33. UI refresh, guides content, nav fix (2026-09-25)

- **Sticky header bug fixed**: `html { overflow-y: scroll }` made `<body>` the scroll container whenever Radix locked scrolling (any open dropdown), so the header snapped away after scrolling. Replaced with `scrollbar-gutter: stable` (globals.css). Regression test in `e2e/public.spec.ts`.
- **Design refresh** (user request: modern, clean, minimal, less text, one corner radius): white surfaces + neutral lines; every `rounded-lg/xl/2xl/4xl` → `rounded-md` (incl. shadcn ui files); Card uses `border`; no editorial eyebrows/numbering; `PageIntro` has no bottom rule (fixed double lines); header = pill nav + primary "Post a property"; property cards are bordered with a one-line title; locations/types/guides/verification are card grids with icons (`components/property/type-icon.tsx`); filters sit in a card, seller type is a select; footer simplified; login card centred.
- Login: removed the "We never share your number publicly…" note (user request).
- **Guides**: migration `20260925000100_seed_guides.sql` publishes 5 guides (documents, units, coffee estates, conversion, site visit). Renderer supports `## ` heading lines and `- ` bullets. Content is general information with a not-legal-advice note; have it reviewed before launch.
- Journey spec now ends by marking the listing sold and archiving it, so runs no longer leave public test listings. 9 old E2E listings were retired the same way.
- Real SMS: ngrok tunnel → Supabase `auth.hook.send_sms.uri` now points at the ngrok URL (auth config pushed). Delivery still needs `MSG91_OTP_TEMPLATE_ID` (DLT). `storage.analytics.enabled` set false (paid-tier only; broke `config push`).
- Tests: tsc clean, unit 128/128, Playwright 54/54. Lint: 2 known `set-state-in-effect` errors remain (account-provider, stock carousel).

## 34. MSG91 OTP widget login (2026-09-25)

User chose the MSG91 widget (no own DLT template needed). **This changes SMS-001**: for real numbers MSG91 now generates and checks the code; Supabase still owns users and sessions.

- Flow: `startLoginAction` → staging test numbers (`AUTH_TEST_OTP_PHONES`) or widget disabled → Supabase OTP as before; otherwise the browser uses `window.sendOtp/verifyOtp/retryOtp` (widget `exposeMethods`, our shadcn form is the UI; code length and resend time come from widget settings — currently 4 digits / 10 s; invisible captcha handled by the widget).
- `verifyWidgetLoginAction` → `signInWithWidgetToken` (auth.service): rate limits (otp_verify_phone/ip) → MSG91 `verifyAccessToken` with the server-only authkey (HTTP 200 + `type:"error"` means refused) → the phone MSG91 attests (answer `message`, else claims of the MSG91-accepted JWT) **must equal** the typed phone → token single-use via `register_webhook_receipt('msg91_widget', sha256)` → find user via `auth_user_id_by_phone` (unique-index probe, service-role only; migration 20260925000200) or `admin.createUser` → one-time random password → `signInWithPassword` (sets cookies) → password rotated immediately → `ensure_profile`.
- CSP: MSG91 + hCaptcha/reCAPTCHA hosts allowed on `/login` only; MSG91's analytics script (`pass.hostnsoft.com`) stays blocked (no-op `TraceIQ` shim).
- If a real login fails with "incorrect or expired" after a correct code, check the server log for `auth.widget_phone_mismatch` (it records `messageKind` and JWT `claimKeys`, never values) — that means MSG91's answer shape differs from what we read.
- Tests: `src/services/sms/msg91-widget.test.ts` (6), `e2e/login.spec.ts` (stubbed widget: widget path, wrong code, forged token → no session, CSP scope). Supabase half verified on a staging account (lookup, anon denied, one-time password session, rotated password refused).
- Fixed React "Select changing from uncontrolled to controlled" in the listing editor (`value ?? ""`).
- Results: tsc clean, unit 134/134, Playwright 57/57 (also headed).

## 35. Broker model, photo rules, listing page, widget server mode (2026-09-25)

**Business model:** Land in Coorg earns commission as the middleman. Buyers deal only with the platform; owners only with the platform.
- Public never sees seller name (user decision: "don't show"), contact details, exact address or coordinates. Seller *type* (owner/agent/developer) stays visible. Only admins see owner name/phone.
- DB (migrations 20260925000300–0500): anon SELECT on `properties` is a column allowlist (no owner_id/address_text/latitude/longitude…); `get_listing_seller` not executable by clients; enquiries readable by the buyer and admins only; `list_received_enquiries` revoked; `seller_enquiry_counts` = counts only (security definer); `update_enquiry_status` admin-only + audited; `create_enquiry` notifies active admins, not the owner; `app.text_has_contact_details` blocks submission when title/description contain an Indian mobile number or email (`contact_details` gap).
- App: listing page has no seller card/address ("exact address shared when you arrange a site visit"); CTA "Enquire now" (+ Call/WhatsApp when `NEXT_PUBLIC_CONTACT_PHONE` is set); `/dashboard/received` redirects to My properties; owners see "N interested buyers"; `/admin/enquiries` is the work queue with buyer + owner phone links, "Mark as called" / Close.
**Photo rules** (migration 0600 + `src/lib/media/photo-rules.ts`): ≥4 photos, ≥1 portrait and ≥1 landscape (long ÷ short ≥ 1.2), min 1200 × 800 / 800 × 1200. Browser checks type/size/EXIF-rotated dimensions before upload; server re-checks size; editor shows a live checklist and orientation badges.
**Listing page:** title + price header, adaptive gallery (no empty cells for 2–5 photos, portrait-safe), fact tiles, amenities, features, town-level location, sticky enquiry panel.
**Login:** "OTP service could not be reached" = browser blocked MSG91's script (Brave Shields / ad blockers). With widget captcha **off**, login now runs server-side automatically (`msg91-widget-api.ts`: getWidgetProcess → sendOtp/verifyOtp from our server, our per-phone/IP limits apply); with captcha **on**, the browser widget is used.
- Tests: db 63/63, unit+db 132 (integration suite blocked only by the staging seller's `property_create` 10/day limit, reset with `pnpm e2e:reset`), Playwright public/api/a11y/login/admin 48/48. Journey spec needs the reset too.

## 36. Login fixes, fingerprint limit, test run (2026-09-25)

- **Real cause of "Sending code…" hang:** login CSP allowed `*.hcaptcha.com` but the widget loads `https://hcaptcha.com/1/api.js` (apex) → captcha never loaded. Fixed (+ `worker-src 'self' blob:` for hCaptcha's proof-of-work). Widget calls now time out after 45 s with a clear message instead of hanging. hCaptcha warns on `localhost`; the real SMS reached the code screen both on localhost and via the ngrok host (`allowedDevOrigins` set for dev).
- **Token check hardened:** accepts padded/standard-base64 JWTs, finds the attested phone anywhere in MSG91's answer or token claims (depth ≤ 6); every refusal logs its reason, and in development a structure-only record goes to `.scratch/auth-debug.log` (no token/code/full number).
- **Fingerprint limit:** 2 code requests per minute per browser (`otp_request_fingerprint`, migration 0700). Key = sha256(client fingerprint hash + user-agent + accept-language), applied to every send path.
- **SMS-006 for server mode:** outside production our server texts only `SMS_TEST_ALLOWLIST` numbers; others use the browser widget (stubbed in tests), so tests can never text a real stranger.
- OTP boxes are full-width, rounded-md, sized to the widget's code length.
- `E2E_LISTER=agent` lets the journey + integration tests list with the staging agent when the seller's 10 drafts/day are used. Journey now retires its listing in `afterAll` even when a step fails.
- **Results:** tsc clean; unit + db + integration 140/140; Playwright 58/58 (public, api, a11y, login, admin, full journey). Lint: the 2 known `set-state-in-effect` errors only.
- Pending (user): real OTP on 9036215854 as the last test; decide captcha on/off; business phone for `NEXT_PUBLIC_CONTACT_PHONE`.

## 37. Production setup (2026-09-26)
- Vercel project `landincoorg` (Hobby, `bom1`) → https://landincoorg.vercel.app. Production env vars set (production target only; no test vars). `.vercelignore` excludes `.env*`.
- New Supabase production project `land-in-coorg-prod` (`bbgwsiwushzetifyugoi`, ap-south-1). All 13 migrations applied; auth config pushed without `[auth.sms.test_otp]`. Verified: phone auth on, anon cannot read `properties.owner_id` (42501), real rate limits, 5 guides, 9 locations. Staging project is unchanged.
- `scripts/supabase-prod.mjs` runs `db push` / `config push` against production using `.env.production.local` (gitignored).
- Hobby crons are daily only: notification delivery moved to `src/services/notification.service.ts`; `deliverNotificationsSoon()` runs via `after()` after create_enquiry, transition_property and login; `/api/jobs/notifications` is now a daily sweep (bounded 10×50).
- Pending (remember.md): Tigris prod buckets and key, MSG91 captcha off, first `vercel deploy --prod` (run by the user), super_admin grant after first login, real OTP test, contact phone.
- First production deploys: Vercel project preset was "Other" (served `public/` only → 404) — `vercel.json` now pins `framework: nextjs`, pnpm install/build.
- `supabase projects api-keys` masks secret keys unless `--reveal`; the masked key gave "Invalid API key" → DEPENDENCY_FAILED on login. Fixed on Vercel.
- Per-path CSP + client-side navigation: a document keeps the CSP of the page it was loaded on, so reaching /login by an in-app link blocked MSG91's script. The login form no longer preloads the script (server mode needs none) and, in browser-widget mode, reloads /login once if the document was not loaded there. DEPENDENCY_FAILED now has a friendly message.
