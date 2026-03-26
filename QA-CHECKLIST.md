# Afterset MVP — Manual QA Checklist

**Created:** 2026-03-24 · **Updated:** 2026-03-25
**How to use:** Work through each section top-to-bottom. Check off items as you go. Note any bugs inline.

> Prerequisites: `pnpm dev:api` running on :3000, `pnpm dev:web` running on :5173, Supabase project active, Resend configured.
> Test each section at **desktop (≥768px)** and **mobile (≤428px)** viewports unless noted otherwise.

---

## 1. Authentication

### 1.1 Magic Link Login
- [ ] Navigate to `/login` — page loads with email input
- [ ] Enter valid email, click "Send magic link"
- [ ] Confirmation screen shows with correct email
- [ ] Click "Resend link" — new email arrives
- [ ] Click "Use different email" — returns to input
- [ ] Open magic link from email — redirected to app
- [ ] If onboarding incomplete → redirected to `/onboarding`
- [ ] If onboarding complete → redirected to `/dashboard`

### 1.2 Session & Auth Guards
- [ ] Visit `/dashboard` while logged out → redirected to `/login`
- [ ] Visit `/pages` while logged out → redirected to `/login`
- [ ] Sign out via avatar dropdown → returned to `/login`
- [ ] After sign out, back button doesn't access authenticated pages

---

## 2. Onboarding (First-Time User)

### 2.0 Step 0 — Profile Setup
- [ ] Artist/Band Name input accepts text (required)
- [ ] Timezone dropdown populates with all timezones
- [ ] Timezone auto-detects from browser
- [ ] "Continue" disabled until name is entered
- [ ] "Continue" advances to Step 1

### 2.1 Step 1 — Create First Capture Page
- [ ] Title input works (required, 100 char max)
- [ ] Custom slug input works (optional, lowercase alphanumeric-hyphen, 40 char max)
- [ ] Value exchange textarea works (optional, 500 char max)
- [ ] Streaming links section expands/collapses
  - [ ] Each platform input validates URLs
  - [ ] Can add/remove links
- [ ] Social links section expands/collapses
  - [ ] Each platform input validates URLs
- [ ] 6 theme presets display and are clickable
  - [ ] Selecting a preset updates accent/secondary colors and styles
- [ ] Accent color picker works (hex input)
- [ ] Secondary color picker works (hex input)
- [ ] Background style tabs: solid / gradient / glow — each selectable
- [ ] Button style tabs: rounded / pill / sharp — each selectable
- [ ] "Create Page" submits and advances to Step 2

### 2.2 Step 2 — Follow-Up Email Setup
- [ ] Subject line input works (200 char max)
- [ ] Body textarea works (5000 char max)
- [ ] "When to Send" timing has 3 options: Immediately / After 1 hour / Next morning 9am
- [ ] Each timing option is selectable
- [ ] Include incentive toggle appears only if file was uploaded on page
- [ ] "Preview" button opens rendered HTML preview in iframe
- [ ] "Save & Continue" saves and advances to Step 3
- [ ] "Skip for now" link skips to Step 3 without saving

### 2.3 Step 3 — Completion
- [ ] QR code preview displays
- [ ] "Download QR Code" downloads a PNG file
- [ ] "Preview Live Page" opens the capture page URL (new tab)
- [ ] "Go to Dashboard" navigates to `/dashboard`
- [ ] After completing, returning to `/onboarding` redirects to `/dashboard`

### 2.4 Progress Indicator
- [ ] Progress bar shows all 4 steps
- [ ] Completed steps show checkmarks
- [ ] Current step is highlighted

---

## 3. Dashboard (`/dashboard`)

- [ ] Page loads without errors
- [ ] **Total Fans** stat card shows correct count
- [ ] **Capture Pages** stat card shows correct count
- [ ] **This Week** stat card shows correct count
- [ ] Growth chart renders (area chart, last 30 days)
- [ ] **Top Pages** section lists pages ranked by captures
  - [ ] Each shows capture count and email open rate %
