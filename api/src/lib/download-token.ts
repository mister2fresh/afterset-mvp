import { createHmac, timingSafeEqual } from "node:crypto";

type TokenPayload = { p: string; x: number };

function getSecret(): string {
	const secret = process.env.DOWNLOAD_HMAC_SECRET;
	if (!secret) throw new Error("Missing DOWNLOAD_HMAC_SECRET");
	return secret;
}

function sign(payload: string): string {
	return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;

export function createDownloadToken(capturePageId: string): string {
	const payload: TokenPayload = {
		p: capturePageId,
		x: Math.floor(Date.now() / 1000) + SEVEN_DAYS,
	};
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${encoded}.${sign(encoded)}`;
}

export function verifyDownloadToken(
	token: string,
): { capturePageId: string; expired: boolean } | null {
	const dot = token.indexOf(".");
	if (dot === -1) return null;

	const encoded = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expected = sign(encoded);

	const sigBuf = Buffer.from(sig);
	const expectedBuf = Buffer.from(expected);
	if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
		return null;
	}

	const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString()) as TokenPayload;
	return { capturePageId: parsed.p, expired: parsed.x < Math.floor(Date.now() / 1000) };
}
