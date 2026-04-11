import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Clock, Eye, Loader2, Plus, Sunrise, Trash2, Zap } from "lucide-react";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export type EmailTemplate = {
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

export type StepEditorHandle = {
	saveIfDirty: () => void;
};

export const MAX_STEPS = 5;

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

export function stepDelayLabel(step: EmailTemplate): string {
	if (step.sequence_order === 0) {
		return DELAY_OPTIONS.find((o) => o.value === step.delay_mode)?.label ?? "Immediately";
	}
	return `Day ${step.delay_days}`;
}

export function StepDelayIcon({ step }: { step: EmailTemplate }) {
	if (step.sequence_order === 0) return <Zap className="size-3 text-honey-gold" />;
	return <CalendarDays className="size-3" />;
}

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

function formIsDirty(form: StepForm, existing: EmailTemplate | undefined): boolean {
	if (!existing) return form.subject.trim() !== "" || form.body.trim() !== "";
	return (
		form.subject !== existing.subject ||
		form.body !== existing.body ||
		form.include_incentive_link !== existing.include_incentive_link ||
		form.delay_mode !== existing.delay_mode ||
		form.delay_days !== existing.delay_days ||
		form.is_active !== existing.is_active
	);
}

// Step 0 (the welcome email) uses `delay_mode` to control send timing relative to
// capture: immediate, 1 hour later, or next morning at 9am artist-local-time.
// Steps 1+ ignore delay_mode and instead use `delay_days` — sent at 9am on day N.
// The API enforces monotonically increasing delay_days across steps via
// validateDelayMonotonic() so fans always receive emails in sequence order.
export function SequenceStepEditor({
	pageId,
	order,
	existing,
	hasIncentive,
	onSaved,
	onDeleted,
	ref,
}: {
	pageId: string;
	order: number;
	existing: EmailTemplate | undefined;
	hasIncentive: boolean;
	onSaved: () => void;
	onDeleted: () => void;
	ref?: Ref<StepEditorHandle>;
}) {
	const [form, setForm] = useState<StepForm>(existing ? formFromTemplate(existing) : EMPTY_STEP);
	const formRef = useRef(form);
	formRef.current = form;
	const existingRef = useRef(existing);
	existingRef.current = existing;
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

	useImperativeHandle(ref, () => ({
		saveIfDirty() {
			const f = formRef.current;
			if (!f.subject.trim() || !f.body.trim()) return;
			if (!formIsDirty(f, existingRef.current)) return;
			saveMutation.mutate(f);
		},
	}));

	const previewMutation = useMutation({
		mutationFn: () =>
			api.postText(`/capture-pages/${pageId}/email-sequence/${order}/preview`, {
				subject: form.subject,
				body: form.body,
				include_incentive_link: form.include_incentive_link,
			}),
		onSuccess: (html) => {
			setPreviewHtml(html);
			setShowPreview(true);
		},
	});

	function handleSave() {
		if (!form.subject.trim() || !form.body.trim()) return;
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
						className="h-[500px] w-full bg-[#0a0e1a]"
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
		<div className="space-y-4">
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
				{!existing && (
					<Button
						type="button"
						size="sm"
						disabled={!form.subject.trim() || !form.body.trim() || saveMutation.isPending}
						onClick={handleSave}
					>
						{saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
						Add
					</Button>
				)}
			</div>

			{saveMutation.isError && (
				<p className="text-sm text-destructive">{saveMutation.error.message}</p>
			)}
		</div>
	);
}
