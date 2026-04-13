import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TIER_DISPLAY } from "@/lib/pricing";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

type UpgradePromptProps = {
	feature: string;
	requiredTier: Tier;
	compact?: boolean;
	className?: string;
};

export function UpgradePrompt({
	feature,
	requiredTier,
	compact,
	className,
}: UpgradePromptProps): React.ReactElement {
	const tierName = TIER_DISPLAY[requiredTier].name;

	if (compact) {
		return (
			<Link
				to="/settings"
				className={cn(
					"flex items-center gap-2 rounded-md border border-dashed border-honey-gold/40 bg-honey-gold/5 p-2.5 text-xs transition-colors hover:border-honey-gold/60 hover:bg-honey-gold/10",
					className,
				)}
			>
				<Lock className="size-3.5 shrink-0 text-honey-gold" />
				<span className="min-w-0 flex-1 text-muted-foreground">{feature}</span>
				<Badge variant="default" className="shrink-0 text-[10px]">
					{tierName}
				</Badge>
			</Link>
		);
	}

	return (
		<Link
			to="/settings"
			className={cn(
				"flex flex-col gap-2 rounded-lg border border-honey-gold/40 bg-honey-gold/5 p-4 transition-colors hover:border-honey-gold/60 hover:bg-honey-gold/10",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<Lock className="size-4 text-honey-gold" />
				<Badge variant="default" className="text-xs">
					{tierName}
				</Badge>
			</div>
			<p className="text-sm">{feature}</p>
			<p className="flex items-center gap-1 text-xs font-medium text-honey-gold">
				See plans <ArrowUpRight className="size-3" />
			</p>
		</Link>
	);
}
