// Slim tier slice duplicated from api/src/lib/tier.ts. Only fields the Worker needs
// for capture-time gating live here (fanCap, captureMethods, sequenceDepth).
// api/tests/tier-parity.test.ts asserts this file stays in sync.

export type Tier = "solo" | "tour" | "superstar" | "inactive";

export type CaptureMethod = "qr" | "sms" | "nfc" | "direct";

type WorkerTierLimits = {
	fanCap: number | null;
	sequenceDepth: number;
	captureMethods: readonly CaptureMethod[];
};

export const WORKER_TIER_LIMITS = {
	solo: {
		fanCap: 500,
		sequenceDepth: 1,
		captureMethods: ["qr", "direct"],
	},
	tour: {
		fanCap: 5000,
		sequenceDepth: 3,
		captureMethods: ["qr", "sms", "nfc", "direct"],
	},
	superstar: {
		fanCap: null,
		sequenceDepth: 5,
		captureMethods: ["qr", "sms", "nfc", "direct"],
	},
	inactive: {
		fanCap: 0,
		sequenceDepth: 0,
		captureMethods: [],
	},
} as const satisfies Record<Tier, WorkerTierLimits>;

type TierArtist = { tier: Tier; trial_ends_at: string | null };

export function getEffectiveTier(artist: TierArtist): Tier {
	if (artist.tier !== "solo") return artist.tier;
	if (artist.trial_ends_at) {
		return new Date(artist.trial_ends_at) > new Date() ? "tour" : "inactive";
	}
	return "solo";
}
