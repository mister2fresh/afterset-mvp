import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	CalendarDays,
	ChevronDown,
	ChevronUp,
	Clock,
	Eye,
	Loader2,
	Mail,
	Plus,
	Send,
	Sunrise,
	Trash2,
	Zap,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

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
	created_at: string;
	updated_at: string;
};

type StepForm = {
	subject: string;
	body: string;
	include_incentive_link: boolean;
	delay_mode: "immediate" | "1_hour" | "next_morning";
	delay_days: number;
	is_active: boolean;
};

const MAX_STEPS = 5;

const DELAY_OPTIONS = [
	{ value: "immediate" as const, label: "Immediately", icon: Zap },
	{ value: "1_hour" as const, label: "After 1 hour", icon: Clock },
	{ value: "next_morning" as const, label: "Next morning (9am)", icon: Sunrise },
];

const EMPTY_STEP: StepForm = {
	subject: "",
	body: "",
	include_incentive_link: false,
	delay_mode: "immediate",
	delay_days: 1,
	is_active: false,
};

function formFromTemplate(t: EmailTemplate): StepForm {
	return {
		subject: t.subject,
		body: t.body,
		include_incentive_link: t.include_incentive_link,
		delay_mode: t.delay_mode,
		delay_days: t.delay_days,
		is_active: t.is_active,
	};
}

function stepDelayLabel(step: EmailTemplate): string {
	if (step.sequence_order === 0) {
		return DELAY_OPTIONS.find((o) => o.value === step.delay_mode)?.label ?? "Immediately";
	}
	return `Day ${step.delay_days}`;
}

// --- Step Editor (rendered inline for the expanded step) ---

