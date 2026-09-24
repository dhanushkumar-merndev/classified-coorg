# design.md
# Land in Coorg Classified Marketplace — Design System & UI/UX Guide

## 1. Design Goal

Build a premium, trustworthy, modern real-estate marketplace focused only on Coorg/Kodagu properties.

The interface should feel familiar to Indian property-platform users, but cleaner and less crowded than large portals.

Primary UX goals:

- Fast property discovery.
- High trust.
- Strong local identity.
- Clear verified/unverified states.
- Easy property posting.
- Excellent mobile experience.
- Search-first navigation.
- Strong SEO-friendly page structure.
- Minimal cognitive load.

Do not copy 99acres, Magicbricks, Housing, or other portals visually. Use familiar interaction patterns only.

---

## 2. Core UI Stack

Use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Apache ECharts
- Lucide icons
- next/image
- Radix primitives through shadcn/ui
- Sonner for toast notifications
- React Hook Form
- Zod validation

Avoid unnecessary UI libraries.

**Rule (confirmed 24 September 2026): build every UI component from shadcn/ui only.** Add components with `pnpm dlx shadcn@latest add <name>` and compose missing pieces from shadcn primitives. Do not add another component kit (MUI, Chakra, Mantine, DaisyUI, Headless UI, etc.). Sonner is used through shadcn's `sonner` component; Apache ECharts remains only for admin charts.

---

## 3. Brand Personality

The product should feel:

- Local
- Premium
- Trustworthy
- Calm
- Nature-oriented
- Professional
- Transparent

Avoid:

- Loud gradients
- Excessive glassmorphism
- Neon colors
- Too many shadows
- Over-animation
- Crowded cards
- Huge decorative text
- Real-estate portal clutter

---

## 4. Color System

Use CSS variables through shadcn/ui.

### Primary

Forest Green

- `--primary: #1F5A3D`
- `--primary-hover: #184A32`
- `--primary-foreground: #FFFFFF`

Use for:

- Main CTA
- Active filters
- Verified accents
- Search button
- Selected navigation states

### Secondary

Deep Charcoal

- `--secondary: #1F2933`
- `--secondary-foreground: #FFFFFF`

Use for:

- Dark headings
- Footer
- Admin navigation
- Premium sections

### Background

Warm White

- `--background: #FBFCF9`

Primary surfaces:

- `--card: #FFFFFF`
- `--muted: #F3F5F1`

### Text

- Main text: `#17211B`
- Secondary text: `#5F6B63`
- Muted text: `#8A948D`

### Borders

- Default: `#E3E8E3`
- Strong: `#CBD3CC`

### Status Colors

Success / Verified:

- `#1D7A4D`

Warning / Under Review:

- `#D89A2B`

Error / Rejected:

- `#C74747`

Info:

- `#2F6DB3`

Draft:

- `#6D7480`

Use status colors only where status meaning is required.

---

## 5. Typography

Recommended:

Primary font:

- Inter
- Geist
- Plus Jakarta Sans

Suggested:

- UI: Geist Sans
- Property price and numbers: Geist Sans SemiBold

Typography scale:

- H1: 48–64px desktop, 34–40px mobile
- H2: 34–42px desktop
- H3: 24–30px
- H4: 20–24px
- Body: 16px
- Small: 14px
- Caption: 12px

Rules:

- Do not use more than 3 font weights on one screen.
- Price must be visually stronger than metadata.
- Location should always be readable but secondary to title and price.
- Avoid ALL CAPS except tiny status labels.

---

## 6. Spacing

Use a consistent 4px-based spacing system.

Preferred:

- Card padding: 20–24px
- Section vertical spacing: 64–96px desktop
- Mobile section spacing: 40–56px
- Grid gap: 16–24px
- Input height: 44–48px
- Main CTA height: 46–50px

Max page width:

- `max-w-7xl`
- Around 1280px

Content-heavy property-detail sections can use:

- `max-w-6xl`

---

## 7. Border Radius

Use moderate radii.

- Inputs: `rounded-lg`
- Cards: `rounded-xl`
- Modal/Dialog: `rounded-2xl`
- Pills/chips: `rounded-full`

