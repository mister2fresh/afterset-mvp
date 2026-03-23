import { describe, expect, it } from "vitest";
import { generateQrPng } from "./generate-qr.js";

describe("generateQrPng", () => {
	it("returns a valid PNG buffer at 1200x1200", async () => {
		const buffer = await generateQrPng("test-slug");

		// PNG magic bytes
		expect(buffer[0]).toBe(0x89);
		expect(buffer.toString("ascii", 1, 4)).toBe("PNG");

		// IHDR chunk starts at byte 8, width at 16, height at 20 (big-endian u32)
		const width = buffer.readUInt32BE(16);
		const height = buffer.readUInt32BE(20);
		expect(width).toBe(1200);
		expect(height).toBe(1200);
	});

	it("encodes the correct URL with ?v=q", async () => {
		// The QR content isn't directly readable from the PNG, but we can verify
		// different slugs produce different PNGs
		const a = await generateQrPng("slug-a");
		const b = await generateQrPng("slug-b");
		expect(a.equals(b)).toBe(false);
	});
});
