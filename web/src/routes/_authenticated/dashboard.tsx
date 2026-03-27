import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Loader2, QrCode, TrendingUp, Users } from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type CaptureRow, CapturesTable } from "@/components/captures-table";
import { QueryError } from "@/components/query-error";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: DashboardPage,
});

type OverviewData = {
	total_fans: number;
	total_pages: number;
	this_week: number;
	pages: {
		id: string | null;
		title: string;
		slug: string | null;
		latest_capture: string | null;
		captures: number;
		methods: { method: string; count: number }[];
		daily: { date: string; count: number }[];
		emails_sent: number;
		emails_opened: number;
		open_rate: number;
	}[];
	daily: { date: string; count: number }[];
};

function DashboardPage() {
	const {
		data: overview,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["analytics-overview"],
		queryFn: () => api.get<OverviewData>("/analytics"),
	});

	const { data: recentCaptures } = useQuery({
		queryKey: ["captures", "all"],
		queryFn: () => api.get<CaptureRow[]>("/captures"),
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

	const hasData = overview && overview.total_fans > 0;
	const recent = (recentCaptures ?? []).slice(0, 10);
	const topPages = (overview?.pages ?? []).slice(0, 5);

	if (!hasData) {
		return (
			<div className="space-y-8">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<StatCard label="Total Fans" value={0} icon={Users} />
					<StatCard label="Capture Pages" value={overview?.total_pages ?? 0} icon={QrCode} />
					<StatCard label="This Week" value={0} icon={BarChart3} />
				</div>
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<div className="mb-4 rounded-full bg-muted p-4">
							<QrCode className="size-8 text-muted-foreground" />
						</div>
						<h3 className="font-display text-lg font-semibold">Welcome to Afterset</h3>
						<p className="mt-1 mb-4 max-w-sm text-center text-sm text-muted-foreground">
							{overview && overview.total_pages > 0
								? "Your capture pages are ready — share one at your next gig and fans will start appearing here."
								: "Create a capture page, print the QR code, and start collecting fan emails at your next show."}
						</p>
						{overview && overview.total_pages > 0 ? (
							<Button variant="outline" asChild>
								<Link to="/pages">
									<QrCode />
									View Your Pages
								</Link>
							</Button>
						) : (
							<Button asChild>
								<Link to="/pages">
									<QrCode />
									Create Capture Page
								</Link>
							</Button>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard label="Total Fans" value={overview.total_fans} icon={Users} />
				<StatCard label="Capture Pages" value={overview.total_pages} icon={QrCode} />
				<StatCard label="This Week" value={overview.this_week} icon={BarChart3} />
			</div>

			<GrowthChart daily={overview.daily} />

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="text-sm font-medium">Top Pages</CardTitle>
						<Link to="/analytics" className="text-xs text-electric-blue hover:underline">
							View all
						</Link>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{topPages.map((p, i) => {
								const pct = overview.total_fans > 0 ? (p.captures / overview.total_fans) * 100 : 0;
								return (
									<div key={p.id ?? p.title} className="space-y-1">
										<div className="flex items-center gap-3 text-sm">
											<span className="w-5 shrink-0 text-center text-muted-foreground">
												{i + 1}
											</span>
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
											<span className="shrink-0 tabular-nums text-muted-foreground">
												{p.captures}
											</span>
											{p.emails_sent > 0 && (
												<span className="shrink-0 text-xs text-muted-foreground">
													{Math.round(p.open_rate * 100)}%
												</span>
											)}
											<div className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
												<div
													className="h-full rounded-full bg-honey-gold transition-[width]"
													style={{ width: `${pct}%` }}
												/>
											</div>
										</div>
										{p.methods.length > 0 && (
											<div className="flex gap-2 pl-8">
												{p.methods.map((m) => (
													<span key={m.method} className="text-xs text-muted-foreground">
														{m.method} {m.count}
													</span>
												))}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="text-sm font-medium">Recent Captures</CardTitle>
						<Link to="/fans" className="text-xs text-electric-blue hover:underline">
							View all
						</Link>
					</CardHeader>
					<CardContent>
						{recent.length > 0 ? (
							<CapturesTable rows={recent} showPageColumn compact />
						) : (
							<p className="py-4 text-center text-sm text-muted-foreground">No captures yet.</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function GrowthChart({
	daily,
}: {
	daily: { date: string; count: number }[];
}): React.ReactElement | null {
	const data = daily.map((d) => ({
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		count: d.count,
	}));

	if (!daily.some((d) => d.count > 0)) return null;

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle className="text-sm font-medium">Growth (Last 30 Days)</CardTitle>
				<TrendingUp className="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={200}>
					<AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
						<defs>
							<linearGradient id="dashGradient" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#E8C547" stopOpacity={0.3} />
								<stop offset="100%" stopColor="#E8C547" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
						<XAxis
							dataKey="date"
							tick={{ fill: "#9ca3af", fontSize: 11 }}
							axisLine={false}
							tickLine={false}
							interval="preserveStartEnd"
						/>
						<YAxis
							tick={{ fill: "#9ca3af", fontSize: 11 }}
							axisLine={false}
							tickLine={false}
							allowDecimals={false}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: "#111827",
								border: "1px solid #374151",
								borderRadius: 6,
								fontSize: 12,
							}}
						/>
						<Area
							type="monotone"
							dataKey="count"
							stroke="#E8C547"
							strokeWidth={2}
							fill="url(#dashGradient)"
						/>
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