- [ ] **Recent Captures** section shows last 10 captures
  - [ ] Email, page title, method, and date columns display
- [ ] Empty state shows guidance when no data exists
- [ ] Links to `/pages` and `/analytics` work

---

## 4. Capture Pages (`/pages`)

### 4.1 Page List
- [ ] "Create New Page" button visible
- [ ] Existing pages display as cards in a grid
- [ ] Each card shows:
  - [ ] Title (with hover pencil icon for inline editing)
  - [ ] Direct link (`afterset.net/c/<slug>`, clickable → opens live page)
  - [ ] QR code thumbnail
  - [ ] Download QR button
  - [ ] Capture count (links to /fans filtered)
  - [ ] Active/Inactive badge
  - [ ] Email sequence badge (clickable → opens email dialog)
  - [ ] Accent + secondary color circles
  - [ ] Created date
- [ ] **Inline keyword display:** if keyword set, card shows "Text [KEYWORD] to (XXX) XXX-XXXX" with honey-gold icon — clickable → opens KeywordDialog
- [ ] **No keyword:** card shows "Set up text-to-join" secondary button → opens KeywordDialog
- [ ] File incentive info displays if attached
- [ ] Empty state educates on single-page model: "Create a page with a permanent link…"

### 4.2 Inline Page Title Editing
- [ ] Hover over page card title → pencil icon appears with tooltip "What's tonight's show? Click to update."
- [ ] Click title or pencil icon → switches to inline input (auto-focused)
- [ ] Type new title → max 100 chars enforced
- [ ] Press **Enter** → title saves, edit mode closes, toast "Page title updated"
- [ ] Press **Escape** → changes discarded, edit mode closes
- [ ] Blur input → title saves
- [ ] On mobile: pencil icon visible without hover, edit mode works with on-screen keyboard

### 4.3 Create New Page
- [ ] Click "Create New Page" → PageFormDialog opens (full-screen on mobile)
- [ ] **Slug education section visible** (create mode only):
  - [ ] Shows `afterset.net/c/` + live slug preview in electric-blue
  - [ ] Typing title updates slug preview in real-time (e.g., "Austin March 28" → `austin-march-28`)
  - [ ] Empty title shows italic placeholder "your-page-url"
  - [ ] Help text: "This link is permanent — update the title before each show, the URL stays the same."
- [ ] Fill in title (required) → submit succeeds
- [ ] All form fields work (same as onboarding Step 1)
- [ ] Dialog closes on successful creation
- [ ] New page appears in the grid

### 4.4 Edit Page
- [ ] Open dropdown menu on a page card → click "Edit page"
- [ ] PageFormDialog opens in edit mode with existing data populated
- [ ] Slug education section is NOT shown in edit mode
- [ ] Modify title → save → title updates on card
- [ ] Modify colors → save → color circles update
- [ ] Modify streaming/social links → save → changes persist
- [ ] Change theme preset → save → styles update
- [ ] Change background style → save
- [ ] Change button style → save

### 4.5 Page Card Dropdown Actions
- [ ] **Edit page** — opens edit dialog (tested above)
- [ ] **Set up Follow-Up Email** — opens EmailTemplateDialog
- [ ] **Set up Text-to-Join Keyword** — opens KeywordDialog
- [ ] **Download QR** — downloads QR PNG
- [ ] **Delete page** — confirmation prompt, then deletes
  - [ ] Captures are preserved after deletion (check /fans)
  - [ ] Page disappears from grid

### 4.6 Incentive File Upload
- [ ] In page edit dialog, file upload area is visible
- [ ] Drag-and-drop a file → upload starts with progress
- [ ] Click to browse and select a file → upload starts
- [ ] Allowed types: audio, image, video, PDF, ZIP
- [ ] Max size: 250MB (test with a large-ish file)
- [ ] After upload: file name, size, and type icon display
- [ ] "Delete" button removes the incentive
- [ ] Can upload a replacement after deleting

