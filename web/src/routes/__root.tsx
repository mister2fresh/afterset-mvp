import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { AuthUser } from "../lib/auth";

interface RouterContext {
	queryClient: QueryClient;
	auth: { getUser: () => AuthUser | null };
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootLayout,
});

function RootLayout() {
	return (
		<>
			<Outlet />
			{import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
		</>
	);
}
