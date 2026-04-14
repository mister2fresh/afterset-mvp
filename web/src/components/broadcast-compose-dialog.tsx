import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, setHours, setMinutes } from "date-fns";
import {
	Archive,
	Bus,
	CalendarDays,
	ChevronDown,
	ChevronUp,
	Eye,
	Info,
	Loader2,
	MapPin,
	MoreVertical,
	Music,
	Pencil,
	Send,
	ShoppingBag,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useTier } from "@/hooks/use-tier";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Broadcast } from "@/lib/types";

type CapturePage = {
	id: string;
	title: string;
};

type RecipientCount = {
	total: number;
	suppressed: number;
	reachable: number;
};

const PRESETS = [
	{
		name: "New Release",
		icon: Music,
		subject: "New music just dropped",
		body: "Hey!\n\nI just released something new and you're the first to know.\n\n[Link to your release]\n\nThanks for being a fan — it means the world.",
	},
	{
		name: "Merch Drop",
		icon: ShoppingBag,
		subject: "New merch available",
		body: "Hey!\n\nJust dropped some new merch. Check it out:\n\n[Link to your store]\n\nLimited quantities — grab yours before they're gone.",
	},
	{
		name: "Upcoming Show",
		icon: MapPin,
		subject: "I'm playing a show near you",
		body: "Hey!\n\nI've got a show coming up and I'd love to see you there.\n\nVenue: [Venue]\nDate: [Date]\nTickets: [Ticket link]\n\nLet's make it a night to remember.",
	},
	{
		name: "Tour Dates",
		icon: Bus,
		subject: "Tour dates announced!",
		body: "Hey!\n\nI'm hitting the road! Here are the dates:\n\n[Your tour dates]\n\nTickets are available now. Hope to see you at a show.",
	},
];

type FormState = {
	subject: string;
	body: string;
	replyTo: string | null;
	scheduledAt: Date | null;
	filterPageIds: string[];
	filterDateFrom: string;
	filterDateTo: string;
	filterMethod: string;
};

const EMPTY_FORM: FormState = {
	subject: "",
	body: "",
	replyTo: null,
	scheduledAt: null,
	filterPageIds: [],
	filterDateFrom: "",
	filterDateTo: "",
	filterMethod: "",
};

function formFromBroadcast(b: Broadcast): FormState {
	return {
		subject: b.subject,
		body: b.body,
		replyTo: b.reply_to,
		scheduledAt: b.scheduled_at ? new Date(b.scheduled_at) : null,
		filterPageIds: b.filter_page_ids ?? [],
		filterDateFrom: b.filter_date_from?.slice(0, 10) ?? "",
		filterDateTo: b.filter_date_to?.slice(0, 10) ?? "",
		filterMethod: b.filter_method ?? "",
	};
}

function formToPayload(f: FormState) {
	return {
		subject: f.subject,
		body: f.body,
		reply_to: f.replyTo,
		scheduled_at: f.scheduledAt ? f.scheduledAt.toISOString() : null,
		filter_page_ids: f.filterPageIds.length > 0 ? f.filterPageIds : null,
		filter_date_from: f.filterDateFrom ? `${f.filterDateFrom}T00:00:00Z` : null,
		filter_date_to: f.filterDateTo ? `${f.filterDateTo}T23:59:59Z` : null,
		filter_method: f.filterMethod || null,
	};
}

type BroadcastComposeDialogProps = {
	broadcast: Broadcast | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialPreview?: boolean;
};

const PLACEHOLDER_SUBJECT = "Your subject goes here";
const PLACEHOLDER_BODY =
	"Your message goes here — this is what your email will look like. Same colors, same footer, same links as your capture page.";

