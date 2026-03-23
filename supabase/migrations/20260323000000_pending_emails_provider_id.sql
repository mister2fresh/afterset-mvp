-- Add provider_message_id to pending_emails for webhook event correlation
alter table pending_emails add column provider_message_id text;

create index idx_pending_emails_provider_msg on pending_emails (provider_message_id)
	where provider_message_id is not null;
