import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsage } from "@/hooks/use-usage";

export function PausedEmailsBanner(): React.ReactElement | null {
	const { data } = useUsage();
	const pausedCount = data?.emails.paused_count ?? 0;
	if (pausedCount === 0) return null;

	return (
		<div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
			<AlertTriangle className="size-4 shrink-0 text-amber-400" />
			<p className="flex-1 text-amber-100">
				<span className="font-medium">{pausedCount}</span> fan email
				{pausedCount === 1 ? " is" : "s are"} paused and won't send right now.
			</p>
			<Button
				asChild
				variant="outline"
				size="sm"
				className="shrink-0 border-amber-500/40 bg-transparent text-amber-100 hover:bg-amber-500/20"
			>
				<Link to="/settings" hash="paused-emails">
					Review
				</Link>
			</Button>
		</div>
	);
}
