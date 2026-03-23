-- Add theme customization columns to capture_pages
alter table capture_pages
	add column secondary_color text not null default '#D4A017',
	add column background_style text not null default 'solid',
	add column button_style text not null default 'rounded';

alter table capture_pages
	add constraint capture_pages_background_style_check
		check (background_style in ('solid', 'gradient', 'glow')),
	add constraint capture_pages_button_style_check
		check (button_style in ('rounded', 'pill', 'sharp'));