Avoid excessively rounded real-estate listing cards.

---

## 8. Shadows

Default card:

- very subtle shadow
- border should provide most separation

Hover:

- small increase in shadow
- small translate effect maximum 1–2px

Avoid floating/glowing cards.

---

## 9. Navigation

### Desktop Header

Structure:

Logo

Buy

Locations

Property Types

Guides

Post Property

Saved

Login / Account

Primary CTA:

`Post Property`

Requirements:

- Sticky header
- White background
- Thin bottom border
- Search may become compact in header after user scrolls
- Active navigation clearly visible
- Login state displays avatar/account menu

### Mobile Header

Logo

Search icon

Account icon

Menu

Primary mobile action can appear as:

`Post Property`

in menu or sticky bottom navigation.

---

## 10. Homepage Hero

Hero should be search-first.

Content:

Headline:
`Find verified land and properties in Coorg`

Subtext:
`Discover estates, plots and land across Kodagu.`

Search box:

- Location
- Property type
- Budget
- Search button

Optional popular chips:

- Madikeri
- Kushalnagar
- Virajpet
- Coffee Estates
- Farm Land

Desktop:

Horizontal search.

Mobile:

Stacked or full-screen filter/search sheet.

---

## 11. Property Card

Required structure:

1. Image
2. Verification badge
3. Property title
4. Location
5. Price
6. Area
7. Price per acre/cent
8. Seller type
9. Posted date
10. Save button
11. View Property CTA

Do not overload the card.

Recommended card dimensions:

Desktop grid:

- 3 columns large screens
- 2 columns tablet
- 1 column mobile

Search result desktop can also support a list/card hybrid.

Image ratio:

- 4:3 recommended

Fallback image required.

---

## 12. Verified Badge

Use:

`Verified`

with shield/check icon.

Verified badge must not imply legal title guarantee.

Tooltip/text:

`Listing information reviewed by the platform. Buyers should complete independent legal verification before purchase.`

---

## 13. Search Results Page

Layout:

Desktop:

- Left filter sidebar
- Right results area

Mobile:

- Filter button
- Sort button
- Result count
- Cards

Top controls:

- Search bar
- Sort
- Result count

Filters:

- Location
- Property type
- Min price
- Max price
- Min area
- Max area
- Area unit
- Seller type
- Verified only
- Plantation type
- Road access
- Water availability

Filters should update URL query parameters.

Example:

`/properties?location=madikeri&type=coffee-estate&page=2`

---

## 14. Filter UX

Use:

- Checkbox
- Radio group
- Range/number inputs
- Select
- Combobox for location

Rules:

- Always show active filter count.
- Provide `Clear all`.
- Persist filters in URL.
- Do not reset filters when user opens property and returns.
- Debounce text-based filters.
- Apply button on mobile.
- Desktop can update immediately.

---

## 15. Property Detail Page

Recommended order:

1. Breadcrumb
2. Image gallery
3. Title + verification
4. Location
5. Price
6. Key stats
7. Sticky contact box
8. Description
9. Property details
10. Amenities/features
11. Map
12. Seller summary
13. Disclaimer
14. Similar listings
15. Report property

Desktop:

Two-column layout.

Left:

Main content.

Right:

Sticky enquiry/contact card.

Mobile:

Sticky bottom CTA:

`Contact Owner`

---

## 16. Image Gallery

Desktop:

- Main image
- 4-image supporting grid
- View all photos button

Mobile:

- Swipeable carousel

Must support:

- image count
- full-screen gallery
- lazy loading
- optimized thumbnails
- broken-image fallback

Storage/delivery rule: all images and verification documents are stored in private Tigris buckets. Approved public photos use stable application media URLs with optimized variants; private previews/documents require current authorization. Show upload/processing/ready/failure and expired-link recovery states. Never expose bucket credentials or rely on permanent presigned URLs in cards, SSR or Open Graph. Private document previews must not use the public image cache. See architecture.md §13 and the STOR suite.

---

## 17. Post Property Flow

Use a stepper.

Recommended steps:

