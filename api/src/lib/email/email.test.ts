import { describe, expect, it } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token.js";

describe("unsubscribe tokens", () => {
	it("round-trips email and artistId", () => {
		const token = createUnsubscribeToken("fan@example.com", "artist-123");
		const result = verifyUnsubscribeToken(token);
		expect(result).toEqual({ email: "fan@example.com", artistId: "artist-123" });
	});

	it("rejects a tampered token", () => {
		const token = createUnsubscribeToken("fan@example.com", "artist-123");
		const tampered = `${token.slice(0, -2)}xx`;
		expect(verifyUnsubscribeToken(tampered)).toBeNull();
	});

	it("rejects a token with no dot separator", () => {
		expect(verifyUnsubscribeToken("nodothere")).toBeNull();
	});

	it("rejects an empty signature", () => {
		const token = createUnsubscribeToken("fan@example.com", "artist-123");
		const payload = token.split(".")[0];
		expect(verifyUnsubscribeToken(`${payload}.`)).toBeNull();
	});
});
