import { type CaptureMethod, getEffectiveTier, type Tier, WORKER_TIER_LIMITS } from "./tier.js";

interface Env {
	PAGES: R2Bucket;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	ALLOWED_ORIGINS?: string;
	RATE_LIMITS?: KVNamespace;
}

// Rate limiting: 5 submissions per IP per slug per 60s window
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_S = 60;

// In-memory fallback (used when KV namespace is not configured)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = 0;

async function isRateLimited(env: Env, ip: string, slug: string): Promise<boolean> {
	if (env.RATE_LIMITS) {
		const key = `rl:${ip}:${slug}`;
		const current = await env.RATE_LIMITS.get(key);
		const count = current ? parseInt(current, 10) : 0;
		if (count >= RATE_LIMIT_MAX) return true;
		await env.RATE_LIMITS.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_S });
		return false;
	}

	const key = `${ip}:${slug}`;
	const now = Date.now();
	const windowMs = RATE_LIMIT_WINDOW_S * 1000;
	if (now - lastCleanup >= windowMs) {
		lastCleanup = now;
		for (const [k, e] of rateLimitMap) {
			if (now >= e.resetAt) rateLimitMap.delete(k);
		}
	}
	const entry = rateLimitMap.get(key);
	if (!entry || now >= entry.resetAt) {
		rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
		return false;
	}
	entry.count++;
	return entry.count > RATE_LIMIT_MAX;
}

function getTimezoneOffsetMs(timezone: string, date: Date): number {
	const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
	const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
	return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

function localNineAmToUtc(timezone: string, target: Date): string {
	const dateFormatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const dateStr = dateFormatter.format(target);
	const nineAm = new Date(`${dateStr}T09:00:00`);
	return new Date(nineAm.getTime() + getTimezoneOffsetMs(timezone, nineAm)).toISOString();
}

function calculateNextMorning(timezone: string): string {
	const now = new Date();
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "2-digit",
		hour12: false,
	});
	const localHour = Number.parseInt(formatter.format(now), 10);
	const target = new Date(now);
	target.setDate(target.getDate() + (localHour >= 9 ? 1 : 0));
	return localNineAmToUtc(timezone, target);
}

function calculateDaysSendAt(timezone: string, days: number): string {
	const target = new Date();
	target.setDate(target.getDate() + days);
	return localNineAmToUtc(timezone, target);
}

// UTC ISO start-of-month in a given timezone (mirrors api/src/lib/timezone.ts:getMonthRange).
function getMonthStartUtc(timezone: string): string {
	const now = new Date();
	const ymd = now.toLocaleDateString("en-CA", { timeZone: timezone });
	const [year, month] = ymd.split("-").map(Number);
	const firstUtc = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
	return new Date(
		new Date(firstUtc).getTime() + getTimezoneOffsetMs(timezone, new Date()),
	).toISOString();
}

type SequenceTemplate = {
	id: string;
	delay_mode: "immediate" | "1_hour" | "next_morning";
	delay_days: number;
	sequence_order: number;
};

function calculateSendAt(template: SequenceTemplate, timezone: string): string | undefined {
	if (template.sequence_order === 0) {
		if (template.delay_mode === "1_hour") {
			return new Date(Date.now() + 60 * 60 * 1000).toISOString();
		}
		if (template.delay_mode === "next_morning") return calculateNextMorning(timezone);
		return undefined; // immediate — DB defaults to now()
	}
	return calculateDaysSendAt(timezone, template.delay_days);
}

async function queueSequenceEmails(
	env: Env,
	templates: SequenceTemplate[],
	ctx: {
		fanCaptureId: string;
		captureEventId: string;
		artistId: string;
		email: string;
		timezone: string;
	},
): Promise<void> {
	if (templates.length === 0) return;

	const rows = templates.map((t) => {
		const sendAt = calculateSendAt(t, ctx.timezone);
		return {
			fan_capture_id: ctx.fanCaptureId,
			capture_event_id: ctx.captureEventId,
			artist_id: ctx.artistId,
			email: ctx.email,
			email_template_id: t.id,
			...(sendAt && { send_at: sendAt }),
		};
	});

	await supabaseRpc(env, "pending_emails", {
		method: "POST",
		headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
		body: rows,
	});
}

