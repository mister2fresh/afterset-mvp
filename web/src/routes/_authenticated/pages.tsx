import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Download,
	ExternalLink,
	Loader2,
	Mail,
	MessageSquare,
	MoreVertical,
	Pencil,
	Plus,
	QrCode,
	Trash2,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmailTemplateBadge, EmailTemplateDialog } from "@/components/email-template-dialog";
import { KeywordDialog } from "@/components/keyword-dialog";
import { type CapturePage, fileTypeIcon, PageForm } from "@/components/page-form";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/pages")({
	component: PagesPage,
});

function useCapturePages() {
	return useQuery({
		queryKey: ["capture-pages"],
		queryFn: () => api.get<CapturePage[]>("/capture-pages"),
	});
}

function useCaptureCounts() {
	return useQuery({
		queryKey: ["capture-counts"],
		queryFn: () => api.get<Record<string, number>>("/captures/counts"),
	});
}

type KeywordEntry = { keyword: string; phone_number: string };

function useKeywords() {
	return useQuery({
		queryKey: ["keywords"],
		queryFn: () => api.get<Record<string, KeywordEntry>>("/capture-pages/keywords"),
	});
}

function formatPhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");
	if (digits.length === 11 && digits[0] === "1") {
		return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
	}
	return phone;
}

function PagesPage() {
	const { data: pages, isLoading, isError, refetch } = useCapturePages();
	const { data: counts } = useCaptureCounts();
	const { data: keywords } = useKeywords();
	const [createOpen, setCreateOpen] = useState(false);
	const [editingPage, setEditingPage] = useState<CapturePage | null>(null);
	const [newPageEmailId, setNewPageEmailId] = useState<string | null>(null);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (isError) {
		return <QueryError onRetry={() => refetch()} />;
	}

	const hasPages = pages && pages.length > 0;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground">Create and manage your fan capture pages.</p>
				<PageFormDialog
					mode="create"
					open={createOpen}
					onOpenChange={setCreateOpen}
					onCreated={(p) => setNewPageEmailId(p.id)}
				/>
			</div>

			{hasPages ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{pages.map((page) => (
						<PageCard
							key={page.id}
							page={page}
							captureCount={counts?.[page.id] ?? 0}
							keyword={keywords?.[page.id] ?? null}
							onEdit={() => setEditingPage(page)}
						/>
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
							Create a capture page for fans to submit their email via QR code or link. Update the
							title before each show — the link and QR code stay the same.
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

			{newPageEmailId && (
				<EmailTemplateDialog
					pageId={newPageEmailId}
					pageTitle={pages?.find((p) => p.id === newPageEmailId)?.title ?? ""}
					hasIncentive={!!pages?.find((p) => p.id === newPageEmailId)?.incentive_file_name}
					open={!!newPageEmailId}
					onOpenChange={(open) => {
						if (!open) setNewPageEmailId(null);
					}}
				/>
			)}
		</div>
	);
}

function useQrPreview(pageId: string) {
	const [url, setUrl] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const blob = await api.getBlob(`/capture-pages/${pageId}/qr.png`);
			setUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return URL.createObjectURL(blob);
			});
		} catch {
			// QR preview is non-critical — fail silently, download button still works
		}
	}, [pageId]);

	useEffect(() => {
		load();
		return () =>
			setUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return null;
			});
	}, [load]);

	return url;
}

