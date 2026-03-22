-- Sprint 1: Core Capture Flow schema
-- Tables: artists, capture_pages, fan_captures, capture_events, pending_emails, email_suppression_list

-- ============================================================
-- ARTISTS
-- ============================================================
create table artists (
	id uuid primary key default gen_random_uuid(),
	auth_id uuid not null unique references auth.users(id) on delete cascade,
	name text not null,
	email text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index idx_artists_auth_id on artists(auth_id);

alter table artists enable row level security;

create policy "artists_select_own" on artists
	for select using (auth.uid() = auth_id);

create policy "artists_update_own" on artists
	for update using (auth.uid() = auth_id);

-- ============================================================
-- CAPTURE PAGES
-- ============================================================
create table capture_pages (
	id uuid primary key default gen_random_uuid(),
	artist_id uuid not null references artists(id) on delete cascade,
	slug text not null,
	title text not null,
	value_exchange_text text not null default '',
	streaming_links jsonb not null default '{}',
	social_links jsonb not null default '{}',
	accent_color text not null default '#E8C547',
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),

	constraint capture_pages_slug_length check (char_length(slug) between 1 and 40),
	constraint capture_pages_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
	constraint capture_pages_unique_slug unique (slug)
);

create index idx_capture_pages_artist_id on capture_pages(artist_id);

alter table capture_pages enable row level security;

create policy "capture_pages_select_own" on capture_pages
	for select using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "capture_pages_insert_own" on capture_pages
	for insert with check (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "capture_pages_update_own" on capture_pages
	for update using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "capture_pages_delete_own" on capture_pages
	for delete using (artist_id in (select id from artists where auth_id = auth.uid()));

-- ============================================================
-- FAN CAPTURES (deduplicated roster)
-- ============================================================
create table fan_captures (
	id uuid primary key default gen_random_uuid(),
	artist_id uuid not null references artists(id) on delete cascade,
	email text not null,
	name text,
	first_captured_at timestamptz not null default now(),
	last_captured_at timestamptz not null default now(),

	constraint fan_captures_dedup unique (artist_id, email)
);

create index idx_fan_captures_artist_created on fan_captures(artist_id, first_captured_at);

alter table fan_captures enable row level security;

create policy "fan_captures_select_own" on fan_captures
	for select using (artist_id in (select id from artists where auth_id = auth.uid()));

-- No insert/update/delete policies — writes come via service_role from Cloudflare Worker

-- ============================================================
-- CAPTURE EVENTS (full interaction history)
-- ============================================================
create type entry_method as enum ('qr', 'nfc', 'sms', 'direct');

create table capture_events (
	id uuid primary key default gen_random_uuid(),
	fan_capture_id uuid not null references fan_captures(id) on delete cascade,
	capture_page_id uuid not null references capture_pages(id) on delete cascade,
	entry_method entry_method not null,
	captured_at timestamptz not null default now()
);

create index idx_capture_events_fan on capture_events(fan_capture_id, captured_at);
create index idx_capture_events_page on capture_events(capture_page_id, captured_at);

alter table capture_events enable row level security;

create policy "capture_events_select_own" on capture_events
	for select using (
		capture_page_id in (
			select cp.id from capture_pages cp
			join artists a on a.id = cp.artist_id
			where a.auth_id = auth.uid()
		)
	);

-- No insert/update/delete policies — writes come via service_role

-- ============================================================
-- PENDING EMAILS (background job queue)
-- ============================================================
create type email_status as enum ('pending', 'sent', 'failed');

create table pending_emails (
	id uuid primary key default gen_random_uuid(),
	fan_capture_id uuid not null references fan_captures(id) on delete cascade,
	artist_id uuid not null references artists(id) on delete cascade,
	email text not null,
	send_at timestamptz not null default now(),
	status email_status not null default 'pending',
	retry_count integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index idx_pending_emails_poll on pending_emails(status, send_at)
	where status = 'pending';

create index idx_pending_emails_artist on pending_emails(artist_id, created_at);

alter table pending_emails enable row level security;

create policy "pending_emails_select_own" on pending_emails
	for select using (artist_id in (select id from artists where auth_id = auth.uid()));

-- No insert/update/delete policies — writes come via service_role

-- ============================================================
-- EMAIL SUPPRESSION LIST
-- ============================================================
create type suppression_reason as enum ('hard_bounce', 'complaint', 'manual_unsubscribe');

create table email_suppression_list (
	id uuid primary key default gen_random_uuid(),
	artist_id uuid not null references artists(id) on delete cascade,
	email text not null,
	reason suppression_reason not null,
	created_at timestamptz not null default now(),

	constraint email_suppression_dedup unique (artist_id, email)
);

create index idx_suppression_artist_email on email_suppression_list(artist_id, email);

alter table email_suppression_list enable row level security;

create policy "suppression_select_own" on email_suppression_list
	for select using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "suppression_delete_own" on email_suppression_list
	for delete using (artist_id in (select id from artists where auth_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
	new.updated_at = now();
	return new;
end;
$$ language plpgsql;

create trigger trg_artists_updated_at
	before update on artists
	for each row execute function update_updated_at();

create trigger trg_capture_pages_updated_at
	before update on capture_pages
	for each row execute function update_updated_at();

create trigger trg_pending_emails_updated_at
	before update on pending_emails
	for each row execute function update_updated_at();
