-- Broadcast email campaigns
-- Artists can send one-off emails to their full fan list or segments

-- ============================================================
-- BROADCAST STATUS ENUM
-- ============================================================
create type broadcast_status as enum ('draft', 'scheduled', 'sending', 'sent', 'failed');

-- ============================================================
-- BROADCASTS TABLE
-- ============================================================
create table broadcasts (
	id uuid primary key default gen_random_uuid(),
	artist_id uuid not null references artists(id) on delete cascade,
	subject text not null default '' constraint broadcasts_subject_length check (char_length(subject) <= 200),
	body text not null default '' constraint broadcasts_body_length check (char_length(body) <= 5000),
	reply_to text,
	status broadcast_status not null default 'draft',
	scheduled_at timestamptz,
	-- Segment filters (all nullable = "all fans")
	filter_page_ids uuid[],
	filter_date_from timestamptz,
	filter_date_to timestamptz,
	filter_method text,
	-- Denormalized stats
	recipient_count integer not null default 0,
	sent_count integer not null default 0,
	opened_count integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index idx_broadcasts_artist on broadcasts(artist_id, created_at desc);
create index idx_broadcasts_scheduled on broadcasts(status, scheduled_at)
	where status = 'scheduled';

create trigger broadcasts_updated_at
	before update on broadcasts
	for each row execute function update_updated_at();

-- RLS
alter table broadcasts enable row level security;

create policy "broadcasts_select_own" on broadcasts
	for select using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "broadcasts_insert_own" on broadcasts
	for insert with check (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "broadcasts_update_own" on broadcasts
	for update using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "broadcasts_delete_own" on broadcasts
	for delete using (artist_id in (select id from artists where auth_id = auth.uid()));

-- ============================================================
-- ADD broadcast_id TO pending_emails
-- ============================================================
alter table pending_emails
	add column broadcast_id uuid references broadcasts(id) on delete set null;

create index idx_pending_emails_broadcast on pending_emails(broadcast_id)
	where broadcast_id is not null;

alter table pending_emails
	add constraint pending_emails_fan_broadcast_unique unique (fan_capture_id, broadcast_id);

-- ============================================================
-- pg_cron: flip scheduled broadcasts to sending
-- ============================================================
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
