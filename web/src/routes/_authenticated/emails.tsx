import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, Loader2, Lock, Plus, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BroadcastCard, BroadcastComposeDialog } from "@/components/broadcast-compose-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useTier } from "@/hooks/use-tier";
import { useUsage } from "@/hooks/use-usage";
import { api } from "@/lib/api";
import type { Broadcast } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/emails")({
	component: EmailsPage,
});

function EmailsPage() {
	const queryClient = useQueryClient();
	const { effectiveTier } = useTier();
	const { data: usage } = useUsage();
	const broadcastsAllowed = effectiveTier !== "solo";
	const atBroadcastCap =
		usage?.broadcasts.limit !== null &&
		usage !== undefined &&
		usage.broadcasts.used >= usage.broadcasts.limit;

	const {
		data: broadcasts,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["broadcasts"],
		queryFn: () => api.get<Broadcast[]>("/broadcasts"),
	});

	const [showArchived, setShowArchived] = useState(false);

	const { data: archivedBroadcasts } = useQuery({
		queryKey: ["broadcasts", "archived"],
		queryFn: () => api.get<Broadcast[]>("/broadcasts?archived=true"),
		enabled: showArchived,
	});

	const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null);
	const [composeOpen, setComposeOpen] = useState(false);
	const [composeInPreview, setComposeInPreview] = useState(false);
	const [creating, setCreating] = useState(false);
	const [deletingBroadcast, setDeletingBroadcast] = useState<Broadcast | null>(null);

	async function handleNewBroadcast() {
		setCreating(true);
		try {
			const draft = await api.post<Broadcast>("/broadcasts", {});
			setEditingBroadcast(draft);
			setComposeInPreview(false);
			setComposeOpen(true);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Could not create broadcast";
			toast.error(message);
		} finally {
			setCreating(false);
		}
	}

	function handleEditBroadcast(broadcast: Broadcast) {
		setEditingBroadcast(broadcast);
		setComposeInPreview(false);
		setComposeOpen(true);
	}

	function handlePreviewBroadcast(broadcast: Broadcast) {
		setEditingBroadcast(broadcast);
		setComposeInPreview(true);
		setComposeOpen(true);
	}

	async function handleDeleteBroadcast(broadcast: Broadcast) {
		setDeletingBroadcast(broadcast);
	}

	async function confirmDeleteBroadcast() {
		if (!deletingBroadcast) return;
		await api.delete(`/broadcasts/${deletingBroadcast.id}`);
		queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
		setDeletingBroadcast(null);
	}

	async function handleArchiveBroadcast(broadcast: Broadcast) {
		await api.post(`/broadcasts/${broadcast.id}/archive`, {});
		queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
	}

	async function handleUnarchiveBroadcast(broadcast: Broadcast) {
		await api.post(`/broadcasts/${broadcast.id}/unarchive`, {});
		queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (isError) {
		return <QueryError onRetry={() => refetch()} />;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="font-display text-lg font-semibold">Broadcasts</h2>
					<p className="text-sm text-muted-foreground">
						Send one-off emails to your fan list or specific segments.
					</p>
					{broadcastsAllowed && usage?.broadcasts.limit !== null && usage?.broadcasts && (
						<p className="mt-1 text-xs text-muted-foreground">
							{usage.broadcasts.used} / {usage.broadcasts.limit} broadcasts used this month
						</p>
					)}
				</div>
				{broadcastsAllowed &&
					(atBroadcastCap ? (
						<Button disabled variant="outline" title="Monthly broadcast limit reached">
							<Lock className="mr-1.5 size-4" />
							Limit reached
						</Button>
					) : (
						<Button onClick={handleNewBroadcast} disabled={creating}>
							{creating ? (
								<Loader2 className="mr-1.5 size-4 animate-spin" />
							) : (
								<Plus className="mr-1.5 size-4" />
							)}
							New Broadcast
						</Button>
					))}
			</div>

			{!broadcastsAllowed && (
				<UpgradePrompt
					feature="Broadcasts let you email your fan list between shows — new releases, merch drops, tour dates. Tour includes 4 broadcasts/month; Superstar is unlimited."
					requiredTier="tour"
				/>
			)}

			{broadcastsAllowed && atBroadcastCap && (
				<UpgradePrompt
					feature={`You've used all ${usage?.broadcasts.limit} broadcasts this month. Upgrade to Superstar for unlimited broadcasts, or wait until next month.`}
					requiredTier="superstar"
				/>
			)}

			{broadcasts && broadcasts.length > 0 ? (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{broadcasts.map((b) => (
						<BroadcastCard
							key={b.id}
							broadcast={b}
							onEdit={() => handleEditBroadcast(b)}
							onPreview={() => handlePreviewBroadcast(b)}
							onDelete={() => handleDeleteBroadcast(b)}
							onArchive={() => handleArchiveBroadcast(b)}
						/>
					))}
				</div>
			) : (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-10">
						<div className="mb-3 rounded-full bg-muted p-3">
							<Send className="size-6 text-muted-foreground" />
						</div>
						<p className="text-sm text-muted-foreground">
							No broadcasts yet. Send your first email to your fans.
						</p>
					</CardContent>
				</Card>
			)}

			{/* Archived toggle */}
			<button
				type="button"
				onClick={() => setShowArchived(!showArchived)}
				className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
			>
				<Archive className="size-3" />
				{showArchived ? "Hide archived" : "Show archived"}
			</button>

			{showArchived && archivedBroadcasts && (
				<div className="space-y-2">
					{archivedBroadcasts.filter((b) => b.archived_at).length > 0 ? (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{archivedBroadcasts
								.filter((b) => b.archived_at)
								.map((b) => (
									<div key={b.id} className="opacity-60">
										<BroadcastCard
											broadcast={b}
											onEdit={() => {}}
											onPreview={() => handlePreviewBroadcast(b)}
											onDelete={() => {}}
											onArchive={() => handleUnarchiveBroadcast(b)}
										/>
									</div>
								))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground">No archived broadcasts.</p>
					)}
				</div>
			)}

			{/* Dialogs */}
			<BroadcastComposeDialog
				broadcast={editingBroadcast}
				open={composeOpen}
				initialPreview={composeInPreview}
				onOpenChange={(open) => {
					if (!open) {
						setComposeOpen(false);
						setEditingBroadcast(null);
						setComposeInPreview(false);
						queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
					}
				}}
			/>

			<ConfirmDialog
				open={!!deletingBroadcast}
				onOpenChange={(open) => {
					if (!open) setDeletingBroadcast(null);
				}}
				title="Delete broadcast?"
				description={`This will permanently delete the draft "${deletingBroadcast?.subject || "Untitled broadcast"}".`}
				onConfirm={confirmDeleteBroadcast}
			/>
		</div>
	);
}
