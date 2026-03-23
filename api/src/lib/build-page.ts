import { PutObjectCommand } from "@aws-sdk/client-s3";
import { generateCaptureHtml } from "./capture-template.js";
import { R2_BUCKET, r2 } from "./r2.js";
import { supabase } from "./supabase.js";
import { uploadQr } from "./upload-qr.js";

export async function buildPage(
	pageId: string,
	artistId: string,
): Promise<{ slug: string; size: number }> {
	const { data: page, error } = await supabase
		.from("capture_pages")
		.select("*")
		.eq("id", pageId)
		.eq("artist_id", artistId)
		.single();

	if (error || !page) throw new Error(error?.message ?? "Page not found");

	const html = generateCaptureHtml(page);
	const body = Buffer.from(html);
	const key = `c/${page.slug}/index.html`;

	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			await Promise.all([
				r2.send(
					new PutObjectCommand({
						Bucket: R2_BUCKET,
						Key: key,
						Body: body,
						ContentType: "text/html; charset=utf-8",
						CacheControl: "public, max-age=3600, s-maxage=86400",
					}),
				),
				uploadQr(page.slug),
			]);
			return { slug: page.slug, size: body.length };
		} catch (err) {
			lastError = err;
		}
	}

	throw lastError;
}
