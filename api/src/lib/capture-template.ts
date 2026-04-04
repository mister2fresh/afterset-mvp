import { renderIconItems, SOCIAL_ICONS, STREAMING_ICONS } from "./icons.js";

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

function renderIconLinks(
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
	const iconsHtml = renderIconLinks(
		page.streaming_links,
		page.social_links,
		page.accent_color,
		bgColor,
	);

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
.pw a{color:${isLightColor(bgColor) ? "#4b5563" : "#9ca3af"}}
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
${iconsHtml}
<p class="pw">Powered by <a href="https://afterset.net" target="_blank" rel="noopener">Afterset</a></p>
</main>
<script>
(function(){var K="afterset_q",S="${page.slug}",f=document.getElementById("cf"),ok=document.getElementById("ok"),er=document.getElementById("er"),p=new URLSearchParams(location.search),v=p.get("v")||"d";f.entry_method.value=v;function send(d){var ac=new AbortController;var t=setTimeout(function(){ac.abort()},10000);return fetch("/api/capture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d),signal:ac.signal,keepalive:true}).then(function(r){clearTimeout(t);if(!r.ok)throw new Error();dequeue(d.email);return true}).catch(function(){clearTimeout(t);enqueue(d);return false})}function enqueue(d){try{var q=JSON.parse(localStorage.getItem(K)||"[]");if(!q.some(function(x){return x.email===d.email&&x.slug===d.slug}))q.push(d);localStorage.setItem(K,JSON.stringify(q))}catch(e){}}function dequeue(email){try{var q=JSON.parse(localStorage.getItem(K)||"[]");q=q.filter(function(x){return x.email!==email||x.slug!==S});q.length?localStorage.setItem(K,JSON.stringify(q)):localStorage.removeItem(K)}catch(e){}}function showOk(){f.style.display="none";ok.style.display="block"}function retry(){try{var q=JSON.parse(localStorage.getItem(K)||"[]");q.forEach(function(d){send(d)})}catch(e){}}retry();f.addEventListener("submit",function(e){e.preventDefault();var email=f.email.value;var d={email:email,slug:S,entry_method:v};showOk();send(d)})})()
</script>
<!-- built: ${new Date().toISOString()} -->
</body>
</html>`;
}
