import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/analytics")({
	component: AnalyticsPage,
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
};

type PageAnalytics = {
	total: number;
	methods: { method: string; count: number }[];
	daily: { date: string; count: number }[];
	email: { sent: number; opened: number; open_rate: number };
};

const METHOD_LABELS: Record<string, string> = {
	direct: "Direct Link",
	qr: "QR Code",
	sms: "Text-to-Join",
	nfc: "NFC Tap",
};

const METHOD_COLORS: Record<string, string> = {
	direct: "#3b82f6",
	qr: "#E8C547",
	sms: "#34d399",
	nfc: "#a78bfa",
};

function AnalyticsPage() {
	const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

	const { data: overview, isLoading: overviewLoading } = useQuery({
		queryKey: ["analytics-overview"],
		queryFn: () => api.get<OverviewData>("/analytics"),
	});

	const { data: pageData, isLoading: pageLoading } = useQuery({
		queryKey: ["page-analytics", selectedPageId],
		queryFn: () => api.get<PageAnalytics>(`/capture-pages/${selectedPageId}/analytics`),
		enabled: !!selectedPageId,
	});

	if (overviewLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!overview || overview.total_fans === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-16">
					<div className="mb-4 rounded-full bg-muted p-4">
						<BarChart3 className="size-8 text-muted-foreground" />
					</div>
					<h3 className="font-display text-lg font-semibold">No analytics yet</h3>
					<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
						Once you start capturing fans, you'll see per-page stats, capture method breakdowns, and
						growth over time.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Overview stats */}
			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard label="Total Captures" value={overview.total_fans} />
				<StatCard label="This Week" value={overview.this_week} />
				<StatCard label="Capture Pages" value={overview.total_pages} />
			</div>

			{/* Top pages ranking */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">Captures by Page</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{overview.pages.map((p) => {
							const pct = overview.total_fans > 0 ? (p.captures / overview.total_fans) * 100 : 0;
							return (
								<button
									key={p.id}
									type="button"
									onClick={() => setSelectedPageId(p.id === selectedPageId ? null : p.id)}
									className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${p.id === selectedPageId ? "bg-honey-gold/10 text-honey-gold" : "hover:bg-muted"}`}
								>
									<span className="min-w-0 flex-1 truncate">{p.title}</span>
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
				</CardContent>
			</Card>

			{/* Per-page detail */}
			{selectedPageId &&
				(pageLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : pageData ? (
					<div className="space-y-4">
						{pageData.email.sent > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="text-sm font-medium">Email Performance</CardTitle>
								</CardHeader>
								<CardContent className="flex items-center gap-6">
									<div>
										<p className="font-display text-2xl font-bold">
											{Math.round(pageData.email.open_rate * 100)}%
										</p>
										<p className="text-xs text-muted-foreground">Open Rate</p>
									</div>
									<div>
										<p className="text-lg tabular-nums">{pageData.email.sent}</p>
										<p className="text-xs text-muted-foreground">Sent</p>
									</div>
									<div>
										<p className="text-lg tabular-nums">{pageData.email.opened}</p>
										<p className="text-xs text-muted-foreground">Opened</p>
									</div>
								</CardContent>
							</Card>
						)}
						<div className="grid gap-4 lg:grid-cols-2">
							<MethodBreakdownChart methods={pageData.methods} total={pageData.total} />
							<DailyChart daily={pageData.daily} />
						</div>
					</div>
				) : null)}
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
				<TrendingUp className="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<p className="font-display text-3xl font-bold">{value.toLocaleString()}</p>
			</CardContent>
		</Card>
	);
}

function MethodBreakdownChart({
	methods,
	total,
}: {
	methods: { method: string; count: number }[];
	total: number;
}) {
	const data = methods.map((m) => ({
		name: METHOD_LABELS[m.method] ?? m.method,
		value: m.count,
		color: METHOD_COLORS[m.method] ?? "#6b7280",
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">Capture Method</CardTitle>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={200}>
					<BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
						<XAxis type="number" hide />
						<YAxis
							type="category"
							dataKey="name"
							width={100}
							tick={{ fill: "#9ca3af", fontSize: 12 }}
							axisLine={false}
							tickLine={false}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: "#111827",
								border: "1px solid #374151",
								borderRadius: 6,
								fontSize: 12,
							}}
							formatter={(value) => {
								const n = Number(value);
								return [`${n} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`, "Captures"];
							}}
						/>
						<Bar dataKey="value" radius={[0, 4, 4, 0]}>
							{data.map((entry) => (
								<Cell key={entry.name} fill={entry.color} />
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}

function DailyChart({ daily }: { daily: { date: string; count: number }[] }) {
	const data = daily.map((d) => ({
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		count: d.count,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">Captures (Last 30 Days)</CardTitle>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={200}>
					<AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
						<defs>
							<linearGradient id="captureGradient" x1="0" y1="0" x2="0" y2="1">
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
							fill="url(#captureGradient)"
						/>
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