1. Property Type
2. Location
3. Property Details
4. Pricing
5. Features
6. Photos
7. Documents
8. Seller Details
9. Preview
10. Submit

UX requirements:

- Save draft
- Autosave
- Clear completion percentage
- Resume later
- Field-level validation
- Do not lose entered data on refresh
- Warn before leaving unsaved form
- Large upload progress indicator
- Property preview before submission

---

## 18. User Dashboard

Desktop:

Left sidebar.

Sections:

- Overview
- My Properties
- Saved Properties
- My Enquiries
- Received Enquiries
- Recently Viewed
- Profile
- Settings

Mobile:

Top-tabs or dropdown navigation.

Dashboard should prioritize actionable information.

Example cards:

- Active Listings
- Under Review
- Total Enquiries
- Saved Properties

---

## 19. Admin Panel UI

Use a denser UI than public marketplace.

Left navigation:

- Dashboard
- Verification Queue
- Properties
- Users
- Enquiries
- Locations
- Articles
- Reports
- Settings
- Audit Logs

Admin table design:

- Search
- Filters
- Pagination
- Status chips
- Bulk selection where useful
- Row action dropdown

Do not overcrowd dashboards with decorative charts.

---

## 20. Apache ECharts Usage

Use Apache ECharts for admin analytics only.

Recommended charts:

### Listing Status Donut

- Draft
- Submitted
- Under Review
- Verified
- Rejected
- Sold

### Listings Over Time

Line chart:

- daily
- weekly
- monthly

### Enquiries Trend

Line/bar chart.

### Listings by Location

Horizontal bar chart.

### Listings by Property Type

Bar chart.

### Funnel

Submitted → Reviewed → Approved → Enquired

Use server-provided aggregated data.

Do not send raw large datasets to browser only to aggregate them client-side.

---

## 21. Forms

Use:

- React Hook Form
- Zod
- shadcn Form

Requirements:

- clear labels
- error text directly below input
- no placeholder-only labels
- disable submit while request is processing
- loading state
- retry state
- success toast
- server-side validation always repeated

---

## 22. Modals and Sheets

Use dialogs for:

- Confirm deletion
- Reject property
- Request changes
- Report listing

Use Sheet/Drawer for:

- Mobile filters
- Mobile navigation
- Quick account menu

Avoid nesting modals.

---

## 23. Empty States

Required:

- No saved properties
- No listings
- No search results
- No enquiries
- No pending verifications
- No recently viewed properties

Each should include a relevant next action.

---

## 24. Loading States

Use skeletons for:

- property cards
- property gallery
- admin table
- dashboard KPI cards

Avoid full-page spinners where possible.

---

## 25. Error States

Support:

- Network failure
- Unauthorized
- Forbidden
- Listing removed
- Listing sold
- Listing under review
- Image unavailable
- Upload failed
- OTP expired
- Rate limit exceeded

Every error should give user a next action.

---

## 26. Responsive Breakpoints

Use Tailwind defaults.

Design mobile-first.

Important widths:

- 360px
- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px

Test forms and property galleries heavily on mobile.

---

## 27. Accessibility

Minimum requirements:

- WCAG AA color contrast
- Visible keyboard focus
- Semantic headings
- Inputs have labels
- Images have alt text
- Buttons have accessible names
- Dialog focus trap
- Escape closes dialogs
- Keyboard usable filters
- aria-live for async errors/success
- Avoid motion that cannot be reduced

Use `prefers-reduced-motion`.

---

## 28. Animation

Keep motion subtle.

Use CSS transitions primarily.

Recommended:

- 150–250ms
- fade
- small translate
- accordion transitions
- modal/sheet transitions

Do not animate every card on scroll.

---

## 29. SEO UX Requirements

Public content must render server-side where possible.

Property detail page must expose:

- title
- price
- area
- location
- description
- image
- breadcrumb
- similar listing links

Do not hide essential SEO content behind client-only rendering.

---

## 30. Final Design Principle

The product should visually communicate:

`Verified local property marketplace for Coorg`

Every important screen should answer:

- Where is the property?
- What is it?
- How much does it cost?
- Is it verified?
- Who posted it?
- How can I contact them?
