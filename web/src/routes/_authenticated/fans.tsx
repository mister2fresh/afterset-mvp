import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Loader2, Lock, QrCode, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { type CaptureRow, CapturesTable } from "@/components/captures-table";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTier } from "@/hooks/use-tier";
import { api } from "@/lib/api";

type CapturePage = {
	id: string;
	title: string;
	slug: string;
};

type FansSearch = {
	page_id?: string;
	page_title?: string;
	method?: string;
	date_from?: string;
	date_to?: string;
	search?: string;
};

export const Route = createFileRoute("/_authenticated/fans")({
	validateSearch: (s: Record<string, unknown>): FansSearch => ({
		page_id: typeof s.page_id === "string" ? s.page_id : undefined,
		page_title: typeof s.page_title === "string" ? s.page_title : undefined,
		method: typeof s.method === "string" ? s.method : undefined,
		date_from: typeof s.date_from === "string" ? s.date_from : undefined,
		date_to: typeof s.date_to === "string" ? s.date_to : undefined,
		search: typeof s.search === "string" ? s.search : undefined,
	}),
	component: FansPage,
});

function buildQueryString(filters: FansSearch): string {
	const params = new URLSearchParams();
	if (filters.page_id) params.set("page_id", filters.page_id);
	if (filters.method) params.set("method", filters.method);
	if (filters.date_from) params.set("date_from", filters.date_from);
	if (filters.date_to) params.set("date_to", filters.date_to);
	if (filters.search) params.set("search", filters.search);
	const qs = params.toString();
	return qs ? `?${qs}` : "";
}

function useCaptures(filters: FansSearch) {
	const qs = buildQueryString(filters);
	return useQuery({
		queryKey: ["captures", filters],
		queryFn: () => api.get<CaptureRow[]>(`/captures${qs}`),
	});
}

function usePages() {
	return useQuery({
		queryKey: ["capture-pages"],
		queryFn: () => api.get<CapturePage[]>("/capture-pages"),
	});
}

type FilterBarProps = {
	filters: FansSearch;
	updateFilter: (update: Partial<FansSearch>) => void;
	clearFilters: () => void;
	pages: CapturePage[] | undefined;
	rows: CaptureRow[] | undefined;
	exportCsv: () => void;
	canExport: boolean;
};

function FilterBar({
	filters,
	updateFilter,
	clearFilters,
	pages,
	rows,
	exportCsv,
	canExport,
}: FilterBarProps) {
	const hasFilters =
		filters.page_id || filters.method || filters.date_from || filters.date_to || filters.search;

	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="relative w-full sm:w-56">
				<Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
				<Input
					placeholder="Search email..."
					className="pl-8"
					value={filters.search ?? ""}
					onChange={(e) => updateFilter({ search: e.target.value || undefined })}
				/>
			</div>

			<select
				className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
				value={filters.page_id ?? ""}
				onChange={(e) =>
					updateFilter({
						page_id: e.target.value || undefined,
						page_title: pages?.find((p) => p.id === e.target.value)?.title,
					})
				}
			>
				<option value="">All pages</option>
				{(pages ?? []).map((p) => (
					<option key={p.id} value={p.id}>
						{p.title}
					</option>
				))}
			</select>

			<select
				className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
				value={filters.method ?? ""}
				onChange={(e) => updateFilter({ method: e.target.value || undefined })}
			>
				<option value="">All methods</option>
				<option value="qr">QR Code</option>
				<option value="direct">Direct Link</option>
				<option value="sms">SMS</option>
				<option value="nfc">NFC</option>
			</select>

			<Input
				type="date"
				className="h-9 w-36"
				value={filters.date_from ?? ""}
				onChange={(e) => updateFilter({ date_from: e.target.value || undefined })}
				placeholder="From"
			/>
			<Input
				type="date"
				className="h-9 w-36"
				value={filters.date_to ?? ""}
				onChange={(e) => updateFilter({ date_to: e.target.value || undefined })}
				placeholder="To"
			/>

			{hasFilters && (
				<Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
					<X className="size-3.5" />
					Clear
				</Button>
			)}

			<div className="ml-auto">
				<Button
					variant="outline"
					size="sm"
					onClick={exportCsv}
					disabled={canExport && !rows?.length}
					className={!canExport ? "gap-1.5" : ""}
				>
					{canExport ? <Download className="size-3.5" /> : <Lock className="size-3.5" />}
					Export CSV
					{!canExport && (
						<Badge variant="default" className="ml-1 text-[10px]">
							Superstar
						</Badge>
					)}
				</Button>
			</div>
		</div>
	);
}

