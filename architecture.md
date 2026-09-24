# architecture.md
# Land in Coorg Classified Marketplace — Architecture & Engineering Guide

## 1. Architecture Goal

Build a scalable, secure and SEO-friendly real-estate classifieds marketplace using:

- Next.js
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Tigris private object storage (S3-compatible; replaces the earlier object-storage choice)
- MSG91
- Brevo
- Vercel

Architecture principles:

- Server-first rendering.
- Least privilege.
- Secure private property documents.
- Search-engine indexable public listings.
- Strong role boundaries.
- Cursor pagination for large datasets.
- Avoid unnecessary client-side data fetching.
- Keep external providers behind service abstractions.

---

## 2. High-Level Architecture

Client Browser

↓ HTTPS

Next.js App Router

├── Server Components
├── Route Handlers
├── Server Actions
├── Middleware / Auth Guards
└── Background-safe application services

↓

Supabase

├── PostgreSQL
├── Auth
└── PostgreSQL Row Level Security

Tigris Private Object Storage

├── Private property images and thumbnails
├── Private verification documents
└── Private avatar objects

Next.js authorizes all object grants and delivery; database RLS does not protect Tigris bytes.

External Services

├── MSG91 — OTP/SMS
├── Brevo — transactional email
├── Maps provider
├── Analytics
└── Error tracking

---

## 3. Recommended Next.js Structure

```text
src/
  app/
    (public)/
      page.tsx
      properties/
      property/[slug]/
      locations/
      guides/
    (auth)/
      login/
    dashboard/
      layout.tsx
      properties/
      saved/
      enquiries/
      profile/
    admin/
      layout.tsx
      dashboard/
      properties/
      verification/
      users/
      enquiries/
      locations/
      articles/
      audit-logs/
    api/
      auth/
      properties/
      enquiries/
      uploads/
      webhooks/

  components/
    ui/
    property/
    search/
    dashboard/
    admin/
    forms/

  lib/
    supabase/
    auth/
    validation/
    permissions/
    pagination/
    seo/
    cache/
    utils/

  services/
    property.service.ts
    auth.service.ts
    enquiry.service.ts
    notification.service.ts
    verification.service.ts
    analytics.service.ts
    storage.service.ts

  repositories/
    property.repository.ts
    user.repository.ts
    enquiry.repository.ts

  schemas/
    property.schema.ts
    enquiry.schema.ts
    user.schema.ts

  types/
```

---

## 4. Rendering Strategy

### Server Components

Use by default.

Ideal for:

- Homepage
- Search result initial load
- Property detail pages
- Location pages
- Guide pages
- Dashboard initial data
- Admin initial table data

### Client Components

Use only where interaction is required.

Examples:

- filters
- image gallery
- save button
- forms
- charts
- map interaction
- dialogs

Do not make the entire page `use client`.

---

## 5. Server-Side Data Fetching

Prefer server-side Supabase queries.

Benefits:

- smaller browser payload
- reduced exposed logic
- better SEO
- easier authorization
- fewer waterfalls

Recommended:

```text
Page Server Component
    ↓
Service Layer
    ↓
Repository
    ↓
Supabase
```

Avoid:

```text
Page
 ↓
Client component
 ↓
useEffect
 ↓
API
 ↓
Database
```

for initial page content.

---

## 6. Database Core Tables

Recommended:

### profiles

- id
- full_name
- phone
- email
- user_type
- avatar_object_key (Tigris key; resolve approved display through application delivery)
- is_suspended
- created_at
- updated_at

### roles

- id
- name

### user_roles

- user_id
- role_id

### properties

- id
- owner_id
- slug
- title
- description
- property_type
- listing_type
- seller_type
- status
- verification_status
- price
- negotiable
- area_value
- area_unit
- price_per_unit
- location_id
- latitude
- longitude
- address_text
- road_access
- water_available
- electricity_available
- featured
- published_at
- expires_at
- created_at
- updated_at
- deleted_at

### property_media

- id
- property_id
- media_type
- storage_path (canonical Tigris object key, never a persisted presigned URL)
- storage_bucket
- object_version (if supported/used)
- content_checksum
- upload_state
- thumbnail_path
- alt_text
- sort_order
- is_cover
- created_at

### property_documents

