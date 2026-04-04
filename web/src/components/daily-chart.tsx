import { useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function fillLast30Days(
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

export function DailyChart({
	daily,
	title = "Captures (Last 30 Days)",
}: {
	daily: { date: string; count: number }[];
	title?: string;
}): React.ReactElement {
	const gradientId = useId();
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
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
							fill={`url(#${gradientId})`}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
