import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";
import { toast } from "sonner";

export function PwaReloadPrompt() {
	const {
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		immediate: true,
		onRegisteredSW(_url, registration) {
			if (registration) {
				setInterval(() => registration.update(), 60 * 60 * 1000);
			}
		},
	});

	useEffect(() => {
		if (!needRefresh) return;
		toast("New version available", {
			description: "Refresh to get the latest updates.",
			duration: Number.POSITIVE_INFINITY,
			action: {
				label: "Refresh",
				onClick: () => updateServiceWorker(),
			},
			onDismiss: () => setNeedRefresh(false),
		});
	}, [needRefresh, setNeedRefresh, updateServiceWorker]);

	return null;
}
