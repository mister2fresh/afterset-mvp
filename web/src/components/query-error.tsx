import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function QueryError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center justify-center py-16">
				<div className="mb-4 rounded-full bg-destructive/10 p-4">
					<AlertTriangle className="size-8 text-destructive" />
				</div>
				<h3 className="font-display text-lg font-semibold">Something went wrong</h3>
				<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
					{message || "Failed to load data. Please try again."}
				</p>
				{onRetry && (
					<Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
						<RefreshCw className="size-3.5" />
						Retry
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
