import { Hono } from "hono";
import { z } from "zod";
import { renderFollowUpHtml, toEmailTheme } from "../lib/email/render-template.js";
import { filterSuppressed } from "../lib/email/suppression.js";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import { getEffectiveTier, getTierLimits, type Tier } from "../lib/tier.js";
import { getMonthRange } from "../lib/timezone.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const MAX_RECIPIENTS = 5000;

type TierArtist = { id: string; tier: Tier; trial_ends_at: string | null; timezone?: string };

function stripAdvancedFilters<T extends Record<string, unknown>>(data: T): T {
	const { filter_date_from, filter_date_to, filter_method, ...rest } = data;
	return rest as T;
}

const broadcastSchema = z.object({
	subject: z
		.string()
		.max(200)
		.regex(/^[^\r\n]*$/, "Must not contain newlines")
		.optional(),
	body: z.string().max(5000).optional(),
	reply_to: z.string().email().nullable().optional(),
	scheduled_at: z.string().datetime().nullable().optional(),
	filter_page_ids: z.array(z.string().uuid()).nullable().optional(),
	filter_date_from: z.string().datetime().nullable().optional(),
	filter_date_to: z.string().datetime().nullable().optional(),
	filter_method: z.enum(["qr", "nfc", "sms", "direct"]).nullable().optional(),
});

// GET /broadcasts — list all for artist (excludes archived by default)
app.get("/", async (c) => {
	const artist = c.get("artist");
	const includeArchived = c.req.query("archived") === "true";

	let query = supabase
		.from("broadcasts")
		.select("*")
		.eq("artist_id", artist.id)
		.order("created_at", { ascending: false });

	if (!includeArchived) {
		query = query.is("archived_at", null);
	}

	const { data, error } = await query;
	if (error) return internalError(c, error);
	return c.json(data ?? []);
});

// POST /broadcasts — create draft
app.post("/", async (c) => {
	const artist = c.get("artist");
	const effectiveTier = getEffectiveTier(artist);
	const limits = getTierLimits(effectiveTier);
	if (limits.broadcastsPerMonth === 0) {
		return c.json(
			{
				error: "Broadcasts are available on Tour and Superstar.",
				upgrade: true,
				required_tier: "tour",
			},
			403,
		);
	}

	const body = await c.req.json().catch(() => ({}));
	const parsed = broadcastSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const payload = limits.hasAdvancedSegmentation ? parsed.data : stripAdvancedFilters(parsed.data);

	const { data, error } = await supabase
		.from("broadcasts")
		.insert({ artist_id: artist.id, ...payload })
		.select()
		.single();

	if (error) return internalError(c, error);
	return c.json(data, 201);
});

// GET /broadcasts/:id
app.get("/:id", async (c) => {
	const artist = c.get("artist");
	const id = c.req.param("id");

	const { data, error } = await supabase
		.from("broadcasts")
		.select("*")
		.eq("id", id)
		.eq("artist_id", artist.id)
		.single();

	if (error) return c.json({ error: "Broadcast not found" }, 404);
	return c.json(data);
});

// PUT /broadcasts/:id — update draft
app.put("/:id", async (c) => {
	const artist = c.get("artist");
	const id = c.req.param("id");
	const body = await c.req.json();
	const parsed = broadcastSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { data: existing } = await supabase
		.from("broadcasts")
		.select("status")
		.eq("id", id)
		.eq("artist_id", artist.id)
		.single();

	if (!existing) return c.json({ error: "Broadcast not found" }, 404);
	if (existing.status !== "draft") {
		return c.json({ error: "Only drafts can be edited" }, 400);
	}

	const limits = getTierLimits(getEffectiveTier(artist));
	const payload = limits.hasAdvancedSegmentation ? parsed.data : stripAdvancedFilters(parsed.data);

	const { data, error } = await supabase
		.from("broadcasts")
		.update(payload)
		.eq("id", id)
		.select()
		.single();

	if (error) return internalError(c, error);
	return c.json(data);
});

// DELETE /broadcasts/:id — delete draft only
app.delete("/:id", async (c) => {
	const artist = c.get("artist");
	const id = c.req.param("id");

	const { data: existing } = await supabase
		.from("broadcasts")
		.select("status")
		.eq("id", id)
		.eq("artist_id", artist.id)
		.single();

	if (!existing) return c.json({ error: "Broadcast not found" }, 404);
	if (existing.status !== "draft") {
		return c.json({ error: "Only drafts can be deleted" }, 400);
	}

	const { error } = await supabase.from("broadcasts").delete().eq("id", id);
	if (error) return internalError(c, error);
	return c.body(null, 204);
});

