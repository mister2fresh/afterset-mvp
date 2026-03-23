-- Add incentive file metadata columns to capture_pages
alter table capture_pages
	add column incentive_file_path text,
	add column incentive_file_name text,
	add column incentive_file_size bigint,
	add column incentive_content_type text;

-- Create private storage bucket for incentive files (250MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'incentives',
	'incentives',
	false,
	262144000, -- 250MB
	array[
		-- Audio
		'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac',
		'audio/ogg', 'audio/mp4', 'audio/aiff', 'audio/x-aiff',
		'audio/x-m4a', 'audio/x-flac', 'audio/x-wav',
		-- Image
		'image/png', 'image/jpeg', 'image/gif',
		-- Video
		'video/mp4', 'video/quicktime', 'video/webm',
		-- Document
		'application/pdf',
		-- Archive
		'application/zip', 'application/x-zip-compressed'
	]
);
