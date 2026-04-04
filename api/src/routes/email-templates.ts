import { type Context, Hono } from "hono";
import { z } from "zod";
import { renderFollowUpHtml, toEmailTheme } from "../lib/email/render-template.js";
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

const sequenceUpsertSchema = upsertSchema.extend({
	delay_days: z.number().int().min(0).max(30).optional(),
});

// GET /capture-pages/:id/email-template (legacy — returns sequence_order=0)
app.get("/:id/email-template", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const { data, error } = await supabase
		.from("email_templates")
		.select("*")
		.eq("capture_page_id", pageId)
		.eq("artist_id", artist.id)
		.eq("sequence_order", 0)
		.maybeSingle();

	if (error) return c.json({ error: error.message }, 500);
	if (!data) return c.json(null, 200);
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
		sequence_order: 0,
		subject: parsed.data.subject,
		body: parsed.data.body,
		include_incentive_link: parsed.data.include_incentive_link ?? false,
		delay_mode: parsed.data.delay_mode ?? "immediate",
		is_active: parsed.data.is_active ?? false,
	};

	const { data, error } = await supabase
		.from("email_templates")
		.upsert(row, { onConflict: "capture_page_id,sequence_order" })
		.select()
		.single();

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data);
});

// DELETE /capture-pages/:id/email-template (legacy — deletes entire sequence)
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

const previewSchema = upsertSchema.pick({ subject: true, body: true });

async function renderPreview(c: Context<AuthEnv>): Promise<Response> {
	const artist = c.get("artist");
	const pageId = c.req.param("id");
	const body = await c.req.json();
	const parsed = previewSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { data: page } = await supabase
		.from("capture_pages")
		.select(
			"title, accent_color, bg_color, text_color, button_style, streaming_links, social_links",
		)
		.eq("id", pageId)
		.eq("artist_id", artist.id)
		.single();

	const html = renderFollowUpHtml({
		artistName: artist.name,
		pageTitle: page?.title ?? undefined,
		body: parsed.data.body,
		incentiveUrl: body.include_incentive_link ? "https://example.com/download" : undefined,
		theme: page ? toEmailTheme(page) : undefined,
		streamingLinks: (page?.streaming_links as Record<string, string>) ?? undefined,
		socialLinks: (page?.social_links as Record<string, string>) ?? undefined,
	});

	return c.html(html);
}

app.post("/:id/email-template/preview", renderPreview);

// GET /capture-pages/:id/email-sequence
app.get("/:id/email-sequence", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const { data, error } = await supabase
		.from("email_templates")
		.select("*")
		.eq("capture_page_id", pageId)
		.eq("artist_id", artist.id)
		.order("sequence_order", { ascending: true });

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data ?? []);
});

// PUT /capture-pages/:id/email-sequence/:order
app.put("/:id/email-sequence/:order", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");
	const order = Number(c.req.param("order"));

	if (!Number.isInteger(order) || order < 0 || order > 4) {
		return c.json({ error: "order must be 0–4" }, 400);
	}

	const body = await c.req.json();
	const parsed = sequenceUpsertSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	if (order > 0 && (parsed.data.delay_days === undefined || parsed.data.delay_days <= 0)) {
		return c.json({ error: "delay_days is required and must be > 0 for order > 0" }, 400);
	}

	const { data: page } = await supabase
		.from("capture_pages")
		.select("id")
		.eq("id", pageId)
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (!page) return c.json({ error: "Capture page not found" }, 404);

	const validationError = await validateDelayMonotonic(pageId, order, parsed.data.delay_days ?? 0);
	if (validationError) return c.json({ error: validationError }, 400);

	const row = {
		capture_page_id: pageId,
		artist_id: artist.id,
		sequence_order: order,
		subject: parsed.data.subject,
		body: parsed.data.body,
		include_incentive_link: parsed.data.include_incentive_link ?? false,
		delay_mode: order === 0 ? (parsed.data.delay_mode ?? "immediate") : "immediate",
		delay_days: parsed.data.delay_days ?? 0,
		is_active: parsed.data.is_active ?? false,
	};

	const { data, error } = await supabase
		.from("email_templates")
		.upsert(row, { onConflict: "capture_page_id,sequence_order" })
		.select()
		.single();

	if (error) return c.json({ error: error.message }, 500);
	return c.json(data);
});

// DELETE /capture-pages/:id/email-sequence/:order
app.delete("/:id/email-sequence/:order", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");
	const order = Number(c.req.param("order"));

	if (!Number.isInteger(order) || order < 0 || order > 4) {
		return c.json({ error: "order must be 0–4" }, 400);
	}

	const { data: template } = await supabase
		.from("email_templates")
		.select("id")
		.eq("capture_page_id", pageId)
		.eq("artist_id", artist.id)
		.eq("sequence_order", order)
		.maybeSingle();

	if (!template) return c.json({ error: "Template not found" }, 404);

	await supabase
		.from("pending_emails")
		.update({ status: "failed" })
		.eq("email_template_id", template.id)
		.in("status", ["pending", "sending"]);

	const { error: delError } = await supabase.from("email_templates").delete().eq("id", template.id);
	if (delError) return c.json({ error: delError.message }, 500);

	await renumberStepsAfterDelete(pageId, artist.id, order);
	return c.body(null, 204);
});

app.post("/:id/email-sequence/:order/preview", renderPreview);

async function renumberStepsAfterDelete(
	pageId: string,
	artistId: string,
	deletedOrder: number,
): Promise<void> {
	const { data: higher } = await supabase
		.from("email_templates")
		.select("id, sequence_order")
		.eq("capture_page_id", pageId)
		.eq("artist_id", artistId)
		.gt("sequence_order", deletedOrder)
		.order("sequence_order", { ascending: true });

	for (const step of higher ?? []) {
		await supabase
			.from("email_templates")
			.update({ sequence_order: step.sequence_order - 1 })
			.eq("id", step.id);
	}
}

async function validateDelayMonotonic(
	pageId: string,
	order: number,
	delayDays: number,
): Promise<string | null> {
	const { data: siblings } = await supabase
		.from("email_templates")
		.select("sequence_order, delay_days")
		.eq("capture_page_id", pageId)
		.neq("sequence_order", order)
		.order("sequence_order", { ascending: true });

	if (!siblings) return null;

	const prev = siblings.filter((s) => s.sequence_order < order).at(-1);
	const next = siblings.find((s) => s.sequence_order > order);

	if (prev !== undefined && delayDays <= prev.delay_days) {
		return `delay_days must be greater than step ${prev.sequence_order}'s delay_days (${prev.delay_days})`;
	}
	if (next !== undefined && delayDays >= next.delay_days) {
		return `delay_days must be less than step ${next.sequence_order}'s delay_days (${next.delay_days})`;
	}

	return null;
}

export default app;
