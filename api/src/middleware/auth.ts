import { createMiddleware } from "hono/factory";
import { supabase } from "../lib/supabase.js";
import type { Tier } from "../lib/tier.js";

type Artist = {
	id: string;
	auth_id: string;
	email: string;
	name: string;
	onboarding_completed: boolean;
	tier: Tier;
	trial_ends_at: string | null;
};

export type AuthEnv = { Variables: { artist: Artist } };

const ARTIST_COLUMNS = "id, auth_id, email, name, onboarding_completed, tier, trial_ends_at";

const TRIAL_DAYS = 30;

function trialEnd(): string {
	return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export const auth = createMiddleware<AuthEnv>(async (c, next) => {
	const header = c.req.header("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return c.json({ error: "Missing authorization header" }, 401);
	}

	const token = header.slice(7);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);

	if (error || !user) {
		return c.json({ error: "Invalid or expired token" }, 401);
	}

	const { data: artist } = await supabase
		.from("artists")
		.select(ARTIST_COLUMNS)
		.eq("auth_id", user.id)
		.single();

	if (artist) {
		c.set("artist", artist as Artist);
		return next();
	}

	const { data: created, error: insertErr } = await supabase
		.from("artists")
		.insert({
			auth_id: user.id,
			email: user.email ?? "",
			name: user.email?.split("@")[0] ?? "",
			trial_ends_at: trialEnd(),
		})
		.select(ARTIST_COLUMNS)
		.single();

	if (insertErr || !created) {
		return c.json({ error: "Failed to create artist profile" }, 500);
	}

	c.set("artist", created as Artist);
	return next();
});
