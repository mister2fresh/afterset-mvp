import { Hono } from "hono";
import { z } from "zod";
import { createDownloadToken } from "../lib/download-token.js";
import { supabase } from "../lib/supabase.js";
import type { AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const ALLOWED_MIME_TYPES = new Set([
	// Audio
	"audio/mpeg",
	"audio/wav",
	"audio/flac",
	"audio/aac",
	"audio/ogg",
	"audio/mp4",
	"audio/aiff",
	"audio/x-aiff",
	"audio/x-m4a",
	"audio/x-flac",
	"audio/x-wav",
	// Image
	"image/png",
	"image/jpeg",
	"image/gif",
	// Video
	"video/mp4",
	"video/quicktime",
	"video/webm",
	// Document
	"application/pdf",
	// Archive
	"application/zip",
	"application/x-zip-compressed",
]);

const MAX_FILE_SIZE = 262144000; // 250MB

const uploadUrlSchema = z.object({
	filename: z.string().min(1).max(255),
	content_type: z.string().min(1),
	file_size: z.number().int().positive().max(MAX_FILE_SIZE),
});

async function getOwnedPage(pageId: string, artistId: string) {
	const { data, error } = await supabase
		.from("capture_pages")
		.select("*")
		.eq("id", pageId)
		.eq("artist_id", artistId)
		.maybeSingle();

	if (error) throw error;
	return data;
}

async function deleteStorageFile(filePath: string) {
	const { error } = await supabase.storage.from("incentives").remove([filePath]);
	if (error) throw error;
}

// Generate signed upload URL
app.post("/:id/incentive/upload-url", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const body = await c.req.json();
	const parsed = uploadUrlSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

	const { filename, content_type, file_size } = parsed.data;

	if (!ALLOWED_MIME_TYPES.has(content_type)) {
		return c.json({ error: "File type not allowed" }, 400);
	}

	const page = await getOwnedPage(pageId, artist.id);
	if (!page) return c.json({ error: "Not found" }, 404);

	// Delete existing file if replacing
	if (page.incentive_file_path) {
		await deleteStorageFile(page.incentive_file_path);
	}

	const filePath = `${artist.id}/${pageId}/${filename}`;

	const { data, error } = await supabase.storage.from("incentives").createSignedUploadUrl(filePath);

	if (error) return c.json({ error: error.message }, 500);

	// Save file metadata to capture page
	const { error: updateError } = await supabase
		.from("capture_pages")
		.update({
			incentive_file_path: filePath,
			incentive_file_name: filename,
			incentive_file_size: file_size,
			incentive_content_type: content_type,
		})
		.eq("id", pageId);

	if (updateError) return c.json({ error: updateError.message }, 500);

	return c.json({
		signed_url: data.signedUrl,
		token: data.token,
		path: filePath,
	});
});

// Remove incentive file
app.delete("/:id/incentive", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const page = await getOwnedPage(pageId, artist.id);
	if (!page) return c.json({ error: "Not found" }, 404);

	if (!page.incentive_file_path) {
		return c.json({ error: "No incentive file attached" }, 400);
	}

	await deleteStorageFile(page.incentive_file_path);

	const { error } = await supabase
		.from("capture_pages")
		.update({
			incentive_file_path: null,
			incentive_file_name: null,
			incentive_file_size: null,
			incentive_content_type: null,
		})
		.eq("id", pageId);

	if (error) return c.json({ error: error.message }, 500);
	return c.body(null, 204);
});

// Generate download page URL (artist preview — same page fans see)
app.get("/:id/incentive/download-url", async (c) => {
	const artist = c.get("artist");
	const pageId = c.req.param("id");

	const page = await getOwnedPage(pageId, artist.id);
	if (!page) return c.json({ error: "Not found" }, 404);

	if (!page.incentive_file_path) {
		return c.json({ error: "No incentive file attached" }, 400);
	}

	const baseUrl = process.env.API_BASE_URL ?? "https://api.afterset.net";
	const token = createDownloadToken(pageId);
	return c.json({ signed_url: `${baseUrl}/download/${token}` });
});

export default app;
