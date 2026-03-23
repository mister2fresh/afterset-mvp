import { promisify } from "node:util";
import { brotliCompress, constants } from "node:zlib";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { generateCaptureHtml } from "./capture-template.js";
import { R2_BUCKET, r2 } from "./r2.js";
import { supabase } from "./supabase.js";

const compress = promisify(brotliCompress);

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
	const compressed = await compress(Buffer.from(html), {
		params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
	});

	const key = `c/${page.slug}/index.html`;

	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			await r2.send(
				new PutObjectCommand({
					Bucket: R2_BUCKET,
					Key: key,
					Body: compressed,
					ContentType: "text/html; charset=utf-8",
					ContentEncoding: "br",
					CacheControl: "public, max-age=3600, s-maxage=86400",
				}),
			);
			return { slug: page.slug, size: compressed.length };
		} catch (err) {
			lastError = err;
		}
	}

	throw lastError;
}
