import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// List captures with optional page filter
app.get("/", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.query("page_id");

	// Query capture_events joined with fan_captures and capture_pages
	let query = supabase
		.from("capture_events")
		.select(
			`
			id,
			entry_method,
			captured_at,
			fan_captures!inner ( id, email, name ),
			capture_pages!inner ( id, title, slug )
		`,
		)
		.eq("capture_pages.artist_id", artist.id)
		.order("captured_at", { ascending: false })
		.limit(500);

	if (pageId) {
		query = query.eq("capture_page_id", pageId);
	}

	const { data, error } = await query;

	if (error) return c.json({ error: error.message }, 500);

	// Flatten the joined shape for the frontend
	const rows = (data ?? []).map((row) => {
		const fan = row.fan_captures as unknown as { id: string; email: string; name: string | null };
		const page = row.capture_pages as unknown as { id: string; title: string; slug: string };
		return {
			id: row.id,
			email: fan.email,
			fan_name: fan.name,
			entry_method: row.entry_method,
			captured_at: row.captured_at,
			page_id: page.id,
			page_title: page.title,
			page_slug: page.slug,
		};
	});

	return c.json(rows);
});

// Get capture counts per page (for page cards)
app.get("/counts", async (c) => {
	const artist = c.get("artist");

	const { data, error } = await supabase
		.from("capture_events")
		.select(
			`
			capture_page_id,
			capture_pages!inner ( artist_id )
		`,
		)
		.eq("capture_pages.artist_id", artist.id);

	if (error) return c.json({ error: error.message }, 500);

	// Count per page
	const counts: Record<string, number> = {};
	for (const row of data ?? []) {
		const pageId = row.capture_page_id;
		counts[pageId] = (counts[pageId] ?? 0) + 1;
	}

	return c.json(counts);
});

export default app;
