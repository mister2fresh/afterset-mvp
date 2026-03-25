import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Archive,
	CalendarDays,
	Clock,
	Loader2,
	Mail,
	Plus,
	Send,
	Sunrise,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { BroadcastCard, BroadcastComposeDialog } from "@/components/broadcast-compose-dialog";
import { EmailTemplateDialog } from "@/components/email-template-dialog";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/emails")({
	component: EmailsPage,
});

type CapturePage = {
	id: string;
	slug: string;
	title: string;
	incentive_file_name: string | null;
	is_active: boolean;
};

type EmailTemplate = {
	id: string;
	capture_page_id: string;
	sequence_order: number;
	delay_days: number;
	subject: string;
	body: string;
	include_incentive_link: boolean;
	delay_mode: "immediate" | "1_hour" | "next_morning";
	is_active: boolean;
};

type Broadcast = {
	id: string;
	artist_id: string;
	subject: string;
	body: string;
	reply_to: string | null;
	status: "draft" | "scheduled" | "sending" | "sent" | "failed";
	scheduled_at: string | null;
	filter_page_ids: string[] | null;
	filter_date_from: string | null;
	filter_date_to: string | null;
	filter_method: string | null;
	recipient_count: number;
	sent_count: number;
	opened_count: number;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
};

const DELAY_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
	immediate: { label: "Immediately", icon: Zap },
	"1_hour": { label: "After 1 hour", icon: Clock },
	next_morning: { label: "Next morning", icon: Sunrise },
};

function stepLabel(t: EmailTemplate): { label: string; icon: typeof Zap } {
	if (t.sequence_order === 0) {
		return DELAY_LABELS[t.delay_mode] ?? DELAY_LABELS.immediate;
	}
	return { label: `Day ${t.delay_days}`, icon: CalendarDays };
}