export function BroadcastComposeDialog({
	broadcast,
	open,
	onOpenChange,
	initialPreview = false,
}: BroadcastComposeDialogProps) {
	const queryClient = useQueryClient();
	const { limits } = useTier();
	const canSegmentByPage = limits.hasPageSegmentation;
	const canSegmentAdvanced = limits.hasAdvancedSegmentation;
	const userEmail = getUser()?.email ?? "";
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const hasActiveFilter =
		form.filterPageIds.length > 0 ||
		form.filterDateFrom !== "" ||
		form.filterDateTo !== "" ||
		form.filterMethod !== "";
	const set = useCallback(
		(updates: Partial<FormState>) => setForm((f) => ({ ...f, ...updates })),
		[],
	);

	// UI state
	const [showFilters, setShowFilters] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [previewHtml, setPreviewHtml] = useState("");
	const [saving, setSaving] = useState(false);
	const [sending, setSending] = useState(false);
	const [sendError, setSendError] = useState("");
	const [showConfirm, setShowConfirm] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const broadcastId = broadcast?.id;

	// Load broadcast data into form
	useEffect(() => {
		setForm(broadcast ? formFromBroadcast(broadcast) : EMPTY_FORM);
		setSendError("");
		setShowConfirm(false);
		setShowDeleteConfirm(false);
		setPreviewHtml("");
		setShowPreview(initialPreview);
	}, [broadcast, initialPreview]);

	// Auto-trigger preview fetch when opened with initialPreview flag (from card Preview button).
	const autoPreviewFired = useRef(false);
	useEffect(() => {
		if (!open) {
			autoPreviewFired.current = false;
			return;
		}
		if (!initialPreview || autoPreviewFired.current || !broadcastId || !broadcast) return;
		autoPreviewFired.current = true;
		(async () => {
			try {
				const html = await api.postText(`/broadcasts/${broadcastId}/preview`, {
					subject: broadcast.subject || PLACEHOLDER_SUBJECT,
					body: broadcast.body || PLACEHOLDER_BODY,
				});
				setPreviewHtml(html);
			} catch {
				// Preview is non-critical
			}
		})();
	}, [open, initialPreview, broadcastId, broadcast]);

	const { data: pages } = useQuery({
		queryKey: ["capture-pages"],
		queryFn: () => api.get<CapturePage[]>("/capture-pages"),
	});

	const { data: recipientCount, isLoading: countLoading } = useQuery({
		queryKey: [
			"broadcast-recipients",
			broadcastId,
			form.filterPageIds,
			form.filterDateFrom,
			form.filterDateTo,
			form.filterMethod,
		],
		queryFn: () => api.post<RecipientCount>(`/broadcasts/${broadcastId}/recipients`, {}),
		enabled: !!broadcastId,
		staleTime: 10_000,
	});

	// Ref for latest form values (debounced save reads from this)
	const formRef = useRef(form);
	formRef.current = form;

	async function saveCurrentFields(showToast = false) {
		if (!broadcastId) return;
		try {
			await api.put(`/broadcasts/${broadcastId}`, formToPayload(formRef.current));
			if (showToast) toast.success("Draft saved");
		} catch (err) {
			if (showToast) toast.error(err instanceof Error ? err.message : "Failed to save");
		}
	}

	async function handleSave() {
		if (!broadcastId) return;
		setSaving(true);
		await saveCurrentFields(true);
		queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
		setSaving(false);
	}

	async function handlePreview() {
		if (!broadcastId) return;
		try {
			const html = await api.postText(`/broadcasts/${broadcastId}/preview`, {
				subject: form.subject || PLACEHOLDER_SUBJECT,
				body: form.body || PLACEHOLDER_BODY,
			});
			setPreviewHtml(html);
			setShowPreview(true);
		} catch {
			// Preview is non-critical
		}
	}

	async function handleSend() {
		if (!broadcastId) return;
		setSending(true);
		setSendError("");
		try {
			await saveCurrentFields();
			await api.post(`/broadcasts/${broadcastId}/send`, {});
			queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
			onOpenChange(false);
		} catch (err) {
			setSendError(err instanceof Error ? err.message : "Send failed");
		} finally {
			setSending(false);
			setShowConfirm(false);
		}
	}

	const isDraft = !broadcast || broadcast.status === "draft";

	// Auto-save draft fields (debounced)
	const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const autoSaveInitialized = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: saveCurrentFields reads from ref
	useEffect(() => {
		if (!autoSaveInitialized.current) {
			autoSaveInitialized.current = true;
			return;
		}
		if (!broadcastId || !isDraft) return;
		if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
		autoSaveTimer.current = setTimeout(async () => {
			await saveCurrentFields();
			queryClient.invalidateQueries({
				queryKey: ["broadcast-recipients", broadcastId],
			});
		}, 800);
		return () => {
			if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
		};
	}, [broadcastId, isDraft, form, queryClient]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run when broadcastId changes
	useEffect(() => {
		autoSaveInitialized.current = false;
	}, [broadcastId]);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && broadcastId && isDraft) {
			if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
			saveCurrentFields();
			queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
		}
		onOpenChange(nextOpen);
	}

	function togglePageFilter(pageId: string) {
		set({
			filterPageIds: form.filterPageIds.includes(pageId)
				? form.filterPageIds.filter((id) => id !== pageId)
				: [...form.filterPageIds, pageId],
		});
	}

	async function handleDelete() {
		if (!broadcastId) return;
		await api.delete(`/broadcasts/${broadcastId}`);
		queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
		onOpenChange(false);
	}

	const isScheduled = !!form.scheduledAt;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{isDraft ? (broadcast ? "Edit Broadcast" : "New Broadcast") : "View Broadcast"}
					</DialogTitle>
					<DialogDescription className="sr-only">
						Compose and send a broadcast email to your fans
					</DialogDescription>
				</DialogHeader>

				{!isDraft && (
					<div className="flex items-start gap-2 rounded-lg border border-electric-blue/20 bg-electric-blue/5 px-3 py-2.5">
						<Info className="mt-0.5 size-4 shrink-0 text-electric-blue" />
						<p className="text-sm text-muted-foreground">
							This broadcast has been {broadcast?.status === "scheduled" ? "scheduled" : "sent"}. To
							make changes, create a new broadcast.
						</p>
					</div>
				)}

				{showPreview ? (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium">Preview</p>
							<Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
								Back to editor
							</Button>
						</div>
						{previewHtml ? (
							<iframe
								srcDoc={previewHtml}
								className="h-[500px] w-full rounded-lg border"
								title="Email preview"
								sandbox=""
							/>
						) : (
							<div className="flex h-[500px] w-full items-center justify-center rounded-lg border">
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
							</div>
						)}
					</div>
				) : (
					<div className="space-y-5">
						{/* Presets */}
						{isDraft && (
							<div className="space-y-2">
								<Label className="text-xs text-muted-foreground">Start from a template</Label>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
									{PRESETS.map((p) => {
										const Icon = p.icon;
										const isActive = form.subject === p.subject && form.body === p.body;
										return (
											<button
												key={p.name}
												type="button"
												onClick={() => set({ subject: p.subject, body: p.body })}
												className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors hover:border-honey-gold/50 hover:bg-muted ${isActive ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border"}`}
											>
												<Icon className="size-5 text-muted-foreground" />
												{p.name}
											</button>
										);
									})}
								</div>
							</div>
						)}

						{/* Subject */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label htmlFor="broadcast-subject">Subject</Label>
								<span className="text-xs text-muted-foreground">{form.subject.length}/200</span>
							</div>
							<Input
								id="broadcast-subject"
								value={form.subject}
								onChange={(e) => set({ subject: e.target.value })}
								maxLength={200}
								placeholder="Email subject line"
								disabled={!isDraft}
							/>
						</div>

						{/* Body */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label htmlFor="broadcast-body">Message</Label>
								<span className="text-xs text-muted-foreground">{form.body.length}/5000</span>
							</div>
							<Textarea
								id="broadcast-body"
								value={form.body}
								onChange={(e) => set({ body: e.target.value })}
								maxLength={5000}
								rows={8}
								placeholder="Write your message..."
								disabled={!isDraft}
							/>
						</div>

						{/* Reply-to */}
						<div className="space-y-1.5">
							<Label>Reply-to</Label>
							<div className="flex gap-2">
								<Button
									variant={form.replyTo === null ? "default" : "outline"}
									size="sm"
									onClick={() => set({ replyTo: null })}
									disabled={!isDraft}
								>
									No-reply
								</Button>
								<Button
									variant={form.replyTo !== null ? "default" : "outline"}
									size="sm"
									onClick={() => set({ replyTo: userEmail })}
									disabled={!isDraft || !userEmail}
								>
									My email
								</Button>
							</div>
							{form.replyTo !== null && (
								<p className="text-xs text-muted-foreground">
									Replies go to <span className="font-medium">{form.replyTo || userEmail}</span>
								</p>
							)}
						</div>

						{/* Filters */}
						<div className="space-y-2">
							<button
								type="button"
								className="flex items-center gap-1.5 text-sm font-medium disabled:cursor-not-allowed"
								onClick={() => canSegmentByPage && setShowFilters(!showFilters)}
								disabled={!canSegmentByPage}
							>
								{canSegmentByPage &&
									(showFilters ? (
										<ChevronUp className="size-4" />
									) : (
										<ChevronDown className="size-4" />
									))}
								{hasActiveFilter ? "Filtered recipients" : "All fans"}
								{recipientCount && (
									<Badge variant="secondary" className="ml-1">
										{countLoading ? "..." : `${recipientCount.reachable} fans`}
									</Badge>
								)}
								{!canSegmentByPage && (
									<Badge variant="default" className="ml-1 text-[10px]">
										Tour
									</Badge>
								)}
							</button>

							{!canSegmentByPage && (
								<UpgradePrompt
									feature="Segment broadcasts by show to send targeted messages — e.g. only fans from your Nashville gig."
									requiredTier="tour"
									compact
								/>
							)}

							{canSegmentByPage && showFilters && (
								<Card>
									<CardContent className="space-y-3 p-3">
										{/* Page filter */}
										{pages && pages.length > 0 && (
											<div className="space-y-1.5">
												<Label className="text-xs">Capture pages</Label>
												<div className="flex flex-wrap gap-1.5">
													{pages.map((page) => (
														<button
															key={page.id}
															type="button"
															onClick={() => togglePageFilter(page.id)}
															className={`rounded-md border px-2 py-1 text-xs transition-colors ${
																form.filterPageIds.includes(page.id)
																	? "border-honey-gold bg-honey-gold/10 text-honey-gold"
																	: "border-border text-muted-foreground hover:border-honey-gold/50"
															}`}
															disabled={!isDraft}
														>
															{page.title}
														</button>
													))}
												</div>
											</div>
										)}

										{canSegmentAdvanced && (
											<>
												{/* Date range */}
												<div className="grid grid-cols-2 gap-2">
													<div className="space-y-1">
														<Label className="text-xs">Captured after</Label>
														<Input
															type="date"
															value={form.filterDateFrom}
															onChange={(e) => set({ filterDateFrom: e.target.value })}
															disabled={!isDraft}
														/>
													</div>
													<div className="space-y-1">
														<Label className="text-xs">Captured before</Label>
														<Input
															type="date"
															value={form.filterDateTo}
															onChange={(e) => set({ filterDateTo: e.target.value })}
															disabled={!isDraft}
														/>
													</div>
												</div>

												{/* Entry method */}
												<div className="space-y-1">
													<Label className="text-xs">Entry method</Label>
													<select
														value={form.filterMethod}
														onChange={(e) => set({ filterMethod: e.target.value })}
														className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
														disabled={!isDraft}
													>
														<option value="">All methods</option>
														<option value="qr">QR code</option>
														<option value="sms">SMS</option>
														<option value="direct">Direct link</option>
														<option value="nfc">NFC</option>
													</select>
												</div>
											</>
										)}

										{countLoading && (
											<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
												<Loader2 className="size-3 animate-spin" />
												Updating count...
											</div>
										)}
									</CardContent>
								</Card>
							)}
						</div>

						{/* Schedule */}
						{isDraft && (
							<div className="space-y-1.5">
								<Label className="text-xs">Schedule (optional)</Label>
								<div className="flex items-center gap-2">
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className="w-full justify-start text-left font-normal sm:w-[260px]"
												data-empty={!form.scheduledAt}
											>
												<CalendarDays className="mr-2 size-4" />
												{form.scheduledAt ? (
													format(form.scheduledAt, "MMM d, yyyy 'at' h:mm a")
												) : (
													<span className="text-muted-foreground">Pick date & time</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<Calendar
												mode="single"
												selected={form.scheduledAt ?? undefined}
												onSelect={(date) => {
													if (!date) return set({ scheduledAt: null });
													const hours = form.scheduledAt?.getHours() ?? 9;
													const mins = form.scheduledAt?.getMinutes() ?? 0;
													set({ scheduledAt: setMinutes(setHours(date, hours), mins) });
												}}
												disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
												className="border-b"
											/>
											<div className="flex items-center gap-2 px-4 py-3">
												<Label className="text-xs">Time</Label>
												<Input
													type="time"
													value={
														form.scheduledAt
															? `${String(form.scheduledAt.getHours()).padStart(2, "0")}:${String(form.scheduledAt.getMinutes()).padStart(2, "0")}`
															: "09:00"
													}
													onChange={(e) => {
														const [h, m] = e.target.value.split(":").map(Number);
														const base = form.scheduledAt ?? new Date();
														set({ scheduledAt: setMinutes(setHours(base, h), m) });
													}}
													className="w-[120px]"
												/>
											</div>
										</PopoverContent>
									</Popover>
									{form.scheduledAt && (
										<Button
											variant="ghost"
											size="icon"
											className="size-8"
											onClick={() => set({ scheduledAt: null })}
										>
											<X className="size-4" />
										</Button>
									)}
								</div>
							</div>
						)}

						{sendError && <p className="text-sm text-red-400">{sendError}</p>}
					</div>
				)}

				{!showPreview && isDraft && (
					<div className="space-y-3">
						{showConfirm ? (
							<div className="space-y-2 rounded-lg border border-honey-gold/30 bg-honey-gold/5 p-3">
								<p className="text-sm text-muted-foreground">
									Send to {recipientCount?.reachable ?? "?"} fans?
								</p>
								<div className="flex gap-2">
									<Button size="sm" onClick={handleSend} disabled={sending} className="flex-1">
										{sending ? (
											<Loader2 className="mr-1.5 size-4 animate-spin" />
										) : (
											<Send className="mr-1.5 size-4" />
										)}
										Confirm
									</Button>
									<Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
										Cancel
									</Button>
								</div>
							</div>
						) : (
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowDeleteConfirm(true)}
									className="w-fit text-red-400 hover:text-red-300"
								>
									<Trash2 className="mr-1.5 size-4" />
									Delete
								</Button>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={handlePreview}
										disabled={!form.subject || !form.body}
									>
										Preview
									</Button>
									<Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
										{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
										Save Draft
									</Button>
									<Button
										size="sm"
										onClick={() => setShowConfirm(true)}
										disabled={!form.subject || !form.body}
									>
										<Send className="mr-1.5 size-4" />
										{isScheduled ? "Schedule" : "Send Now"}
									</Button>
								</div>
							</div>
						)}
					</div>
				)}
			</DialogContent>
			<ConfirmDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				title="Delete broadcast?"
				description={`This will permanently delete the draft "${form.subject || "Untitled broadcast"}".`}
				onConfirm={handleDelete}
			/>
		</Dialog>
	);
}

type BroadcastCardProps = {
	broadcast: Broadcast;
	onEdit: () => void;
	onPreview: () => void;
	onDelete: () => void;
	onArchive: () => void;
};

export function BroadcastCard({
	broadcast,
	onEdit,
	onPreview,
	onDelete,
	onArchive,
}: BroadcastCardProps) {
	const openRate =
		broadcast.sent_count > 0
			? Math.round((broadcast.opened_count / broadcast.sent_count) * 100)
			: 0;

	const statusVariant =
		broadcast.status === "draft" || broadcast.status === "failed"
			? ("secondary" as const)
			: ("default" as const);

	const isDraft = broadcast.status === "draft";
	const isArchived = !!broadcast.archived_at;
	const showDropdown = (isDraft && !isArchived) || !isDraft;

	return (
		<Card className="transition-colors hover:border-honey-gold/50">
			<CardContent className="space-y-2 p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="font-display truncate text-sm font-semibold">
							{broadcast.subject || "Untitled broadcast"}
						</p>
						<p className="text-xs text-muted-foreground">
							{new Date(broadcast.created_at).toLocaleDateString()}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Badge variant={statusVariant}>{broadcast.status}</Badge>
						{showDropdown && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" className="size-7">
										<MoreVertical className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{isDraft && !isArchived && (
										<DropdownMenuItem className="text-destructive" onClick={onDelete}>
											<Trash2 />
											Delete
										</DropdownMenuItem>
									)}
									{!isDraft && (
										<DropdownMenuItem onClick={onArchive}>
											<Archive />
											{isArchived ? "Unarchive" : "Archive"}
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>

				{broadcast.status !== "draft" && (
					<div className="space-y-1.5">
						<div className="flex gap-4 text-xs text-muted-foreground">
							<span>
								<span className="font-medium text-foreground">{broadcast.sent_count}</span>
								{" / "}
								{broadcast.recipient_count} delivered
							</span>
							<span>
								<span className="font-medium text-foreground">{openRate}%</span> open rate
							</span>
						</div>
						{broadcast.status === "sending" && broadcast.sent_count < broadcast.recipient_count && (
							<p className="text-xs text-muted-foreground/70">
								{broadcast.recipient_count - broadcast.sent_count} pending
							</p>
						)}
						{broadcast.status === "sent" && broadcast.sent_count < broadcast.recipient_count && (
							<p className="text-xs text-muted-foreground/70">
								{broadcast.recipient_count - broadcast.sent_count} suppressed (bounced or
								unsubscribed)
							</p>
						)}
					</div>
				)}

				{broadcast.scheduled_at && broadcast.status === "scheduled" && (
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<CalendarDays className="size-3" />
						Scheduled for {new Date(broadcast.scheduled_at).toLocaleString()}
					</div>
				)}

				{!isArchived && (
					<div className={`grid gap-2 pt-1 ${isDraft ? "grid-cols-2" : "grid-cols-1"}`}>
						{isDraft && (
							<Button variant="outline" className="h-8 gap-1.5 text-xs" onClick={onEdit}>
								<Pencil className="size-3.5" />
								Edit
							</Button>
						)}
						<Button variant="outline" className="h-8 gap-1.5 text-xs" onClick={onPreview}>
							<Eye className="size-3.5" />
							Preview
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
