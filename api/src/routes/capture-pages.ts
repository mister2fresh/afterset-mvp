import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Hono } from "hono";
import { z } from "zod";
import { buildPage } from "../lib/build-page.js";
import { type DownloadPageStyle, renderDownloadPage } from "../lib/download-page.js";
import { internalError } from "../lib/errors.js";
import { generateQrPng } from "../lib/generate-qr.js";
import { R2_BUCKET, r2 } from "../lib/r2.js";
import { supabase } from "../lib/supabase.js";
import { deleteQr, uploadQr } from "../lib/upload-qr.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const slugPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const createSchema = z.object({
	title: z.string().min(1).max(100),
	slug: z.string().min(1).max(40).regex(slugPattern).optional(),
	value_exchange_text: z.string().max(500).optional(),
	streaming_links: z.record(z.string(), z.string().url()).optional(),
	social_links: z.record(z.string(), z.string().url()).optional(),
	accent_color: hexColor.optional(),
	secondary_color: hexColor.optional(),
	background_style: z.enum(["solid", "gradient", "glow"]).optional(),
	button_style: z.enum(["rounded", "pill", "sharp"]).optional(),
	font_style: z.enum(["modern", "editorial", "mono", "condensed"]).optional(),
	title_size: z.enum(["default", "large", "xl"]).optional(),
	layout_style: z.enum(["centered", "stacked"]).optional(),
	text_color: hexColor.optional(),
	bg_color: hexColor.optional(),
	download_heading: z.string().max(200).optional(),
	download_description: z.string().max(500).optional(),
});

const updateSchema = createSchema.partial();

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

async function findUniqueSlug(base: string): Promise<string> {
	let slug = base;
	let suffix = 2;

	for (;;) {
		const { data } = await supabase
			.from("capture_pages")
			.select("id")
			.eq("slug", slug)
			.maybeSingle();

		if (!data) return slug;
		slug = `${base.slice(0, 36)}-${suffix}`;
		suffix++;
	}
}

// Check slug availability
app.get("/check-slug/:slug", async (c) => {
	const slug = c.req.param("slug").toLowerCase();
	if (!slugPattern.test(slug) || slug.length > 40) {
		return c.json({ available: false }, 200);
	}
	const { data } = await supabase.from("capture_pages").select("id").eq("slug", slug).maybeSingle();
	return c.json({ available: !data });
});

// List
app.get("/", async (c) => {
	const artist = c.get("artist");
	const { data, error } = await supabase
		.from("capture_pages")
		.select("*")
		.eq("artist_id", artist.id)
		.order("created_at", { ascending: false });

	if (error) return internalError(c, error);
	return c.json(data);
});

// Create
app.post("/", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = createSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const {
		title,
		value_exchange_text,
		streaming_links,
		social_links,
		accent_color,
		secondary_color,
		background_style,
		button_style,
		font_style,
		title_size,
		layout_style,
		text_color,
		bg_color,
	} = parsed.data;
	const baseSlug = parsed.data.slug || slugify(title);
	const slug = await findUniqueSlug(baseSlug);

	const { data, error } = await supabase
		.from("capture_pages")
		.insert({
			artist_id: artist.id,
			title,
			slug,
			value_exchange_text: value_exchange_text ?? "",
			streaming_links: streaming_links ?? {},
			social_links: social_links ?? {},
			accent_color: accent_color ?? "#E8C547",
			secondary_color: secondary_color ?? "#D4A017",
			background_style: background_style ?? "solid",
			button_style: button_style ?? "rounded",
			font_style: font_style ?? "modern",
			title_size: title_size ?? "default",
			layout_style: layout_style ?? "centered",
			text_color: text_color ?? "#f9fafb",
			bg_color: bg_color ?? "#0a0e1a",
		})
		.select()
		.single();

	if (error) return internalError(c, error);

	// Auto-create default follow-up email (sequence step 0) so every page has one
	await supabase.from("email_templates").insert({
		artist_id: artist.id,
		capture_page_id: data.id,
		sequence_order: 0,
		subject: `Thanks for signing up!`,
		body: `Hey! Thanks so much for coming out tonight and signing up. It means the world.\n\nStay tuned — I'll be sending updates about upcoming shows, new music, and more.`,
		delay_mode: "immediate",
		is_active: true,
	});

	buildPage(data.id, artist.id).catch((e) => console.error("build failed", e));

	return c.json(data, 201);
});

