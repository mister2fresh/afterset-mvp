import { Hono } from "hono";
import { z } from "zod";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const createSchema = z.object({
	token: z.string().min(1).max(500),
	platform: z.enum(["ios", "android"]),
});

// POST / — register or update a device token
app.post("/", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = createSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { error } = await supabase.from("device_tokens").upsert(
		{
			artist_id: artist.id,
			token: parsed.data.token,
			platform: parsed.data.platform,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: "token" },
	);

	if (error) return internalError(c, error);
	return c.json({ ok: true }, 201);
});

// DELETE / — unregister a device token
app.delete("/", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = z.object({ token: z.string().min(1) }).safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { error } = await supabase
		.from("device_tokens")
		.delete()
		.eq("artist_id", artist.id)
		.eq("token", parsed.data.token);

	if (error) return internalError(c, error);
	return c.body(null, 204);
});

export default app;
