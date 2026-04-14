import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useTier } from "@/hooks/use-tier";

export function InactiveBanner(): React.ReactElement | null {
	const { effectiveTier } = useTier();
	if (effectiveTier !== "inactive") return null;

	return (
		<div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
			<AlertTriangle className="size-4 shrink-0 text-red-300" />
			<p className="min-w-[14rem] flex-1">
				<span className="font-medium text-red-200">Your plan is inactive.</span> Capture pages are
				paused and follow-up emails are held. Start a subscription to resume.
			</p>
			<Link
				to="/settings"
				className="shrink-0 rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-500/30"
			>
				Start subscription
			</Link>
		</div>
	);
}
