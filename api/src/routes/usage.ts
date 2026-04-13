import { Hono } from "hono";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import { getEffectiveTier, getTierLimits, isTrialActive } from "../lib/tier.js";
import { getMonthRange } from "../lib/timezone.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const headCount = (res: { count: number | null }): number => res.count ?? 0;

// GET /api/usage — month-scoped usage counters for the current artist.
app.get("/", async (c) => {
	const artist = c.get("artist");
	const effectiveTier = getEffectiveTier(artist);
	const limits = getTierLimits(effectiveTier);

	const { data: artistRow, error: artistErr } = await supabase
		.from("artists")
		.select("timezone")
		.eq("id", artist.id)
		.single();
	if (artistErr) return internalError(c, artistErr);

	const tz = artistRow?.timezone ?? "America/New_York";
	const { start: monthStart } = getMonthRange(tz);

	const [
		fansUsed,
		fansOverCap,
		emailsSent,
		pausedEmailCap,
		pausedTierLocked,
		pausedStale,
		broadcastsUsed,
		storageRows,
	] = await Promise.all([
		supabase
			.from("fan_captures")
			.select("id", { count: "exact", head: true })
			.eq("artist_id", artist.id)
			.gte("first_captured_at", monthStart)
			.then(headCount),
		supabase
			.from("fan_captures")
			.select("id", { count: "exact", head: true })
			.eq("artist_id", artist.id)
			.gte("first_captured_at", monthStart)
			.not("cap_exceeded_at", "is", null)
			.then(headCount),
		supabase
			.from("pending_emails")
			.select("id", { count: "exact", head: true })
			.eq("artist_id", artist.id)
			.eq("status", "sent")
			.gte("updated_at", monthStart)
			.then(headCount),
		supabase
			.from("pending_emails")
			.select("id", { count: "exact", head: true })
			.eq("artist_id", artist.id)
			.eq("skip_reason", "email_cap")
			.then(headCount),
		supabase
			.from("pending_emails")
			.select("id", { count: "exact", head: true })
			.eq("artist_id", artist.id)
			.eq("skip_reason", "tier_locked")
			.then(headCount),
		supabase
			.from("pending_emails")
			.select("id", { count: "exact", head: true })
			.eq("artist_id", artist.id)
			.eq("skip_reason", "stale")
			.then(headCount),
		supabase
			.from("broadcasts")
			.select("id", { count: "exact", head: true })
			.eq("artist_id", artist.id)
			.in("status", ["sending", "sent", "scheduled"])
			.gte("updated_at", monthStart)
			.then(headCount),
		supabase.from("capture_pages").select("incentive_file_size").eq("artist_id", artist.id),
	]);

	const storageBytes = (storageRows.data ?? []).reduce(
		(sum, row) => sum + (row.incentive_file_size ?? 0),
		0,
	);

	return c.json({
		tier: artist.tier,
		effective_tier: effectiveTier,
		is_trial: isTrialActive(artist),
		fans: {
			used: fansUsed,
			limit: limits.fanCap,
			cap_exceeded_count: fansOverCap,
		},
		emails: {
			used: emailsSent,
			limit: limits.emailCap,
			paused_count: pausedEmailCap + pausedTierLocked + pausedStale,
			paused_by_reason: {
				email_cap: pausedEmailCap,
				tier_locked: pausedTierLocked,
				stale: pausedStale,
			},
		},
		broadcasts: {
			used: broadcastsUsed,
			limit: Number.isFinite(limits.broadcastsPerMonth) ? limits.broadcastsPerMonth : null,
		},
		storage: {
			used_mb: Math.round((storageBytes / (1024 * 1024)) * 100) / 100,
			limit_mb: limits.storageMb,
		},
	});
});

export default app;
