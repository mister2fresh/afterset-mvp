import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	FileAudio,
	FileImage,
	FileText,
	FileVideo,
	Loader2,
	MessageSquare,
	Package,
	Smartphone,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InlineSequenceEditor } from "@/components/inline-sequence-editor";
import { ThemeEditor, type ThemeFields } from "@/components/theme-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, uploadToSignedUrl } from "@/lib/api";

export type CapturePage = {
	id: string;
	slug: string;
	title: string;
	value_exchange_text: string | null;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
	accent_color: string;
	secondary_color: string;
	background_style: string;
	button_style: string;
	font_style: string;
	title_size: string;
	layout_style: string;
	text_color: string;
	bg_color: string;
	is_active: boolean;
	incentive_file_path: string | null;
	incentive_file_name: string | null;
	incentive_file_size: number | null;
	incentive_content_type: string | null;
	created_at: string;
	updated_at: string;
};

type FormData = {
	slug: string;
	title: string;
	value_exchange_text: string;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
} & ThemeFields;

const EMPTY_FORM: FormData = {
	slug: "",
	title: "",
	value_exchange_text: "",
	accent_color: "#E8C547",
	secondary_color: "#D4A017",
	background_style: "solid",
	button_style: "rounded",
	font_style: "modern",
	title_size: "default",
	layout_style: "centered",
	text_color: "#f9fafb",
	bg_color: "#0a0e1a",
	streaming_links: {},
	social_links: {},
};

function formFromPage(page: CapturePage): FormData {
	return {
		slug: page.slug,
		title: page.title,
		value_exchange_text: page.value_exchange_text ?? "",
		accent_color: page.accent_color,
		secondary_color: page.secondary_color,
		background_style: (page.background_style as FormData["background_style"]) ?? "solid",
		button_style: (page.button_style as FormData["button_style"]) ?? "rounded",
		font_style: (page.font_style as FormData["font_style"]) ?? "modern",
		title_size: (page.title_size as FormData["title_size"]) ?? "default",
		layout_style: (page.layout_style as FormData["layout_style"]) ?? "centered",
		text_color: page.text_color ?? "#f9fafb",
		bg_color: page.bg_color ?? "#0a0e1a",
		streaming_links: { ...page.streaming_links },
		social_links: { ...page.social_links },
	};
}

const ACCEPTED_FILE_TYPES = [
	"audio/mpeg",
	"audio/wav",
	"audio/flac",
	"audio/aac",
	"audio/ogg",
	"audio/mp4",
	"audio/aiff",
	"audio/x-aiff",
	"audio/x-m4a",
	"audio/x-flac",
	"audio/x-wav",
	"image/png",
	"image/jpeg",
	"image/gif",
	"video/mp4",
	"video/quicktime",
	"video/webm",
	"application/pdf",
	"application/zip",
	"application/x-zip-compressed",
].join(",");

const MAX_FILE_SIZE = 262144000; // 250MB

const STREAMING_PLATFORMS = [
	{ key: "spotify", label: "Spotify" },
	{ key: "apple_music", label: "Apple Music" },
	{ key: "youtube_music", label: "YouTube Music" },
	{ key: "soundcloud", label: "SoundCloud" },
	{ key: "tidal", label: "Tidal" },
	{ key: "bandcamp", label: "Bandcamp" },
] as const;

