-- SMS keyword management for text-to-join
-- Artists claim a keyword per capture page; fans text it to the toll-free number

create table sms_keywords (
	id uuid primary key default gen_random_uuid(),
	artist_id uuid not null references artists(id) on delete cascade,
	capture_page_id uuid not null unique references capture_pages(id) on delete cascade,
	keyword varchar(20) not null,
	phone_number varchar(15) not null default '+10000000000',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),

	constraint sms_keywords_length check (char_length(keyword) between 2 and 20),
	constraint sms_keywords_format check (keyword ~ '^[A-Z0-9]+$'),
	unique(keyword, phone_number)
);

create index idx_sms_keywords_lookup on sms_keywords(phone_number, keyword);
create index idx_sms_keywords_artist on sms_keywords(artist_id);

alter table sms_keywords enable row level security;

create policy "sms_keywords_select_own" on sms_keywords
	for select using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "sms_keywords_insert_own" on sms_keywords
	for insert with check (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "sms_keywords_update_own" on sms_keywords
	for update using (artist_id in (select id from artists where auth_id = auth.uid()));

create policy "sms_keywords_delete_own" on sms_keywords
	for delete using (artist_id in (select id from artists where auth_id = auth.uid()));

create trigger trg_sms_keywords_updated_at
	before update on sms_keywords
	for each row execute function update_updated_at();