### 4.7 SMS Keyword (via KeywordDialog)
- [ ] Open keyword dialog from dropdown
- [ ] Keyword input: alphanumeric only, 2-20 chars, auto-uppercased
- [ ] Availability check fires after typing (debounced ~300ms)
  - [ ] Available → green indicator
  - [ ] Reserved word (STOP, HELP, etc.) → blocked indicator
  - [ ] Already taken → unavailable indicator with suggestions
- [ ] "Save" sets the keyword
- [ ] Keyword displays on page card after saving
- [ ] "Delete" removes the keyword
- [ ] Re-opening dialog shows current keyword

---

## 5. Email Sequences (`/emails` — Follow-up Sequences section)

### 5.1 Sequence List
- [ ] "Configured" section shows pages that have email sequences
  - [ ] Cards are clickable → open EmailTemplateDialog
  - [ ] Active step count badge displays
  - [ ] Step list shows timing and subject per step
- [ ] "No email set up" section shows pages without sequences
  - [ ] "Set Up" button opens EmailTemplateDialog

### 5.2 EmailTemplateDialog — Step Management
- [ ] Dialog opens with collapsible step list
- [ ] **Step 0 (Welcome email):**
  - [ ] Subject input works (200 char max)
  - [ ] Body textarea works (5000 char max)
  - [ ] Timing selector: Immediately / After 1 hour / Next morning 9am
  - [ ] Include incentive toggle (only if page has incentive file)
  - [ ] Active toggle works
  - [ ] "Preview" renders email HTML in iframe
  - [ ] "Save" persists changes
  - [ ] "Delete" removes the step (with confirmation)
- [ ] **Add Step** button (visible when < 5 steps):
  - [ ] Creates new step with next sequence_order
  - [ ] New step appears in list
- [ ] **Steps 1-4:**
  - [ ] Timing uses "delay_days" selector (0-30 days)
  - [ ] All other fields same as Step 0
  - [ ] Steps display in order
- [ ] **Max 5 steps enforced** — "Add Step" hidden at 5
- [ ] Expand/collapse individual steps works
- [ ] Step indicators show correct numbering

---

## 6. Broadcasts (`/emails` — Email Fans section)

### 6.1 Broadcast List
- [ ] "New Broadcast" button visible
- [ ] Draft broadcasts show with "Draft" badge
- [ ] Sent broadcasts show with "Sent" badge and stats
- [ ] Scheduled broadcasts show with "Scheduled" badge and date
- [ ] Each card shows: title, subject preview, recipient count
- [ ] Sent cards show progress bar (sent/opened counts)

### 6.2 Create Broadcast
- [ ] Click "New Broadcast" → BroadcastComposeDialog opens
- [ ] Subject line input (200 char max)
- [ ] Body textarea (5000 char max)
- [ ] **Preset templates dropdown:**
  - [ ] New Release — populates subject + body
  - [ ] Merch Drop — populates subject + body
  - [ ] Upcoming Show — populates subject + body
  - [ ] Tour Dates — populates subject + body
- [ ] Reply-to field works (noreply or artist email)
- [ ] **Recipient filters (expand/collapse):**
  - [ ] Page selection (multi-select from existing pages)
  - [ ] Date range (from/to)
  - [ ] Capture method filter
  - [ ] Recipient count updates on filter change (dry-run)
- [ ] Auto-save fires after 800ms of inactivity
- [ ] "Save draft" explicitly saves
- [ ] "Preview" renders email HTML in modal

### 6.3 Schedule Broadcast
- [ ] Calendar picker appears for scheduling
- [ ] Select date → date displays
- [ ] Time selector works
- [ ] Scheduled broadcasts show scheduled time on card

### 6.4 Send Broadcast
- [ ] Click "Send" → confirmation dialog appears
- [ ] Confirm → broadcast status changes to "sending"
- [ ] After send completes → status changes to "sent"
- [ ] Recipient count matches expected (based on filters)
- [ ] Limit: 1 broadcast/day per artist (try sending a second → error)
- [ ] Limit: 5000 max recipients (if applicable)

