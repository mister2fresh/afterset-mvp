import { describe, expect, it } from "vitest";
import { WORKER_TIER_LIMITS } from "../../worker/src/tier.js";
import { TIER_LIMITS, type Tier } from "../src/lib/tier.js";

const TIERS = ["solo", "tour", "superstar", "inactive"] as const satisfies readonly Tier[];

describe("tier parity: api/src/lib/tier.ts vs worker/src/tier.ts", () => {
	it.each(TIERS)("%s overlapping fields match byte-for-byte", (tier) => {
		const api = TIER_LIMITS[tier];
		const worker = WORKER_TIER_LIMITS[tier];

		expect(worker.fanCap).toBe(api.fanCap);
		expect(worker.sequenceDepth).toBe(api.sequenceDepth);
		expect(worker.captureMethods).toEqual(api.captureMethods);
	});
});
