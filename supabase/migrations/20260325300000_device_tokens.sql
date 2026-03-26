-- Device tokens for push notifications (Capacitor native apps)
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_tokens_token_unique unique (token)
);

create index device_tokens_artist_id_idx on device_tokens(artist_id);

-- RLS: artists can only see their own tokens
alter table device_tokens enable row level security;

create policy "Artists can manage their own device tokens"
  on device_tokens for all
  using (artist_id = auth.uid())
  with check (artist_id = auth.uid());
