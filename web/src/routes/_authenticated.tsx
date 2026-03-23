import { createFileRoute, Link, Outlet, redirect, useMatchRoute } from "@tanstack/react-router";
import { BarChart3, LayoutDashboard, LogOut, Mail, QrCode, Settings, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
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
import { getUser, signOut } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: ({ context }) => {
		if (!context.auth.getUser()) {
			throw redirect({ to: "/login" });
		}
	},
	component: AuthenticatedLayout,
});

const navItems = [
	{ to: "/dashboard", label: "Overview", icon: LayoutDashboard },
	{ to: "/pages", label: "Capture Pages", icon: QrCode },
	{ to: "/emails", label: "Emails", icon: Mail },
	{ to: "/fans", label: "Fans", icon: Users },
	{ to: "/analytics", label: "Analytics", icon: BarChart3 },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
	const user = getUser();
	const matchRoute = useMatchRoute();
	const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";

	async function handleSignOut() {
		await signOut();
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
									{navItems.map((item) => (
										<SidebarMenuItem key={item.to}>
											<SidebarMenuButton asChild isActive={!!matchRoute({ to: item.to })}>
												<Link to={item.to}>
													<item.icon />
													<span>{item.label}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
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
						<h1 className="font-display text-sm font-semibold">
							{navItems.find((item) => matchRoute({ to: item.to }))?.label ?? "Dashboard"}
						</h1>
					</header>
					<main className="flex-1 overflow-auto p-6">
						<Outlet />
					</main>
				</SidebarInset>
			</SidebarProvider>
		</TooltipProvider>
	);
}
