import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getUser, signOut } from "../../lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const user = getUser();
	const navigate = useNavigate();

	async function handleSignOut() {
		await signOut();
		navigate({ to: "/login" });
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center">
				<h1 className="font-display text-4xl font-bold text-honey-gold">Afterset</h1>
				<p className="mt-4 text-gray-400">
					Signed in as <span className="text-white">{user?.email}</span>
				</p>
				<button
					type="button"
					onClick={handleSignOut}
					className="mt-6 text-sm text-electric-blue hover:underline"
				>
					Sign out
				</button>
			</div>
		</div>
	);
}
