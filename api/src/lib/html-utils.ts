export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function isLightColor(hex: string): boolean {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

export const BUTTON_RADIUS: Record<string, string> = {
	rounded: "6px",
	pill: "9999px",
	sharp: "0",
};

export function cssBackground(
	style: string,
	accent: string,
	secondary: string,
	bg: string,
): string {
	if (style === "gradient") {
		return `linear-gradient(180deg, ${secondary}42 0%, transparent 60%), ${bg}`;
	}
	if (style === "glow") {
		return `radial-gradient(ellipse at 50% 30%, ${accent}33 0%, transparent 70%), ${bg}`;
	}
	return bg;
}
