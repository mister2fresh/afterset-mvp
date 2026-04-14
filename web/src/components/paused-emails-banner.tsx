import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { type PausedByReason, useUsage } from "@/hooks/use-usage";
import { COPY } from "@/lib/pricing";

const REASON_EXPLANATIONS: Record<keyof PausedByReason, { title: string; body: string }> = {
	email_cap: {
		title: "Monthly email cap hit",
		body: "You've reached your tier's monthly email limit. These emails will resume sending when the cap resets at the start of next month — or immediately if you upgrade.",
	},
	tier_locked: {
		title: "Sequence step locked by tier",
		body: "These emails queued for sequence steps beyond your current tier's limit. They'll send automatically if you upgrade to a plan with deeper sequences.",
	},
	stale: {
		title: "Older than 7 days",
		body: "These emails were queued more than 7 days ago and are skipped to avoid sending outdated messages. No action needed — new captures will queue fresh emails.",
	},
	no_plan: {
		title: "No active subscription",
		body: "Your trial has ended. Queued fan emails are held until you start a subscription — they'll resume sending automatically once your plan is active.",
	},
};

export function PausedEmailsBanner(): React.ReactElement | null {
	const { data } = useUsage();
	const [detailsOpen, setDetailsOpen] = useState(false);

	const pausedCount = data?.emails.paused_count ?? 0;
	if (pausedCount === 0) return null;

	return (
		<>
			<div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
				<AlertTriangle className="size-4 shrink-0 text-amber-400" />
				<p className="flex-1 text-amber-100">
					<span className="font-medium">{pausedCount}</span> fan email
					{pausedCount === 1 ? " is" : "s are"} paused and won't send right now.
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setDetailsOpen(true)}
					className="shrink-0 border-amber-500/40 bg-transparent text-amber-100 hover:bg-amber-500/20"
				>
					View details
				</Button>
			</div>

			<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Paused emails breakdown</DialogTitle>
						<DialogDescription>
							Every skip has a reason — nothing is silently dropped. Here's what's happening.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						{(
							Object.entries(data?.emails.paused_by_reason ?? {}) as [
								keyof PausedByReason,
								number,
							][]
						).map(([reason, count]) =>
							count > 0 ? (
								<div key={reason} className="rounded-lg border border-border bg-muted/20 p-3">
									<p className="flex items-center justify-between font-medium text-sm">
										<span>{REASON_EXPLANATIONS[reason].title}</span>
										<span className="tabular-nums text-amber-400">{count}</span>
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{REASON_EXPLANATIONS[reason].body}
									</p>
								</div>
							) : null,
						)}
						<p className="pt-2 text-xs text-muted-foreground">{COPY.upgradeContact}</p>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
