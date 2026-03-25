-- Add font, title size, layout, and color customization to capture pages
alter table capture_pages
	add column font_style text not null default 'modern',
	add column title_size text not null default 'default',
	add column layout_style text not null default 'centered',
	add column text_color text not null default '#f9fafb',
	add column bg_color text not null default '#0a0e1a';

alter table capture_pages
	add constraint capture_pages_font_style_check
		check (font_style in ('modern', 'editorial', 'mono', 'condensed')),
	add constraint capture_pages_title_size_check
		check (title_size in ('default', 'large', 'xl')),
	add constraint capture_pages_layout_style_check
		check (layout_style in ('centered', 'stacked'));
