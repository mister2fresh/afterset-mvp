import { Hono } from "hono";
import { internalError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import { getTodayRange } from "../lib/timezone.js";
import type { AuthEnv } from "../middleware/auth.js";

type TitleGroup = {
	page_id: string | null;
	count: number;
	latest_capture: string;
	methods: Map<string, number>;
	daily: Map<string, number>;
};

function groupEventsByTitle(
	rows: {
		capture_page_id: string | null;
		page_title: string | null;
		entry_method: string;
		captured_at: string;
	}[],
): Map<string, TitleGroup> {
	const groups = new Map<string, TitleGroup>();
	for (const row of rows) {
		const title = row.page_title ?? "Unknown";
		let group = groups.get(title);
		if (!group) {
			group = {
				page_id: row.capture_page_id,
				count: 0,
				latest_capture: row.captured_at,
				methods: new Map(),
				daily: new Map(),
			};
			groups.set(title, group);
		}
		group.count++;
		if (row.captured_at > group.latest_capture) {
			group.latest_capture = row.captured_at;
		}
		group.methods.set(row.entry_method, (group.methods.get(row.entry_method) ?? 0) + 1);
		const date = row.captured_at.slice(0, 10);
		group.daily.set(date, (group.daily.get(date) ?? 0) + 1);
	}
	return groups;
}

const app = new Hono<AuthEnv>();

type MethodBreakdown = {
	method: string;
	count: number;
};

type DailyCount = {
	date: string;
	count: number;
};

type TonightMethods = { qr: number; sms: number; nfc: number; direct: number };

type TonightEmailStatus = {
	entered: number;
	sent: number;
	opened: number;
	open_rate: number;
};

/** Fetch email delivery status for a set of fan capture IDs. */
async function fetchEmailStatus(fanCaptureIds: string[]): Promise<TonightEmailStatus> {
	if (fanCaptureIds.length === 0) {
		return { entered: 0, sent: 0, opened: 0, open_rate: 0 };
	}
	const { data: emails } = await supabase
		.from("pending_emails")
		.select("status, opened_at")
		.in("fan_capture_id", fanCaptureIds);

	const all = emails ?? [];
	const sent = all.filter((e) => e.status === "sent" || e.status === "sending");
	const opened = sent.filter((e) => e.opened_at !== null);
	return {
		entered: fanCaptureIds.length,
		sent: sent.length,
		opened: opened.length,
		open_rate: sent.length > 0 ? opened.length / sent.length : 0,
	};
}

// GET /analytics/tonight — today's captures scoped to most recently updated page
app.get("/tonight", async (c) => {
	const artist = c.get("artist");

	const { data: artistRow } = await supabase
		.from("artists")
		.select("timezone")
		.eq("id", artist.id)
		.single();

	const tz = artistRow?.timezone ?? "America/New_York";
	const { start, end } = getTodayRange(tz);

	const { data: latestPage } = await supabase
		.from("capture_pages")
		.select("id, title")
		.eq("artist_id", artist.id)
		.order("updated_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!latestPage) {
		return c.json({
			page_title: null,
			page_id: null,
			new_fans: 0,
			methods: { qr: 0, sms: 0, nfc: 0, direct: 0 } satisfies TonightMethods,
			avg_per_show: 0,
			recent: [],
			email_status: { entered: 0, sent: 0, opened: 0, open_rate: 0 },
		});
	}

	const { data: todayEvents } = await supabase
		.from("capture_events")
		.select("id, fan_capture_id, entry_method, captured_at, fan_captures!inner(email, name)")
		.eq("capture_page_id", latestPage.id)
		.gte("captured_at", start)
		.lt("captured_at", end)
		.order("captured_at", { ascending: false });

	const events = todayEvents ?? [];

	const methods: TonightMethods = { qr: 0, sms: 0, nfc: 0, direct: 0 };
	for (const e of events) {
		if (e.entry_method in methods) methods[e.entry_method as keyof TonightMethods]++;
	}

	const recent = events.slice(0, 20).map((e) => {
		const fan = e.fan_captures as unknown as { email: string; name: string | null };
		return {
			id: e.id,
			fan_name: fan.name,
			email: fan.email,
			entry_method: e.entry_method,
			captured_at: e.captured_at,
		};
	});

	// Avg captures per show (unique page_titles)
	const { data: allCE } = await supabase
		.from("capture_events")
		.select("page_title, fan_captures!inner(artist_id)")
		.eq("fan_captures.artist_id", artist.id);

	const allRows = allCE ?? [];
	const uniqueTitles = new Set(allRows.map((r) => r.page_title)).size;
	const avgPerShow = uniqueTitles > 0 ? Math.round((allRows.length / uniqueTitles) * 10) / 10 : 0;

	const fanCaptureIds = [...new Set(events.map((e) => e.fan_capture_id))];
	const emailStatus = await fetchEmailStatus(fanCaptureIds);

	return c.json({
		page_title: latestPage.title,
		page_id: latestPage.id,
		new_fans: events.length,
		methods,
		avg_per_show: avgPerShow,
		recent,
		email_status: emailStatus,
	});
});

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

	if (error) return internalError(c, error);

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

	// Email stats — per-step breakdown
	const { data: ceRows } = await supabase
		.from("capture_events")
		.select("fan_capture_id")
		.eq("capture_page_id", pageId);

	const fanCaptureIds = [...new Set((ceRows ?? []).map((e) => e.fan_capture_id))];
	const { data: emailData } =
		fanCaptureIds.length > 0
			? await supabase
					.from("pending_emails")
					.select("opened_at, email_template_id")
					.eq("status", "sent")
					.in("fan_capture_id", fanCaptureIds)
			: { data: [] };

	const sentEmails = emailData ?? [];
	const emailSent = sentEmails.length;
	const emailOpened = sentEmails.filter((e) => e.opened_at !== null).length;

	// Per-step stats
	const { data: templates } = await supabase
		.from("email_templates")
		.select("id, sequence_order, subject")
		.eq("capture_page_id", pageId)
		.order("sequence_order", { ascending: true });

	const steps = (templates ?? []).map((t) => {
		const stepEmails = sentEmails.filter((e) => e.email_template_id === t.id);
		const stepOpened = stepEmails.filter((e) => e.opened_at !== null).length;
		return {
			sequence_order: t.sequence_order,
			subject: t.subject,
			sent: stepEmails.length,
			opened: stepOpened,
			open_rate: stepEmails.length > 0 ? stepOpened / stepEmails.length : 0,
		};
	});

	return c.json({
		total,
		methods,
		daily,
		email: {
			sent: emailSent,
			opened: emailOpened,
			open_rate: emailSent > 0 ? emailOpened / emailSent : 0,
			steps,
		},
	});
});

