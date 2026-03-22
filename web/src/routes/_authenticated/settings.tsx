import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const user = getUser();

	return (
		<div className="max-w-2xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Account</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<p className="text-sm text-muted-foreground">Email</p>
						<p className="text-sm">{user?.email}</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