const SOCIAL_PLATFORMS = [
	{ key: "instagram", label: "Instagram" },
	{ key: "tiktok", label: "TikTok" },
	{ key: "twitter", label: "X (Twitter)" },
	{ key: "youtube", label: "YouTube" },
	{ key: "facebook", label: "Facebook" },
] as const;

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeIcon(contentType: string) {
	if (contentType.startsWith("audio/")) return FileAudio;
	if (contentType.startsWith("image/")) return FileImage;
	if (contentType.startsWith("video/")) return FileVideo;
	if (contentType === "application/pdf") return FileText;
	return Package;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

function stripEmpty(obj: Record<string, string>): Record<string, string> | undefined {
	const filtered = Object.fromEntries(Object.entries(obj).filter(([, v]) => v.trim() !== ""));
	return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function hasAnyLink(links: Record<string, string>): boolean {
	return Object.values(links).some((v) => v.trim() !== "");
}

// --- Sub-components ---

function IncentiveFileDisplay({
	name,
	size,
	contentType,
	progress,
	onRemove,
	isRemoving,
}: {
	name: string;
	size: number;
	contentType: string;
	progress?: number | null;
	onRemove: () => void;
	isRemoving?: boolean;
}): React.ReactElement {
	const Icon = fileTypeIcon(contentType);
	const isUploading = progress !== null && progress !== undefined;

	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
			<Icon className="size-8 shrink-0 text-honey-gold" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{name}</p>
				<p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
				{isUploading && (
					<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-honey-gold transition-[width] duration-200"
							style={{ width: `${progress}%` }}
						/>
					</div>
				)}
			</div>
			{!isUploading && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-7 shrink-0"
					onClick={onRemove}
					disabled={isRemoving}
				>
					{isRemoving ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
				</Button>
			)}
		</div>
	);
}

type KeywordCheckResult = {
	available: boolean;
	reserved?: boolean;
	current?: boolean;
	suggestions?: string[];
};

function KeywordSection({
	keyword,
	setKeyword,
	mode,
	pageId,
	currentKeyword,
}: {
	keyword: string;
	setKeyword: (v: string) => void;
	mode: "create" | "edit";
	pageId: string | undefined;
	currentKeyword: string | null | undefined;
}): React.ReactElement {
	const [kwCheck, setKwCheck] = useState<KeywordCheckResult | null>(null);
	const [kwChecking, setKwChecking] = useState(false);
	const [kwDebouncing, setKwDebouncing] = useState(false);

	const checkKeyword = useCallback(
		async (kw: string) => {
			if (kw.length < 2 || !pageId) {
				setKwCheck(null);
				setKwDebouncing(false);
				return;
			}
			setKwChecking(true);
			setKwDebouncing(false);
			try {
				const result = await api.post<KeywordCheckResult>(
					`/capture-pages/${pageId}/keyword/check`,
					{ keyword: kw },
				);
				setKwCheck(result);
			} catch {
				setKwCheck(null);
			} finally {
				setKwChecking(false);
			}
		},
		[pageId],
	);

	useEffect(() => {
		if (mode !== "edit") return;
		const clean = keyword.replace(/[^A-Za-z0-9]/g, "");
		if (clean.length >= 2) setKwDebouncing(true);
		const timer = setTimeout(() => {
			if (clean.length >= 2) checkKeyword(clean);
			else {
				setKwCheck(null);
				setKwDebouncing(false);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [keyword, checkKeyword, mode]);

	return (
		<div className="space-y-2">
			<Label htmlFor="keyword">
				<span className="flex items-center gap-1.5">
					<MessageSquare className="size-3.5" />
					Text-to-Join Keyword <span className="text-muted-foreground">(optional)</span>
				</span>
			</Label>
			<p className="text-xs text-muted-foreground">
				Fans text this keyword to your number to get the capture page link.
			</p>
			<div className="relative">
				<Input
					id="keyword"
					placeholder="e.g. JDOE"
					value={keyword.toUpperCase()}
					onChange={(e) => {
						const clean = e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
						setKeyword(clean);
					}}
					maxLength={20}
					className="pr-10 uppercase"
				/>
				{keyword.length >= 2 && mode === "edit" && (
					<div className="absolute inset-y-0 right-3 flex items-center">
						{kwChecking || kwDebouncing ? (
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
						) : kwCheck?.available || kwCheck?.current ? (
							<Check className="size-4 text-green-500" />
						) : kwCheck ? (
							<X className="size-4 text-destructive" />
						) : null}
					</div>
				)}
			</div>
			<p className="text-xs text-muted-foreground">2–20 characters, letters and numbers only.</p>
			{mode === "edit" && kwCheck && !kwCheck.available && !kwCheck.current && (
				<>
					{kwCheck.reserved ? (
						<div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
							<AlertCircle className="size-4 shrink-0" />
							This keyword is reserved for SMS compliance.
						</div>
					) : (
						<p className="text-sm text-destructive">This keyword is already taken.</p>
					)}
					{kwCheck.suggestions && kwCheck.suggestions.length > 0 && (
						<div className="space-y-1.5">
							<p className="text-xs text-muted-foreground">Available alternatives:</p>
							<div className="flex flex-wrap gap-2">
								{kwCheck.suggestions.map((s) => (
									<button
										key={s}
										type="button"
										onClick={() => setKeyword(s)}
										className="rounded-full border border-border px-3 py-1 font-mono text-xs transition-colors hover:border-honey-gold hover:text-honey-gold"
									>
										{s}
									</button>
								))}
							</div>
						</div>
					)}
				</>
			)}
			{currentKeyword && keyword.length === 0 && (
				<p className="flex items-center gap-1.5 text-xs text-destructive">
					<Trash2 className="size-3" />
					Keyword will be removed on save.
				</p>
			)}
		</div>
	);
}

function NfcSection({
	slug,
	highlight,
}: {
	slug: string;
	highlight?: boolean;
}): React.ReactElement {
	const [copied, setCopied] = useState(false);
	const nfcUrl = `https://afterset.net/c/${slug}?v=n`;

	async function copyUrl(): Promise<void> {
		await navigator.clipboard.writeText(nfcUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	if (highlight) {
		return (
			<div className="space-y-2 rounded-lg border border-[#E8C547]/30 bg-[#E8C547]/5 p-4">
				<p className="flex items-center gap-1.5 text-sm font-medium text-[#E8C547]">
					<Smartphone className="size-4" />
					Your NFC tag URL is ready
				</p>
				<p className="text-xs text-muted-foreground">
					Program an NFC sticker with this URL — fans tap their phone to open your capture page.
				</p>
				<div className="flex items-center gap-2">
					<code className="flex-1 truncate rounded-md border border-[#E8C547]/20 bg-muted/30 px-3 py-2 font-mono text-xs">
						{nfcUrl}
					</code>
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="shrink-0"
						onClick={copyUrl}
					>
						{copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
					</Button>
				</div>
				<p className="text-xs text-muted-foreground/70">
					Use any NFC writer app (NFC Tools, Shortcuts) to write this URL to an NTAG213 sticker.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<Label>
				<span className="flex items-center gap-1.5">
					<Smartphone className="size-3.5" />
					NFC Tag URL
				</span>
			</Label>
			<p className="text-xs text-muted-foreground">
				Program an NFC sticker or card with this URL. Fans tap their phone to open your page.
			</p>
			<div className="flex items-center gap-2">
				<code className="flex-1 truncate rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
					{nfcUrl}
				</code>
				<Button type="button" variant="outline" size="icon" className="shrink-0" onClick={copyUrl}>
					{copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
				</Button>
			</div>
			<p className="text-xs text-muted-foreground/70">
				Use any NFC writer app (NFC Tools, Shortcuts) to write this URL to an NTAG213 sticker.
			</p>
		</div>
	);
}

function IncentiveSection({
	pendingFile,
	hasExistingFile,
	page,
	uploadProgress,
	uploadError,
	fileInputRef,
	isDragging,
	setIsDragging,
	onFileSelect,
	onRemovePending,
	onRemoveExisting,
	removeFileOpen,
	setRemoveFileOpen,
	isRemoving,
}: {
	pendingFile: File | null;
	hasExistingFile: boolean;
	page: CapturePage | undefined;
	uploadProgress: number | null;
	uploadError: string | null;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	isDragging: boolean;
	setIsDragging: (v: boolean) => void;
	onFileSelect: (file: File | undefined) => void;
	onRemovePending: () => void;
	onRemoveExisting: () => void;
	removeFileOpen: boolean;
	setRemoveFileOpen: (v: boolean) => void;
	isRemoving: boolean;
}): React.ReactElement {
	return (
		<div className="space-y-2">
			<Label>
				Incentive File <span className="text-muted-foreground">(optional)</span>
			</Label>
			<p className="text-xs text-muted-foreground">
				Upload a file fans receive after signing up — music, artwork, PDF, video, or a ZIP bundle.
			</p>

			{pendingFile ? (
				<IncentiveFileDisplay
					name={pendingFile.name}
					size={pendingFile.size}
					contentType={pendingFile.type}
					progress={uploadProgress}
					onRemove={onRemovePending}
				/>
			) : hasExistingFile ? (
				<>
					<IncentiveFileDisplay
						name={page?.incentive_file_name ?? ""}
						size={page?.incentive_file_size ?? 0}
						contentType={page?.incentive_content_type ?? ""}
						onRemove={() => setRemoveFileOpen(true)}
						isRemoving={isRemoving}
					/>
					<ConfirmDialog
						open={removeFileOpen}
						onOpenChange={setRemoveFileOpen}
						title="Remove incentive file?"
						description={`This will delete "${page?.incentive_file_name}". Fans who already received a download link can still access it until it expires.`}
						confirmLabel="Remove"
						onConfirm={onRemoveExisting}
					/>
				</>
			) : (
				<label
					className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 transition-colors ${isDragging ? "border-honey-gold bg-honey-gold/10" : "border-border hover:border-honey-gold/50 hover:bg-muted/50"}`}
					onDragOver={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={(e) => {
						e.preventDefault();
						setIsDragging(false);
						onFileSelect(e.dataTransfer.files[0]);
					}}
				>
					<Upload className="size-6 text-muted-foreground" />
					<span className="text-sm text-muted-foreground">
						Drag & drop or click to choose a file (max {formatFileSize(MAX_FILE_SIZE)})
					</span>
					<input
						ref={fileInputRef}
						type="file"
						accept={ACCEPTED_FILE_TYPES}
						className="hidden"
						onChange={(e) => onFileSelect(e.target.files?.[0])}
					/>
				</label>
			)}

			{uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
		</div>
	);
}

function LinkSection({
	group,
	label,
	platforms,
	links,
	open,
	setOpen,
	onLinkChange,
}: {
	group: string;
	label: string;
	platforms: readonly { key: string; label: string }[];
	links: Record<string, string>;
	open: boolean;
	setOpen: (v: boolean) => void;
	onLinkChange: (key: string, value: string) => void;
}): React.ReactElement {
	return (
		<div className="space-y-3">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full items-center justify-between"
			>
				<Label className="pointer-events-none">
					{label} <span className="text-muted-foreground">(optional)</span>
				</Label>
				{open ? (
					<ChevronUp className="size-4 text-muted-foreground" />
				) : (
					<ChevronDown className="size-4 text-muted-foreground" />
				)}
			</button>
			{open &&
				platforms.map((p) => (
					<div key={p.key} className="flex items-center gap-2">
						<Label
							htmlFor={`${group}-${p.key}`}
							className="w-20 shrink-0 text-xs text-muted-foreground sm:w-28"
						>
							{p.label}
						</Label>
						<Input
							id={`${group}-${p.key}`}
							type="url"
							placeholder="https://..."
							value={links[p.key] ?? ""}
							onChange={(e) => onLinkChange(p.key, e.target.value)}
							className="text-sm"
						/>
					</div>
				))}
		</div>
	);
}

// --- Main component ---

type PageFormProps = {
	mode: "create" | "edit";
	page?: CapturePage;
	currentKeyword?: string | null;
	defaultLinks?: {
		streaming_links: Record<string, string>;
		social_links: Record<string, string>;
	};
	onSuccess: (page: CapturePage) => void;
	onCancel?: () => void;
	submitLabel?: string;
	autoExpandEmail?: boolean;
};

async function uploadIncentiveFile(
	pageId: string,
	file: File,
	onProgress: (percent: number) => void,
): Promise<void> {
	const { signed_url, token } = await api.post<{
		signed_url: string;
		token: string;
		path: string;
	}>(`/capture-pages/${pageId}/incentive/upload-url`, {
		filename: file.name,
		content_type: file.type,
		file_size: file.size,
	});
	await uploadToSignedUrl(signed_url, token, file, onProgress);
}

async function saveKeyword(
	pageId: string,
	keyword: string,
	currentKeyword: string | null | undefined,
): Promise<void> {
	const clean = keyword.replace(/[^A-Za-z0-9]/g, "");
	if (clean.length >= 2 && clean.toUpperCase() !== currentKeyword) {
		await api.put(`/capture-pages/${pageId}/keyword`, { keyword: clean });
	} else if (!clean && currentKeyword) {
		await api.delete(`/capture-pages/${pageId}/keyword`);
	}
}

export function PageForm({
	mode,
	page,
	currentKeyword,
	defaultLinks,
	onSuccess,
	onCancel,
	submitLabel,
	autoExpandEmail,
}: PageFormProps): React.ReactElement {
	const queryClient = useQueryClient();
	const initialForm = page
		? formFromPage(page)
		: defaultLinks
			? {
					...EMPTY_FORM,
					streaming_links: { ...defaultLinks.streaming_links },
					social_links: { ...defaultLinks.social_links },
				}
			: EMPTY_FORM;
	const [form, setForm] = useState<FormData>(initialForm);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [fileRemoved, setFileRemoved] = useState(false);
	const [removeFileOpen, setRemoveFileOpen] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [streamingOpen, setStreamingOpen] = useState(hasAnyLink(initialForm.streaming_links));
	const [socialOpen, setSocialOpen] = useState(hasAnyLink(initialForm.social_links));
	const fileInputRef = useRef<HTMLInputElement>(null);
	const nfcEmailRef = useRef<HTMLDivElement>(null);

	// Slug availability (create mode only)
	const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
	const [slugChecking, setSlugChecking] = useState(false);

	useEffect(() => {
		if (mode !== "create") return;
		const slug = form.slug;
		if (slug.length < 1) {
			setSlugAvailable(null);
			return;
		}
		setSlugChecking(true);
		const timer = setTimeout(async () => {
			try {
				const res = await api.get<{ available: boolean }>(`/capture-pages/check-slug/${slug}`);
				setSlugAvailable(res.available);
			} catch {
				setSlugAvailable(null);
			} finally {
				setSlugChecking(false);
			}
		}, 300);
		return () => {
			clearTimeout(timer);
			setSlugChecking(false);
		};
	}, [form.slug, mode]);

	const scrollToNfcEmail = useCallback(() => {
		nfcEmailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	}, []);

	const [keyword, setKeyword] = useState(currentKeyword ?? "");
	const hasExistingFile = mode === "edit" && page?.incentive_file_name && !fileRemoved;

	const mutation = useMutation({
		mutationFn: async (data: FormData) => {
			const { slug: rawSlug, ...rest } = data;
			const payload = {
				...rest,
				...(mode === "create" && rawSlug ? { slug: rawSlug } : {}),
				value_exchange_text: data.value_exchange_text || undefined,
				streaming_links: stripEmpty(data.streaming_links),
				social_links: stripEmpty(data.social_links),
			};

			let created: CapturePage;
			if (mode === "edit" && page) {
				created = await api.patch<CapturePage>(`/capture-pages/${page.id}`, payload);
			} else {
				created = await api.post<CapturePage>("/capture-pages", payload);
			}

			if (pendingFile) {
				setUploadProgress(0);
				await uploadIncentiveFile(created.id, pendingFile, setUploadProgress);
			}

			await saveKeyword(created.id, keyword, currentKeyword);
			return created;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["capture-pages"] });
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
			if (mode === "create") {
				setForm(EMPTY_FORM);
				setPendingFile(null);
				setKeyword("");
			}
			setUploadProgress(null);
			setUploadError(null);
			onSuccess(data);
		},
		onError: () => {
			setUploadProgress(null);
		},
	});

	const removeMutation = useMutation({
		mutationFn: () => api.delete(`/capture-pages/${page?.id}/incentive`),
		onSuccess: () => {
			setFileRemoved(true);
			queryClient.invalidateQueries({ queryKey: ["capture-pages"] });
		},
	});

	function handleFileSelect(file: File | undefined) {
		setUploadError(null);
		if (!file) return;
		if (file.size > MAX_FILE_SIZE) {
			setUploadError(`File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
			return;
		}
		setPendingFile(file);
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		mutation.mutate(form);
	}

	function setLink(group: "streaming_links" | "social_links", key: string, value: string) {
		setForm((prev) => ({
			...prev,
			[group]: { ...prev[group], [key]: value },
		}));
	}

	const isCreate = mode === "create";

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{isCreate && (
				<div className="space-y-2">
					<Label htmlFor="slug">Page URL</Label>
					<div className="relative">
						<Input
							id="slug"
							placeholder="e.g. your-band-name"
							value={form.slug}
							onChange={(e) => {
								const slugged = slugify(e.target.value);
								setForm((f) => ({ ...f, slug: slugged }));
							}}
							maxLength={40}
							className="pr-10"
							autoFocus
						/>
						{form.slug.length >= 1 && (
							<div className="absolute inset-y-0 right-3 flex items-center">
								{slugChecking ? (
									<Loader2 className="size-4 animate-spin text-muted-foreground" />
								) : slugAvailable === true ? (
									<Check className="size-4 text-green-500" />
								) : slugAvailable === false ? (
									<X className="size-4 text-destructive" />
								) : null}
							</div>
						)}
					</div>
					<p className="font-mono text-xs text-muted-foreground">
						afterset.net/c/
						{form.slug ? (
							<span className="text-electric-blue">{form.slug}</span>
						) : (
							<span className="italic">your-page-url</span>
						)}
					</p>
					{slugAvailable === false && (
						<p className="text-xs text-destructive">This URL is already taken.</p>
					)}
					<p className="text-xs text-muted-foreground/70">
						This URL is permanent — you can always create additional pages later.
					</p>
				</div>
			)}

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="title">Show Title</Label>
					<span className="text-xs text-muted-foreground">{form.title.length}/100</span>
				</div>
				<Input
					id="title"
					placeholder='e.g. "Austin - March 28" or "Spring Tour 2026"'
					value={form.title}
					onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
					required
					maxLength={100}
					autoFocus={!isCreate}
				/>
				{isCreate && (
					<p className="text-xs text-muted-foreground/70">
						Update this before each gig — it's what fans see, not part of the URL.
					</p>
				)}
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="value_exchange">
						What do fans get? <span className="text-muted-foreground">(optional)</span>
					</Label>
					<span className="text-xs text-muted-foreground">
						{form.value_exchange_text.length}/500
					</span>
				</div>
				<Textarea
					id="value_exchange"
					placeholder='e.g. "Get early access to new releases and exclusive merch drops"'
					value={form.value_exchange_text}
					onChange={(e) => setForm((f) => ({ ...f, value_exchange_text: e.target.value }))}
					maxLength={500}
					rows={2}
				/>
			</div>

			<KeywordSection
				keyword={keyword}
				setKeyword={setKeyword}
				mode={mode}
				pageId={page?.id}
				currentKeyword={currentKeyword}
			/>

			{!isCreate && page?.slug && !autoExpandEmail && <NfcSection slug={page.slug} />}

			<ThemeEditor form={form} onChange={(updates) => setForm((f) => ({ ...f, ...updates }))} />

			<IncentiveSection
				pendingFile={pendingFile}
				hasExistingFile={!!hasExistingFile}
				page={page}
				uploadProgress={uploadProgress}
				uploadError={uploadError}
				fileInputRef={fileInputRef}
				isDragging={isDragging}
				setIsDragging={setIsDragging}
				onFileSelect={handleFileSelect}
				onRemovePending={() => {
					setPendingFile(null);
					if (fileInputRef.current) fileInputRef.current.value = "";
				}}
				onRemoveExisting={() => removeMutation.mutate()}
				removeFileOpen={removeFileOpen}
				setRemoveFileOpen={setRemoveFileOpen}
				isRemoving={removeMutation.isPending}
			/>

			<LinkSection
				group="stream"
				label="Streaming Links"
				platforms={STREAMING_PLATFORMS}
				links={form.streaming_links}
				open={streamingOpen}
				setOpen={setStreamingOpen}
				onLinkChange={(key, value) => setLink("streaming_links", key, value)}
			/>

			<LinkSection
				group="social"
				label="Social Links"
				platforms={SOCIAL_PLATFORMS}
				links={form.social_links}
				open={socialOpen}
				setOpen={setSocialOpen}
				onLinkChange={(key, value) => setLink("social_links", key, value)}
			/>

			{!isCreate && page?.id && autoExpandEmail && page.slug ? (
				<div ref={nfcEmailRef} className="space-y-6">
					<NfcSection slug={page.slug} highlight />
					<InlineSequenceEditor
						pageId={page.id}
						hasIncentive={!!(page.incentive_file_name && !fileRemoved)}
						autoExpandFirst
						autoScrollDisabled
						onReady={scrollToNfcEmail}
					/>
				</div>
			) : (
				!isCreate &&
				page?.id && (
					<InlineSequenceEditor
						pageId={page.id}
						hasIncentive={!!(page.incentive_file_name && !fileRemoved)}
					/>
				)
			)}

			<div className="flex gap-2">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
				)}
				<Button
					type="submit"
					className="flex-1"
					disabled={!form.title.trim() || mutation.isPending}
				>
					{mutation.isPending && <Loader2 className="animate-spin" />}
					{submitLabel ?? (isCreate ? "Create Page" : "Save Changes")}
				</Button>
			</div>

			{mutation.isError && <p className="text-sm text-destructive">{mutation.error.message}</p>}
		</form>
	);
}