// Get single
app.get("/:id", async (c) => {
	const artist = c.get("artist");
	const { data, error } = await supabase
		.from("capture_pages")
		.select("*")
		.eq("id", c.req.param("id"))
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (error) return internalError(c, error);
	if (!data) return c.json({ error: "Not found" }, 404);
	return c.json(data);
});

// QR code
app.get("/:id/qr.png", async (c) => {
	const artist = c.get("artist");
	const { data: page, error } = await supabase
		.from("capture_pages")
		.select("slug")
		.eq("id", c.req.param("id"))
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (error) return internalError(c, error);
	if (!page) return c.json({ error: "Not found" }, 404);

	const key = `c/${page.slug}/qr.png`;
	let body: Uint8Array;

	try {
		const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
		if (!obj.Body) throw new Error("Empty R2 response");
		body = await obj.Body.transformToByteArray();
	} catch {
		body = await generateQrPng(page.slug);
		uploadQr(page.slug).catch(() => {});
	}

	const download = c.req.query("download");
	const headers: Record<string, string> = { "Content-Type": "image/png" };
	if (download) {
		headers["Content-Disposition"] = `attachment; filename="${page.slug}-qr.png"`;
	}

	return new Response(Buffer.from(body), { headers });
});

// Update
app.patch("/:id", async (c) => {
	const artist = c.get("artist");
	const body = await c.req.json();
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const updates = { ...parsed.data };

	const { data, error } = await supabase
		.from("capture_pages")
		.update(updates)
		.eq("id", c.req.param("id"))
		.eq("artist_id", artist.id)
		.select()
		.single();

	if (error) return internalError(c, error);
	if (!data) return c.json({ error: "Not found" }, 404);

	buildPage(data.id, artist.id).catch((e) => console.error("build failed", e));

	return c.json(data);
});

// Download page preview
app.get("/:id/download-preview", async (c) => {
	const artist = c.get("artist");
	const { data: page, error } = await supabase
		.from("capture_pages")
		.select("*")
		.eq("id", c.req.param("id"))
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (error) return internalError(c, error);
	if (!page) return c.json({ error: "Not found" }, 404);

	const fileName = page.incentive_file_name ?? "example-track.mp3";
	const contentType = page.incentive_content_type ?? "audio/mpeg";
	const style: DownloadPageStyle = {
		accentColor: page.accent_color,
		secondaryColor: page.secondary_color,
		bgColor: page.bg_color,
		textColor: page.text_color,
		buttonStyle: page.button_style,
		backgroundStyle: page.background_style,
	};

	c.header("Cache-Control", "no-store");
	return c.html(
		renderDownloadPage(
			{
				artistName: artist.name,
				fileName,
				contentType,
				signedUrl: "#",
				heading: page.download_heading ?? undefined,
				description: page.download_description ?? undefined,
				streamingLinks: page.streaming_links,
				socialLinks: page.social_links,
			},
			style,
		),
	);
});

// Delete
app.delete("/:id", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	// Fetch slug before deleting for R2 cleanup
	const { data: page } = await supabase
		.from("capture_pages")
		.select("slug")
		.eq("id", pageId)
		.eq("artist_id", artist.id)
		.maybeSingle();

	if (!page) return c.json({ error: "Not found" }, 404);

	const { error } = await supabase
		.from("capture_pages")
		.delete()
		.eq("id", pageId)
		.eq("artist_id", artist.id);

	if (error) return internalError(c, error);

	// Clean up R2 page HTML and QR code
	deleteQr(page.slug).catch(() => {});

	return c.body(null, 204);
});

export default app;