### 6.5 Broadcast Card Dropdown
- [ ] **Edit** (draft only) — reopens compose dialog
- [ ] **Preview** — shows rendered email
- [ ] **Delete** (draft only) — removes broadcast
- [ ] **Archive** (sent only) — hides from list
- [ ] **Show archived** toggle → archived broadcasts appear (reduced opacity)
- [ ] **Unarchive** on archived broadcast → returns to main list

---

## 7. Fans (`/fans`)

### 7.1 Captures Table
- [ ] Table loads with fan captures
- [ ] Columns: Email, Page, Method, Date
- [ ] **Sort by Email** — click header, toggles asc/desc
- [ ] **Sort by Page** — click header, toggles asc/desc
- [ ] **Sort by Date** — click header, toggles asc/desc
- [ ] Method badges display with correct colors (QR/Direct/SMS/NFC)
- [ ] Dates display in relative/compact format

### 7.2 Filters
- [ ] **Email search** — type partial email → results filter live
- [ ] **Page dropdown** — select a specific page → only those captures show
- [ ] **Method dropdown** — select QR/Direct/SMS/NFC → filters
- [ ] **Date from** — set start date → older captures hidden
- [ ] **Date to** — set end date → newer captures hidden
- [ ] **Combined filters** — set page + method + date range → all applied
- [ ] **Active filter badges** display for each active filter
  - [ ] Click X on a badge → that filter is removed
- [ ] **Clear filters** button appears when filters are active
  - [ ] Click → all filters reset, full list returns

### 7.3 Export
- [ ] **Export CSV** button visible
- [ ] Click with no filters → downloads full CSV
- [ ] Click with filters active → CSV respects filters
- [ ] CSV contains: email, page title, method, date
- [ ] Deleted pages show snapshot title in CSV

### 7.4 Edge Cases
- [ ] Deleted page captures show page title snapshot (not blank)
- [ ] Empty state when no captures exist → guidance shown
- [ ] Navigating from page card "X captures" link → /fans pre-filtered by that page

---

## 8. Analytics (`/analytics`)

### 8.1 Overview
- [ ] 3 stat cards: Total Captures, This Week, Capture Pages
- [ ] Values match expected counts

### 8.2 Captures by Page
- [ ] Pages listed, ranked by capture count
- [ ] Each shows capture count and email open rate %
- [ ] Progress bars render proportionally
- [ ] Click a page → detail panel appears

### 8.3 Per-Page Detail
- [ ] **Email Performance card:**
  - [ ] Open rate % displays
  - [ ] Total sent count
  - [ ] Total opened count
  - [ ] Per-step breakdown (if multi-step sequence):
    - [ ] Step number badge
    - [ ] Subject line
    - [ ] Sent count per step
    - [ ] Open rate per step
- [ ] **Method Breakdown** — horizontal bar chart (QR/Direct/SMS/NFC)
- [ ] **Daily Captures** — area chart, last 30 days
- [ ] Selecting a different page updates all detail panels

### 8.4 Empty State
- [ ] No data → empty state with guidance

---

## 9. Settings (`/settings`)

- [ ] **Account section** — email displays (read-only)
- [ ] **Profile section:**
  - [ ] Artist/Band Name pre-filled with current value
  - [ ] Edit name → "Save Changes" → updates
  - [ ] Timezone dropdown pre-selected with current value
  - [ ] Change timezone → save → updates
  - [ ] "Detect timezone" button appears if browser TZ differs from stored
    - [ ] Click → timezone updates to browser TZ
- [ ] Validation errors display on invalid input
- [ ] Save success feedback (toast or inline)

---

## 10. Fan-Facing Capture Page (Worker)

> Test at the live capture page URL (e.g., `https://afterset.net/<slug>` or local worker)

### 10.1 Page Rendering
- [ ] Page loads fast (should be < 14KB)
- [ ] System fonts render (no custom font requests)
- [ ] Theme colors match what was set in dashboard
- [ ] Background style (solid/gradient/glow) renders correctly
- [ ] Button style (rounded/pill/sharp) renders correctly
- [ ] Artist name displays
- [ ] Page title displays
- [ ] Value exchange text displays (if set)