- id
- property_id
- document_type
- storage_path (canonical Tigris object key, never a persisted presigned URL)
- storage_bucket
- object_version (if supported/used)
- content_checksum
- upload_state
- verification_status
- admin_comment
- created_at

### property_features

- id
- property_id
- feature_key
- feature_value

### locations

- id
- parent_id
- type
- name
- slug
- seo_title
- seo_description
- is_active

### favorites

- user_id
- property_id
- created_at

Unique:

`(user_id, property_id)`

### enquiries

- id
- property_id
- buyer_id
- seller_id
- message
- status
- created_at

### recently_viewed

- user_id
- property_id
- viewed_at

### verification_reviews

- id
- property_id
- reviewer_id
- decision
- notes
- created_at

### admin_notes

- id
- entity_type
- entity_id
- admin_id
- note
- created_at

### audit_logs

- id
- actor_id
- action
- entity_type
- entity_id
- metadata
- ip_address
- created_at

### notifications

- id
- user_id
- type
- channel
- title
- body
- status
- created_at

### articles

- id
- slug
- title
- excerpt
- body
- status
- published_at

---

## 7. Roles and Responsibilities

### Guest

Can:

- view public verified listings
- search
- filter
- view public guides

Cannot:

- save property
- contact owner
- create listing

### Buyer

Can:

- save property
- submit enquiry
- view own enquiries
- manage own profile

### Seller / Owner

Can:

- create listing
- edit own draft
- submit own listing
- upload media
- upload verification documents
- view received enquiries
- mark own property sold subject to business rule

Cannot:

- approve listing
- change verification status
- access other sellers' data

### Agent

Same as seller, but can manage larger listing inventory.

Optional later:

- agency profile
- team members
- subscription plan

### Admin

Can:

- review properties
- approve/reject/request changes
- manage users
- manage locations
- moderate content
- view enquiries
- view private documents

### Super Admin

Can:

- manage admins
- update system settings
- access audit logs
- override statuses
- manage feature flags

---

## 8. Authorization

Authorization must be enforced in three layers:

1. UI visibility
2. Server/service permission check
3. Supabase RLS

Never rely on UI-only role checks.

---

## 9. Row Level Security

Enable RLS on every public schema table.

Examples:

Public:

- read properties only where `status = 'verified'` and `published_at IS NOT NULL`

Seller:

- CRUD own draft/submitted listings under allowed states

Buyer:

- CRUD own favorites
- create own enquiries
- read own enquiries

Admin:

Prefer server-side service role for privileged operations after explicit application-level authorization.

Never expose service-role key to browser.

RLS here protects PostgreSQL rows and file metadata. Tigris is a separate object store: its private buckets, scoped server-only credentials, application authorization and bounded presigned grants protect file bytes. A Supabase JWT is not a Tigris S3 credential. Test these boundaries independently.

---

## 10. Authentication

Primary:

Phone OTP.

Recommended flow:

User

→ Next.js login

→ Supabase Auth

→ custom SMS hook

→ MSG91

→ OTP

→ verification

→ Supabase session

Secondary optional later:

- Google
- email magic link

Store authorization role separately from identity claims where practical.

---

## 11. OTP Security

Requirements:

- rate limiting
- resend cooldown
- brute-force protection
- OTP expiry
- maximum verification attempts
- IP/device abuse controls
- phone normalization
- country code validation

Never log OTP values.

---

## 12. Brevo Email Layer

Create abstraction:

```ts
interface EmailProvider {
  sendTemplate(...)
}
```

Implementation:

`BrevoEmailProvider`

Email events:

- welcome
- listing submitted
- listing approved
- listing rejected
- changes requested
- new enquiry
- property expiry
- security notification

Queue/retry can be added later.

---

## 13. Storage Architecture — Private Tigris

