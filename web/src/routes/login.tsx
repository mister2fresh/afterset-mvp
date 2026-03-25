import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2, Mail } from "lucide-react";
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
	const [resending, setResending] = useState(false);
	const [resent, setResent] = useState(false);

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

	async function handleResend() {
		setResending(true);
		try {
			await signInWithMagicLink(email);
		} catch {
			// Silently fail — user can try again
		} finally {
			setResending(false);
			setResent(true);
		}
	}

	if (submitted) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="mx-auto w-full max-w-sm text-center">
					<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-honey-gold/10">
						<Mail className="size-6 text-honey-gold" />
					</div>
					<h1 className="font-display text-3xl font-bold text-honey-gold">Check your email</h1>
					<p className="mt-4 text-gray-400">
						We sent a magic link to <span className="text-white">{email}</span>. Click it to sign
						in.
					</p>
					<p className="mt-2 text-sm text-gray-500">
						Usually arrives within a minute. Check your spam folder if you don't see it.
					</p>
					<div className="mt-6 flex flex-col items-center gap-3">
						<button
							type="button"
							onClick={handleResend}
							disabled={resending || resent}
							className="text-sm text-electric-blue hover:underline disabled:text-gray-500 disabled:no-underline"
						>
							{resending ? (
								<span className="inline-flex items-center gap-1.5">
									<Loader2 className="size-3 animate-spin" />
									Sending...
								</span>
							) : resent ? (
								"Link resent"
							) : (
								"Resend magic link"
							)}
						</button>
						<button
							type="button"
							onClick={() => {
								setSubmitted(false);
								setResent(false);
								setError(null);
							}}
							className="text-sm text-gray-500 hover:text-gray-400"
						>
							Use a different email
						</button>
					</div>
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