### 10.2 Streaming & Social Links
- [ ] Streaming links render with correct platform icons
- [ ] Each link opens correct URL in new tab
- [ ] Social links render with correct platform icons
- [ ] Each link opens correct URL in new tab
- [ ] Missing links are not shown (no empty slots)

### 10.3 Email Capture Form
- [ ] Email input field visible with placeholder
- [ ] Submit with valid email → success confirmation
- [ ] Submit with invalid email → validation error
- [ ] Submit same email twice → handled gracefully (no error, deduped)
- [ ] After submit, capture appears in `/fans` on dashboard
- [ ] Capture event records correct method (QR/Direct based on URL params)
- [ ] `page_title` snapshot is stored on capture event

### 10.4 Incentive Download
- [ ] If page has incentive file, download link/button appears after capture
- [ ] Click download → file downloads via signed URL
- [ ] If no incentive → no download UI shown

### 10.5 Follow-Up Email Delivery
- [ ] After capture, follow-up email arrives based on timing:
  - [ ] "Immediately" → email arrives within minutes
  - [ ] "After 1 hour" → email arrives ~1 hour later
  - [ ] "Next morning 9am" → email arrives next day at 9am artist TZ
- [ ] Email contains correct subject and body
- [ ] Email includes incentive download link (if toggle was on)
- [ ] CAN-SPAM footer present
- [ ] Unsubscribe link works (RFC 8058)
- [ ] **Multi-step sequence:** subsequent emails arrive on configured delay_days
- [ ] Resubmitting same email does NOT send duplicate emails

---

## 11. Mobile UX (< 768px viewport)

> Test in Chrome DevTools responsive mode at 375px and 428px widths.

### 11.1 Bottom Tab Navigation
- [ ] Sidebar is hidden; fixed bottom tab bar appears with 5 tabs: Overview, Pages, Emails, Fans, Analytics
- [ ] Each tab navigates to the correct route
- [ ] Active tab is highlighted in honey-gold
- [ ] Top header shows Afterset logo + avatar dropdown (right-aligned)
- [ ] Avatar dropdown contains Settings and Sign out
- [ ] Nav does not scroll with page content (fixed positioning)
- [ ] At exactly 768px, layout switches to desktop sidebar

### 11.2 Card View for Captures
- [ ] On `/fans`: captures render as stacked cards (not a table)
- [ ] Each card shows: email, date, method badge, page name
- [ ] Sort controls appear above card list (Date, Email, Page)
- [ ] Clicking a sort column toggles asc/desc
- [ ] At ≥768px: table layout appears instead of cards

### 11.3 Full-Screen Dialogs
- [ ] All dialogs fill viewport on mobile (< 640px) with padding
- [ ] Close button is 44px tap target on mobile
- [ ] Dialog footer buttons stack vertically on mobile
- [ ] At ≥640px: dialogs are centered with max-width constraints
- [ ] Test: PageFormDialog, EmailTemplateDialog, KeywordDialog, BroadcastComposeDialog

### 11.4 Touch Targets
- [ ] All buttons, links, and interactive elements are ≥44px tap targets
- [ ] Bottom tab bar icons/labels are easy to tap
- [ ] Dropdown menus open cleanly on touch

### 11.5 Typography & Readability
- [ ] Text is readable at 320px viewport without horizontal scrolling
- [ ] Long titles/emails truncate with ellipsis (not overflow)
- [ ] Stat cards, charts, and badges are legible on small screens

---

## 12. PWA

### 12.1 Install Prompt
- [ ] On installable browser (Chrome/Edge Android, desktop Chrome): install prompt appears
- [ ] Prompt shows: Download icon (honey-gold), "Install Afterset", "Add to your home screen for quick access"
- [ ] Click **Install** → browser native install dialog appears
- [ ] Accept install → prompt closes, app installs to home screen
- [ ] Click **X** (dismiss) → prompt hides
- [ ] Reload page after dismiss → prompt does NOT reappear (localStorage `pwa-install-dismissed`)
- [ ] On non-installable browsers (Safari iOS, Firefox): prompt does not appear
- [ ] Mobile position: bottom-left area; Desktop position: bottom-right

