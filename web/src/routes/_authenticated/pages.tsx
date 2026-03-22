import { createFileRoute } from "@tanstack/react-router";
import { Plus, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/pages")({
	component: PagesPage,
});

function PagesPage() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground">Create and manage your fan capture pages.</p>
				<Button disabled>
					<Plus />
					New Page
				</Button>
			</div>

			<Card>
				<CardContent className="flex flex-col items-center justify-center py-16">
					<div className="mb-4 rounded-full bg-muted p-4">
						<QrCode className="size-8 text-muted-foreground" />
					</div>
					<h3 className="font-display text-lg font-semibold">No capture pages yet</h3>
					<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
						Capture pages let fans submit their email after scanning a QR code at your show. Each
						page generates a unique QR code and link.
					</p>
					<Button className="mt-6" disabled>
						<Plus />
						Create Your First Page
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
