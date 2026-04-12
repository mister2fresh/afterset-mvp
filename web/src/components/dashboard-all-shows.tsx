import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, Loader2, QrCode } from "lucide-react";
import { useState } from "react";
import { BroadcastEngagement } from "@/components/broadcast-engagement";
import { DailyChart } from "@/components/daily-chart";
import { QueryError } from "@/components/query-error";
import { type PageAnalytics, ShowDrillDown, type ShowStats } from "@/components/show-drill-down";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Broadcast } from "@/lib/types";
import { cn } from "@/lib/utils";

type OverviewData = {
	total_fans: number;
	total_pages: number;
	this_week: number;
	pages: ShowStats[];
	daily: { date: string; count: number }[];
};

export function DashboardAllShows(): React.ReactElement {
	const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

	const {
		data: overview,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["analytics-overview"],
		queryFn: () => api.get<OverviewData>("/analytics"),
	});

	const { data: broadcasts } = useQuery({
		queryKey: ["broadcasts"],
		queryFn: () => api.get<Broadcast[]>("/broadcasts"),
	});

	const selectedShow = overview?.pages.find((p) => p.title === selectedTitle);
	const selectedPageId = selectedShow?.id ?? null;

	const { data: pageData, isLoading: pageLoading } = useQuery({
		queryKey: ["page-analytics", selectedPageId],
		queryFn: () => api.get<PageAnalytics>(`/capture-pages/${selectedPageId}/analytics`),
		enabled: !!selectedPageId,
	});

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

	if (!overview || overview.total_fans === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-16">
					<div className="mb-4 rounded-full bg-muted p-4">
						<BarChart3 className="size-8 text-muted-foreground" />
					</div>
					<h3 className="font-display text-lg font-semibold">No show data yet</h3>
					<p className="mt-1 mb-4 max-w-sm text-center text-sm text-muted-foreground">
						Share a capture page at your next gig. Once fans start signing up, you'll see per-show
						stats, method breakdowns, and growth trends here.
					</p>
					<Button variant="outline" asChild>
						<Link to="/pages">
							<QrCode />
							Go to Capture Pages
						</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard label="Total Fans" value={overview.total_fans} />
				<StatCard label="This Week" value={overview.this_week} />
				<StatCard label="Capture Pages" value={overview.total_pages} />
			</div>

			<DailyChart daily={overview.daily} title="All Captures (Last 30 Days)" />

			<CapturesByShow
				pages={overview.pages}
				totalFans={overview.total_fans}
				selectedTitle={selectedTitle}
				onSelectTitle={setSelectedTitle}
				pageData={pageData}
				pageLoading={pageLoading}
			/>

			<BroadcastEngagement broadcasts={broadcasts} />
		</div>
	);
}

function CapturesByShow({
	pages,
	totalFans,
	selectedTitle,
	onSelectTitle,
	pageData,
	pageLoading,
}: {
	pages: ShowStats[];
	totalFans: number;
	selectedTitle: string | null;
	onSelectTitle: (title: string | null) => void;
	pageData: PageAnalytics | undefined;
	pageLoading: boolean;
}): React.ReactElement {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">Captures by Show</CardTitle>
				<p className="text-xs text-muted-foreground">
					Select a show to see its capture methods, daily trend, and email stats
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="mb-1 flex items-center px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
					<span className="min-w-0 flex-1">Show</span>
					<span className="w-16 shrink-0 text-center">Date</span>
					<span className="w-12 shrink-0 text-center">Fans</span>
					<span className="w-14 shrink-0 text-center">Opens</span>
					<span className="w-20 shrink-0" />
				</div>
				<div className="space-y-1">
					{pages.map((p) => {
						const pct = totalFans > 0 ? (p.captures / totalFans) * 100 : 0;
						const isSelected = p.title === selectedTitle;
						return (
							<div key={p.id ?? p.title}>
								<button
									type="button"
									onClick={() => onSelectTitle(isSelected ? null : p.title)}
									className={cn(
										"flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors",
										isSelected ? "bg-honey-gold/10 text-honey-gold" : "hover:bg-muted",
									)}
								>
									<span className="min-w-0 flex-1 truncate">{p.title}</span>
									<span className="w-16 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
										{p.latest_capture
											? new Date(p.latest_capture).toLocaleDateString("en-US", {
													month: "numeric",
													day: "numeric",
													year: "2-digit",
												})
											: "—"}
									</span>
									<span className="w-12 shrink-0 text-center tabular-nums text-muted-foreground">
										{p.captures}
									</span>
									<span className="w-14 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
										{p.emails_sent > 0 ? `${Math.round(p.open_rate * 100)}%` : "—"}
									</span>
									<div className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-honey-gold transition-[width]"
											style={{ width: `${pct}%` }}
										/>
									</div>
								</button>
								{isSelected && (
									<div className="ml-3 border-l-2 border-honey-gold/30 py-3 pl-4">
										<ShowDrillDown show={p} stepData={pageData} stepLoading={pageLoading} />
									</div>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
