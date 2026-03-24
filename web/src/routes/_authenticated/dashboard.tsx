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
		id: string;
		title: string;
		slug: string;
		captures: number;
		emails_sent: number;
		emails_opened: number;
		open_rate: number;
	}[];
	daily: { date: string; count: number }[];
};

function DashboardPage() {
	const { data: overview, isLoading } = useQuery({
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
					<CardHeader>
						<CardTitle>Get Started</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Create your first capture page to start collecting fan emails at your next gig.
						</p>
						<Button asChild>
							<Link to="/pages">
								<QrCode />
								Create Capture Page
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Stat cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard label="Total Fans" value={overview.total_fans} icon={Users} />
				<StatCard label="Capture Pages" value={overview.total_pages} icon={QrCode} />
				<StatCard label="This Week" value={overview.this_week} icon={BarChart3} />
			</div>

			{/* Growth chart */}
			<GrowthChart daily={overview.daily} />

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Top pages */}
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
									<div key={p.id} className="flex items-center gap-3 text-sm">
										<span className="w-5 shrink-0 text-center text-muted-foreground">{i + 1}</span>
										<span className="min-w-0 flex-1 truncate">{p.title}</span>
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
								);
							})}
						</div>
					</CardContent>
				</Card>

				{/* Recent captures */}
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

function StatCard({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
				<Icon className="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<p className="font-display text-3xl font-bold">{value.toLocaleString()}</p>
			</CardContent>
		</Card>
	);
}

function GrowthChart({ daily }: { daily: { date: string; count: number }[] }) {
	const data = daily.map((d) => ({
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		count: d.count,
	}));

	const hasActivity = daily.some((d) => d.count > 0);

	if (!hasActivity) return null;

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
