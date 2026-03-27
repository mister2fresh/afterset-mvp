import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Comparison = {
	value: string;
	direction: "up" | "down" | "neutral";
};

export function StatCard({
	label,
	value,
	icon: Icon,
	comparison,
}: {
	label: string;
	value: number;
	icon?: React.ComponentType<{ className?: string }>;
	comparison?: Comparison;
}): React.ReactElement {
	const IconComponent = Icon ?? TrendingUp;
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
				<IconComponent className="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<p className="font-display text-2xl font-bold sm:text-3xl">{value.toLocaleString()}</p>
				{comparison && (
					<p className="mt-1 text-xs text-muted-foreground">
						<span
							className={
								comparison.direction === "up"
									? "text-emerald-400"
									: comparison.direction === "down"
										? "text-red-400"
										: ""
							}
						>
							{comparison.value}
						</span>
					</p>
				)}
			</CardContent>
		</Card>
	);
}
