import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, Loader2, QrCode, Users } from "lucide-react";
import { METHOD_COLORS, METHOD_LABELS, MethodList } from "@/components/show-drill-down";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type TonightData = {
	page_title: string | null;
	page_id: string | null;
	new_fans: number;
	methods: { qr: number; sms: number; nfc: number; direct: number };
	avg_per_show: number;
	recent: {
		id: string;
		fan_name: string | null;
		email: string;
		entry_method: string;
		captured_at: string;
	}[];
	email_status: {
		entered: number;
		sent: number;
		opened: number;
		open_rate: number;
	};
};

function formatComparison(
	current: number,
	avg: number,
): { value: string; direction: "up" | "down" | "neutral" } | undefined {
	if (avg === 0) return undefined;
	const diff = current - avg;
	const pct = Math.round((Math.abs(diff) / avg) * 100);
	if (diff > 0) return { value: `${pct}% above avg`, direction: "up" };
	if (diff < 0) return undefined;
	return { value: "at average", direction: "neutral" };
}

function methodsToArray(methods: TonightData["methods"]): { method: string; count: number }[] {
	return Object.entries(methods)
		.filter(([, count]) => count > 0)
		.map(([method, count]) => ({ method, count }));
}

export function DashboardTonight(): React.ReactElement {
	const { data, isLoading } = useQuery({
		queryKey: ["analytics-tonight"],
		queryFn: () => api.get<TonightData>("/analytics/tonight"),
		refetchInterval: 30_000,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!data || !data.page_title) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<div className="mb-4 rounded-full bg-muted p-4">
						<Clock className="size-8 text-muted-foreground" />
					</div>
					<h3 className="font-display text-lg font-semibold">No show tonight</h3>
					<p className="mt-1 mb-4 max-w-sm text-center text-sm text-muted-foreground">
						Update a capture page title for tonight's show and fans will appear here as they sign
						up.
					</p>
					<Link to="/pages" className="text-sm text-electric-blue hover:underline">
						Go to Capture Pages
					</Link>
				</CardContent>
			</Card>
		);
	}

	const methodArr = methodsToArray(data.methods);
	const totalMethods = methodArr.reduce((sum, m) => sum + m.count, 0);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-display text-lg font-semibold">{data.page_title}</h2>
				<p className="text-xs text-muted-foreground">Live — updates every 30 seconds</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<StatCard
					label="New Fans"
					value={data.new_fans}
					icon={Users}
					comparison={formatComparison(data.new_fans, data.avg_per_show)}
				/>
				<StatCard label="Avg per Show" value={Math.round(data.avg_per_show)} icon={QrCode} />
			</div>

			{methodArr.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">Capture Methods</CardTitle>
					</CardHeader>
					<CardContent>
						<MethodList methods={methodArr} total={totalMethods} />
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">Recent Sign-ups</CardTitle>
				</CardHeader>
				<CardContent>
					{data.recent.length > 0 ? (
						<div className="space-y-2">
							{data.recent.map((r) => (
								<div key={r.id} className="flex items-center gap-3 text-sm">
									<div
										className="size-2.5 shrink-0 rounded-full"
										style={{
											backgroundColor: METHOD_COLORS[r.entry_method] ?? "#6b7280",
										}}
									/>
									<span className="min-w-0 flex-1 truncate">{r.fan_name || r.email}</span>
									<span className="shrink-0 text-xs text-muted-foreground">
										{METHOD_LABELS[r.entry_method] ?? r.entry_method}
									</span>
									<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
										{new Date(r.captured_at).toLocaleTimeString("en-US", {
											hour: "numeric",
											minute: "2-digit",
										})}
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="py-4 text-center text-sm text-muted-foreground">
							No fans yet — they'll appear here as they sign up.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
