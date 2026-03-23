import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Eye, Loader2, Mail, Send, Sunrise, Trash2, Zap } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
	subject: string;
	body: string;
	include_incentive_link: boolean;
	delay_mode: "immediate" | "1_hour" | "next_morning";
	is_active: boolean;
	created_at: string;
	updated_at: string;
};

type TemplateForm = {
	subject: string;
	body: string;
	include_incentive_link: boolean;
	delay_mode: "immediate" | "1_hour" | "next_morning";
	is_active: boolean;
};

const EMPTY_FORM: TemplateForm = {
	subject: "",
	body: "",
	include_incentive_link: false,
	delay_mode: "immediate",
	is_active: false,
};

const DELAY_OPTIONS = [
	{ value: "immediate" as const, label: "Immediately", icon: Zap },
	{ value: "1_hour" as const, label: "After 1 hour", icon: Clock },
	{ value: "next_morning" as const, label: "Next morning (9am)", icon: Sunrise },
];

function formFromTemplate(t: EmailTemplate): TemplateForm {
	return {
		subject: t.subject,
		body: t.body,
		include_incentive_link: t.include_incentive_link,
		delay_mode: t.delay_mode,
		is_active: t.is_active,
	};
}

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
	const queryKey = ["email-template", pageId];

	const { data: existing, isLoading } = useQuery({
		queryKey,
		queryFn: async () => {
			try {
				return await api.get<EmailTemplate>(`/capture-pages/${pageId}/email-template`);
			} catch {
				return null;
			}
		},
		enabled: open,
	});

	const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
	const [showPreview, setShowPreview] = useState(false);
	const [previewHtml, setPreviewHtml] = useState("");

	useEffect(() => {
		if (existing) setForm(formFromTemplate(existing));
		else setForm(EMPTY_FORM);
	}, [existing]);

	const saveMutation = useMutation({
		mutationFn: (data: TemplateForm) =>
			api.put<EmailTemplate>(`/capture-pages/${pageId}/email-template`, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			queryClient.invalidateQueries({ queryKey: ["email-template-status"] });
			onOpenChange(false);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () => api.delete(`/capture-pages/${pageId}/email-template`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			queryClient.invalidateQueries({ queryKey: ["email-template-status"] });
			setForm(EMPTY_FORM);
			onOpenChange(false);
		},
	});

	const previewMutation = useMutation({
		mutationFn: async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const res = await fetch(`/api/capture-pages/${pageId}/email-template/preview`, {
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

	if (showPreview) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle className="font-display">Email Preview</DialogTitle>
						<DialogDescription>Subject: {form.subject}</DialogDescription>
					</DialogHeader>
					<div className="overflow-hidden rounded-lg border border-border">
						<iframe
							title="Email preview"
							srcDoc={previewHtml}
							className="h-[400px] w-full bg-[#0a0e1a]"
							sandbox=""
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowPreview(false)}>
							Back to Editor
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="font-display flex items-center gap-2">
							<Mail className="size-5" />
							Follow-Up Email
						</DialogTitle>
						<DialogDescription>
							Configure the email fans receive after signing up via "{pageTitle}".
						</DialogDescription>
					</DialogHeader>

					<div className="mt-6 space-y-6">
						<div className="flex items-center justify-between">
							<Label htmlFor="is_active">Send follow-up emails</Label>
							<button
								type="button"
								role="switch"
								aria-checked={form.is_active}
								onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
								className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.is_active ? "bg-honey-gold" : "bg-muted"}`}
							>
								<span
									className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-5" : "translate-x-0"}`}
								/>
							</button>
						</div>

						<div className="space-y-2">
							<Label htmlFor="subject">Subject Line</Label>
							<Input
								id="subject"
								placeholder='e.g. "Thanks for coming out tonight!"'
								value={form.subject}
								onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
								required
								maxLength={200}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="body">Email Body</Label>
							<Textarea
								id="body"
								placeholder="Write your follow-up message to fans..."
								value={form.body}
								onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
								required
								maxLength={5000}
								rows={6}
								className="resize-y"
							/>
							<p className="text-xs text-muted-foreground">
								{form.body.length}/5000 — Separate paragraphs with blank lines.
							</p>
						</div>

						<div className="space-y-3">
							<Label>Send Delay</Label>
							<div className="grid grid-cols-3 gap-2">
								{DELAY_OPTIONS.map((opt) => {
									const Icon = opt.icon;
									const active = form.delay_mode === opt.value;
									return (
										<button
											key={opt.value}
											type="button"
											onClick={() => setForm((f) => ({ ...f, delay_mode: opt.value }))}
											className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${active ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
										>
											<Icon className="size-4" />
											<span className="text-xs font-medium">{opt.label}</span>
										</button>
									);
								})}
							</div>
						</div>

						{hasIncentive && (
							<div className="flex items-center justify-between rounded-lg border border-border p-3">
								<div>
									<p className="text-sm font-medium">Include download link</p>
									<p className="text-xs text-muted-foreground">
										Attach a time-limited link to the incentive file.
									</p>
								</div>
								<button
									type="button"
									role="switch"
									aria-checked={form.include_incentive_link}
									onClick={() =>
										setForm((f) => ({
											...f,
											include_incentive_link: !f.include_incentive_link,
										}))
									}
									className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.include_incentive_link ? "bg-honey-gold" : "bg-muted"}`}
								>
									<span
										className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${form.include_incentive_link ? "translate-x-5" : "translate-x-0"}`}
									/>
								</button>
							</div>
						)}
					</div>

					<DialogFooter className="mt-6 gap-2">
						{existing && (
							<Button
								type="button"
								variant="ghost"
								className="mr-auto text-destructive hover:text-destructive"
								onClick={() => deleteMutation.mutate()}
								disabled={deleteMutation.isPending}
							>
								{deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
								Delete
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							disabled={!form.subject.trim() || !form.body.trim() || previewMutation.isPending}
							onClick={() => previewMutation.mutate()}
						>
							{previewMutation.isPending ? <Loader2 className="animate-spin" /> : <Eye />}
							Preview
						</Button>
						<Button
							type="submit"
							disabled={!form.subject.trim() || !form.body.trim() || saveMutation.isPending}
						>
							{saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
							{existing ? "Save Template" : "Create Template"}
						</Button>
					</DialogFooter>

					{saveMutation.isError && (
						<p className="mt-2 text-sm text-destructive">{saveMutation.error.message}</p>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function EmailTemplateBadge({ pageId }: { pageId: string }) {
	const { data } = useQuery({
		queryKey: ["email-template-status", pageId],
		queryFn: async () => {
			try {
				const t = await api.get<EmailTemplate>(`/capture-pages/${pageId}/email-template`);
				return t.is_active ? "active" : "draft";
			} catch {
				return "none";
			}
		},
	});

	if (!data || data === "none") return null;

	return (
		<Badge variant={data === "active" ? "default" : "secondary"} className="gap-1 text-[10px]">
			<Mail className="size-2.5" />
			{data === "active" ? "Email active" : "Email draft"}
		</Badge>
	);
}
