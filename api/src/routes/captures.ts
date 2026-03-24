import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// List captures with optional filters
app.get("/", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.query("page_id");
	const method = c.req.query("method");
	const dateFrom = c.req.query("date_from");
	const dateTo = c.req.query("date_to");
	const search = c.req.query("search");

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
	if (method) {
		query = query.eq("entry_method", method);
	}
	if (dateFrom) {
		query = query.gte("captured_at", dateFrom);
	}
	if (dateTo) {
		// Include the full end day
		query = query.lte("captured_at", `${dateTo}T23:59:59.999Z`);
	}
	if (search) {
		query = query.ilike("fan_captures.email", `%${search}%`);
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

// CSV export of captures (same filters as list)
app.get("/export", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.query("page_id");
	const method = c.req.query("method");
	const dateFrom = c.req.query("date_from");
	const dateTo = c.req.query("date_to");
	const search = c.req.query("search");

	let query = supabase
		.from("capture_events")
		.select(
			`
			entry_method,
			captured_at,
			fan_captures!inner ( email, name ),
			capture_pages!inner ( title, slug )
		`,
		)
		.eq("capture_pages.artist_id", artist.id)
		.order("captured_at", { ascending: false });

	if (pageId) query = query.eq("capture_page_id", pageId);
	if (method) query = query.eq("entry_method", method);
	if (dateFrom) query = query.gte("captured_at", dateFrom);
	if (dateTo) query = query.lte("captured_at", `${dateTo}T23:59:59.999Z`);
	if (search) query = query.ilike("fan_captures.email", `%${search}%`);

	const { data, error } = await query;
	if (error) return c.json({ error: error.message }, 500);

	const rows = data ?? [];
	const csvLines = ["Email,Page,Method,Date"];

	for (const row of rows) {
		const fan = row.fan_captures as unknown as { email: string; name: string | null };
		const page = row.capture_pages as unknown as { title: string; slug: string };
		const date = new Date(row.captured_at).toISOString().slice(0, 19).replace("T", " ");
		csvLines.push(
			`"${fan.email}","${page.title.replace(/"/g, '""')}","${row.entry_method}","${date}"`,
		);
	}

	const csv = csvLines.join("\n");

	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": 'attachment; filename="fans.csv"',
		},
	});
});

export default app;
