import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ExternalLink,
	FileAudio,
	FileImage,
	FileText,
	FileVideo,
	Loader2,
	MoreVertical,
	Package,
	Pencil,
	Plus,
	QrCode,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, uploadToSignedUrl } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/pages")({
	component: PagesPage,
});

type CapturePage = {
	id: string;
	slug: string;
	title: string;
	value_exchange_text: string | null;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
	accent_color: string;
	is_active: boolean;
	incentive_file_path: string | null;
	incentive_file_name: string | null;
	incentive_file_size: number | null;
	incentive_content_type: string | null;
	created_at: string;
	updated_at: string;
};

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

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(contentType: string) {
	if (contentType.startsWith("audio/")) return FileAudio;
	if (contentType.startsWith("image/")) return FileImage;
	if (contentType.startsWith("video/")) return FileVideo;
	if (contentType === "application/pdf") return FileText;
	return Package;
}

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

type FormData = {
	title: string;
	value_exchange_text: string;
	accent_color: string;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
};

const EMPTY_FORM: FormData = {
	title: "",
	value_exchange_text: "",
	accent_color: "#E8C547",
	streaming_links: {},
	social_links: {},
};

function formFromPage(page: CapturePage): FormData {
	return {
		title: page.title,
		value_exchange_text: page.value_exchange_text ?? "",
		accent_color: page.accent_color,
		streaming_links: { ...page.streaming_links },
		social_links: { ...page.social_links },
	};
}

function useCapturePages() {
	return useQuery({
		queryKey: ["capture-pages"],
		queryFn: () => api.get<CapturePage[]>("/capture-pages"),
	});
}

function PagesPage() {
	const { data: pages, isLoading } = useCapturePages();
	const [createOpen, setCreateOpen] = useState(false);
	const [editingPage, setEditingPage] = useState<CapturePage | null>(null);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const hasPages = pages && pages.length > 0;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground">Create and manage your fan capture pages.</p>
				<PageFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
			</div>

			{hasPages ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{pages.map((page) => (
						<PageCard key={page.id} page={page} onEdit={() => setEditingPage(page)} />
					))}
				</div>
			) : (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<div className="mb-4 rounded-full bg-muted p-4">
							<QrCode className="size-8 text-muted-foreground" />
						</div>
						<h3 className="font-display text-lg font-semibold">No capture pages yet</h3>
						<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
							Capture pages let fans submit their email after scanning a QR code at your show. Each
							page generates a unique QR code and link.
						</p>
						<Button className="mt-6" onClick={() => setCreateOpen(true)}>
							<Plus />
							Create Your First Page
						</Button>
					</CardContent>
				</Card>
			)}

			{editingPage && (
				<PageFormDialog
					mode="edit"
					page={editingPage}
					open={!!editingPage}
					onOpenChange={(open) => {
						if (!open) setEditingPage(null);
					}}
				/>
			)}
		</div>
	);
}

