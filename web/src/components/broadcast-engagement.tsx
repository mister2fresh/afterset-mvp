import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Broadcast = {
	id: string;
	subject: string | null;
	status: "draft" | "scheduled" | "sending" | "sent" | "failed";
	recipient_count: number;
	sent_count: number;
	opened_count: number;
	created_at: string;
	scheduled_at: string | null;
};

const STATUS_COLORS = {
	sent: "bg-emerald-500/20 text-emerald-400",
	sending: "bg-blue-500/20 text-blue-400",
	scheduled: "bg-amber-500/20 text-amber-400",
	draft: "bg-zinc-500/20 text-zinc-400",
	failed: "bg-red-500/20 text-red-400",
} as const;

export function BroadcastEngagement({
	broadcasts,
}: {
	broadcasts: Broadcast[] | undefined;
}): React.ReactElement | null {
	const sent = (broadcasts ?? []).filter((b) => b.status !== "draft");
	if (sent.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">Broadcast Engagement</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{sent.map((b) => (
						<BroadcastRow key={b.id} broadcast={b} />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function BroadcastRow({ broadcast: b }: { broadcast: Broadcast }): React.ReactElement {
	const openRate = b.sent_count > 0 ? Math.round((b.opened_count / b.sent_count) * 100) : 0;

	return (
		<div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm">
			<Mail className="size-4 shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1 truncate">{b.subject || "Untitled broadcast"}</span>
			<span
				className={cn(
					"shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
					STATUS_COLORS[b.status],
				)}
			>
				{b.status}
			</span>
			{b.status === "sent" || b.status === "sending" ? (
				<>
					<span className="shrink-0 tabular-nums text-muted-foreground">{b.sent_count} sent</span>
					<span className="shrink-0 tabular-nums">{openRate}% opened</span>
				</>
			) : b.status === "scheduled" && b.scheduled_at ? (
				<span className="shrink-0 text-xs text-muted-foreground">
					{new Date(b.scheduled_at).toLocaleDateString("en-US", {
						month: "numeric",
						day: "numeric",
						hour: "numeric",
						minute: "2-digit",
					})}
				</span>
			) : null}
		</div>
	);
}
