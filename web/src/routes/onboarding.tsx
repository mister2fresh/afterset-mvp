import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
	Check,
	Clock,
	Download,
	ExternalLink,
	Eye,
	Loader2,
	Send,
	Sunrise,
	Zap,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { type CapturePage, PageForm } from "@/components/page-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getAllTimezones } from "@/lib/timezones";
import type { ArtistSettings } from "@/lib/types";

export const Route = createFileRoute("/onboarding")({
	beforeLoad: ({ context }) => {
		if (!context.auth.getUser()) {
			throw redirect({ to: "/login" });
		}
	},
	component: OnboardingPage,
});

const STEPS = ["Profile", "First Page", "Follow-Up Email", "Ready"] as const;

type DelayMode = "immediate" | "1_hour" | "next_morning";

const DELAY_OPTIONS: { value: DelayMode; label: string; icon: typeof Zap }[] = [
	{ value: "immediate", label: "Immediately", icon: Zap },
	{ value: "1_hour", label: "After 1 hour", icon: Clock },
	{ value: "next_morning", label: "Next morning (9am)", icon: Sunrise },
];

function OnboardingPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [step, setStep] = useState(0);

	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: () => api.get<ArtistSettings>("/settings"),
	});

	// Step 1 state
	const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const [name, setName] = useState("");
	const [timezone, setTimezone] = useState(detectedTz);
	const [nameInitialized, setNameInitialized] = useState(false);

	if (settings && !nameInitialized) {
		setName(settings.name);
		setTimezone(settings.timezone === "America/New_York" ? detectedTz : settings.timezone);
		setNameInitialized(true);
		if (settings.onboarding_completed) {
			navigate({ to: "/dashboard" });
		}
	}

	// Step 2 state — created page
	const [createdPage, setCreatedPage] = useState<CapturePage | null>(null);

	// Step 3 state — follow-up email form
	const [emailSubject, setEmailSubject] = useState("");
	const [emailBody, setEmailBody] = useState("");
	const [delayMode, setDelayMode] = useState<DelayMode>("immediate");
	const [includeIncentive, setIncludeIncentive] = useState(false);
	const [previewHtml, setPreviewHtml] = useState("");
	const [showPreview, setShowPreview] = useState(false);

	const emailForm = { subject: emailSubject, body: emailBody, delayMode, includeIncentive };
	function handleEmailFormChange(patch: Partial<typeof emailForm>) {
		if ("subject" in patch) setEmailSubject(patch.subject!);
		if ("body" in patch) setEmailBody(patch.body!);
		if ("delayMode" in patch) setDelayMode(patch.delayMode!);
		if ("includeIncentive" in patch) setIncludeIncentive(patch.includeIncentive!);
	}
	const emailPreview = { html: previewHtml, show: showPreview, onShowChange: setShowPreview };

	const profileMutation = useMutation({
		mutationFn: (updates: { name: string; timezone: string }) =>
			api.patch<ArtistSettings>("/settings", updates),
		onSuccess: (data) => {
			queryClient.setQueryData(["settings"], data);
			setStep(1);
		},
	});

	const completeMutation = useMutation({
		mutationFn: () => api.patch<ArtistSettings>("/settings", { onboarding_completed: true }),
		onSuccess: (data) => {
			queryClient.setQueryData(["settings"], data);
			navigate({ to: "/dashboard" });
		},
	});

	function handleProfileSubmit(e: FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		profileMutation.mutate({ name: name.trim(), timezone });
	}

	const emailSaveMutation = useMutation({
		mutationFn: () =>
			api.put(`/capture-pages/${createdPage?.id}/email-sequence/0`, {
				subject: emailSubject,
				body: emailBody,
				delay_mode: delayMode,
				include_incentive_link: includeIncentive,
				is_active: true,
				delay_days: 0,
			}),
		onSuccess: () => setStep(3),
	});

	const emailPreviewMutation = useMutation({
		mutationFn: () =>
			api.postText(`/capture-pages/${createdPage?.id}/email-sequence/0/preview`, {
				subject: emailSubject,
				body: emailBody,
				include_incentive_link: includeIncentive,
			}),
		onSuccess: (html) => {
			setPreviewHtml(html);
			setShowPreview(true);
		},
	});

	function handlePageCreated(page: CapturePage) {
		setCreatedPage(page);
		setStep(2);
	}

	function handleEmailSubmit(e: FormEvent) {
		e.preventDefault();
		emailSaveMutation.mutate();
	}

	function handleComplete() {
		completeMutation.mutate();
	}

	async function handleDownloadQr() {
		if (!createdPage) return;
		try {
			const blob = await api.getBlob(`/capture-pages/${createdPage.id}/qr.png?download=1`);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${createdPage.slug}-qr.png`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			const { toast } = await import("sonner");
			toast.error("Failed to download QR code");
		}
	}

	return (
		<div className="flex min-h-screen flex-col items-center px-4 py-12">
			<div className="mb-8">
				<span className="font-display text-2xl font-bold text-honey-gold">Afterset</span>
			</div>

			{/* Progress steps */}
			<div className="mb-8 flex items-center gap-2">
				{STEPS.map((label, i) => (
					<div key={label} className="flex items-center gap-2">
						<div
							className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
								i < step
									? "bg-honey-gold text-midnight"
									: i === step
										? "border-2 border-honey-gold text-honey-gold"
										: "border border-muted-foreground/30 text-muted-foreground/50"
							}`}
						>
							{i < step ? <Check className="size-4" /> : i + 1}
						</div>
						<span
							className={`hidden text-xs sm:inline ${
								i === step ? "text-foreground" : "text-muted-foreground/50"
							}`}
						>
							{label}
						</span>
						{i < STEPS.length - 1 && (
							<div
								className={`h-px w-8 ${i < step ? "bg-honey-gold" : "bg-muted-foreground/20"}`}
							/>
						)}
					</div>
				))}
			</div>

			<Card className="w-full max-w-lg">
				<CardContent className="pt-6">
					{step === 0 && (
						<form onSubmit={handleProfileSubmit} className="space-y-6">
							<div className="text-center">
								<h2 className="font-display text-xl font-bold">Welcome to Afterset</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									Let's get your profile set up so fans see the right name.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="onb-name">Artist / Band Name</Label>
								<Input
									id="onb-name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Your artist name"
									autoFocus
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="onb-tz">Timezone</Label>
								<select
									id="onb-tz"
									value={timezone}
									onChange={(e) => setTimezone(e.target.value)}
									className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								>
									{getAllTimezones().map((tz) => (
										<option key={tz} value={tz}>
											{tz.replace(/_/g, " ")}
										</option>
									))}
								</select>
								<p className="text-xs text-muted-foreground">
									Used to send follow-up emails at the right time (9 AM your time).
								</p>
							</div>

							<Button
								type="submit"
								className="w-full"
								disabled={!name.trim() || profileMutation.isPending}
							>
								{profileMutation.isPending ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Saving...
									</>
								) : (
									"Continue"
								)}
							</Button>
							{profileMutation.isError && (
								<p className="text-center text-sm text-red-400">{profileMutation.error.message}</p>
							)}
						</form>
					)}

					{step === 1 && (
						<div className="space-y-6">
							<div className="text-center">
								<h2 className="font-display text-xl font-bold">Create Your First Page</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									This is the page fans see when they scan your QR code.
								</p>
							</div>
							<PageForm mode="create" onSuccess={handlePageCreated} submitLabel="Create Page" />
						</div>
					)}

					{step === 2 && createdPage && (
						<EmailStep
							createdPage={createdPage}
							emailForm={emailForm}
							onEmailFormChange={handleEmailFormChange}
							preview={emailPreview}
							mutations={{ save: emailSaveMutation, preview: emailPreviewMutation }}
							onSubmit={handleEmailSubmit}
							onSkip={() => setStep(3)}
						/>
					)}

					{step === 3 && createdPage && (
						<div className="space-y-6 text-center">
							<div>
								<h2 className="font-display text-xl font-bold">You're All Set</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									Your capture page is live. Download the QR code and bring it to your next gig.
								</p>
							</div>

							<QrPreview pageId={createdPage.id} />

							<div className="flex flex-col gap-2">
								<Button onClick={handleDownloadQr} variant="outline" className="w-full">
									<Download className="size-4" />
									Download QR Code
								</Button>
								<a
									href={`https://afterset.net/c/${createdPage.slug}`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									<ExternalLink className="size-4" />
									Preview Live Page
								</a>
							</div>

							<Button
								onClick={handleComplete}
								className="w-full"
								disabled={completeMutation.isPending}
							>
								{completeMutation.isPending ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Finishing...
									</>
								) : (
									"Go to Dashboard"
								)}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

type EmailFormData = {
	subject: string;
	body: string;
	delayMode: DelayMode;
	includeIncentive: boolean;
};
type EmailPreview = { html: string; show: boolean; onShowChange: (v: boolean) => void };
type EmailMutations = {
	save: { mutate: () => void; isPending: boolean; isError: boolean; error: Error | null };
	preview: { mutate: () => void; isPending: boolean };
};

function EmailStep({
	createdPage,
	emailForm,
	onEmailFormChange,
	preview,
	mutations,
	onSubmit,
	onSkip,
}: {
	createdPage: CapturePage;
	emailForm: EmailFormData;
	onEmailFormChange: (patch: Partial<EmailFormData>) => void;
	preview: EmailPreview;
	mutations: EmailMutations;
	onSubmit: (e: FormEvent) => void;
	onSkip: () => void;
}) {
	const hasIncentive = !!createdPage.incentive_file_path;
	const canSubmit = emailForm.subject.trim() && emailForm.body.trim();

	if (preview.show) {
		return (
			<div className="space-y-4">
				<div className="text-center">
					<h2 className="font-display text-xl font-bold">Preview Email</h2>
					<p className="mt-1 text-sm text-muted-foreground">Subject: {emailForm.subject}</p>
				</div>
				<div className="overflow-hidden rounded-lg border border-border">
					<iframe
						title="Email preview"
						srcDoc={preview.html}
						className="h-[300px] w-full bg-[#0a0e1a]"
						sandbox=""
					/>
				</div>
				<Button variant="outline" className="w-full" onClick={() => preview.onShowChange(false)}>
					Back to Editor
				</Button>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="space-y-5">
			<div className="text-center">
				<h2 className="font-display text-xl font-bold">Set Up Follow-Up Email</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Send fans an email after they sign up. You can always edit this later.
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="onb-email-subject">Subject Line</Label>
				<Input
					id="onb-email-subject"
					placeholder='e.g. "Thanks for coming out tonight!"'
					value={emailForm.subject}
					onChange={(e) => onEmailFormChange({ subject: e.target.value })}
					maxLength={200}
					autoFocus
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="onb-email-body">Email Body</Label>
				<Textarea
					id="onb-email-body"
					placeholder="Write your message to new fans..."
					value={emailForm.body}
					onChange={(e) => onEmailFormChange({ body: e.target.value })}
					maxLength={5000}
					rows={5}
					className="resize-y"
				/>
				<p className="text-xs text-muted-foreground">{emailForm.body.length}/5000</p>
			</div>

			<div className="space-y-2">
				<Label>When to Send</Label>
				<div className="grid grid-cols-3 gap-2">
					{DELAY_OPTIONS.map((opt) => {
						const Icon = opt.icon;
						const active = emailForm.delayMode === opt.value;
						return (
							<button
								key={opt.value}
								type="button"
								onClick={() => onEmailFormChange({ delayMode: opt.value })}
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
							Attach your incentive file to this email.
						</p>
					</div>
					<button
						type="button"
						role="switch"
						aria-checked={emailForm.includeIncentive}
						onClick={() => onEmailFormChange({ includeIncentive: !emailForm.includeIncentive })}
						className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${emailForm.includeIncentive ? "bg-honey-gold" : "bg-muted"}`}
					>
						<span
							className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${emailForm.includeIncentive ? "translate-x-5" : "translate-x-0"}`}
						/>
					</button>
				</div>
			)}

			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!canSubmit || mutations.preview.isPending}
					onClick={() => mutations.preview.mutate()}
				>
					{mutations.preview.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Eye className="size-4" />
					)}
					Preview
				</Button>
				<div className="flex-1" />
				<Button
					type="submit"
					className="w-full sm:w-auto"
					disabled={!canSubmit || mutations.save.isPending}
				>
					{mutations.save.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Send className="size-4" />
					)}
					Save & Continue
				</Button>
			</div>

			<button
				type="button"
				onClick={onSkip}
				className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
			>
				Skip for now — you can set this up later from the Emails tab
			</button>

			{mutations.save.isError && (
				<p className="text-center text-sm text-red-400">{mutations.save.error?.message}</p>
			)}
		</form>
	);
}

function QrPreview({ pageId }: { pageId: string }) {
	const { data: qrUrl, isLoading } = useQuery({
		queryKey: ["qr-preview", pageId],
		queryFn: async () => {
			const blob = await api.getBlob(`/capture-pages/${pageId}/qr.png`);
			return URL.createObjectURL(blob);
		},
		staleTime: Number.POSITIVE_INFINITY,
	});

	if (isLoading || !qrUrl) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex justify-center">
			<img src={qrUrl} alt="QR Code" className="size-48 rounded-lg" />
		</div>
	);
}
