import { Hono } from "hono";
import { z } from "zod";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import { getEffectiveTier, isTrialActive } from "../lib/tier.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const setTierSchema = z.object({
	tier: z.enum(["solo", "tour", "superstar"]),
	trialDays: z.number().int().min(0).max(365).optional(),
});

// POST /dev/set-tier — dev-only instant tier switch for local testing.
// Mounted from index.ts only when NODE_ENV !== 'production'.
app.post("/set-tier", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = setTierSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { tier, trialDays } = parsed.data;
	const trial_ends_at =
		trialDays && trialDays > 0
			? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
			: null;

	const { data, error } = await supabase
		.from("artists")
		.update({ tier, trial_ends_at })
		.eq("id", artist.id)
		.select("id, name, email, timezone, onboarding_completed, tier, trial_ends_at")
		.single();

	if (error) return internalError(c, error);

	return c.json({
		...data,
		effective_tier: getEffectiveTier(data),
		is_trial: isTrialActive(data),
	});
});

export default app;
