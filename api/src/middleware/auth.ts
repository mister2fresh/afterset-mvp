import { createMiddleware } from "hono/factory";
import { supabase } from "../lib/supabase.js";

export type Artist = {
	id: string;
	auth_id: string;
	email: string;
	name: string;
};

export type AuthEnv = { Variables: { artist: Artist } };

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
		.select("id, auth_id, email, name")
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
		})
		.select("id, auth_id, email, name")
		.single();

	if (insertErr || !created) {
		return c.json({ error: "Failed to create artist profile" }, 500);
	}

	c.set("artist", created as Artist);
	return next();
});
