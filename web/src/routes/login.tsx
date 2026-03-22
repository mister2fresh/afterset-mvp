import { createFileRoute, redirect } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { signInWithMagicLink } from "../lib/auth";

export const Route = createFileRoute("/login")({
	beforeLoad: ({ context }) => {
		if (context.auth.getUser()) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const [email, setEmail] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			await signInWithMagicLink(email);
			setSubmitted(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	if (submitted) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="mx-auto w-full max-w-sm text-center">
					<h1 className="font-display text-3xl font-bold text-honey-gold">Check your email</h1>
					<p className="mt-4 text-gray-400">
						We sent a magic link to <span className="text-white">{email}</span>. Click it to sign
						in.
					</p>
					<button
						type="button"
						onClick={() => {
							setSubmitted(false);
							setError(null);
						}}
						className="mt-6 text-sm text-electric-blue hover:underline"
					>
						Use a different email
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="mx-auto w-full max-w-sm">
				<h1 className="font-display text-center text-3xl font-bold text-honey-gold">
					Sign in to Afterset
				</h1>
				<p className="mt-2 text-center text-gray-400">Enter your email to receive a magic link.</p>
				<form onSubmit={handleSubmit} className="mt-8 space-y-4">
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@example.com"
						className="w-full rounded-lg border border-gray-700 bg-midnight-light px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-honey-gold"
					/>
					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-honey-gold px-4 py-3 font-semibold text-midnight transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{loading ? "Sending..." : "Send magic link"}
					</button>
					{error && <p className="text-center text-sm text-red-400">{error}</p>}
				</form>
			</div>
		</div>
	);
}
