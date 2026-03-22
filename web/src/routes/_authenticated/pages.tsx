import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2, MoreVertical, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { api } from "@/lib/api";

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
	created_at: string;
	updated_at: string;
};

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

	const mutation = useMutation({
		mutationFn: (data: FormData) => {
			const payload = {
				...data,
				value_exchange_text: data.value_exchange_text || undefined,
				streaming_links: stripEmpty(data.streaming_links),
				social_links: stripEmpty(data.social_links),
			};
			if (mode === "edit") {
				return api.patch<CapturePage>(`/capture-pages/${page.id}`, payload);
			}
			return api.post<CapturePage>("/capture-pages", payload);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["capture-pages"] });
			if (mode === "create") setForm(EMPTY_FORM);
			onOpenChange(false);
		},
	});

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

function stripEmpty(obj: Record<string, string>): Record<string, string> | undefined {
	const filtered = Object.fromEntries(Object.entries(obj).filter(([, v]) => v.trim() !== ""));
	return Object.keys(filtered).length > 0 ? filtered : undefined;
}
