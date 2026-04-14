import { Hono } from "hono";
import { buildPage } from "../lib/build-page.js";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";
import { requireActive } from "../middleware/require-active.js";

const app = new Hono<AuthEnv>();

// Build single page
app.post("/:id/build", requireActive, async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	try {
		const result = await buildPage(pageId, artist.id);
		return c.json({ built: true, slug: result.slug, bytes: result.size });
	} catch (err) {
		return internalError(c, err);
	}
});

// Rebuild all pages for artist
app.post("/rebuild-all", requireActive, async (c) => {
	const artist = c.get("artist");

	const { data: pages, error } = await supabase
		.from("capture_pages")
		.select("id")
		.eq("artist_id", artist.id)
		.eq("is_active", true);

	if (error) return internalError(c, error);
	if (!pages?.length) return c.json({ built: 0 });

	const results = await Promise.allSettled(pages.map((p) => buildPage(p.id, artist.id)));

	const succeeded = results.filter((r) => r.status === "fulfilled").length;
	const failed = results.filter((r) => r.status === "rejected").length;

	return c.json({ built: succeeded, failed });
});

export default app;
