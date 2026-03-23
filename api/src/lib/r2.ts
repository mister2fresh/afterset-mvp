import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

if (!accountId || !accessKeyId || !secretAccessKey) {
	throw new Error(
		"Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, or CLOUDFLARE_R2_SECRET_ACCESS_KEY",
	);
}

export const r2 = new S3Client({
	region: "auto",
	endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
	credentials: { accessKeyId, secretAccessKey },
});

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "afterset-capture-pages";