const ENTRY_METHOD_MAP = { d: "direct", q: "qr", n: "nfc", s: "sms" } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function getCorsHeaders(request: Request, env: Env): Record<string, string> {
	const origin = request.headers.get("Origin");
	const allowed = env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) ?? [];
	if (origin && allowed.includes(origin)) {
		return {
			"Access-Control-Allow-Origin": origin,
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};
	}
	return {};
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
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

type Submission = { email: string; slug: string; method: string };

async function parseSubmission(request: Request): Promise<Submission | Response> {
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
	if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]*[a-z0-9]?$/.test(slug)) {
		return json({ error: "Invalid slug" }, 400);
	}
	const method =
		typeof entry_method === "string" && entry_method in ENTRY_METHOD_MAP ? entry_method : "d";
	return { email: email.toLowerCase().trim(), slug, method };
}

type PageInfo = { id: string; artist_id: string; title: string };
type ArtistContext = {
	timezone: string;
	email: string;
	tier: Tier;
	trial_ends_at: string | null;
};

async function lookupPage(env: Env, slug: string): Promise<PageInfo | Response> {
	const pageRes = await supabaseRpc(
		env,
		`capture_pages?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id,artist_id,title`,
		{},
	);
	if (!pageRes.ok) return json({ error: "Lookup failed" }, 502);

	const pages = (await pageRes.json()) as PageInfo[];
	if (pages.length === 0) return json({ error: "Page not found" }, 404);
	return pages[0];
}

async function lookupArtistContext(env: Env, artistId: string): Promise<ArtistContext> {
	const res = await supabaseRpc(
		env,
		`artists?id=eq.${artistId}&select=timezone,email,tier,trial_ends_at`,
		{},
	);
	const rows = res.ok ? ((await res.json()) as ArtistContext[]) : [];
	return (
		rows[0] ?? {
			timezone: "America/New_York",
			email: "",
			tier: "superstar",
			trial_ends_at: null,
		}
	);
}

type PersistResult = {
	fanCaptureId: string;
	captureEventId: string;
	firstCapturedAt: string;
};

async function persistCapture(
	env: Env,
	page: PageInfo,
	email: string,
	method: string,
): Promise<PersistResult | Response> {
	const upsertRes = await supabaseRpc(env, "fan_captures?on_conflict=artist_id,email", {
		method: "POST",
		headers: { Prefer: "return=representation,resolution=merge-duplicates" },
		body: { artist_id: page.artist_id, email, last_captured_at: new Date().toISOString() },
	});
	if (!upsertRes.ok) return json({ error: "Capture failed" }, 502);

	const captures = (await upsertRes.json()) as { id: string; first_captured_at: string }[];
	const fanCaptureId = captures[0].id;
	const firstCapturedAt = captures[0].first_captured_at;

	const eventRes = await supabaseRpc(env, "capture_events", {
		method: "POST",
		headers: { Prefer: "return=representation" },
		body: {
			fan_capture_id: fanCaptureId,
			capture_page_id: page.id,
			entry_method: ENTRY_METHOD_MAP[method as keyof typeof ENTRY_METHOD_MAP],
			page_title: page.title,
		},
	});
	if (!eventRes.ok) return json({ error: "Event creation failed" }, 502);

	const events = (await eventRes.json()) as { id: string }[];
	return { fanCaptureId, captureEventId: events[0].id, firstCapturedAt };
}

