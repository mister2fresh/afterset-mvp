import { Hono } from "hono";
import { z } from "zod";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";
import { requireActive } from "../middleware/require-active.js";

const app = new Hono<AuthEnv>();

const skipReasonSchema = z.enum(["email_cap", "tier_locked", "stale", "no_plan"]);
type SkipReason = z.infer<typeof skipReasonSchema>;

type PausedRow = {
	id: string;
	skip_reason: SkipReason;
	skip_reason_at: string | null;
	send_at: string;
	fan_email: string;
	fan_name: string | null;
	page_id: string | null;
	page_title: string | null;
	sequence_order: number | null;
	broadcast_id: string | null;
	broadcast_subject: string | null;
};

// Joined row shape from supabase. Related tables return either an object or null
// when `select` uses a single-row relationship; capture_events may resolve to an
// array shape, so we normalize.
type JoinedRow = {
	id: string;
	skip_reason: string;
	skip_reason_at: string | null;
	send_at: string;
	email: string;
	broadcast_id: string | null;
	email_templates: { sequence_order: number; capture_page_id: string | null } | null;
	broadcasts: { subject: string | null } | null;
	capture_events: {
		page_title: string | null;
		capture_page_id: string | null;
		fan_captures: { name: string | null } | null;
	} | null;
};

function normalizeRow(row: JoinedRow): PausedRow {
	const reason = skipReasonSchema.parse(row.skip_reason);
	const event = row.capture_events;
	const template = row.email_templates;
	return {
		id: row.id,
		skip_reason: reason,
		skip_reason_at: row.skip_reason_at,
		send_at: row.send_at,
		fan_email: row.email,
		fan_name: event?.fan_captures?.name ?? null,
		page_id: event?.capture_page_id ?? template?.capture_page_id ?? null,
		page_title: event?.page_title ?? null,
		sequence_order: template?.sequence_order ?? null,
		broadcast_id: row.broadcast_id,
		broadcast_subject: row.broadcasts?.subject ?? null,
	};
}

// GET /api/paused-emails — list rows the send path skipped, with context for artist UI.
app.get("/", async (c) => {
	const artist = c.get("artist");
	const reasonFilter = c.req.query("reason");

	let query = supabase
		.from("pending_emails")
		.select(
			`
			id,
			skip_reason,
			skip_reason_at,
			send_at,
			email,
			broadcast_id,
			email_templates ( sequence_order, capture_page_id ),
			broadcasts ( subject ),
			capture_events (
				page_title,
				capture_page_id,
				fan_captures ( name )
			)
		`,
		)
		.eq("artist_id", artist.id)
		.not("skip_reason", "is", null)
		.order("skip_reason_at", { ascending: false, nullsFirst: false })
		.limit(500);

	if (reasonFilter) {
		const parsed = skipReasonSchema.safeParse(reasonFilter);
		if (!parsed.success) return c.json({ error: "Invalid reason" }, 400);
		query = query.eq("skip_reason", parsed.data);
	}

	const { data, error } = await query;
	if (error) return internalError(c, error);

	const rows = (data ?? []).map((row) => normalizeRow(row as unknown as JoinedRow));
	return c.json(rows);
});

// DELETE /api/paused-emails?reason=<reason> — hard-delete all paused rows for the artist
// matching the given skip_reason. Gated by requireActive so inactive artists can't clear
// their own "no_plan" backlog (artifact resolves on upgrade anyway).
app.delete("/", requireActive, async (c) => {
	const artist = c.get("artist");
	const reasonRaw = c.req.query("reason");
	const parsed = skipReasonSchema.safeParse(reasonRaw);
	if (!parsed.success) return c.json({ error: "Invalid or missing reason" }, 400);

	const { error, count } = await supabase
		.from("pending_emails")
		.delete({ count: "exact" })
		.eq("artist_id", artist.id)
		.eq("skip_reason", parsed.data);

	if (error) return internalError(c, error);
	return c.json({ deleted: count ?? 0 });
});

export default app;
