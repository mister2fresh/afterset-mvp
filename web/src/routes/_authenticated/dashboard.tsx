import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, QrCode, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: DashboardPage,
});

const stats = [
	{ label: "Total Fans", value: "0", icon: Users },
	{ label: "Capture Pages", value: "0", icon: QrCode },
	{ label: "This Week", value: "0", icon: BarChart3 },
];

function DashboardPage() {
	return (
		<div className="space-y-8">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{stats.map((stat) => (
					<Card key={stat.label}>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								{stat.label}
							</CardTitle>
							<stat.icon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="font-display text-3xl font-bold">{stat.value}</p>
						</CardContent>
					</Card>
				))}
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