function SequenceStepEditor({
	pageId,
	order,
	existing,
	hasIncentive,
	onSaved,
	onDeleted,
}: {
	pageId: string;
	order: number;
	existing: EmailTemplate | undefined;
	hasIncentive: boolean;
	onSaved: () => void;
	onDeleted: () => void;
}) {
	const [form, setForm] = useState<StepForm>(existing ? formFromTemplate(existing) : EMPTY_STEP);
	const [previewHtml, setPreviewHtml] = useState("");
	const [showPreview, setShowPreview] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const saveMutation = useMutation({
		mutationFn: (data: StepForm) =>
			api.put<EmailTemplate>(`/capture-pages/${pageId}/email-sequence/${order}`, data),
		onSuccess: onSaved,
	});

	const deleteMutation = useMutation({
		mutationFn: () => api.delete(`/capture-pages/${pageId}/email-sequence/${order}`),
		onSuccess: onDeleted,
	});

	const previewMutation = useMutation({
		mutationFn: async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const res = await fetch(`/api/capture-pages/${pageId}/email-sequence/${order}/preview`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session?.access_token}`,
				},
				body: JSON.stringify({
					subject: form.subject,
					body: form.body,
					include_incentive_link: form.include_incentive_link,
				}),
			});
			return res.text();
		},
		onSuccess: (html) => {
			setPreviewHtml(html);
			setShowPreview(true);
		},
	});

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		saveMutation.mutate(form);
	}

	if (showPreview) {
		return (
			<div className="space-y-3">
				<p className="text-sm font-medium">Subject: {form.subject}</p>
				<div className="overflow-hidden rounded-lg border border-border">
					<iframe
						title="Email preview"
						srcDoc={previewHtml}
						className="h-[300px] w-full bg-[#0a0e1a]"
						sandbox=""
					/>
				</div>
				<Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
					Back to Editor
				</Button>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="flex items-center justify-between">
				<Label>Active</Label>
				<ToggleSwitch
					checked={form.is_active}
					onChange={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
				/>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label>Subject Line</Label>
					<span className="text-xs text-muted-foreground">{form.subject.length}/200</span>
				</div>
				<Input
					placeholder='e.g. "Thanks for coming out tonight!"'
					value={form.subject}
					onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
					required
					maxLength={200}
				/>
			</div>

			<div className="space-y-2">
				<Label>Email Body</Label>
				<Textarea
					placeholder="Write your message..."
					value={form.body}
					onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
					required
					maxLength={5000}
					rows={5}
					className="resize-y"
				/>
				<p className="text-xs text-muted-foreground">{form.body.length}/5000</p>
			</div>

			{order === 0 ? (
				<div className="space-y-2">
					<Label>Send Delay</Label>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
						{DELAY_OPTIONS.map((opt) => {
							const Icon = opt.icon;
							const active = form.delay_mode === opt.value;
							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => setForm((f) => ({ ...f, delay_mode: opt.value }))}
									className={`flex items-center gap-2 rounded-lg border p-3 transition-colors sm:flex-col sm:items-center sm:gap-1.5 ${active ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
								>
									<Icon className="size-4" />
									<span className="text-xs font-medium">{opt.label}</span>
								</button>
							);
						})}
					</div>
				</div>
			) : (
				<div className="space-y-2">
					<Label>Send after signup</Label>
					<div className="flex items-center gap-2">
						<Input
							type="number"
							min={1}
							max={30}
							value={form.delay_days}
							onChange={(e) => setForm((f) => ({ ...f, delay_days: Number(e.target.value) }))}
							className="w-20"
						/>
						<span className="text-sm text-muted-foreground">days (sent at 9am)</span>
					</div>
				</div>
			)}

			{hasIncentive && (
				<div className="flex items-center justify-between rounded-lg border border-border p-3">
					<div>
						<p className="text-sm font-medium">Include download link</p>
						<p className="text-xs text-muted-foreground">Time-limited incentive link.</p>
					</div>
					<ToggleSwitch
						checked={form.include_incentive_link}
						onChange={() =>
							setForm((f) => ({
								...f,
								include_incentive_link: !f.include_incentive_link,
							}))
						}
					/>
				</div>
			)}

			<div className="flex flex-wrap items-center gap-2">
				{existing && (
					<>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-destructive hover:text-destructive"
							onClick={() => setDeleteOpen(true)}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
							Delete
						</Button>
						<ConfirmDialog
							open={deleteOpen}
							onOpenChange={setDeleteOpen}
							title="Delete email step?"
							description={`This will permanently delete "${form.subject || "this email"}" from the sequence. Any pending sends for this step will be cancelled.`}
							onConfirm={() => deleteMutation.mutate()}
						/>
					</>
				)}
				<div className="flex-1" />
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!form.subject.trim() || !form.body.trim() || previewMutation.isPending}
					onClick={() => previewMutation.mutate()}
				>
					{previewMutation.isPending ? <Loader2 className="animate-spin" /> : <Eye />}
					Preview
				</Button>
				<Button
					type="submit"
					size="sm"
					disabled={!form.subject.trim() || !form.body.trim() || saveMutation.isPending}
				>
					{saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
					Save
				</Button>
			</div>

			{saveMutation.isError && (
				<p className="text-sm text-destructive">{saveMutation.error.message}</p>
			)}
		</form>
	);
}