// GET /analytics/overview — aggregate stats across all pages
app.get("/", async (c) => {
	const artist = c.get("artist");

	const { data: pages } = await supabase
		.from("capture_pages")
		.select("id")
		.eq("artist_id", artist.id);

	const pageIds = (pages ?? []).map((p) => p.id);

	// Query through fan_captures to include events from deleted pages
	const { data: events } = await supabase
		.from("capture_events")
		.select(
			"id, fan_capture_id, capture_page_id, page_title, entry_method, captured_at, fan_captures!inner(artist_id)",
		)
		.eq("fan_captures.artist_id", artist.id);

	const rows = events ?? [];
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const thisWeek = rows.filter((r) => r.captured_at >= sevenDaysAgo).length;

	const titleGroups = groupEventsByTitle(rows);

	// Look up slugs for active pages
	const { data: pageDetails } =
		pageIds.length > 0
			? await supabase.from("capture_pages").select("id, slug").in("id", pageIds)
			: { data: [] };
	const pageSlugMap = new Map((pageDetails ?? []).map((p) => [p.id, p.slug]));

	// Email open stats per page_title — join through capture_event to get the correct title
	const { data: emailRows } = await supabase
		.from("pending_emails")
		.select("opened_at, capture_events!inner(page_title)")
		.eq("artist_id", artist.id)
		.eq("status", "sent");

	// Aggregate email stats per title
	const titleEmailSent = new Map<string, number>();
	const titleEmailOpened = new Map<string, number>();
	for (const email of emailRows ?? []) {
		const event = email.capture_events as unknown as { page_title: string | null };
		const title = event?.page_title ?? "Unknown";
		titleEmailSent.set(title, (titleEmailSent.get(title) ?? 0) + 1);
		if (email.opened_at) {
			titleEmailOpened.set(title, (titleEmailOpened.get(title) ?? 0) + 1);
		}
	}

	const pageStats = [...titleGroups.entries()]
		.map(([title, group]) => {
			const sent = titleEmailSent.get(title) ?? 0;
			const opened = titleEmailOpened.get(title) ?? 0;
			const methods = [...group.methods.entries()]
				.map(([method, count]) => ({ method, count }))
				.sort((a, b) => b.count - a.count);
			const daily = [...group.daily.entries()]
				.map(([date, count]) => ({ date, count }))
				.sort((a, b) => a.date.localeCompare(b.date));
			return {
				id: group.page_id,
				title,
				slug: group.page_id ? (pageSlugMap.get(group.page_id) ?? null) : null,
				latest_capture: group.latest_capture,
				captures: group.count,
				methods,
				daily,
				emails_sent: sent,
				emails_opened: opened,
				open_rate: sent > 0 ? opened / sent : 0,
			};
		})
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
