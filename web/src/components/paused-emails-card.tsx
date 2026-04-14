import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type PausedEmail,
	type PausedSkipReason,
	useDismissPausedEmails,
	usePausedEmails,
} from "@/hooks/use-paused-emails";
import { useTier } from "@/hooks/use-tier";

const REASON_LABEL: Record<PausedSkipReason, string> = {
	stale: "Older than 7 days",
	email_cap: "Monthly email cap hit",
	tier_locked: "Sequence step locked by tier",
	no_plan: "No active subscription",
};

// Controls group display order: most actionable first.
const REASON_ORDER: PausedSkipReason[] = ["email_cap", "tier_locked", "no_plan", "stale"];

const INITIAL_VISIBLE = 5;

export function PausedEmailsCard(): React.ReactElement | null {
	const { data, isLoading } = usePausedEmails();

	if (isLoading) return null;
	if (!data || data.length === 0) return null;

	const groups = groupByReason(data);

	return (
		<Card id="paused-emails">
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-2">
					Paused emails
					<span className="text-xs font-normal text-muted-foreground tabular-nums">
						{data.length} total
					</span>
				</CardTitle>
				<p className="text-sm text-muted-foreground">
					Emails queued but not sent. Each one has a reason — upgrade to resume sending, or dismiss
					to drop them from the queue.
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{REASON_ORDER.filter((r) => groups[r]?.length).map((reason) => (
					<ReasonGroup key={reason} reason={reason} rows={groups[reason] ?? []} />
				))}
			</CardContent>
		</Card>
	);
}

function groupByReason(rows: PausedEmail[]): Record<PausedSkipReason, PausedEmail[]> {
	const out: Record<PausedSkipReason, PausedEmail[]> = {
		email_cap: [],
		tier_locked: [],
		no_plan: [],
		stale: [],
	};
	for (const row of rows) out[row.skip_reason].push(row);
	return out;
}

function ReasonGroup({
	reason,
	rows,
}: {
	reason: PausedSkipReason;
	rows: PausedEmail[];
}): React.ReactElement {
	const [showAll, setShowAll] = useState(false);
	const { effectiveTier } = useTier();
	const dismiss = useDismissPausedEmails();

	const visible = useMemo(() => (showAll ? rows : rows.slice(0, INITIAL_VISIBLE)), [rows, showAll]);
	const hiddenCount = rows.length - visible.length;

	function handleDismiss(): void {
		dismiss.mutate(reason, {
			onSuccess: () =>
				toast.success(`${rows.length} paused email${rows.length === 1 ? "" : "s"} cleared`),
			onError: (err) => toast.error(err instanceof Error ? err.message : "Could not dismiss"),
		});
	}

	const canDismiss = effectiveTier !== "inactive";

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm font-medium">
					{REASON_LABEL[reason]}
					<span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
						· {rows.length} email{rows.length === 1 ? "" : "s"}
					</span>
				</p>
				<Button
					variant="ghost"
					size="sm"
					disabled={dismiss.isPending || !canDismiss}
					title={canDismiss ? undefined : "Start a subscription to dismiss"}
					onClick={handleDismiss}
				>
					{dismiss.isPending && dismiss.variables === reason && (
						<Loader2 className="mr-1 size-3 animate-spin" />
					)}
					Dismiss
				</Button>
			</div>
			<ul className="divide-y divide-border rounded-md border border-border bg-muted/10">
				{visible.map((row) => (
					<PausedRow key={row.id} row={row} />
				))}
			</ul>
			{hiddenCount > 0 && (
				<button
					type="button"
					className="text-xs text-muted-foreground hover:text-foreground"
					onClick={() => setShowAll(true)}
				>
					Show all {rows.length}
				</button>
			)}
		</div>
	);
}

function PausedRow({ row }: { row: PausedEmail }): React.ReactElement {
	const label = rowLabel(row);
	const pausedAgo = formatPausedAgo(row.skip_reason_at ?? row.send_at);

	return (
		<li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
			<div className="min-w-0 flex-1 space-y-0.5">
				<p className="truncate font-medium">{row.fan_email}</p>
				<p className="truncate text-xs text-muted-foreground">
					{label}
					{row.page_title && <> · {row.page_title}</>}
					{pausedAgo && <> · paused {pausedAgo}</>}
				</p>
			</div>
			{deepLinkFor(row)}
		</li>
	);
}

function rowLabel(row: PausedEmail): string {
	if (row.broadcast_id) {
		return `Broadcast · ${row.broadcast_subject || "Untitled broadcast"}`;
	}
	if (row.sequence_order !== null) {
		return row.sequence_order === 0 ? "Welcome email" : `Follow-up step ${row.sequence_order + 1}`;
	}
	return "Queued email";
}

function deepLinkFor(row: PausedEmail): React.ReactElement | null {
	if (row.broadcast_id) {
		return (
			<Link
				to="/emails"
				search={{ broadcast: row.broadcast_id }}
				className="shrink-0 text-xs text-electric-blue hover:underline"
			>
				View <ExternalLink className="ml-0.5 inline size-3" />
			</Link>
		);
	}
	if (row.page_id) {
		return (
			<Link
				to="/pages"
				search={{ open: row.page_id }}
				className="shrink-0 text-xs text-electric-blue hover:underline"
			>
				View <ExternalLink className="ml-0.5 inline size-3" />
			</Link>
		);
	}
	return null;
}

function formatPausedAgo(iso: string | null): string | null {
	if (!iso) return null;
	const diffMs = Date.now() - new Date(iso).getTime();
	if (diffMs < 0) return null;
	const days = Math.floor(diffMs / 86_400_000);
	if (days >= 1) return `${days}d ago`;
	const hours = Math.floor(diffMs / 3_600_000);
	if (hours >= 1) return `${hours}h ago`;
	return "just now";
}
