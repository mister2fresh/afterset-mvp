import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type PurchasableTier, TIER_DISPLAY } from "@/lib/pricing";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIERS: readonly PurchasableTier[] = ["solo", "tour", "superstar"];

type TierComparisonProps = {
	currentTier: Tier;
	isTrial?: boolean;
};

export function TierComparison({ currentTier, isTrial }: TierComparisonProps): React.ReactElement {
	return (
		<div className="grid gap-3 sm:grid-cols-3">
			{TIERS.map((tier) => (
				<TierCard
					key={tier}
					tier={tier}
					isCurrent={tier === currentTier}
					isTrial={isTrial && tier === "tour"}
				/>
			))}
		</div>
	);
}

function TierCard({
	tier,
	isCurrent,
	isTrial,
}: {
	tier: PurchasableTier;
	isCurrent: boolean;
	isTrial?: boolean;
}): React.ReactElement {
	const display = TIER_DISPLAY[tier];
	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-lg border p-4 transition-colors",
				isCurrent
					? "border-honey-gold bg-honey-gold/5"
					: "border-border bg-muted/20 hover:border-border/80",
			)}
		>
			<div className="flex items-center justify-between">
				<h3 className="font-display text-base font-semibold">{display.name}</h3>
				{isCurrent && (
					<Badge variant="default" className="text-[10px]">
						{isTrial ? "Trial" : "Current"}
					</Badge>
				)}
			</div>
			<div>
				<p className="font-display text-2xl font-bold">
					${display.priceMonthly}
					<span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span>
				</p>
				<p className="mt-1 text-xs text-muted-foreground">{display.tagline}</p>
			</div>
			<ul className="space-y-1.5 text-xs">
				{display.bullets.map((bullet) => (
					<li key={bullet} className="flex items-start gap-1.5">
						<Check className="mt-0.5 size-3 shrink-0 text-honey-gold" />
						<span>{bullet}</span>
					</li>
				))}
				{display.excluded.map((excluded) => (
					<li
						key={excluded}
						className="flex items-start gap-1.5 text-muted-foreground line-through"
					>
						<X className="mt-0.5 size-3 shrink-0" />
						<span>{excluded}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
