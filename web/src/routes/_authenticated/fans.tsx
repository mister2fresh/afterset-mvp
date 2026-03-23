import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Users, X } from "lucide-react";
import { type CaptureRow, CapturesTable } from "@/components/captures-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

type FansSearch = {
	page_id?: string;
	page_title?: string;
};

export const Route = createFileRoute("/_authenticated/fans")({
	validateSearch: (search: Record<string, unknown>): FansSearch => ({
		page_id: typeof search.page_id === "string" ? search.page_id : undefined,
		page_title: typeof search.page_title === "string" ? search.page_title : undefined,
	}),
	component: FansPage,
});

function useCaptures(pageId?: string) {
	const params = pageId ? `?page_id=${pageId}` : "";
	return useQuery({
		queryKey: ["captures", pageId ?? "all"],
		queryFn: () => api.get<CaptureRow[]>(`/captures${params}`),
	});
}

function FansPage() {
	const { page_id, page_title } = Route.useSearch();
	const navigate = useNavigate();
	const { data: rows, isLoading } = useCaptures(page_id);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const hasRows = rows && rows.length > 0;

	return (
		<div className="space-y-4">
			{page_id && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Filtered by page:</span>
					<Badge variant="secondary" className="gap-1">
						{page_title ?? "..."}
						<button
							type="button"
							onClick={() => navigate({ to: "/fans", search: {} })}
							className="ml-0.5 rounded-full hover:bg-muted"
						>
							<X className="size-3" />
						</button>
					</Badge>
				</div>
			)}

			{hasRows ? (
				<CapturesTable rows={rows} showPageColumn={!page_id} />
			) : (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<div className="mb-4 rounded-full bg-muted p-4">
							<Users className="size-8 text-muted-foreground" />
						</div>
						<h3 className="font-display text-lg font-semibold">
							{page_id ? "No captures for this page" : "No fans yet"}
						</h3>
						<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
							{page_id ? (
								<>
									No one has submitted their email through this page yet.{" "}
									<Link to="/fans" search={{}} className="text-electric-blue hover:underline">
										View all fans
									</Link>
								</>
							) : (
								"When fans submit their email through your capture pages, they'll appear here."
							)}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
