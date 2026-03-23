interface Env {
	PAGES: R2Bucket;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
}

// Rate limiting: 5 submissions per IP per slug per 60s window
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, slug: string): boolean {
	const key = `${ip}:${slug}`;
	const now = Date.now();
	const entry = rateLimitMap.get(key);

	if (!entry || now >= entry.resetAt) {
		rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}

	entry.count++;
	return entry.count > RATE_LIMIT_MAX;
}

// Periodic cleanup of expired entries (runs at most once per window)
let lastCleanup = 0;
function cleanupRateLimits() {
	const now = Date.now();
	if (now - lastCleanup < RATE_LIMIT_WINDOW_MS) return;
	lastCleanup = now;
	for (const [key, entry] of rateLimitMap) {
		if (now >= entry.resetAt) rateLimitMap.delete(key);
	}
}

function calculateNextMorning(timezone: string): string {
	const now = new Date();
	// Format current hour in artist's timezone to determine if it's already past 9am
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
	});
	const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
	const localHour = Number.parseInt(parts.hour, 10);

	// Target: 9am in artist's timezone, tomorrow (or today if before 9am)
	const daysToAdd = localHour >= 9 ? 1 : 0;
	const target = new Date(now);
	target.setDate(target.getDate() + daysToAdd);

	// Build a date string in the artist's timezone at 09:00, then convert to UTC
	const dateFormatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const dateStr = dateFormatter.format(target); // YYYY-MM-DD
	// Parse "YYYY-MM-DD 09:00" in the artist's timezone by computing the UTC offset
	const nineAm = new Date(`${dateStr}T09:00:00`);
	// Get the offset: difference between UTC interpretation and local interpretation
	const utcNineAm = new Date(nineAm.getTime() + getTimezoneOffsetMs(timezone, nineAm));
	return utcNineAm.toISOString();
}

function getTimezoneOffsetMs(timezone: string, date: Date): number {
	// Calculate offset by comparing UTC and timezone-formatted date
	const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
	const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
	return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

const ENTRY_METHODS = new Set(["d", "q", "n", "s"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", ...CORS_HEADERS },
	});
}

