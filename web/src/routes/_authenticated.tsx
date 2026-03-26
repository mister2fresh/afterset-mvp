import { createFileRoute, Link, Outlet, redirect, useMatchRoute } from "@tanstack/react-router";
import {
	BarChart3,
	HelpCircle,
	LayoutDashboard,
	LogOut,
	Mail,
	QrCode,
	Settings,
	Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { api } from "@/lib/api";
import { clearUser, getUser, signOut } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ context }) => {
		if (!context.auth.getUser()) {
			throw redirect({ to: "/login" });
		}

		let settings: { onboarding_completed: boolean };
		try {
			settings = await context.queryClient.fetchQuery({
				queryKey: ["settings"],
				queryFn: () => api.get<{ onboarding_completed: boolean }>("/settings"),
				staleTime: 1000 * 60 * 5,
			});
		} catch {
			clearUser();
			context.queryClient.removeQueries({ queryKey: ["settings"] });
			throw redirect({ to: "/login" });
		}

		if (!settings.onboarding_completed) {
			throw redirect({ to: "/onboarding" });
		}
	},
	component: AuthenticatedLayout,
});

const tabItems = [
	{ to: "/dashboard", label: "Overview", icon: LayoutDashboard },
	{ to: "/pages", label: "Pages", icon: QrCode },
	{ to: "/emails", label: "Emails", icon: Mail },
	{ to: "/fans", label: "Fans", icon: Users },
	{ to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

const sidebarItems = [
	...tabItems.map((item) => ({
		...item,
		label: item.to === "/pages" ? "Capture Pages" : item.label,
	})),
	{ to: "/help", label: "Help", icon: HelpCircle },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
	const user = getUser();
	const matchRoute = useMatchRoute();
	const isMobile = useIsMobile();
	const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";
	usePushNotifications();

	async function handleSignOut() {
		await signOut();
	}

	const currentLabel =
		sidebarItems.find((item) => matchRoute({ to: item.to }))?.label ?? "Dashboard";

	if (isMobile) {
		return (
			<div className="fixed inset-0 flex flex-col bg-background">
				<header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
					<Link to="/dashboard">
						<span className="font-display text-lg font-bold text-honey-gold">Afterset</span>
					</Link>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Avatar className="size-8">
									<AvatarFallback className="bg-honey-gold/20 text-honey-gold text-xs">
										{initials}
									</AvatarFallback>
								</Avatar>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<div className="px-2 py-1.5 text-sm text-muted-foreground truncate">
								{user?.email}
							</div>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link to="/help">
									<HelpCircle />
									<span>Help</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/settings">
									<Settings />
									<span>Settings</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleSignOut}>
								<LogOut />
								<span>Sign out</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</header>
				<main className="min-h-0 flex-1 overflow-auto p-4">
					<Outlet />
				</main>
				<nav className="shrink-0 border-t bg-sidebar">
					<div className="flex h-14 items-center justify-around">
						{tabItems.map((item) => {
							const active = !!matchRoute({ to: item.to });
							return (
								<Link
									key={item.to}
									to={item.to}
									className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs transition-colors ${
										active ? "text-honey-gold" : "text-muted-foreground"
									}`}
								>
									<item.icon className="size-5" />
									<span>{item.label}</span>
								</Link>
							);
						})}
					</div>
					<div className="h-[env(safe-area-inset-bottom)]" />
				</nav>
			</div>
		);
	}

	return (
		<TooltipProvider>
			<SidebarProvider>
				<Sidebar>
					<SidebarHeader className="px-4 py-4">
						<Link to="/dashboard" className="block">
							<span className="font-display text-xl font-bold text-honey-gold">Afterset</span>
						</Link>
					</SidebarHeader>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Menu</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{sidebarItems.map((item) => {
										const active = !!matchRoute({ to: item.to });
										return (
											<SidebarMenuItem key={item.to}>
												<SidebarMenuButton asChild isActive={active}>
													<Link
														to={item.to}
														className={
															active
																? "border-l-2 border-honey-gold pl-1.5 [&_svg]:text-honey-gold"
																: ""
														}
													>
														<item.icon />
														<span>{item.label}</span>
													</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
					<SidebarFooter>
						<SidebarMenu>
							<SidebarMenuItem>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<SidebarMenuButton className="h-auto py-2">
											<Avatar className="size-6">
												<AvatarFallback className="bg-honey-gold/20 text-honey-gold text-xs">
													{initials}
												</AvatarFallback>
											</Avatar>
											<span className="truncate text-sm">{user?.email}</span>
										</SidebarMenuButton>
									</DropdownMenuTrigger>
									<DropdownMenuContent side="top" align="start" className="w-56">
										<DropdownMenuItem onClick={handleSignOut}>
											<LogOut />
											<span>Sign out</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarFooter>
				</Sidebar>
				<SidebarInset>
					<header className="flex h-14 items-center gap-2 border-b px-4">
						<SidebarTrigger />
						<Separator orientation="vertical" className="h-5" />
						<h1 className="font-display text-sm font-semibold">{currentLabel}</h1>
					</header>
					<main className="flex-1 overflow-auto p-6">
						<Outlet />
					</main>
				</SidebarInset>
			</SidebarProvider>
		</TooltipProvider>
	);
}
