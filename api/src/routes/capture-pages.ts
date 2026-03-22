import { Hono } from "hono";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const slugPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const createSchema = z.object({
	title: z.string().min(1).max(100),
	slug: z.string().min(1).max(40).regex(slugPattern).optional(),
	value_exchange_text: z.string().max(500).optional(),
	streaming_links: z.record(z.string(), z.string().url()).optional(),
	social_links: z.record(z.string(), z.string().url()).optional(),
	accent_color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

const updateSchema = createSchema.partial();

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

async function findUniqueSlug(base: string): Promise<string> {
	let slug = base;
	let suffix = 2;

	for (;;) {
		const { data } = await supabase
			.from("capture_pages")
			.select("id")
			.eq("slug", slug)
			.maybeSingle();

		if (!data) return slug;
		slug = `${base.slice(0, 36)}-${suffix}`;
		suffix++;
	}
}

// List
app.get("/", async (c) => {
	const artist = c.get("artist");
	const { data, error } = await supabase
		.from("capture_pages")
		.select("*")
		.eq("artist_id", artist.id)
		.order("created_at", { ascending: false });

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data);
});

// Create
app.post("/", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = createSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { title, value_exchange_text, streaming_links, social_links, accent_color } = parsed.data;
	const baseSlug = parsed.data.slug || slugify(title);
	const slug = await findUniqueSlug(baseSlug);

	const { data, error } = await supabase
		.from("capture_pages")
		.insert({
			artist_id: artist.id,
			title,
			slug,
			value_exchange_text: value_exchange_text ?? null,
			streaming_links: streaming_links ?? {},
			social_links: social_links ?? {},
			accent_color: accent_color ?? "#E8C547",
		})
		.select()
		.single();

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data, 201);
});

// Get single
app.get("/:id", async (c) => {
	const artist = c.get("artist");
	const { data, error } = await supabase
		.from("capture_pages")
		.select("*")
		.eq("id", c.req.param("id"))
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (error) return c.json({ error: error.message }, 500);
	if (!data) return c.json({ error: "Not found" }, 404);
	return c.json(data);
});

// Update
app.patch("/:id", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const updates = { ...parsed.data };

	if (updates.slug) {
		const { data: existing } = await supabase
			.from("capture_pages")
			.select("id")
			.eq("slug", updates.slug)
			.neq("id", c.req.param("id"))
			.maybeSingle();

		if (existing) return c.json({ error: "Slug already taken" }, 409);
	}

	const { data, error } = await supabase
		.from("capture_pages")
		.update(updates)
		.eq("id", c.req.param("id"))
		.eq("artist_id", artist.id)
		.select()
		.single();

	if (error) return c.json({ error: error.message }, 500);
	if (!data) return c.json({ error: "Not found" }, 404);
	return c.json(data);
});

// Delete
app.delete("/:id", async (c) => {
	const artist = c.get("artist");
	const { error } = await supabase
		.from("capture_pages")
		.delete()
		.eq("id", c.req.param("id"))
		.eq("artist_id", artist.id);

	if (error) return c.json({ error: error.message }, 500);
	return c.body(null, 204);
});

export default app;