type ActiveFilterBadgesProps = {
	filters: FansSearch;
	updateFilter: (update: Partial<FansSearch>) => void;
	rows: CaptureRow[] | undefined;
};

function ActiveFilterBadges({ filters, updateFilter, rows }: ActiveFilterBadgesProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-xs text-muted-foreground">Filters:</span>
			{filters.page_id && (
				<Badge variant="secondary" className="gap-1">
					Page: {filters.page_title ?? "..."}
					<button
						type="button"
						onClick={() => updateFilter({ page_id: undefined, page_title: undefined })}
						className="ml-0.5 rounded-full p-1 hover:bg-muted"
					>
						<X className="size-3.5" />
					</button>
				</Badge>
			)}
			{filters.method && (
				<Badge variant="secondary" className="gap-1">
					Method: {filters.method}
					<button
						type="button"
						onClick={() => updateFilter({ method: undefined })}
						className="ml-0.5 rounded-full p-1 hover:bg-muted"
					>
						<X className="size-3.5" />
					</button>
				</Badge>
			)}
			{filters.search && (
				<Badge variant="secondary" className="gap-1">
					Search: {filters.search}
					<button
						type="button"
						onClick={() => updateFilter({ search: undefined })}
						className="ml-0.5 rounded-full p-1 hover:bg-muted"
					>
						<X className="size-3.5" />
					</button>
				</Badge>
			)}
			{(filters.date_from || filters.date_to) && (
				<Badge variant="secondary" className="gap-1">
					{filters.date_from ?? "..."} — {filters.date_to ?? "..."}
					<button
						type="button"
						onClick={() => updateFilter({ date_from: undefined, date_to: undefined })}
						className="ml-0.5 rounded-full p-1 hover:bg-muted"
					>
						<X className="size-3.5" />
					</button>
				</Badge>
			)}
			{rows && (
				<span className="text-xs text-muted-foreground">
					{rows.length} result{rows.length !== 1 ? "s" : ""}
				</span>
			)}
		</div>
	);
}

function FansPage() {
	const filters = Route.useSearch();
	const navigate = useNavigate();
	const { data: rows, isLoading, isError, refetch } = useCaptures(filters);
	const { data: pages } = usePages();
	const { limits } = useTier();
	const canExport = limits.hasCsvExport;

	const hasFilters =
		filters.page_id || filters.method || filters.date_from || filters.date_to || filters.search;

	function updateFilter(update: Partial<FansSearch>) {
		navigate({
			to: "/fans",
			search: (prev: FansSearch) => {
				const next = { ...prev, ...update };
				for (const key of Object.keys(next) as (keyof FansSearch)[]) {
					if (!next[key]) delete next[key];
				}
				return next;
			},
		});
	}

	function clearFilters() {
		navigate({ to: "/fans", search: {} });
	}

	async function exportCsv() {
		if (!canExport) {
			toast.error("CSV export is a Superstar feature. Reach out to Matt to upgrade.");
			return;
		}
		try {
			const qs = buildQueryString(filters);
			const blob = await api.getBlob(`/captures/export${qs}`);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "fans.csv";
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			toast.error("Failed to export CSV");
		}
	}

	return (
		<div className="space-y-4">
			<FilterBar
				filters={filters}
				updateFilter={updateFilter}
				clearFilters={clearFilters}
				pages={pages}
				rows={rows}
				exportCsv={exportCsv}
				canExport={canExport}
			/>

			{hasFilters && (
				<ActiveFilterBadges filters={filters} updateFilter={updateFilter} rows={rows} />
			)}

			{isError ? (
				<QueryError onRetry={() => refetch()} />
			) : isLoading ? (
				<div className="flex items-center justify-center py-16">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			) : rows && rows.length > 0 ? (
				<CapturesTable rows={rows} showPageColumn={!filters.page_id} />
			) : (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<div className="mb-4 rounded-full bg-muted p-4">
							<Users className="size-8 text-muted-foreground" />
						</div>
						<h3 className="font-display text-lg font-semibold">
							{hasFilters ? "No matching fans" : "No fans yet"}
						</h3>
						<p className="mt-1 mb-4 max-w-sm text-center text-sm text-muted-foreground">
							{hasFilters ? (
								<>
									No fans match your current filters.{" "}
									<button
										type="button"
										onClick={clearFilters}
										className="text-electric-blue hover:underline"
									>
										Clear filters
									</button>
								</>
							) : (
								"Share a capture page at your next gig and fans will start appearing here as they sign up."
							)}
						</p>
						{!hasFilters && (
							<Button variant="outline" asChild>
								<Link to="/pages">
									<QrCode />
									Go to Capture Pages
								</Link>
							</Button>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
