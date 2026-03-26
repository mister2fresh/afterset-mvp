import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Loader2, Mail, QrCode, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics")({
	component: AnalyticsPage,
});

type ShowStats = {
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
};

type OverviewData = {
	total_fans: number;
	total_pages: number;
	this_week: number;
	pages: ShowStats[];
	daily: { date: string; count: number }[];
};

type Broadcast = {
	id: string;
	subject: string | null;
	status: "draft" | "scheduled" | "sending" | "sent" | "failed";
	recipient_count: number;
	sent_count: number;
	opened_count: number;
	created_at: string;
	scheduled_at: string | null;
};

type PageAnalytics = {
	total: number;
	methods: { method: string; count: number }[];
	daily: { date: string; count: number }[];
	email: {
		sent: number;
		opened: number;
		open_rate: number;
		steps?: {
			sequence_order: number;
			subject: string;
			sent: number;
			opened: number;
			open_rate: number;
		}[];
	};
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
	const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

	const {
		data: overview,
		isLoading: overviewLoading,
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

	if (overviewLoading) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
				<p className="text-sm text-muted-foreground">Loading your analytics...</p>
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
					<h3 className="font-display text-lg font-semibold">No analytics yet</h3>
					<p className="mt-1 mb-4 max-w-sm text-center text-sm text-muted-foreground">
						Share a capture page at your next gig. Once fans start signing up, you'll see per-page
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
			{/* Overview stats */}
			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard label="Total Captures" value={overview.total_fans} />
				<StatCard label="This Week" value={overview.this_week} />
				<StatCard label="Capture Pages" value={overview.total_pages} />
			</div>

			{/* Captures by show — list + drill-down together */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">Captures by Show</CardTitle>
					<p className="text-xs text-muted-foreground">
						Select a show to see its capture methods, daily trend, and email stats
					</p>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-1">
						{overview.pages.map((p) => {
							const pct = overview.total_fans > 0 ? (p.captures / overview.total_fans) * 100 : 0;
							return (
								<button
									key={p.id ?? p.title}
									type="button"
									onClick={() => setSelectedTitle(p.title === selectedTitle ? null : p.title)}
									className={cn(
										"flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
										p.title === selectedTitle
											? "bg-honey-gold/10 text-honey-gold"
											: "hover:bg-muted",
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
								<p className="mb-3 text-xs font-medium text-muted-foreground">
									{selectedShow.title}
								</p>
							</div>
							<ShowDrillDown show={selectedShow} stepData={pageData} stepLoading={pageLoading} />
						</>
					)}
				</CardContent>
			</Card>

			{/* Overall daily trend */}
			<DailyChart daily={overview.daily} title="All Captures (Last 30 Days)" />

			{/* Broadcast engagement */}
			<BroadcastEngagement broadcasts={broadcasts} />
		</div>
	);
}

const STATUS_COLORS = {
	sent: "bg-emerald-500/20 text-emerald-400",
	sending: "bg-blue-500/20 text-blue-400",
	scheduled: "bg-amber-500/20 text-amber-400",
	draft: "bg-zinc-500/20 text-zinc-400",
	failed: "bg-red-500/20 text-red-400",
} as const;

function BroadcastEngagement({ broadcasts }: { broadcasts: Broadcast[] | undefined }) {
	const sent = (broadcasts ?? []).filter((b) => b.status !== "draft");
	if (sent.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">Broadcast Engagement</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{sent.map((b) => {
						const openRate =
							b.sent_count > 0 ? Math.round((b.opened_count / b.sent_count) * 100) : 0;
						return (
							<div key={b.id} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm">
								<Mail className="size-4 shrink-0 text-muted-foreground" />
								<span className="min-w-0 flex-1 truncate">{b.subject || "Untitled broadcast"}</span>
								<span
									className={cn(
										"shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
										STATUS_COLORS[b.status],
									)}
								>
									{b.status}
								</span>
								{b.status === "sent" || b.status === "sending" ? (
									<>
										<span className="shrink-0 tabular-nums text-muted-foreground">
											{b.sent_count} sent
										</span>
										<span className="shrink-0 tabular-nums">{openRate}% opened</span>
									</>
								) : b.status === "scheduled" && b.scheduled_at ? (
									<span className="shrink-0 text-xs text-muted-foreground">
										{new Date(b.scheduled_at).toLocaleDateString("en-US", {
											month: "numeric",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</span>
								) : null}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

function ShowDrillDown({
	show,
	stepData,
	stepLoading,
}: {
	show: ShowStats;
	stepData: PageAnalytics | undefined;
	stepLoading: boolean;
}) {
	return (
		<div className="space-y-3">
			{/* Stat row */}
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
				<div>
					<p className="font-display text-xl font-bold">{show.captures}</p>
					<p className="text-xs text-muted-foreground">Captures</p>
				</div>
				{show.emails_sent > 0 && (
					<>
						<div>
							<p className="text-lg tabular-nums">{show.emails_sent}</p>
							<p className="text-xs text-muted-foreground">Emails Sent</p>
						</div>
						<div>
							<p className="text-lg tabular-nums">{Math.round(show.open_rate * 100)}%</p>
							<p className="text-xs text-muted-foreground">Open Rate</p>
						</div>
					</>
				)}
			</div>

			{/* Method + daily charts */}
			<div className="grid gap-3 lg:grid-cols-2">
				<div className="rounded-md bg-muted/40 p-3">
					<p className="mb-2 text-xs font-medium text-muted-foreground">Capture Method</p>
					<MethodList methods={show.methods} total={show.captures} />
				</div>
				<div className="rounded-md bg-muted/40 p-3">
					<p className="mb-2 text-xs font-medium text-muted-foreground">Daily Trend</p>
					<MiniDailyChart daily={show.daily} />
				</div>
			</div>

			{/* Per-step email breakdown */}
			{stepLoading && (
				<div className="flex items-center gap-2">
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
					<p className="text-xs text-muted-foreground">Loading step breakdown…</p>
				</div>
			)}
			{stepData?.email.steps && stepData.email.steps.length > 1 && (
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground">Email Sequence</p>
					{stepData.email.steps.map((step) => (
						<div key={step.sequence_order} className="flex items-center gap-3 text-sm">
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
								{step.sequence_order + 1}
							</span>
							<span className="min-w-0 flex-1 truncate text-muted-foreground">{step.subject}</span>
							<span className="shrink-0 tabular-nums">{step.sent} sent</span>
							<span className="shrink-0 tabular-nums text-muted-foreground">
								{step.sent > 0 ? `${Math.round(step.open_rate * 100)}%` : "—"}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function MethodList({
	methods,
	total,
}: {
	methods: { method: string; count: number }[];
	total: number;
}) {
	return (
		<div className="space-y-1.5">
			{methods.map((m) => (
				<div key={m.method} className="flex items-center gap-2 text-sm">
					<div
						className="size-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: METHOD_COLORS[m.method] ?? "#6b7280" }}
					/>
					<span className="flex-1 text-muted-foreground">
						{METHOD_LABELS[m.method] ?? m.method}
					</span>
					<span className="tabular-nums">{m.count}</span>
					<span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
						{total > 0 ? `${Math.round((m.count / total) * 100)}%` : "0%"}
					</span>
				</div>
			))}
		</div>
	);
}

function MiniDailyChart({ daily }: { daily: { date: string; count: number }[] }) {
	const filled = fillLast30Days(daily);
	const data = filled.map((d) => ({
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		count: d.count,
	}));

	return (
		<ResponsiveContainer width="100%" height={120}>
			<AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
				<defs>
					<linearGradient id="showGradient" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#E8C547" stopOpacity={0.3} />
						<stop offset="100%" stopColor="#E8C547" stopOpacity={0} />
					</linearGradient>
				</defs>
				<XAxis
					dataKey="date"
					tick={{ fill: "#9ca3af", fontSize: 10 }}
					axisLine={false}
					tickLine={false}
					interval="preserveStartEnd"
				/>
				<YAxis hide allowDecimals={false} />
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
					fill="url(#showGradient)"
				/>
			</AreaChart>
		</ResponsiveContainer>
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
				<p className="font-display text-2xl font-bold sm:text-3xl">{value.toLocaleString()}</p>
			</CardContent>
		</Card>
	);
}

function fillLast30Days(
	sparse: { date: string; count: number }[],
): { date: string; count: number }[] {
	const counts = new Map(sparse.map((d) => [d.date, d.count]));
	const result: { date: string; count: number }[] = [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	for (let i = 29; i >= 0; i--) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const key = d.toISOString().slice(0, 10);
		result.push({ date: key, count: counts.get(key) ?? 0 });
	}
	return result;
}

function DailyChart({
	daily,
	title = "Captures (Last 30 Days)",
}: {
	daily: { date: string; count: number }[];
	title?: string;
}) {
	const filled = fillLast30Days(daily);
	const data = filled.map((d) => ({
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		count: d.count,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
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
