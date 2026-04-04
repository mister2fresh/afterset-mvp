# Afterset Crash Course

## 1. The One-Paragraph Summary

Afterset helps musicians collect fan emails at live shows. An artist creates a "capture page" (a tiny webpage with a form on it), prints out a QR code that links to it, and sticks it on a merch table or stage. When a fan scans the QR code (or texts a keyword, or taps an NFC chip), they land on the capture page and type in their email. That email gets saved to a database (a place where all the data lives), the fan automatically gets a follow-up email sequence (a series of emails sent over days), and the artist can see who signed up, from which show, and how their emails are performing — all from a dashboard (a control-panel website) on their phone or laptop.

---

## 2. The Building Blocks

### **Supabase** (the database and login system)
- A hosted Postgres database (think: a giant spreadsheet with rules) that stores every artist, fan, capture page, email template, and queued email. Also handles authentication (proving you are who you say you are) via magic links (passwordless login emails).
- Talks to: the **Hono API**, the **Cloudflare Worker**, and the **React Dashboard** (for login).
- If you deleted it: everything breaks — no data, no login, no app.

### **Hono API** (`api/src/`)
- A Node.js web server (the program that listens for requests from the internet and responds) built with the Hono framework (a lightweight library for building APIs). This is the "brain" that handles all artist-facing operations: creating pages, managing email templates, sending emails, analytics, broadcasts, and more.
- Talks to: **Supabase** (reads/writes data), **Cloudflare R2** (uploads capture page HTML and QR codes), **Resend** (sends emails), and the **React Dashboard** (receives requests from the frontend).
- If you deleted it: artists can't manage anything — no dashboard data, no email sending, no page building.

### **Cloudflare Worker** (`worker/src/index.ts`)
- A serverless function (code that runs on Cloudflare's edge servers, close to wherever the fan is) that does two things: serves the fan-facing capture page HTML from R2 storage (a file storage bucket, like a folder in the cloud), and handles the form submission when a fan enters their email.
- Talks to: **Cloudflare R2** (reads the HTML file), **Supabase** (writes the fan capture data and queues emails, using the `service_role` key which bypasses security rules).
- If you deleted it: fans can't see capture pages or submit their emails — the entire fan-facing side goes dark.

### **React Dashboard** (`web/src/`)
- A single-page application (an app that runs entirely in the browser, like Gmail) built with React, TanStack Router (file-based page routing), and TanStack Query (a library that fetches data from the API and caches it so the app feels fast). This is what artists see when they log in.
- Talks to: **Supabase** (for authentication only — login/logout), and the **Hono API** (for everything else — fetching pages, fans, analytics, etc., via the **API Client**).
- If you deleted it: artists have no way to interact with the system — no UI at all.

### **API Client** (`web/src/lib/api.ts`)
- A thin wrapper (a small helper file) that attaches the artist's auth token (a temporary password proving they're logged in) to every request sent to the Hono API. Also handles token refresh (getting a new temporary password before the old one expires).
- Talks to: **Supabase** (to get/refresh the auth token), and the **Hono API** (sends every API call).
- If you deleted it: the dashboard can't talk to the API — every page would show errors.

### **Auth Middleware** (`api/src/middleware/auth.ts`)
- This is like a bouncer at a club door — every request to a protected API endpoint (a URL that requires login) passes through here first. It checks the auth token, looks up (or creates) the artist record in the database, and attaches the artist's info to the request so downstream code knows who's asking.
- Talks to: **Supabase** (validates the token and fetches/creates the artist row).
- If you deleted it: every authenticated API call returns 401 Unauthorized (a "you're not allowed" error) — the dashboard is useless.

### **Build Page** (`api/src/lib/build-page.ts`) and **Capture Template** (`api/src/lib/capture-template.ts`)
- The page builder fetches a capture page's settings from the database, generates a self-contained HTML file (under 14KB — small enough to load instantly on a slow phone), and uploads it to R2 storage. The capture template is the function that actually produces the HTML string with all the styling, fonts, colors, and the email form baked in.
- Talks to: **Supabase** (reads page settings), **Cloudflare R2** (uploads the built HTML + QR code).
- If you deleted it: capture pages would never get created or updated — fans would see "not found" pages.

### **EmailService / ResendEmailService** (`api/src/lib/email/`)
- An abstraction layer (a wrapper that hides the details of a specific email provider) around Resend (the email-sending service). Handles sending individual emails and batches, checks the suppression list (a "do not email" list of bounced/unsubscribed addresses), adds unsubscribe headers (metadata that lets email clients show a one-click unsubscribe button), and appends a CAN-SPAM footer (legally required contact info at the bottom of every email).
- Talks to: **Resend** (sends the actual emails), **Supabase** (reads/writes the suppression list).
- If you deleted it: no emails get sent — follow-ups and broadcasts silently fail.

### **Send-Batch Route** (`api/src/routes/send-batch.ts`)
- The email dispatch engine. Called every minute by pg_cron (a Postgres-based scheduler, like a recurring alarm clock inside the database) via an HTTP request. It atomically claims (grabs exclusively, so no other process can grab the same ones) pending emails from the queue, resolves their templates, sends them through the **EmailService**, and updates their status.
- Talks to: **Supabase** (claims and updates pending emails, fetches templates/artists/broadcasts), **EmailService** (sends the emails).
- If you deleted it: emails queue up forever and never get sent.

### **Email Webhook Handler** (`api/src/routes/email.ts`)
- Receives event notifications (webhooks — automated messages from Resend) when emails bounce, get complained about, are delivered, or are opened. Updates the database accordingly — marking emails as delivered, recording open timestamps, or adding addresses to the suppression list.
- Talks to: **Resend** (receives webhook events), **Supabase** (updates pending_emails, adds suppressions).
- If you deleted it: bounced emails keep getting retried, unsubscribes don't work, and open tracking stops.

### **Email Templates Route** (`api/src/routes/email-templates.ts`)
- CRUD (Create, Read, Update, Delete) endpoints for email sequences (drip campaigns — a series of emails sent at increasing intervals). Each capture page can have up to 5 steps (numbered 0-4). Step 0 is the welcome email with flexible timing; steps 1+ are sent at 9am on configurable day offsets.
- Talks to: **Supabase** (reads/writes the `email_templates` table).
- If you deleted it: artists can't create or edit follow-up email content.

### **Broadcasts Route** (`api/src/routes/broadcasts.ts`)
- Manages one-off email blasts (a single email sent to many fans at once) with segment filtering (targeting a subset of fans by page, date, or capture method). Handles the full lifecycle: draft, preview, count recipients, send (which enqueues into `pending_emails`), and archive.
- Talks to: **Supabase** (reads/writes the `broadcasts` table, queries fans, inserts into `pending_emails`), **EmailService** (indirectly, via `send-batch`).
- If you deleted it: artists can't send one-off emails to their fan list.