async function downloadQr(pageId: string, slug: string) {
	try {
		const blob = await api.getBlob(`/capture-pages/${pageId}/qr.png?download=1`);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${slug}-qr.png`;
		a.click();
		URL.revokeObjectURL(url);
	} catch {
		const { toast } = await import("sonner");
		toast.error("Failed to download QR code");
	}
}

function PageCard({
	page,
	captureCount,
	keyword,
	onEdit,
}: {
	page: CapturePage;
	captureCount: number;
	keyword: KeywordEntry | null;
	onEdit: () => void;
}) {
	const queryClient = useQueryClient();
	const qrUrl = useQrPreview(page.id);
	const [emailOpen, setEmailOpen] = useState(false);
	const [keywordOpen, setKeywordOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(page.title);

	const deleteMutation = useMutation({
		mutationFn: () => api.delete(`/capture-pages/${page.id}`),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capture-pages"] }),
	});

	const titleMutation = useMutation({
		mutationFn: (title: string) => api.patch(`/capture-pages/${page.id}`, { title }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["capture-pages"] });
			setEditingTitle(false);
			const { toast } = await import("sonner");
			toast.success("Page title updated");
		},
	});

	function saveTitle() {
		const trimmed = titleDraft.trim();
		if (!trimmed || trimmed === page.title) {
			setTitleDraft(page.title);
			setEditingTitle(false);
			return;
		}
		titleMutation.mutate(trimmed);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
				<div className="min-w-0 flex-1 space-y-1">
					{editingTitle ? (
						<div className="flex items-center gap-1">
							<input
								ref={(el) => el?.focus()}
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") saveTitle();
									if (e.key === "Escape") {
										setTitleDraft(page.title);
										setEditingTitle(false);
									}
								}}
								onBlur={saveTitle}
								maxLength={100}
								className="h-7 w-full min-w-0 rounded border border-input bg-transparent px-1.5 font-display text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
							/>
						</div>
					) : (
						<button
							type="button"
							onClick={() => {
								setTitleDraft(page.title);
								setEditingTitle(true);
							}}
							className="group flex max-w-full items-center gap-1.5"
							title="What's tonight's show? Click to update."
						>
							<CardTitle className="truncate font-display text-base">{page.title}</CardTitle>
							<Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
						</button>
					)}
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
						<Button variant="ghost" size="icon" className="size-11 sm:size-8">
							<MoreVertical className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>
							<Pencil />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setEmailOpen(true)}>
							<Mail />
							Follow-Up Email
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setKeywordOpen(true)}>
							<MessageSquare />
							Text-to-Join Keyword
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => downloadQr(page.id, page.slug)}>
							<Download />
							Download QR
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive"
							disabled={deleteMutation.isPending}
							onClick={() => setDeleteOpen(true)}
						>
							<Trash2 />
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</CardHeader>
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title="Delete capture page?"
				description={`This will permanently delete "${page.title}". Fan data and capture history will be preserved, but the page link, QR code, SMS keyword, and NFC tap will all stop working.`}
				onConfirm={() => deleteMutation.mutate()}
			/>
			<EmailTemplateDialog
				pageId={page.id}
				pageTitle={page.title}
				hasIncentive={!!page.incentive_file_name}
				open={emailOpen}
				onOpenChange={setEmailOpen}
			/>
			<KeywordDialog
				pageId={page.id}
				pageTitle={page.title}
				currentKeyword={keyword?.keyword ?? null}
				open={keywordOpen}
				onOpenChange={setKeywordOpen}
			/>
			<CardContent className="space-y-3">
				{qrUrl && (
					<div className="flex items-center gap-3">
						<img
							src={qrUrl}
							alt={`QR code for ${page.slug}`}
							className="size-20 rounded border border-border bg-white p-1"
						/>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={() => downloadQr(page.id, page.slug)}
						>
							<Download className="size-3.5" />
							Download QR
						</Button>
					</div>
				)}
				{keyword ? (
					<button
						type="button"
						onClick={() => setKeywordOpen(true)}
						className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs transition-colors hover:border-honey-gold/50"
					>
						<MessageSquare className="size-3.5 shrink-0 text-honey-gold" />
						<span>
							Text <span className="font-mono font-bold">{keyword.keyword}</span> to{" "}
							{formatPhone(keyword.phone_number)}
						</span>
					</button>
				) : (
					<button
						type="button"
						onClick={() => setKeywordOpen(true)}
						className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-honey-gold"
					>
						<MessageSquare className="size-3.5" />
						Set up text-to-join
					</button>
				)}
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
				<Link
					to="/fans"
					search={{ page_id: page.id, page_title: page.title }}
					className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<Users className="size-3.5" />
					<span>
						{captureCount} {captureCount === 1 ? "capture" : "captures"}
					</span>
				</Link>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5">
						<Badge variant={page.is_active ? "default" : "secondary"}>
							{page.is_active ? "Active" : "Inactive"}
						</Badge>
						<EmailTemplateBadge pageId={page.id} onClick={() => setEmailOpen(true)} />
					</div>
					<div className="flex items-center gap-2">
						<div className="flex gap-0.5">
							<div
								className="size-3.5 rounded-full border border-border"
								style={{ backgroundColor: page.accent_color }}
							/>
							<div
								className="size-3.5 rounded-full border border-border"
								style={{ backgroundColor: page.secondary_color }}
							/>
						</div>
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
	| {
			mode: "create";
			open: boolean;
			onOpenChange: (open: boolean) => void;
			onCreated?: (page: CapturePage) => void;
			page?: undefined;
	  }
	| { mode: "edit"; page: CapturePage; open: boolean; onOpenChange: (open: boolean) => void };

function PageFormDialog({ mode, page, open, onOpenChange, ...rest }: PageFormDialogProps) {
	const isCreate = mode === "create";

	const { data: keywords } = useKeywords();
	const { data: pages } = useCapturePages();
	const keyword = page ? (keywords?.[page.id] ?? null) : null;

	// Pre-populate links from most recent page when creating
	const defaultLinks =
		isCreate && pages && pages.length > 0
			? {
					streaming_links: { ...pages[0].streaming_links },
					social_links: { ...pages[0].social_links },
				}
			: undefined;

	const dialogContent = (
		<DialogContent className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle className="font-display">
					{isCreate ? "Create Capture Page" : "Edit Capture Page"}
				</DialogTitle>
				<DialogDescription>
					{isCreate
						? "Create a page with a permanent link and QR code. Update the title before each show — the URL stays the same."
						: "Update your capture page details."}
				</DialogDescription>
			</DialogHeader>
			<PageForm
				mode={mode}
				page={page}
				currentKeyword={keyword?.keyword ?? null}
				defaultLinks={defaultLinks}
				onSuccess={(created) => {
					onOpenChange(false);
					if (mode === "create" && "onCreated" in rest && rest.onCreated) {
						rest.onCreated(created);
					}
				}}
				onCancel={() => onOpenChange(false)}
			/>
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
