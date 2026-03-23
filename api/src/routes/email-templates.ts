import { Hono } from "hono";
import { z } from "zod";
import { renderFollowUpHtml } from "../lib/email/render-template.js";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const upsertSchema = z.object({
	subject: z.string().min(1).max(200),
	body: z.string().min(1).max(5000),
	include_incentive_link: z.boolean().optional(),
	delay_mode: z.enum(["immediate", "1_hour", "next_morning"]).optional(),
	is_active: z.boolean().optional(),
});

// GET /capture-pages/:id/email-template
app.get("/:id/email-template", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const { data, error } = await supabase
		.from("email_templates")
		.select("*")
		.eq("capture_page_id", pageId)
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (error) return c.json({ error: error.message }, 500);
	if (!data) return c.json({ error: "No template" }, 404);
	return c.json(data);
});

// PUT /capture-pages/:id/email-template (upsert)
app.put("/:id/email-template", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const body = await c.req.json();
	const parsed = upsertSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	// Verify page belongs to artist
	const { data: page } = await supabase
		.from("capture_pages")
		.select("id")
		.eq("id", pageId)
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (!page) return c.json({ error: "Capture page not found" }, 404);

	const row = {
		capture_page_id: pageId,
		artist_id: artist.id,
		subject: parsed.data.subject,
		body: parsed.data.body,
		include_incentive_link: parsed.data.include_incentive_link ?? false,
		delay_mode: parsed.data.delay_mode ?? "immediate",
		is_active: parsed.data.is_active ?? false,
	};

	const { data, error } = await supabase
		.from("email_templates")
		.upsert(row, { onConflict: "capture_page_id" })
		.select()
		.single();

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data);
});

// DELETE /capture-pages/:id/email-template
app.delete("/:id/email-template", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const { error } = await supabase
		.from("email_templates")
		.delete()
		.eq("capture_page_id", pageId)
		.eq("artist_id", artist.id);

	if (error) return c.json({ error: error.message }, 500);
	return c.body(null, 204);
});

// POST /capture-pages/:id/email-template/preview — returns rendered HTML
app.post("/:id/email-template/preview", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = upsertSchema.pick({ subject: true, body: true }).safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const html = renderFollowUpHtml({
		artistName: artist.name,
		body: parsed.data.body,
		incentiveUrl: body.include_incentive_link ? "https://example.com/download" : undefined,
	});

	return c.html(html);
});

export default app;