### **Captures Route** (`api/src/routes/captures.ts`)
- Serves the fan list with filtering (by page, method, date, email search) and CSV export. This is the data source for the "Fans" tab in the dashboard.
- Talks to: **Supabase** (queries `capture_events` joined with `fan_captures` and `capture_pages`).
- If you deleted it: the Fans tab shows nothing and CSV export breaks.

### **Analytics Route** (`api/src/routes/analytics.ts`)
- Aggregates capture data into stats: total fans, captures this week, per-show breakdowns (grouped by the page title snapshot — the title at the time of capture), daily time series (a day-by-day count for charts), method breakdowns (QR vs SMS vs NFC vs direct), and email open rates.
- Talks to: **Supabase** (queries `capture_events`, `fan_captures`, `pending_emails`, `email_templates`).
- If you deleted it: the Dashboard overview and Analytics tab show no data.

### **Capture Pages Route** (`api/src/routes/capture-pages.ts`)
- CRUD for capture pages themselves — create, list, get, update, delete. On create/update, it triggers a background page build (regenerates the HTML file). Also serves QR code images (generating them on the fly if they don't exist in R2 yet).
- Talks to: **Supabase** (reads/writes `capture_pages`), **Build Page** (regenerates HTML), **Cloudflare R2** (reads/deletes QR codes).
- If you deleted it: artists can't create or manage their capture pages.

### **Incentive Route** (`api/src/routes/incentive.ts`)
- Handles file uploads for "incentive files" (free downloads artists offer fans, like an unreleased track or a PDF). Generates signed upload URLs (temporary links that allow a file to be uploaded directly to storage), saves file metadata, and generates download page URLs.
- Talks to: **Supabase Storage** (creates signed upload/download URLs), **Supabase** (updates page metadata), **Download Token** (generates HMAC-signed tokens).
- If you deleted it: artists can't attach bonus files to their capture pages.

### **Download Route** (`api/src/routes/download.ts`) and **Download Token** (`api/src/lib/download-token.ts`)
- A public (no login required) route that serves a branded download page when fans click the "Download Your Bonus" link in emails. The token encodes the capture page ID and a 7-day expiry, signed with HMAC (a cryptographic signature that prevents tampering). The page renders with the artist's color scheme and provides a direct download link.
- Talks to: **Supabase** (reads page data and generates signed storage URLs), **Download Token** (verifies the HMAC signature and expiry).
- If you deleted it: fans can't download incentive files from emails.

### **SMS Keywords Route** (`api/src/routes/sms-keywords.ts`)
- Manages text-to-join keywords (short words fans can text to a phone number to get added to the email list). CRUD with availability checking, reserved word blocking (STOP, HELP, etc.), and suggestions when a keyword is taken.
- Talks to: **Supabase** (reads/writes the `sms_keywords` table).
- If you deleted it: artists can't set up or manage SMS keywords.

### **Settings Route** (`api/src/routes/settings.ts`)
- Gets and updates the artist's profile (name, timezone, onboarding status). Simple but critical — the timezone determines when follow-up emails are sent.
- Talks to: **Supabase** (reads/writes the `artists` table).
- If you deleted it: onboarding breaks, and timezone-based email scheduling uses the wrong time.

### **R2 Client** (`api/src/lib/r2.ts`)
- A configured S3 client (an AWS-compatible file storage library) pointing at Cloudflare R2. Used by the build system to upload HTML pages and QR codes.
- Talks to: **Cloudflare R2** (uploads/reads files).
- If you deleted it: page builds and QR code generation fail.

---

## 3. The Flow Map

### Flow 1: Fan submits their email at a show

1. Fan scans a QR code or visits `afterset.net/c/{slug}` on their phone.
2. **Cloudflare Worker** (`worker/src/index.ts` > `servePage()`) receives the GET request, reads the HTML file from **R2** at key `c/{slug}/index.html`, and serves it.
3. Fan types their email and taps "Submit." The form POSTs to `/api/capture` on the same Worker.
4. **Cloudflare Worker** (`worker/src/index.ts` > `handleCapture()`) validates the email, rate-limits by IP, and looks up the capture page by slug via **Supabase** REST API (`supabaseRpc()`).
5. Worker upserts (inserts or updates) into `fan_captures` — if the fan already exists for this artist, it updates `last_captured_at`; otherwise it creates a new fan record.
6. Worker inserts a `capture_events` row with the entry method (QR, NFC, SMS, or direct) and a `page_title` snapshot (the page's current title, frozen in time for per-show tracking).
7. Worker fetches all active `email_templates` for this page and the artist's timezone, then calls `queueSequenceEmails()` — which inserts one `pending_emails` row per template, each with a calculated `send_at` timestamp.
8. Worker returns `{ ok: true }` to the fan's browser, which shows a "Thank you" message.
9. Later (within 1 minute), pg_cron fires an HTTP POST to `/api/emails/send-batch`.
10. **Send-Batch** (`api/src/routes/send-batch.ts`) calls `claim_pending_emails()` (a Postgres function using `FOR UPDATE SKIP LOCKED` — an atomic lock that prevents two overlapping cron runs from grabbing the same emails), resolves templates, and sends via **ResendEmailService** (`api/src/lib/email/resend-service.ts` > `sendBatch()`).
11. Resend delivers the email to the fan's inbox.

### Flow 2: Artist signs up and creates their first capture page

1. Artist visits the dashboard and lands on `/login` (`web/src/routes/login.tsx` > `LoginPage`).
2. Artist enters their email and clicks "Send magic link," which calls `signInWithMagicLink()` in `web/src/lib/auth.ts`, which calls `supabase.auth.signInWithOtp()`.
3. **Supabase Auth** sends a magic link email. Artist clicks it, and Supabase redirects back to the app with a session token (a temporary credential proving they're logged in).
4. `initAuth()` in `web/src/lib/auth.ts` picks up the session via `supabase.auth.onAuthStateChange()` and stores the user.
5. TanStack Router's `_authenticated` layout (`web/src/routes/_authenticated.tsx` > `beforeLoad`) checks for a user, then fetches `/api/settings` to see if onboarding is complete.
6. **Auth Middleware** (`api/src/middleware/auth.ts` > `auth`) intercepts the settings request, validates the token with Supabase, doesn't find an existing artist record, so it **creates one** (inserts into `artists` table with name derived from email).
7. The settings response shows `onboarding_completed: false`, so the router redirects to `/onboarding`.
8. **Onboarding** (`web/src/routes/onboarding.tsx` > `OnboardingPage`) walks through 4 steps: Profile (set name + timezone via PATCH `/api/settings`), First Page (uses the `PageForm` component which POSTs to `/api/capture-pages`), Follow-Up Email (PUTs to `/api/capture-pages/:id/email-sequence/0`), and Ready (downloads QR code, then PATCHes `/api/settings` with `onboarding_completed: true`).
9. During page creation, **Capture Pages Route** (`api/src/routes/capture-pages.ts` > POST `/`) inserts the page into the database, then fires `buildPage()` in the background.
10. **Build Page** (`api/src/lib/build-page.ts` > `buildPage()`) fetches the page data, calls `generateCaptureHtml()` from `api/src/lib/capture-template.ts`, and uploads the resulting HTML + QR code to **R2** via the **R2 Client** (`api/src/lib/r2.ts`).
11. Artist arrives at `/dashboard` — their page is live, QR code is ready to print.

### Flow 3: Artist sends a broadcast email to all fans

1. Artist goes to the Emails tab (`web/src/routes/_authenticated/emails.tsx` > `EmailsPage`) and clicks "New Broadcast."
2. Frontend calls `api.post("/broadcasts", {})` which hits **Broadcasts Route** (`api/src/routes/broadcasts.ts` > POST `/`) — creates a draft broadcast row in the database.
3. Artist fills in subject, body, and optionally filters (specific pages, date range, capture method) in the `BroadcastComposeDialog` (`web/src/components/broadcast-compose-dialog.tsx`), which auto-saves via PUT `/broadcasts/:id`.
4. Artist clicks "Review" — frontend calls POST `/broadcasts/:id/recipients`, which runs `queryRecipients()` in the broadcasts route to count matching fans minus suppressed emails, returning `{ total, suppressed, reachable }`.
5. Artist clicks "Send" — frontend calls POST `/broadcasts/:id/send`.
6. **Broadcasts Route** (`api/src/routes/broadcasts.ts` > POST `/:id/send`) calls `queryRecipients()` again, filters out suppressed addresses via `filterSuppressed()` in `api/src/lib/email/suppression.ts`, then inserts one `pending_emails` row per reachable fan (with `broadcast_id` set), and updates the broadcast status to "sending."
7. Within 1 minute, pg_cron triggers **Send-Batch** (`api/src/routes/send-batch.ts`), which claims and sends the broadcast emails through **ResendEmailService**, then updates `broadcasts.sent_count`.
8. As fans open emails, Resend fires `email.opened` webhooks to **Email Webhook Handler** (`api/src/routes/email.ts` > `handleEmailOpened()`), which updates `pending_emails.opened_at` and increments `broadcasts.opened_count`.

---

## 4. The Data Story

All data lives in a **Supabase Postgres database** (a hosted relational database — think of it as a collection of interconnected spreadsheets with strict rules about what goes where). Files (capture page HTML, QR codes) live in **Cloudflare R2** (cloud file storage). Incentive files (bonus downloads for fans) live in **Supabase Storage** (another file storage system attached to the database).

### The main tables and how they connect

- An **artist** has many **capture_pages** (an artist can have one page or several, each with a unique URL slug).
- An **artist** has many **fan_captures** (the deduplicated fan roster — one row per unique email address per artist, regardless of how many times they signed up).
- A **fan_capture** has many **capture_events** (every individual sign-up interaction — if the same fan signs up at three shows, that's three events but one fan_capture). Each event records the `entry_method` (QR, NFC, SMS, or direct link) and a `page_title` snapshot (the page's title at that moment, so "Austin March 28" stays even if the artist later renames the page to "Nashville April 5").
- A **capture_event** belongs to one **capture_page** (nullable — if the page is deleted, the event keeps its `page_title` snapshot and the `capture_page_id` becomes null, preserving all historical data).
- A **capture_page** has many **email_templates** (up to 5, ordered by `sequence_order` 0-4). Step 0 is the welcome email; steps 1+ are follow-ups sent at 9am on configurable day delays.
- A **capture_page** optionally has one **sms_keyword** (a text-to-join keyword like "BANDNAME" that fans can text to a phone number).
- An **artist** has many **pending_emails** (the email queue — every email that needs to be sent, has been sent, or failed). Each pending email links to a `fan_capture`, and optionally to an `email_template` (for sequence emails) or a `broadcast` (for one-off blasts).
- An **artist** has many **broadcasts** (one-off email campaigns with lifecycle states: draft, scheduled, sending, sent). Each broadcast has segment filters and denormalized stats (recipient count, sent count, opened count).
- An **artist** has an **email_suppression_list** (emails that should never be contacted again — hard bounces, spam complaints, or manual unsubscribes).
- An **artist** optionally has **device_tokens** (push notification tokens from the native iOS/Android app, one per device).

### How data flows through the tables

When a fan signs up: `fan_captures` (upsert) -> `capture_events` (insert) -> `pending_emails` (insert one per active template).

When emails are sent: `pending_emails` (claimed by send-batch) -> Resend API -> `pending_emails` (status updated to sent/failed).

When an email bounces: Resend webhook -> `email_suppression_list` (insert) + `pending_emails` (status = failed).

When a page is deleted: `capture_pages` row is removed, `capture_events.capture_page_id` becomes null (but `page_title` snapshot survives), `fan_captures` and all history are preserved.

---

## 5. The Daily Health Check

A 5-minute sweep you can do from your laptop. Think of it like checking the oil, tires, and lights before a road trip.

### Is the email queue draining?

- **Where to look:** Hit the health endpoint (the API's self-diagnostic URL) at `GET /api/health` on your deployed API (e.g., `https://api.afterset.net/api/health`). You can also query the `pending_emails` table directly in the Supabase dashboard (the web UI for your database) — filter by `status = 'pending'` and `send_at < now() - interval '1 hour'`.
- **Healthy:** The health endpoint returns `{ "status": "ok" }`. If you look at the table, there are zero (or very few) rows with `status = 'pending'` whose `send_at` is more than a few minutes in the past — emails are being picked up and sent promptly.
- **Broken:** The health endpoint returns `{ "status": "degraded", "stuck_emails": 47 }`, or you see a pile of `pending` rows with `send_at` timestamps from hours ago. This means pg_cron (the recurring alarm clock) isn't firing or the send-batch endpoint is failing — check the Railway logs (the hosting platform's log viewer) for `[send-batch]` output and the Supabase dashboard's "Cron Jobs" section to confirm the job is scheduled.

### Are capture pages loading?

- **Where to look:** Open one of your live capture page URLs in a browser or curl it — e.g., `https://afterset.net/c/your-slug`. Also check the Cloudflare dashboard's R2 section to confirm the file exists at `c/your-slug/index.html`.
- **Healthy:** The page loads instantly with the artist's colors, title, and an email form. The response includes a `Content-Type: text/html` header and a `Cache-Control` header.
- **Broken:** You see a "Page not found" screen (the `notFound()` response in `worker/src/index.ts`), which means the HTML file is missing from R2. Trigger a rebuild from the dashboard (page card dropdown > Edit > save) or hit `POST /api/capture-pages/:id/build` to regenerate it.

### Is the cron job firing?

- **Where to look:** In the Supabase dashboard, go to "Database" > "Extensions" and confirm `pg_cron` is enabled. Then go to "SQL Editor" and run `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;` to see recent runs. Also check Railway logs for `[send-batch]` lines with timestamps.
- **Healthy:** You see a new row in `cron.job_run_details` every 1 minute (or whatever interval is configured), with `status = 'succeeded'`. Railway logs show periodic `[send-batch] 0 sent, 0 failed, 0 skipped` entries even when there's nothing to send.
- **Broken:** No recent rows in `cron.job_run_details`, or rows with `status = 'failed'`. This means the pg_cron job is missing or the HTTP call to send-batch is failing — re-check the cron job definition in the Supabase SQL editor (look at migration `20260323400000_pg_cron_email_jobs.sql` for what it should look like) and verify the `BATCH_SEND_SECRET` environment variable (a shared password between cron and the API) matches in both Supabase and Railway.

### Are webhooks being received?

- **Where to look:** In the Resend dashboard (the email provider's web UI), go to "Webhooks" and check the delivery log for your endpoint (`https://api.afterset.net/api/email/webhooks/resend`). Also query `pending_emails` for recent rows where `status = 'sent'` — they should have a non-null `provider_message_id` (the ID Resend gives each email) and, for opened emails, a non-null `opened_at` timestamp.
- **Healthy:** Resend's webhook log shows `200 OK` responses for recent deliveries. You see `opened_at` timestamps on some sent emails (not all — many people don't load images, which is how open tracking works).
- **Broken:** Resend's webhook log shows `401` or `500` errors, or no attempts at all. Check that `RESEND_WEBHOOK_SECRET` (the cryptographic key Resend uses to sign webhook payloads) is set correctly in your API environment. If webhook events are missing entirely, verify the webhook is configured in Resend's dashboard to send `email.bounced`, `email.complained`, `email.delivered`, and `email.opened` events.

### Are there suppression list surprises?

- **Where to look:** Query `email_suppression_list` in the Supabase dashboard. Sort by `created_at DESC` to see the most recent additions. Pay attention to the `reason` column (hard_bounce, complaint, or manual_unsubscribe).
- **Healthy:** A small, slowly growing list — mostly `manual_unsubscribe` entries (fans who clicked the unsubscribe link). A few `hard_bounce` entries from typos (e.g., `fan@gmial.com`) are normal.
- **Broken:** A sudden spike of `hard_bounce` or `complaint` entries (dozens in a single day). This could mean your sending domain (send.afterset.net) has a DNS or reputation issue — check Resend's "Domains" page for authentication status, and pause sending until you investigate to avoid getting your domain blacklisted (permanently banned by email providers).

---

## 6. The "Where Do I Look?" Quick Reference

### "I want to see why an email didn't send"

- **`api/src/routes/send-batch.ts`** — the entire file is the send pipeline. Start at the `pendingRows` query to see if the email was claimed, then follow the `sendable` / `skippedIds` logic to see if it was skipped (missing template, inactive template, or no artist record). Check the `skippedIds` array — if a pending email lands here, its status gets set to `failed` with no retry. If the email was sendable but the Resend API call threw, look at the `catch` block that calls `increment_retry_count`.
- **`api/src/lib/email/suppression.ts` > `isSuppressed()` / `filterSuppressed()`** — if the fan's email is on the `email_suppression_list` table, the email will be silently skipped (returned as `status: "suppressed"` by `ResendEmailService`). Query the suppression table in Supabase to check.
- **`pending_emails` table** — look at the specific row: `status` tells you what happened (`pending` = not yet picked up, `sending` = claimed but not finished, `sent` = delivered, `failed` = gave up). `retry_count` tells you how many times it was attempted.

### "I want to debug a capture page that won't load"

- **`worker/src/index.ts` > `servePage()`** — this is what runs when a fan visits `/c/{slug}`. It reads from R2 at key `c/{slug}/index.html`. If the file doesn't exist in R2, it returns a "Page not found" HTML response via the `notFound()` function.
- **`api/src/lib/build-page.ts` > `buildPage()`** — this is what creates the HTML file and uploads it to R2. If this function failed silently (it's called with `.catch(() => {})` after page creation/update), the file never made it to R2. Trigger a manual rebuild via `POST /api/capture-pages/:id/build` (see `api/src/routes/build.ts`).
- **`api/src/lib/capture-template.ts` > `generateCaptureHtml()`** — if the page loads but looks wrong (broken layout, missing colors), the bug is in this template function that generates the raw HTML string.

### "I want to check if a fan actually got captured"

- **`capture_events` table** — query by the fan's email using a join: `capture_events` joined to `fan_captures` on `fan_capture_id`, filtered by `fan_captures.email`. Each row is one sign-up interaction, with `captured_at`, `entry_method`, and `page_title` telling you when, how, and at which show.
- **`fan_captures` table** — query by `email` and `artist_id`. If the row exists, the fan was captured. `first_captured_at` and `last_captured_at` tell you the full timeline.
- **`worker/src/index.ts` > `handleCapture()`** — if you suspect the capture isn't going through at all, this is the function that processes the form POST. Check that the slug matches an active page (`is_active = true`) and that the email passes the regex validation (`EMAIL_RE`).

### "I want to change the look/feel of capture pages"

- **`api/src/lib/capture-template.ts` > `generateCaptureHtml()`** — this single function produces all the HTML, CSS, and inline JavaScript for every capture page. Style constants like `FONT_STACKS`, `BUTTON_RADIUS`, `TITLE_SIZES`, and `cssBackground()` control the visual options. Edit here to change fonts, colors, layouts, or add new style options.
- **`api/src/routes/capture-pages.ts` > `createSchema`** — the Zod schema (a validation rule definition) that defines which style fields are accepted when creating or updating a page. If you add a new style option to the template, you also need to add it here so the API accepts it.
- **`supabase/migrations/`** — if your new style option needs a new database column (a new field in the spreadsheet), you'll need a migration (a SQL file that alters the table). Look at `20260325200000_capture_page_style_options.sql` for how previous style columns were added.

### "I want to understand why email open rates seem wrong"

- **`api/src/routes/email.ts` > `handleEmailOpened()`** — open tracking works via a tiny invisible image (a tracking pixel) that Resend embeds in each email. When the recipient's email client loads images, Resend fires an `email.opened` webhook, and this function writes `opened_at` on the `pending_emails` row. Open rates will always be undercounted because many email clients block images by default (Apple Mail, for example, sometimes prefetches images via a proxy, which can also over-count).
- **`api/src/routes/analytics.ts` > GET `/` and GET `/:id/analytics`** — the open rate calculation is `emailOpened / emailSent`. Check that `emailSent` only counts rows with `status = 'sent'` (it does), and that `emailOpened` only counts rows where `opened_at IS NOT NULL` (it does). If rates seem wrong, query `pending_emails` directly to see the raw numbers.
- **`pending_emails` table** — filter by `status = 'sent'` for a given artist and check how many have `opened_at` filled in vs null. Remember: `opened_at` is only set once (the `IS NULL` guard in `handleEmailOpened()` prevents double-counting), so reopens don't inflate the number.

### "I want to add or change an API endpoint"

- **`api/src/routes/`** — each file in this directory is a Hono route module (a self-contained group of related endpoints). Pick the file that matches your domain: `captures.ts` for fan data, `broadcasts.ts` for email blasts, `analytics.ts` for stats, etc.
- **`api/src/index.ts`** — the main entry point that mounts (connects) all route modules to their URL paths. If you create a new route file, you need to import it here and call `app.route("/api/your-path", yourModule)`. Note the pattern: routes that need login have `app.use("/api/your-path", auth)` registered before the route.
- **`api/src/middleware/auth.ts` > `auth`** — if your new endpoint needs to know who the artist is, make sure the `auth` middleware (the bouncer) is applied to its path. The artist object is then available via `c.get("artist")` inside your route handler (the function that processes the request).

### "I want to figure out why login isn't working"

- **`web/src/lib/auth.ts` > `signInWithMagicLink()` and `initAuth()`** — `signInWithMagicLink()` calls `supabase.auth.signInWithOtp()`, which tells Supabase to send the magic link email. If the email never arrives, check the Supabase dashboard's "Authentication" > "Email Templates" and "SMTP" settings. `initAuth()` listens for auth state changes — if the redirect back from the magic link doesn't work, the `onAuthStateChange` callback might not be firing (check browser console for errors).
- **`web/src/routes/_authenticated.tsx` > `beforeLoad`** — this is the gate that redirects to `/login` if there's no user, or to `/onboarding` if onboarding isn't complete. If the artist keeps getting bounced back to login, the `fetchQuery` for `/api/settings` might be failing — open browser DevTools (the developer debugging panel) Network tab and look for a failing `/api/settings` request.
- **`api/src/middleware/auth.ts` > `auth`** — if the API returns 401 on every request, the token might be expired or malformed. This middleware calls `supabase.auth.getUser(token)` to validate — check that the Supabase URL and service role key are correct in the API's environment variables.

### "I want to see what the cron job is doing"

- **`supabase/migrations/20260323400000_pg_cron_email_jobs.sql`** — this migration defines the pg_cron schedule (the recurring timer). Open it to see the cron expression (how often it runs), the target URL, and the headers (including the `BATCH_SEND_SECRET`).
- **`api/src/routes/send-batch.ts` > POST `/send-batch`** — this is the endpoint that pg_cron calls. The function logs `[send-batch] X sent, Y failed, Z skipped, Nms` on every run. Check Railway logs for these lines to see exactly what happened in each batch.
- **`supabase/migrations/20260326000000_atomic_claim_pending_emails.sql`** — this defines the `claim_pending_emails()` Postgres function that atomically grabs pending emails for processing. If emails are stuck in `pending` status despite the cron running, the issue might be in this function's `WHERE` clause (it filters by `status = 'pending'` and `send_at <= now()`).

---

## 7. The Dependency Chain (What Breaks What)

These are the "domino lines" — the places where one failure knocks over everything behind it.

### Chain 1: Supabase goes down

**Supabase goes down** → Auth Middleware (the bouncer) can't validate tokens → every API endpoint returns 401 Unauthorized → Dashboard shows "Not authenticated" errors on every tab → Send-Batch can't claim pending emails, so email sending stops → Cloudflare Worker can't write to `fan_captures` or `capture_events`, so new fan submissions fail with 502 errors → **but** fans can still *see* cached capture pages (the HTML is served from R2, which is independent of Supabase)

### Chain 2: Railway (API hosting) goes down

**Railway goes down** → Hono API is unreachable → Dashboard can't fetch any data (pages, fans, analytics all fail) → pg_cron's HTTP call to `/api/emails/send-batch` fails, so all queued emails stop sending → Resend webhooks (bounces, opens) get rejected and Resend starts retrying (it will retry for up to 3 days) → **but** the Cloudflare Worker still serves capture pages and writes new captures directly to Supabase, so the fan-facing side keeps working

### Chain 3: Resend goes down

**Resend goes down** → `ResendEmailService.sendBatch()` (in `api/src/lib/email/resend-service.ts`) throws an error → Send-Batch catches it, increments `retry_count` on all affected `pending_emails`, and resets them to `pending` → emails queue up but don't send → open/delivery webhooks stop arriving, so `opened_at` stops updating and analytics freeze → **but** everything else works fine: captures, dashboard, page building, and the fan-facing pages are all unaffected because they don't touch Resend

### Chain 4: Cloudflare (R2 + Worker) goes down

**Cloudflare goes down** → the Worker can't serve capture pages, so fans see connection errors when they scan QR codes → the Worker can't process form submissions, so new captures fail → R2 is unreachable, so `buildPage()` (in `api/src/lib/build-page.ts`) fails when the API tries to upload new page HTML → QR code generation and page rebuilds silently fail → **but** the dashboard, API, email sending, and all existing data are unaffected because they run on Railway and Supabase, not Cloudflare

---

## 8. The "Don't Break This" List

### 1. The Worker and the API have separate Supabase clients with different permission levels

- **What it is:** The Cloudflare Worker (`worker/src/index.ts` > `supabaseRpc()`) talks to Supabase using raw `fetch` calls with the `SUPABASE_SERVICE_ROLE_KEY` (the all-access master key that bypasses Row Level Security). The Hono API (`api/src/lib/supabase.ts`) also uses `service_role` but through the official JS client. The frontend (`web/src/lib/supabase.ts`) uses the `VITE_SUPABASE_ANON_KEY` (the limited public key that respects RLS policies).
- **Why it's fragile:** If you accidentally put the `anon` key in the Worker or the `service_role` key in the frontend, you either break all fan captures (Worker can't write without service role) or expose full database access to anyone with browser DevTools (a massive security hole). There's no runtime check that catches the wrong key — it just silently fails or silently succeeds.
- **Safe way to change it:** Never move Supabase keys between services; always verify which key a service needs by checking whether it writes to tables that have RLS enabled (Row Level Security — database rules that restrict who can see/edit what).

### 2. The `buildPage()` fire-and-forget pattern

- **What it is:** In `api/src/routes/capture-pages.ts`, both the POST (create) and PATCH (update) handlers call `buildPage(data.id, artist.id).catch(() => {})` — the `.catch(() => {})` means if the page build fails (R2 is down, template has a bug), the error is silently swallowed and the API returns success to the artist.
- **Why it's fragile:** The artist sees "page saved" but the actual HTML in R2 is stale or missing. There's no error toast, no retry, no log entry in the API response. The only clue is that the live capture page shows old content or 404s.
- **Safe way to change it:** If you modify `generateCaptureHtml()` in `api/src/lib/capture-template.ts` or `buildPage()` in `api/src/lib/build-page.ts`, always test by hitting `POST /api/capture-pages/:id/build` and confirming the R2 file actually updates — don't rely on the create/update endpoint to tell you if the build succeeded.

### 3. The pg_cron job has hardcoded secrets in a SQL migration

- **What it is:** `supabase/migrations/20260323400000_pg_cron_email_jobs.sql` contains placeholder strings `RAILWAY_API_URL` and `BATCH_SEND_SECRET` that must be manually replaced with real values when the migration is applied.
- **Why it's fragile:** The migration file in git has placeholder values, not real ones. If you re-run migrations on a fresh Supabase instance (or if someone applies them literally), the cron job will call the wrong URL with the wrong secret, and you'll get silent 401 failures from the API. There's no validation that these placeholders were replaced.
- **Safe way to change it:** After applying this migration, always verify the cron job in the Supabase SQL editor with `SELECT * FROM cron.job;` and confirm the URL and secret are real production values, not the placeholders from the file.

### 4. The `UNIQUE(capture_event_id, email_template_id)` deduplication constraint

- **What it is:** In the `pending_emails` table, a unique constraint (a database rule that prevents duplicate rows) ensures the same email template is never queued twice for the same capture event. This is how returning fans get fresh emails on each new capture (per-event, not per-fan).
- **Why it's fragile:** The Worker's `queueSequenceEmails()` function in `worker/src/index.ts` inserts rows with `resolution=ignore-duplicates` — if the constraint is violated, the duplicate is silently dropped. If you change the constraint (e.g., make it per-fan instead of per-event), returning fans stop getting emails on subsequent captures, and nobody will notice because the failure is silent.
- **Safe way to change it:** Before modifying any unique constraint on `pending_emails`, trace every insert path — the Worker's `queueSequenceEmails()`, the broadcasts route's `POST /:id/send` in `api/src/routes/broadcasts.ts`, and any future insertion point — and confirm the dedup behavior matches your intent.

### 5. The `claim_pending_emails()` Postgres function lives outside the codebase

- **What it is:** The atomic claim function (defined in `supabase/migrations/20260326000000_atomic_claim_pending_emails.sql`) is a Postgres function that `send-batch.ts` calls via `supabase.rpc("claim_pending_emails")`. It uses `FOR UPDATE SKIP LOCKED` to prevent two overlapping cron runs from grabbing the same emails.
- **Why it's fragile:** This function exists only in the database, not in any TypeScript file. If you change the `pending_emails` table schema (add/remove columns, rename fields), this function might break with a cryptic Postgres error — and you won't see it until the next cron run. The `RETURNING *` means it returns every column, so a column rename silently changes what `send-batch.ts` receives.
- **Safe way to change it:** Whenever you alter the `pending_emails` table, also check and update `claim_pending_emails()` and `increment_retry_count()` (both live in migrations) — and test by calling `SELECT * FROM claim_pending_emails(1);` in the SQL editor.

### 6. The Wrangler route patterns control which URLs Cloudflare intercepts

- **What it is:** `worker/wrangler.toml` defines two route patterns: `afterset.net/c/*` (capture pages) and `afterset.net/api/capture` (form submissions). Only requests matching these patterns are handled by the Worker.
- **Why it's fragile:** If you add a new Worker endpoint (e.g., `/api/something-else`) but forget to add a route pattern in `wrangler.toml`, the request will bypass the Worker entirely and hit whatever is behind the domain (likely a 404 from Cloudflare Pages). Conversely, if you make the patterns too broad (e.g., `afterset.net/*`), the Worker will intercept dashboard traffic and API calls meant for Railway.
- **Safe way to change it:** Only add route patterns that are scoped to the exact paths the Worker needs — and always test with `wrangler dev` (the local Worker development server) before deploying.

### 7. The `page_title` snapshot is frozen at capture time, not updated retroactively

- **What it is:** When a fan submits their email, `handleCapture()` in `worker/src/index.ts` writes the capture page's *current* title into `capture_events.page_title`. This snapshot never changes, even if the artist renames the page later.
- **Why it's fragile:** If you write a migration or script that "fixes" page titles in `capture_events` to match the current `capture_pages.title`, you destroy the per-show segmentation data. The entire analytics system (`api/src/routes/analytics.ts` > GET `/`) groups captures by this snapshot title — overwriting it collapses all shows into one.
- **Safe way to change it:** Never bulk-update `capture_events.page_title` — it's a historical record, like a receipt, not a live reference.

### 8. The CORS origin list is hardcoded to localhost

- **What it is:** In `api/src/index.ts`, the CORS middleware (the rule that controls which websites can call your API) is set to `origin: ["http://localhost:5173"]`.
- **Why it's fragile:** In production, the API is deployed on Railway and the dashboard on Cloudflare Pages — the dashboard URL is not `localhost:5173`. If CORS isn't also configured at the infrastructure level (Railway's proxy or a broader origin setting), production API calls from the dashboard will be blocked by the browser with a confusing "CORS error" in the console.
- **Safe way to change it:** When deploying, ensure the production dashboard origin (e.g., `https://app.afterset.net`) is included in the CORS origin list, or configure Railway to handle CORS headers at the proxy level.

---

## 9. Maintenance Gotchas

### The `pending_emails` table grows forever

- **What will happen:** Every fan capture creates 1–5 `pending_emails` rows, and every broadcast adds one row per recipient. These rows are never deleted — `sent` and `failed` rows accumulate indefinitely. At scale (thousands of fans, weekly broadcasts), this table will have hundreds of thousands of rows, slowing down the `claim_pending_emails()` query and the analytics joins.
- **When to check:** Monthly, or when you notice the health endpoint reporting increased latency. Query `SELECT status, COUNT(*) FROM pending_emails GROUP BY status;` to see the breakdown.
- **How to fix it:** Create a cleanup migration that deletes (or moves to an archive table) `pending_emails` rows where `status IN ('sent', 'failed')` and `updated_at < now() - interval '90 days'`. Keep `pending` and `sending` rows untouched. Add an index on `(status, updated_at)` if the query gets slow.

### Resend plan limits

- **What will happen:** Resend Pro allows a certain number of emails per month (currently 50,000 on the $20/mo plan). If you exceed it, `ResendEmailService.sendBatch()` in `api/src/lib/email/resend-service.ts` will start throwing errors, and the `increment_retry_count` retry loop will burn through all 3 retries before marking emails as permanently failed.
- **When to check:** Monthly, or before sending a large broadcast. Check the Resend dashboard's "Usage" page.
- **How to fix it:** Upgrade the Resend plan, or implement a monthly send counter in the `broadcasts` route that warns artists before they exceed the limit. The `BATCH_LIMIT` constant (50 emails per cron run) in `api/src/routes/send-batch.ts` also acts as a natural throttle — don't raise it without checking your Resend rate limits.

### Supabase Storage fills up with orphaned incentive files

- **What will happen:** When an artist uploads a new incentive file to replace an old one, the old file is deleted (`deleteStorageFile()` in `api/src/routes/incentive.ts`). But if a capture page is deleted, its incentive file in Supabase Storage at path `{artist_id}/{page_id}/{filename}` is **not** cleaned up — the page delete handler in `api/src/routes/capture-pages.ts` only cleans up R2 files (HTML + QR), not Storage files.
- **When to check:** Quarterly, or if your Supabase Storage usage seems higher than expected.
- **How to fix it:** Add a step to the delete handler in `capture-pages.ts` that calls `supabase.storage.from("incentives").remove([page.incentive_file_path])` before deleting the page row. For existing orphans, list files in the `incentives` bucket and cross-reference with active `capture_pages.incentive_file_path` values.

### HMAC secrets have no rotation mechanism

- **What will happen:** `UNSUBSCRIBE_HMAC_SECRET` (used in `api/src/lib/email/unsubscribe-token.ts` > `createUnsubscribeToken()`) and `DOWNLOAD_HMAC_SECRET` (used in `api/src/lib/download-token.ts` > `createDownloadToken()`) are used to sign tokens embedded in emails. If a secret is compromised, anyone can forge unsubscribe or download tokens. But if you rotate (change) a secret, every previously-sent email's unsubscribe link and download link instantly breaks — there's no grace period or dual-key support.
- **When to check:** After any security incident, or annually as a best practice.
- **How to fix it:** To rotate safely, you'd need to modify `verifyUnsubscribeToken()` and `verifyDownloadToken()` to try both the old and new secret (accept either). Deploy with both secrets, wait for old emails to age out (download tokens expire after 7 days; unsubscribe tokens don't expire, so you'd need a longer window), then remove the old secret.

### Migration files accumulate and need manual application

- **What will happen:** New migrations in `supabase/migrations/` are not automatically applied to production — they must be pushed via `supabase db push` (a CLI command that applies pending migrations to the remote database). If someone adds a migration but forgets to push it, the API will reference columns or functions that don't exist yet, causing 500 errors.
- **When to check:** After every deploy, or whenever you see Postgres errors about missing columns/functions in Railway logs.
- **How to fix it:** Run `supabase db push` after merging any PR that includes new migration files. Consider adding this to a deploy checklist or CI pipeline. Check the Supabase dashboard's "Database" > "Migrations" tab to see which migrations have been applied.

### R2 cache can serve stale capture pages

- **What will happen:** The Worker sets `Cache-Control: public, max-age=3600, s-maxage=86400` on capture page responses (in `worker/src/index.ts` > `servePage()`). This means Cloudflare's CDN (Content Delivery Network — a global network of caching servers) can serve an old version of a capture page for up to 24 hours after an artist updates it. The artist sees their change in the dashboard, but fans might see the old page.
- **When to check:** Whenever an artist reports that their page update isn't showing.
- **How to fix it:** Purge the Cloudflare cache for the specific URL (`https://afterset.net/c/{slug}`) via the Cloudflare dashboard or API. For a code fix, consider reducing `s-maxage` or adding cache-busting logic (like a version query parameter) to `buildPage()`.

---

## 10. The Environment Variable Map

### Hono API (set in Railway dashboard, or `api/.env` locally)

| Variable | What it does | What breaks if wrong/missing |
|---|---|---|
| `SUPABASE_URL` | The URL of your Supabase project (e.g., `https://mnoajavdnawrmqsnbouy.supabase.co`). Used by `api/src/lib/supabase.ts` to connect to the database. | **App crashes on startup** — the Supabase client constructor throws immediately. |
| `SUPABASE_SERVICE_ROLE_KEY` | The all-access database key that bypasses Row Level Security (RLS). Used by the API's Supabase client for all database operations. | **App crashes on startup** — same as above. |
| `RESEND_API_KEY` | The API key for Resend (the email-sending service). Used by `api/src/lib/email/index.ts` > `getEmailService()`. | **All email sending fails** — `getEmailService()` throws "Missing RESEND_API_KEY" the first time send-batch runs. |
| `RESEND_WEBHOOK_SECRET` | The secret used to verify that incoming webhook (automated notification) payloads actually came from Resend, not an impersonator. Used in `api/src/routes/email.ts`. | **Webhooks return 401** — bounces, complaints, and open events are rejected, so the suppression list doesn't update and open tracking stops. |
| `BATCH_SEND_SECRET` | A shared password between pg_cron (the database scheduler) and the send-batch endpoint. pg_cron sends it in the `X-Batch-Secret` header; the API checks it in `api/src/routes/send-batch.ts`. | **All email sending fails silently** — pg_cron's requests get 401'd and emails queue forever. **This value MUST match** the one hardcoded in the pg_cron job definition in Supabase (see `supabase/migrations/20260323400000_pg_cron_email_jobs.sql`). |
| `UNSUBSCRIBE_HMAC_SECRET` | The cryptographic key used to sign and verify unsubscribe tokens (links in emails that let fans opt out). Used by `api/src/lib/email/unsubscribe-token.ts`. | **Unsubscribe links break** — `createUnsubscribeToken()` throws on every email send, which crashes the entire send-batch run. |
| `DOWNLOAD_HMAC_SECRET` | The cryptographic key used to sign and verify incentive download tokens (links in emails that let fans download bonus files). Used by `api/src/lib/download-token.ts`. | **Download links break** — `createDownloadToken()` throws when send-batch tries to generate incentive URLs, crashing the batch. Also breaks the `/download/:token` route for fans. |
| `CAN_SPAM_ADDRESS` | The physical mailing address appended to the footer of every email (legally required by the CAN-SPAM Act for commercial email in the US). Used by `api/src/lib/email/resend-service.ts` > `getAddress()`. | **Emails send without a postal address** — defaults to an empty string, which technically violates CAN-SPAM compliance. Won't crash anything, but could cause legal issues. |
| `API_BASE_URL` | The public-facing URL of the API server (e.g., `https://api.afterset.net`). Used to construct unsubscribe links and download page URLs in emails. | **Email links point to localhost** — defaults to `http://localhost:3000`, so unsubscribe and download links in production emails will be broken. |
| `TELNYX_API_KEY` | The API key for Telnyx (the SMS provider). Listed in `.env.example` but not yet referenced in code — reserved for future SMS webhook handling. | **Nothing breaks currently** — SMS keyword management works without it (it only needs the phone number). Will be needed when inbound SMS processing is implemented. |
| `TELNYX_PHONE_NUMBER` | The toll-free phone number used for text-to-join SMS keywords. Used by `api/src/routes/sms-keywords.ts` as the namespace for keyword uniqueness. | **Defaults to `+10000000000` (a placeholder)** — SMS keywords will be created with this fake number, and the "text KEYWORD to (000) 000-0000" instructions shown to artists will be wrong. |
| `SENTRY_DSN` | The Data Source Name for Sentry (an error-tracking service). Listed in `.env.example` but not yet wired into the codebase. | **Nothing breaks** — error tracking just won't be active. |
| `PORT` | The port the API server listens on. Used in `api/src/index.ts`. | **Defaults to `3000`** — only matters if Railway assigns a different port (Railway sets this automatically via its `PORT` env var). |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account identifier. Used by `api/src/lib/r2.ts` to construct the R2 endpoint URL. | **App crashes on startup** — the R2 client constructor throws immediately. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | The access key for R2 API authentication (like a username for the file storage). Used by `api/src/lib/r2.ts`. | **App crashes on startup** — same as above. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | The secret key for R2 API authentication (like a password for the file storage). Used by `api/src/lib/r2.ts`. | **App crashes on startup** — same as above. |
| `CLOUDFLARE_R2_BUCKET` | The name of the R2 bucket (storage container) where capture page HTML and QR codes are stored. Used by `api/src/lib/r2.ts`. | **Defaults to `afterset-capture-pages`** — only wrong if you renamed the bucket. Page builds would upload to the wrong (or nonexistent) bucket. |

### Cloudflare Worker (set in Cloudflare dashboard under Workers > Settings > Variables, or `wrangler.toml` for non-secrets)

| Variable | What it does | What breaks if wrong/missing |
|---|---|---|
| `SUPABASE_URL` | Same Supabase project URL as the API uses. Set in `wrangler.toml` under `[vars]`. The Worker uses it to make REST API calls to Supabase. | **All fan captures fail** — `supabaseRpc()` in `worker/src/index.ts` can't reach the database. **Must match** the `SUPABASE_URL` used by the API. |
| `SUPABASE_SERVICE_ROLE_KEY` | The all-access database key. Must be set as an **encrypted secret** in the Cloudflare dashboard (not in `wrangler.toml`, since that file is committed to git). The Worker uses it to bypass RLS when writing fan captures. | **All fan captures fail** — the Worker's Supabase REST calls return 401 or empty results. **Must be the same key** as the API's `SUPABASE_SERVICE_ROLE_KEY`. |
| `PAGES` (R2 binding) | Not an env var in the traditional sense — it's an R2 bucket binding (a connection between the Worker and a specific R2 bucket) defined in `wrangler.toml` under `[[r2_buckets]]`. Maps to `env.PAGES` in the Worker code. | **Capture pages return 404** — `servePage()` can't read HTML files from R2. |

### React Dashboard / Frontend (set in `web/.env` locally, or as build-time variables in Cloudflare Pages)

| Variable | What it does | What breaks if wrong/missing |
|---|---|---|
| `VITE_SUPABASE_URL` | The Supabase project URL, used by `web/src/lib/supabase.ts` to initialize the client-side Supabase client (for authentication only). | **App crashes on load** — the Supabase client constructor throws "Missing VITE_SUPABASE_URL." **Must match** the `SUPABASE_URL` used by the API and Worker. |
| `VITE_SUPABASE_ANON_KEY` | The public (anonymous) Supabase key that respects RLS policies. Used by `web/src/lib/supabase.ts`. This is the **safe** key to expose in the browser — it can only do what RLS allows. | **App crashes on load** — same as above. Do NOT put the `service_role` key here — it would give every browser user full database access. |
| `VITE_API_URL` | The base URL for API calls. **Not currently used in code** — the frontend's `api.ts` calls `/api/*` paths relative to the current origin, and Vite's dev server proxy (in `web/vite.config.ts`) forwards them to `localhost:3000`. In production, this routing is handled by the hosting infrastructure. | **Nothing breaks** — it's in `.env.example` for documentation purposes. If you switch to absolute API URLs in the frontend, you'd use this. |

### Supabase (set in the Supabase dashboard or SQL editor — not in any `.env` file)

| Variable | What it does | What breaks if wrong/missing |
|---|---|---|
| `RAILWAY_API_URL` (in pg_cron job) | The production URL of the Railway-hosted API (e.g., `https://api.afterset.net`). Hardcoded into the pg_cron job SQL (see `supabase/migrations/20260323400000_pg_cron_email_jobs.sql`). This is where pg_cron sends the HTTP POST to trigger email sending. | **Emails never send** — pg_cron calls the wrong URL and gets connection errors or 404s. |
| `BATCH_SEND_SECRET` (in pg_cron job) | The shared secret sent in the `X-Batch-Secret` header by pg_cron. Hardcoded into the cron job SQL. | **Emails never send** — the API's send-batch endpoint rejects the request with 401. **Must match** the `BATCH_SEND_SECRET` env var set in Railway. |

### Cross-service secrets that MUST match

These values are used by multiple services. If they don't match across all services, things break silently.

| Secret | Used by | What breaks if mismatched |
|---|---|---|
| `SUPABASE_URL` | API, Worker, Frontend (`VITE_SUPABASE_URL`) | Each service talks to a different (or nonexistent) database. |
| `SUPABASE_SERVICE_ROLE_KEY` | API, Worker | One service can write to the database, the other can't — fan captures or email sending silently fails. |
| `BATCH_SEND_SECRET` | API (Railway env var), pg_cron (hardcoded in Supabase SQL) | pg_cron's HTTP requests get 401'd, so the email queue never drains. The health endpoint will report `"status": "degraded"`. |