// Count new fans this month and mark this capture's cap_exceeded_at if over the tier cap.
// Superstar (cap=null) short-circuits. Only runs for newly-created fan_captures rows this month.
async function maybeMarkOverCap(
	env: Env,
	artistId: string,
	fanCaptureId: string,
	firstCapturedAt: string,
	monthStart: string,
	fanCap: number | null,
): Promise<void> {
	if (fanCap === null) return;
	if (firstCapturedAt < monthStart) return; // returning fan — doesn't count toward monthly cap

	const countRes = await supabaseRpc(
		env,
		`fan_captures?artist_id=eq.${artistId}&first_captured_at=gte.${encodeURIComponent(monthStart)}&select=id`,
		{ headers: { Prefer: "count=exact", Range: "0-0", "Range-Unit": "items" } },
	);
	const contentRange = countRes.headers.get("content-range") ?? "";
	const total = Number.parseInt(contentRange.split("/")[1] ?? "0", 10);
	if (total <= fanCap) return;

	await supabaseRpc(env, `fan_captures?id=eq.${fanCaptureId}`, {
		method: "PATCH",
		body: { cap_exceeded_at: new Date().toISOString() },
	});
	// First-crossing artist notification is deferred — detection is available via
	// the first fan_captures row this month with cap_exceeded_at IS NOT NULL.
	// Implementing the email requires a schema addition (pending_emails system-kind
	// fields) tracked as a follow-up task.
}

// Capture-to-drip flow:
// 1. Fan submits email via capture page form → POST /api/capture
// 2. parseSubmission() validates email + slug, lookupPage() finds the capture page
// 3. persistCapture() upserts fan_captures (deduped per artist) and creates a capture_event
// 4. Worker fetches all active email_templates for this page (ordered by sequence_order)
// 5. queueSequenceEmails() inserts rows into pending_emails with calculated send_at times:
//    - Step 0: immediate, +1h, or next-morning based on template.delay_mode
//    - Steps 1+: artist-local 9am on day N (template.delay_days)
// 6. pg_cron runs send-batch every minute, which claims and sends due pending_emails via Resend
async function handleCapture(request: Request, env: Env): Promise<Response> {
	const cors = getCorsHeaders(request, env);
	const withCors = (res: Response): Response => {
		for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
		return res;
	};

	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: cors });
	}
	if (request.method !== "POST") return withCors(json({ error: "Method not allowed" }, 405));

	const submission = await parseSubmission(request);
	if (submission instanceof Response) return withCors(submission);

	const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
	if (await isRateLimited(env, clientIp, submission.slug)) {
		return withCors(
			json({ error: "Too many submissions. Please wait a minute and try again." }, 429),
		);
	}

	const page = await lookupPage(env, submission.slug);
	if (page instanceof Response) return withCors(page);

	const [templateRes, artist] = await Promise.all([
		supabaseRpc(
			env,
			`email_templates?capture_page_id=eq.${page.id}&is_active=eq.true&select=id,delay_mode,delay_days,sequence_order&order=sequence_order.asc`,
			{},
		),
		lookupArtistContext(env, page.artist_id),
	]);
	const allTemplates = templateRes.ok ? ((await templateRes.json()) as SequenceTemplate[]) : [];

	const effectiveTier = getEffectiveTier(artist);
	const tierLimits = WORKER_TIER_LIMITS[effectiveTier];

	// Capture method gate. Solo rejects SMS (403) and soft-accepts NFC as direct
	// so physical tags already in the wild keep working after downgrade.
	let method = submission.method;
	const longMethod = ENTRY_METHOD_MAP[method as keyof typeof ENTRY_METHOD_MAP];
	const allowed: readonly CaptureMethod[] = tierLimits.captureMethods;
	if (!allowed.includes(longMethod)) {
		if (longMethod === "nfc") {
			method = "d";
		} else {
			return withCors(
				json(
					{
						error: "Text-to-Join is not available on this plan.",
						upgrade: true,
						required_tier: "tour",
					},
					403,
				),
			);
		}
	}

	const templates = allTemplates.filter((t) => t.sequence_order < tierLimits.sequenceDepth);

	const capture = await persistCapture(env, page, submission.email, method);
	if (capture instanceof Response) return withCors(capture);

	await maybeMarkOverCap(
		env,
		page.artist_id,
		capture.fanCaptureId,
		capture.firstCapturedAt,
		getMonthStartUtc(artist.timezone),
		tierLimits.fanCap,
	);

	await queueSequenceEmails(env, templates, {
		fanCaptureId: capture.fanCaptureId,
		captureEventId: capture.captureEventId,
		artistId: page.artist_id,
		email: submission.email,
		timezone: artist.timezone,
	});

	return withCors(json({ ok: true }));
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
