import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, Loader2, QrCode } from "lucide-react";
import { useState } from "react";
import { type Broadcast, BroadcastEngagement } from "@/components/broadcast-engagement";
import { DailyChart } from "@/components/daily-chart";
import { QueryError } from "@/components/query-error";
import { type PageAnalytics, ShowDrillDown, type ShowStats } from "@/components/show-drill-down";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
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

			<CapturesByShow
				pages={overview.pages}
				totalFans={overview.total_fans}
				selectedTitle={selectedTitle}
				onSelectTitle={setSelectedTitle}
				selectedShow={selectedShow}
				pageData={pageData}
				pageLoading={pageLoading}
			/>

			<DailyChart daily={overview.daily} title="All Captures (Last 30 Days)" />

			<BroadcastEngagement broadcasts={broadcasts} />
		</div>
	);
}

function CapturesByShow({
	pages,
	totalFans,
	selectedTitle,
	onSelectTitle,
	selectedShow,
	pageData,
	pageLoading,
}: {
	pages: ShowStats[];
	totalFans: number;
	selectedTitle: string | null;
	onSelectTitle: (title: string | null) => void;
	selectedShow: ShowStats | undefined;
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
				<div className="space-y-1">
					{pages.map((p) => {
						const pct = totalFans > 0 ? (p.captures / totalFans) * 100 : 0;
						return (
							<button
								key={p.id ?? p.title}
								type="button"
								onClick={() => onSelectTitle(p.title === selectedTitle ? null : p.title)}
								className={cn(
									"flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
									p.title === selectedTitle ? "bg-honey-gold/10 text-honey-gold" : "hover:bg-muted",
								)}
							>
								<span className="min-w-0 flex-1 truncate">{p.title}</span>
								{p.latest_capture && (
									<span className="shrink-0 text-xs text-muted-foreground">
										{new Date(p.latest_capture).toLocaleDateString("en-US", {
											month: "numeric",
											day: "numeric",
											year: "2-digit",
										})}
									</span>
								)}
								<span className="shrink-0 tabular-nums text-muted-foreground">{p.captures}</span>
								{p.emails_sent > 0 && (
									<span className="shrink-0 text-xs text-muted-foreground">
										{Math.round(p.open_rate * 100)}% opens
									</span>
								)}
								<div className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-honey-gold transition-[width]"
										style={{ width: `${pct}%` }}
									/>
								</div>
							</button>
						);
					})}
				</div>
				{selectedShow && (
					<>
						<div className="border-t border-border pt-4">
							<p className="mb-3 text-xs font-medium text-muted-foreground">{selectedShow.title}</p>
						</div>
						<ShowDrillDown show={selectedShow} stepData={pageData} stepLoading={pageLoading} />
					</>
				)}
			</CardContent>
		</Card>
	);
}