User-confirmed provider: [Tigris](https://www.tigrisdata.com/). Supabase remains the database/Auth provider. **Every Tigris bucket remains private**, including photos eventually displayed on public listings. Do not create a public media bucket or switch an object to public during approval.

Use separate environment-scoped private buckets or strictly isolated prefixes for property media, property documents and avatars. Scope application credentials to the exact required buckets/operations; bucket administration is a separate operational capability. Keep credentials server-side. Use the pinned Tigris SDK or a verified compatible S3 SDK behind `StorageProvider`; verify every used API against actual Tigris support rather than assuming full AWS feature parity.

### Upload and immutable finalization

1. Browser asks Next.js for an upload session. Server verifies Supabase identity, current role/ownership/listing state, quota and intended file category.
2. Server creates a UUID quarantine key and short-lived, one-object/method upload grant. The browser receives a bounded presigned URL, never Tigris credentials.
3. Browser uploads directly to Tigris with exact permitted headers/CORS. Uploading alone does not mark a file ready.
4. Server finalization checks the actual object bytes, size, signature/MIME, dimensions, checksum and current parent state; it cannot trust client claims or Content-Type alone.
5. Process validated bytes into an immutable final key/version that the upload grant cannot overwrite. A presigned PUT can be reused during its lifetime, so quarantine and final keys must differ. Prevent source-overwrite races with a verified digest/version or by processing exact validated bytes.
6. Commit ready metadata/revision in Supabase and reconcile partial DB/object failures durably. Submission/review requires the exact finalized file set. Cleanup abandoned quarantine objects and incomplete multipart work after a defined grace period.

Example logical keys (server-generated):

```text
quarantine/{uploadSessionId}/{uuid}
properties/{propertyId}/{revisionId}/{uuid}.webp
documents/{propertyId}/{revisionId}/{uuid}.pdf
avatars/{userId}/{uuid}.webp
```

Store provider/bucket/key/checksum/state and version where used in metadata; never store an expiring signed URL as a permanent document/image URL. Upload-session/idempotency data must include actor, parent, intended type, quota reservation, expiry, finalization state and durable error/retry state.

### Delivery of public listing photos

Approved listing photos remain private in Tigris. Expose stable application media URLs suitable for SSR, cards, gallery and Open Graph. The server resolves an allowlisted media ID/version to its stored key and checks current public eligibility before delivering preoptimized bytes. Do not accept arbitrary external URLs or bucket keys as a generic proxy.

Publicly displayed approved image responses may use a measured cache policy with versioned URLs and defined removal freshness. Draft images and private documents must never enter that cache or a public `next/image` optimizer path. Use preoptimized authenticated/no-store delivery for protected previews; do not assume the default image optimizer forwards user credentials or revokes previously cached bytes. Publication/unpublication updates all metadata/media cache dependencies while buckets stay private.

### Private verification documents

Baseline: an authenticated server proxy rechecks identity, current role and document/property scope on each request, returns safe preview/download headers, and uses private/no-store delivery. If a bounded direct presigned download is deliberately used, treat it as bearer access until its expiry/provider revocation behavior: Supabase logout alone is not object-token revocation. Keep TTL short, redact signed URLs, and test the actual Tigris behavior. Already downloaded bytes cannot be revoked.

### Environment, location and recovery

Use separate staging/production keys/buckets, restrict browser CORS to required origins/methods/headers, and verify raw unsigned GET/HEAD/LIST/PUT/DELETE fails. Verify account/bucket location policy independently; Vercel Mumbai does not establish Tigris residency. Back up/recover Tigris objects separately from Supabase rows; test checksums, permissions and metadata reconciliation after restore. See STOR, MEDIA, DOC, RLS and REC in `test.md`.

---

## 14. Upload Security

Validate:

- MIME type
- extension
- file size
- image dimensions
- document type
- file count

Recommended:

Images:

- jpeg
- png
- webp

Documents:

- pdf
- selected image formats if needed

Reject dangerous executable formats.

---

## 15. Image Optimisation

At upload:

- resize very large images
- strip unnecessary metadata where possible
- generate thumbnail
- generate optimized web format

At render:

- use `next/image`
- responsive sizes
- lazy load below fold
- priority only for LCP image

Do not load original 10MB image on search cards.

---

## 16. Pagination

### Public Property Search

Prefer cursor pagination when dataset grows.

Cursor can use:

- published_at
- id

Example stable sort:

`ORDER BY published_at DESC, id DESC`

Cursor:

```text
published_at + id
```

Benefits:

- stable
- scalable
- avoids slow high-offset scans

### SEO Pages

Numbered pagination may still be exposed:

`?page=2`

Internally use cursor mapping or efficient query strategy.

### Admin Tables

Offset pagination is acceptable for moderate internal datasets.

Use:

- limit 25
- limit 50
- max 100

Do not fetch thousands of records at once.

---

## 17. Search

MVP:

PostgreSQL filtering.

Indexes:

- status
- published_at
- property_type
- price
- area
- location_id
- seller_type

Add PostgreSQL full-text search where useful.

Later:

- trigram
- dedicated search engine if volume requires it

Avoid introducing Elasticsearch/Algolia in MVP unless justified.

---

## 18. Database Indexes

Likely indexes:

```text
properties(status, published_at desc)
properties(location_id, status)
properties(property_type, status)
properties(price)
properties(area_value)
properties(owner_id)
enquiries(property_id)
enquiries(seller_id, created_at desc)
favorites(user_id, created_at desc)
verification_reviews(property_id)
```

Review query plans before adding excessive indexes.

---

## 19. Caching

Use caching carefully.

Good candidates:

- location pages
- guides
- homepage location lists
- public listing detail after publication

Do NOT aggressively cache:

- dashboard private data
- admin data
- verification state
- private enquiry data

Use tags/invalidations.

Example:

Property approved:

- invalidate property tag
- invalidate search/location tags
- invalidate homepage featured listings

---

## 20. SEO Architecture

Every public listing should have:

- server-rendered metadata
- canonical URL
- Open Graph
- Twitter card
- breadcrumb schema
- structured data where appropriate
- descriptive alt text
- stable slug
- sitemap inclusion

Do not index:

- drafts
- rejected
- under-review
- user dashboard
- admin
- auth pages
- internal search combinations with thin/no value

---

## 21. Slugs

Example:

`2-acre-coffee-estate-for-sale-boikere-madikeri-abc123`

Do not rely on slug as primary key.

Use:

- slug for routing
- UUID internally

Redirect old slug to canonical new slug if title changes.

---

## 22. Sitemap

Use sitemap index when needed.

Include:

- property listings
- location landing pages
- guides

Exclude:

- user dashboard
- admin
- query-heavy filter URLs
- unpublished listings

---

## 23. API Design

Use Route Handlers only when needed.

Examples:

- external webhooks
- upload signing
- integrations
- mobile clients later

For internal form mutations, Server Actions can be simpler.

API responses should use consistent structure:

```json
{
  "data": {},
  "error": null,
  "meta": {}
}
```

Error:

```json
{
  "data": null,
  "error": {
    "code": "PROPERTY_NOT_FOUND",
    "message": "Property not found"
  }
}
```

---

## 24. Validation

Use shared Zod schemas.

Validate on:

- client for UX
- server for security

Never trust:

- role
- user id
- price
- listing status
- verification state
- storage path

from client without server verification.

---

## 25. Idempotency

Important operations:

- enquiry creation
- listing submission
- approval
- email dispatch
- OTP request

Use idempotency or duplicate protection where applicable.

Example:

Double-clicking Contact Owner must not create five identical enquiries.

---

## 26. Error Handling

Define application error codes.

Examples:

- AUTH_REQUIRED
- FORBIDDEN
- PROPERTY_NOT_FOUND
- PROPERTY_NOT_EDITABLE
- INVALID_STATUS_TRANSITION
- UPLOAD_FAILED
- OTP_RATE_LIMITED
- DUPLICATE_ENQUIRY
- VALIDATION_FAILED

Log internal error details.

Return safe user-facing messages.

---

## 27. Logging

Log:

- request id
- user id where allowed
- operation
- property id
- result
- duration
- provider errors

Never log:

- OTP
- auth token
- service role key
- document contents
- secrets

---

## 28. Audit Logs

Audit admin actions:

- approve
- reject
- request changes
- suspend user
- publish
- unpublish
- delete
- feature property
- modify sensitive property info

Audit log should record:

- actor
- action
- target
- timestamp
- relevant before/after metadata

---

## 29. Rate Limiting

Rate-limit:

- OTP sends
- OTP verify
- login attempts
- enquiry submissions
- property creation
- image upload
- report listing
- admin login

Use IP + user + action strategy where possible.

---

## 30. Property Status State Machine

Allowed states:

```text
draft
  ↓
submitted
  ↓
under_review
  ├── changes_required
  │      ↓
  │   submitted
  ├── rejected
  └── verified
         ↓
       sold
         ↓
      archived
```

Do not permit arbitrary status updates.

Implement transition rules in service layer.

---

## 31. Enquiry Architecture

User clicks Contact Owner.

Server verifies:

- authenticated
- property active
- property published
- buyer is not blocked
- listing owner exists

Then:

1. create enquiry
2. notify seller
3. optionally email seller
4. record analytics event

Do not expose seller's private phone number unless product policy explicitly allows it.

---

## 32. Performance Targets

Targets:

- LCP < 2.5s
- CLS < 0.1
- INP < 200ms where practical
- API p95 under 500–800ms for normal DB operations
- image cards optimized
- initial JS kept small

Use Web Vitals monitoring.

---

## 33. Query Optimisation

Rules:

- select only required columns
- never `select *` on large tables
- avoid N+1 queries
- aggregate on server/database
- paginate
- index filters
- inspect slow queries
- avoid client-side joins

Property card query should not load:

- private documents
- full description
- all images
- all enquiries

Only load:

- core metadata
- cover image
- needed location fields

---

## 34. Admin Dashboard Analytics

Aggregate server-side.

Do not load all rows and count in browser.

Example DB queries:

- count verified listings
- count pending review
- count enquiries today
- group by location
- group by property type

Apache ECharts receives small aggregated JSON.

---

## 35. Security Headers

Configure:

- CSP
- HSTS
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame protections where appropriate

---

## 36. CSRF and Mutation Security

Use same-site cookies/session protections.

Mutations must verify:

- authenticated user
- permission
- intended resource ownership
- valid origin where applicable

---

## 37. Secret Management

Store secrets only in environment variables.

Examples:

- SUPABASE_SERVICE_ROLE_KEY
- TIGRIS_STORAGE_ACCESS_KEY_ID
- TIGRIS_STORAGE_SECRET_ACCESS_KEY
- Tigris endpoint/signing configuration and private bucket identifiers (names must match the selected SDK/config layer)
- MSG91_AUTH_KEY
- BREVO_API_KEY
- MAPS_API_KEY
- SENTRY_DSN

Never commit `.env`.

Provide `.env.example`.

---

## 38. Environment Strategy

Use:

- local
- staging
- production

Separate Supabase projects if budget permits.

Never test destructive admin workflows against production data.

---

## 39. Deployment

Recommended:

Frontend/API:

- Vercel Functions in Mumbai (`bom1`), as requested
- Merge the following into the actual project configuration; preserve unrelated existing settings:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["bom1"]
}
```

Check route/function overrides and validate real execution metadata after deployment. CDN edge location does not prove function region. Static assets may use the global CDN. Do not silently recreate or migrate an existing Supabase project to change its region.

Database/Auth:

- Supabase; prefer Mumbai `ap-south-1` for a new project, verify an existing project before deciding migration

Object storage:

- Tigris; all buckets private and actual location/access policy checked separately

Source:

- GitHub

Branching:

- `main`
- `develop`
- feature branches

Production deploy only from reviewed code.

Before AI work, verify the actual repository and CLI/API target connections using `continue.md` §28. Git/GitHub, Supabase, Tigris and Vercel must have separate installed/authenticated/target-verified/read-probe status; MSG91/Brevo use API readiness checks. This specification does not establish account connections or perform deployment.

---

## 40. Monitoring

Recommended:

- Vercel analytics
- Sentry
- Supabase logs
- provider delivery logs
- uptime monitoring

Track:

- auth failure
- SMS failure
- email failure
- upload failure
- server errors
- slow queries

---

## 41. Backup & Recovery

Configure:

- database backups
- Tigris private-object backup/version/retention policy and a restore route separate from database backup
- restore process
- disaster recovery runbook

Test restoration periodically.

---

## 42. Data Retention

Define retention for:

- rejected listing documents
- user deletion
- inactive listings
- audit logs
- enquiry data
- notification logs

Sensitive verification documents should not be retained forever without a business/legal need.

---

## 43. Scaling Path

### Stage 1

0–10k listings:

- Next.js
- Supabase
- native PostgreSQL search
- Vercel

### Stage 2

10k–100k listings:

- stronger indexing
- materialized/aggregated data
- search optimization
- dedicated image pipeline if needed

### Stage 3

High traffic:

- dedicated search service if justified
- queues
- caching layer
- read replicas
- event-driven integrations

Do not over-engineer Stage 1.

---

## 44. Architecture Principle

Keep the system modular so providers can be swapped.

Interfaces:

```text
SmsProvider
EmailProvider
StorageProvider
MapProvider
SearchProvider
```

This makes it easier to replace MSG91, Brevo or another provider later without rewriting business logic.
