import type { Context } from "hono";
import { Hono } from "hono";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

type CaptureFilters = {
	pageId?: string;
	method?: string;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
};

function parseFilters(c: Context): CaptureFilters {
	return {
		pageId: c.req.query("page_id"),
		method: c.req.query("method"),
		dateFrom: c.req.query("date_from"),
		dateTo: c.req.query("date_to"),
		search: c.req.query("search"),
	};
}

function applyFilters<
	Q extends {
		eq: (...a: never[]) => Q;
		gte: (...a: never[]) => Q;
		lte: (...a: never[]) => Q;
		ilike: (...a: never[]) => Q;
	},
>(query: Q, filters: CaptureFilters): Q {
	if (filters.pageId) query = query.eq("capture_page_id" as never, filters.pageId as never);
	if (filters.method) query = query.eq("entry_method" as never, filters.method as never);
	if (filters.dateFrom) query = query.gte("captured_at" as never, filters.dateFrom as never);
	if (filters.dateTo)
		query = query.lte("captured_at" as never, `${filters.dateTo}T23:59:59.999Z` as never);
	if (filters.search)
		query = query.ilike("fan_captures.email" as never, `%${filters.search}%` as never);
	return query;
}

// List captures with optional filters
app.get("/", async (c) => {
	const artist = c.get("artist");
	const filters = parseFilters(c);

	let query = supabase
		.from("capture_events")
		.select(
			`
			id,
			entry_method,
			captured_at,
			page_title,
			fan_captures!inner ( id, email, name ),
			capture_pages ( id, title, slug )
		`,
		)
		.eq("fan_captures.artist_id", artist.id)
		.order("captured_at", { ascending: false })
		.limit(500);
	query = applyFilters(query, filters);

	const { data, error } = await query;

	if (error) return internalError(c, error);

	// Flatten the joined shape for the frontend
	const rows = (data ?? []).map((row) => {
		const fan = row.fan_captures as unknown as { id: string; email: string; name: string | null };
		const page = row.capture_pages as unknown as {
			id: string;
			title: string;
			slug: string;
		} | null;
		return {
			id: row.id,
			email: fan.email,
			fan_name: fan.name,
			entry_method: row.entry_method,
			captured_at: row.captured_at,
			page_id: page?.id ?? null,
			page_title: page?.title ?? row.page_title ?? "Deleted page",
			page_slug: page?.slug ?? null,
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

	if (error) return internalError(c, error);

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
	const filters = parseFilters(c);

	let query = supabase
		.from("capture_events")
		.select(
			`
			entry_method,
			captured_at,
			page_title,
			fan_captures!inner ( email, name ),
			capture_pages ( title, slug )
		`,
		)
		.eq("fan_captures.artist_id", artist.id)
		.order("captured_at", { ascending: false });
	query = applyFilters(query, filters);

	const { data, error } = await query;
	if (error) return internalError(c, error);

	const rows = data ?? [];
	const csvLines = ["Email,Page,Method,Date"];

	for (const row of rows) {
		const fan = row.fan_captures as unknown as { email: string; name: string | null };
		const page = row.capture_pages as unknown as { title: string; slug: string } | null;
		const pageTitle = page?.title ?? row.page_title ?? "Deleted page";
		const date = new Date(row.captured_at).toISOString().slice(0, 19).replace("T", " ");
		csvLines.push(
			`"${fan.email}","${pageTitle.replace(/"/g, '""')}","${row.entry_method}","${date}"`,
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
