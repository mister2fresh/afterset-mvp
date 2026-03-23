import { createHmac, timingSafeEqual } from "node:crypto";

type TokenPayload = { e: string; a: string; t: number };

function getSecret(): string {
	const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
	if (!secret) throw new Error("Missing UNSUBSCRIBE_HMAC_SECRET");
	return secret;
}

function sign(payload: string): string {
	return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createUnsubscribeToken(email: string, artistId: string): string {
	const payload = JSON.stringify({ e: email, a: artistId, t: Math.floor(Date.now() / 1000) });
	const encoded = Buffer.from(payload).toString("base64url");
	return `${encoded}.${sign(encoded)}`;
}

export function verifyUnsubscribeToken(token: string): { email: string; artistId: string } | null {
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
	return { email: parsed.e, artistId: parsed.a };
}
