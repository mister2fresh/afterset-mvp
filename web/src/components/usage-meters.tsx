import { AlertTriangle, Loader2 } from "lucide-react";
import { type PausedByReason, useUsage } from "@/hooks/use-usage";
import { cn } from "@/lib/utils";

const REASON_LABEL: Record<keyof PausedByReason, string> = {
	email_cap: "monthly email cap hit",
	tier_locked: "sequence step locked by tier",
	stale: "older than 7 days",
	no_plan: "no active subscription",
};

export function UsageMeters(): React.ReactElement {
	const { data, isLoading } = useUsage();

	if (isLoading || !data) {
		return (
			<div className="flex items-center justify-center py-6">
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const pausedTooltip = buildPausedTooltip(data.emails.paused_by_reason);

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<Meter label="Fans this month" used={data.fans.used} limit={data.fans.limit} />
			<Meter
				label="Emails sent this month"
				used={data.emails.used}
				limit={data.emails.limit}
				pausedCount={data.emails.paused_count}
				pausedTooltip={pausedTooltip}
			/>
			<Meter
				label="Broadcasts this month"
				used={data.broadcasts.used}
				limit={data.broadcasts.limit}
			/>
			<Meter
				label="Storage"
				used={data.storage.used_mb}
				limit={data.storage.limit_mb}
				unit="MB"
				decimals={1}
			/>
		</div>
	);
}

function Meter({
	label,
	used,
	limit,
	unit,
	decimals,
	pausedCount,
	pausedTooltip,
}: {
	label: string;
	used: number;
	limit: number | null;
	unit?: string;
	decimals?: number;
	pausedCount?: number;
	pausedTooltip?: string;
}): React.ReactElement {
	const isUnlimited = limit === null || !Number.isFinite(limit);
	const pct = isUnlimited || (limit ?? 0) === 0 ? 0 : Math.min(100, (used / (limit ?? 1)) * 100);
	const barColor = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-yellow-500" : "bg-green-500";

	const fmt = (n: number) => (decimals ? n.toFixed(decimals) : Math.round(n).toString());
	const usedLabel = `${fmt(used)}${unit ? ` ${unit}` : ""}`;

	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between gap-2">
				<p className="text-xs font-medium text-muted-foreground">{label}</p>
				<p className="text-xs tabular-nums">
					<span className="font-medium">{usedLabel}</span>
					{isUnlimited ? (
						<span className="text-muted-foreground"> · Unlimited</span>
					) : (
						<span className="text-muted-foreground">
							{" "}
							/ {fmt(limit ?? 0)}
							{unit ? ` ${unit}` : ""}
						</span>
					)}
				</p>
			</div>
			{!isUnlimited && (
				<div className="h-1.5 overflow-hidden rounded-full bg-muted">
					<div
						className={cn("h-full rounded-full transition-[width] duration-300", barColor)}
						style={{ width: `${pct}%` }}
					/>
				</div>
			)}
			{pausedCount !== undefined && pausedCount > 0 && (
				<div className="flex items-center gap-1 text-xs text-amber-400" title={pausedTooltip}>
					<AlertTriangle className="size-3" />
					<span>
						{pausedCount} paused{pausedTooltip ? ` · ${pausedTooltip}` : ""}
					</span>
				</div>
			)}
		</div>
	);
}

function buildPausedTooltip(reasons: PausedByReason): string {
	const parts: string[] = [];
	for (const [key, count] of Object.entries(reasons)) {
		if (count > 0) parts.push(`${count} ${REASON_LABEL[key as keyof PausedByReason]}`);
	}
	return parts.join(", ");
}
