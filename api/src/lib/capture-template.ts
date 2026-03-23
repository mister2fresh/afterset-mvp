type CapturePage = {
	slug: string;
	title: string;
	value_exchange_text: string | null;
	accent_color: string;
	secondary_color: string;
	background_style: "solid" | "gradient" | "glow";
	button_style: "rounded" | "pill" | "sharp";
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

function cssBackground(style: string, accent: string, secondary: string): string {
	if (style === "gradient") {
		return `linear-gradient(180deg, ${secondary}26 0%, transparent 60%), #0a0e1a`;
	}
	if (style === "glow") {
		return `radial-gradient(ellipse at 50% 30%, ${accent}1A 0%, transparent 70%), #0a0e1a`;
	}
	return "#0a0e1a";
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const STREAMING_ICONS: Record<string, { label: string; svg: string }> = {
	spotify: {
		label: "Spotify",
		svg: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.84.2c-2.3-1.4-5.2-1.72-8.6-.94a.6.6 0 1 1-.28-1.18c3.74-.86 6.94-.48 9.52 1.08a.6.6 0 0 1 .2.84zm1.22-2.72a.76.76 0 0 1-1.04.24c-2.64-1.62-6.66-2.1-9.78-1.14a.76.76 0 1 1-.44-1.46c3.56-1.08 7.98-.56 11.02 1.3a.76.76 0 0 1 .24 1.06zm.1-2.84c-3.16-1.88-8.38-2.06-11.4-1.14a.92.92 0 1 1-.54-1.76c3.46-1.06 9.24-.86 12.88 1.32a.92.92 0 0 1-.94 1.58z"/>',
	},
	apple_music: {
		label: "Apple Music",
		svg: '<path d="M18.5 3.5h-13A2 2 0 0 0 3.5 5.5v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2zm-3 3.5v7a2.5 2.5 0 1 1-1-2V9l-5 1.5v5a2.5 2.5 0 1 1-1-2V7.5l7-2z"/>',
	},
	youtube_music: {
		label: "YouTube Music",
		svg: '<circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="#0a0e1a"/>',
	},
	soundcloud: {
		label: "SoundCloud",
		svg: '<path d="M3 14.5v-3m3 4v-5m3 5.5v-7m3 7v-9m3 9v-7a4 4 0 0 1 4 4v3H3"/>',
	},
	tidal: {
		label: "Tidal",
		svg: '<path d="M12 3L8 7l4 4-4 4 4 4 4-4-4-4 4-4-4-4zm-6 4L2 11l4 4 4-4-4-4zm12 0l-4 4 4 4 4-4-4-4z"/>',
	},
	bandcamp: {
		label: "Bandcamp",
		svg: '<path d="M0 17h10l4-10H4z"/>',
	},
};

const SOCIAL_ICONS: Record<string, { label: string; svg: string }> = {
	instagram: {
		label: "Instagram",
		svg: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/>',
	},
	tiktok: {
		label: "TikTok",
		svg: '<path d="M16.6 5.8A4.3 4.3 0 0 1 13 2h-3v14a3 3 0 1 1-2-2.8V8a7 7 0 1 0 5 6.7V10a7 7 0 0 0 3.6 1V8a4.3 4.3 0 0 1-0-2.2z"/>',
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
): string {
	const entries = Object.entries(links).filter(([, url]) => url.trim());
	if (entries.length === 0) return "";

	const items = entries
		.map(([key, url]) => {
			const icon = icons[key];
			if (!icon) return "";
			return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="${icon.label}" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:${accentColor}18;color:${accentColor};transition:background .15s"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">${icon.svg}</svg></a>`;
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
	const bg = cssBackground(page.background_style, page.accent_color, page.secondary_color);
	const btnRadius = BUTTON_RADIUS[page.button_style] ?? "6px";
	const title = escapeHtml(page.title);
	const subtitle = page.value_exchange_text ? escapeHtml(page.value_exchange_text) : "";
	const streamingHtml = renderIconLinks(page.streaming_links, STREAMING_ICONS, page.accent_color);
	const socialHtml = renderIconLinks(page.social_links, SOCIAL_ICONS, page.accent_color);

	const hasIncentive = page.incentive_file_name && page.incentive_content_type;
	const incentiveMsg = hasIncentive
		? `We&#39;ll send ${incentiveLabel(page.incentive_content_type)} to your inbox shortly.`
		: "We&#39;ll be in touch soon.";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:${bg};color:#f9fafb;-webkit-font-smoothing:antialiased}
.c{width:100%;max-width:400px;padding:32px 24px;text-align:center}
h1{font-size:1.5rem;font-weight:700;letter-spacing:-.025em;line-height:1.2;margin-bottom:8px}
.sub{color:#9ca3af;font-size:.875rem;line-height:1.6;margin-bottom:20px;max-width:320px;margin-left:auto;margin-right:auto}
.f{display:flex;gap:8px;margin-bottom:16px}
.f input{flex:1;padding:12px 14px;border:1px solid #374151;border-radius:6px;background:#111827;color:#f9fafb;font-size:.875rem;outline:none;min-width:0}
.f input:focus{border-color:${page.accent_color}}
.f input::placeholder{color:#6b7280}
.f button{padding:12px 24px;border:none;background:${page.accent_color};color:#0a0e1a;font-size:.875rem;font-weight:600;border-radius:${btnRadius};cursor:pointer;white-space:nowrap;min-height:48px;min-width:48px}
.f button:active{opacity:.9}
.ok{display:none;margin-top:12px}
.ok-h{color:#4ade80;font-size:1rem;font-weight:600;margin-bottom:6px}
.ok-d{color:#9ca3af;font-size:.875rem;line-height:1.5}
.err{display:none;color:#f87171;font-size:.875rem;margin-top:8px}
.pw{font-size:.7rem;color:#4b5563;margin-top:24px}
.pw a{color:#6b7280}
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
