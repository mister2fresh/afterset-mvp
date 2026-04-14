import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TierComparison } from "@/components/tier-comparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsageMeters } from "@/components/usage-meters";
import { useTier } from "@/hooks/use-tier";
import { api } from "@/lib/api";
import { COPY, TIER_DISPLAY } from "@/lib/pricing";
import type { Tier } from "@/lib/types";

export function PlanCard(): React.ReactElement {
	const { tier, effectiveTier, isTrial, trialEndsAt } = useTier();
	const isInactive = effectiveTier === "inactive";
	const display = isInactive ? null : TIER_DISPLAY[effectiveTier];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="flex items-center gap-2">
						Plan
						{isInactive ? (
							<Badge variant="destructive">No active plan</Badge>
						) : (
							<Badge variant="default">{display?.name}</Badge>
						)}
						{isTrial && !isInactive && (
							<Badge variant="secondary" className="text-xs">
								Trial
							</Badge>
						)}
					</CardTitle>
					{display && (
						<p className="font-display text-lg tabular-nums">
							${display.priceMonthly}
							<span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span>
						</p>
					)}
				</div>
				{isTrial && trialEndsAt && !isInactive && <TrialCountdown endsAt={trialEndsAt} />}
				{isInactive && (
					<p className="mt-2 text-sm text-red-300">
						Your trial has ended. Start a subscription to resume fan captures and emails.
					</p>
				)}
			</CardHeader>
			<CardContent className="space-y-6">
				{!isInactive && (
					<section className="space-y-3">
						<h3 className="text-sm font-medium">Usage this month</h3>
						<UsageMeters />
					</section>
				)}

				<section className="space-y-3">
					<h3 className="text-sm font-medium">{isInactive ? "Pick a plan" : "Compare plans"}</h3>
					<TierComparison currentTier={effectiveTier} isTrial={isTrial} />
				</section>

				<div
					className={
						isInactive
							? "rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100"
							: "rounded-md border border-border bg-muted/20 p-3 text-sm"
					}
				>
					<p className={isInactive ? "font-medium" : undefined}>
						{isInactive
							? `Start a subscription — ${COPY.upgradeContactShort}`
							: COPY.upgradeContact}
					</p>
					{!isInactive && <p className="mt-2 text-xs text-muted-foreground">{COPY.compliance}</p>}
				</div>

				{import.meta.env.DEV && <DevTierSwitcher currentTier={tier} />}
			</CardContent>
		</Card>
	);
}

function TrialCountdown({ endsAt }: { endsAt: string }): React.ReactElement {
	const daysLeft = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));
	return <p className="mt-2 text-sm text-muted-foreground">{COPY.trialBanner(daysLeft)}</p>;
}

function DevTierSwitcher({ currentTier }: { currentTier: Tier }): React.ReactElement {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<string | null>(null);

	async function setTier(tier: Tier, trialDays?: number, label?: string): Promise<void> {
		setPending(label ?? tier);
		try {
			await api.post("/dev/set-tier", { tier, trialDays });
			await queryClient.invalidateQueries({ queryKey: ["settings"] });
			await queryClient.invalidateQueries({ queryKey: ["usage"] });
			toast.success(`Tier set to ${tier}${trialDays ? ` (trial ${trialDays}d)` : ""}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to switch tier");
		} finally {
			setPending(null);
		}
	}

	return (
		<div className="space-y-2 rounded-md border-2 border-dashed border-red-500/40 bg-red-500/5 p-3">
			<p className="text-xs font-medium text-red-400">
				Dev tier switcher (not shown in production)
			</p>
			<div className="flex flex-wrap gap-2">
				{(["solo", "tour", "superstar"] as const).map((t) => (
					<Button
						key={t}
						size="sm"
						variant={currentTier === t ? "default" : "outline"}
						disabled={!!pending}
						onClick={() => setTier(t)}
					>
						{pending === t && <Loader2 className="mr-1 size-3 animate-spin" />}
						{TIER_DISPLAY[t].name}
					</Button>
				))}
				<Button
					size="sm"
					variant="outline"
					disabled={!!pending}
					onClick={() => setTier("solo", 30, "trial")}
				>
					{pending === "trial" && <Loader2 className="mr-1 size-3 animate-spin" />}
					Start 30d Tour trial
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={!!pending}
					onClick={() => setTier("solo", -1, "expire")}
				>
					{pending === "expire" && <Loader2 className="mr-1 size-3 animate-spin" />}
					Expire trial
				</Button>
			</div>
		</div>
	);
}