### 12.2 Manifest & Icons
- [ ] DevTools → Application → Manifest: no errors or warnings
- [ ] `name`: "Afterset", `short_name`: "Afterset"
- [ ] `display`: "standalone", `start_url`: "/"
- [ ] `theme_color` and `background_color`: both `#0a0e1a`
- [ ] Icons present: `pwa-192.png` (192×192), `pwa-512.png` (512×512, + maskable)
- [ ] `apple-touch-icon-180.png` loads (check Network tab)
- [ ] `favicon-32.png` and `logo.svg` favicon both load
- [ ] Lighthouse PWA audit passes (DevTools → Lighthouse → Progressive Web App)

### 12.3 Installed PWA Experience
- [ ] Install via Chrome → app opens in standalone window (no browser chrome)
- [ ] Status bar color matches midnight (`#0a0e1a`)
- [ ] App title shows "Afterset" in OS task switcher / dock
- [ ] Navigation works without browser back/forward (in-app routing only)
- [ ] Closing and reopening installed app → loads from cache, then refreshes
- [ ] **iOS Safari "Add to Home Screen":**
  - [ ] `apple-mobile-web-app-capable` = yes → opens standalone
  - [ ] Status bar style: `black-translucent`
  - [ ] Title shows "Afterset" under home screen icon
  - [ ] Apple touch icon (180px) displays on home screen
- [ ] **Android Chrome "Add to Home Screen":**
  - [ ] App icon uses maskable 512px icon
  - [ ] Splash screen shows midnight background during load

### 12.4 Service Worker & Offline
- [ ] After first visit, app shell loads from cache on subsequent visits
- [ ] Static assets (JS, CSS, icons, fonts) served from SW cache
- [ ] API responses use stale-while-revalidate (`api-cache`, 5min TTL, 50 entries max)
- [ ] Dashboard loads cached data instantly, then refreshes in background
- [ ] Airplane mode: app shell renders (nav, layout) — API calls show appropriate error state

### 12.5 Update Toast
- [ ] Deploy new version → revisit app → Sonner toast: "New version available" / "Refresh to get the latest updates."
- [ ] Toast persists until dismissed or Refresh clicked (infinite duration)
- [ ] Click **Refresh** → page reloads with new version
- [ ] Dismiss toast → toast hides
- [ ] SW polls for updates every 60 minutes

---

## 13. Capacitor / Native (iOS & Android)

> These require the native projects generated on Mac. Test on real devices or simulators.

### 13.1 Push Notifications
- [ ] First launch on native → permission prompt appears ("Allow notifications?")
- [ ] Grant permission → device token sent to `POST /api/device-tokens`
- [ ] Check `device_tokens` table → entry with token, platform ("ios"/"android"), artist_id
- [ ] Deny permission → no token sent, no error shown
- [ ] Duplicate registration → unique constraint prevents duplicate tokens
- [ ] On web browser → hook exits silently, no permission prompt

