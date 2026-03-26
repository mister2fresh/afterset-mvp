export type EmailTheme = {
	accentColor: string;
	bgColor: string;
	textColor: string;
	buttonStyle: "rounded" | "pill" | "sharp";
};

const DEFAULT_THEME: EmailTheme = {
	accentColor: "#E8C547",
	bgColor: "#0a0e1a",
	textColor: "#f9fafb",
	buttonStyle: "rounded",
};

const BUTTON_RADIUS: Record<string, string> = {
	rounded: "6px",
	pill: "9999px",
	sharp: "0",
};

function isLightColor(hex: string): boolean {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

type TemplateParams = {
	artistName: string;
	body: string;
	incentiveUrl?: string;
	theme?: EmailTheme;
};

export function renderFollowUpHtml(params: TemplateParams): string {
	const { artistName, body, incentiveUrl } = params;
	const t = params.theme ?? DEFAULT_THEME;
	const bodyColor = isLightColor(t.bgColor) ? "#374151" : "#e5e7eb";
	const btnTextColor = isLightColor(t.accentColor) ? "#0a0e1a" : "#f9fafb";
	const radius = BUTTON_RADIUS[t.buttonStyle] ?? "6px";

	const paragraphs = body
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map(
			(p) => `<p style="margin:0 0 16px;line-height:1.6;color:${bodyColor};">${escapeHtml(p)}</p>`,
		)
		.join("\n");

	const incentiveBlock = incentiveUrl
		? `<div style="margin:24px 0;text-align:center;">
	<a href="${escapeHtml(incentiveUrl)}" style="display:inline-block;padding:12px 28px;background-color:${escapeHtml(t.accentColor)};color:${btnTextColor};font-weight:600;text-decoration:none;border-radius:${radius};">Download Your Bonus</a>
</div>`
		: "";

	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${escapeHtml(t.bgColor)};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
<h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:${escapeHtml(t.textColor)};">${escapeHtml(artistName)}</h1>
${paragraphs}
${incentiveBlock}
</div>
</body>
</html>`;
}

export function toEmailTheme(page: {
	accent_color?: string | null;
	bg_color?: string | null;
	text_color?: string | null;
	button_style?: string | null;
}): EmailTheme {
	return {
		accentColor: page.accent_color ?? DEFAULT_THEME.accentColor,
		bgColor: page.bg_color ?? DEFAULT_THEME.bgColor,
		textColor: page.text_color ?? DEFAULT_THEME.textColor,
		buttonStyle: (page.button_style as EmailTheme["buttonStyle"]) ?? DEFAULT_THEME.buttonStyle,
	};
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
