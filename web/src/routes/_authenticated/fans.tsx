import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/fans")({
	component: FansPage,
});

function FansPage() {
	return (
		<Card>
			<CardContent className="flex flex-col items-center justify-center py-16">
				<div className="mb-4 rounded-full bg-muted p-4">
					<Users className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-display text-lg font-semibold">No fans yet</h3>
				<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
					When fans submit their email through your capture pages, they'll appear here. You'll be
					able to filter by page, date, and capture method.
				</p>
			</CardContent>
		</Card>
	);
}
