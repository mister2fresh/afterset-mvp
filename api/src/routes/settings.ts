import { Hono } from "hono";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// GET /settings — fetch artist profile
app.get("/", async (c) => {
	const artist = c.get("artist");

	const { data, error } = await supabase
		.from("artists")
		.select("id, name, email, timezone, onboarding_completed")
		.eq("id", artist.id)
		.single();

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data);
});

const updateSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	timezone: z.string().min(1).max(50).optional(),
	onboarding_completed: z.boolean().optional(),
});

// PATCH /settings — update artist profile
app.patch("/", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { data, error } = await supabase
		.from("artists")
		.update(parsed.data)
		.eq("id", artist.id)
		.select("id, name, email, timezone, onboarding_completed")
		.single();

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data);
});

export default app;
