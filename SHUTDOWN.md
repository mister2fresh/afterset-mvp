# Afterset — Shutdown & Startup Guide

Project paused 2026-04-27. All services downgraded to free/inactive. Data preserved.

---

## Part 1: Shutdown Checklist

Complete in this order. Each step depends on the previous.

### Step 1 — Database backup (before touching anything)

```bash
# From your Mac (OrbStack VM has access):
pg_dump --no-owner --no-acl \
  "postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  > afterset-backup-2026-04-27.sql

# Verify the dump isn't empty:
wc -l afterset-backup-2026-04-27.sql
# Should be hundreds/thousands of lines

# Store the backup somewhere safe (outside this repo):
cp afterset-backup-2026-04-27.sql ~/backups/
```

Find your connection string at: Supabase Dashboard → Settings → Database → Connection string (URI).

### Step 2 — Record pg_cron jobs (they'll be lost on downgrade)

These 4 jobs exist and will need to be re-registered on startup:

| Job | Schedule | What it does | Migration |
|-----|----------|-------------|-----------|
| `send-pending-emails` | `* * * * *` | HTTP POST to Railway API `/api/emails/send-batch` via pg_net + Vault secrets | `20260406100000_pg_cron_vault_secrets.sql` |
| `retry-failed-emails` | `*/5 * * * *` | Resets failed `pending_emails` rows to pending (max 3 retries) | `20260323400000_pg_cron_email_jobs.sql` |
| `activate-scheduled-broadcasts` | `* * * * *` | Flips broadcasts from `scheduled` → `sending` when `scheduled_at` is reached | `20260325000000_broadcasts.sql` |
| `purge-paused-emails` | `17 * * * *` | Deletes stale skip_reason rows (14d stale, 30d cap/locked/no_plan) | `20260414000000_paused_emails_auto_purge.sql` |

Job 1 reads two secrets from **Supabase Vault** at runtime: `railway_api_url` and `batch_send_secret`. You'll need to re-insert those Vault secrets on startup (see Startup Step 2).

### Step 3 — Record current env vars

Before deleting Railway, save a copy of your production env vars:

```bash
# Railway CLI (if installed):
railway variables --json > ~/backups/railway-env-2026-04-27.json

# Or manually: Railway Dashboard → afterset-api → Variables tab
# Screenshot or copy all key=value pairs to a secure note
```

**Worker secrets** (set via `wrangler secret put`):
- `SUPABASE_SERVICE_ROLE_KEY` — the only Worker secret not in wrangler.toml

**Supabase Vault secrets** (set via SQL in migration `20260406100000`):
- `railway_api_url` — Railway API base URL (e.g. `https://afterset-api-production.up.railway.app`)
- `batch_send_secret` — auth secret for the send-batch endpoint

### Step 4 — Downgrade Railway ($5/mo → $0)

Railway doesn't have a "pause" — you delete the service.

1. Go to Railway Dashboard → your project
2. Note the custom domain config (if `api.afterset.net` points here via CNAME)
3. **Delete the service** (not the project — keep the project shell if you want)
4. Data is in Supabase, not Railway — nothing is lost

### Step 5 — Downgrade Resend ($20/mo → $0)

