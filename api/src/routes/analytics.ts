import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

type MethodBreakdown = {
	method: string;
	count: number;
};

type DailyCount = {
	date: string;
	count: number;
};

// GET /capture-pages/:id/analytics
app.get("/:id/analytics", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	// Verify page belongs to artist
	const { data: page } = await supabase
		.from("capture_pages")
		.select("id")
		.eq("id", pageId)
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (!page) return c.json({ error: "Capture page not found" }, 404);

	// Fetch all capture events for this page
	const { data: events, error } = await supabase
		.from("capture_events")
		.select("entry_method, captured_at")
		.eq("capture_page_id", pageId)
		.order("captured_at", { ascending: true });

	if (error) return c.json({ error: error.message }, 500);

	const rows = events ?? [];
	const total = rows.length;

	// Method breakdown
	const methodCounts = new Map<string, number>();
	for (const row of rows) {
		const m = row.entry_method;
		methodCounts.set(m, (methodCounts.get(m) ?? 0) + 1);
	}
	const methods: MethodBreakdown[] = [...methodCounts.entries()]
		.map(([method, count]) => ({ method, count }))
		.sort((a, b) => b.count - a.count);

	// Daily time series (last 30 days)
	const dailyCounts = new Map<string, number>();
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
	thirtyDaysAgo.setHours(0, 0, 0, 0);

	// Pre-fill all 30 days with 0
	for (let i = 0; i < 30; i++) {
		const d = new Date(thirtyDaysAgo);
		d.setDate(d.getDate() + i);
		dailyCounts.set(d.toISOString().slice(0, 10), 0);
	}

	for (const row of rows) {
		const date = row.captured_at.slice(0, 10);
		if (dailyCounts.has(date)) {
			dailyCounts.set(date, dailyCounts.get(date)! + 1);
		}
	}

	const daily: DailyCount[] = [...dailyCounts.entries()].map(([date, count]) => ({
		date,
		count,
	}));

	return c.json({ total, methods, daily });
});

// GET /analytics/overview — aggregate stats across all pages
app.get("/", async (c) => {
	const artist = c.get("artist");

	const { data: pages } = await supabase
		.from("capture_pages")
		.select("id")
		.eq("artist_id", artist.id);

	const pageIds = (pages ?? []).map((p) => p.id);
	if (pageIds.length === 0) {
		return c.json({
			total_fans: 0,
			total_pages: 0,
			this_week: 0,
			pages: [],
			daily: [],
		});
	}

	const { data: events } = await supabase
		.from("capture_events")
		.select("capture_page_id, entry_method, captured_at")
		.in("capture_page_id", pageIds);

	const rows = events ?? [];
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const thisWeek = rows.filter((r) => r.captured_at >= sevenDaysAgo).length;

	// Per-page counts for ranking
	const pageCounts = new Map<string, number>();
	for (const row of rows) {
		const pid = row.capture_page_id;
		pageCounts.set(pid, (pageCounts.get(pid) ?? 0) + 1);
	}

	const { data: pageDetails } = await supabase
		.from("capture_pages")
		.select("id, title, slug")
		.in("id", pageIds);

	const pageStats = (pageDetails ?? [])
		.map((p) => ({
			id: p.id,
			title: p.title,
			slug: p.slug,
			captures: pageCounts.get(p.id) ?? 0,
		}))
		.sort((a, b) => b.captures - a.captures);

	// Daily time series (last 30 days) for growth chart
	const dailyCounts = new Map<string, number>();
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
	thirtyDaysAgo.setHours(0, 0, 0, 0);

	for (let i = 0; i < 30; i++) {
		const d = new Date(thirtyDaysAgo);
		d.setDate(d.getDate() + i);
		dailyCounts.set(d.toISOString().slice(0, 10), 0);
	}

	for (const row of rows) {
		const date = row.captured_at.slice(0, 10);
		if (dailyCounts.has(date)) {
			dailyCounts.set(date, dailyCounts.get(date)! + 1);
		}
	}

	const daily = [...dailyCounts.entries()].map(([date, count]) => ({ date, count }));

	return c.json({
		total_fans: rows.length,
		total_pages: pageIds.length,
		this_week: thisWeek,
		pages: pageStats,
		daily,
	});
});

export default app;
