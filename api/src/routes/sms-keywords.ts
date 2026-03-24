import { Hono } from "hono";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const RESERVED_KEYWORDS = new Set([
	"STOP",
	"HELP",
	"END",
	"CANCEL",
	"QUIT",
	"UNSUBSCRIBE",
	"START",
	"INFO",
	"YES",
	"NO",
	"STOPALL",
	"OPTOUT",
]);

const PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER ?? "+10000000000";

const keywordSchema = z.object({
	keyword: z
		.string()
		.min(2)
		.max(20)
		.regex(/^[A-Za-z0-9]+$/, "Alphanumeric only")
		.transform((s) => s.toUpperCase()),
});

// Batch: all keywords for the artist
app.get("/keywords", async (c) => {
	const artist = c.get("artist");
	const { data, error } = await supabase
		.from("sms_keywords")
		.select("capture_page_id, keyword, phone_number")
		.eq("artist_id", artist.id);

	if (error) return c.json({ error: error.message }, 500);

	const map: Record<string, { keyword: string; phone_number: string }> = {};
	for (const row of data ?? []) {
		map[row.capture_page_id] = {
			keyword: row.keyword,
			phone_number: row.phone_number,
		};
	}
	return c.json(map);
});

// Get keyword for a page
app.get("/:id/keyword", async (c) => {
	const artist = c.get("artist");
	const { data, error } = await supabase
		.from("sms_keywords")
		.select("*")
		.eq("capture_page_id", c.req.param("id"))
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (error) return c.json({ error: error.message }, 500);
	if (!data) return c.json({ error: "No keyword set" }, 404);
	return c.json(data);
});

// Check availability + suggestions
app.post("/:id/keyword/check", async (c) => {
	const body = await c.req.json();
	const parsed = keywordSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { keyword } = parsed.data;

	if (RESERVED_KEYWORDS.has(keyword)) {
		return c.json({ available: false, reserved: true, suggestions: [] });
	}

	const pageId = c.req.param("id");
	const { data: existing } = await supabase
		.from("sms_keywords")
		.select("capture_page_id")
		.eq("keyword", keyword)
		.eq("phone_number", PHONE_NUMBER)
		.maybeSingle();

	if (!existing) {
		return c.json({ available: true });
	}

	if (existing.capture_page_id === pageId) {
		return c.json({ available: true, current: true });
	}

	const { data: page } = await supabase
		.from("capture_pages")
		.select("slug")
		.eq("id", pageId)
		.maybeSingle();

	const suggestions = await findSuggestions(keyword, page?.slug ?? "");
	return c.json({ available: false, suggestions });
});

// Claim or update keyword
app.put("/:id/keyword", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");
	const body = await c.req.json();
	const parsed = keywordSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { keyword } = parsed.data;

	if (RESERVED_KEYWORDS.has(keyword)) {
		return c.json({ error: "Reserved keyword", reserved: true }, 422);
	}

	// Verify page belongs to artist
	const { data: page } = await supabase
		.from("capture_pages")
		.select("id, slug")
		.eq("id", pageId)
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (!page) return c.json({ error: "Not found" }, 404);

	// Upsert — ON CONFLICT on capture_page_id
	const { data, error } = await supabase
		.from("sms_keywords")
		.upsert(
			{
				artist_id: artist.id,
				capture_page_id: pageId,
				keyword,
				phone_number: PHONE_NUMBER,
			},
			{ onConflict: "capture_page_id" },
		)
		.select()
		.single();

	if (error) {
		// Unique constraint on (keyword, phone_number) — keyword taken
		if (error.code === "23505") {
			const suggestions = await findSuggestions(keyword, page.slug);
			return c.json({ error: "Keyword taken", suggestions }, 409);
		}
		return c.json({ error: error.message }, 500);
	}

	return c.json(data);
});

// Release keyword
app.delete("/:id/keyword", async (c) => {
	const artist = c.get("artist");
	const { error } = await supabase
		.from("sms_keywords")
		.delete()
		.eq("capture_page_id", c.req.param("id"))
		.eq("artist_id", artist.id);

	if (error) return c.json({ error: error.message }, 500);
	return c.body(null, 204);
});

async function findSuggestions(keyword: string, slug: string): Promise<string[]> {
	const slugUpper = slug
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "")
		.slice(0, 20);
	const candidates = [`${keyword}1`, `${keyword}2`, slugUpper].filter(
		(c) => c.length >= 2 && c.length <= 20 && !RESERVED_KEYWORDS.has(c),
	);

	// Deduplicate
	const unique = [...new Set(candidates)];

	const { data } = await supabase
		.from("sms_keywords")
		.select("keyword")
		.eq("phone_number", PHONE_NUMBER)
		.in("keyword", unique);

	const taken = new Set(data?.map((r) => r.keyword) ?? []);
	return unique.filter((c) => !taken.has(c));
}

export default app;
