// Source of truth for pricing tier enforcement numbers.
// Landing page copy lives in web/src/lib/pricing.ts; numeric gates live here.
// worker/src/tier.ts duplicates a slim subset (fanCap, captureMethods, sequenceDepth)
// and tier-parity.test.ts blocks drift.
//
// "inactive" is the post-trial / no-plan state. It is never stored on artists.tier
// (the DB ENUM stays solo/tour/superstar) — it's derived by getEffectiveTier() when
// a solo artist's trial_ends_at is in the past. Limits are all-zero so any gate
// that forgets an explicit inactive check still fails closed.

export type Tier = "solo" | "tour" | "superstar" | "inactive";

export type CaptureMethod = "qr" | "sms" | "nfc" | "direct";

type TierLimits = {
	fanCap: number | null;
	emailCap: number;
	sequenceDepth: number;
	broadcastsPerMonth: number;
	storageMb: number;
	captureMethods: readonly CaptureMethod[];
	hasPageSegmentation: boolean;
	hasAdvancedSegmentation: boolean;
	hasCsvExport: boolean;
};

export const TIER_LIMITS = {
	solo: {
		fanCap: 500,
		emailCap: 1000,
		sequenceDepth: 1,
		broadcastsPerMonth: 0,
		storageMb: 500,
		captureMethods: ["qr", "direct"],
		hasPageSegmentation: false,
		hasAdvancedSegmentation: false,
		hasCsvExport: false,
	},
	tour: {
		fanCap: 5000,
		emailCap: 10_000,
		sequenceDepth: 3,
		broadcastsPerMonth: 4,
		storageMb: 2048,
		captureMethods: ["qr", "sms", "nfc", "direct"],
		hasPageSegmentation: true,
		hasAdvancedSegmentation: false,
		hasCsvExport: false,
	},
	superstar: {
		fanCap: null,
		emailCap: 50_000,
		sequenceDepth: 5,
		broadcastsPerMonth: Number.POSITIVE_INFINITY,
		storageMb: 10_240,
		captureMethods: ["qr", "sms", "nfc", "direct"],
		hasPageSegmentation: true,
		hasAdvancedSegmentation: true,
		hasCsvExport: true,
	},
	inactive: {
		fanCap: 0,
		emailCap: 0,
		sequenceDepth: 0,
		broadcastsPerMonth: 0,
		storageMb: 0,
		captureMethods: [],
		hasPageSegmentation: false,
		hasAdvancedSegmentation: false,
		hasCsvExport: false,
	},
} as const satisfies Record<Tier, TierLimits>;

type TierArtist = { tier: Tier; trial_ends_at: string | null };

export function getEffectiveTier(artist: TierArtist): Tier {
	if (artist.tier !== "solo") return artist.tier;
	if (artist.trial_ends_at) {
		return new Date(artist.trial_ends_at) > new Date() ? "tour" : "inactive";
	}
	return "solo";
}

export function getTierLimits(tier: Tier): TierLimits {
	return TIER_LIMITS[tier];
}

export function isTrialActive(artist: TierArtist): boolean {
	return (
		artist.tier === "solo" &&
		artist.trial_ends_at !== null &&
		new Date(artist.trial_ends_at) > new Date()
	);
}

export function isInactive(artist: TierArtist): boolean {
	return getEffectiveTier(artist) === "inactive";
}
