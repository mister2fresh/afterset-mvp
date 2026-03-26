import { Download, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

export function PwaInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (localStorage.getItem(DISMISSED_KEY)) return;

		const handler = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
			setVisible(true);
		};

		window.addEventListener("beforeinstallprompt", handler);
		return () => window.removeEventListener("beforeinstallprompt", handler);
	}, []);

	const install = useCallback(async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted") {
			setVisible(false);
		}
		setDeferredPrompt(null);
	}, [deferredPrompt]);

	const dismiss = useCallback(() => {
		setVisible(false);
		setDeferredPrompt(null);
		localStorage.setItem(DISMISSED_KEY, "1");
	}, []);

	if (!visible) return null;

	return (
		<div className="fixed bottom-20 left-4 right-4 z-50 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80">
			<div className="flex items-center gap-3 rounded-lg border border-honey-gold/20 bg-midnight-light p-3 shadow-lg">
				<Download className="size-5 shrink-0 text-honey-gold" />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium text-white">Install Afterset</p>
					<p className="text-xs text-muted-foreground">Add to your home screen for quick access</p>
				</div>
				<div className="flex shrink-0 gap-1">
					<Button size="sm" variant="ghost" className="size-8 p-0" onClick={dismiss}>
						<X className="size-4" />
					</Button>
					<Button size="sm" onClick={install}>
						Install
					</Button>
				</div>
			</div>
		</div>
	);
}
