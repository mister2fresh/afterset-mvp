// Display-layer pricing copy + tier limits for the dashboard.
//
// Source-of-truth chain:
//   landing page (PricingCards.tsx, separate Vercel deploy) → this file → api/src/lib/tier.ts
//   worker/src/tier.ts duplicates a slim slice; api/tests/tier-parity.test.ts blocks drift.
//
// When landing page copy or enforcement numbers change: update here first, then
// reconcile with api/src/lib/tier.ts. Upgrade CTAs are contact-only until Stripe
// lands (Decision 4 in memory/project_sprint_5_decisions.md).

import type { Tier } from "./types";

export type PurchasableTier = Exclude<Tier, "inactive">;

export type TierLimits = {
	fanCap: number | null;
	emailCap: number;
	sequenceDepth: number;
	broadcastsPerMonth: number;
	storageMb: number;
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
		hasPageSegmentation: false,
		hasAdvancedSegmentation: false,
		hasCsvExport: false,
	},
} as const satisfies Record<Tier, TierLimits>;

export type TierDisplay = {
	name: string;
	tagline: string;
	priceMonthly: number;
	bullets: readonly string[];
	excluded: readonly string[];
};

export const TIER_DISPLAY = {
	solo: {
		name: "Solo",
		tagline: "For artists starting to build a fan list.",
		priceMonthly: 12,
		bullets: [
			"QR code capture",
			"Up to 500 fans / month",
			"1 follow-up email per show",
			"Tonight + All Shows analytics",
			"Community support",
		],
		excluded: ["Text-to-Join (SMS)", "NFC tap-to-capture", "Email broadcasts", "CSV export"],
	},
	tour: {
		name: "Tour",
		tagline: "For gigging artists who want to reach fans between shows.",
		priceMonthly: 25,
		bullets: [
			"QR + Text-to-Join + NFC",
			"Up to 5,000 fans / month",
			"3-step email sequences",
			"4 broadcasts / month",
			"Segment broadcasts by show",
			"Per-show drill-down analytics",
			"Email support",
		],
		excluded: ["Advanced segmentation (method, date)", "CSV export + API"],
	},
	superstar: {
		name: "Superstar",
		tagline: "For artists running the whole machine.",
		priceMonthly: 100,
		bullets: [
			"Everything in Tour",
			"Unlimited fans",
			"5-step email sequences",
			"Unlimited broadcasts",
			"Advanced segmentation (method, date)",
			"Period trends + venue reports",
			"CSV export + API",
			"Priority support",
		],
		excluded: [],
	},
} as const satisfies Record<PurchasableTier, TierDisplay>;

export const COPY = {
	trialBanner: (daysLeft: number) =>
		`Your Tour-level free trial ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}.`,
	compliance:
		"Prices in USD. No refunds on partial months. Fan caps reset at the start of each calendar month.",
	upgradeContact:
		"Reach out to Matthew at hello@afterset.net to upgrade. Stripe self-serve is coming soon.",
	upgradeContactShort: "Reach out to Matthew at hello@afterset.net to upgrade.",
} as const;
