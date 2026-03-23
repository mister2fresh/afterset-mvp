import { Hono } from "hono";
import { buildPage } from "../lib/build-page.js";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// Build single page
app.post("/:id/build", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	try {
		const result = await buildPage(pageId, artist.id);
		return c.json({ built: true, slug: result.slug, bytes: result.size });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Build failed";
		return c.json({ error: message }, 500);
	}
});

// Rebuild all pages for artist
app.post("/rebuild-all", async (c) => {
	const artist = c.get("artist");

	const { data: pages, error } = await supabase
		.from("capture_pages")
		.select("id")
		.eq("artist_id", artist.id)
		.eq("is_active", true);

	if (error) return c.json({ error: error.message }, 500);
	if (!pages?.length) return c.json({ built: 0 });

	const results = await Promise.allSettled(pages.map((p) => buildPage(p.id, artist.id)));

	const succeeded = results.filter((r) => r.status === "fulfilled").length;
	const failed = results.filter((r) => r.status === "rejected").length;

	return c.json({ built: succeeded, failed });
});

export default app;
