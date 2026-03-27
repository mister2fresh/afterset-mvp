import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronUp,
	FileAudio,
	FileImage,
	FileText,
	FileVideo,
	Loader2,
	MessageSquare,
	Package,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, uploadToSignedUrl } from "@/lib/api";

export type BackgroundStyle = "solid" | "gradient" | "glow";
export type ButtonStyle = "rounded" | "pill" | "sharp";
export type FontStyle = "modern" | "editorial" | "mono" | "condensed";
export type TitleSize = "default" | "large" | "xl";
export type LayoutStyle = "centered" | "stacked";

export type CapturePage = {
	id: string;
	slug: string;
	title: string;
	value_exchange_text: string | null;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
	accent_color: string;
	secondary_color: string;
	background_style: BackgroundStyle;
	button_style: ButtonStyle;
	font_style: FontStyle;
	title_size: TitleSize;
	layout_style: LayoutStyle;
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

export type FormData = {
	title: string;
	value_exchange_text: string;
	accent_color: string;
	secondary_color: string;
	background_style: BackgroundStyle;
	button_style: ButtonStyle;
	font_style: FontStyle;
	title_size: TitleSize;
	layout_style: LayoutStyle;
	text_color: string;
	bg_color: string;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
};

export const EMPTY_FORM: FormData = {
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

export function formFromPage(page: CapturePage): FormData {
	return {
		title: page.title,
		value_exchange_text: page.value_exchange_text ?? "",
		accent_color: page.accent_color,
		secondary_color: page.secondary_color,
		background_style: page.background_style,
		button_style: page.button_style,
		font_style: page.font_style ?? "modern",
		title_size: page.title_size ?? "default",
		layout_style: page.layout_style ?? "centered",
		text_color: page.text_color ?? "#f9fafb",
		bg_color: page.bg_color ?? "#0a0e1a",
		streaming_links: { ...page.streaming_links },
		social_links: { ...page.social_links },
	};
}

type ThemePreset = {
	name: string;
	accent_color: string;
	secondary_color: string;
	background_style: BackgroundStyle;
	button_style: ButtonStyle;
	font_style: FontStyle;
	title_size: TitleSize;
	layout_style: LayoutStyle;
	text_color: string;
	bg_color: string;
};

export const THEME_PRESETS: ThemePreset[] = [
	{
		name: "Gold",
		accent_color: "#E8C547",
		secondary_color: "#D4A017",
		background_style: "solid",
		button_style: "rounded",
		font_style: "modern",
		title_size: "default",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Neon",
		accent_color: "#00E5FF",
		secondary_color: "#E040FB",
		background_style: "glow",
		button_style: "pill",
		font_style: "condensed",
		title_size: "large",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Ember",
		accent_color: "#FF6B35",
		secondary_color: "#F7C948",
		background_style: "gradient",
		button_style: "rounded",
		font_style: "modern",
		title_size: "default",
		layout_style: "stacked",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Violet",
		accent_color: "#A78BFA",
		secondary_color: "#6D28D9",
		background_style: "glow",
		button_style: "pill",
		font_style: "editorial",
		title_size: "large",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Minimal",
		accent_color: "#1a1a1a",
		secondary_color: "#9CA3AF",
		background_style: "solid",
		button_style: "sharp",
		font_style: "modern",
		title_size: "default",
		layout_style: "stacked",
		text_color: "#1a1a1a",
		bg_color: "#ffffff",
	},
	{
		name: "Verdant",
		accent_color: "#34D399",
		secondary_color: "#059669",
		background_style: "gradient",
		button_style: "rounded",
		font_style: "modern",
		title_size: "default",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
];

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

export function formatFileSize(bytes: number): string {
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

const BUTTON_RADIUS: Record<ButtonStyle, string> = {
	rounded: "0.375rem",
	pill: "9999px",
	sharp: "0",
};

const FONT_STACK_PREVIEW: Record<FontStyle, string> = {
	modern: "system-ui, sans-serif",
	editorial: "Georgia, Times, serif",
	mono: "ui-monospace, monospace",
	condensed: "system-ui, sans-serif",
};

const TITLE_SIZE_PREVIEW: Record<TitleSize, string> = {
	default: "1rem",
	large: "1.25rem",
	xl: "1.5rem",
};

function isLightColor(hex: string): boolean {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

function previewBackground(
	style: BackgroundStyle,
	accent: string,
	secondary: string,
	bg: string,
): string {
	if (style === "gradient") {
		return `linear-gradient(180deg, ${secondary}42 0%, transparent 60%), ${bg}`;
	}
	if (style === "glow") {
		return `radial-gradient(ellipse at 50% 30%, ${accent}33 0%, transparent 70%), ${bg}`;
	}
	return bg;
}

export function CapturePagePreview({ form }: { form: FormData }) {
	const bg = previewBackground(
		form.background_style,
		form.accent_color,
		form.secondary_color,
		form.bg_color,
	);
	const btnRadius = BUTTON_RADIUS[form.button_style];
	const title = form.title || "Your Page Title";
	const subtitle = form.value_exchange_text || "Get exclusive updates and early access";
	const streamingCount = Object.values(form.streaming_links).filter((v) => v.trim()).length;
	const fontFamily = FONT_STACK_PREVIEW[form.font_style];
	const titleFontSize = TITLE_SIZE_PREVIEW[form.title_size];
	const isStacked = form.layout_style === "stacked";
	const mutedColor = isLightColor(form.bg_color) ? "#6b7280" : "#9ca3af";
	const inputBg = isLightColor(form.bg_color) ? "#f3f4f6" : "#111827";
	const inputBorder = isLightColor(form.bg_color) ? "#d1d5db" : "#374151";
	const btnTextColor = isLightColor(form.accent_color) ? "#0a0e1a" : "#f9fafb";

	return (
		<div className="overflow-hidden rounded-lg border border-border" style={{ background: bg }}>
			<div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
				<h3
					className="font-bold tracking-tight"
					style={{
						color: form.text_color,
						fontFamily,
						fontSize: titleFontSize,
						textTransform: form.font_style === "condensed" ? "uppercase" : undefined,
						letterSpacing: form.font_style === "condensed" ? "0.15em" : "-0.025em",
					}}
				>
					{title}
				</h3>
				<p className="max-w-[240px] text-xs leading-relaxed" style={{ color: mutedColor }}>
					{subtitle}
				</p>

				<div className={`mt-1 flex w-full max-w-[260px] gap-2 ${isStacked ? "flex-col" : ""}`}>
					<div
						className="flex-1 rounded-md border px-3 py-1.5 text-left text-xs"
						style={{
							borderColor: inputBorder,
							color: mutedColor,
							backgroundColor: inputBg,
						}}
					>
						your@email.com
					</div>
					<div
						className="shrink-0 px-4 py-1.5 text-center text-xs font-semibold"
						style={{
							backgroundColor: form.accent_color,
							color: btnTextColor,
							borderRadius: btnRadius,
						}}
					>
						Join
					</div>
				</div>

				{streamingCount > 0 && (
					<div className="mt-1 flex gap-2">
						{Array.from({ length: Math.min(streamingCount, 4) }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static decorative placeholders
								key={i}
								className="size-6 rounded-full"
								style={{ backgroundColor: form.secondary_color, opacity: 0.6 }}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export function IncentiveFileDisplay({
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
}) {
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
};

function hasAnyLink(links: Record<string, string>): boolean {
	return Object.values(links).some((v) => v.trim() !== "");
}

function applyPreset(form: FormData, preset: ThemePreset): FormData {
	return {
		...form,
		accent_color: preset.accent_color,
		secondary_color: preset.secondary_color,
		background_style: preset.background_style,
		button_style: preset.button_style,
		font_style: preset.font_style,
		title_size: preset.title_size,
		layout_style: preset.layout_style,
		text_color: preset.text_color,
		bg_color: preset.bg_color,
	};
}

function isPresetActive(form: FormData, preset: ThemePreset): boolean {
	return (
		form.accent_color === preset.accent_color &&
		form.secondary_color === preset.secondary_color &&
		form.background_style === preset.background_style &&
		form.button_style === preset.button_style &&
		form.font_style === preset.font_style &&
		form.title_size === preset.title_size &&
		form.layout_style === preset.layout_style &&
		form.text_color === preset.text_color &&
		form.bg_color === preset.bg_color
	);
}

export function PageForm({
	mode,
	page,
	currentKeyword,
	defaultLinks,
	onSuccess,
	onCancel,
	submitLabel,
}: PageFormProps) {
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

	// Keyword state
	const [keyword, setKeyword] = useState(currentKeyword ?? "");
	const [kwCheck, setKwCheck] = useState<KeywordCheckResult | null>(null);
	const [kwChecking, setKwChecking] = useState(false);
	const [kwDebouncing, setKwDebouncing] = useState(false);

	const checkKeyword = useCallback(
		async (kw: string) => {
			if (kw.length < 2 || !page?.id) {
				setKwCheck(null);
				setKwDebouncing(false);
				return;
			}
			setKwChecking(true);
			setKwDebouncing(false);
			try {
				const result = await api.post<KeywordCheckResult>(
					`/capture-pages/${page.id}/keyword/check`,
					{ keyword: kw },
				);
				setKwCheck(result);
			} catch {
				setKwCheck(null);
			} finally {
				setKwChecking(false);
			}
		},
		[page?.id],
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

	const hasExistingFile = mode === "edit" && page?.incentive_file_name && !fileRemoved;

	const mutation = useMutation({
		mutationFn: async (data: FormData) => {
			const payload = {
				...data,
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
				const { signed_url, token } = await api.post<{
					signed_url: string;
					token: string;
					path: string;
				}>(`/capture-pages/${created.id}/incentive/upload-url`, {
					filename: pendingFile.name,
					content_type: pendingFile.type,
					file_size: pendingFile.size,
				});

				await uploadToSignedUrl(signed_url, token, pendingFile, setUploadProgress);
			}

			// Save keyword if provided (or remove if cleared in edit mode)
			const kwClean = keyword.replace(/[^A-Za-z0-9]/g, "");
			if (kwClean.length >= 2 && kwClean.toUpperCase() !== currentKeyword) {
				await api.put(`/capture-pages/${created.id}/keyword`, { keyword: kwClean });
			} else if (!kwClean && currentKeyword) {
				await api.delete(`/capture-pages/${created.id}/keyword`);
			}

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
	const slugPreview = useMemo(() => slugify(form.title), [form.title]);

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="title">Page Title</Label>
					<span className="text-xs text-muted-foreground">{form.title.length}/100</span>
				</div>
				<Input
					id="title"
					placeholder='e.g. "Austin - March 28" or "Spring Tour 2026"'
					value={form.title}
					onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
					required
					maxLength={100}
					autoFocus
				/>
				{isCreate && (
					<div className="space-y-1">
						<p className="font-mono text-xs text-muted-foreground">
							afterset.net/c/
							{slugPreview ? (
								<span className="text-electric-blue">{slugPreview}</span>
							) : (
								<span className="italic">your-page-url</span>
							)}
						</p>
						<p className="text-xs text-muted-foreground/70">
							This link is permanent — update the title before each show, the URL stays the same.
						</p>
					</div>
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

			<div className="space-y-4">
				<Label>Theme</Label>
				<CapturePagePreview form={form} />
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
					{THEME_PRESETS.map((preset) => {
						const isActive = isPresetActive(form, preset);
						const bg = previewBackground(
							preset.background_style,
							preset.accent_color,
							preset.secondary_color,
							preset.bg_color,
						);
						const btnRadius = BUTTON_RADIUS[preset.button_style];
						const btnTextColor = isLightColor(preset.accent_color) ? "#0a0e1a" : "#f9fafb";
						return (
							<button
								key={preset.name}
								type="button"
								onClick={() => setForm((f) => applyPreset(f, preset))}
								className={`flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-colors ${isActive ? "border-honey-gold ring-1 ring-honey-gold/30" : "border-border hover:border-honey-gold/50"}`}
							>
								<div
									className="flex w-full items-center justify-center rounded-md py-3"
									style={{ background: bg }}
								>
									<div
										className="px-3 py-0.5 text-[11px] font-semibold"
										style={{
											backgroundColor: preset.accent_color,
											color: btnTextColor,
											borderRadius: btnRadius,
										}}
									>
										Join
									</div>
								</div>
								<span
									className={`text-xs ${isActive ? "font-medium text-honey-gold" : "text-muted-foreground"}`}
								>
									{preset.name}
								</span>
							</button>
						);
					})}
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<Label htmlFor="accent_color" className="text-xs text-muted-foreground">
							Accent
						</Label>
						<div className="flex items-center gap-2">
							<input
								type="color"
								id="accent_color"
								value={form.accent_color}
								onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
								className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
							/>
							<Input
								value={form.accent_color}
								onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
								className="font-mono text-xs"
								maxLength={7}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="secondary_color" className="text-xs text-muted-foreground">
							Secondary
						</Label>
						<div className="flex items-center gap-2">
							<input
								type="color"
								id="secondary_color"
								value={form.secondary_color}
								onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))}
								className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
							/>
							<Input
								value={form.secondary_color}
								onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))}
								className="font-mono text-xs"
								maxLength={7}
							/>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<Label htmlFor="text_color" className="text-xs text-muted-foreground">
							Text
						</Label>
						<div className="flex items-center gap-2">
							<input
								type="color"
								id="text_color"
								value={form.text_color}
								onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))}
								className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
							/>
							<Input
								value={form.text_color}
								onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))}
								className="font-mono text-xs"
								maxLength={7}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="bg_color" className="text-xs text-muted-foreground">
							Background
						</Label>
						<div className="flex items-center gap-2">
							<input
								type="color"
								id="bg_color"
								value={form.bg_color}
								onChange={(e) => setForm((f) => ({ ...f, bg_color: e.target.value }))}
								className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
							/>
							<Input
								value={form.bg_color}
								onChange={(e) => setForm((f) => ({ ...f, bg_color: e.target.value }))}
								className="font-mono text-xs"
								maxLength={7}
							/>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Background Effect</Label>
						<div className="flex gap-1">
							{(["solid", "gradient", "glow"] as const).map((style) => (
								<button
									key={style}
									type="button"
									onClick={() => setForm((f) => ({ ...f, background_style: style }))}
									className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${form.background_style === style ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
								>
									{style}
								</button>
							))}
						</div>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Buttons</Label>
						<div className="flex gap-1">
							{(["rounded", "pill", "sharp"] as const).map((style) => (
								<button
									key={style}
									type="button"
									onClick={() => setForm((f) => ({ ...f, button_style: style }))}
									className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${form.button_style === style ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
								>
									{style}
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Font</Label>
						<div className="flex gap-1">
							{(["modern", "editorial", "mono", "condensed"] as const).map((style) => (
								<button
									key={style}
									type="button"
									onClick={() => setForm((f) => ({ ...f, font_style: style }))}
									className={`flex-1 rounded-md border px-1.5 py-1.5 text-xs capitalize transition-colors ${form.font_style === style ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
								>
									{style === "condensed" ? "bold" : style}
								</button>
							))}
						</div>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Title Size</Label>
						<div className="flex gap-1">
							{(["default", "large", "xl"] as const).map((size) => (
								<button
									key={size}
									type="button"
									onClick={() => setForm((f) => ({ ...f, title_size: size }))}
									className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${form.title_size === size ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
								>
									{size === "default" ? "Sm" : size === "large" ? "Md" : "Lg"}
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="space-y-1.5">
					<Label className="text-xs text-muted-foreground">Layout</Label>
					<div className="flex gap-1">
						{(["centered", "stacked"] as const).map((style) => (
							<button
								key={style}
								type="button"
								onClick={() => setForm((f) => ({ ...f, layout_style: style }))}
								className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${form.layout_style === style ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
							>
								{style === "centered" ? "Side by side" : "Stacked"}
							</button>
						))}
					</div>
				</div>
			</div>

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
						onRemove={() => {
							setPendingFile(null);
							if (fileInputRef.current) fileInputRef.current.value = "";
						}}
					/>
				) : hasExistingFile ? (
					<>
						<IncentiveFileDisplay
							name={page?.incentive_file_name ?? ""}
							size={page?.incentive_file_size ?? 0}
							contentType={page?.incentive_content_type ?? ""}
							onRemove={() => setRemoveFileOpen(true)}
							isRemoving={removeMutation.isPending}
						/>
						<ConfirmDialog
							open={removeFileOpen}
							onOpenChange={setRemoveFileOpen}
							title="Remove incentive file?"
							description={`This will delete "${page?.incentive_file_name}". Fans who already received a download link can still access it until it expires.`}
							confirmLabel="Remove"
							onConfirm={() => removeMutation.mutate()}
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
							handleFileSelect(e.dataTransfer.files[0]);
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
							onChange={(e) => handleFileSelect(e.target.files?.[0])}
						/>
					</label>
				)}

				{uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
			</div>

			<div className="space-y-3">
				<button
					type="button"
					onClick={() => setStreamingOpen(!streamingOpen)}
					className="flex w-full items-center justify-between"
				>
					<Label className="pointer-events-none">
						Streaming Links <span className="text-muted-foreground">(optional)</span>
					</Label>
					{streamingOpen ? (
						<ChevronUp className="size-4 text-muted-foreground" />
					) : (
						<ChevronDown className="size-4 text-muted-foreground" />
					)}
				</button>
				{streamingOpen &&
					STREAMING_PLATFORMS.map((p) => (
						<div key={p.key} className="flex items-center gap-2">
							<Label
								htmlFor={`stream-${p.key}`}
								className="w-20 shrink-0 text-xs text-muted-foreground sm:w-28"
							>
								{p.label}
							</Label>
							<Input
								id={`stream-${p.key}`}
								type="url"
								placeholder="https://..."
								value={form.streaming_links[p.key] ?? ""}
								onChange={(e) => setLink("streaming_links", p.key, e.target.value)}
								className="text-sm"
							/>
						</div>
					))}
			</div>

			<div className="space-y-3">
				<button
					type="button"
					onClick={() => setSocialOpen(!socialOpen)}
					className="flex w-full items-center justify-between"
				>
					<Label className="pointer-events-none">
						Social Links <span className="text-muted-foreground">(optional)</span>
					</Label>
					{socialOpen ? (
						<ChevronUp className="size-4 text-muted-foreground" />
					) : (
						<ChevronDown className="size-4 text-muted-foreground" />
					)}
				</button>
				{socialOpen &&
					SOCIAL_PLATFORMS.map((p) => (
						<div key={p.key} className="flex items-center gap-2">
							<Label
								htmlFor={`social-${p.key}`}
								className="w-20 shrink-0 text-xs text-muted-foreground sm:w-28"
							>
								{p.label}
							</Label>
							<Input
								id={`social-${p.key}`}
								type="url"
								placeholder="https://..."
								value={form.social_links[p.key] ?? ""}
								onChange={(e) => setLink("social_links", p.key, e.target.value)}
								className="text-sm"
							/>
						</div>
					))}
			</div>

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
