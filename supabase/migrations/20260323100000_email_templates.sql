-- Sprint 2: Email templates (one per capture page)

create type email_delay_mode as enum ('immediate', '1_hour', 'next_morning');

create table email_templates (
	id uuid primary key default gen_random_uuid(),
	capture_page_id uuid not null references capture_pages(id) on delete cascade,
	artist_id uuid not null references artists(id) on delete cascade,
	subject text not null,
	body text not null,
	include_incentive_link boolean not null default false,
	delay_mode email_delay_mode not null default 'immediate',
	is_active boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),

	constraint email_templates_one_per_page unique (capture_page_id)
);

create index idx_email_templates_artist on email_templates(artist_id);
create index idx_email_templates_page on email_templates(capture_page_id);

alter table email_templates enable row level security;

create policy "email_templates_select_own" on email_templates
	for select using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "email_templates_insert_own" on email_templates
	for insert with check (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "email_templates_update_own" on email_templates
	for update using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "email_templates_delete_own" on email_templates
	for delete using (artist_id in (select id from artists where auth_id = auth.uid()));

create trigger trg_email_templates_updated_at
	before update on email_templates
	for each row execute function update_updated_at();
