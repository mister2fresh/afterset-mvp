export const STREAMING_ICONS: Record<string, { label: string; svg: string }> = {
	spotify: {
		label: "Spotify",
		svg: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.84.2c-2.3-1.4-5.2-1.72-8.6-.94a.6.6 0 1 1-.28-1.18c3.74-.86 6.94-.48 9.52 1.08a.6.6 0 0 1 .2.84zm1.22-2.72a.76.76 0 0 1-1.04.24c-2.64-1.62-6.66-2.1-9.78-1.14a.76.76 0 1 1-.44-1.46c3.56-1.08 7.98-.56 11.02 1.3a.76.76 0 0 1 .24 1.06zm.1-2.84c-3.16-1.88-8.38-2.06-11.4-1.14a.92.92 0 1 1-.54-1.76c3.46-1.06 9.24-.86 12.88 1.32a.92.92 0 0 1-.94 1.58z"/>',
	},
	apple_music: {
		label: "Apple Music",
		svg: '<path d="M19 3v12.5a3.5 3.5 0 1 1-2-3.2V6.8L9 8.7v9.8a3.5 3.5 0 1 1-2-3.2V5.4L19 3z"/>',
	},
	youtube_music: {
		label: "YouTube Music",
		svg: '<circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentBg"/>',
	},
	soundcloud: {
		label: "SoundCloud",
		svg: '<path d="M2 14h1v4H2zm3-1h1v5H5zm3-2h1v7H8zm3-2h1v9h-1zm3 0v-1a2 2 0 0 1 4 0v2a4.5 4.5 0 0 1 4 7h-8V9z"/>',
	},
	tidal: {
		label: "Tidal",
		svg: '<path d="M6 5l3 3-3 3-3-3zm6 0l3 3-3 3-3-3zm6 0l3 3-3 3-3-3zm-6 6l3 3-3 3-3-3z"/>',
	},
	bandcamp: {
		label: "Bandcamp",
		svg: '<path d="M4 19h10l6-14H10z"/>',
	},
};

export const SOCIAL_ICONS: Record<string, { label: string; svg: string }> = {
	instagram: {
		label: "Instagram",
		svg: '<rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5"/>',
	},
	tiktok: {
		label: "TikTok",
		svg: '<path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z" transform="translate(4 4) scale(1.125)"/>',
	},
	twitter: {
		label: "X",
		svg: '<path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5-6.6L5.6 22H2.3l7.7-8.8L2 2h6.8l4.5 6L18.9 2zM17.5 20h1.7L7.6 3.7H5.7L17.5 20z"/>',
	},
	youtube: {
		label: "YouTube",
		svg: '<path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C18.9 4 12 4 12 4s-6.9 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 2 2c1.6.4 8.5.4 8.5.4s6.9 0 8.5-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.6zM9.8 15.5V8.5l5.6 3.5-5.6 3.5z"/>',
	},
	facebook: {
		label: "Facebook",
		svg: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z"/>',
	},
};

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function renderIconItems(
	links: Record<string, string>,
	icons: Record<string, { label: string; svg: string }>,
	accentColor: string,
	bgColor: string,
): string {
	return Object.entries(links)
		.filter(([, url]) => url.trim())
		.map(([key, url]) => {
			const icon = icons[key];
			if (!icon) return "";
			const svgContent = icon.svg.replace("currentBg", bgColor);
			return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="${icon.label}" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:${accentColor}18;color:${accentColor};transition:background .15s"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">${svgContent}</svg></a>`;
		})
		.filter(Boolean)
		.join("\n");
}

export function renderIconGrid(
	streamingLinks: Record<string, string>,
	socialLinks: Record<string, string>,
	accentColor: string,
	bgColor: string,
): string {
	const items =
		renderIconItems(streamingLinks, STREAMING_ICONS, accentColor, bgColor) +
		renderIconItems(socialLinks, SOCIAL_ICONS, accentColor, bgColor);
	if (!items) return "";
	return `<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:12px">${items}</div>`;
}
