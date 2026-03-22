import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/analytics")({
	component: AnalyticsPage,
});

function AnalyticsPage() {
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
