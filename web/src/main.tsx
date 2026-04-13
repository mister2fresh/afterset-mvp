import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import "./index.css";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaReloadPrompt } from "@/components/pwa-reload-prompt";
import { Toaster } from "@/components/ui/sonner";
import { getUser, initAuth } from "./lib/auth";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60,
			retry: 1,
		},
	},
	mutationCache: new MutationCache({
		onError: (error) => {
			toast.error(error.message || "Something went wrong");
		},
	}),
});

const router = createRouter({
	routeTree,
	context: {
		queryClient,
		auth: { getUser },
	},
	defaultPreload: "intent",
});

await initAuth(() => router.invalidate());

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<Toaster position="bottom-right" />
			<PwaReloadPrompt />
			<PwaInstallPrompt />
		</QueryClientProvider>
	</StrictMode>,
);
