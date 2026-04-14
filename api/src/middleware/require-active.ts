import { createMiddleware } from "hono/factory";
import { getEffectiveTier } from "../lib/tier.js";
import type { AuthEnv } from "./auth.js";

export const requireActive = createMiddleware<AuthEnv>(async (c, next) => {
	const artist = c.get("artist");
	if (getEffectiveTier(artist) === "inactive") {
		return c.json(
			{
				error: "Your plan is inactive. Start a subscription to make changes.",
				inactive: true,
			},
			403,
		);
	}
	return next();
});
