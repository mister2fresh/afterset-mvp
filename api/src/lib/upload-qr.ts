import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateQrPng } from "./generate-qr.js";
import { R2_BUCKET, r2 } from "./r2.js";

export async function uploadQr(slug: string): Promise<{ key: string; size: number }> {
	const buffer = await generateQrPng(slug);
	const key = `c/${slug}/qr.png`;

	await r2.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: "image/png",
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);

	return { key, size: buffer.length };
}

export async function deleteQr(slug: string): Promise<void> {
	await r2.send(
		new DeleteObjectCommand({
			Bucket: R2_BUCKET,
			Key: `c/${slug}/qr.png`,
		}),
	);
}
