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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

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

type BroadcastComposeDialogProps = {
	broadcast: Broadcast | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function BroadcastComposeDialog({
	broadcast,
	open,
	onOpenChange,
}: BroadcastComposeDialogProps) {
	const queryClient = useQueryClient();
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [replyTo, setReplyTo] = useState<string | null>(null);
	const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
	const [filterPageIds, setFilterPageIds] = useState<string[]>([]);
	const [filterDateFrom, setFilterDateFrom] = useState("");
	const [filterDateTo, setFilterDateTo] = useState("");
	const [filterMethod, setFilterMethod] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [previewHtml, setPreviewHtml] = useState("");
	const [saving, setSaving] = useState(false);
	const [sending, setSending] = useState(false);
	const [sendError, setSendError] = useState("");
	const [showConfirm, setShowConfirm] = useState(false);

	const broadcastId = broadcast?.id;

	// Load broadcast data into form
	useEffect(() => {
		if (broadcast) {
			setSubject(broadcast.subject);
			setBody(broadcast.body);
			setReplyTo(broadcast.reply_to);
			setScheduledAt(broadcast.scheduled_at ? new Date(broadcast.scheduled_at) : null);
			setFilterPageIds(broadcast.filter_page_ids ?? []);
			setFilterDateFrom(broadcast.filter_date_from?.slice(0, 10) ?? "");
			setFilterDateTo(broadcast.filter_date_to?.slice(0, 10) ?? "");
			setFilterMethod(broadcast.filter_method ?? "");
			setSendError("");
			setShowConfirm(false);
			setShowPreview(false);
		} else {
			setSubject("");
			setBody("");
			setReplyTo(null);
			setScheduledAt(null);
			setFilterPageIds([]);
			setFilterDateFrom("");
			setFilterDateTo("");
			setFilterMethod("");
			setSendError("");
			setShowConfirm(false);
			setShowPreview(false);
		}
	}, [broadcast]);

	const { data: pages } = useQuery({
		queryKey: ["capture-pages"],
		queryFn: () => api.get<CapturePage[]>("/capture-pages"),
	});

	const { data: recipientCount, isLoading: countLoading } = useQuery({
		queryKey: [
			"broadcast-recipients",
			broadcastId,
			filterPageIds,
			filterDateFrom,
			filterDateTo,
			filterMethod,
		],
		queryFn: () => api.post<RecipientCount>(`/broadcasts/${broadcastId}/recipients`, {}),
		enabled: !!broadcastId,
		staleTime: 10_000,
	});

	function applyPreset(preset: (typeof PRESETS)[number]) {
		setSubject(preset.subject);
		setBody(preset.body);
	}

	// Keep a ref to the latest field values so the debounced save always reads current state
	const fieldsRef = useRef({
		subject,
		body,
		replyTo,
		scheduledAt,
		filterPageIds,
		filterDateFrom,
		filterDateTo,
		filterMethod,
	});
	fieldsRef.current = {
		subject,
		body,
		replyTo,
		scheduledAt,
		filterPageIds,
		filterDateFrom,
		filterDateTo,
		filterMethod,
	};

	async function saveCurrentFields(showToast = false) {
		if (!broadcastId) return;
		const f = fieldsRef.current;
		try {
			await api.put(`/broadcasts/${broadcastId}`, {
				subject: f.subject,
				body: f.body,
				reply_to: f.replyTo,
				scheduled_at: f.scheduledAt ? f.scheduledAt.toISOString() : null,
				filter_page_ids: f.filterPageIds.length > 0 ? f.filterPageIds : null,
				filter_date_from: f.filterDateFrom ? `${f.filterDateFrom}T00:00:00Z` : null,
				filter_date_to: f.filterDateTo ? `${f.filterDateTo}T23:59:59Z` : null,
				filter_method: f.filterMethod || null,
			});
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
		if (!broadcastId || !subject || !body) return;
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		const res = await fetch(`/api/broadcasts/${broadcastId}/preview`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session.access_token}`,
			},
			body: JSON.stringify({ subject, body }),
		});
		if (!res.ok) return;
		setPreviewHtml(await res.text());
		setShowPreview(true);
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

	// Auto-save all draft fields (debounced) — uses ref so the effect only re-fires on value changes
	const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const autoSaveInitialized = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: saveCurrentFields reads from ref, doesn't need to be a dep
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
	}, [
		broadcastId,
		isDraft,
		subject,
		body,
		replyTo,
		scheduledAt,
		filterPageIds,
		filterDateFrom,
		filterDateTo,
		filterMethod,
		queryClient,
	]);

	// Reset initialized flag when dialog opens with new broadcast
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run when broadcastId changes
	useEffect(() => {
		autoSaveInitialized.current = false;
	}, [broadcastId]);

	// Save on dialog close
	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && broadcastId && isDraft) {
			if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
			saveCurrentFields();
			queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
		}
		onOpenChange(nextOpen);
	}

	function togglePageFilter(pageId: string) {
		setFilterPageIds((prev) =>
			prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId],
		);
	}

	async function handleDelete() {
		if (!broadcastId) return;
		await api.delete(`/broadcasts/${broadcastId}`);
		queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
		onOpenChange(false);
	}

	const isScheduled = !!scheduledAt;

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
						<iframe
							srcDoc={previewHtml}
							className="h-[500px] w-full rounded-lg border"
							title="Email preview"
							sandbox=""
						/>
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
										const isActive = subject === p.subject && body === p.body;
										return (
											<button
												key={p.name}
												type="button"
												onClick={() => applyPreset(p)}
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
								<span className="text-xs text-muted-foreground">{subject.length}/200</span>
							</div>
							<Input
								id="broadcast-subject"
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								maxLength={200}
								placeholder="Email subject line"
								disabled={!isDraft}
							/>
						</div>

						{/* Body */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label htmlFor="broadcast-body">Message</Label>
								<span className="text-xs text-muted-foreground">{body.length}/5000</span>
							</div>
							<Textarea
								id="broadcast-body"
								value={body}
								onChange={(e) => setBody(e.target.value)}
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
									variant={replyTo === null ? "default" : "outline"}
									size="sm"
									onClick={() => setReplyTo(null)}
									disabled={!isDraft}
								>
									No-reply
								</Button>
								<Button
									variant={replyTo !== null ? "default" : "outline"}
									size="sm"
									onClick={() => setReplyTo("")}
									disabled={!isDraft}
								>
									My email
								</Button>
							</div>
						</div>

						{/* Filters */}
						<div className="space-y-2">
							<button
								type="button"
								className="flex items-center gap-1.5 text-sm font-medium"
								onClick={() => setShowFilters(!showFilters)}
							>
								{showFilters ? (
									<ChevronUp className="size-4" />
								) : (
									<ChevronDown className="size-4" />
								)}
								Filter recipients
								{recipientCount && (
									<Badge variant="secondary" className="ml-1">
										{countLoading ? "..." : `${recipientCount.reachable} fans`}
									</Badge>
								)}
							</button>

							{showFilters && (
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
															onClick={() => {
																togglePageFilter(page.id);
																// Debounced save happens on blur or explicit save
															}}
															className={`rounded-md border px-2 py-1 text-xs transition-colors ${
																filterPageIds.includes(page.id)
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

										{/* Date range */}
										<div className="grid grid-cols-2 gap-2">
											<div className="space-y-1">
												<Label className="text-xs">Captured after</Label>
												<Input
													type="date"
													value={filterDateFrom}
													onChange={(e) => setFilterDateFrom(e.target.value)}
													disabled={!isDraft}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs">Captured before</Label>
												<Input
													type="date"
													value={filterDateTo}
													onChange={(e) => setFilterDateTo(e.target.value)}
													disabled={!isDraft}
												/>
											</div>
										</div>

										{/* Entry method */}
										<div className="space-y-1">
											<Label className="text-xs">Entry method</Label>
											<select
												value={filterMethod}
												onChange={(e) => setFilterMethod(e.target.value)}
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
												data-empty={!scheduledAt}
											>
												<CalendarDays className="mr-2 size-4" />
												{scheduledAt ? (
													format(scheduledAt, "MMM d, yyyy 'at' h:mm a")
												) : (
													<span className="text-muted-foreground">Pick date & time</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<Calendar
												mode="single"
												selected={scheduledAt ?? undefined}
												onSelect={(date) => {
													if (!date) return setScheduledAt(null);
													const hours = scheduledAt?.getHours() ?? 9;
													const mins = scheduledAt?.getMinutes() ?? 0;
													setScheduledAt(setMinutes(setHours(date, hours), mins));
												}}
												disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
												className="border-b"
											/>
											<div className="flex items-center gap-2 px-4 py-3">
												<Label className="text-xs">Time</Label>
												<Input
													type="time"
													value={
														scheduledAt
															? `${String(scheduledAt.getHours()).padStart(2, "0")}:${String(scheduledAt.getMinutes()).padStart(2, "0")}`
															: "09:00"
													}
													onChange={(e) => {
														const [h, m] = e.target.value.split(":").map(Number);
														const base = scheduledAt ?? new Date();
														setScheduledAt(setMinutes(setHours(base, h), m));
													}}
													className="w-[120px]"
												/>
											</div>
										</PopoverContent>
									</Popover>
									{scheduledAt && (
										<Button
											variant="ghost"
											size="icon"
											className="size-8"
											onClick={() => setScheduledAt(null)}
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
									onClick={handleDelete}
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
										disabled={!subject || !body}
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
										disabled={!subject || !body}
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
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="size-7">
									<MoreVertical className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{broadcast.status === "draft" && (
									<DropdownMenuItem onClick={onEdit}>
										<Pencil />
										Edit
									</DropdownMenuItem>
								)}
								<DropdownMenuItem onClick={onPreview}>
									<Eye />
									Preview
								</DropdownMenuItem>
								{broadcast.status === "draft" && (
									<DropdownMenuItem className="text-destructive" onClick={onDelete}>
										<Trash2 />
										Delete
									</DropdownMenuItem>
								)}
								{broadcast.status !== "draft" && (
									<DropdownMenuItem onClick={onArchive}>
										<Archive />
										{broadcast.archived_at ? "Unarchive" : "Archive"}
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
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
						{broadcast.sent_count < broadcast.recipient_count && (
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
			</CardContent>
		</Card>
	);
}
