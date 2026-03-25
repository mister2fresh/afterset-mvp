-- Add archived_at column to broadcasts for soft-delete of sent/completed broadcasts
alter table broadcasts add column archived_at timestamptz;

create index idx_broadcasts_archived on broadcasts(artist_id, archived_at)
  where archived_at is null;