1. Go to Resend Dashboard → Settings → Billing
2. Downgrade to Free tier (100 emails/day, keeps your domain)
3. Verify `send.afterset.net` domain still shows as verified after downgrade
4. Webhook endpoint (Railway) is already gone — Resend will get delivery failures on the webhook URL, which is fine (it doesn't retry forever)

### Step 6 — Downgrade Supabase ($25/mo → $0)

**This is the most consequential step.** Read carefully.

1. Go to Supabase Dashboard → Settings → Billing → downgrade to Free
2. **What you keep:** all tables, data, auth users, RLS policies, functions, storage buckets
3. **What you lose:**
   - pg_cron — all 4 scheduled jobs stop immediately
   - pg_net — HTTP calls from Postgres stop
   - Supabase Vault — secrets become inaccessible (but the extension stays installed)
   - Dedicated compute — shared infra, slower queries
4. **Auto-pause risk:** Free projects pause after **7 days of inactivity**. The database sleeps. It wakes on next connection but takes ~15s cold start. This is fine while paused — just be aware when you test things.
5. You're limited to **2 active free projects** across your Supabase org

### Step 7 — Telnyx (keep or release)

**Recommended: keep the number.** Toll-free verification takes weeks to re-do.

- Monthly cost for an idle toll-free number: ~$1–2
- If you must cut it: Telnyx Dashboard → Phone Numbers → release the number
- Record the number before releasing: stored in `TELNYX_PHONE_NUMBER` env var

### Step 8 — Cloudflare (no action needed)

Everything is free tier. Leave it running:

- **Worker** (`afterset-capture`): routes `afterset.net/c/*` and `/api/capture` — will return errors since Supabase is on shared infra but still responds. No cost.
- **R2 bucket** (`afterset-capture-pages`): stores capture page HTML. Free up to 10GB. Leave it.
- **KV namespace** (`RATE_LIMITS`, ID: `d57c197ba4a3412da1f5e6d0601cc21c`): rate limiting data. Free. Leave it.
- **Pages** (dashboard SPA): free. Leave it or it'll just 404 — either way, $0.
- **Domain** (`afterset.net`): annual registration, already paid. Renew when it comes up.

### Post-shutdown state

| Service | State | Monthly cost | Data preserved? |
|---------|-------|-------------|-----------------|
| Supabase | Free (may auto-pause) | $0 | Yes |
| Resend | Free | $0 | Yes (domain + logs) |
| Railway | Deleted | $0 | N/A (stateless) |
| Telnyx | Idle (or released) | $0–2 | Number preserved if kept |
| Cloudflare | Running (free) | $0 | Yes (R2 + KV + Worker) |
| **Total** | | **$0–2/mo** | |

---

## Part 2: Startup Checklist

Complete in this order when resuming.

### Step 1 — Upgrade Supabase (Free → Pro)

1. Supabase Dashboard → Settings → Billing → upgrade to Pro ($25/mo)
2. Wait for the upgrade to complete (usually instant)
3. Verify the project is unpaused and responsive:
   ```
   curl https://[PROJECT_REF].supabase.co/rest/v1/ -H "apikey: [ANON_KEY]"
   ```

### Step 2 — Re-register Vault secrets + pg_cron jobs

The migrations already ran — the schema is intact. But Vault secrets and cron jobs need to be re-inserted since pg_cron/Vault were unavailable on Free.

Run this in Supabase SQL Editor (Dashboard → SQL Editor):

```sql
-- 1. Re-insert Vault secrets (use your actual values)
SELECT vault.create_secret(
  'https://[YOUR-RAILWAY-URL]',
  'railway_api_url',
  'Railway API base URL for pg_cron email batch job'
);
SELECT vault.create_secret(
  '[YOUR-BATCH-SEND-SECRET]',
  'batch_send_secret',
  'Auth secret for email batch endpoint'
);

-- 2. Re-register pg_cron jobs
-- (Copied verbatim from migrations — do not modify)

-- Send pending emails (every minute, via pg_net + Vault)
-- Source: 20260406100000_pg_cron_vault_secrets.sql
SELECT cron.schedule(
  'send-pending-emails',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'railway_api_url') || '/api/emails/send-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Batch-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'batch_send_secret')
    ),
    body := '{}'::jsonb
  ) WHERE EXISTS (
    SELECT 1 FROM pending_emails
    WHERE status = 'pending' AND send_at <= now()
    LIMIT 1
  );
  $$
);

-- Retry failed emails (every 5 minutes)
-- Source: 20260323400000_pg_cron_email_jobs.sql
SELECT cron.schedule(
  'retry-failed-emails',
  '*/5 * * * *',
  $$
  UPDATE pending_emails
  SET status = 'pending', updated_at = now()
  WHERE status = 'failed'
    AND retry_count < 3
    AND updated_at < now() - interval '5 minutes';
  $$
);

-- Activate scheduled broadcasts (every minute)
-- Source: 20260325000000_broadcasts.sql
SELECT cron.schedule(
  'activate-scheduled-broadcasts',
  '* * * * *',
  $$
  UPDATE broadcasts
  SET status = 'sending'
  WHERE status = 'scheduled'
    AND scheduled_at <= now();
  $$
);

-- Purge paused emails (hourly at :17)
-- Source: 20260414000000_paused_emails_auto_purge.sql
SELECT cron.schedule(
  'purge-paused-emails',
  '17 * * * *',
  $$
  DELETE FROM pending_emails
  WHERE status = 'pending'
    AND skip_reason_at IS NOT NULL
    AND (
      (skip_reason = 'stale' AND skip_reason_at < now() - interval '14 days')
      OR
      (skip_reason IN ('email_cap', 'tier_locked', 'no_plan')
        AND skip_reason_at < now() - interval '30 days')
    );
  $$
);

-- 3. Verify all jobs registered
SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;
```

**Important:** Update the `batch_send_url` Vault secret with your new Railway URL after Step 3.

### Step 3 — Deploy Railway API

```bash
# From the repo root:
# 1. Create new Railway service (or redeploy into existing project)
railway login
railway init  # or link to existing project
railway up

# 2. Set all env vars (from your saved backup):
railway variables set SUPABASE_URL=...
railway variables set SUPABASE_SERVICE_ROLE_KEY=...
railway variables set RESEND_API_KEY=...
railway variables set RESEND_WEBHOOK_SECRET=...
railway variables set BATCH_SEND_SECRET=...
railway variables set UNSUBSCRIBE_HMAC_SECRET=...
railway variables set DOWNLOAD_HMAC_SECRET=...
railway variables set CAN_SPAM_ADDRESS=...
railway variables set API_BASE_URL=https://[your-railway-domain]
railway variables set TELNYX_API_KEY=...
railway variables set TELNYX_PHONE_NUMBER=...
railway variables set CLOUDFLARE_ACCOUNT_ID=...
railway variables set CLOUDFLARE_R2_ACCESS_KEY_ID=...
railway variables set CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
railway variables set CLOUDFLARE_R2_BUCKET=afterset-capture-pages
railway variables set NODE_ENV=production
railway variables set CORS_ORIGINS=https://app.afterset.net

# 3. Set up custom domain (if using api.afterset.net):
#    Railway Dashboard → service → Settings → Domains → add api.afterset.net
#    Then update CNAME in Cloudflare DNS to point to Railway's provided target

# 4. Verify:
curl https://[your-railway-url]/api/health
```

### Step 4 — Update Vault secret with new Railway URL

After Railway is live, update the Vault secret so pg_cron can reach it:

```sql
-- In Supabase SQL Editor:
-- First, delete the old secret:
DELETE FROM vault.secrets WHERE name = 'railway_api_url';

-- Then create with the new Railway URL (base URL only, no path):
SELECT vault.create_secret(
  'https://[NEW-RAILWAY-URL]',
  'railway_api_url',
  'Railway API base URL for pg_cron email batch job'
);
```

### Step 5 — Upgrade Resend (Free → Pro)

1. Resend Dashboard → Billing → upgrade to Pro ($20/mo)
2. Verify `send.afterset.net` domain is still verified
3. Re-add webhook endpoint: Resend Dashboard → Webhooks → add `https://[railway-url]/api/email/webhook`
4. Select events: `email.delivered`, `email.bounced`, `email.complained`, `email.opened`

### Step 6 — Update Cloudflare Worker secret

```bash
# The Worker's SUPABASE_SERVICE_ROLE_KEY secret persists in Cloudflare,
# but if Supabase rotated it during downgrade/upgrade, update it:
cd worker
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Paste the key when prompted
```

### Step 7 — Verify Telnyx (if kept)

1. Confirm the toll-free number is still active in Telnyx Dashboard
2. Verify the webhook URL points to new Railway: `https://[railway-url]/api/sms/inbound`
3. Update if needed in Telnyx Dashboard → Messaging → your messaging profile

### Step 8 — Rebuild and deploy capture pages

The R2 bucket still has the old HTML, but if anything changed:

```bash
# Hit the build endpoint to regenerate all capture pages to R2:
curl -X POST https://[railway-url]/api/build \
  -H "Authorization: Bearer [your-auth-token]"
```

### Step 9 — Smoke test

Run through this checklist to verify everything is wired up:

- [ ] Dashboard loads at `app.afterset.net` (or localhost:5173 for dev)
- [ ] Login via magic link works (Supabase Auth)
- [ ] Capture pages load at `afterset.net/c/[slug]`
- [ ] Fan capture form submission works (Worker → Supabase)
- [ ] Follow-up email sends within 1–2 minutes (pg_cron → Railway → Resend)
- [ ] Email open tracking works (Resend webhook → Railway → Supabase)
- [ ] SMS keyword reply works (Telnyx webhook → Railway → Supabase)
- [ ] Broadcasts can be created and sent
- [ ] Incentive file upload + download page works

---

## Quick Reference: What Lives Where

| Data | Location | Survives shutdown? |
|------|----------|-------------------|
| All Postgres tables + data | Supabase (free, may auto-pause) | Yes |
| Auth users + sessions | Supabase Auth | Yes |
| Capture page HTML files | Cloudflare R2 | Yes |
| Rate limit state | Cloudflare KV | Yes (ephemeral anyway) |
| Email send logs | Resend dashboard | Yes |
| Source code | GitHub (`mister2fresh/afterset-mvp`) | Yes |
| Env vars / secrets | **Your local backup** | Only if you saved them |
| Vault secrets (`railway_api_url`, `batch_send_secret`) | Lost on downgrade | **Must re-create** |
| pg_cron job registrations (4 jobs) | Lost on downgrade | **Must re-create** |

---

## Git State at Shutdown

- **Active branch:** `sprint-5-pricing-tiers` (pushed, clean)
- **Last commit:** `fcc57d8` — paused emails drill-down + pg_cron auto-purge
- **Not merged to main:** All Sprint 5 work (Phases 1–4 + QA fixes)
- **Stale branches (can delete):** `feat/dashboard-tonight-api-components`, `feat/inline-sequence-editor-and-email-icons`