// POST /broadcasts/:id/archive — archive a sent/failed broadcast
app.post("/:id/archive", async (c) => {
	const artist = c.get("artist");
	const id = c.req.param("id");

	const { data: existing } = await supabase
		.from("broadcasts")
		.select("status")
		.eq("id", id)
		.eq("artist_id", artist.id)
		.single();

	if (!existing) return c.json({ error: "Broadcast not found" }, 404);
	if (existing.status === "draft") {
		return c.json({ error: "Delete drafts instead of archiving" }, 400);
	}

	const { data, error } = await supabase
		.from("broadcasts")
		.update({ archived_at: new Date().toISOString() })
		.eq("id", id)
		.select()
		.single();

	if (error) return internalError(c, error);
	return c.json(data);
});

// POST /broadcasts/:id/unarchive — restore an archived broadcast
app.post("/:id/unarchive", async (c) => {
	const artist = c.get("artist");
	const id = c.req.param("id");

	const { data, error } = await supabase
		.from("broadcasts")
		.update({ archived_at: null })
		.eq("id", id)
		.eq("artist_id", artist.id)
		.select()
		.single();

	if (error) return internalError(c, error);
	return c.json(data);
});

// POST /broadcasts/:id/preview — render HTML
app.post("/:id/preview", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = z.object({ subject: z.string().min(1), body: z.string().min(1) }).safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { data: latestPage } = await supabase
		.from("capture_pages")
		.select("accent_color, bg_color, text_color, button_style, streaming_links, social_links")
		.eq("artist_id", artist.id)
		.order("updated_at", { ascending: false })
		.limit(1)
		.single();

	const html = renderFollowUpHtml({
		artistName: artist.name,
		body: parsed.data.body,
		theme: latestPage ? toEmailTheme(latestPage) : undefined,
		streamingLinks: (latestPage?.streaming_links as Record<string, string>) ?? undefined,
		socialLinks: (latestPage?.social_links as Record<string, string>) ?? undefined,
	});

	return c.html(html);
});

// POST /broadcasts/:id/recipients — count matching fans (dry run)
app.post("/:id/recipients", async (c) => {
	const artist = c.get("artist");
	const id = c.req.param("id");

	const { data: broadcast } = await supabase
		.from("broadcasts")
		.select("*")
		.eq("id", id)
		.eq("artist_id", artist.id)
		.single();

	if (!broadcast) return c.json({ error: "Broadcast not found" }, 404);

	const fans = await queryRecipients(artist.id, broadcast);
	const emails = fans.map((f) => f.email);
	const suppressed =
		emails.length > 0 ? await filterSuppressed(emails, artist.id) : new Set<string>();

	return c.json({
		total: fans.length,
		suppressed: suppressed.size,
		reachable: fans.length - suppressed.size,
	});
});

// POST /broadcasts/:id/send — enqueue broadcast
app.post("/:id/send", async (c) => {
	const artist = c.get("artist");
	const id = c.req.param("id");

	const { data: broadcast } = await supabase
		.from("broadcasts")
		.select("*")
		.eq("id", id)
		.eq("artist_id", artist.id)
		.single();

	if (!broadcast) return c.json({ error: "Broadcast not found" }, 404);
	if (broadcast.status !== "draft") {
		return c.json({ error: "Only drafts can be sent" }, 400);
	}
	if (!broadcast.subject || !broadcast.body) {
		return c.json({ error: "Subject and body are required" }, 400);
	}

	const effectiveTier = getEffectiveTier(artist);
	const limits = getTierLimits(effectiveTier);
	if (limits.broadcastsPerMonth === 0) {
		return c.json(
			{ error: "Broadcasts require Tour or Superstar.", upgrade: true, required_tier: "tour" },
			403,
		);
	}

	const monthErr = await checkMonthlyBroadcastLimit(artist, limits.broadcastsPerMonth);
	if (monthErr) return c.json({ error: monthErr, upgrade: true }, 429);

	const filters = limits.hasAdvancedSegmentation ? broadcast : stripAdvancedFilters(broadcast);
	const fans = await queryRecipients(artist.id, filters);
	const emails = fans.map((f) => f.email);
	const suppressed =
		emails.length > 0 ? await filterSuppressed(emails, artist.id) : new Set<string>();
	const reachable = fans.filter((f) => !suppressed.has(f.email));

	if (reachable.length === 0) {
		return c.json({ error: "No reachable recipients" }, 400);
	}
	if (reachable.length > MAX_RECIPIENTS) {
		return c.json({ error: `Exceeds max ${MAX_RECIPIENTS} recipients` }, 400);
	}

	const capErr = await checkMonthlyEmailCap(artist, reachable.length, limits.emailCap);
	if (capErr) {
		return c.json({ error: capErr, upgrade: true, required_tier: "superstar" }, 429);
	}

	const sendAt = broadcast.scheduled_at ?? new Date().toISOString();
	const isScheduled = broadcast.scheduled_at && new Date(broadcast.scheduled_at) > new Date();

	const rows = reachable.map((fan) => ({
		fan_capture_id: fan.id,
		artist_id: artist.id,
		email: fan.email,
		broadcast_id: id,
		send_at: sendAt,
		status: "pending" as const,
	}));

	const { error: insertErr } = await supabase.from("pending_emails").insert(rows);
	if (insertErr) return internalError(c, insertErr);

	const newStatus = isScheduled ? "scheduled" : "sending";
	await supabase
		.from("broadcasts")
		.update({ status: newStatus, recipient_count: reachable.length })
		.eq("id", id);

	return c.json({ queued: reachable.length, status: newStatus });
});

