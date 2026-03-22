import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center">
				<h1 className="font-display text-4xl font-bold text-honey-gold">Afterset</h1>
				<p className="mt-4 text-lg text-gray-400">Dashboard coming soon.</p>
			</div>
		</div>
	);
}