function EmailsPage() {
	const queryClient = useQueryClient();

	const {
		data: pages,
		isLoading: pagesLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["capture-pages"],
		queryFn: () => api.get<CapturePage[]>("/capture-pages"),
	});

	const { data: sequences, isLoading: seqLoading } = useQuery({
		queryKey: ["email-sequences-all"],
		queryFn: async () => {
			if (!pages?.length) return [];
			const results = await Promise.all(
				pages.map(async (p) => {
					const seq = await api.get<EmailTemplate[]>(`/capture-pages/${p.id}/email-sequence`);
					return { page: p, sequence: seq };
				}),
			);
			return results;
		},
		enabled: !!pages?.length,
	});

	const { data: broadcasts, isLoading: broadcastsLoading } = useQuery({
		queryKey: ["broadcasts"],
		queryFn: () => api.get<Broadcast[]>("/broadcasts"),
	});

	const [showArchived, setShowArchived] = useState(false);

	const { data: archivedBroadcasts } = useQuery({
		queryKey: ["broadcasts", "archived"],
		queryFn: () => api.get<Broadcast[]>("/broadcasts?archived=true"),
		enabled: showArchived,
	});

	const [editingPageId, setEditingPageId] = useState<string | null>(null);
	const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null);
	const [composeOpen, setComposeOpen] = useState(false);
	const [creating, setCreating] = useState(false);

	const isLoading = pagesLoading || seqLoading || broadcastsLoading;
	const editingPage = pages?.find((p) => p.id === editingPageId);

	async function handleNewBroadcast() {
		setCreating(true);
		try {
			const draft = await api.post<Broadcast>("/broadcasts", {});
			setEditingBroadcast(draft);
			setComposeOpen(true);
		} finally {
			setCreating(false);
		}
	}

	function handleEditBroadcast(broadcast: Broadcast) {
		setEditingBroadcast(broadcast);
		setComposeOpen(true);
	}

	async function handlePreviewBroadcast(broadcast: Broadcast) {
		if (!broadcast.subject || !broadcast.body) return;
		setEditingBroadcast(broadcast);
		setComposeOpen(true);
	}

	async function handleDeleteBroadcast(broadcast: Broadcast) {
		await api.delete(`/broadcasts/${broadcast.id}`);
		queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
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

	const withSequence = sequences?.filter((s) => s.sequence.length > 0) ?? [];
	const withoutSequence = sequences?.filter((s) => s.sequence.length === 0) ?? [];

	return (
		<div className="space-y-8">
			{/* Email Fans Section */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="font-display text-lg font-semibold">Email Fans</h2>
						<p className="text-sm text-muted-foreground">
							Send one-off emails to your fan list or specific segments.
						</p>
					</div>
					<Button onClick={handleNewBroadcast} disabled={creating}>
						{creating ? (
							<Loader2 className="mr-1.5 size-4 animate-spin" />
						) : (
							<Plus className="mr-1.5 size-4" />
						)}
						New Broadcast
					</Button>
				</div>

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
			</div>

			<Separator />

			{/* Follow-up Sequences Section */}
			<div className="space-y-4">
				<div>
					<h2 className="font-display text-lg font-semibold">Follow-up Sequences</h2>
					<p className="text-sm text-muted-foreground">
						Automated emails fans receive after signing up at your shows.
					</p>
				</div>

				{!pages?.length ? (
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-16">
							<div className="mb-4 rounded-full bg-muted p-4">
								<Mail className="size-8 text-muted-foreground" />
							</div>
							<h3 className="font-display text-lg font-semibold">No capture pages yet</h3>
							<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
								Create a capture page first, then set up follow-up emails for your fans.
							</p>
						</CardContent>
					</Card>
				) : (
					<>
						{withSequence.length > 0 && (
							<div className="space-y-3">
								<h3 className="font-display text-sm font-semibold text-muted-foreground">
									Configured ({withSequence.length})
								</h3>
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{withSequence.map(({ page, sequence }) => {
										const activeCount = sequence.filter((s) => s.is_active).length;
										return (
											<Card
												key={page.id}
												className="cursor-pointer transition-colors hover:border-honey-gold/50"
												onClick={() => setEditingPageId(page.id)}
											>
												<CardContent className="space-y-3 p-4">
													<div className="flex items-start justify-between gap-2">
														<div className="min-w-0">
															<p className="font-display truncate text-sm font-semibold">
																{page.title}
															</p>
															<p className="text-xs text-muted-foreground">
																{sequence.length} email{sequence.length === 1 ? "" : "s"}
															</p>
														</div>
														<Badge
															variant={activeCount > 0 ? "default" : "secondary"}
															className="shrink-0"
														>
															{activeCount === sequence.length
																? "All active"
																: `${activeCount}/${sequence.length} active`}
														</Badge>
													</div>
													<div className="space-y-1">
														{sequence.map((t) => {
															const info = stepLabel(t);
															const Icon = info.icon;
															const isWelcome = t.sequence_order === 0;
															return (
																<div
																	key={t.id}
																	className="flex items-center gap-2 text-xs text-muted-foreground"
																>
																	<Icon
																		className={`size-3 shrink-0 ${isWelcome ? "text-honey-gold" : ""}`}
																	/>
																	<span className="shrink-0">
																		{isWelcome ? "Welcome" : info.label}
																	</span>
																	<span className="truncate">{t.subject}</span>
																</div>
															);
														})}
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							</div>
						)}

						{withoutSequence.length > 0 && (
							<div className="space-y-3">
								<h3 className="font-display text-sm font-semibold text-muted-foreground">
									No email set up ({withoutSequence.length})
								</h3>
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{withoutSequence.map(({ page }) => (
										<Card
											key={page.id}
											className="cursor-pointer border-dashed transition-colors hover:border-honey-gold/50"
										>
											<CardContent className="flex items-center gap-3 p-4">
												<div className="rounded-full bg-muted p-2">
													<Mail className="size-4 text-muted-foreground" />
												</div>
												<div className="min-w-0 flex-1">
													<p className="font-display truncate text-sm font-semibold">
														{page.title}
													</p>
													<p className="text-xs text-muted-foreground">No follow-up email</p>
												</div>
												<Button
													variant="outline"
													size="sm"
													onClick={() => setEditingPageId(page.id)}
												>
													Set Up
												</Button>
											</CardContent>
										</Card>
									))}
								</div>
							</div>
						)}
					</>
				)}
			</div>

			{/* Dialogs */}
			{editingPage && (
				<EmailTemplateDialog
					pageId={editingPage.id}
					pageTitle={editingPage.title}
					hasIncentive={!!editingPage.incentive_file_name}
					open={!!editingPageId}
					onOpenChange={(open) => {
						if (!open) setEditingPageId(null);
					}}
				/>
			)}

			<BroadcastComposeDialog
				broadcast={editingBroadcast}
				open={composeOpen}
				onOpenChange={(open) => {
					if (!open) {
						setComposeOpen(false);
						setEditingBroadcast(null);
						queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
					}
				}}
			/>
		</div>
	);
}