type BroadcastFilters = {
	filter_page_ids: string[] | null;
	filter_date_from: string | null;
	filter_date_to: string | null;
	filter_method: string | null;
};

async function queryRecipients(
	artistId: string,
	filters: BroadcastFilters,
): Promise<{ id: string; email: string }[]> {
	let query = supabase.from("fan_captures").select("id, email").eq("artist_id", artistId);

	if (filters.filter_date_from) {
		query = query.gte("first_captured_at", filters.filter_date_from);
	}
	if (filters.filter_date_to) {
		query = query.lte("first_captured_at", filters.filter_date_to);
	}

	const { data: fans } = await query;
	if (!fans || fans.length === 0) return [];

	// If no page/method filters, return all fans
	if (!filters.filter_page_ids?.length && !filters.filter_method) {
		return fans;
	}

	// Filter by capture events for page/method constraints
	const fanIds = fans.map((f) => f.id);
	let eventsQuery = supabase
		.from("capture_events")
		.select("fan_capture_id")
		.in("fan_capture_id", fanIds);

	if (filters.filter_page_ids?.length) {
		eventsQuery = eventsQuery.in("capture_page_id", filters.filter_page_ids);
	}
	if (filters.filter_method) {
		eventsQuery = eventsQuery.eq("entry_method", filters.filter_method);
	}

	const { data: events } = await eventsQuery;
	const matchingFanIds = new Set((events ?? []).map((e) => e.fan_capture_id));

	return fans.filter((f) => matchingFanIds.has(f.id));
}

async function getArtistTimezone(artistId: string): Promise<string> {
	const { data } = await supabase.from("artists").select("timezone").eq("id", artistId).single();
	return data?.timezone ?? "America/New_York";
}

async function checkMonthlyBroadcastLimit(
	artist: TierArtist,
	perMonth: number,
): Promise<string | null> {
	if (!Number.isFinite(perMonth)) return null;
	const tz = artist.timezone ?? (await getArtistTimezone(artist.id));
	const { start } = getMonthRange(tz);

	const { count } = await supabase
		.from("broadcasts")
		.select("id", { count: "exact", head: true })
		.eq("artist_id", artist.id)
		.in("status", ["sending", "sent", "scheduled"])
		.gte("updated_at", start);

	if ((count ?? 0) >= perMonth) {
		return `You've used all ${perMonth} broadcasts this month.`;
	}
	return null;
}

async function checkMonthlyEmailCap(
	artist: TierArtist,
	addCount: number,
	emailCap: number,
): Promise<string | null> {
	if (!Number.isFinite(emailCap)) return null;
	const tz = artist.timezone ?? (await getArtistTimezone(artist.id));
	const { start } = getMonthRange(tz);

	const { count } = await supabase
		.from("pending_emails")
		.select("id", { count: "exact", head: true })
		.eq("artist_id", artist.id)
		.eq("status", "sent")
		.gte("updated_at", start);

	const alreadySent = count ?? 0;
	if (alreadySent + addCount > emailCap) {
		return `This broadcast would exceed your ${emailCap.toLocaleString()}-email monthly limit (${alreadySent} already sent).`;
	}
	return null;
}

export default app;