### 13.2 Splash Screen
- [ ] App launch shows midnight (#0a0e1a) background
- [ ] Splash auto-hides after ~2 seconds
- [ ] No spinner visible

### 13.3 App Identity & Config
- [ ] App ID is `net.afterset.app`
- [ ] App name displays as "Afterset" in device app list
- [ ] Web content loads inside native shell (no browser chrome)
- [ ] `capacitor.config.ts` server URL is correct for prod (not localhost)

### 13.4 App Store Readiness (Pre-Submission)
- [ ] **iOS (Xcode):**
  - [ ] `npx cap sync` completes without errors
  - [ ] `npx cap open ios` opens Xcode project
  - [ ] Build succeeds on Simulator (iPhone 15 / latest)
  - [ ] Push Notifications capability enabled in Signing & Capabilities
  - [ ] APNs key uploaded to Apple Developer portal
  - [ ] Bundle ID matches `net.afterset.app`
  - [ ] App icon asset catalog populated (all required sizes)
  - [ ] LaunchScreen uses midnight background
  - [ ] Test on physical device: install via Xcode → full flow works
- [ ] **Android (Android Studio):**
  - [ ] `npx cap sync` completes without errors
  - [ ] `npx cap open android` opens Android Studio project
  - [ ] Build succeeds on emulator (Pixel 7 / API 34)
  - [ ] `google-services.json` present in `android/app/`
  - [ ] Firebase project created and linked
  - [ ] Package name matches `net.afterset.app`
  - [ ] Adaptive icon renders correctly
  - [ ] Test on physical device: install via ADB → full flow works
- [ ] **Both platforms:**
  - [ ] Auth flow works (magic link opens in-app browser → returns to app)
  - [ ] All dashboard tabs load and function
  - [ ] Inline title edit works with native keyboard
  - [ ] File upload (incentive) works from device storage/camera roll
  - [ ] QR code download saves to device gallery/files
  - [ ] Deep links / URL scheme work (if configured)
  - [ ] App resumes correctly after backgrounding

---

## 14. Cross-Cutting Concerns

### 14.1 Navigation
- [ ] Desktop: all sidebar links navigate correctly
- [ ] Mobile: all bottom tab bar links navigate correctly
- [ ] Browser back/forward buttons work
- [ ] Deep-linking to any route works (e.g., paste `/analytics` URL)
- [ ] Page titles update in header on navigation

### 14.2 Responsive / Layout
- [ ] Desktop sidebar visible at ≥768px, hidden below
- [ ] Mobile bottom tab bar visible at <768px, hidden above
- [ ] Cards reflow on narrow viewport
- [ ] Dialogs: full-screen on mobile, centered on desktop
- [ ] Tables → card view on mobile (fans), table on desktop

### 14.3 Error Handling
- [ ] API errors show user-friendly toast/message (not raw errors)
- [ ] Network failure shows appropriate error state
- [ ] Form validation errors display inline
- [ ] 404 / unknown routes handled gracefully

### 14.4 Loading States
- [ ] Dashboard shows loading spinners while fetching
- [ ] Page list shows loading state
- [ ] Fans table shows loading state
- [ ] Analytics shows loading state
- [ ] Buttons show loading spinners during mutations

### 14.5 Data Consistency
- [ ] Creating a page → appears on dashboard, pages list, analytics, and fan filters
- [ ] Deleting a page → removed from lists, captures preserved with title snapshot
- [ ] Editing page title (inline) → updates everywhere (cards, filters, fan table, analytics)
- [ ] New capture → dashboard stats update, fan table updates, analytics update

---

## 15. End-to-End Flows

### 15.1 QR Code Flow
- [ ] Create a page → download QR code
- [ ] Scan QR code with phone → capture page opens
- [ ] Submit email on phone → success shown
- [ ] Check `/fans` on dashboard → new capture with method "qr"
- [ ] Check `/dashboard` → stats updated
- [ ] Follow-up email arrives (per configured timing)

### 15.2 Single-Page Reuse Flow
- [ ] Create a page titled "Austin March 28"
- [ ] Capture a fan email → `capture_events.page_title` = "Austin March 28"
- [ ] Inline-edit the page title to "Nashville April 5"
- [ ] Capture another fan email → `capture_events.page_title` = "Nashville April 5"
- [ ] Check `/fans` → both captures show their respective snapshotted titles
- [ ] URL slug unchanged throughout

### 15.3 Full Onboarding → First Capture Flow
- [ ] New user: magic link → onboarding → create page → set up email → completion screen
- [ ] Download QR → scan on phone → submit email → fan appears in dashboard
- [ ] Follow-up email arrives with correct content

---

## Bug Log

| # | Section | Description | Severity | Status |
|---|---------|-------------|----------|--------|
| | | | | |