// --- Toggle Switch (reused from the old dialog) ---

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={onChange}
			className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "bg-honey-gold" : "bg-muted"}`}
		>
			<span
				className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
			/>
		</button>
	);
}

// --- Main Sequence Dialog ---

export function EmailTemplateDialog({
	pageId,
	pageTitle,
	hasIncentive,
	open,
	onOpenChange,
}: {
	pageId: string;
	pageTitle: string;
	hasIncentive: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const queryKey = ["email-sequence", pageId];

	const { data: sequence, isLoading } = useQuery({
		queryKey,
		queryFn: () => api.get<EmailTemplate[]>(`/capture-pages/${pageId}/email-sequence`),
		enabled: open,
	});

	const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
	const [addingNew, setAddingNew] = useState(false);

	function invalidateAll() {
		queryClient.invalidateQueries({ queryKey });
		queryClient.invalidateQueries({ queryKey: ["email-sequence-status"] });
	}

	const steps = sequence ?? [];
	const canAddStep = steps.length < MAX_STEPS;
	const nextOrder = steps.length;
	const isNewSequence = steps.length === 0;

	if (isLoading) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-lg">
					<div className="flex items-center justify-center py-12">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="font-display flex items-center gap-2">
						<Mail className="size-5" />
						Email Sequence
					</DialogTitle>
					<DialogDescription>
						{isNewSequence
							? `Add follow-up emails for fans who sign up via "${pageTitle}".`
							: `${steps.length} email${steps.length === 1 ? "" : "s"} in sequence for "${pageTitle}".`}
					</DialogDescription>
				</DialogHeader>

				<div className="mt-4 space-y-3">
					{steps.map((step) => {
						const isExpanded = expandedOrder === step.sequence_order;
						return (
							<div key={step.id} className="rounded-lg border border-border">
								<button
									type="button"
									onClick={() => setExpandedOrder(isExpanded ? null : step.sequence_order)}
									className="flex w-full items-center gap-3 p-3 text-left"
								>
									<div
										className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.sequence_order === 0 ? "bg-honey-gold/20 text-honey-gold" : "bg-muted"}`}
									>
										{step.sequence_order + 1}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{step.subject || "Untitled"}</p>
										<p className="flex items-center gap-1 text-xs text-muted-foreground">
											{step.sequence_order === 0 ? (
												<Zap className="size-3 text-honey-gold" />
											) : (
												<CalendarDays className="size-3" />
											)}
											{step.sequence_order === 0
												? "Welcome email"
												: `Follow-up · ${stepDelayLabel(step)}`}
										</p>
									</div>
									<Badge
										variant={step.is_active ? "default" : "secondary"}
										className="shrink-0 text-xs"
									>
										{step.is_active ? "Active" : "Draft"}
									</Badge>
									{isExpanded ? (
										<ChevronUp className="size-4 text-muted-foreground" />
									) : (
										<ChevronDown className="size-4 text-muted-foreground" />
									)}
								</button>
								{isExpanded && (
									<div className="border-t border-border p-3">
										<SequenceStepEditor
											pageId={pageId}
											order={step.sequence_order}
											existing={step}
											hasIncentive={hasIncentive}
											onSaved={() => {
												invalidateAll();
												setExpandedOrder(null);
											}}
											onDeleted={() => {
												invalidateAll();
												setExpandedOrder(null);
											}}
										/>
									</div>
								)}
							</div>
						);
					})}

					{addingNew && (
						<div className="rounded-lg border border-honey-gold/50 p-3">
							<p className="mb-3 text-sm font-medium">
								Email #{nextOrder + 1}
								{nextOrder > 0 && " (follow-up)"}
							</p>
							<SequenceStepEditor
								pageId={pageId}
								order={nextOrder}
								existing={undefined}
								hasIncentive={hasIncentive}
								onSaved={() => {
									invalidateAll();
									setAddingNew(false);
								}}
								onDeleted={() => setAddingNew(false)}
							/>
						</div>
					)}
					{canAddStep && !addingNew && (
						<Button
							variant="outline"
							size="sm"
							className="w-full border-dashed"
							onClick={() => {
								setExpandedOrder(null);
								setAddingNew(true);
							}}
						>
							<Plus className="size-4" />
							Add Email
						</Button>
					)}
				</div>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function EmailTemplateBadge({ pageId, onClick }: { pageId: string; onClick?: () => void }) {
	const { data, isLoading } = useQuery({
		queryKey: ["email-sequence-status", pageId],
		queryFn: async () => {
			const seq = await api.get<EmailTemplate[]>(`/capture-pages/${pageId}/email-sequence`);
			if (!seq || seq.length === 0) return { total: 0, active: 0 };
			const activeCount = seq.filter((s) => s.is_active).length;
			return { total: seq.length, active: activeCount };
		},
	});

	if (isLoading || !data) return null;

	const noEmail = data.total === 0;
	const label = noEmail
		? "No follow-up email"
		: data.active === data.total
			? `${data.total} email${data.total === 1 ? "" : "s"} active`
			: `${data.active}/${data.total} active`;

	const variant = noEmail ? "destructive" : data.active > 0 ? "default" : "secondary";
	const Icon = noEmail ? AlertTriangle : Mail;

	if (onClick) {
		return (
			<button type="button" onClick={onClick}>
				<Badge
					variant={variant}
					className="gap-1 text-xs cursor-pointer hover:opacity-80 transition-opacity"
				>
					<Icon className="size-2.5" />
					{label}
				</Badge>
			</button>
		);
	}

	return (
		<Badge variant={variant} className="gap-1 text-xs">
			<Icon className="size-2.5" />
			{label}
		</Badge>
	);
}
