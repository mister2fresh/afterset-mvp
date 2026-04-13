import { Hono } from "hono";
import { z } from "zod";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import { getEffectiveTier, isTrialActive } from "../lib/tier.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const SETTINGS_COLUMNS = "id, name, email, timezone, onboarding_completed, tier, trial_ends_at";

// GET /settings — fetch artist profile + tier state
app.get("/", async (c) => {
	const artist = c.get("artist");

	const { data, error } = await supabase
		.from("artists")
		.select(SETTINGS_COLUMNS)
		.eq("id", artist.id)
		.single();

	if (error) return internalError(c, error);

	return c.json({
		...data,
		effective_tier: getEffectiveTier(data),
		is_trial: isTrialActive(data),
	});
});

const updateSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[^\r\n]*$/, "Must not contain newlines")
		.optional(),
	timezone: z.string().min(1).max(50).optional(),
	onboarding_completed: z.boolean().optional(),
});

// PATCH /settings — update artist profile (tier + trial_ends_at are not writable)
app.patch("/", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { data, error } = await supabase
		.from("artists")
		.update(parsed.data)
		.eq("id", artist.id)
		.select(SETTINGS_COLUMNS)
		.single();

	if (error) return internalError(c, error);

	return c.json({
		...data,
		effective_tier: getEffectiveTier(data),
		is_trial: isTrialActive(data),
	});
});

export default app;
