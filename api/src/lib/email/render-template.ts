type TemplateParams = {
	artistName: string;
	body: string;
	incentiveUrl?: string;
};

export function renderFollowUpHtml(params: TemplateParams): string {
	const { artistName, body, incentiveUrl } = params;

	const paragraphs = body
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#e5e7eb;">${escapeHtml(p)}</p>`)
		.join("\n");

	const incentiveBlock = incentiveUrl
		? `<div style="margin:24px 0;text-align:center;">
	<a href="${escapeHtml(incentiveUrl)}" style="display:inline-block;padding:12px 28px;background-color:#E8C547;color:#0a0e1a;font-weight:600;text-decoration:none;border-radius:6px;">Download Your Bonus</a>
</div>`
		: "";

	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
<h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#f9fafb;">${escapeHtml(artistName)}</h1>
${paragraphs}
${incentiveBlock}
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