function PageCard({ page, onEdit }: { page: CapturePage; onEdit: () => void }) {
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: () => api.delete(`/capture-pages/${page.id}`),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capture-pages"] }),
	});

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
				<div className="space-y-1">
					<CardTitle className="font-display text-base">{page.title}</CardTitle>
					<a
						href={`https://afterset.net/c/${page.slug}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-xs text-electric-blue hover:underline"
					>
						afterset.net/c/{page.slug}
						<ExternalLink className="size-3" />
					</a>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="size-8">
							<MoreVertical className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>
							<Pencil />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate()}>
							<Trash2 />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</CardHeader>
			<CardContent className="space-y-3">
				{page.value_exchange_text && (
					<p className="text-sm text-muted-foreground line-clamp-2">{page.value_exchange_text}</p>
				)}
				{page.incentive_file_name && page.incentive_content_type && (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						{(() => {
							const Icon = fileTypeIcon(page.incentive_content_type);
							return <Icon className="size-3.5" />;
						})()}
						<span className="truncate">{page.incentive_file_name}</span>
					</div>
				)}
				<div className="flex items-center justify-between">
					<Badge variant={page.is_active ? "default" : "secondary"}>
						{page.is_active ? "Active" : "Inactive"}
					</Badge>
					<div className="flex items-center gap-2">
						<div
							className="size-4 rounded-full border border-border"
							style={{ backgroundColor: page.accent_color }}
						/>
						<span className="text-xs text-muted-foreground">
							{new Date(page.created_at).toLocaleDateString()}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

type PageFormDialogProps =
	| { mode: "create"; open: boolean; onOpenChange: (open: boolean) => void; page?: undefined }
	| { mode: "edit"; page: CapturePage; open: boolean; onOpenChange: (open: boolean) => void };

function PageFormDialog({ mode, page, open, onOpenChange }: PageFormDialogProps) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<FormData>(page ? formFromPage(page) : EMPTY_FORM);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [fileRemoved, setFileRemoved] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const hasExistingFile = mode === "edit" && page.incentive_file_name && !fileRemoved;

	const mutation = useMutation({
		mutationFn: async (data: FormData) => {
			const payload = {
				...data,
				value_exchange_text: data.value_exchange_text || undefined,
				streaming_links: stripEmpty(data.streaming_links),
				social_links: stripEmpty(data.social_links),
			};

			let created: CapturePage;
			if (mode === "edit") {
				created = await api.patch<CapturePage>(`/capture-pages/${page.id}`, payload);
			} else {
				created = await api.post<CapturePage>("/capture-pages", payload);
			}

			// Upload incentive file if one is pending
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
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["capture-pages"] });
			if (mode === "create") {
				setForm(EMPTY_FORM);
				setPendingFile(null);
			}
			setUploadProgress(null);
			setUploadError(null);
			onOpenChange(false);
		},
		onError: () => {
			setUploadProgress(null);
		},
	});

	const removeMutation = useMutation({
		mutationFn: () => api.delete(`/capture-pages/${page!.id}/incentive`),
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

	const dialogContent = (
		<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
			<form onSubmit={handleSubmit}>
				<DialogHeader>
					<DialogTitle className="font-display">
						{isCreate ? "Create Capture Page" : "Edit Capture Page"}
					</DialogTitle>
					<DialogDescription>
						{isCreate
							? "Set up a new fan capture page. Fans scan a QR code or visit the link to submit their email."
							: "Update your capture page details."}
					</DialogDescription>
				</DialogHeader>

				<div className="mt-6 space-y-6">
					<div className="space-y-2">
						<Label htmlFor="title">Page Title</Label>
						<Input
							id="title"
							placeholder='e.g. "Spring Tour 2026" or "Merch Drop Signup"'
							value={form.title}
							onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
							required
							maxLength={100}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="value_exchange">
							What do fans get? <span className="text-muted-foreground">(optional)</span>
						</Label>
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
						<Label htmlFor="accent_color">Accent Color</Label>
						<div className="flex items-center gap-3">
							<input
								type="color"
								id="accent_color"
								value={form.accent_color}
								onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
								className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
							/>
							<Input
								value={form.accent_color}
								onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
								className="w-28 font-mono text-sm"
								maxLength={7}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label>
							Incentive File <span className="text-muted-foreground">(optional)</span>
						</Label>
						<p className="text-xs text-muted-foreground">
							Upload a file fans receive after signing up — music, artwork, PDF, video, or a ZIP
							bundle.
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
								name={page.incentive_file_name!}
								size={page.incentive_file_size!}
								contentType={page.incentive_content_type!}
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
						<Label>
							Streaming Links <span className="text-muted-foreground">(optional)</span>
						</Label>
						{STREAMING_PLATFORMS.map((p) => (
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
						<Label>
							Social Links <span className="text-muted-foreground">(optional)</span>
						</Label>
						{SOCIAL_PLATFORMS.map((p) => (
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
				</div>

				<DialogFooter className="mt-6">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button type="submit" disabled={!form.title.trim() || mutation.isPending}>
						{mutation.isPending && <Loader2 className="animate-spin" />}
						{isCreate ? "Create Page" : "Save Changes"}
					</Button>
				</DialogFooter>

				{mutation.isError && (
					<p className="mt-2 text-sm text-destructive">{mutation.error.message}</p>
				)}
			</form>
		</DialogContent>
	);

	if (isCreate) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogTrigger asChild>
					<Button>
						<Plus />
						New Page
					</Button>
				</DialogTrigger>
				{dialogContent}
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{dialogContent}
		</Dialog>
	);
}

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

function stripEmpty(obj: Record<string, string>): Record<string, string> | undefined {
	const filtered = Object.fromEntries(Object.entries(obj).filter(([, v]) => v.trim() !== ""));
	return Object.keys(filtered).length > 0 ? filtered : undefined;
}