function notFound(): Response {
	return new Response(
		`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0a0e1a;color:#9ca3af;text-align:center}h1{font-size:1.25rem;font-weight:600;color:#f9fafb;margin-bottom:8px}p{font-size:.875rem}</style></head><body><div><h1>Page not found</h1><p>This capture page doesn\u2019t exist.</p></div></body></html>`,
		{ status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
	);
}

async function supabaseRpc(
	env: Env,
	path: string,
	options: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<Response> {
	return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
		method: options.method ?? "GET",
		headers: {
			apikey: env.SUPABASE_SERVICE_ROLE_KEY,
			Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
			"Content-Type": "application/json",
			Prefer: "return=representation",
			...options.headers,
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
}

async function handleCapture(request: Request, env: Env): Promise<Response> {
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	if (request.method !== "POST") {
		return json({ error: "Method not allowed" }, 405);
	}

	let fields: Record<string, unknown>;
	const contentType = request.headers.get("Content-Type") ?? "";
	if (contentType.includes("application/json")) {
		try {
			fields = (await request.json()) as Record<string, unknown>;
		} catch {
			return json({ error: "Invalid JSON" }, 400);
		}
	} else if (contentType.includes("form")) {
		const form = await request.formData();
		fields = Object.fromEntries(form.entries());
	} else {
		return json({ error: "Unsupported content type" }, 415);
	}

	const { email, slug, entry_method } = fields;

	if (typeof email !== "string" || !EMAIL_RE.test(email)) {
		return json({ error: "Invalid email" }, 400);
	}
	if (typeof slug !== "string" || slug.length === 0) {
		return json({ error: "Missing slug" }, 400);
	}

	// Rate limit by IP + slug
	cleanupRateLimits();
	const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
	if (isRateLimited(clientIp, slug)) {
		return json({ error: "Too many submissions. Please wait a minute and try again." }, 429);
	}

	const method =
		typeof entry_method === "string" && ENTRY_METHODS.has(entry_method) ? entry_method : "d";

	// Look up capture page by slug to get artist_id and page id
	const pageRes = await supabaseRpc(
		env,
		`capture_pages?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id,artist_id`,
		{},
	);
	if (!pageRes.ok) {
		return json({ error: "Lookup failed" }, 502);
	}

	const pages = (await pageRes.json()) as { id: string; artist_id: string }[];
	if (pages.length === 0) {
		return json({ error: "Page not found" }, 404);
	}

	const page = pages[0];
	const normalizedEmail = email.toLowerCase().trim();

	// Look up email template + artist timezone for delay calculation
	const templateRes = await supabaseRpc(
		env,
		`email_templates?capture_page_id=eq.${page.id}&is_active=eq.true&select=delay_mode`,
		{},
	);
	const templateRows = templateRes.ok
		? ((await templateRes.json()) as { delay_mode: string }[])
		: [];
	const delayMode = templateRows[0]?.delay_mode ?? "immediate";

	let sendAt: string | undefined;
	if (delayMode === "1_hour") {
		sendAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
	} else if (delayMode === "next_morning") {
		// Fetch artist timezone for correct 9am calculation
		const tzRes = await supabaseRpc(env, `artists?id=eq.${page.artist_id}&select=timezone`, {});
		const tzRows = tzRes.ok ? ((await tzRes.json()) as { timezone: string }[]) : [];
		const tz = tzRows[0]?.timezone ?? "America/New_York";
		sendAt = calculateNextMorning(tz);
	}

	// Upsert fan_captures — insert or update last_captured_at on conflict (artist_id, email)
	const upsertRes = await supabaseRpc(env, "fan_captures?on_conflict=artist_id,email", {
		method: "POST",
		headers: {
			Prefer: "return=representation,resolution=merge-duplicates",
		},
		body: {
			artist_id: page.artist_id,
			email: normalizedEmail,
			last_captured_at: new Date().toISOString(),
		},
	});

	if (!upsertRes.ok) {
		return json({ error: "Capture failed" }, 502);
	}

	const captures = (await upsertRes.json()) as { id: string }[];
	const fanCaptureId = captures[0].id;

	// Map entry_method shortcode to enum value
	const entryMethodMap: Record<string, string> = {
		d: "direct",
		q: "qr",
		n: "nfc",
		s: "sms",
	};

	// Insert capture event
	await supabaseRpc(env, "capture_events", {
		method: "POST",
		body: {
			fan_capture_id: fanCaptureId,
			capture_page_id: page.id,
			entry_method: entryMethodMap[method],
		},
	});

	// Insert pending email for follow-up (send_at based on template delay_mode)
	await supabaseRpc(env, "pending_emails", {
		method: "POST",
		body: {
			fan_capture_id: fanCaptureId,
			artist_id: page.artist_id,
			email: normalizedEmail,
			...(sendAt && { send_at: sendAt }),
		},
	});

	return json({ ok: true });
}

async function servePage(request: Request, slug: string, env: Env): Promise<Response> {
	const object = await env.PAGES.get(`c/${slug}/index.html`);
	if (!object) {
		return notFound();
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("ETag", object.httpEtag);
	headers.delete("Content-Encoding");
	headers.set("Content-Type", "text/html; charset=utf-8");
	headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

	if (request.method === "HEAD") {
		return new Response(null, { headers });
	}

	return new Response(object.body, { headers });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;

		// POST /api/capture — fan email submission
		if (pathname === "/api/capture") {
			return handleCapture(request, env);
		}

		// GET /c/{slug} — serve capture page
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		const match = pathname.match(/^\/c\/([a-z0-9][a-z0-9-]*[a-z0-9]?)(?:\/)?$/);
		if (!match) {
			return notFound();
		}

		return servePage(request, match[1], env);
	},
} satisfies ExportedHandler<Env>;
