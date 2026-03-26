type CapturePage = {
	slug: string;
	title: string;
	value_exchange_text: string | null;
	accent_color: string;
	secondary_color: string;
	background_style: "solid" | "gradient" | "glow";
	button_style: "rounded" | "pill" | "sharp";
	font_style: "modern" | "editorial" | "mono" | "condensed";
	title_size: "default" | "large" | "xl";
	layout_style: "centered" | "stacked";
	text_color: string;
	bg_color: string;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
	incentive_file_name: string | null;
	incentive_content_type: string | null;
};

const BUTTON_RADIUS: Record<string, string> = {
	rounded: "6px",
	pill: "9999px",
	sharp: "0",
};

const FONT_STACKS: Record<string, string> = {
	modern: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
	editorial: 'Georgia,"Times New Roman",Times,serif',
	mono: '"SF Mono",SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace',
	condensed: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

const TITLE_SIZES: Record<string, string> = {
	default: "1.5rem",
	large: "2rem",
	xl: "2.75rem",
};

function cssBackground(style: string, accent: string, secondary: string, bg: string): string {
	if (style === "gradient") {
		return `linear-gradient(180deg, ${secondary}42 0%, transparent 60%), ${bg}`;
	}
	if (style === "glow") {
		return `radial-gradient(ellipse at 50% 30%, ${accent}33 0%, transparent 70%), ${bg}`;
	}
	return bg;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function isLightColor(hex: string): boolean {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

const STREAMING_ICONS: Record<string, { label: string; svg: string }> = {
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
		svg: '<path d="M2 14h1v4H2zm3-1h1v5H5zm3-2h1v7H8zm3-2h1v9h-1zm4-2a5 5 0 0 1 5 5v6h-6V7z"/>',
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

const SOCIAL_ICONS: Record<string, { label: string; svg: string }> = {
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

function renderIconLinks(
	links: Record<string, string>,
	icons: Record<string, { label: string; svg: string }>,
	accentColor: string,
	bgColor: string,
): string {
	const entries = Object.entries(links).filter(([, url]) => url.trim());
	if (entries.length === 0) return "";

	const items = entries
		.map(([key, url]) => {
			const icon = icons[key];
			if (!icon) return "";
			const svgContent = icon.svg.replace("currentBg", bgColor);
			return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="${icon.label}" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:${accentColor}18;color:${accentColor};transition:background .15s"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">${svgContent}</svg></a>`;
		})
		.filter(Boolean)
		.join("\n");

	return `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px">${items}</div>`;
}

function incentiveLabel(contentType: string | null): string {
	if (!contentType) return "";
	if (contentType.startsWith("audio/")) return "a track";
	if (contentType.startsWith("video/")) return "a video";
	if (contentType.startsWith("image/")) return "an image";
	if (contentType === "application/pdf") return "a PDF";
	if (contentType === "application/zip") return "a file";
	return "a file";
}

export function generateCaptureHtml(page: CapturePage): string {
	const fontStyle = page.font_style ?? "modern";
	const titleSize = page.title_size ?? "default";
	const layoutStyle = page.layout_style ?? "centered";
	const textColor = page.text_color ?? "#f9fafb";
	const bgColor = page.bg_color ?? "#0a0e1a";
	const mutedColor = isLightColor(bgColor) ? "#6b7280" : "#9ca3af";
	const inputBg = isLightColor(bgColor) ? "#f3f4f6" : "#111827";
	const inputBorder = isLightColor(bgColor) ? "#d1d5db" : "#374151";
	const btnTextColor = isLightColor(page.accent_color) ? "#0a0e1a" : "#f9fafb";

	const bg = cssBackground(page.background_style, page.accent_color, page.secondary_color, bgColor);
	const btnRadius = BUTTON_RADIUS[page.button_style] ?? "6px";
	const fontStack = FONT_STACKS[fontStyle];
	const titleFontSize = TITLE_SIZES[titleSize];
	const title = escapeHtml(page.title);
	const subtitle = page.value_exchange_text ? escapeHtml(page.value_exchange_text) : "";
	const streamingHtml = renderIconLinks(
		page.streaming_links,
		STREAMING_ICONS,
		page.accent_color,
		bgColor,
	);
	const socialHtml = renderIconLinks(page.social_links, SOCIAL_ICONS, page.accent_color, bgColor);

	const hasIncentive = page.incentive_file_name && page.incentive_content_type;
	const incentiveMsg = hasIncentive
		? `We&#39;ll send ${incentiveLabel(page.incentive_content_type)} to your inbox shortly.`
		: "We&#39;ll be in touch soon.";

	const condensedH1 =
		fontStyle === "condensed" ? "text-transform:uppercase;letter-spacing:.15em;" : "";
	const isStacked = layoutStyle === "stacked";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${fontStack};min-height:100dvh;display:flex;align-items:center;justify-content:center;background:${bg};color:${textColor};-webkit-font-smoothing:antialiased}
.c{width:100%;max-width:400px;padding:32px 24px;text-align:center}
h1{font-size:${titleFontSize};font-weight:700;letter-spacing:-.025em;line-height:1.2;margin-bottom:8px;${condensedH1}animation:fi .5s ease}
.sub{color:${mutedColor};font-size:.875rem;line-height:1.6;margin-bottom:20px;max-width:320px;margin-left:auto;margin-right:auto;animation:fi .5s ease .1s both}
.f{display:flex;${isStacked ? "flex-direction:column;" : ""}gap:8px;margin-bottom:16px;animation:fi .5s ease .2s both}
.f input{flex:1;padding:12px 14px;border:1px solid ${inputBorder};border-radius:6px;background:${inputBg};color:${textColor};font-size:.875rem;outline:none;min-width:0;transition:border-color .15s}
.f input:focus{border-color:${page.accent_color}}
.f input:hover{border-color:${page.accent_color}80}
.f input::placeholder{color:${mutedColor}}
.f button{padding:12px 24px;border:none;background:${page.accent_color};color:${btnTextColor};font-size:.875rem;font-weight:600;border-radius:${btnRadius};cursor:pointer;white-space:nowrap;min-height:48px;min-width:48px;transition:opacity .15s,transform .1s}
.f button:hover{opacity:.9}
.f button:active{opacity:.85;transform:scale(.98)}
.ok{display:none;margin-top:12px;animation:fi .3s ease}
.ok-h{color:#4ade80;font-size:1rem;font-weight:600;margin-bottom:6px}
.ok-d{color:${mutedColor};font-size:.875rem;line-height:1.5}
.err{display:none;color:#f87171;font-size:.875rem;margin-top:8px}
.pw{font-size:.7rem;color:${isLightColor(bgColor) ? "#9ca3af" : "#4b5563"};margin-top:24px}
.pw a{color:${isLightColor(bgColor) ? "#6b7280" : "#6b7280"}}
@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
<main class="c">
<h1>${title}</h1>
${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
<form class="f" id="cf" action="/api/capture" method="POST">
<input type="hidden" name="slug" value="${page.slug}">
<input type="hidden" name="entry_method" value="d">
<input type="email" name="email" placeholder="your@email.com" required aria-label="Email address" autocomplete="email" inputmode="email">
<button type="submit">Join</button>
</form>
<div class="ok" id="ok"><p class="ok-h">You're in!</p><p class="ok-d">${incentiveMsg}</p></div>
<p class="err" id="er"></p>
${streamingHtml}
${socialHtml}
<p class="pw">Powered by <a href="https://afterset.net" target="_blank" rel="noopener">Afterset</a></p>
</main>
<script>
(function(){var K="afterset_q",S="${page.slug}",f=document.getElementById("cf"),ok=document.getElementById("ok"),er=document.getElementById("er"),p=new URLSearchParams(location.search),v=p.get("v")||"d";f.entry_method.value=v;function send(d){var ac=new AbortController;var t=setTimeout(function(){ac.abort()},10000);return fetch("/api/capture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d),signal:ac.signal,keepalive:true}).then(function(r){clearTimeout(t);if(!r.ok)throw new Error();dequeue(d.email);return true}).catch(function(){clearTimeout(t);enqueue(d);return false})}function enqueue(d){try{var q=JSON.parse(localStorage.getItem(K)||"[]");if(!q.some(function(x){return x.email===d.email&&x.slug===d.slug}))q.push(d);localStorage.setItem(K,JSON.stringify(q))}catch(e){}}function dequeue(email){try{var q=JSON.parse(localStorage.getItem(K)||"[]");q=q.filter(function(x){return x.email!==email||x.slug!==S});q.length?localStorage.setItem(K,JSON.stringify(q)):localStorage.removeItem(K)}catch(e){}}function showOk(){f.style.display="none";ok.style.display="block"}function retry(){try{var q=JSON.parse(localStorage.getItem(K)||"[]");q.forEach(function(d){send(d)})}catch(e){}}retry();f.addEventListener("submit",function(e){e.preventDefault();var email=f.email.value;var d={email:email,slug:S,entry_method:v};showOk();send(d)})})()
</script>
<!-- built: ${new Date().toISOString()} -->
</body>
</html>`;
}
