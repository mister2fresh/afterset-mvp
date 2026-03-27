import { Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fillLast30Days } from "@/components/daily-chart";

export type ShowStats = {
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

export type PageAnalytics = {
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

export const METHOD_LABELS: Record<string, string> = {
	direct: "Direct Link",
	qr: "QR Code",
	sms: "Text-to-Join",
	nfc: "NFC Tap",
};

export const METHOD_COLORS: Record<string, string> = {
	direct: "#3b82f6",
	qr: "#E8C547",
	sms: "#34d399",
	nfc: "#a78bfa",
};

export function ShowDrillDown({
	show,
	stepData,
	stepLoading,
}: {
	show: ShowStats;
	stepData: PageAnalytics | undefined;
	stepLoading: boolean;
}): React.ReactElement {
	return (
		<div className="space-y-3">
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
							<p className="text-lg tabular-nums">{show.emails_opened}</p>
							<p className="text-xs text-muted-foreground">Emails Opened</p>
						</div>
						<div>
							<p className="text-lg tabular-nums">{Math.round(show.open_rate * 100)}%</p>
							<p className="text-xs text-muted-foreground">Open Rate</p>
						</div>
					</>
				)}
			</div>

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

			{stepLoading && (
				<div className="flex items-center gap-2">
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
					<p className="text-xs text-muted-foreground">Loading step breakdown…</p>
				</div>
			)}
			{stepData?.email.steps && stepData.email.steps.length > 1 && (
				<EmailSequenceSteps steps={stepData.email.steps} />
			)}
		</div>
	);
}

function EmailSequenceSteps({
	steps,
}: {
	steps: NonNullable<PageAnalytics["email"]["steps"]>;
}): React.ReactElement {
	return (
		<div className="space-y-2">
			<p className="text-xs font-medium text-muted-foreground">Email Sequence</p>
			{steps.map((step) => (
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
	);
}

export function MethodList({
	methods,
	total,
}: {
	methods: { method: string; count: number }[];
	total: number;
}): React.ReactElement {
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

export function MiniDailyChart({
	daily,
}: {
	daily: { date: string; count: number }[];
}): React.ReactElement {
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
