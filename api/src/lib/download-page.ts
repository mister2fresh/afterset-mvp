import { BUTTON_RADIUS, cssBackground, escapeHtml, isLightColor } from "./html-utils.js";
import { renderIconGrid } from "./icons.js";

type DownloadPageParams = {
	artistName: string;
	fileName: string;
	contentType: string;
	signedUrl: string;
	heading?: string;
	description?: string;
	streamingLinks?: Record<string, string>;
	socialLinks?: Record<string, string>;
};

export type DownloadPageStyle = {
	accentColor: string;
	secondaryColor: string;
	bgColor: string;
	textColor: string;
	buttonStyle: "rounded" | "pill" | "sharp";
	backgroundStyle: "solid" | "gradient" | "glow";
};

function fileTypeIcon(contentType: string): { label: string; svg: string } {
	if (contentType.startsWith("audio/")) {
		return {
			label: "Audio File",
			svg: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
		};
	}
	if (contentType.startsWith("video/")) {
		return {
			label: "Video File",
			svg: '<rect x="2" y="2" width="20" height="20" rx="2"/><polygon points="10,8 16,12 10,16"/>',
		};
	}
	if (contentType.startsWith("image/")) {
		return {
			label: "Image",
			svg: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
		};
	}
	if (contentType === "application/pdf") {
		return {
			label: "PDF Document",
			svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
		};
	}
	if (contentType.includes("zip")) {
		return {
			label: "ZIP Archive",
			svg: '<path d="M21 8v13H3V3h12z"/><path d="M14 3v5h5"/><path d="M10 12h1v1h-1zm2 0h1v1h-1zm-2 2h1v1h-1zm2 2h1v1h-1zm-2 0h1v1h-1zm2-2h1v1h-1z"/>',
		};
	}
	return {
		label: "File",
		svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
	};
}

const DEFAULT_STYLE: DownloadPageStyle = {
	accentColor: "#E8C547",
	secondaryColor: "#D4A017",
	bgColor: "#0a0e1a",
	textColor: "#f9fafb",
	buttonStyle: "rounded",
	backgroundStyle: "solid",
};

function pageShell(style: DownloadPageStyle, content: string): string {
	const bg = cssBackground(
		style.backgroundStyle,
		style.accentColor,
		style.secondaryColor,
		style.bgColor,
	);
	const mutedColor = isLightColor(style.bgColor) ? "#6b7280" : "#9ca3af";
	const btnTextColor = isLightColor(style.accentColor) ? "#0a0e1a" : "#f9fafb";
	const radius = BUTTON_RADIUS[style.buttonStyle] ?? "6px";

	return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Download</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:${bg};color:${escapeHtml(style.textColor)};min-height:100vh;display:flex;align-items:center;justify-content:center}
.wrap{text-align:center;max-width:400px;padding:2rem 1.5rem;width:100%}
.icon{margin:0 auto 1rem}
.artist{font-size:.875rem;color:${mutedColor};margin-bottom:.75rem;letter-spacing:.05em;text-transform:uppercase}
.file{font-size:1.125rem;font-weight:600;margin-bottom:.25rem;word-break:break-word}
.type{font-size:.8125rem;color:${mutedColor};margin-bottom:1.5rem}
.btn{display:inline-block;padding:14px 36px;background:${escapeHtml(style.accentColor)};color:${btnTextColor};font-weight:600;font-size:1rem;text-decoration:none;border-radius:${radius};transition:opacity .15s}
.btn:hover{opacity:.9}
.hint{display:none;font-size:.75rem;color:${mutedColor};margin-top:1rem;line-height:1.5}
.footer{font-size:.6875rem;color:${mutedColor};margin-top:2.5rem;opacity:.6}
.msg{font-size:1rem;line-height:1.6;margin-bottom:1.5rem}
</style></head>
<body><div class="wrap">
${content}
<p class="footer">Powered by Afterset</p>
</div>
<script>if(/iPhone|iPad|iPod/.test(navigator.userAgent)){var h=document.getElementById("ios-hint");if(h)h.style.display="block"}</script>
</body></html>`;
}

export function renderDownloadPage(params: DownloadPageParams, style: DownloadPageStyle): string {
	const { label, svg } = fileTypeIcon(params.contentType);
	const escapedName = escapeHtml(params.fileName);
	const escapedArtist = escapeHtml(params.artistName);
	const escapedUrl = escapeHtml(params.signedUrl);
	const iconsBlock = renderIconGrid(
		params.streamingLinks ?? {},
		params.socialLinks ?? {},
		style.accentColor,
		style.bgColor,
	);

	const headingHtml = params.heading
		? `<p class="file">${escapeHtml(params.heading)}</p>`
		: `<p class="file">${escapedName}</p>`;
	const descHtml = params.description ? `<p class="msg">${escapeHtml(params.description)}</p>` : "";
	const fileLabel = params.heading
		? `<p class="type">${escapedName} &middot; ${escapeHtml(label)}</p>`
		: `<p class="type">${escapeHtml(label)}</p>`;

	return pageShell(
		style,
		`<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>
<p class="artist">${escapedArtist}</p>
${headingHtml}
${descHtml}
${fileLabel}
<a class="btn" href="${escapedUrl}" download="${escapedName}">Download</a>
<p class="hint" id="ios-hint">On iPhone, tap and hold the button, then choose &ldquo;Download Linked File&rdquo;</p>
${iconsBlock}`,
	);
}

export function renderExpiredPage(artistName?: string, style?: DownloadPageStyle): string {
	const s = style ?? DEFAULT_STYLE;
	const artist = artistName ? `<p class="artist">${escapeHtml(artistName)}</p>` : "";

	return pageShell(
		s,
		`${artist}
<p class="msg">This download link has expired.</p>
<p class="msg" style="font-size:.875rem">Contact the artist for a new link.</p>`,
	);
}

export function renderErrorPage(): string {
	return pageShell(DEFAULT_STYLE, `<p class="msg">This download link is invalid.</p>`);
}
