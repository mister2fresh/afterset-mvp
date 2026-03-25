import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronUp,
	FileAudio,
	FileImage,
	FileText,
	FileVideo,
	Loader2,
	Package,
	Upload,
	X,
} from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, uploadToSignedUrl } from "@/lib/api";

export type BackgroundStyle = "solid" | "gradient" | "glow";
export type ButtonStyle = "rounded" | "pill" | "sharp";

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
};

export const THEME_PRESETS: ThemePreset[] = [
	{
		name: "Gold",
		accent_color: "#E8C547",
		secondary_color: "#D4A017",
		background_style: "solid",
		button_style: "rounded",
	},
	{
		name: "Neon",
		accent_color: "#00E5FF",
		secondary_color: "#E040FB",
		background_style: "glow",
		button_style: "pill",
	},
	{
		name: "Ember",
		accent_color: "#FF6B35",
		secondary_color: "#F7C948",
		background_style: "gradient",
		button_style: "rounded",
	},
	{
		name: "Violet",
		accent_color: "#A78BFA",
		secondary_color: "#6D28D9",
		background_style: "glow",
		button_style: "pill",
	},
	{
		name: "Minimal",
		accent_color: "#E5E7EB",
		secondary_color: "#9CA3AF",
		background_style: "solid",
		button_style: "sharp",
	},
	{
		name: "Verdant",
		accent_color: "#34D399",
		secondary_color: "#059669",
		background_style: "gradient",
		button_style: "rounded",
	},
	{
		name: "Retro",
		accent_color: "#40E0D0",
		secondary_color: "#FF8C42",
		background_style: "gradient",
		button_style: "pill",
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

function stripEmpty(obj: Record<string, string>): Record<string, string> | undefined {
	const filtered = Object.fromEntries(Object.entries(obj).filter(([, v]) => v.trim() !== ""));
	return Object.keys(filtered).length > 0 ? filtered : undefined;
}

const BUTTON_RADIUS: Record<ButtonStyle, string> = {
	rounded: "0.375rem",
	pill: "9999px",
	sharp: "0",
};

function previewBackground(style: BackgroundStyle, accent: string, secondary: string): string {
	if (style === "gradient") {
		return `linear-gradient(180deg, ${secondary}26 0%, transparent 60%), #0a0e1a`;
	}
	if (style === "glow") {
		return `radial-gradient(ellipse at 50% 30%, ${accent}1A 0%, transparent 70%), #0a0e1a`;
	}
	return "#0a0e1a";
}

export function CapturePagePreview({ form }: { form: FormData }) {
	const bg = previewBackground(form.background_style, form.accent_color, form.secondary_color);
	const btnRadius = BUTTON_RADIUS[form.button_style];
	const title = form.title || "Your Page Title";
	const subtitle = form.value_exchange_text || "Get exclusive updates and early access";
	const streamingCount = Object.values(form.streaming_links).filter((v) => v.trim()).length;

	return (
		<div className="overflow-hidden rounded-lg border border-border" style={{ background: bg }}>
			<div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
				<h3 className="text-base font-bold tracking-tight" style={{ color: "#f9fafb" }}>
					{title}
				</h3>
				<p className="max-w-[240px] text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
					{subtitle}
				</p>

				<div className="mt-1 flex w-full max-w-[260px] gap-2">
					<div
						className="flex-1 rounded-md border px-3 py-1.5 text-left text-xs"
						style={{
							borderColor: "#374151",
							color: "#6b7280",
							backgroundColor: "#111827",
						}}
					>
						your@email.com
					</div>
					<div
						className="shrink-0 px-4 py-1.5 text-xs font-semibold"
						style={{
							backgroundColor: form.accent_color,
							color: "#0a0e1a",
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

type PageFormProps = {
	mode: "create" | "edit";
	page?: CapturePage;
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

export function PageForm({
	mode,
	page,
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
	const [isDragging, setIsDragging] = useState(false);
	const [streamingOpen, setStreamingOpen] = useState(hasAnyLink(initialForm.streaming_links));
	const [socialOpen, setSocialOpen] = useState(hasAnyLink(initialForm.social_links));
	const fileInputRef = useRef<HTMLInputElement>(null);

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

			return created;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["capture-pages"] });
			if (mode === "create") {
				setForm(EMPTY_FORM);
				setPendingFile(null);
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
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="title">Page Title</Label>
					<span className="text-xs text-muted-foreground">{form.title.length}/100</span>
				</div>
				<Input
					id="title"
					placeholder='e.g. "Spring Tour 2026" or "Merch Drop Signup"'
					value={form.title}
					onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
					required
					maxLength={100}
					autoFocus
				/>
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

			<div className="space-y-4">
				<Label>Theme</Label>
				<CapturePagePreview form={form} />
				<div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
					{THEME_PRESETS.map((preset) => {
						const isActive =
							form.accent_color === preset.accent_color &&
							form.secondary_color === preset.secondary_color &&
							form.background_style === preset.background_style &&
							form.button_style === preset.button_style;
						const bg = previewBackground(
							preset.background_style,
							preset.accent_color,
							preset.secondary_color,
						);
						const btnRadius = BUTTON_RADIUS[preset.button_style];
						return (
							<button
								key={preset.name}
								type="button"
								onClick={() =>
									setForm((f) => ({
										...f,
										accent_color: preset.accent_color,
										secondary_color: preset.secondary_color,
										background_style: preset.background_style,
										button_style: preset.button_style,
									}))
								}
								className={`flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-colors ${isActive ? "border-honey-gold ring-1 ring-honey-gold/30" : "border-border hover:border-honey-gold/50"}`}
							>
								<div
									className="flex w-full items-center justify-center rounded-md py-3"
									style={{ background: bg }}
								>
									<div
										className="px-3 py-0.5 text-[9px] font-semibold"
										style={{
											backgroundColor: preset.accent_color,
											color: "#0a0e1a",
											borderRadius: btnRadius,
										}}
									>
										Join
									</div>
								</div>
								<span
									className={`text-[10px] ${isActive ? "font-medium text-honey-gold" : "text-muted-foreground"}`}
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
						<Label className="text-xs text-muted-foreground">Background</Label>
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
					<IncentiveFileDisplay
						name={page?.incentive_file_name ?? ""}
						size={page?.incentive_file_size ?? 0}
						contentType={page?.incentive_content_type ?? ""}
						onRemove={() => removeMutation.mutate()}
						isRemoving={removeMutation.isPending}
					/>
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
								className="w-28 shrink-0 text-xs text-muted-foreground"
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
								className="w-28 shrink-0 text-xs text-muted-foreground"
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
